/*
 * GAS EXPORT (the Reds) — Turmoil Redux resolution RX12: the first card of the
 * Reds, and the first whose enactment CHANGES THE WORLD instead of paying the
 * table — it vents the atmosphere and terraforms Venus, and nobody is credited
 * for either (docs/TURMOIL_REDUX_GAS_EXPORT.md).
 *
 * Printed: «When enacted: Gain 2 M€ per point of Influence you have. If oxygen
 * is not at maximum, reduce it by 1 step. Terraform Venus 2 steps. (No one gets
 * the TR for this.)» Chairman quest: play 2 Venus tags. Venus Next marker on
 * the edge.
 *
 * THE READINGS FIXED HERE:
 *  · M€: 2 × the player's influence for EVERY participant — voters or not,
 *    with the party effect or not — read after the winner's Agenda step, the
 *    family's ordinary supply payout. Influence 0 → nothing, NAMED.
 *  · THE WORLD'S PART IS NOT A REWARD and not a seat's: oxygen and Venus move
 *    ONCE per enactment, whoever won and even when the NEUTRAL player did
 *    («when enacted», not «the winner»). It runs as `worldSteps` — after every
 *    seat's M€ (the card's own order, which the journal keeps) and before any
 *    winner part — and its records carry no player at all.
 *  · OXYGEN: −1 step unless it is at its MAXIMUM, where the card says so
 *    itself. At its MINIMUM it cannot go lower and the skip is named too. The
 *    engine's own negative branch would silently do nothing in both cases —
 *    the step never leans on that silence (no silent loss).
 *  · VENUS: +2 steps (2 % apiece), CUT by the ceiling — from 28 % one step
 *    happens, at 30 % none, and the record carries the steps actually made.
 *  · NOBODY GETS THE TERRAFORM RATING, and the reading of that is PARITY WITH
 *    THE WORLD GOVERNMENT (`ParameterMoveOptions.unrewarded`): no TR for any
 *    player, no Venus track bonus (the 8 % card, the 16 % rating, the alt-track
 *    resources), and a threshold the raise crosses is claimed NEUTRALLY. What
 *    the World Government still pays, this still pays — Aphrodite's 2 M€ per
 *    step is the corporation's own printed rule, not a bonus of the track, and
 *    it stands. The political phase is `Phase.PARLIAMENT`, so without the
 *    explicit flag the rating would go to whichever player the engine was
 *    handed; a LOWERING never paid anybody to begin with.
 *  · THE 8 % TEMPERATURE BONUS of oxygen is not «un-earned» by the lowering:
 *    the engine claims each threshold once (`scaleBonusClaims`), and a LATER
 *    raise back through 8 % sets the temperature off again — exactly what the
 *    Reds' own agenda action has always done. The card follows the engine and
 *    keeps no register of its own.
 *  · MARSBOT participates like a seat for the M€ it never gets (it has no
 *    influence to pay for) and shares the planet like everybody: the world
 *    part is not asked of it and not attributed to it.
 *  · END OF GAME: the lowering can never «un-terraform» a finished planet —
 *    at its maximum oxygen is not touched at all. With the Venus end-game
 *    variant on, the raise can be what completes the planet; `isTerraformed`
 *    is read by the engine exactly as for any other step.
 *  · Without Venus Next the card is nowhere (`compatibility: ['venus']` — the
 *    deal's filter), like Cloud Development.
 *
 * THE STEP CONTRACT (IResolution.ts): all three steps MUTATE (nothing here
 * asks), and each reports exactly once — including the branch where the
 * parameter is at its limit.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {WorldParameterMove, parameterRoom} from '../../../../common/parliament/parameterMove';
import {EnactContext, EnactStep, ResolutionDefinition} from '../IResolution';

export const GAS_EXPORT_ID: ResolutionId = 'RDX_REDS_GAS_EXPORT';
export const GAS_EXPORT_CODE: ResolutionCode = 'RX12';

/** THE FORMULA: 2 M€ per point of influence, for every participant — no count, no cap. */
export const GAS_EXPORT_MEGACREDITS: InfluenceScaledEffect = {
  id: 'megacredits',
  unit: {kind: 'stock', resource: Resource.MEGACREDITS},
  perInfluence: 2,
  recipient: 'each',
};

/** THE WORLD'S PART, as data: oxygen down one step, Venus up two — and nobody is credited for either. */
export const GAS_EXPORT_OXYGEN: WorldParameterMove = {parameter: 'oxygen', steps: -1, terraformRating: false};
export const GAS_EXPORT_VENUS: WorldParameterMove = {parameter: 'venus', steps: 2, terraformRating: false};

/** The table as the engine has it right now — the ONE reader for the steps below. */
function tableOf(ctx: EnactContext) {
  return {
    oxygenLevel: ctx.game.getOxygenLevel(),
    temperature: ctx.game.getTemperature(),
    oceans: ctx.game.board.getOceanSpaces().length,
    venusScaleLevel: ctx.game.getVenusScaleLevel(),
  };
}

