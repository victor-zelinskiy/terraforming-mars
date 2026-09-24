/*
 * CLIMATE RESEARCH (the Greens) — Turmoil Redux resolution RX05, and the FIRST
 * card whose two halves are SEQUENTIAL: the second reads what the first left
 * behind (docs/TURMOIL_REDUX_CLIMATE_RESEARCH.md).
 *
 * Printed: «When enacted: Increase your heat production 1 step per point of
 * Influence. Then draw 1 card for every 3 steps of heat production you have.»
 * Chairman quest: raise your heat production 3 steps.
 *
 * THE READINGS FIXED HERE:
 *  · Part one pays EVERY participant their OWN influence in heat production
 *    steps — voters or not, with the Greens' effect or not; there is NO cap
 *    («max 5» is Architecture Award's / Central Power Grid's rule, not the
 *    family's) and NO winner-only part, so a neutral winner cancels nothing.
 *  · Part two counts the player's WHOLE heat production AFTER the raise —
 *    not the steps just gained, not the thresholds just crossed, not the heat
 *    RESOURCES in the supply. Floor division: the remainder yields nothing
 *    (production 8 draws 2). Neither the production nor the influence is
 *    spent, and the draw is free — no 3 M€, no draft, no forced discard.
 *  · INFLUENCE 0 NEVER SHORT-CIRCUITS THE CARD. With no influence the first
 *    part is named and skipped, and the second STILL runs: heat production 6
 *    draws 2 cards on its own. Reading «influence 0 → nothing» would lose the
 *    half of the card that does not depend on influence at all.
 *  · I = the player's influence through the Redux ledger (`ctx.influence`,
 *    read AFTER the winner's Agenda step of the phase — rulebook p.10); it is
 *    never added a second time to an already-raised production.
 *  · The raise goes through `production.add`, so it is a PRODUCTION increase
 *    with its events, its recorder entry and the PARTY REACTIONS the engine
 *    owns. The Greens rule the moment this card is enacted, and their printed
 *    effect («when your plant or heat production increases, your M€ production
 *    increases by as many steps») therefore pays every recipient — through the
 *    ordinary hook, ONCE, under the GREENS' own source. Nothing of that
 *    reaction is written here: a second, local M€ grant would be the same rule
 *    stated twice and would pay twice the day the hook changes.
 *  · The TOTAL the draw divides is RE-READ from the player after the raise —
 *    never «before + influence». A modifier that swallows or adds a step must
 *    change the number of cards, and only the real production can say so.
 *  · The cards come from the PROJECT DECK through the shared external-draw
 *    intake (`ExternalDrawIntake`): they leave the deck at the enactment (deck
 *    order can never depend on when anybody answers), they are WITHHELD from
 *    the hand until the player takes them through the mandatory prompt, and
 *    the prompt is a projection of serialized state — so a reload inside the
 *    take loses nothing and draws nothing twice. The political phase owns the
 *    wait: the step keeps the prompt instead of deferring it.
 *  · ONCE, at the enactment: the driver's per-seat idempotency keys make a
 *    reload or a repeated handler call pay nothing twice; a later production
 *    change never re-divides an amount already fixed; a LATER enactment of the
 *    card is a new generation's keys — a fresh calculation by the table as it
 *    stands then.
 *  · The chairman quest asks for the player's OWN raises in their own action
 *    phase — THIS card's raise never counts toward it (the shared tracker
 *    refuses the political phase and anything under a resolution source), and
 *    neither does the Greens' M€ production reaction (wrong resource, and the
 *    same root).
 *
 * THE STEP CONTRACT (IResolution.ts): a step MUTATES or ASKS. The production
 * step mutates and records the total it leaves behind in `ctx.state`; the draw
 * step is the one documented exception the intake makes safe — it takes the
 * cards off the deck and asks in the same breath, and re-entry (a reload) is
 * idempotent because the intake it remembers IS game state.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount, sequelAmount} from '../../../../common/parliament/influenceScaling';
import {ExternalDrawIntake} from '../../../deferredActions/ExternalDrawIntake';
import {EnactStep, ResolutionDefinition} from '../IResolution';

export const CLIMATE_RESEARCH_ID: ResolutionId = 'RDX_GREENS_CLIMATE_RESEARCH';
export const CLIMATE_RESEARCH_CODE: ResolutionCode = 'RX05';
/** The printed «for every 3 steps of heat production» — the divisor of part two. */
export const CLIMATE_RESEARCH_HEAT_PER_CARD = 3;

