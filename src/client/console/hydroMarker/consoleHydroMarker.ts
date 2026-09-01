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
import {CardName} from '@/common/cards/CardName';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {Color} from '@/common/Color';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {
  HydroStepLedger, hydroActiveStepSource, hydroStepOwnerPosition, hydroStepQueued, revealSourceCard,
} from '@/client/console/hydroMarker/hydroStepAdmission';
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
  /**
   * THE CELL THE SEQUENCE IS PARKED ON — the step that currently OWNS the
   * scene, or −1 while the marker is walking. Distinct from `visualPosition`
   * (which keeps naming the last settled cell all through the next glide's
   * charge frames): only a step that has opened its stop may present a child
   * surface or show its source card. Written by `pauseTraversal`, cleared by
   * the resume.
   */
  parkedAt: number;
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
  parkedAt: -1,
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
  /**
   * THE CARD THIS STEP REPEATS (a `repeat` stop's pre-selected pick). It is
   * the step's OWNERSHIP KEY: the server attributes every surface the copied
   * action raises to this same `CardName`, so the admission gate can tell «this
   * batch belongs to a stage the marker has not reached» from «this batch is
   * the current stop's own content» — structurally, never by prompt text.
   * See `hydroStepAdmission`.
   */
  sourceCard?: CardName;
  /**
   * ── THE MULTI-ACTOR EXTENSION (Corporate Espionage) ─────────────────────
   * A leg that moves ANOTHER PLAYER's marker: `color` is that token's own
   * colour (absent = the plan's base colour, the viewer), `fromOverride` its
   * real departure cell (a foreign token does not start where the viewer's
   * visual cursor stands), and `foreign` keeps the leg out of everything that
   * belongs to the VIEWER's walk — the visual cursor, the activation ledger.
   * `beatMs` is a readable HANDOFF dwell after the leg settles (the pause
   * between the target's retreat and the owner's advance — short, never a
   * dramatic hold).
   */
  color?: Color;
  fromOverride?: number;
  foreign?: true;
  beatMs?: number;
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
/** The plan's base gliding-token colour (the viewer) — a leg's own `color`
 *  overrides it for exactly that leg (a foreign marker's hop). */
let planBaseColor: Color | '' = '';
/** The next leg index whose rewards have NOT been seeded into the panel hold
 *  yet — ranges split at hidden-information stops (their rewards arrive in
 *  the response that answers them). */
let planSeedFrom = 0;
/** Invalidates a stale async leg loop after an abort/reset. */
let planEpoch = 0;
/** An interactive stop's own gains, flown as its CLOSING beat at resume. */
let pendingResumeWave: {position: number, transfers: ReadonlyArray<ResourceTransferSpec>} | undefined;

/*
 * ── THE ACTIVATION LEDGER (the stage-bound execution contract) ─────────────
 *
 * `activatedSteps` is the set of cells whose leg has ARRIVED AND SETTLED. It is
 * the ONE fact the admission gate reads (`hydroStepAdmission`), and it is
 * written in exactly one place — the locked leg's handoff from the glide proxy
 * to the real marker. Reactive, because the shell's presentation predicates are
 * computeds: a `Set` mutated inside `reactive()` tracks its own membership, so
 * an admission that flips when the marker lands re-renders on that landing and
 * on nothing else.
 *
 * WHY A SET AND NOT `visualPosition`: activation only ever HARDENS. A step's
 * own surfaces (its drawn batch, its follow-up) must keep presenting while the
 * sequence walks on — a batch yanked off the scene because the marker moved is
 * the same defect in the other direction.
 */
const activationLedger = reactive({
  activated: new Set<number>(),
  /** Bumped on every ledger write — the computeds' dependency handle. */
  rev: 0,
});

/**
 * THE ORDERED EVENT TRACE — opt-in, bounded, silent.
 *
 * The stage-bound contract is a statement about ORDER («the copied action's
 * batch mounts strictly after the marker settled on its cell»), and order is
 * exactly what a final-state assertion cannot see. Tests turn this on and read
 * the sequence back; production never allocates (the recorder returns on a
 * `false` flag) and nothing is ever logged.
 */
let traceOn = false;
let trace: Array<string> = [];

/**
 * THE GATE'S OWN LIVENESS NET — a recovery, never a mechanism.
 *
 * The gate holds a future step's surfaces off screen, and its release is the
 * walk's own progress: an activation, a stop opening, a stop resolving. That is
 * a completion signal and not a timer, which is exactly right — but it means a
 * sequence that STALLS (a killed tween whose `onComplete` never fires, a
 * director that never registers) would hold a real, answerable batch invisible
 * for the rest of the session. An invisible prompt is a soft-lock, and the one
 * defect worse than showing a batch at the wrong moment is never showing it.
 *
 * So the plan carries a progress deadline: every real advance re-arms it, and
 * only a plan that has stopped advancing altogether trips it — into the module's
 * existing `abortHydroMarker`, which drops the plan, yields the visual cursor to
 * the server's truth and opens the gate by construction (`planLegs` is what
 * makes a source owned). Generous on purpose: it must never be reachable by a
 * slow machine, only by a dead sequence.
 */
