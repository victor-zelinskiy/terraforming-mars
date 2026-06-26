/**
 * ArcScaleGeometry — a PURE, reusable geometry helper for a global-parameter
 * scale drawn as a CIRCULAR ARC on the Mars board.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * The board's existing scales (O₂ / temperature / Venus) are HTML digits hand-
 * placed over the coloured arc BAKED INTO mars.png — their per-digit margins +
 * rotations live in globs.less (`@*-vals`). That works, but it couples the
 * scale geometry to the PNG and to dozens of magic numbers.
 *
 * The OCEAN scale is the first scale drawn ENTIRELY in code (no PNG band under
 * it), so it needs its arc geometry COMPUTED, not eyeballed. This module is
 * that computation, written GENERICALLY so the same helper can later drive a
 * dynamic re-render of O₂ / temperature / Venus (the long-term goal: PNG keeps
 * only the planet texture, every scale becomes a code-rendered premium layer).
 *
 * ── Coordinate system ─────────────────────────────────────────────────────
 * Everything is in the `.global-numbers` coordinate space (the same space the
 * `@*-vals` digit margins + scaleBonusZones.ts `CENTER` live in). The three
 * existing scales are concentric arcs whose circle-fit centre is (300, 301);
 * the ocean arc shares that centre so it reads as part of ONE system.
 *
 * Angles are CLOCK angles in DEGREES measured from the +x axis (3 o'clock),
 * growing CLOCKWISE because screen-y points down:
 *     0° = right (3 o'clock), 90° = down (6 o'clock), 180° = left (9 o'clock).
 * A point at angle θ, radius r is  (cx + r·cosθ, cy + r·sinθ).
 *
 * The helper is intentionally framework-free (no Vue / DOM) so it is unit-
 * testable without a browser and safe to import from the server test runner.
 */

export type Point = {x: number; y: number};
export type Vec = {x: number; y: number};

export type ArcScaleConfig = {
  /** Circle centre in `.global-numbers` space (shared (300, 301) for board scales). */
  center: Point;
  /** Centreline radius — where the digit/tick ring sits. */
  radius: number;
  /** Clock angle (deg) of the FIRST value. */
  startAngle: number;
  /** Clock angle (deg) of the LAST value. */
  endAngle: number;
  /** Value at `startAngle` (e.g. 1 ocean). */
  startValue: number;
  /** Value at `endAngle` (e.g. 9 oceans). */
  endValue: number;
};

const DEG = Math.PI / 180;

function toRad(deg: number): number {
  return deg * DEG;
}

/** Linear-interpolate the clock angle for a value along the arc. */
export function angleForValue(cfg: ArcScaleConfig, value: number): number {
  const span = cfg.endValue - cfg.startValue;
  if (span === 0) {
    return cfg.startAngle;
  }
  const t = (value - cfg.startValue) / span;
  return cfg.startAngle + t * (cfg.endAngle - cfg.startAngle);
}

/** Point on the circle at a given clock angle and radius. */
export function pointAtAngle(center: Point, radius: number, angleDeg: number): Point {
  const a = toRad(angleDeg);
  return {x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a)};
}

/**
 * Point for a value. `radius` overrides the config centreline radius — used to
 * place ticks / digits / marker chips inside or outside the band.
 */
export function pointForValue(cfg: ArcScaleConfig, value: number, radius = cfg.radius): Point {
  return pointAtAngle(cfg.center, radius, angleForValue(cfg, value));
}

/**
 * OUTWARD unit normal at a value — points from the circle centre toward the
 * value (away from the planet). Negate for the inward normal.
 */
export function normalForValue(cfg: ArcScaleConfig, value: number): Vec {
  const a = toRad(angleForValue(cfg, value));
  return {x: Math.cos(a), y: Math.sin(a)};
}

/**
 * Unit tangent at a value, in the direction of INCREASING value along the arc.
 * (Perpendicular to the normal.)
 */
export function tangentForValue(cfg: ArcScaleConfig, value: number): Vec {
  const n = normalForValue(cfg, value);
  // Tangent = normal rotated +90°. Sign chosen so it follows increasing value;
  // flipping for a descending-angle arc keeps "toward higher value" consistent.
  const dir = cfg.endAngle >= cfg.startAngle ? 1 : -1;
  return {x: -n.y * dir, y: n.x * dir};
}

