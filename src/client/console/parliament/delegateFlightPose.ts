import {MOTION_EASE} from '@/client/components/motion/motionTokens';
import {cubicBezierFromCss} from '@/client/components/motion/cubicBezier';

/**
 * THE DELEGATE'S FLIGHT, AS PHYSICS — «взял → понёс → поставил» (pure; the
 * DOM half is `runDelegateFlight` in `consoleParliamentVoteMotion.ts`).
 *
 * A delegate is a STANDEE carried by a hand, never a die thrown across the
 * table. Three beats on ONE progress, each on the motion system's own curve:
 *   · TAKEN (`MOTION_EASE.enter`) — the figure rises off its footprint and
 *     comes toward the camera (×1.35), leaning 8–12° INTO the way it is about
 *     to go; its SHADOW stays on the table and pales and spreads with height;
 *   · CARRIED (`MOTION_EASE.convey`) — the base travels the straight line
 *     between the two footprints (the shadow rides that line on the table),
 *     the body rides an ARC over it; the lean holds; NO SPIN;
 *   · SET DOWN (the gravity of `MOTION_EASE.exit`, the lean resolving on
 *     `MOTION_EASE.settle`) — the body comes down onto its base, the lean
 *     straightens, the shadow gathers under the disc; the TOUCHDOWN is the
 *     frame the two meet: every lift, lean, growth and air is exactly zero
 *     there, so the proxy is pixel-identical to the figure that materializes
 *     under it.
 * Positions are the figures' BASE points (the centre of the bottom edge) —
 * a figure stands on its base, it is never centred in a box.
 */

export type FlightPoint = {x: number, y: number};

export type DelegateFlightPlan = {
  /** The source figure's base point and height (screen px). */
  from: FlightPoint;
  fromHeight: number;
  /** The destination footprint's base point and the height the figure will stand at there. */
  to: FlightPoint;
  toHeight: number;
  /** Whole flight (ms, already through the motion clock). */
  durationMs: number;
  /** The beats as fractions of the progress: the lift ends at `liftEnd`, the descent starts at `dropStart`. */
  liftEnd: number;
  dropStart: number;
  /** Screen px the body rises above its base at the top of the lift. */
  liftPx: number;
  /** Screen px of extra arc over the straight line, at the carry's middle. */
  arcPx: number;
  /** Signed lean (deg) the figure carries — into the travel's direction. */
  tiltDeg: number;
};

export type DelegateFlightPose = {
  /** The base point ON THE TABLE — where the root (and with it the shadow) stands. */
  ground: FlightPoint;
  /** The root's scale (the figure's height over the proxy's own). */
  scale: number;
  /** The body's height above its base (screen px; the root's scale is the caller's to divide by). */
  liftPx: number;
  /** The body's lean (deg). */
  tiltDeg: number;
  /** The body's growth toward the camera (1 at rest). */
  grow: number;
  /** The shadow's «how high is the body» (0 on the table → 1 at the top of the lift). */
  air: number;
  /** The travel's own progress (0 → 1) — the source has visibly been left past a fraction of it. */
  travel: number;
};

/** The figure grows toward the camera at the top of its lift — a standee is already tall; never the cube's ×1.55. */
export const FIGURE_LIFT_GROW = 1.35;
/** The lean a carried figure keeps (deg, into the travel). */
export const FIGURE_TILT_DEG = 10;
/** The beats' base lengths (ms) and the carry's distance pace. */
export const FIGURE_LIFT_MS = 140;
export const FIGURE_LAND_MS = 160;
export const FIGURE_CARRY_MIN_MS = 380;
export const FIGURE_CARRY_MAX_MS = 620;
const FIGURE_CARRY_PER_PX = 0.24;

/** The whole flight over `distancePx` (base ms): a quick take, a carry paced by the distance, a set-down. */
export function delegateFlightMs(distancePx: number): number {
  const carry = Math.min(FIGURE_CARRY_MAX_MS, Math.max(FIGURE_CARRY_MIN_MS, FIGURE_CARRY_MIN_MS + distancePx * FIGURE_CARRY_PER_PX));
  return Math.round(FIGURE_LIFT_MS + carry + FIGURE_LAND_MS);
}

