/*
 * TAG CLUSTER PLAN — deterministic layout for the premium tag overlay
 * (the medallions pinned OVER the right end of the title plate).
 *
 * The cluster is an OVERLAY: it never participates in the header's layout
 * flow and never narrows the title plate — the plate keeps its full-width
 * silhouette and only the title TEXT reserves a right safe-area equal to
 * the cluster width this plan reports. Pure arithmetic of the tag COUNT
 * (no DOM measuring, no per-frame JS), so the safe-area can be set once
 * as a CSS custom property.
 *
 * Modes:
 *   row     (1–2 tags)  — full-size medallions, small gap;
 *   overlap (3–6 tags)  — compact medallions, controlled overlap
 *                         (leftmost on top — set by the render z-order);
 *   stack   (7+, fan cards) — two compact overlapped rows, last resort.
 */

export type TagClusterMode = 'row' | 'overlap' | 'stack';

export type TagClusterPlan = {
  mode: TagClusterMode;
  /** Medallion diameter, px (design space). */
  size: number;
  /** How much each following medallion tucks under the previous one, px. */
  overlap: number;
  rows: 1 | 2;
  /** Total cluster width, px — drives the title text's right safe-area. */
  width: number;
  count: number;
};

const ROW_GAP = 4;

export function tagClusterPlan(count: number): TagClusterPlan {
  if (count <= 0) {
    return {mode: 'row', size: 30, overlap: 0, rows: 1, width: 0, count: 0};
  }
  if (count <= 2) {
    const size = 30;
    return {mode: 'row', size, overlap: 0, rows: 1, width: count * size + (count - 1) * ROW_GAP, count};
  }
  if (count <= 4) {
    const size = count === 3 ? 26 : 24;
    const overlap = count === 3 ? 7 : 8;
    return {mode: 'overlap', size, overlap, rows: 1, width: size + (count - 1) * (size - overlap), count};
  }
  if (count <= 6) {
    const size = 22;
    const overlap = 9;
    return {mode: 'overlap', size, overlap, rows: 1, width: size + (count - 1) * (size - overlap), count};
  }
  // Fan-card extreme — two dense rows, never a narrower title plate.
  const size = 20;
  const overlap = 8;
  const perRow = Math.ceil(count / 2);
  return {mode: 'stack', size, overlap, rows: 2, width: size + (perRow - 1) * (size - overlap), count};
}
