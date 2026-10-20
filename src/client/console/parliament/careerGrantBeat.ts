/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «КАРЬЕРА» OF THE SITTING — the steps of the Career a LAW grants the seats
 * (Turmoil Redux: Reds Budget RX39, «each player advances their Agenda marker
 * 1 step»; docs/TURMOIL_REDUX_REDS_BUDGET.md), as the reward stage plays them:
 * every seat's marker walks its own step ON THE TRACK, IN TURN, in the seat
 * order — the viewer's, every other seat's, the bot's — each walk the ONE
 * phrase of the track (TR04's `agendaWalkDirector`), each step's bonus landing
 * on its own landing.
 *
 * THE WALKS ARE READ FROM THE PHASE'S RECORDS, NEVER FROM `lastAdvance`. The
 * server keeps ONE last walk per game, and a law walks several seats in one
 * response: by the time the view arrives `lastAdvance` is the LAST seat's walk
 * and the others are gone for any presentation. Each seat's own record
 * (`kind: 'agenda'`, its `walk {from, to, steps}`) is what plays here — in the
 * records' order, which IS the seat order — and the card-walk detector
 * (`agendaWalk.detectAgendaWalk`) never plays the cause `resolution` (it plays
 * `card` alone), so no marker can walk twice.
 *
 * THE BEAT IS SPLIT like every reward beat of this console (DETECT → SEED →
 * OWE → PLAY):
 *   DETECT — pure, against the authoritative response: the `agenda` records
 *            this response ADDED to the live phase (same generation), any seat;
 *   SEED   — in the SAME synchronous block as the view apply
 *            (`parliamentRewardBeat.seedParliamentRewardHold`): every walked
 *            seat's marker is HELD on its old step (`agendaGrantAwaits`), and
 *            the viewer's own paying steps are OWED to the ledger (a TR step's
 *            rating held on the rail, a card step's reveal parked) — the bonus
 *            queue entries are returned to the caller, who queues them;
 *   OWE    — the walks wait here for the sitting director's КАРЬЕРА beat
 *            (`sittingDirector.beatCareer`), after the seat's own wave;
 *   PLAY   — the director takes them one by one: the impulse off the law's
 *            printed insignia, the hold handed to the tier's walk, the bonus.
 *
 * Honest like the ledger: a walk is owed only when the sitting's stage stands
 * at the seed (a parked sitting gets nothing — the markers simply stand on
 * their new steps), reduced motion owes nothing, a beat that cannot play
 * releases every hold at once (the poses are final). Pure + a reactive
 * record: no DOM, no Vue components, no i18n, no timers.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel, ParliamentPhaseModel} from '@/common/models/ParliamentModel';
import {AgendaAdvanceStep} from '@/common/parliament/ParliamentTypes';
import {RATING_RAIL_KEY} from '@/client/console/resourceTransfer/resourceTransferModel';
import {parliamentHolds} from './parliamentDisplayHolds';
import type {AgendaBonusOwed} from './parliamentRewardBeat';

/** ONE seat's walk the sitting still owes the track. */
export type CareerWalkOwed = {
  /** The record's structural identity (seat · step · part · kind). */
  key: string;
  player: Color;
  from: number;
  to: number;
  steps: ReadonlyArray<AgendaAdvanceStep>;
  generation: number;
  /** The walk is the viewer's own — its bonus lands on the viewer's rail / dock. */
  viewer: boolean;
  /** What a seat with no hand took instead of a card step (MarsBot: 1 M€ each) — the band names it. */
  megacredits?: number;
};

/** What the beat is doing — read by the band (whose step the line names) and the e2e probes. */
export type CareerWalkPhase = 'impulse' | 'walk' | 'landed';

export const careerGrantState = reactive({
  /** The sitting the walks belong to (`generation:seq`) — a new sitting drops what the old one still owed. */
  sitting: '',
  /** The walks still to play, in the seat order. */
  owed: [] as Array<CareerWalkOwed>,
  /** The walk playing now and its phase; undefined between walks and at rest. */
  current: undefined as (CareerWalkOwed & {phase: CareerWalkPhase}) | undefined,
});

function phaseOf(view: PlayerViewModel | undefined): ParliamentPhaseModel | undefined {
  return view?.game.parliament?.phase;
}

function recordKey(outcome: ParliamentEnactOutcomeModel): string {
  return `${outcome.player}:${outcome.step}:${outcome.part ?? ''}:${outcome.kind}`;
}