const MEGACREDITS_STEP: EnactStep = {
  key: 'megacredits',
  run(ctx) {
    const player = ctx.player;
    const effect = GAS_EXPORT_MEGACREDITS;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    if (amount <= 0) {
      ctx.game.log('${0} has no influence — no M€ from ${1}', (b) => b.player(player).resolution(GAS_EXPORT_ID));
      ctx.report({kind: 'skipped', effect: effect.id, stock: Resource.MEGACREDITS, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    const before = player.megaCredits;
    player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: GAS_EXPORT_ID}});
    const after = player.megaCredits;
    ctx.game.log('${0} gained ${1} M€ from ${2}: 2 per point of influence, influence ${3} (${4} → ${5})', (b) =>
      b.player(player).number(amount).resolution(GAS_EXPORT_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', effect: effect.id, stock: Resource.MEGACREDITS, amount, influence, before, after});
    return undefined;
  },
};

/**
 * OXYGEN −1, once, for the table. The step reads the ROOM first (the shared
 * `parameterRoom`, the same arithmetic the vote panel printed) so a move that
 * cannot happen is NAMED — never left to the engine's silent early return.
 */
const OXYGEN_STEP: EnactStep = {
  key: 'oxygen',
  run(ctx) {
    const move = GAS_EXPORT_OXYGEN;
    const room = parameterRoom(move, tableOf(ctx));
    // THE CARD'S OWN CLAUSE FIRST — «if oxygen is not at maximum»: a maxed
    // oxygen is a rule of this resolution, not an arithmetic limit (there is
    // plenty of room BELOW it). The floor is the arithmetic one, and both are
    // NAMED: the engine's own negative branch would do nothing in either case,
    // and leaning on that silence is exactly the defect this guards against.
    const atMaximum = room.current >= room.max;
    if (atMaximum || !room.moves) {
      const reason = atMaximum ? 'Oxygen is at its maximum — it is not reduced' : 'Oxygen is already at its minimum';
      if (atMaximum) {
        ctx.game.log('Oxygen is at its maximum — ${0} does not reduce it', (b) => b.resolution(GAS_EXPORT_ID));
      } else {
        ctx.game.log('Oxygen is already at its minimum — ${0} cannot reduce it', (b) => b.resolution(GAS_EXPORT_ID));
      }
      ctx.report({kind: 'skipped', amount: 0, parameter: {id: 'oxygen', before: room.current, after: room.current}, unrewarded: true, reason});
      return undefined;
    }
    // The HANDLE is the engine's argument, not the author: the scope carries
    // the resolution with no owner, so the change is recorded without a player.
    ctx.game.increaseOxygenLevel(ctx.player, -1, {unrewarded: true});
    const after = ctx.game.getOxygenLevel();
    ctx.game.log('${0} reduced the oxygen level 1 step (${1}% → ${2}%)', (b) =>
      b.resolution(GAS_EXPORT_ID).number(room.current).number(after));
    ctx.report({kind: 'globalParameter', amount: room.applied, parameter: {id: 'oxygen', before: room.current, after}, unrewarded: true});
    return undefined;
  },
};

/** VENUS +2, once, for the table — and no terraform rating for anybody (`unrewarded`, WGT parity). */
const VENUS_STEP: EnactStep = {
  key: 'venus',
  run(ctx) {
    const move = GAS_EXPORT_VENUS;
    const room = parameterRoom(move, tableOf(ctx));
    if (!room.moves) {
      ctx.game.log('Venus is at its maximum — ${0} does not terraform it', (b) => b.resolution(GAS_EXPORT_ID));
      ctx.report({
        kind: 'skipped', amount: 0, parameter: {id: 'venus', before: room.current, after: room.current},
        unrewarded: true, reason: 'Venus is at its maximum — it is not terraformed',
      });
      return undefined;
    }
    const steps = ctx.game.increaseVenusScaleLevel(ctx.player, room.applied === 1 ? 1 : 2, {unrewarded: true});
    const after = ctx.game.getVenusScaleLevel();
    ctx.game.log('${0} terraformed Venus ${1} step(s) (${2}% → ${3}%) — no one gets the terraform rating', (b) =>
      b.resolution(GAS_EXPORT_ID).number(steps).number(room.current).number(after));
    ctx.report({kind: 'globalParameter', amount: steps, parameter: {id: 'venus', before: room.current, after}, unrewarded: true});
    return undefined;
  },
};

export const GAS_EXPORT: ResolutionDefinition = {
  id: GAS_EXPORT_ID,
  code: GAS_EXPORT_CODE,
  module: 'turmoilRedux',
  party: PartyName.REDS,
  copies: 1,
  compatibility: ['venus'],
  // THE FACE, as printed: the per-influence formula on its own row, the world's
  // two moves on the next — «− [oxygen]» and the Venus scale twice. The «no TR»
  // clause is the RULE's sentence (there is no glyph for «nobody is credited»),
  // so the row ends with the asterisk that points at it.
  renderData: CardRenderer.builder((b) => {
    b.megacredits(2).slash().influence().br;
    b.minus().oxygen(1).nbsp.venus(2).asterix();
  }),
  text: {
    name: 'Gas Export',
    effect: 'Gain 2 M€ for every point of your influence.',
    world: 'Oxygen is reduced 1 step unless it is already at its maximum, and Venus is terraformed 2 steps. No one gets the terraform rating for this.',
    quest: 'Play 2 Venus tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.VENUS}, count: 2},
  scaled: [GAS_EXPORT_MEGACREDITS],
  worldMoves: [GAS_EXPORT_OXYGEN, GAS_EXPORT_VENUS],
  immediateSteps: [MEGACREDITS_STEP],
  worldSteps: [OXYGEN_STEP, VENUS_STEP],
};
