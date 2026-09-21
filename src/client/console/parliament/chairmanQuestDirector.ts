/*
 * «ПРЕДСЕДАТЕЛЬСТВО» — THE BEATS (docs/claude/prompts/parliament-chairman-quest.md §3).
 *
 *   ЗАДАНИЕ          the quest block answers once: what was closed, by whom;
 *   ПРЕДСЕДАТЕЛЬСТВО the office changes hands — the outgoing delegate goes
 *                    HOME to its owner's reserve FIRST, then the new one
 *                    leaves its real place and sits down;
 *   ПОВЕСТКА         the marker glides from the step it left to the step it
 *                    reached, and the step's own bonus follows its arrival.
 *
 * NOTHING HERE IS NEW MOTION. The marker's glide is `ConsoleParliamentAgenda`'s
 * (the shared hydro marker director), the cubes are `parliamentFlights.flyCube`,
 * the TR chip and the card cover are the sitting's own reward ledger
 * (`parliamentRewardBeat`) — this file only orders them and waits for each to
 * land before the next starts.
 *
 * THE LAWS IT OBEYS
 *  · a beat never starts before its scene is on screen — the flow only ever
 *    runs with the Parliament section mounted (its `root` is the proof), and
 *    the whole point of the server's gate is to put it there;
 *  · only what was TOUCHED reacts, and only when it is touched: the chair
 *    flashes on the cube's touchdown, the reserve rings when the returning
 *    cube lands, the step blooms when the marker locks. Nothing blinks to
 *    announce what is about to happen;
 *  · no wall clock: every pause is a parliament BEAT on the motion clock
 *    (`scheduleParliamentBeat`), every landing is a real callback, and the
 *    whole flow holds an ANIMATION HOLD released by its own completion;
 *  · «дожать» (A during a beat) drives every flight to its touchdown in
 *    order — never a skipped landing, never a proxy left in the air.
 */
import {Color} from '@/common/Color';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {AgendaMove} from './consoleParliamentModel';
import {parliamentFlow, pulseParliamentChair, pulseParliamentQuest} from './consoleParliamentFlow';
import {parliamentHolds} from './parliamentDisplayHolds';
import {chairmanQuestFlow} from './consoleChairmanQuest';
import {flushAgendaBonus, markAgendaBonusLanded, takeAgendaBonus} from './parliamentRewardBeat';
import {CUBE_FLIGHT_MS, finishParliamentFlights, flyCube, placeCubeRect, rectOf} from './parliamentFlights';
import {ParliamentBeat, scheduleParliamentBeat} from './parliamentBeat';
import {Rect} from './consoleParliamentVoteMotion';

// ── the storyboard's budget (base ms — the motion scale is applied by the beat) ──
/** ЗАДАНИЕ: the block's own answer, read. */
const TASK_READ_MS = 700;
/** The pause between beats — the next starts only once the previous has LANDED. */
const BEAT_GAP_MS = 250;
/** The new delegate leaves its place only once the outgoing one is on its way (the seat is vacated first). */
const SEAT_HANDOVER_MS = 300;
/** …and, with no outgoing delegate, after a short lead in which its place marks itself. */
const SEAT_LEAD_MS = 180;

export type ChairmanQuestDirectorContext = {
  root: HTMLElement;
  /** The viewer — the seat that completed the quest (the gate is never anyone else's). */
  viewer: Color | undefined;
  generation: number;
  /** `ConsoleParliamentAgenda.playAgendaGlide`, through the section (the marker is the component's). */
  playAgendaGlide: (move: AgendaMove, onLanded: () => void) => void;
  /** The crumb's tail advances (the section publishes it to the frame). */
  onStage: (stage: 'task' | 'agenda') => void;
  /**
   * THE CORNER CASE: every delegate of this seat stands on a resolution, so
   * the server asks WHICH card gives one up before it seats anybody. The
   * office (and with it the Agenda step) waits for that pick — the flow holds
   * here and the section hands its own stage to the picker.
   */
  owesSeatPick: () => boolean;
  /** Every beat has landed: A closes the flow. */
  onDone: () => void;
};

