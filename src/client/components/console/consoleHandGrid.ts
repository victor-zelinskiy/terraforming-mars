/*
 * consoleHandGrid — PURE, DOM-free layout + navigation math for the console
 * hand SMART GRID (the rework of the legacy horizontal carousel).
 *
 * The section measures its live container box (availW/availH) and the card
 * COUNT and feeds them here; this module decides — without a DOM — the card
 * SCALE, the COLUMN count, the per-row STRIDE, and whether the grid SCROLLS.
 * The section then windows the rows (only the visible rows + overscan are
 * rendered) using the returned `rowStride`/`contentH`.
 *
 * Mirrors the two existing pure planners (playedTableauFit / cardSelectionFit):
 *  - few cards / wide screen  → bigger, readable cards, centred, no scroll;
 *  - many cards               → a balanced grid that scrolls vertically, always
 *    keeping at least MIN_VISIBLE_ROWS readable rows on screen at once.
 *
 * Card scale is applied via CSS `zoom` (like every other dense surface here) —
 * `zoom` scales the LAYOUT box, so `slotH`/`rowStride`/`contentH` are all in the
 * same measured space the section reads back from `scrollTop`/`offsetHeight`.
 */

import {UnplayableReason} from '@/common/cards/UnplayableReason';

/** Natural card-container width (`cards.less .filterDiv { width: 300px }`). */
export const CARD_NATURAL_W = 300;
/** Natural FULL project-card height (matches playedTableauFit.FIT.cardNaturalH). */
export const CARD_NATURAL_H = 415;
/** Column gap (px) — MUST match the CSS `.con-hand__row` gap. */
export const GAP_X = 16;
/** Row gap (px) — MUST match the CSS row margin. */
export const GAP_Y = 16;
/** Readable ceiling on columns (a TV grid never wants tiny cards spread thin). */
export const MAX_COLS = 6;
/** The grid scrolls, so it can afford a slightly higher floor than the modal. */
export const MIN_ZOOM = 0.5;
/** Console cards stay TV-readable; never upscale the raster art past this. */
export const MAX_ZOOM = 0.78;
/** When the grid scrolls, keep at least this many rows visible at once. */
export const MIN_VISIBLE_ROWS = 2;
/*
 * Horizontal slack (px) taken off the usable width before the column fit. CSS
 * `zoom` rounds each card to whole device pixels, so N slots can be a few px
 * wider than `N * slotW`; without the slack a sub-pixel overflow would spawn a
 * stray horizontal scrollbar (same defense as cardSelectionFit.FIT_ROW_SLACK).
 */
export const ROW_SLACK = 12;

export interface HandGridPlan {
  /** Columns in every full row. */
  cols: number;
  /** Total rows = ceil(count / cols). */
  rows: number;
  /** Applied card scale (`--con-hand-zoom`). */
  cardZoom: number;
  /** One slot's px width/height at the applied zoom. */
  slotW: number;
  slotH: number;
  /** Vertical distance between consecutive row tops (`slotH + gapY`). */
  rowStride: number;
  gapX: number;
  gapY: number;
  /** The grid's natural width/height at the applied zoom. */
  contentW: number;
  contentH: number;
  /** true → content exceeds the box; the section windows + shows the scrollbar. */
  scrolls: boolean;
  /** How many rows fit in the box at once (for the "Row X / Y" indicator). */
  visibleRows: number;
}

