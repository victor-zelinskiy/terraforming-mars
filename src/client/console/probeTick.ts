/*
 * ONE PROBE TICK — `requestAnimationFrame` WITH A TIMER FALLBACK.
 *
 * Every cinematic in this console measures before it moves: «is this slot laid
 * out yet?», «has the row stopped re-fitting?», «is the whole track standing?».
 * Those loops were written on `requestAnimationFrame`, which is the right clock
 * for «has the browser painted» — and the wrong one for «has anything
 * happened», because rAF is driven by the compositor and STOPS when the screen
 * goes quiet. A quiet screen is exactly the state these probes wait in.
 *
 * The measured failure: the second cycle of a multi-settlement Pluto payout.
 * The deck-draw scene arms, `deckDrawHolds()` withholds the reveal so its cards
 * can come off the pile, and the scene then probes the deck's rect — on a frame
 * where nothing else is animating. rAF never fires again, the probe never
 * resolves, and the scene sits between «armed» and «dealing» until its 30 s
 * whole-scene safety aborts it. The player sees «КОЛОНИИ › ПЛУТОН › БОНУС
 * ВЛАДЕЛЬЦА» over an EMPTY frame for half a minute, with a mandatory card owed
 * and no surface anywhere to answer it. Reproduced at ~25 % of runs of
 * `tests/e2e/console-pluto-two-colony-sequence.spec.ts`; the same starvation is
 * reachable in the real app on a backgrounded/occluded window and on a
 * throttled handheld.
 *
 * So a probe tick is «the next frame, OR shortly, whichever comes first». It
 * keeps rAF's alignment when the compositor is running (which is the common
 * case, and what makes a stability check meaningful) and stops being a
 * liveness dependency when it is not. Deliberately NOT a plain timer: a
 * measurement taken mid-flush reads a box the browser has not laid out yet.
 */

import {consoleSessionScope} from '@/client/console/session/consoleSession';

/**
 * How long a probe waits for a frame that may never come. One tick of a slow
 * display plus slack — long enough that the rAF path wins on any running
 * compositor, short enough that a starved one costs a beat, not a scene.
 */
export const PROBE_TICK_FALLBACK_MS = 50;

/**
 * Which path woke the tick: a painted `frame`, or the `timer` — no frame came
 * within the fallback (an idle compositor, or a long task that delayed both).
 * A probe with a BUDGET needs it: a timer tick spans ~3 frames of time, and
 * counting it as one inflates a frame budget ×3 on a quiet screen.
 */
export type ProbeTickVia = 'frame' | 'timer';

/**
 * Schedule `fn` for the next painted frame, or `PROBE_TICK_FALLBACK_MS`.
 *
 * ON THE FLOW KERNEL (architecture v2 — PLAN §10 · C1): the frame is an owned frame callback and the fallback a
 * GUARANTEED release of the session — a probe is a link of somebody's `await`, so the tick is never dropped: when the
 * game screen leaves between two ticks the tick comes due at once (as a `timer` tick) and the loop that asked for it
 * runs out on its own terms instead of standing for ever. Both halves are rows of the wait table while they stand.
 */
export function probeTick(fn: (via: ProbeTickVia) => void): void {
  const owner = consoleSessionScope();
  let fired = false;
  let cancelFrame: () => void = () => {};
  let disarm: () => void = () => {};
  const run = (via: ProbeTickVia) => {
    if (fired) {
      return;
    }
    fired = true;
    cancelFrame();
    disarm();
    fn(via);
  };
  if (typeof requestAnimationFrame === 'function') {
    cancelFrame = owner.afterFrame('a probe tick', () => run('frame'));
  }
  disarm = owner.guarantee(PROBE_TICK_FALLBACK_MS, 'a probe tick (no frame came)', () => run('timer'));
}