/**
 * Rotation (deg) for a marker chip whose "up" (an up-pointing triangle's tip)
 * must aim at the band — i.e. INWARD, toward the circle centre. Mirrors the
 * `point = atan2(-ox, oy)` convention used by scaleBonusZones.ts so chips read
 * identically to the Venus/O₂/temperature bonus pointers.
 *
 * `side` = which side of the band the chip body sits on: 'outer' (toward space)
 * with its pointer aiming inward, or 'inner' (toward the planet) aiming outward.
 */
export function pointerRotationForValue(cfg: ArcScaleConfig, value: number, side: 'inner' | 'outer'): number {
  const n = normalForValue(cfg, value);
  // (ox, oy) = direction from the band toward the chip BODY (mirrors
  // scaleBonusZones.ts). An outer chip sits along +normal, an inner chip along
  // -normal; the up-triangle is then rotated to aim OPPOSITE the body (at the
  // band): point = atan2(-ox, oy).
  const sign = side === 'outer' ? 1 : -1;
  const ox = sign * n.x;
  const oy = sign * n.y;
  return Math.round((Math.atan2(-ox, oy) * 180) / Math.PI);
}

/**
 * SVG path data for a circular arc between two clock angles at a fixed radius.
 * Picks the MINOR arc (large-arc-flag 0) and the sweep direction that follows
 * angle a1 → a2 (so a descending-angle ocean arc bulges away from the centre).
 */
export function arcPath(center: Point, radius: number, a1Deg: number, a2Deg: number): string {
  const p1 = pointAtAngle(center, radius, a1Deg);
  const p2 = pointAtAngle(center, radius, a2Deg);
  const delta = a2Deg - a1Deg;
  const largeArc = Math.abs(delta) > 180 ? 1 : 0;
  // In screen space (y down) SVG sweep-flag 1 draws in the direction of
  // INCREASING clock angle. So sweep = 1 when a2 > a1, else 0.
  const sweep = delta >= 0 ? 1 : 0;
  return `M ${round(p1.x)} ${round(p1.y)} A ${round(radius)} ${round(radius)} 0 ${largeArc} ${sweep} ${round(p2.x)} ${round(p2.y)}`;
}

/** The whole centreline arc path (startValue → endValue). */
export function bandPath(cfg: ArcScaleConfig, radius = cfg.radius): string {
  return arcPath(cfg.center, radius, angleForValue(cfg, cfg.startValue), angleForValue(cfg, cfg.endValue));
}

export type ArcSegment = {
  value: number;
  /** Arc path for this segment's cell (a slice of the band centred on the value). */
  path: string;
  /** Mid-point of the cell on the centreline (for labels / hit areas). */
  mid: Point;
};

/**
 * Divide the band into one CELL per value (discrete "ocean slots"). Each cell
 * is the arc slice centred on its value, spanning `fill` (0..1) of the inter-
 * value angular step, leaving a small gap between adjacent cells. Used to draw
 * the segmented water band where cells light up as oceans are placed.
 */
export function segments(cfg: ArcScaleConfig, radius = cfg.radius, fill = 0.84): ReadonlyArray<ArcSegment> {
  const count = Math.round(cfg.endValue - cfg.startValue) + 1;
  const stepAngle = count > 1 ? (cfg.endAngle - cfg.startAngle) / (count - 1) : 0;
  const half = (Math.abs(stepAngle) * fill) / 2;
  const out: Array<ArcSegment> = [];
  for (let i = 0; i < count; i++) {
    const value = cfg.startValue + i;
    const a = angleForValue(cfg, value);
    // Cell spans [a-half, a+half] in the direction of the arc; sign keeps the
    // slice oriented the same way the band sweeps.
    const dir = stepAngle >= 0 ? 1 : -1;
    const a1 = a - half * dir;
    const a2 = a + half * dir;
    out.push({value, path: arcPath(cfg.center, radius, a1, a2), mid: pointAtAngle(cfg.center, radius, a)});
  }
  return out;
}

export type MarkerSide = 'inside' | 'outside';

export type Rect = {x: number; y: number; w: number; h: number};

/**
 * FULL geometric placement of a threshold-marker CHIP relative to a scale band.
 * Everything the chip + its connector need, derived from the band geometry — so
 * the connector PHYSICALLY reaches the rail edge by construction (never an
 * eyeballed offset). This is the single model behind every scale's markers
 * (Venus / O₂ / temperature reward chips + the ocean event chips).
 */
