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
