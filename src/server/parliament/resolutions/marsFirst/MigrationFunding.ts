/*
 * MIGRATION FUNDING (Mars First) — Turmoil Redux resolution RX21: the twin of
 * Colonization Funding over the OTHER half of the board — and the first count
 * that pays by a QUANTITY the engine sums, not by a list it walks
 * (docs/TURMOIL_REDUX_MIGRATION_FUNDING.md).
 *
 * Printed: «When enacted: Each player gains 2 M€ per city they own on Mars +
 * Influence. (Each city in a stack counts separately.)» Chairman quest: 2
 * cities on Mars. A base card.
 *
 * THE READINGS FIXED HERE:
 *  · The amount is 2 × (C + I) for EVERY participant — voters or not, the
 *    ruling party or not; a neutral winner cancels nothing. There is NO
 *    winner-only part, no world step, no passive, and NO CAP (the card prints
 *    none — `cap` is not declared).
 *  · C = the player's CITIES ON MARS, EACH TIER OF A STACK SEPARATELY: the
 *    engine's own quantity (`MarsBoard.countCities(player, 'onmars')` — the
 *    function Mayor, Metropolist and the countables sum the stacks with),
 *    never the length of the cell list. A cell of height 2 (Skyscrapers) is
 *    2. A space city is off Mars and does not count; a rival's city is theirs.
 *    THE TRAP this card was written against: `marsCities` — Skyscrapers'
 *    count of DESTINATIONS — reads the SAME cells and counts each ONCE; the
 *    two agree on every board without a stack and part by exactly the stack.
 *    So this card declares its OWN id (`marsCityTiers`), and the declaration
 *    says which measure it is (`resolutionCountKind(...).measure`).
 *  · The record explains the number with the CELLS and each cell's HEIGHT
 *    (`countedSpaces` + `countedTiers`, aligned) — «4 from 3 cells» is a
 *    stack of 2 on the third, never a bug.
 *  · Influence pays on its own: no city on Mars and influence 3 is +6. The
 *    skip is only for a total of zero, and it names ITSELF («no city on Mars
 *    and no influence») — never «no influence» alone.
 *  · I = the player's influence through the Redux ledger (`ctx.influence`,
 *    read AFTER the winner's Agenda step of the phase — rulebook p.10).
 *  · It is CASH into the supply through `stock.add` (its events, the party
 *    reactions, the recorder) — never production, never a field write.
 *  · ONCE, at the enactment: the driver's idempotency key
 *    (`effect:<generation>:<instance>:<player>:megacredits`) makes a reload or
 *    a repeated handler call pay nothing twice; a later city, a later tier and
 *    a later influence never recompute it (the outcome freezes C, the cells,
 *    the heights, I and the value before and after).
 *  · MarsBot never participates in the parliament: not counted, not paid.
 *
 * THE STEP MUTATES (IResolution.ts): no question is asked, so `run` applies
 * the gain and reports it; the driver marks the key applied before anything
 * else can run.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Size} from '../../../../common/cards/render/Size';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {resolutionCount} from '../ResolutionCounts';

export const MIGRATION_FUNDING_ID: ResolutionId = 'RDX_MARSFIRST_MIGRATION_FUNDING';
export const MIGRATION_FUNDING_CODE: ResolutionCode = 'RX21';
/** The printed «2 M€ per city … + Influence» — one rate for both terms. */
export const MIGRATION_FUNDING_PER_UNIT = 2;
/** The skip's reason — the English key the stage plate translates. */
export const MIGRATION_FUNDING_SKIP_REASON = 'No cities on Mars and no influence';

/** THE FORMULA: 2 M€ per city on Mars (a tier apiece) + 2 M€ per influence, uncapped, for every participant. */
export const MIGRATION_FUNDING_MEGACREDITS: InfluenceScaledEffect = {
  id: 'megacredits',
  unit: {kind: 'stock', resource: Resource.MEGACREDITS},
  perInfluence: MIGRATION_FUNDING_PER_UNIT,
  count: {id: 'marsCityTiers', per: MIGRATION_FUNDING_PER_UNIT},
  recipient: 'each',
};

const MEGACREDITS_STEP: EnactStep = {
  key: 'megacredits',
  run(ctx) {
    const player = ctx.player;
    const effect = MIGRATION_FUNDING_MEGACREDITS;
    // The engine's own quantity of the player's cities on Mars — the stacks
    // summed — with the CELLS and their HEIGHTS that made it (see
    // `ResolutionCounts.ts`). Never the cell list's length.
    const counted = resolutionCount(player, 'marsCityTiers');
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence, counted.count);
    const recorded = {
      effect: effect.id,
      stock: Resource.MEGACREDITS,
      influence,
      count: counted.count,
      counted: [...counted.cards],
      countedSpaces: [...(counted.spaces ?? [])],
      countedTiers: [...(counted.tiers ?? [])],
    };
    if (amount <= 0) {
      ctx.game.log('${0} has no city on Mars and no influence — no ${1} from ${2}', (b) =>
        b.player(player).resource(Resource.MEGACREDITS).resolution(MIGRATION_FUNDING_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: MIGRATION_FUNDING_SKIP_REASON});
      return undefined;
    }
    const before = player.megaCredits;
    // The standard gain: its events, the party reactions and the recorder see
    // it under this resolution's source. The ONE journal line below carries
    // the whole calculation, so the add itself stays silent.
    player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: MIGRATION_FUNDING_ID}});
    const after = player.megaCredits;
    ctx.game.log('${0} gained ${1} ${2} from ${3}: ${4} city(-ies) on Mars × 2 + ${5} influence × 2 (${6} → ${7})', (b) =>
      b.player(player).number(amount).resource(Resource.MEGACREDITS).resolution(MIGRATION_FUNDING_ID)
        .number(counted.count).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', ...recorded, amount, before, after});
    return undefined;
  },
};

export const MIGRATION_FUNDING: ResolutionDefinition = {
  id: MIGRATION_FUNDING_ID,
  code: MIGRATION_FUNDING_CODE,
  module: 'turmoilRedux',
  party: PartyName.MARS,
  copies: 1,
  // THE FACE, as printed: «2 [M€] / [city] + [influence]» on one row — the
  // counted object is the CITY tile (the physical card's city with the
  // «on Mars» mark: a bare city, no footnote spark — the spark is the space
  // city's), and the influence term shares the rate (the rule text's «per
  // city … + Influence»). No cap line: the card prints none.
  renderData: CardRenderer.builder((b) => {
    b.megacredits(MIGRATION_FUNDING_PER_UNIT).slash().city({size: Size.SMALL}).plus().influence();
  }),
  text: {
    name: 'Migration Funding',
    effect: 'Gain 2 M€ per city you have on Mars, plus 2 per influence. Each city in a stack counts separately.',
    quest: 'Place 2 city tiles on Mars',
  },
  quest: {goal: {kind: 'tile', tile: 'city'}, count: 2},
  scaled: [MIGRATION_FUNDING_MEGACREDITS],
  immediateSteps: [MEGACREDITS_STEP],
};