/** PART ONE: +1 heat production per point of influence, for every participant, no cap. */
export const CLIMATE_RESEARCH_HEAT: InfluenceScaledEffect = {
  id: 'heatProduction',
  unit: {kind: 'production', resource: Resource.HEAT},
  perInfluence: 1,
  recipient: 'each',
};

/** PART TWO: 1 card per full 3 steps of the heat production PART ONE just left behind. */
export const CLIMATE_RESEARCH_DRAW: InfluenceScaledEffect = {
  id: 'draw',
  unit: {kind: 'cards'},
  // Influence does not enter twice: it is already inside the total below.
  perInfluence: 0,
  sequel: {
    after: CLIMATE_RESEARCH_HEAT.id,
    total: {kind: 'production', resource: Resource.HEAT},
    per: CLIMATE_RESEARCH_HEAT_PER_CARD,
  },
  recipient: 'each',
};

/** The state key part one leaves the resulting heat production under (see the contract above). */
const HEAT_AFTER_KEY = 'heatProductionAfter';
/** …and the heat production it started from (the reading «4 → 6» keeps both). */
const HEAT_BEFORE_KEY = 'heatProductionBefore';
/** The intake the draw step opened — the proof it already drew (game state carries the cards). */
const INTAKE_KEY = 'drawIntake';

/** The resulting heat production part one recorded, else the player's live one. */
function heatAfter(state: Record<string, unknown>, live: number): number {
  const remembered = state[HEAT_AFTER_KEY];
  return typeof remembered === 'number' ? remembered : live;
}

const HEAT_PRODUCTION_STEP: EnactStep = {
  key: 'heat-production',
  run(ctx) {
    const player = ctx.player;
    const effect = CLIMATE_RESEARCH_HEAT;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    const before = player.production.heat;
    ctx.state[HEAT_BEFORE_KEY] = before;
    if (amount <= 0) {
      // NAMED and skipped — and the card goes on: part two does not depend on
      // influence, and an early return here would silently eat it.
      ctx.game.log('${0} has no influence — no ${1} production from ${2}', (b) =>
        b.player(player).resource(Resource.HEAT).resolution(CLIMATE_RESEARCH_ID));
      ctx.state[HEAT_AFTER_KEY] = before;
      ctx.report({kind: 'skipped', effect: effect.id, production: Resource.HEAT, amount: 0, influence, before, after: before, reason: 'No influence'});
      return undefined;
    }
    // The standard increase: its events, the recorder and the PARTY REACTIONS
    // (the ruling Greens' M€ production, under their own source) all ride it.
    // The ONE journal line below carries the calculation, so the add is quiet.
    player.production.add(Resource.HEAT, amount, {log: false, from: {resolution: CLIMATE_RESEARCH_ID}});
    // RE-READ, never `before + amount`: a modifier that changed the real step
    // must change the cards part two draws.
    const after = player.production.heat;
    ctx.game.log('${0} raised ${1} production by ${2} from ${3}: 1 per point of influence, influence ${4} (${5} → ${6})', (b) =>
      b.player(player).resource(Resource.HEAT).number(amount).resolution(CLIMATE_RESEARCH_ID).number(influence).number(before).number(after));
    ctx.state[HEAT_AFTER_KEY] = after;
    ctx.report({kind: 'production', effect: effect.id, production: Resource.HEAT, amount, influence, before, after});
    return undefined;
  },
};

