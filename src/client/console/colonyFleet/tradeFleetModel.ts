/*
 * TRADE FLEET MODEL — the PURE timing + trajectory maths of the console
 * colony-trade launch cinematic (no DOM, no GSAP — unit-tested under the
 * server runner).
 *
 * The launch is the console-native "send a trade fleet to the planet"
 * moment: the chosen fleet charges + lifts off the trade composer, flies a
 * confident arc over the revealed colony grid to the target colony's berth,
 * HOLDS on approach while the server confirms, then snaps into the dock —
 * and only THEN does the trade resolve (delta chips / overlay close).
 *
 * Everything here is BASE milliseconds — the director resolves every value
 * through `motionMs()` (the fork-wide speed-preset channel) when building
 * the GSAP timeline, so the whole choreography scales with `--motion-scale`.
 * Reduced motion is a SEPARATE overriding axis (`reducedFleetTimings`): a
 * short, still-legible "launch → arrive → dock" with no arc/trail.
 */

export type FleetTimings = {
  /** Pre-lift engine charge on the composer (the ship focuses + ignites). */
  chargeMs: number,
  /** Lift-off beat: the ship comes off the composer toward the grid. */
  liftMs: number,
  /** The travel arc from the launch point to the berth approach point. */
  transitMs: number,
  /** Minimum hover-on-approach before the dock may fire (pending honesty). */
  approachMinMs: number,
  /** The final dock snap into the berth. */
  dockMs: number,
  /** The colony acknowledgment glow after the dock seats. */
  ackMs: number,
};

/** Standard pacing — a rich but bounded ~1.4s launch (before any pending). */
export function fleetTimings(): FleetTimings {
  return {
    chargeMs: 240,
    liftMs: 200,
    transitMs: 620,
    approachMinMs: 160,
    dockMs: 220,
    ackMs: 280,
  };
}

/** Reduced motion: a short, honest "sent → arrived → docked" (no arc/trail). */
export function reducedFleetTimings(): FleetTimings {
  return {
    chargeMs: 40,
    liftMs: 60,
    transitMs: 180,
    approachMinMs: 40,
    dockMs: 90,
    ackMs: 120,
  };
}

/** BASE ms from launch start to the approach hold (the client-side leg). */
export function approachReadyMs(t: FleetTimings): number {
  return t.chargeMs + t.liftMs + t.transitMs;
}

/** BASE ms of the whole cinematic when the server answers instantly. */
export function fleetTotalMs(t: FleetTimings): number {
  return approachReadyMs(t) + t.approachMinMs + t.dockMs + t.ackMs;
}

export type Point = {x: number, y: number};

/**
 * The arc control point for the launch → berth travel: a quadratic bézier
 * whose control lifts the path ABOVE the straight chord (a confident orbital
 * hop, never a flat slide). The lift scales with the travel distance and is
 * biased toward the launch side so the ship climbs out first, then descends
 * onto the berth. Deterministic — no Math.random (resume/test friendly).
 */
export function launchArcControl(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  // The arc bows toward "up" (screen-negative y): a fixed fraction of the
  // travel, clamped so a very short or very long hop both read as an arc.
  const lift = Math.min(220, Math.max(70, dist * 0.32));
  const midX = from.x + dx * 0.42; // bias the apex toward the launch side
  const midY = Math.min(from.y, to.y) - lift;
  return {x: midX, y: midY};
}

/** The screen-angle (deg) of the ship at parameter t along the arc, so the
 *  hull points along its heading (nose-forward flight). */
export function arcHeadingDeg(from: Point, ctrl: Point, to: Point, t: number): number {
  // Derivative of the quadratic bézier → tangent vector.
  const tx = 2 * (1 - t) * (ctrl.x - from.x) + 2 * t * (to.x - ctrl.x);
  const ty = 2 * (1 - t) * (ctrl.y - from.y) + 2 * t * (to.y - ctrl.y);
  // The ship art points UP (−y) at 0°; atan2 gives the heading, offset so a
  // rightward tangent tilts the nose right.
  return Math.atan2(ty, tx) * (180 / Math.PI) + 90;
}
