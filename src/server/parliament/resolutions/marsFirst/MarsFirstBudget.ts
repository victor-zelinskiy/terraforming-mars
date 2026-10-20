/*
 * MARS FIRST BUDGET (Mars First) — Turmoil Redux resolution RX38: the SIXTH
 * card of the BUDGET family, and the grant Skyscrapers PREDICTED — its
 * contract named «Mars First Budget: `tileGrant` with an ordinary placement»
 * as the declaration's second variant before this file existed
 * (docs/TURMOIL_REDUX_MARS_FIRST_BUDGET.md).
 *
 * Printed: «When enacted: Lose 12 M€. Gain M€ equal to your Building and Mars
 * tags combined + Influence. Each player places a city tile. (Clockwise from
 * the First Player)» Chairman quest: play 2 Mars tags.
 *
 * EVERY part is a declaration of something already built: the LEVY is the
 * family's member and its ONE shared step (RX15), the payout is a TAG count
 * over two tags + influence (the form Unity / Greens Budget declared), and the
 * city is the tile grant's SECOND variant — WHO: everyone, WHERE: any legal
 * cell — paid by the grant's ONE shared step (`ResolutionTileGrant.ts`). This
 * file writes no mechanism: it states the sums, the tags and the steps.
 *
 * THE READINGS FIXED HERE:
 *  · THE PRINTED ORDER IS THE EXECUTED ORDER, seat by seat: levy → payout →
 *    city for the first seat, then all three for the next — the driver walks
 *    the seats in generation order from the CURRENT first player (the sitting
 *    runs before the marker passes), which IS «clockwise from the First
 *    Player»; a city placed by an earlier seat closes its neighbours to the
 *    later ones. Never reordered so that a seat can afford the levy.
 *  · THE LEVY IS THE FAMILY'S, whole: bounded by the seat (5 M€ pays 5 of 12
 *    and the record names the shortfall; 0 M€ pays nothing, a named skip),
 *    and both still receive every later part.
 *  · THE COUNT IS TWO TAGS ADDED UP — building and Mars, the canonical counter
 *    of each in the enactment's own context (`RESOLUTION_TAG_COUNTING_MODE` =
 *    `'raw'`): every source in play, a card printing both is 2, a wild tag is
 *    neither, a played event's tags are face down, the record keeps the
 *    per-tag totals beside the sum (`countedByTag`). Skipped — named — only
 *    when count and influence are both zero.
 *  · «EACH PLAYER PLACES A CITY TILE» is every PARTICIPANT, voter or not — a
 *    neutral winner cancels nothing — and it is MANDATORY (decision Р2: the
 *    print says «places», not «may place»): by the ORDINARY city rules (a cell
 *    of Mars, not next to another city; the reserved areas are their cards'
 *    business), the choice SHOWN even with one candidate. A cell with a
 *    placement cost is offered only when the seat can afford it AFTER the
 *    levy and the payout. No legal cell → a named skip, nothing instead.
 *  · THE CELL PAYS as any city in the political phase does: its printed bonus,
 *    the ocean adjacency, the Ares toll — and the RULING PARTY at that moment
 *    is Mars First itself (the law takes the ENACTED slot before its steps
 *    run): +1 steel for the tile and a card for the city, for every HUMAN
 *    (decision Р3). Every table reaction to a city answers too.
 *  · MARSBOT IS A SEAT OF THE CITY, and of the city only (decision D11, the
 *    owner 2026-10-20): never levied, never paid (a payout «per tag» would
 *    need an invented translation of its track positions), but it places its
 *    city IN ITS PLACE in the order, by its own rule (next to the most
 *    greeneries — `AutomaTilePlacer.placeCity`), with no Failed Action on an
 *    empty board (`automa/BotTileGrant.ts`). It ignores the ruling party.
 *  · The chairman quest never counts the sitting's city (the political phase
 *    — `QuestTracker.eligible`), the human's and the bot's alike.
 *
 * THE STEP CONTRACT (IResolution.ts): the levy and the payout MUTATE; the city
 * ASKS — its prompt's answer places the tile and reports the cell; a reload
 * inside the question re-runs `run`, which offers the same cells.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ResolutionLevy} from '../../../../common/parliament/resolutionLevy';
import {TileGrantDeclaration} from '../../../../common/parliament/tileGrant';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {resolutionCount} from '../ResolutionCounts';
import {levyStep} from '../ResolutionLevy';
import {tileGrantStep} from '../ResolutionTileGrant';

export const MARS_FIRST_BUDGET_ID: ResolutionId = 'RDX_MARS_MARS_FIRST_BUDGET';
export const MARS_FIRST_BUDGET_CODE: ResolutionCode = 'RX38';
/** The printed «Lose 12 M€». */
export const MARS_FIRST_BUDGET_LEVY_AMOUNT = 12;

