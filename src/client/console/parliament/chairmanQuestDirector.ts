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
 * (the shared hydro marker director), the delegates are `parliamentFlights.flyDelegate`,
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
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {AgendaWalkHooks, AgendaWalkRecordLike} from './agendaWalkDirector';
import {parliamentFlow, pulseParliamentChair, pulseParliamentQuest} from './consoleParliamentFlow';
import {parliamentHolds} from './parliamentDisplayHolds';
import {chairmanQuestFlow} from './consoleChairmanQuest';
import {agendaAnswerSettled, flushAgendaBonus, markAgendaBonusLanded, takeAgendaBonus} from './parliamentRewardBeat';
import {CUBE_FLIGHT_MS, finishParliamentFlights, flyDelegate, placeFigureRect, rectOf} from './parliamentFlights';
import {CHAIR_FIGURE, delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import {ParliamentBeat, scheduleParliamentBeat} from './parliamentBeat';
import {TableAnswer, takeTableAnswer} from './tableAnswerBeat';
import {agendaReactionResourceKey} from './agendaReaction';
import {Rect} from './consoleParliamentVoteMotion';
import {parliamentDrawsSettled} from './parliamentDraw';

// ── the storyboard's budget (base ms — the motion scale is applied by the beat) ──
/** ЗАДАНИЕ: the block's own answer, read. */
const TASK_READ_MS = 700;
/** The pause between beats — the next starts only once the previous has LANDED. */
const BEAT_GAP_MS = 250;
/** The new delegate leaves its place only once the outgoing one is on its way (the seat is vacated first). */
const SEAT_HANDOVER_MS = 300;
/** …and, with no outgoing delegate, after a short lead in which its place marks itself. */
const SEAT_LEAD_MS = 180;
/** A card that TAKES the chair (TR76): the risen pose reads the chair with its holder before the handover starts. */
const SEAT_READ_MS = 420;
/** «ИСТРЕБИТЕЛЬ»: while the flow holds for the table's question it re-reads that question on this beat (motion clock). */
const REACTION_PROBE_MS = 200;
/**
 * …and the question may stand with NO surface serving it (the quest's answer stage never asked it — a pick nobody can
 * press) this long, in REAL time (the motion clock is instant under reduced motion), before the flow settles honestly
 * (wait graph R3). A question that IS served is the player's: no bound stands over a decision.
 */
export const CHAIRMAN_QUEST_REACTION_UNSERVED_MS = 6000;

export type ChairmanQuestDirectorContext = {
  root: HTMLElement;
  /** The viewer — the seat that completed the quest (the gate is never anyone else's). */
  viewer: Color | undefined;
  generation: number;
  /** `ConsoleParliamentAgenda.playAgendaWalk`, through the section (the marker is the component's) — the quest's step is a walk of ONE. */
  playAgendaWalk: (record: AgendaWalkRecordLike, hooks: AgendaWalkHooks) => void;
  /** The crumb's tail advances (the section publishes it to the frame). */
  onStage: (stage: 'task' | 'agenda' | 'reaction') => void;
  /**
   * THE CORNER CASE: every delegate of this seat stands on a resolution, so
   * the server asks WHICH card gives one up before it seats anybody. The
   * office (and with it the Agenda step) waits for that pick — the flow holds
   * here and the section hands its own stage to the picker.
   */
  owesSeatPick: () => boolean;
  /**
   * A CARD OF THE VIEWER'S TABLE ANSWERS THE STEP (TR78 Arwind Inc.: «add 1 fighter to ANY card»): the stage word of
   * its question when one stands (the answer arrived with the gate's), else undefined. The flow then HOLDS after the
   * step's bonus — the section opens the quest's stage zone and the shell teleports the pick into it — and goes on
   * once the answer has landed (`noteChairmanQuestReactionAnswered`).
   */
  owesReaction?: () => string | undefined;
  /**
   * …and is that question SERVED — standing on the quest's own answer stage, where the shell teleports its pick (the
   * section has asked it)? A question standing unserved past `CHAIRMAN_QUEST_REACTION_UNSERVED_MS` is a deaf screen:
   * the flow settles (wait graph R3). Absent = served.
   */
  reactionServed?: () => boolean;
  /**
   * «ОТВЕТ СТОЛА» (TR78): the step's units LANDED on the asker (no question) — the section plays the receipt on the
   * quest's answer stage (`tableAnswerBeat.playTableAnswer`) and calls `done` when the stage has folded.
   */
  playTableAnswer?: (answer: TableAnswer, done: () => void) => void;
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
  /** …or for the table's answer to the step (TR78) — the pick stands in the quest's zone. */
  awaitingReaction: boolean;
  /** The one probe of that wait (re-armed each read, never piled up) and since when the question stood unserved. */
  reactionProbe: ParliamentBeat | undefined;
  reactionUnservedSince: number | undefined;
  /** The step past the table's answer waiting behind its gap (the receipt read, the last answer landed) — «дожать» runs it. */
  reactionTail: (() => void) | undefined;
  killed: boolean;
};

/** Real time for a BOUND (never a beat's pace — the beats ride the motion clock). */
function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

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

/**
 * The chair's FIGURE-sized rect — the delegate seated in it when one is, else
 * the figure the chair would seat (24 logical px, standing on the seat's floor
 * at the chair's centre), whether or not a delegate stands there.
 */
function chairRect(root: HTMLElement): Rect | undefined {
  const chair = root.querySelector<HTMLElement>('[data-parl-chair]');
  if (chair === null) {
    return undefined;
  }
  const seated = rectOf(chair.querySelector<HTMLElement>('.con-parl__chair-cube .player-delegate'));
  if (seated !== undefined) {
    return seated;
  }
  const r = chair.getBoundingClientRect();
  if (r.width < 2) {
    return undefined;
  }
  const height = delegateFigurePx(CHAIR_FIGURE);
  const width = height * 0.8;
  return {left: r.left + r.width / 2 - width / 2, top: r.top + r.height / 2 - height * 0.4, width, height};
}

/** The place the new chairman's delegate leaves — its own reserve stack or its lobby socket. */
function sourceRect(root: HTMLElement, color: Color, source: 'reserve' | 'lobby'): Rect | undefined {
  return placeFigureRect(root, source === 'lobby' ? `[data-parl-seat-lobby="${color}"]` : `[data-parl-seat-reserve="${color}"]`);
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
    // THE CEILING ENDS THE WEDGE, NOT JUST THE COUNT (animations.md § the ceiling MASKS the hold — the field lock of
    // 2026-11-07 01:20: a beat that never landed held this past 20 s, the ceiling dropped the count, and the run stood
    // «in a beat» — B absorbed, A «дожать» with nothing left to drive — over the next action menu, `accepting` and
    // quiet). The flow's own honest end runs instead: every beat cut, every flight landed, `done` — A / B close it.
    hold: beginAnimationHold('parliament-chairman-quest', {
      // Waits for the PLAYER — never judged as a still motion (`motionWitness.ts`): the seat pick and the reading are the player's; the answer the server's.
      waitsFor: 'player',
      maxHoldMs: 20000,
      diagnose: () => ({beat: chairmanQuestFlow.beat, answered: chairmanQuestFlow.answered,
        seatPick: run?.awaitingSeatPick ?? false, reaction: run?.awaitingReaction ?? false,
        chairAwaits: parliamentHolds.chairAwaits !== undefined, agendaAwaits: parliamentHolds.agendaAwaits !== undefined}),
      expire: () => settleChairmanQuestBeats('the beats outlived their 20 s ceiling'),
    }),
    beats: [],
    readDone: false,
    seatStarted: false,
    awaitingSeatPick: false,
    awaitingReaction: false,
    reactionProbe: undefined,
    reactionUnservedSince: undefined,
    reactionTail: undefined,
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
  playChairHandover({
    root, change, viewer: state.ctx.viewer, source: chairmanQuestFlow.seatSource,
    beat: (ms, fn) => schedule(ms, fn),
    onSeated: () => schedule(BEAT_GAP_MS, () => beatAgenda()),
  });
}

/**
 * THE OFFICE CHANGES HANDS — ONE phrase, shared by the quest's «ПРЕДСЕДАТЕЛЬСТВО» and a card that unseats the
 * chairman (TR76 Vote Of No Confidence:redux, hosted by the hand — `agendaWalk.ts` `seat`). The outgoing delegate
 * leaves the chair for its owner's reserve and the seat reads EMPTY from the moment it lifts off — then the new one
 * leaves its own place and sits down («кресло освобождается первым»). The counters (the outgoing owner's reserve) tick
 * on the touchdown, never on the packet that carried the change; the chair answers once, on the new cube's touchdown.
 * `beat` is the caller's clock (its waits are the caller's to kill or hurry); `onSeated` fires after the landing.
 */
export function playChairHandover(opts: {
  root: HTMLElement;
  change: {from: Color | undefined, to: Color};
  viewer: Color | undefined;
  source: 'reserve' | 'lobby';
  beat: (baseMs: number, fn: () => void) => void;
  onSeated: () => void;
}): void {
  const {root, change, viewer, source, beat} = opts;
  const seat = chairRect(root);
  const outgoing = change.from;
  let lead = SEAT_LEAD_MS;
  if (outgoing !== undefined) {
    const home = placeFigureRect(root, `[data-parl-seat-reserve="${outgoing}"]`);
    lead = SEAT_HANDOVER_MS;
    // The chair lets go at the LAUNCH: the real cube hides under the proxy.
    parliamentHolds.chairAwaits = {from: undefined, to: change.to};
    flyDelegate(outgoing, seat, home, 0, () => {
      // …and the reserve's count ticks where the eye is: on the touchdown.
      parliamentHolds.returns.delete(outgoing);
    });
  }
  // The new delegate's place keeps PAINTING it (`sourceHold`) and keeps
  // SAYING its count (`sourceLeaving`) until it has visibly left.
  const color = change.to;
  if (color === viewer) {
    parliamentFlow.sourceHold = source;
    parliamentFlow.sourceLeaving = source;
  }
  const from = sourceRect(root, color, source);
  flyDelegate(color, from, seat, lead, () => {
    parliamentHolds.chairAwaits = undefined;
    pulseParliamentChair();
    opts.onSeated();
  });
  beat(lead, () => {
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
    schedule(BEAT_GAP_MS, () => afterAgenda());
    return;
  }
  const bonus = chairmanQuestFlow.bonus;
  state.ctx.playAgendaWalk({player: move.player, from: move.from, to: move.to, steps: [bonus === undefined ? {to: move.to} : {to: move.to, bonus}]}, {
    onLanded: () => {
      parliamentHolds.agendaAwaits = undefined;
      launchAgendaBonus();
    },
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
  const done = () => schedule(BEAT_GAP_MS, () => afterAgenda());
  if (bonus === undefined) {
    done();
    return;
  }
  if (bonus.kind === 'card' || bonus.spec === undefined) {
    // The board card-bonus scene lifts the cover off the step the marker just
    // reached — the release is what lets its parked reveal present at all.
    markAgendaBonusLanded();
    if (bonus.kind !== 'card') {
      done();
      return;
    }
    // «ПРИЁМКА» (2026-11-02): the card is received in the Parliament's draw stage, and the quest WAITS for the
    // player's take before its next beat (it used to go on under a reveal standing over it). The take is the
    // player's: no animation hold stands over a reading (a ceiling over it fires as a leak).
    state.hold?.release();
    state.hold = undefined;
    void parliamentDrawsSettled().then(() => {
      if (run === state && !state.killed) {
        done();
      }
    });
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
  // …and the TABLE'S ANSWER to the step's rating (the ruling Greens' M€ — the walk's record) lands before the flow's
  // next beat: the receipt / the question never open under the charter's tokens.
  void runResourceTransfers({
    specs: [bonus.spec],
    source: {point: {x: r.left + r.width / 2, y: r.top + r.height / 2}},
    arrival: 'auto',
    onArrive: () => markAgendaBonusLanded(),
  }).then(() => agendaAnswerSettled(bonus.step)).then(done, done);
}

/**
 * THE STEP HAS PAID — and its TABLE may answer it (TR78 Arwind Inc.): with the table's question standing the flow
 * HOLDS («ИСТРЕБИТЕЛЬ» — the crumb's tail advances, the section opens the quest's zone, the pick is teleported into it);
 * without one it ends as it always did.
 */
function afterAgenda(): void {
  const state = run;
  if (state === undefined) {
    return;
  }
  // «ОТВЕТ СТОЛА» (TR78): the step's units LANDED with the step (the asker alone) — the receipt plays on the quest's
  // answer stage first; a question (a second holder) holds the flow below, on the same stage.
  const play = state.ctx.playTableAnswer;
  const receipt = play === undefined ? undefined : takeTableAnswer('quest');
  if (receipt !== undefined && play !== undefined) {
    chairmanQuestFlow.reactionKey = agendaReactionResourceKey(receipt.resource);
    chairmanQuestFlow.beat = 'reaction';
    chairmanQuestFlow.stage = 'reaction';
    state.ctx.onStage('reaction');
    play(receipt, () => scheduleReactionTail(state, () => afterAnswer()));
    return;
  }
  afterAnswer();
}

/** The receipt (if any) has played: with the table's QUESTION standing the flow holds for it; without one it ends. */
function afterAnswer(): void {
  const state = run;
  if (state === undefined) {
    return;
  }
  const key = state.ctx.owesReaction?.();
  if (key === undefined) {
    finishRun();
    return;
  }
  chairmanQuestFlow.reactionKey = key;
  chairmanQuestFlow.beat = 'reaction';
  chairmanQuestFlow.stage = 'reaction';
  state.awaitingReaction = true;
  // The pick is the player's: no animation hold stands over a decision (a ceiling over a reading fires as a leak).
  state.hold?.release();
  state.hold = undefined;
  state.ctx.onStage('reaction');
  // …but the WAIT is still the flow's own, and bounded (wait graph R3): it re-reads its question on its own beat — gone
  // (answered wherever it was served, or withdrawn) ends the flow; standing with no surface serving it past its bound
  // settles the flow honestly. Never a deaf screen whose hold is released with no ceiling and A / B both inert.
  armReactionProbe(state);
}

function armReactionProbe(state: Run): void {
  state.reactionProbe?.kill();
  state.reactionProbe = scheduleParliamentBeat(REACTION_PROBE_MS, () => {
    state.reactionProbe = undefined;
    if (run === state && !state.killed) {
      probeChairmanQuestReaction();
    }
  });
}

/**
 * ONE READ of the held flow's question (the probe's beat; exported for the specs with an injectable clock):
 *  · the question is GONE → the flow's own ending (`noteChairmanQuestReactionAnswered`);
 *  · it stands SERVED → the player's: the wait goes on, its unserved clock reset;
 *  · it stands UNSERVED → counted from the first such read; past the bound the beats SETTLE (`done` — A / B close).
 * Returns what it did.
 */
export function probeChairmanQuestReaction(now: number = nowMs()): 'none' | 'answered' | 'waiting' | 'settled' {
  const state = run;
  if (state === undefined || state.killed || !state.awaitingReaction) {
    return 'none';
  }
  if (state.ctx.owesReaction?.() === undefined) {
    noteChairmanQuestReactionAnswered();
    return 'answered';
  }
  if (state.ctx.reactionServed?.() ?? true) {
    state.reactionUnservedSince = undefined;
  } else {
    state.reactionUnservedSince ??= now;
    if (now - state.reactionUnservedSince >= CHAIRMAN_QUEST_REACTION_UNSERVED_MS) {
      settleChairmanQuestBeats('the table question stood with no surface serving it');
      return 'settled';
    }
  }
  armReactionProbe(state);
  return 'waiting';
}

/**
 * A «ДОЖАТЬ» WHILE THE FLOW HOLDS FOR THE TABLE'S QUESTION — the press reached the Parliament, so no pick took it: the
 * question GONE ends the flow now (no gap); standing UNSERVED settles it now (the bound, hurried); a question SERVED is
 * the player's and A does nothing here. `true` = the flow moved.
 */
export function hurryChairmanQuestReaction(): boolean {
  const state = run;
  if (state === undefined || state.killed || !state.awaitingReaction) {
    return false;
  }
  if (state.ctx.owesReaction?.() === undefined) {
    state.awaitingReaction = false;
    state.reactionProbe?.kill();
    state.reactionProbe = undefined;
    finishRun();
    return true;
  }
  if (state.ctx.reactionServed?.() ?? true) {
    return false;
  }
  settleChairmanQuestBeats('the table question stands with no surface serving it — hurried');
  return true;
}

/**
 * THE TABLE'S ANSWER HAS LANDED (its receive scene played — the fighter on its card): another answer of the same walk
 * keeps the flow on its stage (the zone stays — the next pick is teleported into it), the last one ends the flow.
 */
export function noteChairmanQuestReactionAnswered(): void {
  const state = run;
  if (state === undefined || !state.awaitingReaction) {
    return;
  }
  const key = state.ctx.owesReaction?.();
  if (key !== undefined) {
    chairmanQuestFlow.reactionKey = key;
    return;
  }
  state.awaitingReaction = false;
  state.reactionProbe?.kill();
  state.reactionProbe = undefined;
  scheduleReactionTail(state, () => finishRun());
}

/** The step past the table's answer, after its gap — remembered so a «дожать» that cuts the gap still takes it. */
function scheduleReactionTail(state: Run, fn: () => void): void {
  state.reactionTail = fn;
  schedule(BEAT_GAP_MS, () => {
    if (state.reactionTail === fn) {
      state.reactionTail = undefined;
      fn();
    }
  });
}

/** Is the flow HOLDING for the table's answer to the step (the pick stands in the quest's zone)? */
export function chairmanQuestAwaitsReaction(): boolean {
  return run !== undefined && !run.killed && run.awaitingReaction;
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

/**
 * Is a run of the beats ALIVE (started and not killed)? The flow record can stand without one — the director never
 * started (the section's root was not measurable), or it was cut — and such a flow has no beat that will ever end it:
 * the section then ends it honestly on the player's A (`chairmanQuestStalled`), never a dead end.
 */
export function chairmanQuestRunLive(): boolean {
  return run !== undefined && !run.killed;
}

/**
 * THE FLOW CAN NO LONGER END BY ITSELF (the field freeze of 2026-10-29): the record is live and answered, yet no run
 * stands to play the office and the step — or the run waits on the server's answer that this flow already has. Pure
 * over the two records; the section reads it for its bar and its A.
 */
export function chairmanQuestStalled(): boolean {
  if (!chairmanQuestFlow.live || chairmanQuestFlow.beat === 'done') {
    return false;
  }
  return chairmanQuestFlow.answered && !chairmanQuestRunLive();
}

/**
 * END THE FLOW HONESTLY, with nothing left to play: every pending beat is cut, every flight lands where it is going,
 * and the beat reads `done` — the counters the holds kept tick now (the caller releases them), A closes.
 */
export function settleChairmanQuestBeats(why: string): void {
  if (!chairmanQuestFlow.live) {
    return;
  }
  console.warn(`[parliament] chairmanship: ${why} — settled without its beats`);
  killChairmanQuestBeats();
  finishParliamentFlights();
  chairmanQuestFlow.beat = 'done';
}

/** Is a beat in flight (A absorbs input, B says nothing)? */
export function chairmanQuestBeatActive(): boolean {
  return run !== undefined && !run.killed && !run.awaitingSeatPick && !run.awaitingReaction &&
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
      afterAgenda();
    } else if (chairmanQuestFlow.beat === 'reaction' && state.reactionTail !== undefined) {
      // The table's answer has landed (or its receipt was read) and only the gap before the next step was pending — cut
      // above: the step is taken now, never a `reaction` beat left standing with nothing scheduled to end it.
      const tail = state.reactionTail;
      state.reactionTail = undefined;
      tail();
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
  state.reactionProbe?.kill();
  state.reactionProbe = undefined;
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
  seatRead: SEAT_READ_MS,
} as const;