const DRAW_STEP: EnactStep = {
  key: 'draw',
  run(ctx) {
    const player = ctx.player;
    const effect = CLIMATE_RESEARCH_DRAW;
    // RE-ENTRY (a reload inside the take): the cards already left the deck and
    // sit in the intake — game state. Nothing is drawn again; the mandatory
    // prompt is re-derived from the intake (and the phase's own deferred gate
    // has usually drained it before this step is reached at all).
    const remembered = ctx.state[INTAKE_KEY];
    if (typeof remembered === 'number') {
      const pending = ExternalDrawIntake.pendingOf(player, remembered);
      return pending === undefined ? undefined : ExternalDrawIntake.takePromptFor(player, pending);
    }
    const before = typeof ctx.state[HEAT_BEFORE_KEY] === 'number' ? ctx.state[HEAT_BEFORE_KEY] as number : player.production.heat;
    const after = heatAfter(ctx.state, player.production.heat);
    const owed = sequelAmount(effect, after);
    const total = {before, after};
    if (owed <= 0) {
      // No empty intake and no empty prompt — and the reason is stated, with
      // the production it was read from.
      ctx.game.log('${0} has ${1} ${2} production — fewer than ${3}, so ${4} draws no cards', (b) =>
        b.player(player).number(after).resource(Resource.HEAT).number(CLIMATE_RESEARCH_HEAT_PER_CARD).resolution(CLIMATE_RESEARCH_ID));
      ctx.report({kind: 'skipped', effect: effect.id, amount: 0, influence: ctx.influence, total, reason: 'Heat production below 3 — no cards'});
      return undefined;
    }
    // THE SHARED INTAKE: the project deck (never the resolution deck), the
    // standard exhaustion behaviour (the discard is reshuffled by `drawN`), the
    // cards withheld from the hand until taken, the prompt re-derivable. The
    // political phase keeps the prompt, so the driver cannot move on while the
    // take is owed.
    const intake = ExternalDrawIntake.open(player, owed, {kind: 'resolution', resolution: CLIMATE_RESEARCH_ID, effect: effect.id});
    if (intake === undefined) {
      // The deck (and its discard) had nothing left — named, never silent.
      ctx.report({kind: 'skipped', effect: effect.id, amount: owed, drawn: 0, influence: ctx.influence, total, reason: 'The project deck is empty'});
      return undefined;
    }
    ctx.state[INTAKE_KEY] = intake.id;
    ctx.game.log('${0} draws ${1} card(s) from ${2}: 1 per full ${3} steps of ${4} production (${5})', (b) =>
      b.player(player).number(intake.count).resolution(CLIMATE_RESEARCH_ID)
        .number(CLIMATE_RESEARCH_HEAT_PER_CARD).resource(Resource.HEAT).number(after));
    if (intake.count < owed) {
      ctx.game.log('Only ${0} of ${1} card(s) were left in the deck for ${2}', (b) =>
        b.number(intake.count).number(owed).player(player));
    }
    ctx.report({kind: 'cards', effect: effect.id, amount: owed, drawn: intake.count, intake: intake.id, influence: ctx.influence, total});
    return ExternalDrawIntake.takePromptFor(player, intake);
  },
};

export const CLIMATE_RESEARCH: ResolutionDefinition = {
  id: CLIMATE_RESEARCH_ID,
  code: CLIMATE_RESEARCH_CODE,
  module: 'turmoilRedux',
  party: PartyName.GREENS,
  copies: 1,
  // THE FACE, two rows for two SEQUENTIAL readings (the printed card's own
  // composition): «[heat PRODUCTION] / [influence]» — the production frame,
  // never the bare heat cube — then «[project card] / [3 heat PRODUCTION]».
  // The second row is not a cost: the slash reads «per», and production is
  // never spent here.
  renderData: CardRenderer.builder((b) => {
    b.production((pb) => pb.heat(1)).slash().influence().br;
    b.cards(1).slash().production((pb) => pb.heat(CLIMATE_RESEARCH_HEAT_PER_CARD));
  }),
  text: {
    name: 'Climate Research',
    effect: 'Raise your heat production 1 step per influence. Then draw 1 card per 3 steps of heat production you have.',
    // The SAME key the printed generation-1 quest uses (`STARTER_QUEST_TEXT`) —
    // one sentence, one translation, one mechanism.
    quest: 'Raise your heat production 3 steps',
  },
  quest: {goal: {kind: 'production', resource: Resource.HEAT}, count: 3},
  scaled: [CLIMATE_RESEARCH_HEAT, CLIMATE_RESEARCH_DRAW],
  immediateSteps: [HEAT_PRODUCTION_STEP, DRAW_STEP],
};
