/*
 * CONSOLE COLONIES — the PURE layout/navigation model behind the premium
 * tile grid (ConsoleColoniesSection) + the reactive UI mirror the shell's
 * bottom command bar reads while the trade composer / colony inspect own
 * the pad (the consoleHydroUi pattern — the bar never guesses).
 *
 * The in-game colony count is 1–6 (5 in a typical game, 6 with a bonus
 * tile), so the MAIN layouts are designed per count: 1–4 = one centred row
 * of large tiles, 5 = a deliberate 3+2 composition, 6 = a 3×2 grid. The
 * rare "add a new colony tile" catalog (Aridor — possibly >6 candidates)
 * keeps a compact wrap grid and is visually a different mode.
 */

import {reactive} from 'vue';

export type ColonyGridLayout = 'solo' | 'few' | 'five' | 'six' | 'catalog';

/** Which premium layout the tile grid uses for `count` colonies. */
export function colonyGridLayout(count: number, catalogMode: boolean): ColonyGridLayout {
  if (catalogMode && count > 6) {
    return 'catalog';
  }
  if (count <= 1) {
    return 'solo';
  }
  if (count <= 4) {
    return 'few';
  }
  if (count === 5) {
    return 'five';
  }
  if (count === 6) {
    return 'six';
  }
  return 'catalog';
}

/** Columns per layout — drives both CSS and the d-pad 2D stepping. */
export function colonyGridCols(layout: ColonyGridLayout, count: number): number {
  switch (layout) {
  case 'solo': return 1;
  case 'few': return Math.max(1, count);
  case 'five': return 3; // 3 + 2 (second row centred)
  case 'six': return 3; // 3 × 2
  case 'catalog': return 4;
  default: return Math.max(1, count);
  }
}

/**
 * 2D d-pad stepping over the tile grid: left/right walk within the row,
 * up/down jump a whole row (clamped to the last tile — the edge is felt,
 * no wrap).
 */
export function colonyNavStep(
  dir: 'up' | 'down' | 'left' | 'right',
  index: number,
  count: number,
  cols: number,
): number {
  if (count <= 0) {
    return 0;
  }
  let next = index;
  switch (dir) {
  case 'left': next = index - 1; break;
  case 'right': next = index + 1; break;
  case 'up': next = index - cols; break;
  case 'down': next = index + cols; break;
  }
  if (next < 0) {
    // Stepping up from the first row keeps the selection (no wrap).
    return dir === 'left' ? Math.max(0, index - 1) : (dir === 'up' ? index : 0);
  }
  if (next >= count) {
    // Stepping down past the end lands on the LAST tile only when moving
    // down from an incomplete final row; horizontal steps clamp.
    return dir === 'down' ? (index + cols >= count + cols ? index : count - 1) :
      (dir === 'right' ? count - 1 : index);
  }
  return next;
}

// ── The bottom command bar's live mirror ────────────────────────────────────
// The trade composer / inspect overlay sync their state here; the shell's
// `commands()` reads it — hints live ONLY in the bottom bar (never inline).

export const consoleColoniesUi = reactive({
  /** The X = «Осмотреть» colony inspect overlay is open. */
  inspectOpen: false,
  /** Trade composer: which sub-surface owns the pad ('' = the review rows). */
  composerSub: '' as '' | 'list' | 'lanes',
  /** Trade composer: every decision is captured — X (confirm) is meaningful. */
  composerReady: false,
  /** Trade composer: the focused row opens something on A. */
  composerEditable: false,
});

export function resetConsoleColoniesUi(): void {
  consoleColoniesUi.inspectOpen = false;
  consoleColoniesUi.composerSub = '';
  consoleColoniesUi.composerReady = false;
  consoleColoniesUi.composerEditable = false;
}
