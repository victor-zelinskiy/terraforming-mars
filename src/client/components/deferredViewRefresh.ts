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
 *
 * WHOSE TICK. The GAME session's (`consoleSessionScope().every`): the parked
 * refresh is of the view of the game on screen, and the eight predicates are
 * that game's scenes. When the game screen leaves, the session takes the tick
 * back — and the park is DROPPED WITH IT (a cleanup of the same scope disarms
 * the module): `timer` doubles as the «already ticking» guard of the next arm,
 * so a handle left standing over a tick that was taken back would park every
 * later refresh behind a waiter that never looks again.
 */
import {consoleSessionScope} from '@/client/console/session/consoleSession';

/** How often a parked refresh re-checks the blocking predicate. */
export const DEFERRED_REFRESH_CHECK_MS = 200;

/** Past this, fire anyway (with a warn) — never go silent behind a stuck flag. */
export const DEFERRED_REFRESH_MAX_MS = 15_000;

/**
 * A SCENE MAY HOLD THE VIEW ONLY WITHIN A SCENE'S OWN LEGAL LIFE (FREEZE ZERO — PLAN §4).
 *
 * The overdue refresh above «fires anyway» — and its own guard parks it again behind the same flag: a scene flag that
 * NEVER releases (an end skipped by a throw, a recovery that threw before it lowered the flag — audited 2026-11-15:
 * every one of the nine can) parked the view for ever, one defect line per 15 s and a player watching «the other
 * seat's turn» while the server waited for them. No scene lawfully outlives the hold registry's ceiling
 * (`animationHold.DEFAULT_MAX_HOLD_MS`, 35 s): a view owed for that long is committed OVER the scenes that still
 * hold it, they are named, and their flags no longer hold the view until they have been seen released.
 */
export const VIEW_SCENE_HOLD_MAX_MS = 35_000;

/** A park that stands again this soon after the last one ended is the SAME debt (the overdue re-run's own re-park). */
export const VIEW_DEBT_CONTINUITY_MS = 2_000;

export type ParkStep = 'wait' | 'release' | 'overdue' | 'overrule';

/**
 * ONE TICK of a parked refresh. Pure. The release edge first; then the DEBT's bound (the view has been owed for a
 * scene's whole legal life — whoever still holds it is overruled); then the park's own window.
 */
export function parkStep(f: {now: number, armedAt: number, debtSince: number, blocked: boolean}): ParkStep {
  if (!f.blocked) {
    return 'release';
  }
  if (f.now - f.debtSince >= VIEW_SCENE_HOLD_MAX_MS) {
    return 'overrule';
  }
  return f.now - f.armedAt > DEFERRED_REFRESH_MAX_MS ? 'overdue' : 'wait';
}

/** The parked tick's stop — defined exactly while a refresh is parked. */
let timer: (() => void) | undefined;
let armedAt = 0;
/** Since when the view has been OWED — it outlives one park (an overdue re-run that parks again is the same debt). */
let debtSince = 0;
/** When the last park ended (the debt's continuity is read off it). */
let droppedAt = 0;
/** The scenes whose flag outlived a scene's legal life: they no longer hold the view, until seen released. */
const overruled = new Set<string>();
let pendingBlocked: (() => boolean) | undefined;
let pendingRefresh: (() => void) | undefined;
/** WHICH scenes keep the screen — said by whoever refused the refresh; the overdue line and the diagnostics name them. */
let pendingWhy: (() => string) | undefined;

/** Diagnostics (the `__foregroundDiag` family): how often the poll path had to
 *  park a refresh, and the longest such park this session. */
export const deferredViewRefreshStats = {deferred: 0, fired: 0, maxWaitMs: 0, overdue: 0, overruled: 0};

/**
 * Park a refused refresh until `blocked()` releases (or the ceiling). The
 * LATEST arm wins — a newer poll superseding an older parked one is exactly
 * right, since `refresh` re-fetches rather than replaying a stale model.
 */
