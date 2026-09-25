/*
 * MINING INCENTIVES (the Industrialists) — Turmoil Redux resolution RX22, and
 * the SIMPLEST shape the family has: two ordinary production parts, both paid
 * to every participant, neither of them new (docs/TURMOIL_REDUX_MINING_INCENTIVES.md).
 * So this file builds NO mechanism of its own — the flat part is Industrialist
 * Budget's «rate of 0 per influence, a base of 1», the scaled part is Climate
 * Research's «1 step per point of influence», and both pay through the
 * ordinary `production.add`. Nothing is added to a shared module for it.
 *
 * Printed: «Each player increases their titanium production 1 step. Also
 * increase your steel production 1 step for each point of influence you have.»
 * Chairman quest: raise your steel production 1 step (the same sentence
 * Industrialist Budget prints — one key, one translation).
 * A base card: no expansion is needed.
 *
 * THE READINGS FIXED HERE:
 *  · THE PRINTED ORDER IS THE EXECUTED ORDER: titanium first, steel second,
 *    for EVERY participant in turn (voters or not, the party effect or not; a
 *    neutral winner cancels nothing). There is no winner part, no cap («max»
 *    is not printed) and no world step.
 *  · INFLUENCE 0 NEVER SHORT-CIRCUITS THE CARD — the law Climate Research
 *    fixed. The steel part NAMES ITSELF skipped, and the titanium part is
 *    paid all the same: the card's first half does not depend on influence at
 *    all, and reading «influence 0 → nothing» would eat it. The two steps are
 *    independent by construction — neither reads what the other left.
 *  · BOTH PARTS ARE PRODUCTION, never the supply: they go through
 *    `production.add`, so they carry their events, their recorder entries and
 *    the PARTY REACTIONS the engine owns. Whatever the ruling party prints in
 *    answer to a production increase therefore fires through the ordinary
 *    hook, once, under THAT party's own source. Nothing of it is written
 *    here: a second, local grant would be the same rule stated twice and
 *    would pay twice the day the hook changes.
 *  · THE HORIZON: the sitting runs AFTER this generation's production phase
 *    (`Game.postProductionPhase` → `ParliamentPhase.start`), so both steps
 *    first PAY in the NEXT generation. This card moves no supply today, so it
 *    has ONE horizon and nothing to tell it apart from — the shared note
 *    (`PRODUCTION_HORIZON_KEY`, «pays from the next generation») is printed by
 *    `productionHorizonOn` only where a production part stands BESIDE
 *    something paid today (a levy, a supply part). No second formulation is
 *    coined here.
 *  · THE CHAIRMAN QUEST asks for the player's OWN raises in their own action
 *    phase — the steel this card raises never counts toward it (the shared
 *    tracker refuses the political phase and anything under a resolution
 *    source).
 *  · MarsBot takes no seat: never paid, never counted, never asked.
 *
 * THE STEP CONTRACT (IResolution.ts): both steps MUTATE (nothing here asks),
 * and each reports exactly once — the skipped steel included.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {EnactStep, ResolutionDefinition} from '../IResolution';

export const MINING_INCENTIVES_ID: ResolutionId = 'RDX_INDUSTRIALISTS_MINING_INCENTIVES';
export const MINING_INCENTIVES_CODE: ResolutionCode = 'RX22';
/** The printed «increases their titanium production 1 step» — the flat part. */
export const MINING_INCENTIVES_TITANIUM_STEPS = 1;

/** PART ONE, FLAT: +1 titanium production for every participant — a rate of 0 per influence, a base of 1. */
export const MINING_INCENTIVES_TITANIUM: InfluenceScaledEffect = {
  id: 'titaniumProduction',
  unit: {kind: 'production', resource: Resource.TITANIUM},
  base: MINING_INCENTIVES_TITANIUM_STEPS,
  perInfluence: 0,
  recipient: 'each',
};