const PLAN_PROGRESS_MAX_MS = 30_000;
let planProgressId = 0;

function armPlanProgressNet(): void {
  clearPlanProgressNet();
  planProgressId = setTimeout(() => {
    planProgressId = 0;
    recordHydroStepEvent('traversal:stalled');
    abortHydroMarker();
  }, PLAN_PROGRESS_MAX_MS) as unknown as number;
}

function clearPlanProgressNet(): void {
  if (planProgressId !== 0) {
    clearTimeout(planProgressId);
    planProgressId = 0;
  }
}

export function enableHydroStepTrace(on: boolean): void {
  traceOn = on;
  trace = [];
}

export function hydroStepTrace(): ReadonlyArray<string> {
  return trace;
}

export function recordHydroStepEvent(event: string): void {
  if (traceOn) {
    trace.push(event);
  }
}

/*
 * ── THE PRESENTED TARGET CARD'S OWN LIFECYCLE (pos 9) ─────────────────────
 *
 * The stage-9 reward lands ON a card the section physically stands on stage,
 * and that card's presence must span the WHOLE payout: mounted at the
 * marker's arrival (never during the glide TOWARDS the cell), standing for
 * every chip's flight and impact, and released only once its leave motion has
 * finished — the next leg may not start over a face that is still saying
 * goodbye, and a chip may never fly at a slot that has already unmounted.
 *
 * The section REPORTS presence (`noteHydroLandPresence`: the card-land block
 * mounted / finished its leave); the sequence AWAITS absence
 * (`awaitHydroLandExit`) after the wave, before the cursor moves on. A card
 * that never presented (collapsed workspace, reduced screen) resolves at
 * once — the wait is keyed on REPORTED presence, never on a guess about the
 * DOM. Aborts resolve the waiter (the epoch guard stops the sequence).
 */
const landPresence = new Set<number>();
let landExitWaiter: {position: number, resolve: () => void} | undefined;

/** The section's card-land block for `position` is on stage (true) or has
 *  fully left — its leave transition ENDED (false). */
export function noteHydroLandPresence(position: number, on: boolean): void {
  if (on) {
    landPresence.add(position);
    return;
  }
  landPresence.delete(position);
  if (landExitWaiter !== undefined && landExitWaiter.position === position) {
    const w = landExitWaiter;
    landExitWaiter = undefined;
    w.resolve();
  }
}

/** Resolve when the presented card of `position` has fully LEFT the stage —
 *  immediately when it never presented. One waiter at a time by construction
 *  (the sequence is serial). */
function awaitHydroLandExit(position: number): Promise<void> {
  if (!landPresence.has(position)) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    landExitWaiter = {position, resolve};
  });
}

function resolveLandExitWaiter(): void {
  const w = landExitWaiter;
  landExitWaiter = undefined;
  landPresence.clear();
  w?.resolve();
}
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
  planBaseColor = color;
  planEpoch++;
  // A NEW PLAN OWNS NOTHING YET. The ledger is emptied here and nowhere else
  // in the happy path: every step of this traversal must earn its activation
  // by physically arriving, including one that repeats a card the PREVIOUS
  // traversal already activated.
  activationLedger.activated.clear();
  activationLedger.rev++;
  hydroMarkerState.planCursor = 0;
  hydroMarkerState.planLength = legs.length;
  hydroMarkerState.planPaused = false;
  hydroMarkerState.parkedAt = -1;
  hydroMarkerState.visualPosition = fromPosition;
  const firstFrom = legs[0].fromOverride ?? fromPosition;
  recordHydroStepEvent(`move:${firstFrom}-${legs[0].position}:start`);
  const range = seedRangeFrom(0);
  pendingRewards = range.transfers;
  planSeedFrom = range.nextFrom;
  rewardHoldSeeded = false;
  hydroMarkerState.active = true;
  hydroMarkerState.phase = 'charge';
  hydroMarkerState.fromPosition = firstFrom;
  hydroMarkerState.toPosition = legs[0].position;
  hydroMarkerState.color = legs[0].color ?? color;
  hydroMarkerState.reducedMotion = consoleReducedMotionActive();
  hydroMarkerState.nonce++;
  armSafetyId = setTimeout(() => abortHydroMarker(), 10000) as unknown as number;
  armPlanProgressNet();
}

/** The transfers granted by ONE response, starting at leg `from`: everything
 *  up to (and including) the next hidden-information stop — its own transfers
 *  are empty, and the rewards past it ride the response that answers it. */