type Run = {
  ctx: ChairmanQuestDirectorContext;
  hold: AnimationHold | undefined;
  beats: Array<ParliamentBeat>;
  /** The reading's own minimum has passed (the server may still be answering). */
  readDone: boolean;
  /** The seat beat has started — the answer can no longer start it twice. */
  seatStarted: boolean;
  /** …and it is HOLDING for the player's own delegate pick. */
  awaitingSeatPick: boolean;
  killed: boolean;
};

let run: Run | undefined;

function schedule(baseMs: number, fn: () => void): void {
  const state = run;
  if (state === undefined) {
    return;
  }
  const beat = scheduleParliamentBeat(baseMs, () => {
    if (run === state && !state.killed) {
      fn();
    }
  });
  state.beats.push(beat);
}

/** The chair's cube-sized rect — the seat itself, whether or not a delegate stands in it. */
function chairRect(root: HTMLElement): Rect | undefined {
  const chair = root.querySelector<HTMLElement>('[data-parl-chair]');
  if (chair === null) {
    return undefined;
  }
  const cube = chair.querySelector<HTMLElement>('.con-parl__chair-cube .player-cube') ?? chair.querySelector<HTMLElement>('.con-parl__chair-cube');
  const onCube = rectOf(cube);
  if (onCube !== undefined) {
    return onCube;
  }
  const empty = chair.querySelector<HTMLElement>('.con-parl__chair-empty') ?? chair;
  const r = empty.getBoundingClientRect();
  if (r.width < 2) {
    return undefined;
  }
  const size = conLogicalPx(12);
  return {left: r.left, top: r.top + r.height / 2 - size / 2, width: size, height: size};
}

/** The place the new chairman's delegate leaves — its own reserve stack or its lobby socket. */
function sourceRect(root: HTMLElement, color: Color, source: 'reserve' | 'lobby'): Rect | undefined {
  return placeCubeRect(root, source === 'lobby' ? `[data-parl-seat-lobby="${color}"]` : `[data-parl-seat-reserve="${color}"]`);
}

// ── the run ─────────────────────────────────────────────────────────────────

/**
 * START the flow's beats. Called once, when the workspace opens on the gate:
 * the reading plays while the answer is in flight, and everything past it
 * waits for the server (`noteChairmanQuestAnswer`).
 */
export function startChairmanQuestBeats(ctx: ChairmanQuestDirectorContext): void {
  killChairmanQuestBeats();
  run = {
    ctx,
    hold: beginAnimationHold('parliament-chairman-quest', {maxHoldMs: 20000}),
    beats: [],
    readDone: false,
    seatStarted: false,
    awaitingSeatPick: false,
    killed: false,
  };
  chairmanQuestFlow.beat = 'task';
  chairmanQuestFlow.stage = 'task';
  ctx.onStage('task');
  // The quest block ANSWERS — the one object the reading is about (a CSS
  // one-shot cleared by its own `animationend`, never by a timer).
  pulseParliamentQuest();
  schedule(TASK_READ_MS, () => {
    const state = run;
    if (state === undefined) {
      return;
    }
    state.readDone = true;
    maybeStartSeat();
  });
}

/** The server answered: the beats past the reading may run (they wait for whichever comes last). */
export function noteChairmanQuestAnswer(): void {
  chairmanQuestFlow.answered = true;
  chairmanQuestFlow.sent = false;
  const state = run;
  if (state !== undefined && state.awaitingSeatPick) {
    // The delegate pick is answered: the office can change hands now.
    state.awaitingSeatPick = false;
    state.seatStarted = false;
  }
  maybeStartSeat();
}

