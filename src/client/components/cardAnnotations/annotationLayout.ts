/*
 * ANNOTATION LAYOUT — the pure placement strategy for the fullscreen rule
 * blocks (no DOM: rects in, positions out — unit-testable under the server
 * runner).
 *
 * Strategy:
 *  - blocks live in the free gutters LEFT and RIGHT of the fullscreen card;
 *  - items are sorted by their anchor's vertical position and dealt
 *    round-robin across the two sides — blocks on one side keep anchor
 *    order, so tether lines on a side can never cross each other;
 *  - per side, blocks are packed to their anchor's Y with a minimum gap
 *    (simple top-down collision resolution + viewport clamping);
 *  - a side that would overflow the viewport hands its tail to the other
 *    side; if the gutters are too narrow for a readable block (< MIN_W)
 *    the layout reports null and the layer gracefully doesn't appear —
 *    never a degraded «giant side panel».
 */

export type AnnotationSide = 'left' | 'right';

export type LayoutItem = {
  id: string;
  /** Anchor's vertical center, viewport px. */
  anchorY: number;
  /** The block's measured height at the layout width, px. */
  height: number;
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
const BLOCK_GAP = 12;   // min vertical gap between blocks on a side
const SAFE_TOP = 18;
const SAFE_BOTTOM = 78; // the fullscreen actions strip

/** Pack one side: ideal y = anchor-centered, resolved top-down, clamped. */
function packSide(items: Array<LayoutItem>, viewportH: number): Array<{id: string, y: number}> {
  const out: Array<{id: string, y: number}> = [];
  let cursor = SAFE_TOP;
  for (const item of items) {
    const ideal = item.anchorY - item.height / 2;
    let y = Math.max(ideal, cursor);
    y = Math.min(y, viewportH - SAFE_BOTTOM - item.height);
    y = Math.max(y, SAFE_TOP);
    out.push({id: item.id, y});
    cursor = y + item.height + BLOCK_GAP;
  }
  return out;
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

  // Deal by anchor order, round-robin — same-side lines never cross.
  const ordered = [...items].sort((a, b) => a.anchorY - b.anchorY);
  const left: Array<LayoutItem> = [];
  const right: Array<LayoutItem> = [];
  ordered.forEach((item, i) => (i % 2 === 0 ? right : left).push(item));

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
