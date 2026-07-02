/**
 * PURE spatial-navigation geometry (GAMEPAD_SUPPORT_DESIGN.md §5.3).
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
