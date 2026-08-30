/*
 * CONSOLE HYDRO MARKER — controller + reactive state for the hydronetwork
 * marker-advance micro-interaction (the "the marker physically moved along
 * the track" premium moment). The engineering-flavoured sibling of the
 * colony trade-fleet launch (consoleTradeFleet): same GATE architecture,
 * calmer motion (a token gliding along a rail, not a ship flying an arc).
 *
 * This is the transition GATE for a console hydro advance — mirrors the
 * energy→heat / trade-fleet holds in WaitingFor.vue: the glide is
 * CLIENT-armed at the confirm modal (so the marker moves immediately,
 * independent of the server), then the commit of the new view (delta chips,
 * the new track position, the next prompt) is BLOCKED until the marker
 * physically LOCKS IN on the new stop.
 *
 * Two legs compose:
 *   1. arm (confirm)  — charge → glide → ARRIVE hold (client-side, plays at
 *      once; the marker hovers on the new stop if the server is still working);
 *   2. run (response) — WaitingFor detects the armed advance, fires the final
 *      LOCK-IN pulse, and resolves the gate → the view commits.
 *
 * Ownership split (mirrors consoleTradeFleet / energyConversionTransition):
 *   - PURE timings live in `hydroMarkerModel.ts` (unit-tested);
 *   - this module owns the reactive `hydroMarkerState` (the layer + section
 *     read it), the director handle, the gate Promise, the arm/detect/run/
 *     release/end lifecycle, and the poll re-entrancy guard.
 *
 * DESKTOP SAFETY: `armHydroMarker` is ONLY called by the console shell, so on
 * desktop (and every non-hydro submit) `hydroMarkerState.active` is false and
 * `detectHydroMarker` returns undefined → the WaitingFor hold never engages.
 */

import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import type {HydroMarkerDirectorHandle} from '@/client/console/hydroMarker/hydroMarkerDirector';
import {arriveReadyMs, markerTimings, reducedMarkerTimings} from '@/client/console/hydroMarker/hydroMarkerModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  runResourceTransfers, beginPanelRewardHold, releasePanelRewardHold,
  clearPanelRewardHold, abortResourceTransfers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';

export type MarkerPhase = 'idle' | 'charge' | 'glide' | 'arrive' | 'lock' | 'pulse';

type HydroMarkerState = {
  /** Any non-idle phase — the input gate + poll re-entrancy guard. */
  active: boolean;
  phase: MarkerPhase;
  /** The stop the marker glides FROM (its viewer marker is hidden there). */
  fromPosition: number;
  /** The stop the marker glides TO (the landing anchor). */
  toPosition: number;
  /** The viewer's marker colour (the gliding token). */
  color: Color | '';
  /** Bumped per advance — the layer re-measures the anchors + re-runs. */
  nonce: number;
  reducedMotion: boolean;
  /** Briefly the just-advanced stop AFTER the commit — a one-shot settle glow
   *  on the now-real marker (the handoff from proxy to board state). */
  settledPosition: number;
  /**
   * ── THE TRAVERSAL PLAN (Delta Surge) ────────────────────────────────────
   * A multi-reward advance runs as a SEQUENCE of single-cell legs: glide →
   * lock → the cell's own reward wave (awaited) → the next leg — pausing at
   * every interactive stop and resuming on the shell's explicit signal.
   * `planCursor === -1` ⇔ no plan (the historical single-leg move).
   */
  planCursor: number;
  planLength: number;
  /** The sequence is parked at an interactive stop (deck pick / follow-up):
   *  `active` is false there so the player can interact — the plan itself is
   *  what keeps the flow's close gate honest (`traversalPending`). */
  planPaused: boolean;
  /**
   * WHERE THE VIEWER'S MARKER VISUALLY STANDS while a plan runs — the
   * settled cell of the last completed leg. The section renders the viewer's
   * marker (and the current-position chip) from THIS, never from the server
   * position, which already holds the destination. −1 = no plan.
   */
  visualPosition: number;
};

export const hydroMarkerState = reactive<HydroMarkerState>({
  active: false,
  phase: 'idle',
  fromPosition: 0,
  toPosition: 0,
  color: '',
  nonce: 0,
  reducedMotion: false,
  settledPosition: -1,
  planCursor: -1,
  planLength: 0,
  planPaused: false,
  visualPosition: -1,
});

