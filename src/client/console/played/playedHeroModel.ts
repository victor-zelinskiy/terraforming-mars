/*
 * playedHeroModel — PURE, DOM-free math + vocabulary for the PLAYED-CARD HERO
 * scene: the physical flight of a just-played card out of the play-confirm
 * composer into its reserved slot inside the «Разыграно» tableau overlay.
 *
 * Design contract (the premium direction, in one paragraph): after the SERVER
 * confirms the play, the very card the player confirmed lifts off the closing
 * composer, the «Разыграно» table opens UNDER it with the +1 layout already
 * final (the slot reserved, hidden), the card travels one continuous spatial
 * arc whose apex uses the free hero area (never a full stop in the centre),
 * an EVENT card flips to its back at the apex, and the card settles into the
 * reserved slot pixel-perfect — proxy and real card swapped within one frame.
 *
 * This module owns everything unit-testable: the phase vocabulary, the arc
 * geometry (quadratic Bézier through a clamped apex), the tilt/scale/flip
 * profiles derived FROM the trajectory (never random decoration), and the
 * timing constants. The DOM/GSAP work lives in playedHeroDirector; the
 * transaction lifecycle in consolePlayedHero.
 */

export type HeroRect = {
  x: number,
  y: number,
  w: number,
  h: number,
};

/**
 * The explicit, observable lifecycle of ONE hero transaction. The commit
 * ordering rules ride these phases:
 *  - the flight NEVER starts before `flying` (server success already proven);
 *  - the playerView commit (and with it every delta-chip) happens ONLY in
 *    `committing` — after the landing frame matched the reserved slot;
 *  - follow-up decision surfaces stay held until `done`.
 */
export type PlayedHeroPhase =
  | 'idle'
  | 'armed' // confirm pressed — submit in flight, nothing visual yet
  | 'preparing' // server success proven; measuring source, opening the table
  | 'lifting' // the card separates from the composer
  | 'flying' // the hero arc (event flip rides its middle)
  | 'landing' // deceleration + settle into the reserved slot
  | 'committing' // reveal real slot, remove proxy, commit the playerView
  | 'showing-result' // the landed table breathes; delta-chips tick in
  | 'closing' // the auto-opened table closes back to the board
  | 'done'
  | 'failed'; // server error / fallback — transaction cleaned up

/** Timings (ms @ motion scale 1). The flight path stays ≈0.9–1.1 s. */
export const HERO_LIFT_MS = 150;
/** Composer close + table open overlap the lift/flight — scene, not steps. */
export const HERO_OVERLAY_SWAP_MS = 260;
export const HERO_FLIGHT_MS = 540;
export const HERO_LAND_MS = 230;
/** The quiet beat AFTER commit — the player reads the landed tableau. */
export const HERO_RESULT_PAUSE_MS = 620;
export const HERO_CLOSE_MS = 280;
/** Reduced motion: one short controlled transition (the console 160 ms cap
 *  convention), same commit semantics. Raw ms — reduced motion is its own
 *  axis, never speed-preset-scaled. */
export const HERO_REDUCED_MS = 160;
export const HERO_REDUCED_PAUSE_MS = 380;
/** The whole transaction is force-completed if anything wedges (safety). */
export const HERO_SAFETY_TIMEOUT_MS = 6000;

/** Lift scale — physical separation, not a pop (spec: ~1.03–1.07). */
export const HERO_LIFT_SCALE = 1.05;
/** Apex adds a restrained extra over the lift scale. */
export const HERO_APEX_SCALE_BOOST = 1.06;
/** Landing settle amplitude (px @ uiScale 1) — microscopic, damped. */
export const HERO_SETTLE_PX = 3;
/** The event flip occupies the MIDDLE of the arc (t-range of the flight). */
export const HERO_FLIP_START_T = 0.32;
export const HERO_FLIP_END_T = 0.82;

export function heroCenter(r: HeroRect): {x: number, y: number} {
  return {x: r.x + r.w / 2, y: r.y + r.h / 2};
}

export interface HeroPathInput {
  source: HeroRect;
  target: HeroRect;
  viewportW: number;
  viewportH: number;
  /** Top edge the arc must stay clear of (status strip / safe area), px. */
  safeTop?: number;
}