/** PART TWO: +1 steel production per point of influence, for every participant, no cap. */
export const MINING_INCENTIVES_STEEL: InfluenceScaledEffect = {
  id: 'steelProduction',
  unit: {kind: 'production', resource: Resource.STEEL},
  perInfluence: 1,
  recipient: 'each',
};

const TITANIUM_PRODUCTION_STEP: EnactStep = {
  key: 'titanium-production',
  run(ctx) {
    const player = ctx.player;
    const effect = MINING_INCENTIVES_TITANIUM;
    const influence = ctx.influence;
    // Flat: the ONE formula with a rate of 0 per influence yields the base —
    // the same number at influence 0 as at influence 5.
    const amount = scaledAmount(effect, influence);
    const before = player.production.titanium;
    player.production.add(Resource.TITANIUM, amount, {log: false, from: {resolution: MINING_INCENTIVES_ID}});
    const after = player.production.titanium;
    ctx.game.log('${0} gained ${1} ${2} production from ${3} (${4} → ${5})', (b) =>
      b.player(player).number(amount).resource(Resource.TITANIUM).resolution(MINING_INCENTIVES_ID).number(before).number(after));
    ctx.report({kind: 'production', effect: effect.id, production: Resource.TITANIUM, influence, amount, before, after});
    return undefined;
  },
};

const STEEL_PRODUCTION_STEP: EnactStep = {
  key: 'steel-production',
  run(ctx) {
    const player = ctx.player;
    const effect = MINING_INCENTIVES_STEEL;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    const before = player.production.steel;
    if (amount <= 0) {
      // NAMED and skipped — and the titanium part above was paid all the
      // same: the halves of this card share nothing but the seat.
      ctx.game.log('${0} has no influence — no ${1} production from ${2}', (b) =>
        b.player(player).resource(Resource.STEEL).resolution(MINING_INCENTIVES_ID));
      ctx.report({kind: 'skipped', effect: effect.id, production: Resource.STEEL, amount: 0, influence, before, after: before, reason: 'No influence'});
      return undefined;
    }
    // The standard increase: its events, the recorder and the PARTY REACTIONS
    // all ride it. The ONE journal line below carries the calculation, so the
    // add itself stays quiet.
    player.production.add(Resource.STEEL, amount, {log: false, from: {resolution: MINING_INCENTIVES_ID}});
    const after = player.production.steel;
    ctx.game.log('${0} raised ${1} production by ${2} from ${3}: 1 per point of influence, influence ${4} (${5} → ${6})', (b) =>
      b.player(player).resource(Resource.STEEL).number(amount).resolution(MINING_INCENTIVES_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'production', effect: effect.id, production: Resource.STEEL, amount, influence, before, after});
    return undefined;
  },
};

export const MINING_INCENTIVES: ResolutionDefinition = {
  id: MINING_INCENTIVES_ID,
  code: MINING_INCENTIVES_CODE,
  module: 'turmoilRedux',
  party: PartyName.INDUSTRIALISTS,
  copies: 1,
  // THE FACE, as printed — one row, the rate first and the flat part beside
  // it: «[steel PRODUCTION] / [influence]  [titanium PRODUCTION]». The
  // production frame, never the bare cube: a cube would promise the supply.
  renderData: CardRenderer.builder((b) => {
    b.production((pb) => pb.steel(1)).slash().influence().nbsp.production((pb) => pb.titanium(MINING_INCENTIVES_TITANIUM_STEPS));
  }),
  text: {
    name: 'Mining Incentives',
    effect: 'Raise your titanium production 1 step. Then raise your steel production 1 step per influence.',
    // The SAME key Industrialist Budget prints — one sentence, one
    // translation, one mechanism.
    quest: 'Raise your steel production 1 step',
  },
  quest: {goal: {kind: 'production', resource: Resource.STEEL}, count: 1},
  // THE PRINTED ORDER: the flat titanium first, the scaled steel second.
  scaled: [MINING_INCENTIVES_TITANIUM, MINING_INCENTIVES_STEEL],
  immediateSteps: [TITANIUM_PRODUCTION_STEP, STEEL_PRODUCTION_STEP],
};