/**
 * One leg of a traversal plan: the cell it ARRIVES at (legs are single-cell
 * hops in path order), the wave to fly there, and how the sequence behaves on
 * arrival. `stop` parks the sequence for an interactive resolution — resumed
 * ONLY by the shell's completion signal, never a timeout. `excluded` is the
 * crossed 2 VP cell: the marker physically crosses it (settle, a calm dwell),
 * nothing flies, the omission is stated by the workspace.
 */
export type HydroMarkerLegPlan = {
  position: number;
  transfers: ReadonlyArray<ResourceTransferSpec>;
  stop?: 'deck-draw' | 'repeat' | 'prompt';
  excluded?: boolean;
};

let handle: HydroMarkerDirectorHandle | undefined;
let lockResolve: (() => void) | undefined;
/**
 * A LOCK REQUESTED BEFORE THE DIRECTOR EXISTED.
 *
 * The client leg is armed synchronously at the confirm, but the glide itself
 * cannot start until the layer has re-rendered AND both stop anchors measure
 * stable (two agreeing rAF samples) — a handful of frames. The RESPONSE now
 * routinely beats that: the WebSocket channel is the primary update signal, so
 * the server's answer arrives in about one frame where the old 1-second poll
 * gave the glide its whole run for free. `runHydroMarker` then found no handle,
 * fell through its 100 ms fallback, the view committed, `endHydroMarker`
 * finalized and the layer unmounted — and the marker simply appeared on the new
 * stop, one frame, every time.
 *
 * So a lock asked for too early is REMEMBERED and handed to the director the
 * moment it registers. The director already owns the other half of the same
 * rule (`lockRequested && arriveReached`), so the glide still plays out in
 * full and the gate opens on its real landing.
 */
let pendingLock: (() => void) | undefined;
let pendingLockSafetyId = 0;
let claimed = false; // detectHydroMarker consumes the arm exactly once
let armSafetyId = 0;
let settleTimerId = 0;
/** The reward the advance grants — flown to the panel when the marker locks
 *  (the resource-transfer reward beat). Empty for a tag / VP / flow reward. */
let pendingRewards: ReadonlyArray<ResourceTransferSpec> = [];
let rewardHoldSeeded = false;
/** The traversal plan's legs (module-level: render state is the reactive
 *  cursor above; the legs themselves never change once armed). */
let planLegs: ReadonlyArray<HydroMarkerLegPlan> = [];
/** The next leg index whose rewards have NOT been seeded into the panel hold
 *  yet — ranges split at hidden-information stops (their rewards arrive in
 *  the response that answers them). */
let planSeedFrom = 0;
/** Invalidates a stale async leg loop after an abort/reset. */
let planEpoch = 0;
/** An interactive stop's own gains, flown as its CLOSING beat at resume. */
let pendingResumeWave: {position: number, transfers: ReadonlyArray<ResourceTransferSpec>} | undefined;
/** A short readable dwell on the crossed-without-reward cell (the 2 VP
 *  exclusion): pacing inside the sequence, never a business signal. */
const EXCLUDED_DWELL_MS = 420;

export function isHydroMarkerActive(): boolean {
  return hydroMarkerState.active;
}

// The glide is VISUAL from the arm itself (the marker charges at confirm —
// the client-side leg), so the whole active window holds the presentation;
// releases the instant end/abort drops `active` (lock = the GSAP signal).
registerAnimationHoldSupplier('hydro-marker', isHydroMarkerActive);

/** The director registers its handle so the controller can drive lock/skip. */
export function registerHydroMarkerHandle(h: HydroMarkerDirectorHandle | undefined): void {
  handle = h;
  // …and a lock that arrived before the glide existed is served NOW, so the
  // move the player is watching is the one the gate is waiting on.
  if (h !== undefined && pendingLock !== undefined) {
    const done = pendingLock;
    pendingLock = undefined;
    clearPendingLockSafety();
    h.lock(done);
  }
}

function clearPendingLockSafety(): void {
  if (pendingLockSafetyId !== 0) {
    clearTimeout(pendingLockSafetyId);
    pendingLockSafetyId = 0;
  }
}

/** The director reports phase transitions (charge → glide → arrive). */
export function setHydroMarkerPhase(phase: MarkerPhase): void {
  if (hydroMarkerState.active) {
    hydroMarkerState.phase = phase;
  }
}

function clearArmSafety(): void {
  if (armSafetyId !== 0) {
    clearTimeout(armSafetyId);
    armSafetyId = 0;
  }
}

