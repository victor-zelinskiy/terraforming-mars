/**
 * Console HAND DOCK model — the permanent bottom-centre "hand of cards"
 * presence of the console HUD (ConsoleHandDock.vue) + the command-bar BAY
 * split that carves the footer's centre for it (ConsoleCommandBar.vue).
 *
 * PURE presentation math (no Vue/DOM/i18n) so the silhouette contract is
 * unit-testable under the server runner:
 *
 *  - `handDockPlan(count)` — how the pack physically renders for a given
 *    hand size: EVERY card is its own physical back. Up to
 *    HAND_DOCK_DISTINCT_MAX (20) sit on individually readable positions
 *    (the step eases down as the hand grows); beyond that the OLDEST
 *    cards tuck under anchors spread across the whole pack as real dense
 *    thickness — never a decorative slab — while the counter carries the
 *    exact total.
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

/** Cards laid out on individually DISTINGUISHABLE positions; hands beyond
 *  this keep 20 readable edges and stack the rest as REAL dense thickness
 *  (every card is still its own physical element — never a decorative
 *  slab). */
export const HAND_DOCK_DISTINCT_MAX = 20;

/** One card-back silhouette (premium card ratio ~0.7), rem. */
export const HAND_DOCK_CARD_W_REM = 3.15;
export const HAND_DOCK_CARD_H_REM = 4.4;

/** The horizontal band the pack may occupy inside the tray plate, rem. */
export const HAND_DOCK_PACK_USABLE_REM = 11.4;

/** Cap on the x-step between consecutive backs (small hands stay a compact
 *  pack, never a sparse row), rem. */
export const HAND_DOCK_STEP_MAX_REM = 2.05;

/** The subtle symmetric ARC: how far the OUTERMOST cards sit below the
 *  centre card, rem (quadratic falloff — the centre pair stays level). */
const ARC_DIP_REM = 0.12;

/** Overflow thickness micro-offsets: alternate ±x and a slight sink, rem —
 *  a real card tucked under its anchor, readable as depth, never a fan. */
const OVERFLOW_JITTER_X_REM = 0.055;
const OVERFLOW_SINK_Y_REM = 0.07;

/** Max per-step fan tilt in the FOCUSED state, deg (idle is strictly 0). */
const FOCUS_TILT_STEP_MAX_DEG = 1.6;
/** Total edge-to-centre fan bound in the FOCUSED state, deg. */
const FOCUS_TILT_TOTAL_DEG = 6.4;

export type HandDockSlot = {
  /** X offset of the back's centre from the pack centre, rem. */
  dx: number,
  /** Y offset (the subtle arc / an overflow card's sink), rem. */
  dy: number,
  /** The FOCUSED-state fan tilt, deg (applied only while focused). */
  tilt: number,
  /** A dense-thickness card (beyond the 20 distinct positions): tucked
   *  under its anchor, cheaply drawn (no drop shadow, dimmed). */
  deep: boolean,
};

export type HandDockPlan = {
  /** EVERY card's placement, index 0 = oldest … last = newest. The FIRST
   *  `overflow` entries are the deep-thickness cards (oldest, lowest z);
   *  the remaining `distinct` entries hold the readable-edge positions. */
  slots: ReadonlyArray<HandDockSlot>,
  /** Cards on individually readable positions (min(count, 20)). */
  distinct: number,
  /** Cards folded into the dense thickness (count − distinct). */
  overflow: number,
  empty: boolean,
};

/**
 * The physical pack layout for a hand of `count` cards. Geometry depends on
 * the TOTAL count only (playability never reshapes the pack):
 *  - every card is a slot (one card — one physical element);
 *  - up to 20 cards spread symmetrically around the centre axis, the step
 *    easing down from STEP_MAX (roomy small hands) to the ~0.43rem edge a
 *    20-card hand reads at; an odd hand centres its middle card ON the
 *    axis, an even hand centres BETWEEN the middle pair;
 *  - beyond 20, the OLDEST cards anchor evenly across the whole pack
 *    (never one flank) with micro offsets — real, dense thickness;
 *  - a subtle symmetric arc dips the outer cards a couple px (§premium
 *    hand read; the centre stays level).
 */
export function handDockPlan(count: number): HandDockPlan {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) {
    return {slots: [], distinct: 0, overflow: 0, empty: true};
  }
  const distinct = Math.min(n, HAND_DOCK_DISTINCT_MAX);
  const overflow = n - distinct;
  const step = distinct === 1 ? 0 : Math.min(
    HAND_DOCK_STEP_MAX_REM,
    (HAND_DOCK_PACK_USABLE_REM - HAND_DOCK_CARD_W_REM) / (distinct - 1),
  );
  const tiltStep = distinct === 1 ? 0 : Math.min(
    FOCUS_TILT_STEP_MAX_DEG,
    FOCUS_TILT_TOTAL_DEG / (distinct - 1),
  );
  const mid = (distinct - 1) / 2;
  const distinctSlots: Array<HandDockSlot> = [];
  for (let i = 0; i < distinct; i++) {
    const norm = mid === 0 ? 0 : (i - mid) / mid; // −1 .. 1 across the pack
    distinctSlots.push({
      dx: round2((i - mid) * step),
      dy: round2(norm * norm * ARC_DIP_REM),
      tilt: round2((i - mid) * tiltStep),
      deep: false,
    });
  }
  // The dense thickness: each overflow card (oldest first) anchors to a
  // distinct position, spread EVENLY across the pack, tucked under it with
  // alternating micro x-offsets and a slight sink.
  const deepSlots: Array<HandDockSlot> = [];
  for (let j = 0; j < overflow; j++) {
    const anchor = distinctSlots[overflow === 1 ?
      Math.floor((distinct - 1) / 2) :
      Math.round(j * (distinct - 1) / (overflow - 1))];
    deepSlots.push({
      dx: round2(anchor.dx + (j % 2 === 0 ? -OVERFLOW_JITTER_X_REM : OVERFLOW_JITTER_X_REM)),
      dy: round2(anchor.dy + OVERFLOW_SINK_Y_REM),
      tilt: anchor.tilt,
      deep: true,
    });
  }
  return {slots: [...deepSlots, ...distinctSlots], distinct, overflow, empty: false};
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