export type ArcScaleMarkerPlacement = {
  /** The value this marker is pinned to. */
  value: number;
  /** Clock angle (deg) of the threshold the connector points at. */
  angle: number;
  /** Point on the band centreline at the threshold (the value's true spot). */
  thresholdPoint: Point;
  /** Point on the band EDGE facing the chip — the connector tip lands here. */
  railEdgePoint: Point;
  /** Outward unit normal at the threshold. */
  normal: Vec;
  /** Unit tangent at the threshold (increasing-value direction). */
  tangent: Vec;
  side: MarkerSide;
  /** Chip CENTRE in `.global-numbers` space. */
  chipCenter: Point;
  /** Connector base (at the chip edge). */
  pointerStart: Point;
  /** Connector tip — equals `railEdgePoint`. */
  pointerEnd: Point;
  /** Connector rotation (deg) for the CSS up-axis → aims chip → rail. */
  rotation: number;
  /** CSS translateY push (px) from the chip centre along the rotated up-axis. */
  pointerDist: number;
  /** Connector visible length (px) — chip edge → rail edge. */
  pointerLen: number;
  /** Axis-aligned chip bounds (for the collision pass). */
  collisionBounds: Rect;
};

const MIN_POINTER_LEN = 4;

/**
 * Place a marker chip against a band, computed purely from geometry. The chip
 * body sits `gap + pointer + size/2` beyond the band edge on `side`; the
 * connector then spans from the chip edge to the rail edge and ALWAYS touches
 * it. `chipAngle` lets a dense cluster FAN OUT (the chip slides to a spread
 * angle) while the connector still re-aims at the TRUE `thresholdAngle` rail
 * point — so a fanned chip never visually detaches from its value.
 *
 *   • 'outside' — chip beyond the OUTER edge (toward space), connector inward.
 *   • 'inside'  — chip beyond the INNER edge (toward the PLANET), connector out.
 */
export function placeArcMarker(opts: {
  center: Point;
  /** Exact angle of the value (where the rail anchor / connector tip lands). */
  thresholdAngle: number;
  /** Angle the chip body sits at (defaults to thresholdAngle = radial). */
  chipAngle?: number;
  bandRadius: number;
  bandWidth: number;
  side: MarkerSide;
  gap: number;
  pointer: number;
  size: number;
  value?: number;
}): ArcScaleMarkerPlacement {
  const {center, thresholdAngle, bandRadius, bandWidth, side, gap, pointer, size} = opts;
  const chipAngle = opts.chipAngle ?? thresholdAngle;
  const bandInner = bandRadius - bandWidth / 2;
  const bandOuter = bandRadius + bandWidth / 2;

  // Rail anchor: on the band edge facing the chip, at the TRUE threshold angle.
  const nThresh = {x: Math.cos(toRad(thresholdAngle)), y: Math.sin(toRad(thresholdAngle))};
  const railR = side === 'outside' ? bandOuter : bandInner;
  const railEdgePoint = {x: center.x + nThresh.x * railR, y: center.y + nThresh.y * railR};
  const thresholdPoint = {x: center.x + nThresh.x * bandRadius, y: center.y + nThresh.y * bandRadius};

  // Chip centre: radially out past the band edge + connector + gap, at chipAngle.
  const nChip = {x: Math.cos(toRad(chipAngle)), y: Math.sin(toRad(chipAngle))};
  const chipR = side === 'outside' ?
    bandOuter + gap + pointer + size / 2 :
    bandInner - gap - pointer - size / 2;
  const chipCenter = {x: center.x + nChip.x * chipR, y: center.y + nChip.y * chipR};

  // Connector chip → rail (re-aimed when the chip is fanned off its threshold).
  const dx = railEdgePoint.x - chipCenter.x;
  const dy = railEdgePoint.y - chipCenter.y;
  const L = Math.hypot(dx, dy);
  const ux = L === 0 ? 0 : dx / L;
  const uy = L === 0 ? 0 : dy / L;
  // CSS up-axis (0,-1) rotated by θ → (sinθ,-cosθ) must equal (ux,uy).
  const rotation = Math.round((Math.atan2(ux, -uy) * 180) / Math.PI);
  const pointerLen = Math.max(L - size / 2, MIN_POINTER_LEN);
  const pointerDist = Math.round((L - pointerLen / 2) * 100) / 100;
  const pointerStart = {x: chipCenter.x + ux * (size / 2), y: chipCenter.y + uy * (size / 2)};

  // Tangent at the threshold (= normal rotated +90°).
  const tangent = {x: -nThresh.y, y: nThresh.x};

  return {
    value: opts.value ?? 0,
    angle: thresholdAngle,
    thresholdPoint: {x: round(thresholdPoint.x), y: round(thresholdPoint.y)},
    railEdgePoint: {x: round(railEdgePoint.x), y: round(railEdgePoint.y)},
    normal: nThresh,
    tangent,
    side,
    chipCenter: {x: round(chipCenter.x), y: round(chipCenter.y)},
    pointerStart: {x: round(pointerStart.x), y: round(pointerStart.y)},
    pointerEnd: {x: round(railEdgePoint.x), y: round(railEdgePoint.y)},
    rotation,
    pointerDist,
    pointerLen: Math.round(pointerLen * 100) / 100,
    collisionBounds: {x: round(chipCenter.x - size / 2), y: round(chipCenter.y - size / 2), w: size, h: size},
  };
}

