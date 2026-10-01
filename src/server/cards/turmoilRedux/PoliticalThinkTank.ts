import {IActionCard} from '../ICard';
import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {IPlayer} from '../../IPlayer';
import {CardRenderer} from '../render/CardRenderer';
import {RevealCheck} from '../../../common/models/RevealResultModel';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import * as actionReveals from '../actionReveals';
import {hasPartyRequirement, partyRequirementCardsInGame, requiredPartyOf} from '../requirements/partyRequirementCards';

/** The M€ a kept reveal pays (printed: «gain 5 M€»). */
export const POLITICAL_THINK_TANK_REWARD = 5;

/**
 * TR13 — POLITICAL THINK TANK («Политический аналитический центр»).
 *
 * The game's third DECK CHECK (after Search For Life and Asteroid Deflection
 * System) and the first that KEEPS the revealed card: «Action: Reveal the top
 * card of the projects deck. If it has a party requirement, take it into hand
 * and gain 5 M€. Otherwise discard it.» Cost 5, blue, Mars tag, no requirement,
 * no VP.
 *
 * SCAN READING — the plate beside the cost is EMPTY (no requirement); the one
 * planet in the corner is the Mars tag. The action row is «→ [requirement plate
 * with the purple «?» pill]* : [card]* [5 M€]» — the pill inside the ORANGE
 * REQUIREMENT PLATE is «a requirement of ANY party» (the `PARTY_REQUIREMENT`
 * glyph). The purple hexagon at the bottom left is the Turmoil symbol: for a
 * card of this manifest it is the module itself, so no `compatibility`.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/PoliticalThinkTank.spec.ts):
 *  1. The action is FREE, once a generation like any blue action; the only
 *     thing that can block it is an empty deck (`deckEmpty`, the Asteroid
 *     Deflection System precedent).
 *  2. Exactly ONE card is revealed — the top one. Never «search until a match»:
 *     `drawCard({include})` (High Circles) is a different rule.
 *  3. «Party requirement» = a requirement of the `party` kind, for any party
 *     (`hasPartyRequirement` — the ONE reading, shared with High Circles and the
 *     future Politologist award). The chairman, party leaders, delegates on
 *     resolutions and influence are NOT party requirements. Events count.
 *  4. MATCH: the card goes INTO THE HAND (everybody saw it) and the player gains
 *     5 M€, sourced to this card. Whether the player could MEET the requirement
 *     now does not matter — the check is that the card HAS one.
 *  5. MISS: the card goes to the discard pile. Nothing is gained, and that is
 *     the printed outcome, not a skipped effect — no `effect-skipped` record.
 *  6. The kept card is an ordinary card in hand. The fork has no «when you draw
 *     a card» hook (`keep()`'s only side effect, Aerotech, reads the UNBOUGHT
 *     cards, and there are none), so the card goes straight into the hand; the
 *     draw analytics see it (`recordCardsDrawn`), the drawn-cards REVEAL does
 *     not — the verdict already shows this card, a second presentation of it
 *     would be the same object twice.
 *  7. MarsBot never plays the card; the automa does not react to a reveal.
 *
 * THE FACT THE CARD SHIPS WITH (owner's decision, 2026-10-01): today the Redux
 * deck holds NO card with a party requirement — the 27 in the repository are
 * classic Turmoil / Prelude 2 / Moon / Pathfinders, none of which joins a Redux
 * game, and the set's own (TR14–TR27, «Requires Mars First / Unity to be
 * ruling…») are not shipped yet. Until the first of them the action always
 * misses. The composer says so honestly: the preview carries the COMPOSITION
 * (`pool.count` — open information about the game's set, never the number left
 * in the hidden deck) and the client warns at zero.
 */
export class PoliticalThinkTank extends Card implements IActionCard, IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.POLITICAL_THINK_TANK,
      tags: [Tag.MARS],
      cost: 5,

      metadata: {
        cardNumber: 'TR13',
        infoText: [{kind: 'action-short', text: 'Reveal a card: a party requirement keeps it, +5 M€'}],
        renderData: CardRenderer.builder((b) => {
          b.action('Reveal the top card of the projects deck. If it has a party requirement, take it into hand and gain 5 M€. Otherwise discard it.', (eb) => {
            eb.empty().startAction.partyRequirement().asterix().nbsp.colon().nbsp.cards(1).asterix().megacredits(POLITICAL_THINK_TANK_REWARD);
          });
        }),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    return player.game.projectDeck.canDraw(1);
  }

  public actionUnavailableReason() {
    return actionReason.deckEmpty();
  }

  /** What the action checks — the same object before the reveal (the preview) and after it (the verdict). */
  private check(): RevealCheck {
    return {icon: 'party-requirement', label: 'Party requirement'};
  }

  // The outcome is random, so it rides the premium reveal slot (check: a party
  // requirement → the card into the hand + 5 M€) instead of a fixed gain chip.
  // The card itself is NOT a `cards` gain here: that chip is what an outcome
  // claim reads as «this action draws a batch», and a kept reveal is a verdict.
  public actionPreview(player: IPlayer) {
    return actionPreviews.singleBranch(this, player, [], [], {reveal: {
      deck: 'project',
      check: this.check(),
      reward: actionPreviews.stockGain(player, Resource.MEGACREDITS, POLITICAL_THINK_TANK_REWARD),
      keepsCard: true,
      pool: {count: partyRequirementCardsInGame(player.game)},
    }});
  }

  public action(player: IPlayer) {
    const game = player.game;
    const card = game.projectDeck.drawOrThrow(game);
    const found = hasPartyRequirement(card);
    game.events?.recordCardReveal(player, this, {origin: 'deck', result: found ? 'kept' : 'discarded', count: 1, found});
    if (found) {
      game.log('${0} revealed and kept ${1}', (b) => b.player(player).card(card, {tags: true}),
        {reveal: {origin: 'deck', result: 'kept', source: this.name}});
      // Measured BEFORE the gain: the verdict's chip reads «current → resulting» honestly.
      const reward = actionPreviews.stockGain(player, Resource.MEGACREDITS, POLITICAL_THINK_TANK_REWARD);
      player.cardsInHand.push(card);
      game.events?.recordCardsDrawn(player, 1);
      player.stock.add(Resource.MEGACREDITS, POLITICAL_THINK_TANK_REWARD, {log: true, from: {card: this}});
      actionReveals.recordReveal(player, this.name, card, true, reward, undefined,
        {...this.check(), party: requiredPartyOf(card)}, 'hand');
    } else {
      game.log('${0} revealed and discarded ${1}', (b) => b.player(player).card(card, {tags: true}),
        {reveal: {origin: 'deck', result: 'discarded', source: this.name}});
      // Recorded BEFORE the discard (the card is serialized now) — as Search For Life does.
      actionReveals.recordReveal(player, this.name, card, false,
        actionPreviews.stockGain(player, Resource.MEGACREDITS, POLITICAL_THINK_TANK_REWARD), undefined,
        this.check(), 'discard');
      game.projectDeck.discard(card);
    }
    return undefined;
  }
}
