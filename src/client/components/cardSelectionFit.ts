/*
 * cardSelectionFit.ts — pure, DOM-free layout math for the card-selection
 * modal grid (CardSelectionContent.fit). Extracted so the row/column/zoom
 * decision can be unit-tested without a real browser layout (the fit engine
 * itself is a no-op under JSDOM because getBoundingClientRect returns 0).
 *
 * The engine sizes the grid to the card COUNT + viewport:
 *   - few cards  → large + centred
 *   - many cards → a wider, balanced grid
 *   - vertical scroll is the genuine last resort (height-fit lives in the
 *     component since it needs real measured heights).
 *
 * SMALL PICKS (n <= FIT_SINGLE_ROW_MAX — the between-generation draft is
 * 4→3→2→1) are pinned to ONE row: cols = n, and the zoom + content width
 * guarantee the row fits availW horizontally WITH slack, so the browser's
 * flex-wrap never bumps the last card to a second row (the 2+1 / 3+1 bug).
 */

export const FIT_MIN_ZOOM = 0.5;
export const FIT_MAX_CONTENT_W = 1560; // < the 1640 modal max-width cap (stays in box)
export const FIT_SLOT_MIN_W = 168;     // action button floor — slot never narrower
export const FIT_SINGLE_ROW_MAX = 4;   // n <= this → never wrap, one row
/*
 * Horizontal slack (px) added to the single-row content width. The slot width
 * we compute (naturalW * zoom) is an APPROXIMATION — CSS `zoom` rounds each
 * card-container to whole device pixels, so n slots can be a few px wider than
 * `n * slotW`. Without slack the content width lands exactly on the sum, and
 * any sub-pixel overflow makes flex-wrap drop the last card to a new row. The
 * slack gives the row breathing room so it stays intact. Kept small so it
 * doesn't visibly de-centre the grid.
 */
export const FIT_ROW_SLACK = 12;

/*
 * Starting per-card zoom by count: few cards big, many cards start smaller.
 * The height-fit loop in the component only shrinks FURTHER if the rows would
 * overflow the viewport height.
 */
export function baseZoom(n: number): number {
  if (n <= 2) {
    return 1.18;
  }
  if (n <= 3) {
    return 1.12;
  }
  if (n <= 5) {
    return 1.0;
  }
  if (n <= 7) {
    return 0.92;
  }
  if (n <= 10) {
    return 0.82;
  }
  return 0.74;
}

export type RowPlan = {
  singleRow: boolean;
  cols: number;
  zoom: number;
  slotW: number;
  contentW: number;
};

export type RowPlanInput = {
  n: number;
  naturalW: number; // one slot's width at zoom 1, measured by the component
  availW: number;   // usable width (already capped to FIT_MAX_CONTENT_W / viewport)
  gap: number;      // column-gap between slots
  padX: number;     // left + right padding of the content box
  // The height-fit loop passes a shrunk zoom here to re-plan at a smaller
  // scale. When omitted, the plan picks the width-fit start zoom itself.
  zoom?: number;
};

/*
 * Decide column count, per-card zoom and the content width for one fit pass.
 *
 * For a SMALL pick (n <= FIT_SINGLE_ROW_MAX): cols = n (one row), and — when
 * choosing the start zoom — cap it by WIDTH so the whole row fits availW with
 * FIT_ROW_SLACK to spare. For a larger pick: derive a balanced column count
 * that fits the width, rebalanced so rows are even (never 5+1).
 *
 * The returned contentW already includes the slack for single-row plans and is
 * capped to availW so it never bursts the modal frame.
 */
export function cardSelectionRowPlan(input: RowPlanInput): RowPlan {
  const {n, naturalW, availW, gap, padX} = input;
  const singleRow = n > 0 && n <= FIT_SINGLE_ROW_MAX;

  let zoom = input.zoom ?? baseZoom(n);
  // Width-cap the START zoom for a small pick so the single row fits availW
  // (minus slack). Only when no explicit override was supplied by the
  // height-fit loop (that loop only ever shrinks further).
  if (singleRow && input.zoom === undefined) {
    const rowZoom = (availW - padX - (n - 1) * gap - FIT_ROW_SLACK) / (n * naturalW);
    if (rowZoom < zoom) {
      zoom = Math.max(FIT_MIN_ZOOM, rowZoom);
    }
  }

  const slotW = Math.max(naturalW * zoom, FIT_SLOT_MIN_W);
  let cols: number;
  if (singleRow) {
    cols = n;
  } else {
    cols = Math.max(1, Math.min(n, Math.floor((availW - padX + gap) / (slotW + gap))));
    const rows = Math.ceil(n / cols);
    cols = Math.ceil(n / rows);
  }

  const slack = singleRow ? FIT_ROW_SLACK : 0;
  const contentW = Math.min(availW, Math.ceil(cols * slotW + (cols - 1) * gap + padX) + slack);
  return {singleRow, cols, zoom, slotW, contentW};
}
