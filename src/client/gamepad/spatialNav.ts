/**
 * PURE spatial-navigation geometry (docs/GAMEPAD_SUPPORT_DESIGN.md §5.3).
 *
 * Classic directional scoring tuned for this UI's layouts (button rails,
 * card grids, master-detail columns, the hex board): candidates in the
 * direction half-plane are scored by primary-axis distance plus a weighted
 * orthogonal offset; candidates whose rect OVERLAPS the origin on the cross
 * axis get a strong alignment discount (rows/columns feel like rows/columns),
 * and a wide cone keeps hex neighbours (which sit at ±30° off-axis)
 * reachable. No DOM — rects in, index out — unit-tested on fixture grids
 * (tests/client/components/gamepad/spatialNav.spec.ts). JSDOM zero-rects are
 * therefore a non-issue: the DOM shell simply feeds real rects at runtime.
 */

import {NavDirection} from '@/client/gamepad/gamepadPollModel';

export type NavRect = {
  left: number,
  top: number,
  width: number,
  height: number,
};

/** How much the orthogonal offset costs relative to forward distance. */
const ORTHO_WEIGHT = 2.2;
/** Orthogonal weight when the rects overlap on the cross axis (same row/column). */
const ALIGNED_ORTHO_WEIGHT = 0.3;
/** Reject candidates whose off-axis angle is too wide (ortho > primary × CONE). */
const CONE_RATIO = 2.5;

export function rectCenter(r: NavRect): {x: number, y: number} {
  return {x: r.left + r.width / 2, y: r.top + r.height / 2};
}

function overlaps(min1: number, max1: number, min2: number, max2: number): boolean {
  return min1 < max2 && min2 < max1;
}

/**
 * Pick the best candidate in `dir` from `from`. Returns the candidate INDEX
 * or undefined when nothing lies in that direction. Zero-area rects are
 * skipped (hidden elements).
 */
export function pickDirectional(
  from: NavRect,
  candidates: ReadonlyArray<NavRect>,
  dir: NavDirection,
): number | undefined {
  const fc = rectCenter(from);
  let bestIdx: number | undefined;
  let bestScore = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const rect = candidates[i];
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    const cc = rectCenter(rect);
    const dx = cc.x - fc.x;
    const dy = cc.y - fc.y;

    let primary: number;
    let ortho: number;
    let aligned: boolean;
    switch (dir) {
    case 'left':
      primary = -dx;
      ortho = Math.abs(dy);
      aligned = overlaps(rect.top, rect.top + rect.height, from.top, from.top + from.height);
      break;
    case 'right':
      primary = dx;
      ortho = Math.abs(dy);
      aligned = overlaps(rect.top, rect.top + rect.height, from.top, from.top + from.height);
      break;
    case 'up':
      primary = -dy;
      ortho = Math.abs(dx);
      aligned = overlaps(rect.left, rect.left + rect.width, from.left, from.left + from.width);
      break;
    case 'down':
      primary = dy;
      ortho = Math.abs(dx);
      aligned = overlaps(rect.left, rect.left + rect.width, from.left, from.left + from.width);
      break;
    }

    // Must genuinely lie in the direction (strict center displacement).
    if (primary <= 1) {
      continue;
    }
    // Cone filter: reject nearly-perpendicular candidates.
    if (!aligned && ortho > primary * CONE_RATIO) {
      continue;
    }
    const score = primary + ortho * (aligned ? ALIGNED_ORTHO_WEIGHT : ORTHO_WEIGHT);
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * P27b: STRICT grid traversal for the console Board Inspection Mode.
 *
 * The generic pickDirectional scores hex diagonals as valid left/right
 * targets, so a horizontal run drifted between rows. This picker enforces
 * the inspection contract instead:
 *  - left/right: stays STRICTLY in the current ROW (centers within half the
 *    cell height), nearest in the direction;
 *  - up/down: moves to the NEAREST row in that direction, then picks the
 *    cell closest to the COLUMN ANCHOR X (the x remembered from the last
 *    horizontal move / landing) — hex rows are offset by half a cell, so
 *    anchoring is what keeps a vertical run in ONE visual column instead of
 *    zig-zag drifting into a neighbour.
 *
 * Returns undefined when nothing qualifies (end of a row / column) — the
 * caller may fall back to pickDirectional to reach off-grid cells.
 */
export function pickStrictGrid(
  from: NavRect,
  candidates: ReadonlyArray<NavRect>,
  dir: NavDirection,
  anchorX?: number,
): number | undefined {
  const fc = rectCenter(from);
  const rowTol = from.height / 2;
  let bestIdx: number | undefined;
  let bestScore = Infinity;

  if (dir === 'left' || dir === 'right') {
    for (let i = 0; i < candidates.length; i++) {
      const rect = candidates[i];
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }
      const cc = rectCenter(rect);
      if (Math.abs(cc.y - fc.y) > rowTol) {
        continue; // a different row — never a horizontal target
      }
      const primary = dir === 'right' ? cc.x - fc.x : fc.x - cc.x;
      if (primary <= 1) {
        continue;
      }
      if (primary < bestScore) {
        bestScore = primary;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  // Vertical: find the nearest row band in the direction, then the cell
  // closest to the column anchor within it.
  let nearestRow = Infinity;
  for (const rect of candidates) {
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    const cy = rectCenter(rect).y;
    const primary = dir === 'down' ? cy - fc.y : fc.y - cy;
    if (primary > rowTol && primary < nearestRow) {
      nearestRow = primary;
    }
  }
  if (nearestRow === Infinity) {
    return undefined;
  }
  const anchor = anchorX ?? fc.x;
  for (let i = 0; i < candidates.length; i++) {
    const rect = candidates[i];
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    const cc = rectCenter(rect);
    const primary = dir === 'down' ? cc.y - fc.y : fc.y - cc.y;
    if (primary <= rowTol || primary > nearestRow + rowTol) {
      continue; // not the adjacent row band
    }
    const off = Math.abs(cc.x - anchor);
    if (off < bestScore) {
      bestScore = off;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Nearest candidate to a POINT (focus recovery after the focused element
 * left the DOM: land on whatever now sits closest to where it was).
 */
export function pickNearest(
  point: {x: number, y: number},
  candidates: ReadonlyArray<NavRect>,
): number | undefined {
  let bestIdx: number | undefined;
  let bestDist = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const rect = candidates[i];
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    const c = rectCenter(rect);
    const dist = Math.hypot(c.x - point.x, c.y - point.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}
