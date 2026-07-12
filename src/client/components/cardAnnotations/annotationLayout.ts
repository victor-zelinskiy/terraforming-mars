/*
 * ANNOTATION LAYOUT — the pure placement strategy for the fullscreen rule
 * blocks (no DOM: rects in, positions out — unit-testable under the server
 * runner).
 *
 * Strategy:
 *  - blocks live in the free gutters LEFT and RIGHT of the fullscreen card;
 *  - a block prefers the side its EXACT anchor is nearest (`bias`, from the
 *    anchor's horizontal position) — the tether stays short and direct and
 *    never crosses the card face; anchors without a clear side ('free' —
 *    full-width rows / unresolved anchors) fill the lighter side;
 *  - per side, blocks keep ANCHOR ORDER (vertical order of text mirrors the
 *    vertical order of the targets — same-side lines can never cross) and
 *    pack to their anchor's Y in two passes: top-down min-gap, then a
 *    bottom-up clamp that pushes earlier blocks up instead of overlapping;
 *  - a side that would overflow the viewport hands its tail to the other
 *    side; if the gutters are too narrow for a readable block (< MIN_W)
 *    the layout reports null and the layer gracefully doesn't appear —
 *    never a degraded «giant side panel».
 */

export type AnnotationSide = 'left' | 'right';
export type AnnotationSideBias = AnnotationSide | 'free';

export type LayoutItem = {
  id: string;
  /** Anchor's vertical center, viewport px. */
  anchorY: number;
  /** The block's measured height at the layout width, px. */
  height: number;
  /** Preferred side from the anchor's horizontal position (default free). */
  bias?: AnnotationSideBias;
};

export type LayoutRect = {left: number, right: number, top: number, bottom: number};

export type LayoutInput = {
  items: ReadonlyArray<LayoutItem>;
  /** The fullscreen card's viewport rect. */
  cardRect: LayoutRect;
  viewport: {width: number, height: number};
  /** Reserved space at the outer screen edges (nav arrows / chrome). */
  edgePad: number;
};

export type AnnotationPlacement = {
  id: string;
  side: AnnotationSide;
  /** Block's left edge, viewport px. */
  x: number;
  /** Block's top edge, viewport px. */
  y: number;
};

export type AnnotationLayout = {
  placements: ReadonlyArray<AnnotationPlacement>;
  /** The common block width, px. */
  width: number;
  /** Dense mode — the layer compacts typography/padding. */
  compact: boolean;
};

export const ANNOTATION_MAX_W = 252;
export const ANNOTATION_MIN_W = 168;
const CARD_GAP = 30;    // block ↔ card breathing room
const BLOCK_GAP = 18;   // min vertical gap between blocks on a side
const SAFE_TOP = 18;
const SAFE_BOTTOM = 78; // the fullscreen actions strip

/**
 * Pack one side in two passes: (1) top-down — ideal y is anchor-centered,
 * resolved against the running cursor; (2) bottom-up — clamp into the safe
 * band, pushing EARLIER blocks up instead of letting bottom-clamped blocks
 * pile onto each other (floored at SAFE_TOP: an over-capacity side degrades
 * by squeezing at the top, which the compact flag already signals).
 */
function packSide(items: Array<LayoutItem>, viewportH: number): Array<{id: string, y: number}> {
  const ys: Array<number> = [];
  let cursor = SAFE_TOP;
  for (const item of items) {
    const y = Math.max(item.anchorY - item.height / 2, cursor);
    ys.push(y);
    cursor = y + item.height + BLOCK_GAP;
  }
  let limit = viewportH - SAFE_BOTTOM;
  for (let i = items.length - 1; i >= 0; i--) {
    ys[i] = Math.max(Math.min(ys[i], limit - items[i].height), SAFE_TOP);
    limit = ys[i] - BLOCK_GAP;
  }
  return items.map((item, i) => ({id: item.id, y: ys[i]}));
}

function sideCapacity(viewportH: number): number {
  return viewportH - SAFE_TOP - SAFE_BOTTOM;
}