/**
 * DETECT (pure): the `agenda` records the RESPONSE added to the live phase —
 * present in `after`, absent from `before` (same generation), a walk of at
 * least one step, ANY seat — in the records' order (the seat order). A first
 * view or a new generation adds nothing: a reload has nothing to move from.
 */
export function detectNewCareerWalks(before: PlayerViewModel | undefined, after: PlayerViewModel): Array<CareerWalkOwed> {
  const phase = phaseOf(after);
  const was = phaseOf(before);
  if (phase === undefined || was === undefined || was.generation !== phase.generation) {
    return [];
  }
  const known = new Set((was.outcomes ?? []).map(recordKey));
  const viewer = after.thisPlayer?.color;
  const out: Array<CareerWalkOwed> = [];
  for (const outcome of phase.outcomes ?? []) {
    const walk = outcome.walk;
    if (outcome.kind !== 'agenda' || outcome.player === undefined || walk === undefined || walk.steps.length === 0 || known.has(recordKey(outcome))) {
      continue;
    }
    out.push({
      key: recordKey(outcome),
      player: outcome.player,
      from: walk.from,
      to: walk.to,
      steps: walk.steps.map((step) => ({...step})),
      generation: phase.generation,
      viewer: outcome.player === viewer,
      ...(outcome.megacredits === undefined ? {} : {megacredits: outcome.megacredits}),
    });
  }
  return out;
}

/** The ledger's entries for the VIEWER's own walk — one per paying step, in the walk's order (the TR04 queue's shape). */
export function careerWalkBonuses(walk: CareerWalkOwed): Array<AgendaBonusOwed> {
  const out: Array<AgendaBonusOwed> = [];
  for (const step of walk.steps) {
    if (step.bonus === 'tr') {
      out.push({generation: walk.generation, player: walk.player, step: step.to, kind: 'tr', spec: {channel: 'stock', resource: RATING_RAIL_KEY, amount: 1}, career: true});
    } else if (step.bonus === 'card') {
      out.push({generation: walk.generation, player: walk.player, step: step.to, kind: 'card', career: true});
    }
  }
  return out;
}

function enterSitting(key: string): void {
  if (careerGrantState.sitting === key) {
    return;
  }
  careerGrantState.sitting = key;
  careerGrantState.owed = [];
  careerGrantState.current = undefined;
  parliamentHolds.agendaGrantAwaits.clear();
}

/**
 * SEED — called by the reward ledger's seed, in the SAME synchronous block as
 * the commit, AFTER the winner's own step bonus is queued (the enactment's
 * beat takes the queue's head). Holds every walked marker on its old step and
 * returns the viewer's bonus entries for the ledger to queue. `onScreen`: the
 * sitting's stage stands and motion is allowed — else nothing is held, the
 * markers stand where the server put them.
 */
export function seedCareerGrantWalks(sitting: string, before: PlayerViewModel | undefined, after: PlayerViewModel, onScreen: boolean): Array<AgendaBonusOwed> {
  enterSitting(sitting);
  const fresh = detectNewCareerWalks(before, after);
  if (fresh.length === 0 || !onScreen) {
    return [];
  }
  const bonuses: Array<AgendaBonusOwed> = [];
  for (const walk of fresh) {
    if (careerGrantState.owed.some((owed) => owed.key === walk.key)) {
      continue;
    }
    parliamentHolds.agendaGrantAwaits.set(walk.player, {player: walk.player, from: walk.from, to: walk.to});
    careerGrantState.owed.push(walk);
    if (walk.viewer) {
      bonuses.push(...careerWalkBonuses(walk));
    }
  }
  return bonuses;
}

/** A walk is owed — the reward stage has a КАРЬЕРА beat to play. */
export function careerWalksOwed(): boolean {
  return careerGrantState.owed.length > 0;
}

/** The director takes the NEXT walk (the seat order) — its hold is handed to the tier's walk by the caller. */
export function takeCareerWalk(): CareerWalkOwed | undefined {
  return careerGrantState.owed.shift();
}

/**
 * Release EVERY career hold at once (the stage settled without its beat, the sitting left, collapsed or unmounted,
 * the ceiling): the markers stand on their server steps. The viewer's owed bonuses are the ledger's to flush.
 */
export function releaseCareerGrantWalks(): void {
  careerGrantState.owed = [];
  careerGrantState.current = undefined;
  parliamentHolds.agendaGrantAwaits.clear();
}

/** Full reset (game switch, test cleanup). */
export function resetCareerGrantBeat(): void {
  careerGrantState.sitting = '';
  releaseCareerGrantWalks();
}