function seedRangeFrom(from: number): {transfers: Array<ResourceTransferSpec>, nextFrom: number} {
  const transfers: Array<ResourceTransferSpec> = [];
  for (let i = from; i < planLegs.length; i++) {
    transfers.push(...planLegs[i].transfers);
    // A `prompt` stop splits the range for the same reason a deck stop does:
    // everything past it is granted only by the response that ANSWERS it (an
    // espionage target's own decision) — a hold seeded earlier would describe
    // rewards the server has not committed.
    if (planLegs[i].stop === 'deck-draw' || planLegs[i].stop === 'prompt') {
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
  // A FOREIGN leg (another player's marker) never moves the VIEWER's visual
  // cursor: their token's landing is the server view's own truth (already
  // applied under the release), while the viewer's marker stays parked where
  // the plan's base cursor holds it.
  if (leg.foreign !== true) {
    hydroMarkerState.visualPosition = leg.position;
  }
  markLegSettled(leg.position);
  await releaseProxy();
  if (planEpoch !== epoch) {
    return;
  }
  // ── ARRIVED AND SETTLED — the step's ACTIVATION, and the only place it is
  //    written. Everything this cell's reward produces becomes admissible from
  //    this line and not one frame earlier: the token has physically taken the
  //    cell and the glide proxy has handed over. A cell can never be activated
  //    twice (a Set), and the sequence is serial by construction. A FOREIGN
  //    leg activates nothing — the ledger describes the VIEWER's walk.
  if (leg.foreign !== true) {
    activationLedger.activated.add(leg.position);
    activationLedger.rev++;
  }
  armPlanProgressNet();
  recordHydroStepEvent(`stage:${leg.position}:arrivedAndSettled`);
  // The READABLE HANDOFF between two actors' moves — a short beat, pacing
  // only, after the leg has fully settled.
  if (leg.beatMs !== undefined && leg.beatMs > 0) {
    await delay(motionMs(leg.beatMs));
    if (planEpoch !== epoch) {
      return;
    }
  }
  if (leg.excluded === true) {
    // The marker physically crossed the cell; nothing flies, the workspace
    // names the exclusion. A short readable beat, pacing only.
    await delay(motionMs(EXCLUDED_DWELL_MS));
    if (planEpoch !== epoch) {
      return;
    }
  }
  if (leg.stop !== undefined) {
    // An INTERACTIVE stop's own gains fly on the way OUT, not on arrival:
    // a repeated action's rewards exist only once its whole presentation
    // (reveal, picks, the hand intake) has finished — the wave is the stop's
    // closing beat, played by the resume before the next cell.
    pendingResumeWave = leg.transfers.length > 0 ? {position: leg.position, transfers: leg.transfers} : undefined;
    hydroMarkerState.planCursor = cursor + 1;
    pauseTraversal(leg.position);
    return;
  }
  // THE CELL'S OWN PAYOUT PLAYS WITH THE CURSOR STILL ON THE CELL. The cursor
  // is what the section presents from (the current-segment card of pos 9, the
  // lit traversal chip), so advancing it first unmounted the very face the
  // chips were flying at — the animals landed on a detached rect while the
  // scene already narrated the next cell. Order is the contract: settle →
  // wave (each impact awaited by the run itself) → the presented card's full
  // EXIT → only then the cursor, and with it the next leg.
  if (leg.transfers.length > 0) {
    await runLegRewardWave(leg.position, leg.transfers);
    if (planEpoch !== epoch) {
      return;
    }
  }
  hydroMarkerState.planCursor = cursor + 1;
  await awaitHydroLandExit(leg.position);
  if (planEpoch !== epoch) {
    return;
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
  hydroMarkerState.fromPosition = leg.fromOverride ?? hydroMarkerState.visualPosition;
  hydroMarkerState.toPosition = leg.position;
  hydroMarkerState.color = leg.color ?? planBaseColor;
  recordHydroStepEvent(`move:${hydroMarkerState.fromPosition}-${leg.position}:start`);
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
function pauseTraversal(position: number): void {
  hydroMarkerState.planPaused = true;
  // The parked cell is what the STOP owns: its own surfaces are admitted, and
  // its source card is the one the workspace stands beside them.
  hydroMarkerState.parkedAt = position;
  hydroMarkerState.active = false;
  hydroMarkerState.phase = 'idle';
  // A parked plan is waiting on the PLAYER — and a player may take as long as
  // they like. The net covers the sequence's own motion, never a decision.
  clearPlanProgressNet();
  recordHydroStepEvent(`stage:${position}:stopOpened`);
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
  armPlanProgressNet();
  recordHydroStepEvent(`stage:${hydroMarkerState.parkedAt}:presentationComplete`);
  hydroMarkerState.parkedAt = -1;
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
  hydroMarkerState.parkedAt = -1;
  hydroMarkerState.visualPosition = -1;
  clearPlanProgressNet();
  recordHydroStepEvent('traversal:complete');
  // ⚠️ THE LEDGER OUTLIVES THE PLAN, deliberately. `planLegs` is what makes a
  // source «owned» at all, and it is cleared right here — so the gate falls
  // open by construction the moment the walk ends, and a surface still on
  // screen is never re-queued by its own plan finishing under it.
  planLegs = [];
  planSeedFrom = 0;
  pendingResumeWave = undefined;
  pendingRewards = [];
  rewardHoldSeeded = false;
  // Belt-and-braces: any hold a degraded leg left snaps to truth now.
  clearPanelRewardHold();
  planBaseColor = '';
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

// ── THE ACTIVATION GATE, as the shell asks it ─────────────────────────────

/** The ledger the pure decisions read (see `hydroStepAdmission`). */
function stepLedger(): HydroStepLedger {
  // `rev` is touched so a computed reading this tracks the Set's mutations
  // (a `Set` inside `reactive()` tracks membership, but a caller that only
  // ever asks `has()` for a MISSING key would otherwise not re-run on the add).
  void activationLedger.rev;
  return {
    steps: planLegs,
    activated: activationLedger.activated,
    parkedAt: hydroMarkerState.parkedAt,
  };
}

/**
 * THE ONE PREDICATE THE SHELL ASKS: is this surface owned by a traversal step
 * the marker has not physically reached? A queued surface may not present, may
 * not take focus, and may not be counted as the current stop's live follow-up.
 *
 * Takes either the server's reveal source or a bare `CardName` (a prompt's
 * `choiceContext` source), so the drawn batch, the target pick and the resource
 * placement of one copied action are all judged by the same rule.
 */
export function hydroStepQueuedFor(
  source: CardDrawRevealSource | CardName | undefined): boolean {
  const card = typeof source === 'string' ? source as CardName :
    revealSourceCard(source);
  return hydroStepQueued(stepLedger(), card);
}

/** The cell that owes this surface, or −1 — the diagnostic form of the gate. */
export function hydroStepOwnerFor(
  source: CardDrawRevealSource | CardName | undefined): number {
  const card = typeof source === 'string' ? source as CardName :
    revealSourceCard(source);
  return hydroStepOwnerPosition(stepLedger(), card);
}

/**
 * THE SOURCE CARD OF THE ACTIVE STEP — the card whose action the stage the
 * marker is standing on repeats. This is what the workspace shows beside the
 * copied action's own prompt («ИСТОЧНИК · Центр ИИ»), and it exists exactly
 * while that step owns the scene.
 */
export function hydroActiveStepSourceCard(): CardName | undefined {
  return hydroActiveStepSource(stepLedger());
}

/** A step's cell has ARRIVED AND SETTLED — the activation ledger, read. */
export function hydroStepActivated(position: number): boolean {
  void activationLedger.rev;
  return activationLedger.activated.has(position);
}

export function hydroTraversalPaused(): boolean {
  return hydroMarkerState.planPaused;
}

/**
 * THE PLAN IS PARKED ON A FOREIGN ACTOR'S PROMPT STOP (Corporate Espionage:
 * the target's own interactive landing reward) — the actor's flow waits for a
 * decision that is not theirs, and the shell resumes it on the SERVER's own
 * evidence (the owner's committed position), never a timeout.
 */
export function hydroParkedForeignStop(): boolean {
  if (!hydroMarkerState.planPaused) {
    return false;
  }
  const parked = planLegs.find((l) => l.position === hydroMarkerState.parkedAt);
  return parked?.foreign === true && parked.stop === 'prompt';
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
  planBaseColor = '';
  planSeedFrom = 0;
  pendingResumeWave = undefined;
  hydroMarkerState.planCursor = -1;
  hydroMarkerState.planLength = 0;
  hydroMarkerState.planPaused = false;
  hydroMarkerState.parkedAt = -1;
  hydroMarkerState.visualPosition = -1;
  // The gate is OPEN after an abort by construction (`planLegs` is what makes a
  // source owned), but the ledger is cleared too so a later plan cannot inherit
  // an activation this one earned.
  activationLedger.activated.clear();
  activationLedger.rev++;
  clearPlanProgressNet();
  recordHydroStepEvent('traversal:abort');
  pendingRewards = [];
  rewardHoldSeeded = false;
  resolveLandExitWaiter();
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
  clearPlanProgressNet();
  pendingLock = undefined;
  resolveLandExitWaiter();
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
  planBaseColor = '';
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
  hydroMarkerState.parkedAt = -1;
  hydroMarkerState.visualPosition = -1;
  activationLedger.activated.clear();
  activationLedger.rev++;
  trace = [];
}
