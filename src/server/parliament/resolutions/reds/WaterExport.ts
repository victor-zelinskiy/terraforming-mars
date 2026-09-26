/*
 * WATER EXPORT (the Reds) — Turmoil Redux resolution RX33: three parts of the
 * family in one card, and the FIRST law that TAKES TERRAFORMING BACK from the
 * planet — an ocean tile leaves the board (docs/TURMOIL_REDUX_WATER_EXPORT.md).
 *
 * Printed: «When enacted: Gain 2 M€ per point of Influence. If oceans are not
 * at maximum, the First Player removes 1 ocean tile from the board. Effect:
 * When playing an Earth, Venus, or Jovian tag, you pay 3 M€ less.» Chairman
 * quest: play 2 Jovian tags.
 *
 * THE READINGS FIXED HERE:
 *  · M€: 2 × the player's influence for EVERY participant — the family's
 *    ordinary supply payout (Gas Export's and Heat Capture's row, word for
 *    word). Influence 0 → nothing, NAMED.
 *  · THE WORLD'S PART is a REMOVAL, and it ASKS. The ocean count is the
 *    planet's, so the step is a WORLD step: once per enactment, after every
 *    seat's M€, whoever won and even when the NEUTRAL player did; its record
 *    carries no seat. What is new in the family is that the printed rule
 *    names an EXECUTOR by position — «the First Player» — who picks the cell:
 *    the driver hands the step the first player in generation order (the
 *    nearest human when that seat is MarsBot: the bot decides nothing at the
 *    Parliament, and the Automa has no rule for which ocean to remove) and
 *    routes the prompt to it. The executor need not be a voter, need not hold
 *    a delegate on the card: the law acts on the WORLD. The removal is the
 *    engine's own (`Game.removeTile`, the Reds' action's and Dry Deserts'
 *    mutation), through the family's ONE shared step (`tileRemovalStep`).
 *  · TWO CONDITIONS, TWO REASONS. «If oceans are not at maximum» is the card's
 *    clause and is checked FIRST; «no plain ocean on the board to remove»
 *    (none placed, or every ocean upgraded — the engine's own filter) second.
 *    Both are NAMED; the upstream deferred action's silent `undefined` is the
 *    defect the shared step replaces.
 *  · WHAT FOLLOWS THE REMOVAL is the engine's, pinned by spec, never
 *    programmed here: the ocean parameter drops by one (it is read off the
 *    board); NOBODY LOSES A TERRAFORM RATING (whoever placed the ocean keeps
 *    the step it paid — a rating is never taken back; an ocean placed there
 *    again pays a rating again, by the same rule); the cell's printed bonuses
 *    are not returned; a Capital's «+1 VP per adjacent ocean» recounts by the
 *    board as it stands at the end; an upgraded ocean is never removed.
 *  · THE DISCOUNT, while the card stands enacted: 3 M€ off the printed cost of
 *    a card with an Earth, Venus OR Jovian tag — ONCE PER CARD, never per tag
 *    (the printed rule says «you pay 3 M€ less», not «per tag»: a card with
 *    two of the three tags pays 3 M€ less, not 6) — asked by the ONE price
 *    function (`Player.getCardCostBreakdown` → `ParliamentHandler.cardDiscount`,
 *    Heat Capture's hook with three tags instead of one) and itemized there
 *    under THIS resolution's source. The price never goes below zero (the
 *    breakdown's own floor). Ends with the law: the handler reads the ENACTED
 *    definition at the query. Printed tags only, as the Unity policy reads a
 *    Space tag.
 *  · THE FORECAST TWIN of a discount is the price breakdown itself (Heat
 *    Capture decided and explained it): the passive's `forecast` states no
 *    fact for it — a fact would print the same 3 M€ a second time.
 *  · MARSBOT is outside the parliament: no M€, no discount, never asked to
 *    remove anything. The planet is shared like everybody's.
 *
 * THE STEP CONTRACT (IResolution.ts): the M€ step MUTATES; the removal step
 * ASKS (its answer removes) — and each reports exactly once, including both
 * branches where nothing is removed.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {TileRemovalDeclaration} from '../../../../common/parliament/tileRemoval';
import {IPlayer} from '../../../IPlayer';
import {IProjectCard} from '../../../cards/IProjectCard';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {tileRemovalStep} from '../ResolutionTileRemoval';

export const WATER_EXPORT_ID: ResolutionId = 'RDX_REDS_WATER_EXPORT';
export const WATER_EXPORT_CODE: ResolutionCode = 'RX33';

/** THE FORMULA: 2 M€ per point of influence, for every participant — no count, no cap. */
export const WATER_EXPORT_MEGACREDITS: InfluenceScaledEffect = {
  id: 'megacredits',
  unit: {kind: 'stock', resource: Resource.MEGACREDITS},
  perInfluence: 2,
  recipient: 'each',
};

