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

// Band thickness — a slim sci-fi PANEL (not a line): wide enough that the 19px
// digits sit comfortably INSIDE the rail (especially on the vertical O₂ /
// temperature arcs, where a thinner band left the numbers perched on the edge),
// but not the heavy old PNG arc. Radial only — doesn't change angular gaps.
const BAND_WIDTH = 22;

export const OXYGEN_ARC = buildConfig('oxygen', OXYGEN_VALS, {bandWidth: BAND_WIDTH});
export const TEMPERATURE_ARC = buildConfig('temperature', TEMPERATURE_VALS, {bandWidth: BAND_WIDTH});
export const VENUS_ARC = buildConfig('venus', VENUS_VALS, {bandWidth: BAND_WIDTH});
// Oceans — evenly spaced 1–9 across the free bottom window (matches the values
// OceanArcScale has used since the pilot). Same band as the others.
// radius 264: aligned with the BOTTOM ends of the side arcs — oxygen's value-0
// and temperature's -30 both sit at radius ~267 from the (300,301) centre — so
// the ocean arc reads as a concentric continuation of the same ring rather than
// a smaller inner arc. (It was temporarily pulled in to 242 to free vertical
// room while the board scale was being raised; with the board now centred on the
// planet disc and using the full height, the bottom has room for it again.)
// MUST match OceanArcScale.vue `RADIUS`.
export const OCEAN_ARC = buildLinearArcConfig('oceans', {
  startValue: 1, endValue: 9, startAngle: 116, endAngle: 64, radius: 264, bandWidth: BAND_WIDTH,
});

/**
 * A band whose values are EVENLY spaced by INDEX along a circle of its own (a value list, not a 1-step range — the
 * Venus track walks 2 % steps to 30 and 1 % steps after it, and every step is one step on the dial).
 */
export function buildValuesArcConfig(name: ArcScaleName, values: ReadonlyArray<number>, opts: {
  center: Point; radius: number; startAngle: number; endAngle: number; bandWidth: number;
}): DynamicArcConfig {
  const {center, radius, startAngle, endAngle, bandWidth} = opts;
  const last = values.length - 1;
  const digits = values.map((value, i) => ({value, angle: startAngle + (last === 0 ? 0 : i / last) * (endAngle - startAngle), radius}));
  return {name, center, bandRadius: radius, bandWidth, startValue: values[0], endValue: values[last], startAngle, endAngle, digits};
}

/** The four dials of one board layout. */
export type BoardArcConfigs = {temperature: DynamicArcConfig, oxygen: DynamicArcConfig, venus: DynamicArcConfig, oceans: DynamicArcConfig};

export const STANDARD_ARCS: BoardArcConfigs = {temperature: TEMPERATURE_ARC, oxygen: OXYGEN_ARC, venus: VENUS_ARC, oceans: OCEAN_ARC};

/**
 * THE ELEVEN-ROW BOARD'S DIALS (Amazonis Planitia — `largeBoardLayout.ts`, `docs/claude/amazonis-planitia-phase-1.md`
 * § the field). The 91-hex grid keeps the standard hex (46 × 51, pitch 49 × 41) and fills the planet's ring almost to
 * the scales, so the four dials are no longer ONE circle (a common ring clearing the grid's six corners would have
 * to grow to r ≈ 318 and cost the hexes ~15 % of their size on screen). Each dial is its OWN circle, solved against
 * the grid (scripted: every band edge ≥ 12 px off every hex, every inner chip ≥ 8 px, ≥ 16 px between neighbours):
 *  · VENUS (0 … 30 in 2 % steps, 31 · 32 · 33 in 1 % — 19 values): a FLAT arc over the grid's flat top (centre
 *    145 px below the planet's, r 440) — its inner chips clear row A, its spacing ≈ 24 px per step;
 *  · OCEANS (1 … 11): the same flat arc under the flat bottom (centre 165 px above, r 440), ≈ 26 px per step;
 *  · OXYGEN (0 … 18) and TEMPERATURE (−30 … +14, 23 values): one circle each, almost the planet's (r 287, centres
 *    14 px out to their side and 8 px up), wrapping the grid's left / right vertices between the two flat arcs.
 * Measured: the content's height grows 554 → ~592 board px against Tharsis — the hex keeps ≈ 94 % of its 4K size.
 */
const LARGE_VENUS_VALUES: ReadonlyArray<number> = [...Array.from({length: 16}, (_, i) => i * 2), 31, 32, 33];
export const LARGE_ARCS: BoardArcConfigs = {
  venus: buildValuesArcConfig('venus', LARGE_VENUS_VALUES, {center: {x: 300, y: 446}, radius: 440, startAngle: -118, endAngle: -63, bandWidth: BAND_WIDTH}),
  oxygen: buildValuesArcConfig('oxygen', Array.from({length: 19}, (_, i) => i), {center: {x: 286, y: 293}, radius: 287, startAngle: 122, endAngle: 223, bandWidth: BAND_WIDTH}),
  temperature: buildValuesArcConfig('temperature', Array.from({length: 23}, (_, i) => -30 + i * 2), {center: {x: 314, y: 293}, radius: 287, startAngle: 58, endAngle: -40, bandWidth: BAND_WIDTH}),
  oceans: buildValuesArcConfig('oceans', Array.from({length: 11}, (_, i) => i + 1), {center: {x: 300, y: 136}, radius: 440, startAngle: 107, endAngle: 73, bandWidth: BAND_WIDTH}),
};

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