/**
 * ARM (confirm modal) — start the client-side leg immediately (the marker
 * charges, lifts off `from`, glides to `to`, then hovers on arrival). Sets
 * `active` SYNCHRONOUSLY so the input gate closes at once (no double submit)
 * and the poll guard is live. A safety net aborts an advance the server never
 * confirms.
 */
export function armHydroMarker(
  fromPosition: number, toPosition: number, color: Color,
  rewards: ReadonlyArray<ResourceTransferSpec> = []): void {
  clearArmSafety();
  claimed = false;
  pendingRewards = rewards;
  rewardHoldSeeded = false;
  hydroMarkerState.active = true;
  hydroMarkerState.phase = 'charge';
  hydroMarkerState.fromPosition = fromPosition;
  hydroMarkerState.toPosition = toPosition;
  hydroMarkerState.color = color;
  hydroMarkerState.reducedMotion = consoleReducedMotionActive();
  hydroMarkerState.nonce++;
  armSafetyId = setTimeout(() => abortHydroMarker(), 10000) as unknown as number;
}

/**
 * ARM A TRAVERSAL (Delta Surge) — the multi-leg sibling of `armHydroMarker`:
 * the same synchronous input-gate close, the same transport gate on the FIRST
 * leg (the view stays held until its lock, exactly like a single-step move),
 * then `endHydroMarker` runs the remaining legs sequentially, each with its
 * own glide → lock → reward wave, pausing at every interactive stop.
 *
 * The panel hold is seeded in RANGES split at hidden-information stops: the
 * first response grants everything up to (and including) the first deck-draw
 * stop, the response answering that stop grants the next range, and so on —
 * so a held counter always describes rewards the server has actually granted.
 */
export function armHydroMarkerTraversal(
  fromPosition: number, legs: ReadonlyArray<HydroMarkerLegPlan>, color: Color): void {
  if (legs.length === 0) {
    return;
  }
  clearArmSafety();
  claimed = false;
  planLegs = legs;
  planEpoch++;
  hydroMarkerState.planCursor = 0;
  hydroMarkerState.planLength = legs.length;
  hydroMarkerState.planPaused = false;
  hydroMarkerState.visualPosition = fromPosition;
  const range = seedRangeFrom(0);
  pendingRewards = range.transfers;
  planSeedFrom = range.nextFrom;
  rewardHoldSeeded = false;
  hydroMarkerState.active = true;
  hydroMarkerState.phase = 'charge';
  hydroMarkerState.fromPosition = fromPosition;
  hydroMarkerState.toPosition = legs[0].position;
  hydroMarkerState.color = color;
  hydroMarkerState.reducedMotion = consoleReducedMotionActive();
  hydroMarkerState.nonce++;
  armSafetyId = setTimeout(() => abortHydroMarker(), 10000) as unknown as number;
}

/** The transfers granted by ONE response, starting at leg `from`: everything
 *  up to (and including) the next hidden-information stop — its own transfers
 *  are empty, and the rewards past it ride the response that answers it. */
function seedRangeFrom(from: number): {transfers: Array<ResourceTransferSpec>, nextFrom: number} {
  const transfers: Array<ResourceTransferSpec> = [];
  for (let i = from; i < planLegs.length; i++) {
    transfers.push(...planLegs[i].transfers);
    if (planLegs[i].stop === 'deck-draw') {
      return {transfers, nextFrom: i + 1};
    }
  }
  return {transfers, nextFrom: planLegs.length};
}

/**
 * Seed the PANEL REWARD HOLD for the stage's granted resources — the caller
 * MUST call this in the SAME SYNCHRONOUS BLOCK as `updatePlayerView` (via
 * WaitingFor.seedRewardHolds), never from the flight's promise chain: the
 * panel shows `committed − held`, so seeding a micro-task early flushes a
 * phantom −N chip the commit immediately undoes. Idempotent; a no-op for a
 * reward with no panel metric / reduced motion (those ride the commit).
 */
export function seedHydroMarkerRewardHold(): void {
  // A PAUSED traversal is also awaiting a seed: the response that answers its
  // interactive stop is the one carrying the next range's rewards, and it is
  // the only response that can apply while the sequence is parked (the stop's
  // prompt is the single live question of the player's own turn).
  const awaiting = hydroMarkerState.active || hydroMarkerState.planPaused;
  if (!awaiting || rewardHoldSeeded || pendingRewards.length === 0) {
    return;
  }
  if (hydroMarkerState.reducedMotion) {
    pendingRewards = [];
    return;
  }
  rewardHoldSeeded = true;
  beginPanelRewardHold(pendingRewards);
}

