/*
 * MOHOLE CONTEST (the Greens) — Turmoil Redux resolution RX23: the family's
 * ordinary supply payout by influence, and the FIRST winner part that is a
 * DIRECT STEP of a global parameter with no tile at all — the third kind of
 * `winnerReward` (docs/TURMOIL_REDUX_MOHOLE_CONTEST.md).
 *
 * Printed: «When enacted: Gain 3 heat per point of Influence you have. The
 * player that won this resolution increases the global temperature 2 steps.»
 * Chairman quest: play a card with a microbe tag.
 *
 * THE READINGS FIXED HERE:
 *  · HEAT: 3 × the player's influence for EVERY participant — voters or not,
 *    with the party effect or not — read through the Redux ledger AFTER the
 *    winner's Agenda step; ordinary heat into the supply, no cap. Influence 0
 *    → nothing, NAMED. The winner gets its own heat once, like everyone.
 *  · THE WINNER'S STEP IS REWARDED — the trap of this card. Gas Export and
 *    Heat Capture move the world for NOBODY and pass `unrewarded: true`; here
 *    the WINNER makes the step, as a card of theirs would, and gets everything
 *    a raising player gets: +2 TR (one per step actually made), the heat
 *    production of the −24 / −20 °C thresholds it crosses, its own card hooks,
 *    and — outside every reward gate — the 0 °C ocean, which it PLACES as a
 *    standard placement of its own that the phase waits out. The step is the
 *    family's shared executor (`winnerParameterStep`), derived from the
 *    declaration; nothing here names `unrewarded`.
 *  · THE CEILING IS NAMED: one step from +8 °C makes one step and the record
 *    carries it; at +8 °C the winner's part is a named skip — and the heat
 *    still reaches everyone (the two parts share nothing but the card).
 *  · THE WINNER'S PART DOES NOT DEPEND ON ITS INFLUENCE: influence 0 skips
 *    the heat, never the step.
 *  · A NEUTRAL winner raises nothing (`winnerSteps` never run for one); the
 *    heat still reaches every participant.
 *  · ONCE PER ENACTMENT: the driver's idempotency keys — a reload, a repeated
 *    answer or a model refresh pays nothing twice.
 *
 * THE STEP CONTRACT (IResolution.ts): both steps MUTATE (nothing here asks —
 * the 0 °C ocean is the engine's own deferred question), each reports once.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {WinnerParameterReward} from '../../../../common/parliament/winnerReward';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {winnerParameterStep} from '../WinnerParameterStep';

export const MOHOLE_CONTEST_ID: ResolutionId = 'RDX_GREENS_MOHOLE_CONTEST';
export const MOHOLE_CONTEST_CODE: ResolutionCode = 'RX23';

/** THE FORMULA: 3 heat per point of influence, for every participant — no cap. */
export const MOHOLE_CONTEST_HEAT: InfluenceScaledEffect = {
  id: 'heat',
  unit: {kind: 'stock', resource: Resource.HEAT},
  perInfluence: 3,
  recipient: 'each',
};

/** THE WINNER'S PART, as data: the temperature up two steps — the winner's own, rewarded step. */
export const MOHOLE_CONTEST_TEMPERATURE: WinnerParameterReward = {kind: 'parameter', parameter: 'temperature', steps: 2};

const HEAT_STEP: EnactStep = {
  key: 'heat',
  run(ctx) {
    const player = ctx.player;
    const effect = MOHOLE_CONTEST_HEAT;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    if (amount <= 0) {
      ctx.game.log('${0} has no influence — no heat from ${1}', (b) => b.player(player).resolution(MOHOLE_CONTEST_ID));
      ctx.report({kind: 'skipped', effect: effect.id, stock: Resource.HEAT, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    const before = player.heat;
    // The standard gain: its event carries this resolution as the source (the
    // journal chip, the notification's «why», the recorder). The ONE journal
    // line below carries the whole calculation, so the add itself stays silent.
    player.stock.add(Resource.HEAT, amount, {log: false, from: {resolution: MOHOLE_CONTEST_ID}});
    const after = player.heat;
    ctx.game.log('${0} gained ${1} ${2} from ${3}: 3 per point of influence, influence ${4} (${5} → ${6})', (b) =>
      b.player(player).number(amount).resource(Resource.HEAT).resolution(MOHOLE_CONTEST_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', effect: effect.id, stock: Resource.HEAT, amount, influence, before, after});
    return undefined;
  },
};

export const MOHOLE_CONTEST: ResolutionDefinition = {
  id: MOHOLE_CONTEST_ID,
  code: MOHOLE_CONTEST_CODE,
  module: 'turmoilRedux',
  party: PartyName.GREENS,
  copies: 1,
  // THE FACE, as printed: the per-influence formula on its own row (3 heat /
  // influence — the RESOURCE), the winner's two temperature steps on the next
  // with the winner star.
  renderData: CardRenderer.builder((b) => {
    b.heat(3).slash().influence().br;
    b.temperature(2).voteWinner();
  }),
  text: {
    name: 'Mohole Contest',
    effect: 'Gain 3 heat for every point of your influence.',
    winner: 'Raise the temperature 2 steps.',
    quest: 'Play a card with a microbe tag',
  },
  quest: {goal: {kind: 'tag', tag: Tag.MICROBE}, count: 1},
  scaled: [MOHOLE_CONTEST_HEAT],
  winnerReward: MOHOLE_CONTEST_TEMPERATURE,
  immediateSteps: [HEAT_STEP],
  winnerSteps: [winnerParameterStep(MOHOLE_CONTEST_ID, MOHOLE_CONTEST_TEMPERATURE)],
};