function maybeStartSeat(): void {
  const state = run;
  if (state === undefined || state.killed || state.seatStarted || !state.readDone || !chairmanQuestFlow.answered) {
    return;
  }
  state.seatStarted = true;
  schedule(BEAT_GAP_MS, () => beatSeat());
}

/**
 * ПРЕДСЕДАТЕЛЬСТВО. The office was held: the outgoing delegate leaves the
 * chair for its owner's reserve and the seat reads EMPTY from the moment it
 * lifts off — then the new one leaves its own place and sits down. The
 * counters (the outgoing owner's reserve) tick on the touchdown, never on the
 * packet that carried the change.
 */
function beatSeat(): void {
  const state = run;
  if (state === undefined) {
    return;
  }
  const {root} = state.ctx;
  if (state.ctx.owesSeatPick()) {
    // The office cannot change until the player says which resolution gives a
    // delegate up: the flow HOLDS here (no marker moves, nothing is invented)
    // and the section hands its stage to the picker.
    chairmanQuestFlow.beat = 'seat';
    state.awaitingSeatPick = true;
    return;
  }
  const change = parliamentHolds.chairAwaits;
  if (change === undefined) {
    // The sitting chairman completed it again: nothing changes hands, and
    // nothing is depicted.
    chairmanQuestFlow.beat = 'seat';
    schedule(BEAT_GAP_MS, () => beatAgenda());
    return;
  }
  chairmanQuestFlow.beat = 'seat';
  const seat = chairRect(root);
  const outgoing = change.from;
  let lead = SEAT_LEAD_MS;
  if (outgoing !== undefined) {
    const home = placeCubeRect(root, `[data-parl-seat-reserve="${outgoing}"]`);
    lead = SEAT_HANDOVER_MS;
    // The chair lets go at the LAUNCH: the real cube hides under the proxy.
    parliamentHolds.chairAwaits = {from: undefined, to: change.to};
    flyCube(outgoing, seat, home, 0, () => {
      // …and the reserve's count ticks where the eye is: on the touchdown.
      parliamentHolds.returns.delete(outgoing);
    });
  }
  // The new delegate's place keeps PAINTING it (`sourceHold`) and keeps
  // SAYING its count (`sourceLeaving`) until it has visibly left.
  const color = change.to;
  if (color === state.ctx.viewer) {
    parliamentFlow.sourceHold = chairmanQuestFlow.seatSource;
    parliamentFlow.sourceLeaving = chairmanQuestFlow.seatSource;
  }
  const from = sourceRect(root, color, chairmanQuestFlow.seatSource);
  flyCube(color, from, seat, lead, () => {
    parliamentHolds.chairAwaits = undefined;
    pulseParliamentChair();
    schedule(BEAT_GAP_MS, () => beatAgenda());
  });
  schedule(lead, () => {
    parliamentFlow.sourceHold = undefined;
    parliamentFlow.sourceLeaving = undefined;
  });
}

/** ПОВЕСТКА. The marker glides to the step it reached; the step's bonus follows its arrival. */
function beatAgenda(): void {
  const state = run;
  if (state === undefined) {
    return;
  }
  const move = chairmanQuestFlow.move ?? parliamentHolds.agendaAwaits;
  chairmanQuestFlow.beat = 'agenda';
  chairmanQuestFlow.stage = 'agenda';
  state.ctx.onStage('agenda');
  if (move === undefined) {
    // Already at the end of the track: there is no step to show, and nothing
    // is invented to stand in for one.
    parliamentHolds.agendaAwaits = undefined;
    flushAgendaBonus('no-glide');
    schedule(BEAT_GAP_MS, () => finishRun());
    return;
  }
  state.ctx.playAgendaGlide(move, () => {
    parliamentHolds.agendaAwaits = undefined;
    launchAgendaBonus();
  });
}

/**
 * The reached step pays: a TR chip leaves the step's own graphic for the
 * rail (the counter ticks on contact), a CARD step releases the parked
 * `agenda` reveal so the cover lifts off that very step. Nothing owed →
 * nothing flies; an unmeasurable step releases the hold at once (honestly
 * late, never lost).
 */