/** The reward beat: the granted resources emerge from the just-reached stop
 *  and pay out onto the panel — each touchdown releases its metric, firing
 *  that delta chip at the contact. Fire-and-forget; degrades honestly. */
function runHydroRewardWave(stopPosition: number, rewards: ReadonlyArray<ResourceTransferSpec>): void {
  rewardHoldSeeded = false;
  if (rewards.length === 0) {
    clearPanelRewardHold();
    return;
  }
  void runResourceTransfers({
    specs: rewards,
    source: {selectors: [`[data-hydro-marker="${stopPosition}"]`]},
    arrival: 'auto',
    onArrive: (spec) => releasePanelRewardHold(spec),
  }).then(() => {
    // Belt-and-braces: any hold a degraded transfer left snaps to truth now.
    clearPanelRewardHold();
  });
}

/**
 * DETECT (WaitingFor commit path) — is there an armed console advance to gate
 * this response behind? Returns a lightweight event exactly ONCE per arm.
 * Undefined on desktop / for every non-hydro submit (never armed).
 */
export function detectHydroMarker(): {toPosition: number} | undefined {
  if (!hydroMarkerState.active || claimed) {
    return undefined;
  }
  claimed = true;
  clearArmSafety();
  return {toPosition: hydroMarkerState.toPosition};
}

/**
 * RUN (WaitingFor await) — the server confirmed the advance: fire the final
 * LOCK-IN pulse and resolve when the marker is seated. The caller commits the
 * new view right after (delta chips fire on a marker already locked in).
 */
export function runHydroMarker(): Promise<void> {
  const promise = new Promise<void>((resolve) => {
    lockResolve = resolve;
  });
  const done = () => {
    const r = lockResolve;
    lockResolve = undefined;
    r?.();
  };
  if (handle !== undefined) {
    handle.lock(done);
  } else {
    // WAIT for the director rather than resolving past it (see `pendingLock`).
    // The safety is a BACKSTOP for the one case that genuinely has no glide —
    // no believable anchors, a stalled rAF — and is sized to the whole
    // client leg plus the lock, so it can never cut a running glide short.
    pendingLock = done;
    clearPendingLockSafety();
    const t = hydroMarkerState.reducedMotion ? reducedMarkerTimings() : markerTimings();
    pendingLockSafetyId = setTimeout(() => {
      pendingLockSafetyId = 0;
      const cb = pendingLock;
      pendingLock = undefined;
      cb?.();
    }, motionMs(arriveReadyMs(t) + t.lockMs) + 600) as unknown as number;
  }
  return promise;
}

/**
 * END (next tick, after the view committed) — the REAL marker has now
 * materialized on the new stop UNDER the locked proxy. CROSSFADE the proxy
 * out onto it (`handle.release`), and only when the fade completes CLEAR the
 * flight + fire the one-shot settle glow. Idempotent.
 *
 * A TRAVERSAL PLAN branches here: the first leg is the one the transport gate
 * held the view for; the sequence then runs the remaining legs itself.
 */
export function endHydroMarker(): void {
  clearArmSafety();
  clearPendingLockSafety();
  pendingLock = undefined;
  if (hydroMarkerState.planCursor >= 0) {
    void runTraversalLockedLeg();
    return;
  }
  const settled = hydroMarkerState.toPosition;
  const rewards = pendingRewards;
  pendingRewards = [];
  const finalize = () => {
    hydroMarkerState.active = false;
    hydroMarkerState.phase = 'idle';
    hydroMarkerState.color = '';
    handle = undefined;
    claimed = false;
    hydroMarkerState.settledPosition = settled;
    if (settleTimerId !== 0) {
      clearTimeout(settleTimerId);
    }
    settleTimerId = setTimeout(() => {
      hydroMarkerState.settledPosition = -1;
      settleTimerId = 0;
    }, 800) as unknown as number;
    // The marker has locked in — pay the reward out of the settled stop
    // (the panel showed committed − held since the commit; each touchdown
    // releases its metric so the delta chip fires at the exact contact).
    runHydroRewardWave(settled, rewards);
  };
  if (handle !== undefined) {
    handle.release(finalize);
  } else {
    finalize();
  }
}

// ── THE TRAVERSAL SEQUENCE (Delta Surge) ──────────────────────────────────

/** A LOCKED leg pays out: settle → (dwell for an excluded cell) → the cell's
 *  reward wave (awaited — the next leg never starts over a flight) → advance
 *  the cursor; then pause at a stop, finish at the end, or glide on. */
