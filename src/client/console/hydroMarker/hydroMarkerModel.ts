/*
 * HYDRO MARKER MODEL — the PURE timing plan of the console hydronetwork
 * marker-advance micro-interaction (no DOM, no GSAP — unit-tested under the
 * server runner).
 *
 * The hydro action is NOT a card reveal or a ship flight — its object is a
 * MARKER/TOKEN on an engineering track. So the motion is simpler, cleaner,
 * more "instrument": the confirmed marker CHARGES, lifts off its stop,
 * GLIDES along the rail to the new stop, and LOCKS IN — and only then do the
 * action's consequences (delta chips / resources) apply. Deliberately less
 * theatrical than the trade fleet.
 *
 * BASE milliseconds — the director resolves every value through `motionMs()`
 * (the speed-preset channel). Reduced motion is a SEPARATE overriding axis
 * (`reducedMarkerTimings`): a short, still-legible "old → new → locked".
 */

export type MarkerTimings = {
  /** Pre-move charge on the old stop (the marker focuses, the route lights). */
  chargeMs: number,
  /** Lift-off: the marker comes off the rail. */
  liftMs: number,
  /** The glide along the rail from the old stop to the new stop. */
  glideMs: number,
  /** Minimum hover on arrival before the lock may fire (pending honesty). */
  arriveMinMs: number,
  /** The lock-in snap onto the new stop. */
  lockMs: number,
  /** The confirmation pulse after the lock seats. */
  pulseMs: number,
};

/** Standard pacing — a crisp ~1s advance (before any server pending). */
export function markerTimings(): MarkerTimings {
  return {
    chargeMs: 180,
    liftMs: 130,
    glideMs: 380,
    arriveMinMs: 120,
    lockMs: 160,
    pulseMs: 220,
  };
}

/** Reduced motion: a short, honest "old → new → locked" (no lift/charge). */
export function reducedMarkerTimings(): MarkerTimings {
  return {
    chargeMs: 30,
    liftMs: 40,
    glideMs: 160,
    arriveMinMs: 40,
    lockMs: 70,
    pulseMs: 100,
  };
}

/** BASE ms from the move start to the arrival hold (the client-side leg). */
export function arriveReadyMs(t: MarkerTimings): number {
  return t.chargeMs + t.liftMs + t.glideMs;
}

/** BASE ms of the whole micro-interaction when the server answers instantly. */
export function markerTotalMs(t: MarkerTimings): number {
  return arriveReadyMs(t) + t.arriveMinMs + t.lockMs + t.pulseMs;
}
