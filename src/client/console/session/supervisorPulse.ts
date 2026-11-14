/*
 * @console-shared LIVE — console native stands on this file.
 *
 * WHO WATCHES THE WATCHER — THE SUPERVISOR'S PULSE (FREEZE ZERO — PLAN §4 · 6 / 7, decision F11).
 *
 * The last line against a freeze (`sessionRebuild.ts`) is asked by the liveness arbiter, and the arbiter is one 1 Hz
 * pass of the console shell's supervisor. So the line had a blind side exactly as wide as that pass: a game screen
 * whose supervisor does not COMPLETE a pass has nobody to ask for it —
 *   · NO SHELL — the route resolved to the game, the view is in, and no shell stands (its set-up threw; the curtain's
 *     arm watchdog «revealed anyway» over the bare atmosphere);
 *   · NO PASS — the shell stands and its pass throws before it reaches the arbiter: every second, said by the kernel
 *     as an anomaly each time, judged by nobody.
 * Both are a page that RUNS — the main process's hang watch sees a healthy renderer — and serves nothing, for ever.
 *
 * THE WITNESS stands OUTSIDE the shell: armed once by the app's root, on the PAGE's scope, reading ONE number — the
 * passes the supervisor completed. A look in which the game screen stands in plain view and that number did not move
 * is a MISS; `PULSE_MISSED_LOOKS` misses in a row ask for the SAME last line (`rebuildConsoleSession`), under its own
 * bound (once per question, a few per window). Counted in LOOKS, never in milliseconds: a laptop that slept an hour
 * and a throttled background tab both stretch the wall clock between two looks, and neither is a supervisor that
 * stopped — the supervisor's timer and the witness's are the same clock's, so a look always has a pass before it
 * while both run.
 *
 * WHY THE JUDGE IS IN THE PAGE, NOT THE SERVER (the plan's «delivery contract», verdict half): the server cannot
 * answer a page that does not ask (a game screen without a shell has no transport — the binder is the shell's child),
 * and it learns nothing a running page does not already know (the arbiter reads the screen's own verdict once a
 * second). The one thing left to judge is whether the judge runs — and only something outside it can.
 *
 * NOT A NET, AND IT CURES NO CLASS. A rebuild it asks for is a DEFECT under its own cause
 * (`session-rebuild/page/no-shell` · `…/no-pass`, dimension `by: pulse`); the bar is zero of them.
 */

import {loadingScreenState} from '@/client/console/loadingScreenState';
import {consoleAppScope} from '@/client/console/session/consoleSession';
import {rebuildConsoleSession, sessionRebuilding} from '@/client/console/session/sessionRebuild';

/** The witness looks this often (the supervisor passes five times between two looks). */
export const PULSE_LOOK_MS = 5_000;
/** …and this many looks in a row with no completed pass are «the supervisor is not running». */
export const PULSE_MISSED_LOOKS = 3;

/** The witness's own memory: the count it read at its last look (−1 = it was not watching) and the misses in a row. */
export type PulseState = {passes: number, missed: number};
export const PULSE_REST: PulseState = {passes: -1, missed: 0};

/**
 * ONE LOOK. Pure: the next state and whether the last line is due.
 *
 *  · not WATCHED (no game screen, the curtain covers it, the page is hidden or already leaving) → rest: the next
 *    watched look is a fresh baseline, never a miss;
 *  · the count MOVED since the last look (or this is the baseline) → the supervisor runs;
 *  · it did not → a miss; at `PULSE_MISSED_LOOKS` in a row the line is due — and the count starts over, so a refused
 *    rebuild is asked for again a full three looks later, not at every look.
 */
export function pulseStep(state: PulseState, look: {watched: boolean, passes: number}): {state: PulseState, due: boolean} {
  if (!look.watched) {
    return {state: PULSE_REST, due: false};
  }
  if (look.passes !== state.passes) {
    return {state: {passes: look.passes, missed: 0}, due: false};
  }
  const missed = state.missed + 1;
  return missed >= PULSE_MISSED_LOOKS ? {state: {passes: look.passes, missed: 0}, due: true} : {state: {passes: look.passes, missed}, due: false};
}

/** Passes the supervisor COMPLETED in this document — a pass that threw is not one. */
let passes = 0;
/** A supervisor is started: a shell stands and said so (which of the two causes a silent pulse has). */
let standing = false;

/** The supervisor's side: it started / it stopped / a pass ran to its end. */
export function noteSupervisorStarted(): void {
  standing = true;
}

export function noteSupervisorStopped(): void {
  standing = false;
}

export function noteSupervisorPass(): void {
  passes++;
}

/** What the app's root says of the game screen: the seat and the standing question (the rebuild's bound key). */
export type PulseScreen = {seat: string, question: string};

/**
 * ARM THE WITNESS (the app's root, once per page). `gameScreen` — the root's own answer to «does the game screen
 * stand right now» (`undefined` = no): the route is the game's AND its view is in — the one condition under which
 * the shell is rendered. Returns the stop.
 */
export function watchSupervisorPulse(gameScreen: () => PulseScreen | undefined): () => void {
  let state = PULSE_REST;
  return consoleAppScope().every(PULSE_LOOK_MS, 'the supervisor\'s pulse witness', () => {
    const screen = gameScreen();
    const watched = screen !== undefined && !loadingScreenState.active && !sessionRebuilding() &&
      (typeof document === 'undefined' || document.visibilityState === 'visible');
    const step = pulseStep(state, {watched, passes});
    state = step.state;
    if (!step.due || screen === undefined) {
      return;
    }
    const stood = PULSE_MISSED_LOOKS * PULSE_LOOK_MS / 1000;
    rebuildConsoleSession({
      by: 'pulse', seat: screen.seat, question: screen.question,
      task: standing ? 'no-pass' : 'no-shell',
      why: standing ?
        `the supervisor completed no pass in ${stood}s — its pass does not reach the arbiter` :
        `the game screen stands and no supervisor runs for ${stood}s — the shell is not there`,
    });
  });
}
