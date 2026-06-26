/**
 * Band geometry for the dynamic O₂ / Temperature / Venus scales.
 *
 * These three scales' DIGITS are hand-placed in globs.less (`@*-vals`), sitting
 * on the colour band baked into mars.png. To draw a CODE band that lands on the
 * same arc (covering the PNG band, with the existing digits + indicator + bonus
 * chips on top), we derive each value's ANGLE from those exact digit positions
 * rather than assuming a perfectly linear arc (the hand-tuned digits aren't).
 *
 * The VALS tables below MIRROR globs.less `@venus-vals` / `@oxygen-vals` /
 * `@temperature-vals` (value → margin-top, margin-left). Keep them in sync if
 * the globs anchors ever change. Centre + digit-box size match scaleBonusZones.
 *
 * Ocean is NOT here — it already renders fully in code (OceanArcScale.vue).
 */

import {ArcScaleName} from '@/client/components/board/arcScaleTheme';

export type Point = {x: number; y: number};

const CENTER: Point = {x: 300, y: 301};
const NUMBER_HALF = 13; // half the 26px `.global-numbers-value` box

export type ArcDigit = {value: number; angle: number; radius: number};

export type DynamicArcConfig = {
  name: ArcScaleName;
  center: Point;
  /** Centreline radius of the drawn band (covers the PNG arc). */
  bandRadius: number;
  /** Visual band thickness — generous so it covers the baked-in PNG band. */
  bandWidth: number;
  startValue: number;
  endValue: number;
  /** Clock angles (deg) of the first / last value (unwrapped, monotonic). */
  startAngle: number;
  endAngle: number;
  /** Per-value angle (deg) + measured radius, value-ascending. */
  digits: ReadonlyArray<ArcDigit>;
};

// value, margin-top, margin-left (from globs.less @*-vals)
type Val = readonly [number, number, number];

const VENUS_VALS: ReadonlyArray<Val> = [
  [0, 88, 107], [2, 72, 129], [4, 58, 150], [6, 46, 173], [8, 36, 197], [10, 28, 222],
  [12, 23, 247], [14, 20, 274], [16, 20, 301], [18, 23, 327], [20, 28, 352], [22, 36, 377],
  [24, 46, 401], [26, 58, 425], [28, 72, 446], [30, 88, 466],
];

const OXYGEN_VALS: ReadonlyArray<Val> = [
  [0, 500, 125], [1, 482, 104], [2, 460, 82], [3, 435, 64], [4, 411, 49], [5, 383, 37],
  [6, 355, 28], [7, 325, 23], [8, 295, 20], [9, 265, 21], [10, 236, 25], [11, 207, 32],
  [12, 179, 43], [13, 153, 56], [14, 128, 72],
];

const TEMPERATURE_VALS: ReadonlyArray<Val> = [
  [-30, 508, 438], [-28, 493, 458], [-26, 478, 474], [-24, 461, 490], [-22, 443, 504],
  [-20, 423, 517], [-18, 403, 528], [-16, 381, 537], [-14, 360, 544], [-12, 337, 549],
  [-10, 314, 553], [-8, 291, 554], [-6, 268, 554], [-4, 244, 551], [-2, 222, 546],
  [0, 199, 540], [2, 177, 531], [4, 156, 521], [6, 137, 509], [8, 117, 494],
];

const DEG = 180 / Math.PI;

/** Build a band config from a globs `@*-vals` table. */
function buildConfig(name: ArcScaleName, vals: ReadonlyArray<Val>, opts: {bandWidth: number; radiusOffset?: number} = {bandWidth: 34}): DynamicArcConfig {
  const sorted = [...vals].sort((a, b) => a[0] - b[0]);
  const raw = sorted.map(([value, top, left]) => {
    const cx = left + NUMBER_HALF;
    const cy = top + NUMBER_HALF;
    const angle = Math.atan2(cy - CENTER.y, cx - CENTER.x) * DEG;
    const radius = Math.hypot(cx - CENTER.x, cy - CENTER.y);
    return {value, angle, radius};
  });
  // Unwrap so consecutive angles never jump by >180° (the arc must read as a
  // monotonic sweep for the fill fraction; e.g. oxygen crosses the ±180° seam).
  for (let i = 1; i < raw.length; i++) {
    let diff = raw[i].angle - raw[i - 1].angle;
    while (diff > 180) {
      raw[i].angle -= 360;
      diff -= 360;
    }
    while (diff < -180) {
      raw[i].angle += 360;
      diff += 360;
    }
  }
  const meanRadius = raw.reduce((s, d) => s + d.radius, 0) / raw.length;
  return {
    name,
    center: CENTER,
    bandRadius: Math.round((meanRadius + (opts.radiusOffset ?? 0)) * 100) / 100,
    bandWidth: opts.bandWidth,
    startValue: raw[0].value,
    endValue: raw[raw.length - 1].value,
    startAngle: raw[0].angle,
    endAngle: raw[raw.length - 1].angle,
    digits: raw,
  };
}

/**
 * Build a config for a scale whose values are EVENLY spaced along the arc
 * (no hand-tuned digit table) — i.e. the oceans scale, which is fully code-
 * rendered. Lets OceanArcScale feed the SAME generic ArcScale band as the others.
 */
export function buildLinearArcConfig(name: ArcScaleName, opts: {
  startValue: number; endValue: number; startAngle: number; endAngle: number; radius: number; bandWidth: number;
}): DynamicArcConfig {
  const {startValue, endValue, startAngle, endAngle, radius, bandWidth} = opts;
  const span = endValue - startValue;
  const digits: Array<ArcDigit> = [];
  for (let v = startValue; v <= endValue; v++) {
    const t = span === 0 ? 0 : (v - startValue) / span;
    digits.push({value: v, angle: startAngle + t * (endAngle - startAngle), radius});
  }
  return {name, center: CENTER, bandRadius: radius, bandWidth, startValue, endValue, startAngle, endAngle, digits};
}

// Band thickness is uniform across all scales now that the bands no longer have
// to COVER a baked-in PNG arc (mars.png is planet-only) — a thin, elegant band
// matching the ocean reference (BAND_WIDTH) keeps the family consistent.
const BAND_WIDTH = 18;

export const OXYGEN_ARC = buildConfig('oxygen', OXYGEN_VALS, {bandWidth: BAND_WIDTH});
export const TEMPERATURE_ARC = buildConfig('temperature', TEMPERATURE_VALS, {bandWidth: BAND_WIDTH});
export const VENUS_ARC = buildConfig('venus', VENUS_VALS, {bandWidth: BAND_WIDTH});
// Oceans — evenly spaced 1–9 across the free bottom window (matches the values
// OceanArcScale has used since the pilot). Same band as the others.
export const OCEAN_ARC = buildLinearArcConfig('oceans', {
  startValue: 1, endValue: 9, startAngle: 116, endAngle: 64, radius: 264, bandWidth: BAND_WIDTH,
});

/** Angle (deg) of a value, or the nearest tick's angle when between ticks. */
export function arcAngleForValue(config: DynamicArcConfig, value: number): number {
  let best = config.digits[0];
  let bestD = Infinity;
  for (const d of config.digits) {
    const dd = Math.abs(d.value - value);
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best.angle;
}

/** Progress fraction (0..1) from the scale start up to `value`. */
export function arcFillFraction(config: DynamicArcConfig, value: number): number {
  const span = config.endAngle - config.startAngle;
  if (span === 0) {
    return 0;
  }
  const f = (arcAngleForValue(config, value) - config.startAngle) / span;
  return Math.max(0, Math.min(1, f));
}
