/*
 * playedTableauFit — PURE layout planner for the played-cards "project band".
 *
 * The overlay's fit engine (`PlayedCardsOverlay.fit`) measures the live DOM to
 * pick a card SCALE, but the COLUMN distribution per project type is a pure
 * function of the card counts + the available width + the chosen card width.
 * Extracting it here keeps that math unit-testable without a DOM (under JSDOM
 * the overlay's `fit()` is a no-op because rects are 0).
 *
 * Per project type-section we decide between two layouts:
 *  - 'grid'    — a few cards: full cards in a wrapping row (roomy, no peek).
 *  - 'columns' — many cards: vertical PEEK-STACK columns (the dense tableau
 *                fan). The section gets enough columns to keep ~targetPerColumn
 *                cards per column, capped by what fits the width and floored at
 *                minColumns so it always reads as "columns", never one tall pile.
 *
 * Cards within a 'columns' section are distributed into BALANCED contiguous
 * chunks (oldest-first), so the piles are even (no 6+1 orphan) and time reads
 * top→bottom within each pile (newest at the bottom, shown full).
 */

export type TableauSectionInput = {
  key: string;
  count: number;
};

export type TableauSectionPlan = {
  key: string;
  layout: 'grid' | 'columns';
  /** Column count (grid: how many full cards fit a row; columns: pile count). */
  columns: number;
  /** Cards per column for 'columns' layout (balanced, sums to count). */
  chunks: ReadonlyArray<number>;
  /** Whether the columns peek-clip (a column tall enough to need compression). */
  peek: boolean;
};

export type TableauPlanOptions = {
  /** count <= this → full-card wrapping grid (no peek). */
  expandMax: number;
  /** Target cards per peek-column (drives how many columns a section gets). */
  targetPerColumn: number;
  /** A column taller than this peeks (clips non-bottom cards to a strip). */
  peekThreshold: number;
  /** A 'columns' section uses at least this many columns (width permitting). */
  minColumns: number;
};

export const PLAN_DEFAULTS: TableauPlanOptions = {
  expandMax: 6,
  // ~8 cards per pile → a typical section (12-20 cards) reads as 2-3 tall
  // fanned columns (the "2-3 columns per type" tableau feel), while a very
  // large section still spreads wider (capped by the width) rather than
  // forcing one giant pile.
  targetPerColumn: 8,
  peekThreshold: 3,
  minColumns: 2,
};

/**
 * Splits `count` items into `columns` contiguous, balanced chunks (larger
 * chunks first), e.g. balancedChunks(16, 3) -> [6, 5, 5]. `columns` is clamped
 * to [1, count].
 */
export function balancedChunks(count: number, columns: number): Array<number> {
  const cols = Math.max(1, Math.min(columns, count));
  const base = Math.floor(count / cols);
  const extra = count % cols;
  const chunks: Array<number> = [];
  for (let i = 0; i < cols; i++) {
    chunks.push(base + (i < extra ? 1 : 0));
  }
  return chunks;
}

/** How many card columns of `cardWidth` (+`gap`) fit `availWidth`. */
export function maxColumnsForWidth(availWidth: number, cardWidth: number, gap: number): number {
  if (cardWidth <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor((availWidth + gap) / (cardWidth + gap)));
}

export function planTableauSection(
  section: TableauSectionInput,
  availWidth: number,
  cardWidth: number,
  gap: number,
  options: Partial<TableauPlanOptions> = {},
): TableauSectionPlan {
  const o = {...PLAN_DEFAULTS, ...options};
  const count = section.count;
  const maxCols = maxColumnsForWidth(availWidth, cardWidth, gap);

  if (count <= 0) {
    return {key: section.key, layout: 'grid', columns: 1, chunks: [], peek: false};
  }

  if (count <= o.expandMax) {
    // Roomy full-card wrap. `columns` is a display hint (the grid wraps via
    // CSS); no peek.
    const columns = Math.max(1, Math.min(count, maxCols));
    return {key: section.key, layout: 'grid', columns, chunks: [], peek: false};
  }

  // Peek-stack columns. Floor at minColumns, aim for ~targetPerColumn cards per
  // column, never exceed the width budget or the card count.
  const desired = Math.ceil(count / o.targetPerColumn);
  let columns = Math.max(o.minColumns, desired);
  columns = Math.min(columns, maxCols, count);
  const chunks = balancedChunks(count, columns);
  const tallest = chunks.length > 0 ? Math.max(...chunks) : 0;
  return {key: section.key, layout: 'columns', columns, chunks, peek: tallest > o.peekThreshold};
}

export function planTableau(
  sections: ReadonlyArray<TableauSectionInput>,
  availWidth: number,
  cardWidth: number,
  gap: number,
  options: Partial<TableauPlanOptions> = {},
): Array<TableauSectionPlan> {
  return sections.map((s) => planTableauSection(s, availWidth, cardWidth, gap, options));
}