export interface HeroPathPlan {
  /** Quadratic Bézier: P0 = source centre, C = control, P1 = target centre. */
  p0: {x: number, y: number};
  c: {x: number, y: number};
  p1: {x: number, y: number};
  /** Peak roll (deg, signed by horizontal travel) — derived from the path. */
  peakTilt: number;
  /** Scale factor of the TARGET box relative to the source box. */
  targetScale: number;
  /** Scale at the arc apex (relative to the source box). */
  apexScale: number;
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Plan the hero arc. The apex composes into the free space ABOVE the pair
 * (biased a touch toward the horizontal centre — the natural hero area),
 * clamped inside the safe viewport band so the card never clips the HUD.
 * Everything is derived from the REAL measured rects — no fixed trajectory.
 */
export function planHeroPath(input: HeroPathInput): HeroPathPlan {
  const s = heroCenter(input.source);
  const t = heroCenter(input.target);
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const dist = Math.hypot(dx, dy);

  // Apex lift: proportional to travel, clamped to a calm band of the screen.
  const liftMin = input.viewportH * 0.05;
  const liftMax = input.viewportH * 0.17;
  const lift = clamp(liftMin, liftMax, dist * 0.30);

  // Apex sits above the higher endpoint, drifted 25% toward screen centre —
  // composition, not a mandatory pass through the mathematical centre.
  const apexX = s.x + dx * 0.45 + (input.viewportW / 2 - (s.x + dx * 0.45)) * 0.25;
  const rawApexY = Math.min(s.y, t.y) - lift;
  const safeTop = (input.safeTop ?? 0) + Math.max(input.source.h, input.target.h) * 0.55;
  const apexY = Math.max(safeTop, rawApexY);

  // Quadratic control point so the curve PASSES through the apex at t=0.5.
  const c = {
    x: 2 * apexX - (s.x + t.x) / 2,
    y: 2 * apexY - (s.y + t.y) / 2,
  };

  const targetScale = input.source.w > 0 ? input.target.w / input.source.w : 1;
  return {
    p0: s,
    c,
    p1: t,
    peakTilt: peakTiltFor(dx),
    targetScale,
    apexScale: Math.max(HERO_LIFT_SCALE, targetScale) * HERO_APEX_SCALE_BOOST,
  };
}

/** Point on the quadratic arc at t ∈ [0,1]. */
export function heroPoint(plan: HeroPathPlan, t: number): {x: number, y: number} {
  const u = 1 - t;
  return {
    x: u * u * plan.p0.x + 2 * u * t * plan.c.x + t * t * plan.p1.x,
    y: u * u * plan.p0.y + 2 * u * t * plan.c.y + t * t * plan.p1.y,
  };
}

/**
 * Peak roll derived from the horizontal travel: rightward flight rolls a few
 * degrees clockwise, leftward the mirror — never a random spin, never more
 * than 7°, and it fully unwinds before landing (see heroTiltAt).
 */
export function peakTiltFor(dx: number): number {
  return clamp(-7, 7, dx * 0.012);
}

/**
 * Roll along the arc: ramps in early, peaks around the apex approach
 * (t≈0.35), fully level by t≈0.85 — the landing is always square.
 */
export function heroTiltAt(t: number, peakTilt: number): number {
  if (t <= 0 || t >= 0.85) {
    return 0;
  }
  if (t < 0.35) {
    return peakTilt * (t / 0.35);
  }
  return peakTilt * (1 - (t - 0.35) / 0.5);
}

/**
 * Scale along the arc (relative to the source box): eases from the lift
 * scale up to the apex scale, then decisively down to the target scale for
 * the landing — the card reads as approaching the table, not shrinking.
 */
export function heroScaleAt(t: number, plan: HeroPathPlan): number {
  if (t <= 0.5) {
    const k = t / 0.5;
    return HERO_LIFT_SCALE + (plan.apexScale - HERO_LIFT_SCALE) * easeInOut(k);
  }
  const k = (t - 0.5) / 0.5;
  return plan.apexScale + (plan.targetScale - plan.apexScale) * easeInOut(k);
}

/** The event flip angle (deg) at flight progress t: 0 → 180 across the
 *  middle of the arc; the face/back swap happens at exactly 90°. */
export function heroFlipAt(t: number): number {
  if (t <= HERO_FLIP_START_T) {
    return 0;
  }
  if (t >= HERO_FLIP_END_T) {
    return 180;
  }
  return 180 * easeInOut((t - HERO_FLIP_START_T) / (HERO_FLIP_END_T - HERO_FLIP_START_T));
}

function easeInOut(k: number): number {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}

// ── the flight PROGRESS profile ─────────────────────────────────────────────
//
// The apex is the apex of a CONTINUOUS trajectory, never a stop: the card
// approaches briskly, glides THROUGH the top with a short cinematic slowdown
// (velocity dips, never zero), accelerates out decisively, and lands soft —
// the last ~20% of the path is markedly calmer than the cruise. Implemented
// as two monotone Hermite segments over linear time q ∈ [0,1] → path
// progress p ∈ [0,1]; GSAP drives q linearly and the director maps through
// this profile, so the WHOLE choreography (position, scale, tilt, flip)
// shares one speed curve.

/** Time share at which the arc apex (p = 0.5) is reached. */
const APEX_TIME = 0.42;
/** Path velocities (dp/dq) at the profile knots — all > 0 (no stops). */
const V_START = 0.55;
const V_APEX = 0.5;
const V_LAND = 0.06;

function hermite(p0: number, p1: number, m0: number, m1: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 +
    (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
}

/**
 * Map linear flight time q ∈ [0,1] to path progress p ∈ [0,1].
 * Monotone by construction (positive knot velocities, Fritz-Carlson safe for
 * these values — guarded by the unit test).
 */
export function heroProgressAt(q: number): number {
  const k = clamp(0, 1, q);
  if (k <= APEX_TIME) {
    const t = k / APEX_TIME;
    // Tangents are dp/dq scaled by the segment's dq span.
    return hermite(0, 0.5, V_START * APEX_TIME, V_APEX * APEX_TIME, t);
  }
  const span = 1 - APEX_TIME;
  const t = (k - APEX_TIME) / span;
  return hermite(0.5, 1, V_APEX * span, V_LAND * span, t);
}