/** THE WORLD'S PART, as data: one ocean tile leaves the board, chosen by the first player. */
export const WATER_EXPORT_REMOVAL: TileRemovalDeclaration = {tile: 'ocean', executor: 'first-player'};

/** THE PASSIVE'S RATE: 3 M€ off a card with an Earth, Venus or Jovian tag — once per card. */
export const WATER_EXPORT_DISCOUNT = 3;

/** The tags the discount answers — any ONE of them on the card is enough, and two of them are still one discount. */
export const WATER_EXPORT_TAGS: ReadonlyArray<Tag> = [Tag.EARTH, Tag.VENUS, Tag.JOVIAN];

/**
 * THE DISCOUNT the law takes off `card` for `player` — the one function the
 * price, its breakdown and the play forecast read (never a second reading of
 * the rule). Printed tags only; ONCE per card, whatever the number of
 * qualifying tags on it.
 */
export function waterExportDiscount(_player: IPlayer, card: IProjectCard): number {
  return card.tags.some((tag) => WATER_EXPORT_TAGS.includes(tag)) ? WATER_EXPORT_DISCOUNT : 0;
}

const MEGACREDITS_STEP: EnactStep = {
  key: 'megacredits',
  run(ctx) {
    const player = ctx.player;
    const effect = WATER_EXPORT_MEGACREDITS;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    if (amount <= 0) {
      ctx.game.log('${0} has no influence — no M€ from ${1}', (b) => b.player(player).resolution(WATER_EXPORT_ID));
      ctx.report({kind: 'skipped', effect: effect.id, stock: Resource.MEGACREDITS, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    const before = player.megaCredits;
    player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: WATER_EXPORT_ID}});
    const after = player.megaCredits;
    ctx.game.log('${0} gained ${1} M€ from ${2}: 2 per point of influence, influence ${3} (${4} → ${5})', (b) =>
      b.player(player).number(amount).resolution(WATER_EXPORT_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', effect: effect.id, stock: Resource.MEGACREDITS, amount, influence, before, after});
    return undefined;
  },
};

export const WATER_EXPORT: ResolutionDefinition = {
  id: WATER_EXPORT_ID,
  code: WATER_EXPORT_CODE,
  module: 'turmoilRedux',
  party: PartyName.REDS,
  copies: 1,
  // THE FACE, as printed: the per-influence formula on its own row, the
  // world's part on the next («− [ocean]» — one tile leaves), and the passive
  // as a RULE in the game's own dictionary — an Earth, Venus OR Jovian tag →
  // 3 M€ less (Heat Capture's drawing with the three tags joined by «/»).
  // One drawing serves the bill, the effects list and the inspector.
  renderData: CardRenderer.builder((b) => {
    b.megacredits(2).slash().influence().br;
    b.minus().oceans(1).br;
    b.effect(undefined, (eb) => eb.tag(Tag.EARTH).slash().tag(Tag.VENUS).slash().tag(Tag.JOVIAN).startEffect.megacredits(-WATER_EXPORT_DISCOUNT));
  }),
  text: {
    name: 'Water Export',
    effect: 'Gain 2 M€ for every point of your influence.',
    world: 'The first player removes 1 ocean tile from the board, unless the oceans are already at their maximum. Nobody loses TR for this.',
    // The block label says WHEN («Эффект, пока принята»); the sentence says WHAT.
    passive: 'When you play a card with an Earth, Venus or Jovian tag, you pay 3 M€ less for it.',
    quest: 'Play 2 Jovian tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.JOVIAN}, count: 2},
  scaled: [WATER_EXPORT_MEGACREDITS],
  tileRemoval: WATER_EXPORT_REMOVAL,
  immediateSteps: [MEGACREDITS_STEP],
  worldSteps: [tileRemovalStep(WATER_EXPORT_ID, WATER_EXPORT_REMOVAL)],
  passive: {
    cardDiscount: waterExportDiscount,
    // The discount's forecast twin is the price breakdown (see the header):
    // no fact of its own, and nothing else of this law fires on a play.
    forecast() {
      return [];
    },
  },
};
