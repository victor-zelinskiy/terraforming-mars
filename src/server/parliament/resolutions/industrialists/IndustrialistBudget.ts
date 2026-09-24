/*
 * INDUSTRIALIST BUDGET (the Industrialists) — Turmoil Redux resolution RX15:
 * the first card of the BUDGET family (six in the catalog: Greens,
 * Industrialist, Mars First, Reds, Scientists and Unity Budget), all of one
 * shape — every participant LOSES a fixed sum, then is paid by their own
 * count and influence, then gets a flat part (docs/TURMOIL_REDUX_INDUSTRIALIST_BUDGET.md).
 * So this file builds no mechanism of its own: the LEVY is the family's
 * shared declaration and step (`resolutionLevy.ts` / `ResolutionLevy.ts`),
 * the count is the fifth kind of the counter family (PRODUCTION steps over a
 * list of resources — the twin of a multi-tag count), and the flat part is the
 * ordinary production payout at a rate of 0 per influence. The next budget
 * declares its sums and its list; it writes no step.
 *
 * Printed: «When enacted: Lose 10 M€. Gain 1 M€ for each step of steel,
 * titanium, and energy production you have + Influence. Also increase your
 * M€ production 4 steps.» Chairman quest: raise your steel production 1 step.
 * A base card: no expansion is needed.
 *
 * THE READINGS FIXED HERE:
 *  · THE PRINTED ORDER IS THE EXECUTED ORDER: levy → payout → production,
 *    for EVERY participant in turn (voters or not, the party effect or not; a
 *    neutral winner cancels nothing). Never reordered so that a seat can
 *    afford the levy: that would change the outcome of the seat that is short.
 *  · THE LEVY CANNOT TAKE THE SEAT BELOW ZERO. A seat with 4 M€ pays 4, and
 *    the record says 4 of 10; a seat with 0 M€ pays nothing (a named skip) —
 *    and both still receive the payout and the production. The card asks no
 *    solvency of anybody.
 *  · THE COUNT IS PRODUCTION STEPS, never the cubes in the supply: steel +
 *    titanium + energy production as the engine keeps it (`player.production`,
 *    never rebuilt from the cards that raised it). The engine never lets these
 *    three go below zero (`Production.add` floors them); the count invents no
 *    floor of its own, and the spec pins that it never needs one.
 *  · INFLUENCE PAYS ON ITS OWN; the terms add; there is no cap («max» is not
 *    printed). The payout is skipped — named — only when count and influence
 *    are both zero.
 *  · +4 M€ PRODUCTION IS FLAT: the same for every participant, influence does
 *    not touch it. It first PAYS in the NEXT generation: the sitting runs
 *    AFTER this generation's production phase (`Game.postProductionPhase` →
 *    `ParliamentPhase.start`), which is also why the levy is taken from a
 *    supply that already holds this generation's income. The count does not
 *    depend on the moment — the production phase moves stocks, not production.
 *  · MarsBot takes no seat: never levied, never paid, never counted.
 *
 * THE STEP CONTRACT (IResolution.ts): all three steps MUTATE (nothing here
 * asks), and each reports exactly once — the levy's shortfall included.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ResolutionLevy} from '../../../../common/parliament/resolutionLevy';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {resolutionCount} from '../ResolutionCounts';
import {levyStep} from '../ResolutionLevy';

export const INDUSTRIALIST_BUDGET_ID: ResolutionId = 'RDX_INDUSTRIALISTS_INDUSTRIALIST_BUDGET';
export const INDUSTRIALIST_BUDGET_CODE: ResolutionCode = 'RX15';
/** The printed «Lose 10 M€». */
export const INDUSTRIALIST_BUDGET_LEVY_AMOUNT = 10;
/** The printed «increase your M€ production 4 steps» — the flat part. */
export const INDUSTRIALIST_BUDGET_PRODUCTION_STEPS = 4;

/** THE LEVY, as data: 10 M€ from every participant, first. */
export const INDUSTRIALIST_BUDGET_LEVY: ResolutionLevy = {resource: Resource.MEGACREDITS, amount: INDUSTRIALIST_BUDGET_LEVY_AMOUNT, recipient: 'each'};

/** THE FORMULA: 1 M€ per step of steel + titanium + energy production, plus 1 per influence, no cap, for every participant. */
export const INDUSTRIALIST_BUDGET_MEGACREDITS: InfluenceScaledEffect = {
  id: 'megacredits',
  unit: {kind: 'stock', resource: Resource.MEGACREDITS},
  perInfluence: 1,
  count: {id: 'steelTitaniumEnergyProduction', per: 1},
  recipient: 'each',
};

