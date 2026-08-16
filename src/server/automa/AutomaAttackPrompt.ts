import {BotAttackPromptMeta, BotAttackSource, BotAttackTargetPreview} from '../../common/models/BotAttackPromptModel';
import {CardResource} from '../../common/CardResource';
import {ICard} from '../cards/ICard';
import {IPlayer} from '../IPlayer';
import {resourceVictoryPoints} from '../models/actionPreview';

/**
 * THE MARSBOT ATTACK PRESENTATION LAYER — the ONE place that turns «a bot
 * effect forces this player to point at one of their own cards» into the
 * structured context the client renders.
 *
 * It exists so that no hostile bot effect ever again ships its meaning inside
 * an English sentence. A card's resolver states the FACTS it already knows —
 * who attacked, with which of the bot's cards, what leaves, and which cards the
 * RULES left selectable — and this module derives the exact consequence of
 * every candidate from the same scoring sources the real rules use.
 *
 * READ-ONLY, like every other preview producer in this codebase: it never
 * mutates a card, a stock or the game, and the resource cubes it describes
 * leave only when the player's answer reaches the server.
 *
 * ADDING AN EFFECT is adding a builder here plus a `BotAttackEffect` value —
 * never a second marker and never a per-card client branch.
 */

export type CardResourceAttackArgs = {
  /** The seat performing the attack (the bot). */
  attacker: IPlayer;
  /** The seat that must answer — the owner of every candidate. */
  victim: IPlayer;
  /** WHICH of the attacker's cards produced the effect. */
  source: BotAttackSource;
  /** The SELECTABLE candidates, exactly as the prompt offers them. */
  targets: ReadonlyArray<ICard>;
  /** Cubes leaving the chosen card. */
  amount: number;
  /**
   * The rule that narrowed the candidate set, as an English i18n key. Omitted
   * when the set is simply "every card that can be hit" and no explanation is
   * owed.
   */
  restrictionKey?: string;
};

/**
 * Build the context for a "remove N card resources from a card YOU choose"
 * attack.
 *
 * The per-candidate preview is derived, not declared:
 *  · resources   — the card's own live count, minus what leaves (floored at 0,
 *                  the same clamp `removeResourceFrom` applies);
 *  · victoryPoints — the CARD's own points through `resourceVictoryPoints`,
 *                  i.e. the card's real `victoryPoints` descriptor evaluated by
 *                  the owner's own `Counter`. That is what makes «1 ПО за
 *                  каждые ДВЕ фишки» read correctly instead of assuming one
 *                  cube is one point. `undefined` for a card whose points the
 *                  resource does not touch at all;
 *  · score       — the victim's TOTAL, moved by exactly that card's delta. The
 *                  total is read ONCE (a full breakdown is not cheap) and the
 *                  per-candidate value is derived from it, which is exact:
 *                  nothing else in the tableau changes.
 */
export function cardResourceAttackPrompt(args: CardResourceAttackArgs): BotAttackPromptMeta {
  const {victim, amount} = args;
  // Read once. Every candidate moves the SAME total by its own card delta, so a
  // per-candidate breakdown would be N identical walks of the whole tableau.
  const scoreBefore = victim.getVictoryPoints().total;

  const targets: Array<BotAttackTargetPreview> = args.targets.map((card) => {
    const before = card.resourceCount;
    const vp = resourceVictoryPoints(victim, card, -amount);
    const preview: BotAttackTargetPreview = {
      card: card.name,
      // Every candidate of a card-resource attack holds a typed resource by
      // construction (the targeting rule selected it BY that type); the
      // fallback keeps the model total rather than asserting.
      resource: card.resourceType ?? CardResource.RESOURCE_CUBE,
      resources: {before, after: Math.max(0, before - amount)},
      victoryPoints: vp === undefined ? undefined : {before: vp.from, after: vp.to},
    };
    if (vp !== undefined && vp.to !== vp.from) {
      preview.score = {before: scoreBefore, after: scoreBefore + (vp.to - vp.from)};
    }
    return preview;
  });

  // ONE resource type across the whole set, or none — a mixed animal/microbe
  // set must not be described by whichever type happened to come first.
  const types = new Set(targets.map((t) => t.resource));

  return {
    attacker: args.attacker.color,
    victim: victim.color,
    source: args.source,
    effect: 'removeCardResource',
    cardResource: types.size === 1 ? [...types][0] : undefined,
    amount,
    restrictionKey: args.restrictionKey,
    targets,
  };
}
