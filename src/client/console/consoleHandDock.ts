/**
 * Console HAND DOCK model — the permanent bottom-centre "hand of cards"
 * presence of the console HUD (ConsoleHandDock.vue) + the command-bar BAY
 * split that carves the footer's centre for it (ConsoleCommandBar.vue).
 *
 * PURE presentation math (no Vue/DOM/i18n) so the silhouette contract is
 * unit-testable under the server runner:
 *
 *  - `handDockPlan(count)` — how the pack physically renders for a given
 *    hand size: up to HAND_DOCK_VISIBLE_MAX real card-back silhouettes
 *    (strictly parallel, horizontally overlapped, count readable from the
 *    silhouette), then the pack stops widening and grows DEPTH instead
 *    (side slabs, the project-deck thickness language) while the counter
 *    carries the exact total.
 *  - `bayCommandSplit(widths, zoneRight)` — the deterministic partition of
 *    the command-bar hints around the centre bay: commands pack from the
 *    RIGHT (the classic right-anchored hint run ending with B/System),
 *    whatever doesn't fit flows to the LEFT zone beside the context label.
 *    Width ESTIMATES only decide the split; the real layout is a CSS grid
 *    whose centre track is mathematically centred on the viewport — the
 *    same axis the RT/LT quick cross centres on (fixed inset:0 + flex).
 *
 * Geometry constants are exported in REM (the console logical space —
 * 1rem = 20px logical; the TV profile scales the rem base, so every value
 * here follows --con-ui-scale for free). The component writes them as CSS
 * vars so LESS and JS can never disagree.
 */

/** Card-back silhouettes rendered before the pack grows depth instead. */
export const HAND_DOCK_VISIBLE_MAX = 6;

/** One card-back silhouette (premium card ratio ~0.7), rem. */
export const HAND_DOCK_CARD_W_REM = 3.15;
export const HAND_DOCK_CARD_H_REM = 4.4;

/** The horizontal band the pack may occupy inside the tray plate, rem. */
export const HAND_DOCK_PACK_USABLE_REM = 11.4;

/** Cap on the x-step between consecutive backs (small hands stay a compact
 *  pack, never a sparse row), rem. */
export const HAND_DOCK_STEP_MAX_REM = 2.05;

/** Max per-step fan tilt in the FOCUSED state, deg (idle is strictly 0). */
const FOCUS_TILT_STEP_MAX_DEG = 1.6;
/** Total edge-to-centre fan bound in the FOCUSED state, deg. */
const FOCUS_TILT_TOTAL_DEG = 6.4;

/** Depth slabs cap (the deckstack tier language). */
const DEPTH_MAX = 3;
/** Hidden cards folded into ONE additional depth slab. */
const DEPTH_PER_SLAB = 4;

export type HandDockSlot = {
  /** X offset of the back's centre from the pack centre, rem. */
  dx: number,
  /** The FOCUSED-state fan tilt, deg (applied only while focused). */
  tilt: number,
};

export type HandDockPlan = {
  /** Rendered card-back silhouettes (≤ HAND_DOCK_VISIBLE_MAX). */
  visible: number,
  /** Per-back placement, index 0 = leftmost/oldest. */
  slots: ReadonlyArray<HandDockSlot>,
  /** Extra edge slabs BEHIND the pack (0..3) — the "more than the
   *  silhouettes show" thickness read. */
  depth: number,
  /** Cards beyond the rendered silhouettes (count − visible). */
  overflow: number,
  empty: boolean,
};

/** The physical pack layout for a hand of `count` cards. */
export function handDockPlan(count: number): HandDockPlan {
  const n = Math.max(0, Math.floor(count));
  const visible = Math.min(n, HAND_DOCK_VISIBLE_MAX);
  if (visible === 0) {
    return {visible: 0, slots: [], depth: 0, overflow: 0, empty: true};
  }
  const step = visible === 1 ? 0 : Math.min(
    HAND_DOCK_STEP_MAX_REM,
    (HAND_DOCK_PACK_USABLE_REM - HAND_DOCK_CARD_W_REM) / (visible - 1),
  );
  const tiltStep = visible === 1 ? 0 : Math.min(
    FOCUS_TILT_STEP_MAX_DEG,
    FOCUS_TILT_TOTAL_DEG / (visible - 1),
  );
  const mid = (visible - 1) / 2;
  const slots: Array<HandDockSlot> = [];
  for (let i = 0; i < visible; i++) {
    slots.push({
      dx: round2((i - mid) * step),
      tilt: round2((i - mid) * tiltStep),
    });
  }
  const overflow = n - visible;
  const depth = overflow <= 0 ? 0 : Math.min(DEPTH_MAX, Math.ceil(overflow / DEPTH_PER_SLAB));
  return {visible, slots, depth, overflow, empty: false};
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/* ── Command-bar BAY geometry ─────────────────────────────────────── */

/** The reserved centre track of the command bar, rem (per layout profile —
 *  the handheld footer is much tighter). The SHELL writes this as
 *  `--con-hd-bay` on the footer; the bar grid and the dock read the var. */
export function handDockBayRem(profile: string): number {
  return profile === 'handheld' ? 12.4 : 16;
}

/**
 * Estimated rendered width of one command-bar hint, rem — sized for the
 * bar's COMPACT bay typography (label .95rem / glyph 1.3rem / gap 1.05rem;
 * see `.con-cmdbar--bay` in console.less). Coarse on purpose — the
 * estimate only balances the split; each zone still clips overflow safely.
 */
export function commandWidthRem(label: string, opts?: {badge?: boolean, twoGlyphs?: boolean}): number {
  const glyphs = opts?.twoGlyphs === true ? 2 : 1;
  return glyphs * 1.55 + // glyph badge(s), pill-average
    (glyphs - 1) * 0.3 + // paired-glyph gap
    0.45 + // glyph→label gap
    label.length * 0.6 +
    (opts?.badge === true ? 1.4 : 0) +
    1.05; // inter-command gap share
}

/** Estimated width of the bay-mode context label (.95rem + tracking), rem. */
export function contextWidthRem(context: string): number {
  return context.length * 0.68 + 1.2;
}

/**
 * Partition the command run around the bay: keep the run's TAIL on the
 * right (the B/System convention), the head beside the context label —
 * choosing the split that minimizes the total overflow of BOTH zones (a
 * right-only greedy pack overflowed the left zone on hint-rich contexts).
 * Ties prefer more on the right. Returns the LEFT-zone command count.
 */
export function bayCommandSplit(widths: ReadonlyArray<number>, zoneLeftRem: number, zoneRightRem: number): number {
  const n = widths.length;
  let best = 0;
  let bestCost = Infinity;
  for (let k = 0; k <= n; k++) {
    let left = 0;
    for (let i = 0; i < k; i++) {
      left += widths[i];
    }
    let right = 0;
    for (let i = k; i < n; i++) {
      right += widths[i];
    }
    const cost = Math.max(0, left - zoneLeftRem) + Math.max(0, right - zoneRightRem);
    // Strict `<`: among equal costs the SMALLEST k (more on the right) wins.
    if (cost < bestCost) {
      bestCost = cost;
      best = k;
    }
  }
  return best;
}