const curve = (css: string, fallback: (t: number) => number): ((t: number) => number) => cubicBezierFromCss(css) ?? fallback;
const enter = curve(MOTION_EASE.enter, (t) => 1 - Math.pow(1 - t, 3));
const convey = curve(MOTION_EASE.convey, (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2));
const gravity = curve(MOTION_EASE.exit, (t) => t * t);
const settle = curve(MOTION_EASE.settle, (t) => 1 - Math.pow(1 - t, 3));
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * The plan of one flight between two figures (their BASE points and heights).
 * `durationMs` fixed by the caller keeps its own rhythm (the sitting's cubes
 * share one tempo); otherwise the distance paces it. The beats keep their base
 * proportions inside whatever length the flight is given.
 */
export function planDelegateFlight(args: {
  from: FlightPoint, fromHeight: number, to: FlightPoint, toHeight: number,
  /** The flight's length, already through the motion clock (ms). */
  durationMs: number,
  /** One logical px at the profile's scale (the floor of the lift and the cap of the arc). */
  unitPx: number,
}): DelegateFlightPlan {
  const {from, to} = args;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const total = FIGURE_LIFT_MS + FIGURE_LAND_MS + Math.min(FIGURE_CARRY_MAX_MS, Math.max(FIGURE_CARRY_MIN_MS, FIGURE_CARRY_MIN_MS + dist * FIGURE_CARRY_PER_PX));
  const liftEnd = FIGURE_LIFT_MS / total;
  const dropStart = 1 - FIGURE_LAND_MS / total;
  const height = Math.max(args.fromHeight, args.toHeight);
  // The lean follows the travel's HORIZONTAL share: a figure carried sideways leans fully, one lifted straight up
  // the column barely leans (a hand does not tip what it raises). Never less than a hair in the travel's sense.
  const share = dist < 1 ? 0 : Math.abs(dx) / dist;
  const sign = dx >= 0 ? 1 : -1;
  return {
    from, fromHeight: args.fromHeight, to, toHeight: args.toHeight,
    durationMs: args.durationMs,
    liftEnd,
    dropStart,
    liftPx: Math.max(10 * args.unitPx, height * 0.75),
    arcPx: Math.min(Math.max(dist * 0.16, height * 0.4), 90 * args.unitPx),
    tiltDeg: sign * FIGURE_TILT_DEG * Math.max(0.35, share),
  };
}

/** The pose at progress `p` (0 → 1). At `p = 1` everything is at rest on the destination. */
export function delegateFlightPose(plan: DelegateFlightPlan, p: number, proxyHeight: number): DelegateFlightPose {
  const q = clamp01(p);
  const {liftEnd, dropStart} = plan;
  // THE TRAVEL — overlaps the two vertical beats: the figure starts across as it rises and is over its footprint as
  // it comes down (a carried thing never moves in three separate straight lines).
  const travelFrom = liftEnd * 0.5;
  const travelTo = dropStart + (1 - dropStart) * 0.4;
  const travel = convey(clamp01((q - travelFrom) / (travelTo - travelFrom)));
  // THE HEIGHT — taken (enter), held, set down (gravity), plus the arc over the line during the carry.
  let rise: number;
  let lean: number;
  if (q < liftEnd) {
    rise = enter(q / liftEnd);
    lean = enter(q / liftEnd);
  } else if (q < dropStart) {
    rise = 1;
    lean = 1;
  } else {
    const d = (q - dropStart) / (1 - dropStart);
    rise = 1 - gravity(d);
    lean = 1 - settle(d);
  }
  if (q >= 1) {
    rise = 0;
    lean = 0;
  }
  const arc = Math.sin(travel * Math.PI) * plan.arcPx * (q >= 1 ? 0 : 1);
  const liftPx = rise * plan.liftPx + arc;
  const height = plan.fromHeight + (plan.toHeight - plan.fromHeight) * travel;
  return {
    ground: {x: plan.from.x + (plan.to.x - plan.from.x) * travel, y: plan.from.y + (plan.to.y - plan.from.y) * travel},
    scale: height / Math.max(1, proxyHeight),
    liftPx,
    tiltDeg: plan.tiltDeg * lean,
    grow: 1 + (FIGURE_LIFT_GROW - 1) * rise,
    air: clamp01(liftPx / Math.max(1, plan.liftPx + plan.arcPx)),
    travel,
  };
}