function usedHeight(items: ReadonlyArray<LayoutItem>): number {
  return items.reduce((acc, it) => acc + it.height, 0) + Math.max(0, items.length - 1) * BLOCK_GAP;
}

export function solveAnnotationLayout(input: LayoutInput): AnnotationLayout | null {
  const {items, cardRect, viewport, edgePad} = input;
  if (items.length === 0) {
    return null;
  }

  const gutter = Math.min(cardRect.left, viewport.width - cardRect.right);
  const width = Math.min(ANNOTATION_MAX_W, gutter - CARD_GAP - edgePad);
  if (width < ANNOTATION_MIN_W) {
    return null; // not enough premium room — never squeeze into mush
  }

  // Side assignment, in anchor order: biased items go beside their anchor
  // (short direct tethers); free items fill the currently-lighter side.
  const ordered = [...items].sort((a, b) => a.anchorY - b.anchorY);
  const left: Array<LayoutItem> = [];
  const right: Array<LayoutItem> = [];
  for (const item of ordered) {
    const bias = item.bias ?? 'free';
    if (bias === 'left') {
      left.push(item);
    } else if (bias === 'right') {
      right.push(item);
    } else {
      (usedHeight(left) < usedHeight(right) ? left : right).push(item);
    }
  }
  left.sort((a, b) => a.anchorY - b.anchorY);
  right.sort((a, b) => a.anchorY - b.anchorY);

  // Overflow: hand the tail to the lighter side (keeps anchor order).
  const capacity = sideCapacity(viewport.height);
  const rebalance = (from: Array<LayoutItem>, to: Array<LayoutItem>) => {
    while (from.length > 1 && usedHeight(from) > capacity && usedHeight(to) + usedHeight([from[from.length - 1]]) + BLOCK_GAP <= capacity) {
      const moved = from.pop();
      if (moved === undefined) {
        break;
      }
      to.push(moved);
      to.sort((a, b) => a.anchorY - b.anchorY);
    }
  };
  rebalance(right, left);
  rebalance(left, right);

  const compact = usedHeight(left) > capacity || usedHeight(right) > capacity || items.length > 5;

  const placements: Array<AnnotationPlacement> = [];
  for (const {side, sideItems} of [
    {side: 'left' as const, sideItems: left},
    {side: 'right' as const, sideItems: right},
  ]) {
    const x = side === 'left' ? cardRect.left - CARD_GAP - width : cardRect.right + CARD_GAP;
    for (const packed of packSide(sideItems, viewport.height)) {
      placements.push({id: packed.id, side, x, y: packed.y});
    }
  }
  return {placements, width, compact};
}

/* ═══════════════════════════════════════════════════════════════════════
 *  TETHER ROUTING — the pure geometry of one trace (block → graphic).
 *
 *  The default trace is the elegant elbow (horizontal run → short diagonal
 *  to the exact anchor). It is kept UNCHANGED whenever it is clear. The one
 *  job of the router is to keep a trace off the card's bottom-left SERVICE
 *  elements (the engraved expansion stamp and the resource counter) — a
 *  trace must never cross or cover them. When the elbow would clip such an
 *  obstacle, the trace re-routes as an orthogonal detour: it lifts its
 *  horizontal corridor ABOVE the obstacle band and drops onto the anchor at
 *  an x cleared of the obstacle spans — so neither the run nor the approach
 *  touches a service element. Pure (rects in, path string out) — testable.
 * ═══════════════════════════════════════════════════════════════════════ */

export type TetherRect = {left: number, right: number, top: number, bottom: number};

export type TetherInput = {
  /** The block's exit point (edge facing the card). */
  bx: number;
  by: number;
  /** The exact anchor element's viewport rect. */
  anchor: TetherRect;
  side: AnnotationSide;
  /** Service-element rects to keep clear of (raw, un-padded). */
  obstacles: ReadonlyArray<TetherRect>;
};

export type TetherPath = {
  /** SVG path `d`. */
  d: string;
  /** The anchor endpoint (dot position). */
  ax: number;
  ay: number;
};