export function armDeferredViewRefresh(blocked: () => boolean, refresh: () => void, why?: () => string): void {
  pendingBlocked = blocked;
  pendingRefresh = refresh;
  pendingWhy = why;
  if (timer !== undefined) {
    return; // already ticking — the fresh closures above are what it will run
  }
  deferredViewRefreshStats.deferred++;
  armedAt = Date.now();
  // The same debt, or a new one? (A park right behind the last one is the overdue re-run parking again.)
  if (debtSince === 0 || armedAt - droppedAt > VIEW_DEBT_CONTINUITY_MS) {
    debtSince = armedAt;
  }
  const owner = consoleSessionScope();
  const stopTick = owner.every(DEFERRED_REFRESH_CHECK_MS, 'the parked view refresh re-checks the screen', () => {
    const now = Date.now();
    const waited = now - armedAt;
    const step = parkStep({now, armedAt, debtSince, blocked: pendingBlocked?.() === true});
    if (step === 'wait') {
      return;
    }
    const run = pendingRefresh;
    // WHO held it, read BEFORE the park is dropped: a scene flag that never releases is the defect these lines name.
    const held = step === 'release' ? '' : parkedWhy();
    dropPark();
    deferredViewRefreshStats.fired++;
    deferredViewRefreshStats.maxWaitMs = Math.max(deferredViewRefreshStats.maxWaitMs, waited);
    if (step === 'overrule') {
      // THE DEBT'S BOUND: the scenes that still hold the view are overruled — the re-run below is no longer parked
      // behind them (`scenesHoldingView`), and a fresh debt starts for whatever else may hold it.
      deferredViewRefreshStats.overruled++;
      for (const scene of held.split('+')) {
        if (scene !== '') {
          overruled.add(scene);
        }
      }
      debtSince = 0;
      console.warn(`[deferred-refresh] «${held === '' ? 'unnamed' : held}» held the view for over ${VIEW_SCENE_HOLD_MAX_MS}ms — the view is committed over it`);
    } else if (step === 'overdue') {
      deferredViewRefreshStats.overdue++;
      console.warn(`[deferred-refresh] the screen stayed busy for over ${DEFERRED_REFRESH_MAX_MS}ms — refreshing anyway${held === '' ? '' : ` — held by ${held}`}`);
    }
    run?.();
  });
  // The session ending under a parked refresh drops the park with its handle (see WHOSE TICK above).
  let forgetOwner: () => void = () => {};
  const parked = (): void => {
    forgetOwner();
    stopTick();
  };
  forgetOwner = owner.defer(() => {
    if (timer === parked) {
      disarmDeferredViewRefresh();
    }
    // The session's scenes end with it: nobody is overruled in the next one.
    overruled.clear();
  });
  timer = parked;
}

/**
 * THE SCENES THAT MAY HOLD THE VIEW'S COMMIT — the live ones (`viewScenes.liveViewScenes`) minus the overruled. A
 * scene seen RELEASED is forgiven: its next raise is a new scene with a whole life of its own.
 */
export function scenesHoldingView(live: ReadonlyArray<string>): Array<string> {
  for (const scene of [...overruled]) {
    if (!live.includes(scene)) {
      overruled.delete(scene);
    }
  }
  return live.filter((scene) => !overruled.has(scene));
}

/**
 * A view was COMMITTED by another road (the transport's own apply of a submit's answer): what the page shows is the
 * server's truth as of now — a park still standing owes only what came after.
 */
export function noteViewCommitted(): void {
  debtSince = timer === undefined ? 0 : Date.now();
}

/** End the park (the tick fired, or it is superseded) — the debt it stood for is NOT forgotten here. */
function dropPark(): void {
  if (timer !== undefined) {
    timer();
    timer = undefined;
    droppedAt = Date.now();
  }
  pendingBlocked = undefined;
  pendingRefresh = undefined;
  pendingWhy = undefined;
}

/**
 * Drop the parked refresh. Called by the poll path when a refresh COMMITS
 * normally — the debt is paid by a fresher view, and firing the old waiter
 * after it would only burn a request.
 */
export function disarmDeferredViewRefresh(): void {
  dropPark();
  // …and the debt is PAID: the next park is a new one.
  debtSince = 0;
  droppedAt = 0;
}

function parkedWhy(): string {
  try {
    return pendingWhy?.() ?? '';
  } catch {
    return '';
  }
}

/**
 * Is a refresh currently parked? THE DEBT HAS AN OWNER while it is: a view that lags behind the server for a parked
 * refresh is not a lie anybody has to heal — this module re-runs it on the release edge, bounded by its own ceiling
 * (the freshness witness of the transport reads this; `viewFreshness.viewLagIsALie`).
 */
export function deferredViewRefreshArmed(): boolean {
  return timer !== undefined;
}

/** The park as a fact for a diagnostic line: how long, and behind which scenes (`undefined` = nothing is parked). */
export function deferredViewRefreshParked(): {forMs: number, why: string} | undefined {
  return timer === undefined ? undefined : {forMs: Date.now() - armedAt, why: parkedWhy()};
}

/** Test seam. */
export function resetDeferredViewRefreshForTesting(): void {
  disarmDeferredViewRefresh();
  deferredViewRefreshStats.deferred = 0;
  deferredViewRefreshStats.fired = 0;
  deferredViewRefreshStats.maxWaitMs = 0;
  deferredViewRefreshStats.overdue = 0;
  deferredViewRefreshStats.overruled = 0;
  overruled.clear();
}

/** Test seam: the standing park and its debt are `ms` older (a spec does not wait out a scene's legal life). */
export function __ageDeferredViewRefreshForTesting(ms: number): void {
  armedAt -= ms;
  debtSince -= ms;
}