/**
 * 1-D collision relaxation: given sorted scalar positions (e.g. chip angles, or
 * arc-length positions), push neighbours apart so consecutive entries differ by
 * at least `minGap`, while keeping the cluster CENTRED (minimal total movement).
 * Used to FAN OUT a dense marker row (Venus) without detaching chips from their
 * thresholds (the connector re-aims). Pure — returns NEW positions in input order.
 */
export function spreadValues(positions: ReadonlyArray<number>, minGap: number): Array<number> {
  const n = positions.length;
  if (n <= 1) {
    return [...positions];
  }
  // Sort with original indices so we can return in input order.
  const order = positions.map((p, i) => ({p, i})).sort((a, b) => a.p - b.p);
  const out = order.map((o) => o.p);
  // Forward pass — enforce the minimum gap, accumulating rightward.
  for (let k = 1; k < n; k++) {
    if (out[k] - out[k - 1] < minGap) {
      out[k] = out[k - 1] + minGap;
    }
  }
  // Re-centre: shift the whole spread so its midpoint matches the original
  // midpoint (so the row grows symmetrically, not only rightward).
  const origMid = (order[0].p + order[n - 1].p) / 2;
  const newMid = (out[0] + out[n - 1]) / 2;
  const shift = origMid - newMid;
  const result = new Array<number>(n);
  for (let k = 0; k < n; k++) {
    result[order[k].i] = out[k] + shift;
  }
  return result;
}

/**
 * Back-compat thin wrapper (ocean scale): the original `markerChip` shape, now
 * computed via `placeArcMarker`. Also surfaces `pointerLen` so the ocean event
 * chips draw the same luminous connector as the reward chips.
 */
export function markerChip(
  cfg: ArcScaleConfig,
  value: number,
  side: MarkerSide,
  opts: {bandInner: number; bandOuter: number; gap: number; pointer: number; size: number},
): {x: number; y: number; point: number; pointerDist: number; pointerLen: number} {
  const bandWidth = opts.bandOuter - opts.bandInner;
  const bandRadius = (opts.bandOuter + opts.bandInner) / 2;
  const placement = placeArcMarker({
    center: cfg.center,
    thresholdAngle: angleForValue(cfg, value),
    bandRadius,
    bandWidth,
    side,
    gap: opts.gap,
    pointer: opts.pointer,
    size: opts.size,
    value,
  });
  return {
    x: placement.chipCenter.x,
    y: placement.chipCenter.y,
    point: placement.rotation,
    pointerDist: placement.pointerDist,
    pointerLen: placement.pointerLen,
  };
}

/** A short radial tick line crossing the band at a value (inner → outer point). */
export function tick(cfg: ArcScaleConfig, value: number, innerR: number, outerR: number): {x1: number; y1: number; x2: number; y2: number} {
  const a = angleForValue(cfg, value);
  const p1 = pointAtAngle(cfg.center, innerR, a);
  const p2 = pointAtAngle(cfg.center, outerR, a);
  return {x1: round(p1.x), y1: round(p1.y), x2: round(p2.x), y2: round(p2.y)};
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