export interface HandGridInput {
  availW: number;
  availH: number;
  count: number;
  naturalCardW?: number;
  naturalCardH?: number;
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Starting per-card zoom by hand size: few cards big, many cards compact. The
 * height-fit pass below only ever shrinks this further (never grows it).
 */
export function baseZoom(n: number): number {
  if (n <= 4) {
    return 0.72;
  }
  if (n <= 8) {
    return 0.66;
  }
  if (n <= 12) {
    return 0.62;
  }
  if (n <= 18) {
    return 0.58;
  }
  return 0.55;
}

/**
 * Plan the grid for `count` cards in an `availW × availH` box. Returns the
 * columns, applied zoom, row stride and whether it scrolls. Pure — the section
 * feeds measured box dimensions and windows the rows from `rowStride`.
 */
export function planHandGrid(input: HandGridInput): HandGridPlan {
  const naturalW = input.naturalCardW ?? CARD_NATURAL_W;
  const naturalH = input.naturalCardH ?? CARD_NATURAL_H;
  const count = Math.max(0, Math.floor(input.count));
  const {availW, availH} = input;

  if (count <= 0 || availW <= 0 || availH <= 0) {
    const z = MAX_ZOOM;
    return {
      cols: 1, rows: 0, cardZoom: z,
      slotW: naturalW * z, slotH: naturalH * z, rowStride: naturalH * z + GAP_Y,
      gapX: GAP_X, gapY: GAP_Y, contentW: 0, contentH: 0, scrolls: false, visibleRows: 0,
    };
  }

  // Width-derived column count at a given zoom, clamped to [1, MAX_COLS, count]
  // then anti-orphan rebalanced (rows = ceil(n/cols); cols = ceil(n/rows)) so a
  // last row is never a lone card (the 5+1 → 3+3 trick, like cardSelectionFit).
  const colsAt = (zoom: number): number => {
    const slotW = naturalW * zoom;
    const widthCols = Math.floor((availW - ROW_SLACK + GAP_X) / (slotW + GAP_X));
    const cols = clamp(1, Math.min(MAX_COLS, count), widthCols);
    const rows = Math.ceil(count / cols);
    return Math.max(1, Math.ceil(count / rows));
  };

  let zoom = clamp(MIN_ZOOM, MAX_ZOOM, baseZoom(count));
  let cols = colsAt(zoom);
  let rows = Math.ceil(count / cols);
  let rowStride = naturalH * zoom + GAP_Y;
  let visibleRows = Math.max(1, Math.floor((availH + GAP_Y) / rowStride));

  // If it scrolls but fewer than MIN_VISIBLE_ROWS fit, shrink the zoom (floored
  // at MIN_ZOOM) so at least MIN_VISIBLE_ROWS readable rows are on screen — a
  // smaller zoom also widens the columns, which lowers the row count too.
  if (rows > visibleRows && visibleRows < MIN_VISIBLE_ROWS) {
    const fitZoom = (availH - (MIN_VISIBLE_ROWS - 1) * GAP_Y) / (MIN_VISIBLE_ROWS * naturalH);
    zoom = clamp(MIN_ZOOM, zoom, fitZoom);
    cols = colsAt(zoom);
    rows = Math.ceil(count / cols);
    rowStride = naturalH * zoom + GAP_Y;
    visibleRows = Math.max(1, Math.floor((availH + GAP_Y) / rowStride));
  }

  const slotW = naturalW * zoom;
  const slotH = naturalH * zoom;
  const contentH = rows * slotH + (rows - 1) * GAP_Y;
  const contentW = Math.min(availW, cols * slotW + (cols - 1) * GAP_X);
  const scrolls = contentH > availH + 0.5;

  return {
    cols, rows, cardZoom: zoom, slotW, slotH, rowStride,
    gapX: GAP_X, gapY: GAP_Y, contentW, contentH, scrolls,
    visibleRows: Math.min(rows, visibleRows),
  };
}

export type HandNavDir = 'left' | 'right' | 'up' | 'down';

/**
 * Move the flat selection `index` across a `cols`-wide grid of `count` cards.
 *  - left/right: ±1 across the flat list, clamped to [0, count-1] (NO wrap — the
 *    edge is felt, matching the flat "N / total" counter and RT next-playable);
 *  - up/down:    ±cols with COLUMN PRESERVATION, clamped into the (possibly
 *    partial) last row; the top/bottom edges stay put (no wrap).
 * Pure — the section reads `cols` from its plan and writes back `handIndex`.
 */
export function stepHandGrid(index: number, dir: HandNavDir, count: number, cols: number): number {
  if (count <= 0) {
    return 0;
  }
  const c = Math.max(1, cols);
  const i = clamp(0, count - 1, index);
  const row = Math.floor(i / c);
  const col = i % c;
  const rows = Math.ceil(count / c);
  switch (dir) {
  case 'left':
    return Math.max(0, i - 1);
  case 'right':
    return Math.min(count - 1, i + 1);
  case 'up':
    // The upper row is always full, so the column is always valid.
    return row === 0 ? i : (row - 1) * c + col;
  case 'down':
    // Land in the row below at the same column; a partial last row clamps to
    // its last card (Math.min), which is the nearest column that exists there.
    return row >= rows - 1 ? i : Math.min(count - 1, (row + 1) * c + col);
  default:
    return i;
  }
}

/**
 * A COMPACT blocker chip label for an unplayable card in the grid (the full
 * reason lives in the selected-card info panel). Derived from the PRIMARY
 * (first) structured reason's `type`; the full English reason `message` is
 * inspected only to name the specific global parameter. Returns an English
 * i18n KEY (translated by the component) or `undefined` when playable.
 */
export function shortBlockerLabel(reasons: ReadonlyArray<UnplayableReason>): string | undefined {
  const r = reasons[0];
  if (r === undefined) {
    return undefined;
  }
  switch (r.type) {
  case 'megacredits':
    return 'Not enough M€';
  case 'placement':
    return 'No space';
  case 'target':
    return 'No target';
  case 'tag':
    return 'Tag needed';
  case 'production':
    return 'Production';
  case 'party':
    return 'Politics';
  case 'tr':
    return 'Rating';
  case 'resource':
    return 'Resource';
  case 'globalParameter':
    // Structural parameter from the server (language-independent). The
    // message-word probe is a fallback only for older data predating the field.
    return globalParameterLabelOf(r.globalParameter) ?? globalParameterLabel(r.message);
  case 'turn':
  case 'phase':
    return 'Wait';
  case 'count':
  case 'rule':
  case 'generic':
  default:
    return 'Condition';
  }
}

/** The compact label for a structural global-parameter reason field. */
function globalParameterLabelOf(param: UnplayableReason['globalParameter']): string | undefined {
  switch (param) {
  case 'temperature': return 'Temperature';
  case 'venus': return 'Venus';
  case 'oceans': return 'Oceans';
  case 'oxygen': return 'Oxygen';
  default: return undefined;
  }
}

/** Legacy fallback: name the parameter by probing the English message text. */
function globalParameterLabel(message: string): string {
  if (message.includes('°C')) {
    return 'Temperature';
  }
  if (message.includes('Venus')) {
    return 'Venus';
  }
  if (message.includes('ocean')) {
    return 'Oceans';
  }
  if (message.includes('oxygen')) {
    return 'Oxygen';
  }
  return 'Condition';
}