/** THE FLAT PART: +4 M€ production for every participant — a rate of 0 per influence, a base of 4. */
export const INDUSTRIALIST_BUDGET_PRODUCTION: InfluenceScaledEffect = {
  id: 'production',
  unit: {kind: 'production', resource: Resource.MEGACREDITS},
  base: INDUSTRIALIST_BUDGET_PRODUCTION_STEPS,
  perInfluence: 0,
  recipient: 'each',
};

const MEGACREDITS_STEP: EnactStep = {
  key: 'megacredits',
  run(ctx) {
    const player = ctx.player;
    const effect = INDUSTRIALIST_BUDGET_MEGACREDITS;
    // The engine's production track, resource by resource, added up by the
    // family's shared reader — with the BREAKDOWN that explains it.
    const counted = resolutionCount(player, 'steelTitaniumEnergyProduction');
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence, counted.count);
    const recorded = {
      effect: effect.id,
      stock: Resource.MEGACREDITS,
      influence,
      count: counted.count,
      counted: [...counted.cards],
      ...(counted.byResource === undefined ? {} : {countedByResource: counted.byResource.map((entry) => ({...entry}))}),
    };
    if (amount <= 0) {
      ctx.game.log('${0} has no steel, titanium or energy production and no influence — no M€ from ${1}', (b) =>
        b.player(player).resolution(INDUSTRIALIST_BUDGET_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: 'No steel, titanium or energy production and no influence'});
      return undefined;
    }
    const before = player.megaCredits;
    // The standard gain under this resolution's source (its events, the party
    // reactions, the recorder); the ONE journal line below carries the whole
    // calculation, so the add itself stays silent.
    player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: INDUSTRIALIST_BUDGET_ID}});
    const after = player.megaCredits;
    ctx.game.log('${0} gained ${1} M€ from ${2}: ${3} step(s) of steel, titanium and energy production + ${4} influence (${5} → ${6})', (b) =>
      b.player(player).number(amount).resolution(INDUSTRIALIST_BUDGET_ID)
        .number(counted.count).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', ...recorded, amount, before, after});
    return undefined;
  },
};

const PRODUCTION_STEP: EnactStep = {
  key: 'production',
  run(ctx) {
    const player = ctx.player;
    const effect = INDUSTRIALIST_BUDGET_PRODUCTION;
    const influence = ctx.influence;
    // Flat: the ONE formula with a rate of 0 per influence yields the base.
    const amount = scaledAmount(effect, influence);
    const before = player.production.megacredits;
    player.production.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: INDUSTRIALIST_BUDGET_ID}});
    const after = player.production.megacredits;
    ctx.game.log('${0} gained ${1} ${2} production from ${3} (${4} → ${5})', (b) =>
      b.player(player).number(amount).resource(Resource.MEGACREDITS).resolution(INDUSTRIALIST_BUDGET_ID).number(before).number(after));
    ctx.report({kind: 'production', effect: effect.id, production: Resource.MEGACREDITS, influence, amount, before, after});
    return undefined;
  },
};

export const INDUSTRIALIST_BUDGET: ResolutionDefinition = {
  id: INDUSTRIALIST_BUDGET_ID,
  code: INDUSTRIALIST_BUDGET_CODE,
  module: 'turmoilRedux',
  party: PartyName.INDUSTRIALISTS,
  copies: 1,
  // THE FACE, as printed: the two flat sums on one row — «−10 [M€]» (the
  // negative printed INSIDE the tile, as on the card) and «[4 M€ production]»
  // — then the rate: «1 [M€] / [steel + titanium + energy production] +
  // [influence]». The counted object is the PRODUCTION BOX holding the three
  // resources joined by «+»: a card would state a different rule, and bare
  // cubes would count the supply.
  renderData: CardRenderer.builder((b) => {
    b.megacredits(-INDUSTRIALIST_BUDGET_LEVY_AMOUNT).nbsp.production((pb) => pb.megacredits(INDUSTRIALIST_BUDGET_PRODUCTION_STEPS)).br;
    b.megacredits(1).slash().production((pb) => pb.steel(1).plus().titanium(1).plus().energy(1)).plus().influence();
  }),
  text: {
    name: 'Industrialist Budget',
    effect: 'Lose 10 M€. Then gain 1 M€ per step of steel, titanium and energy production you have, plus 1 per influence. Then raise your M€ production 4 steps.',
    quest: 'Raise your steel production 1 step',
  },
  quest: {goal: {kind: 'production', resource: Resource.STEEL}, count: 1},
  levy: INDUSTRIALIST_BUDGET_LEVY,
  scaled: [INDUSTRIALIST_BUDGET_MEGACREDITS, INDUSTRIALIST_BUDGET_PRODUCTION],
  // THE PRINTED ORDER: the levy first, the payout second, the flat part last.
  immediateSteps: [levyStep(INDUSTRIALIST_BUDGET_ID, INDUSTRIALIST_BUDGET_LEVY), MEGACREDITS_STEP, PRODUCTION_STEP],
};
