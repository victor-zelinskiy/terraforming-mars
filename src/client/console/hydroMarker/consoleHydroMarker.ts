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
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import type {HydroMarkerDirectorHandle} from '@/client/console/hydroMarker/hydroMarkerDirector';

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
});

let handle: HydroMarkerDirectorHandle | undefined;
let lockResolve: (() => void) | undefined;
let claimed = false; // detectHydroMarker consumes the arm exactly once
let armSafetyId = 0;
let settleTimerId = 0;

export function isHydroMarkerActive(): boolean {
  return hydroMarkerState.active;
}

/** The director registers its handle so the controller can drive lock/skip. */
export function registerHydroMarkerHandle(h: HydroMarkerDirectorHandle | undefined): void {
  handle = h;
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
export function armHydroMarker(fromPosition: number, toPosition: number, color: Color): void {
  clearArmSafety();
  claimed = false;
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
    setTimeout(done, hydroMarkerState.reducedMotion ? 0 : 100);
  }
  return promise;
}

/**
 * END (next tick, after the view committed) — the REAL marker has now
 * materialized on the new stop UNDER the locked proxy. CROSSFADE the proxy
 * out onto it (`handle.release`), and only when the fade completes CLEAR the
 * flight + fire the one-shot settle glow. Idempotent.
 */
export function endHydroMarker(): void {
  clearArmSafety();
  const settled = hydroMarkerState.toPosition;
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
  };
  if (handle !== undefined) {
    handle.release(finalize);
  } else {
    finalize();
  }
}

/**
 * ABORT (submit error / stall) — recall the marker gracefully: the director
 * dissolves the proxy, the section restores, the WaitingFor error alert (if
 * any) explains. Never a false lock-in. Idempotent.
 */
export function abortHydroMarker(): void {
  clearArmSafety();
  if (!hydroMarkerState.active && lockResolve === undefined) {
    return;
  }
  handle?.skip();
  handle = undefined;
  claimed = false;
  hydroMarkerState.active = false;
  hydroMarkerState.phase = 'idle';
  hydroMarkerState.color = '';
  const r = lockResolve;
  lockResolve = undefined;
  r?.();
}

/** Test-only full reset. */
export function resetHydroMarker(): void {
  clearArmSafety();
  if (settleTimerId !== 0) {
    clearTimeout(settleTimerId);
    settleTimerId = 0;
  }
  handle = undefined;
  lockResolve = undefined;
  claimed = false;
  hydroMarkerState.active = false;
  hydroMarkerState.phase = 'idle';
  hydroMarkerState.fromPosition = 0;
  hydroMarkerState.toPosition = 0;
  hydroMarkerState.color = '';
  hydroMarkerState.nonce = 0;
  hydroMarkerState.reducedMotion = false;
  hydroMarkerState.settledPosition = -1;
}