async function runTraversalLockedLeg(): Promise<void> {
  const epoch = planEpoch;
  const cursor = hydroMarkerState.planCursor;
  const leg = planLegs[cursor];
  if (leg === undefined) {
    finalizeTraversal();
    return;
  }
  // The real marker takes the cell BEFORE the proxy fades — a true handoff.
  hydroMarkerState.visualPosition = leg.position;
  markLegSettled(leg.position);
  await releaseProxy();
  if (planEpoch !== epoch) {
    return;
  }
  if (leg.excluded === true) {
    // The marker physically crossed the cell; nothing flies, the workspace
    // names the exclusion. A short readable beat, pacing only.
    await delay(motionMs(EXCLUDED_DWELL_MS));
    if (planEpoch !== epoch) {
      return;
    }
  }
  hydroMarkerState.planCursor = cursor + 1;
  if (leg.stop !== undefined) {
    // An INTERACTIVE stop's own gains fly on the way OUT, not on arrival:
    // a repeated action's rewards exist only once its whole presentation
    // (reveal, picks, the hand intake) has finished — the wave is the stop's
    // closing beat, played by the resume before the next cell.
    pendingResumeWave = leg.transfers.length > 0 ? {position: leg.position, transfers: leg.transfers} : undefined;
    pauseTraversal();
    return;
  }
  if (leg.transfers.length > 0) {
    await runLegRewardWave(leg.position, leg.transfers);
    if (planEpoch !== epoch) {
      return;
    }
  }
  if (cursor + 1 >= planLegs.length) {
    finalizeTraversal();
    return;
  }
  await startNextLeg();
}

/** Glide the next single-cell leg: the same layer/director/lock machinery the
 *  first leg used — one language, one proxy chassis, per cell. */
async function startNextLeg(): Promise<void> {
  const epoch = planEpoch;
  const leg = planLegs[hydroMarkerState.planCursor];
  if (leg === undefined) {
    finalizeTraversal();
    return;
  }
  claimed = true; // the transport gate belongs to the FIRST leg only
  hydroMarkerState.fromPosition = hydroMarkerState.visualPosition;
  hydroMarkerState.toPosition = leg.position;
  hydroMarkerState.phase = 'charge';
  hydroMarkerState.nonce++;
  await runHydroMarker();
  if (planEpoch !== epoch) {
    return;
  }
  await runTraversalLockedLeg();
}

/** Park at an interactive stop: the input gate OPENS (the player must answer
 *  the stop), the plan stands (`traversalPending` keeps the flow's close gate
 *  honest), and the NEXT response's seed carries the following reward range. */
function pauseTraversal(): void {
  hydroMarkerState.planPaused = true;
  hydroMarkerState.active = false;
  hydroMarkerState.phase = 'idle';
  const range = seedRangeFrom(planSeedFrom);
  pendingRewards = range.transfers;
  planSeedFrom = range.nextFrom;
  rewardHoldSeeded = false;
}

/**
 * RESUME (the shell) — the stop's own completion signal fired: the deck
 * pick's closing beats finished, the repeated action's follow-up chain went
 * quiet, the taken card physically landed in the dock. Never a timeout.
 * Plays the stop's own CLOSING WAVE first (a repeated action's rewards fly
 * from its cell, counters release per touchdown), then glides on.
 */
export function resumeHydroMarkerTraversal(): void {
  if (!hydroMarkerState.planPaused || hydroMarkerState.planCursor < 0) {
    return;
  }
  hydroMarkerState.planPaused = false;
  const epoch = planEpoch;
  const wave = pendingResumeWave;
  pendingResumeWave = undefined;
  void (async () => {
    if (wave !== undefined) {
      await runLegRewardWave(wave.position, wave.transfers);
      if (planEpoch !== epoch) {
        return;
      }
    }
    if (hydroMarkerState.planCursor >= planLegs.length) {
      finalizeTraversal();
      return;
    }
    hydroMarkerState.active = true;
    await startNextLeg();
  })();
}

function finalizeTraversal(): void {
  hydroMarkerState.active = false;
  hydroMarkerState.phase = 'idle';
  hydroMarkerState.color = '';
  handle = undefined;
  claimed = false;
  hydroMarkerState.planCursor = -1;
  hydroMarkerState.planLength = 0;
  hydroMarkerState.planPaused = false;
  hydroMarkerState.visualPosition = -1;
  planLegs = [];
  planSeedFrom = 0;
  pendingResumeWave = undefined;
  pendingRewards = [];
  rewardHoldSeeded = false;
  // Belt-and-braces: any hold a degraded leg left snaps to truth now.
  clearPanelRewardHold();
}

