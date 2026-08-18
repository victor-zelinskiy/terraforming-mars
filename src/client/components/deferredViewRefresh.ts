/**
 * DEFERRED VIEW REFRESH — «the screen is busy, come back the moment it frees».
 *
 * THE DEFECT THIS REMOVES. `App.update` (the POLL path) refuses to commit a
 * fetched view while one of eight scene predicates is active (a played-card
 * hero, an energy conversion, a tile flight…), because swapping `playerView`
 * mid-cinematic pops panels to their final values and opens next-phase modals
 * over a running scene. It used to DROP the fetched model entirely — «the poll
 * loop keeps running, so the next poll commits fresh state». Two things made
 * that a hole, not a delay:
 *
 *   · the response it drops routinely carries the PLAYER'S OWN NEXT PROMPT
 *     (the bot's paced turn resolves ~200 ms after a turn-ending card play and
 *     arrives exactly while that play's cinematic is on screen — every time);
 *   · with a healthy WebSocket the fallback poll is STRETCHED to ~20 s, and
 *     the one `GAME_STATE_INVALIDATED` wake was already consumed by the
 *     dropped attempt — nothing else re-triggers. Measured end to end:
 *     the screen was free at 3.9 s and control returned at **21.4 s**.
 *
 * THE MODEL. A drop is a DEBT: whoever refuses a refresh must guarantee its
 * retry. The caller arms this waiter with the SAME blocked-predicate and a
 * refresh closure (a fresh `update()` — never the stale model, so whatever
 * happened meanwhile is included); the waiter re-checks on a short tick and
 * fires the refresh ON THE RELEASE EDGE. One waiter, latest closure wins.
 *
 * Bounded: past {@link DEFERRED_REFRESH_MAX_MS} the refresh fires ANYWAY, with
 * a warn — a scene flag that never releases is already a defect (each has its
 * own ceiling/watchdog), and a stale view is strictly better than a game that
 * silently stopped updating. The re-run's own guard re-evaluates honestly, so
 * a genuinely still-busy screen re-arms with a fresh window rather than
 * committing over a live scene.
 *
 * DELIBERATELY A TIMER, not a Vue watch: the eight predicates live in eight
 * modules, and at least historically not every one of them was backed by
 * reactive state — a watch that silently loses its one reactive dependency is
 * this codebase's best-documented footgun («a plain module `let` KILLS the
 * whole registry», animations.md). A 200 ms tick over plain function calls
 * cannot be starved by a non-reactive read, costs nothing while disarmed, and
 * is poll infrastructure pacing a poll — not an animation gate.
 */

/** How often a parked refresh re-checks the blocking predicate. */
export const DEFERRED_REFRESH_CHECK_MS = 200;

/** Past this, fire anyway (with a warn) — never go silent behind a stuck flag. */
export const DEFERRED_REFRESH_MAX_MS = 15_000;

let timer: ReturnType<typeof setInterval> | undefined;
let armedAt = 0;
let pendingBlocked: (() => boolean) | undefined;
let pendingRefresh: (() => void) | undefined;

/** Diagnostics (the `__foregroundDiag` family): how often the poll path had to
 *  park a refresh, and the longest such park this session. */
export const deferredViewRefreshStats = {deferred: 0, fired: 0, maxWaitMs: 0, overdue: 0};

/**
 * Park a refused refresh until `blocked()` releases (or the ceiling). The
 * LATEST arm wins — a newer poll superseding an older parked one is exactly
 * right, since `refresh` re-fetches rather than replaying a stale model.
 */
export function armDeferredViewRefresh(blocked: () => boolean, refresh: () => void): void {
  pendingBlocked = blocked;
  pendingRefresh = refresh;
  if (timer !== undefined) {
    return; // already ticking — the fresh closures above are what it will run
  }
  deferredViewRefreshStats.deferred++;
  armedAt = Date.now();
  timer = setInterval(() => {
    const waited = Date.now() - armedAt;
    const overdue = waited > DEFERRED_REFRESH_MAX_MS;
    if (!overdue && pendingBlocked?.() === true) {
      return;
    }
    const run = pendingRefresh;
    disarmDeferredViewRefresh();
    deferredViewRefreshStats.fired++;
    deferredViewRefreshStats.maxWaitMs = Math.max(deferredViewRefreshStats.maxWaitMs, waited);
    if (overdue) {
      deferredViewRefreshStats.overdue++;
      console.warn(`[deferred-refresh] the screen stayed busy for over ${DEFERRED_REFRESH_MAX_MS}ms — refreshing anyway`);
    }
    run?.();
  }, DEFERRED_REFRESH_CHECK_MS);
}

/**
 * Drop the parked refresh. Called by the poll path when a refresh COMMITS
 * normally — the debt is paid by a fresher view, and firing the old waiter
 * after it would only burn a request.
 */
export function disarmDeferredViewRefresh(): void {
  if (timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
  pendingBlocked = undefined;
  pendingRefresh = undefined;
}

/** Is a refresh currently parked? (diagnostics / specs) */
export function deferredViewRefreshArmed(): boolean {
  return timer !== undefined;
}

/** Test seam. */
export function resetDeferredViewRefreshForTesting(): void {
  disarmDeferredViewRefresh();
  deferredViewRefreshStats.deferred = 0;
  deferredViewRefreshStats.fired = 0;
  deferredViewRefreshStats.maxWaitMs = 0;
  deferredViewRefreshStats.overdue = 0;
}
