/**
 * CONSOLE START SCENE — pure spatial-navigation + fit helpers.
 *
 * Kept DOM-free (takes plain rects / numbers) so the geometry is unit-tested
 * without a browser — the same pattern as cardSelectionFit / playedTableauFit.
 * The scene wires these to real `getBoundingClientRect()` rects and the fit
 * engine's measured slot size.
 */

export type NavDir = 'left' | 'right' | 'up' | 'down';

/** A minimal rect (x/y/width/height) — a DOMRect satisfies this. */
export interface RectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * 2D d-pad: the index of the nearest tile in `dir` from `curIdx`, chosen by
 * REAL geometry (never the next array index) so the summary's mixed sections
 * (corp / preludes / projects rows) navigate like a spatial grid:
 *
 *  - only tiles genuinely on the requested side qualify (no wrap-around across
 *    the opposite edge);
 *  - the cross-axis offset is weighted heavily so an ALIGNED neighbour wins
 *    over a closer-but-skewed one (DOWN from a corp lands on the project under
 *    it, not a far project three columns over);
 *  - returns -1 when nothing lies in that direction (the caller keeps focus).
 *
 * A 1px dead-zone on the primary axis avoids same-row/column jitter.
 */
export function nearestInDirection(rects: ReadonlyArray<RectLike>, curIdx: number, dir: NavDir): number {
  const cur = rects[curIdx];
  if (cur === undefined) {
    return -1;
  }
  const ccx = cur.left + cur.width / 2;
  const ccy = cur.top + cur.height / 2;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < rects.length; i++) {
    if (i === curIdx) {
      continue;
    }
    const r = rects[i];
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = cx - ccx;
    const dy = cy - ccy;
    let primary: number;
    let cross: number;
    switch (dir) {
    case 'left':
      if (dx >= -1) {
        continue;
      }
      primary = -dx;
      cross = Math.abs(dy);
      break;
    case 'right':
      if (dx <= 1) {
        continue;
      }
      primary = dx;
      cross = Math.abs(dy);
      break;
    case 'up':
      if (dy >= -1) {
        continue;
      }
      primary = -dy;
      cross = Math.abs(dx);
      break;
    default: // 'down'
      if (dy <= 1) {
        continue;
      }
      primary = dy;
      cross = Math.abs(dx);
      break;
    }
    // Cross-axis dominates (×3) so an aligned tile wins; the primary distance
    // breaks ties toward the closer one.
    const score = cross * 3 + primary;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export interface CardFitInput {
  /** Card count in the strip. */
  readonly n: number;
  /** Natural (zoom-1) slot width / height in px. */
  readonly slotW: number;
  readonly slotH: number;
  /** Available width / height inside the strip padding, in px. */
  readonly availW: number;
  readonly availH: number;
  /** Column / row gap in px. */
  readonly colGap: number;
  readonly rowGap: number;
  /** Console UI scale (conUiScale()); the ceilings/floors ride it so cards
   *  stay couch-readable on 4K. */
  readonly scale: number;
}

export interface GridFitInput extends CardFitInput {
  /** Max rows to consider (the strip wraps into ≤ this many rows). */
  readonly maxRows: number;
}

/**
 * SINGLE ROW fit: the largest zoom that fits N cards across the width AND
 * within the height. The ceiling is `rowCeil × scale` — deliberately ABOVE
 * `1 × scale` (the old cap that pinned cards to natural size and wasted the
 * freed height on the prelude/corp steps); the floor keeps them legible.
 * 0.96 on the width leaves the focus scale(1.08) headroom.
 */
export function rowFitZoom(inp: CardFitInput, rowCeil: number): number {
  const {n, slotW, slotH, availW, availH, colGap, scale} = inp;
  if (n <= 0 || slotW <= 0 || slotH <= 0) {
    return scale;
  }
  const widthZoom = (0.96 * availW - (n - 1) * colGap) / (n * slotW);
  const heightZoom = availH / slotH;
  const ceil = rowCeil * scale;
  const floor = 0.5 * scale;
  return Math.min(ceil, Math.max(floor, Math.min(widthZoom, heightZoom)));
}

export interface GridPlan {
  readonly zoom: number;
  readonly cols: number;
}

/**
 * GRID fit (the 10-card project buy): the balanced rows×cols with the LARGEST
 * zoom fitting BOTH axes. `cols` caps the content width so flex-wrap breaks at
 * the PLANNED column count (5+5, never 6+4). Ceiling `gridCeil × scale`.
 */
export function gridFitPlan(inp: GridFitInput, gridCeil: number): GridPlan {
  const {n, slotW, slotH, availW, availH, colGap, rowGap, scale, maxRows} = inp;
  if (n <= 0 || slotW <= 0 || slotH <= 0) {
    return {zoom: scale, cols: n};
  }
  const ceil = gridCeil * scale;
  let best: GridPlan = {zoom: 0, cols: Math.ceil(n / 2)};
  for (let rows = 1; rows <= Math.min(maxRows, n); rows++) {
    const cols = Math.ceil(n / rows);
    const wZoom = (availW - (cols - 1) * colGap) / (cols * slotW);
    const hZoom = (availH - (rows - 1) * rowGap) / (rows * slotH);
    const zoom = Math.min(ceil, wZoom, hZoom);
    if (zoom > best.zoom) {
      best = {zoom, cols};
    }
  }
  return {zoom: Math.max(0.4 * scale, best.zoom), cols: best.cols};
}