/** THE LEVY, as data: 12 M€ from every participant, first. */
export const MARS_FIRST_BUDGET_LEVY: ResolutionLevy = {resource: Resource.MEGACREDITS, amount: MARS_FIRST_BUDGET_LEVY_AMOUNT, recipient: 'each'};

/** THE FORMULA: 1 M€ per building and Mars tag, plus 1 per influence, no cap, for every participant. */
export const MARS_FIRST_BUDGET_MEGACREDITS: InfluenceScaledEffect = {
  id: 'megacredits',
  unit: {kind: 'stock', resource: Resource.MEGACREDITS},
  perInfluence: 1,
  count: {id: 'buildingMarsTags', per: 1},
  recipient: 'each',
};

/** THE GRANT: one city tile for EVERY participant, on any cell the ordinary city rules allow. */
export const MARS_FIRST_BUDGET_GRANT: TileGrantDeclaration = {
  tile: 'city',
  placement: 'any-legal',
  recipients: {kind: 'everyone'},
};

/** The server's own reason for a payout of nothing — the count and the influence are both zero. */
export const MARS_FIRST_BUDGET_NO_TAGS_REASON = 'No building or Mars tags and no influence';

const MEGACREDITS_STEP: EnactStep = {
  key: 'megacredits',
  run(ctx) {
    const player = ctx.player;
    const effect = MARS_FIRST_BUDGET_MEGACREDITS;
    // The canonical count of each of the two tags in the enactment's own
    // context — the PRINTED tags, with the cards that made them and the
    // per-tag totals the reading explains the sum by.
    const counted = resolutionCount(player, 'buildingMarsTags');
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence, counted.count);
    const recorded = {
      effect: effect.id,
      stock: Resource.MEGACREDITS,
      influence,
      count: counted.count,
      counted: [...counted.cards],
      ...(counted.units === undefined ? {} : {countedUnits: [...counted.units]}),
      ...(counted.byTag === undefined ? {} : {countedByTag: counted.byTag.map((entry) => ({...entry}))}),
    };
    if (amount <= 0) {
      ctx.game.log('${0} has no building or Mars tags and no influence — no M€ from ${1}', (b) =>
        b.player(player).resolution(MARS_FIRST_BUDGET_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: MARS_FIRST_BUDGET_NO_TAGS_REASON});
      return undefined;
    }
    const before = player.megaCredits;
    // The standard gain under this resolution's source (its events, the party
    // reactions, the recorder); the ONE journal line below carries the whole
    // calculation, so the add itself stays silent.
    player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: MARS_FIRST_BUDGET_ID}});
    const after = player.megaCredits;
    ctx.game.log('${0} gained ${1} M€ from ${2}: ${3} building and Mars tag(s) + ${4} influence (${5} → ${6})', (b) =>
      b.player(player).number(amount).resolution(MARS_FIRST_BUDGET_ID)
        .number(counted.count).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', ...recorded, amount, before, after});
    return undefined;
  },
};

/** THE CITY — the grant's shared step with this card's own words (the prompt's title is journal text only). */
const CITY_STEP = tileGrantStep(MARS_FIRST_BUDGET_ID, MARS_FIRST_BUDGET_GRANT, {
  title: 'Place a city tile (Mars First Budget)',
  context: 'The resolution is enacted: every player places a city tile, clockwise from the first player.',
});

export const MARS_FIRST_BUDGET: ResolutionDefinition = {
  id: MARS_FIRST_BUDGET_ID,
  code: MARS_FIRST_BUDGET_CODE,
  module: 'turmoilRedux',
  party: PartyName.MARS,
  copies: 1,
  // THE FACE, as printed: «−12 [M€]» (the negative INSIDE the tile) beside the
  // grey CITY hex on the first row; the rate «1 [M€] / [building] + [Mars] +
  // [influence]» on the second, the medallions in the scan's own order. The
  // counted objects are the printed TAG medallions — the card counts tags.
  renderData: CardRenderer.builder((b) => {
    b.megacredits(-MARS_FIRST_BUDGET_LEVY_AMOUNT).nbsp.city().br;
    b.megacredits(1).slash().tag(Tag.BUILDING).plus().tag(Tag.MARS).plus().influence();
  }),
  text: {
    name: 'Mars First Budget',
    effect: 'Lose 12 M€. Then gain 1 M€ per building and Mars tag you have, plus 1 per influence. Then every player places a city tile, clockwise from the first player.',
    quest: 'Play 2 Mars tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.MARS}, count: 2},
  levy: MARS_FIRST_BUDGET_LEVY,
  scaled: [MARS_FIRST_BUDGET_MEGACREDITS],
  tileGrant: MARS_FIRST_BUDGET_GRANT,
  // THE PRINTED ORDER: the levy first, the payout second, the city last — for every seat in turn.
  immediateSteps: [levyStep(MARS_FIRST_BUDGET_ID, MARS_FIRST_BUDGET_LEVY), MEGACREDITS_STEP, CITY_STEP],
};