function markLegSettled(position: number): void {
  hydroMarkerState.settledPosition = position;
  if (settleTimerId !== 0) {
    clearTimeout(settleTimerId);
  }
  settleTimerId = setTimeout(() => {
    hydroMarkerState.settledPosition = -1;
    settleTimerId = 0;
  }, 800) as unknown as number;
}

function releaseProxy(): Promise<void> {
  return new Promise((resolve) => {
    const h = handle;
    handle = undefined;
    if (h !== undefined) {
      h.release(resolve);
    } else {
      resolve();
    }
  });
}

/** One leg's wave — the SAME transfer framework, awaited; holds release per
 *  touchdown and are NEVER cleared here (later legs still own theirs). */
function runLegRewardWave(stopPosition: number, rewards: ReadonlyArray<ResourceTransferSpec>): Promise<void> {
  return runResourceTransfers({
    specs: rewards,
    source: {selectors: [`[data-hydro-marker="${stopPosition}"]`]},
    arrival: 'auto',
    onArrive: (spec) => releasePanelRewardHold(spec),
  }).then(() => undefined);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A traversal plan stands (legs left, pauses included) — a term of the
 *  flow's close gate: it may only fall on the plan's own completion. */
export function hydroTraversalPending(): boolean {
  return hydroMarkerState.planCursor >= 0;
}

export function hydroTraversalPaused(): boolean {
  return hydroMarkerState.planPaused;
}

/** The presentation's own marker cursor (−1 = no plan → server truth). */
export function hydroVisualTrackPosition(): number {
  return hydroMarkerState.planCursor >= 0 ? hydroMarkerState.visualPosition : -1;
}

/**
 * ABORT (submit error / stall) — recall the marker gracefully: the director
 * dissolves the proxy, the section restores, the WaitingFor error alert (if
 * any) explains. Never a false lock-in. Idempotent.
 */
export function abortHydroMarker(): void {
  clearArmSafety();
  clearPendingLockSafety();
  if (!hydroMarkerState.active && lockResolve === undefined && pendingLock === undefined &&
      hydroMarkerState.planCursor < 0) {
    return;
  }
  // A lock still owed to a director that never arrived is answered here, or
  // the transport's gate would hold the whole view behind a dead flight.
  const owed = pendingLock;
  pendingLock = undefined;
  owed?.();
  handle?.skip();
  handle = undefined;
  claimed = false;
  hydroMarkerState.active = false;
  hydroMarkerState.phase = 'idle';
  hydroMarkerState.color = '';
  // A traversal plan dies with the abort: the loop's epoch invalidates any
  // in-flight leg, the visual cursor yields to the server truth (the section
  // renders the real position again — the recovery-net semantics).
  planEpoch++;
  planLegs = [];
  planSeedFrom = 0;
  pendingResumeWave = undefined;
  hydroMarkerState.planCursor = -1;
  hydroMarkerState.planLength = 0;
  hydroMarkerState.planPaused = false;
  hydroMarkerState.visualPosition = -1;
  pendingRewards = [];
  rewardHoldSeeded = false;
  abortResourceTransfers();
  clearPanelRewardHold();
  const r = lockResolve;
  lockResolve = undefined;
  r?.();
}

/** Test-only full reset. */
export function resetHydroMarker(): void {
  clearArmSafety();
  clearPendingLockSafety();
  pendingLock = undefined;
  if (settleTimerId !== 0) {
    clearTimeout(settleTimerId);
    settleTimerId = 0;
  }
  handle = undefined;
  lockResolve = undefined;
  claimed = false;
  pendingRewards = [];
  rewardHoldSeeded = false;
  planEpoch++;
  planLegs = [];
  planSeedFrom = 0;
  pendingResumeWave = undefined;
  hydroMarkerState.active = false;
  hydroMarkerState.phase = 'idle';
  hydroMarkerState.fromPosition = 0;
  hydroMarkerState.toPosition = 0;
  hydroMarkerState.color = '';
  hydroMarkerState.nonce = 0;
  hydroMarkerState.reducedMotion = false;
  hydroMarkerState.settledPosition = -1;
  hydroMarkerState.planCursor = -1;
  hydroMarkerState.planLength = 0;
  hydroMarkerState.planPaused = false;
  hydroMarkerState.visualPosition = -1;
}