function launchAgendaBonus(): void {
  const state = run;
  if (state === undefined) {
    return;
  }
  const bonus = takeAgendaBonus(state.ctx.generation);
  const done = () => schedule(BEAT_GAP_MS, () => finishRun());
  if (bonus === undefined) {
    done();
    return;
  }
  if (bonus.kind === 'card' || bonus.spec === undefined) {
    // The board card-bonus scene lifts the cover off the step the marker just
    // reached — the release is what lets its parked reveal present at all.
    markAgendaBonusLanded();
    done();
    return;
  }
  const node = state.ctx.root.querySelector<HTMLElement>(`.con-parl__step[data-step="${bonus.step}"] .con-parl__step-res`) ??
    state.ctx.root.querySelector<HTMLElement>(`.con-parl__step[data-step="${bonus.step}"]`);
  const r = node?.getBoundingClientRect();
  if (r === undefined || r.width < 2) {
    flushAgendaBonus('unmeasurable-step');
    done();
    return;
  }
  void runResourceTransfers({
    specs: [bonus.spec],
    source: {point: {x: r.left + r.width / 2, y: r.top + r.height / 2}},
    arrival: 'auto',
    onArrive: () => markAgendaBonusLanded(),
  }).then(done, done);
}

function finishRun(): void {
  const state = run;
  if (state === undefined) {
    return;
  }
  chairmanQuestFlow.beat = 'done';
  state.hold?.release();
  state.hold = undefined;
  state.ctx.onDone();
}

/** Is a beat in flight (A absorbs input, B says nothing)? */
export function chairmanQuestBeatActive(): boolean {
  return run !== undefined && !run.killed && !run.awaitingSeatPick &&
    chairmanQuestFlow.beat !== '' && chairmanQuestFlow.beat !== 'done';
}

/** «ДОЖАТЬ»: every pending beat fires now and every flight is driven to its touchdown, in order. */
export function finishChairmanQuestBeats(): void {
  const state = run;
  if (state === undefined || consoleReducedMotionActive()) {
    return;
  }
  for (let guard = 0; guard < 8 && chairmanQuestBeatActive(); guard++) {
    const beats = state.beats.splice(0);
    for (const beat of beats) {
      beat.kill();
    }
    finishParliamentFlights();
    if (beats.length === 0 && !chairmanQuestBeatActive()) {
      break;
    }
    // A beat whose fire was cancelled above still owes its step: run the next
    // stage directly rather than leaving the flow half-played.
    if (chairmanQuestFlow.beat === 'task' && chairmanQuestFlow.answered) {
      state.readDone = true;
      if (!state.seatStarted) {
        state.seatStarted = true;
        beatSeat();
      }
    } else if (chairmanQuestFlow.beat === 'seat' && parliamentHolds.chairAwaits === undefined) {
      beatAgenda();
    } else if (chairmanQuestFlow.beat === 'agenda' && parliamentHolds.agendaAwaits === undefined) {
      finishRun();
    } else {
      break;
    }
  }
}

/** Stop everything (the flow closes, the section unmounts, the game changes). */
export function killChairmanQuestBeats(): void {
  const state = run;
  run = undefined;
  if (state === undefined) {
    return;
  }
  state.killed = true;
  for (const beat of state.beats) {
    beat.kill();
  }
  state.beats = [];
  state.hold?.release();
  parliamentFlow.sourceHold = undefined;
  parliamentFlow.sourceLeaving = undefined;
}

/** Exposed for the specs: the storyboard's own budget. */
export const CHAIRMAN_QUEST_BUDGET = {
  task: TASK_READ_MS,
  gap: BEAT_GAP_MS,
  seat: SEAT_HANDOVER_MS + CUBE_FLIGHT_MS,
  seatLead: SEAT_LEAD_MS,
} as const;