const TETHER_GAP = 4;       // endpoint just outside the anchor's near edge
const TETHER_APPROACH = 16; // elbow's short approach run
const OBSTACLE_PAD = 7;     // breathing room around a service element
const CORRIDOR_CLEAR = 8;   // vertical slack when testing the corridor band

function inflate(r: TetherRect, pad: number): TetherRect {
  return {left: r.left - pad, right: r.right + pad, top: r.top - pad, bottom: r.bottom + pad};
}

/** Liang–Barsky: does the segment intersect the (closed) rect? */
function segmentHitsRect(x1: number, y1: number, x2: number, y2: number, r: TetherRect): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.left, r.right - x1, y1 - r.top, r.bottom - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) {
        return false; // parallel to this edge and outside the slab
      }
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) {
          return false;
        }
        if (t > t0) {
          t0 = t;
        }
      } else {
        if (t < t0) {
          return false;
        }
        if (t < t1) {
          t1 = t;
        }
      }
    }
  }
  return t0 <= t1;
}

function polylineHits(pts: ReadonlyArray<readonly [number, number]>, rects: ReadonlyArray<TetherRect>): boolean {
  for (let i = 1; i < pts.length; i++) {
    for (const r of rects) {
      if (segmentHitsRect(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], r)) {
        return true;
      }
    }
  }
  return false;
}

function pathD(pts: ReadonlyArray<readonly [number, number]>): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
}

export function routeTether(input: TetherInput): TetherPath {
  const {bx, by, anchor, side} = input;
  const dir = side === 'left' ? -1 : 1; // x-direction from the anchor toward the block
  const nearEdge = dir < 0 ? anchor.left : anchor.right;
  let ax = nearEdge + dir * TETHER_GAP;
  let ay = (anchor.top + anchor.bottom) / 2;

  // The elegant default: horizontal run to the approach point, short diagonal
  // to the exact anchor. Kept verbatim when nothing is in the way.
  const xm = ax + dir * TETHER_APPROACH;
  const def: Array<[number, number]> = [[bx, by], [xm, by], [ax, ay]];
  const obstacles = input.obstacles.map((o) => inflate(o, OBSTACLE_PAD));
  if (obstacles.length === 0 || !polylineHits(def, obstacles)) {
    return {d: pathD(def), ax, ay};
  }

  // Only the service elements actually sitting in this trace's corridor matter.
  const loX = Math.min(bx, ax);
  const hiX = Math.max(bx, ax);
  const loY = Math.min(by, ay) - CORRIDOR_CLEAR;
  const hiY = Math.max(by, ay) + CORRIDOR_CLEAR;
  const blockers = obstacles.filter((o) => o.right >= loX && o.left <= hiX && o.bottom >= loY && o.top <= hiY);
  if (blockers.length === 0) {
    return {d: pathD(def), ax, ay};
  }

  // Detour: lift the horizontal corridor ABOVE every blocker and drop onto the
  // anchor at an x cleared of the blocker spans. Slide the drop-x off any
  // blocker sitting under the near edge (kept within the anchor's own width so
  // the dot stays on the element it explains).
  const clearTop = Math.min(...blockers.map((o) => o.top));
  for (let guard = 0, moved = true; moved && guard < 4; guard++) {
    moved = false;
    for (const o of blockers) {
      if (ax > o.left && ax < o.right) {
        ax = dir < 0 ? Math.min(o.right, anchor.right - 4) : Math.max(o.left, anchor.left + 4);
        moved = true;
      }
    }
  }
  // Drop onto the anchor near its top edge — short, clearly on the frame, and
  // well clear of the bottom-corner obstacles.
  ay = anchor.top + Math.min((anchor.bottom - anchor.top) / 2, 6);
  const runY = Math.min(by, clearTop, ay - CORRIDOR_CLEAR);
  const pts: Array<[number, number]> = [[bx, by]];
  if (Math.abs(by - runY) > 1) {
    pts.push([bx, runY]); // short vertical jog inside the (clear) gutter
  }
  pts.push([ax, runY]); // horizontal corridor, above the obstacle band
  pts.push([ax, ay]);   // drop onto the anchor, off the obstacle spans
  return {d: pathD(pts), ax, ay};
}
