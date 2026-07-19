/**
 * @deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
 * All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
 * desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
 * here cannot affect console. Fix only what breaks the shared layer or play.
 * See docs/DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
 */
/*
 * playedTableauFit — PURE, area-FILLING layout planner for the played-cards
 * "project band" (Active / Automated / Events).
 *
 * The overlay measures the live DOM for the real card height + identity-band
 * height and feeds them here; this module decides — without a DOM — the card
 * SCALE, the per-section COLUMN distribution, and the PEEK height so the
 * tableau **fills the available box** instead of sitting compressed in a
 * corner. The overlay then does one measured shrink as a safety net.
 *
 * Strategy (the "intelligent system" behaviour):
 *  1. Search the total column count `C` that lets the card zoom be as LARGE as
 *     possible while still fitting BOTH the width and the height. Few cards /
 *     wide screen → big cards (zoom hits MAX); many cards / short screen →
 *     compact. This is what makes the layout GROW into empty space instead of
 *     only ever shrinking.
 *  2. Allocate those columns to sections by crowdedness, so a heavy group
 *     (Automated 40) gets more width than a light one (Events 5) — never blind
 *     equal widths, never a tiny group hogging space.
 *  3. Pick a PEEK height that fills the leftover vertical space, clamped so a
 *     peeked card ALWAYS shows its title (no top clipping) and never exceeds a
 *     full card (then it renders full, no peek). Spacious → fuller cards;
 *     compact → a slim-but-readable peek.
 */

export type ProjectSection = {
  key: string;
  count: number;
};

export type ProjectSectionPlan = {
  key: string;
  /** Number of vertical peek-stack columns for this section. */
  columns: number;
  /** Cards per column (balanced, contiguous, sums to count). */
  chunks: ReadonlyArray<number>;
};

export type Density = 'compact' | 'balanced' | 'spacious';

export type ProjectBandPlan = {
  /** Card scale (`--played-card-zoom`). */
  zoom: number;
  /**
   * Natural px each PEEKED card shows from its top (the slot height is
   * `peekNatural * zoom`). Always >= the title height, so the name never clips.
   */
  peekNatural: number;
  /** false → the cards fit as FULL cards (no clipping at all). */
  peek: boolean;
  density: Density;
  sections: ReadonlyArray<ProjectSectionPlan>;
};

export type FitConstants = {
  /** Natural card-container width (cards.less `.card-container { width: 300px }`). */
  cardNaturalW: number;
  /** Natural FULL card height (the overlay measures the real value; fallback). */
  cardNaturalH: number;
  minZoom: number;
  maxZoom: number;
  /** Column gap (px) — MUST match the CSS `.played-group__columns` gap. */
  gap: number;
  /** Gap between type-sections (px) — MUST match the CSS section gap. */
  sectionGap: number;
  /**
   * Fraction of a full card a peeked card occupies in the column-count search
   * (only an estimate to rank column counts — the real peek is computed after).
   */
  peekFraction: number;
  /** A peeked card always shows at least this many natural px (title visible). */
  minPeekNatural: number;
  /**
   * Below this zoom, FULL cards would be too small → fall back to peek-stacks
   * (which fit the same cards at a larger zoom by overlapping them). Above it,
   * the layout prefers showing every card in FULL (the player wanted fuller
   * cards spread across the width, not tall compressed piles).
   */
  fullMinZoom: number;
  /** Gap between FULL cards stacked in a pile (matches the CSS non-peek gap). */
  fullCardGap: number;
};

export const FIT: FitConstants = {
  // The PREMIUM card face (`.pcard`, 320×460 @ zoom 1) the tableau renders now.
  // The overlay OVERRIDES cardNaturalH with a live per-render measure (clamped
  // [330,470]); the WIDTH is not measured, so this constant governs the column
  // count — it must be the real 320, not the legacy 300 (which packed one column
  // too many and let verifyShrink over-shrink to recover).
  cardNaturalW: 320,
  cardNaturalH: 460,
  minZoom: 0.34,
  // Up to the card's NATURAL size — so a few cards on a big / 4K screen GROW to
  // fill the space (the cards were capped too small before, leaving the right
  // and bottom empty). Never above 1.0 (would upscale the raster art = blur);
  // the identity bumps are kept small in CSS so corp/preludes stay <= 1.0.
  maxZoom: 0.95,
  gap: 16,
  sectionGap: 28,
  peekFraction: 0.3,
  minPeekNatural: 118,
  fullMinZoom: 0.4,
  fullCardGap: 16,
};

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Splits `count` into `columns` contiguous, balanced chunks (larger first),
 * e.g. balancedChunks(16, 3) -> [6, 5, 5]. `columns` clamped to [1, count].
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

/**
 * Distributes `total` columns across sections by CROWDEDNESS: every section
 * starts with 1 column, then each extra column goes to whichever section
 * currently has the most cards-per-column — so heavy groups breathe and small
 * groups don't hog space. Each section gets `[1, count]` columns; the sum is
 * `min(total, sum(counts))`.
 */
export function allocateColumns(counts: ReadonlyArray<number>, total: number): Array<number> {
  const n = counts.length;
  if (n === 0) {
    return [];
  }
  const cols = counts.map(() => 1);
  const sumCounts = counts.reduce((s, c) => s + c, 0);
  const budget = Math.max(n, Math.min(total, sumCounts));
  let used = n;
  while (used < budget) {
    let bestI = -1;
    let bestRatio = -1;
    for (let i = 0; i < n; i++) {
      if (cols[i] >= counts[i]) {
        continue; // never more columns than cards
      }
      const ratio = counts[i] / (cols[i] + 1);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestI = i;
      }
    }
    if (bestI === -1) {
      break; // every section is at its card-count cap
    }
    cols[bestI]++;
    used++;
  }
  return cols;
}

/**
 * Searches the total column count that maximises the card zoom while fitting
 * both width and height. `mode` 'full' stacks FULL cards (gap between them);
 * 'peek' overlaps them to the peek strip. Returns {zoom, C}. widthZoom falls
 * with C, heightZoom rises with C → the best C is where their min is largest;
 * on a tie, MORE columns (spreads the width, fuller piles).
 */
function searchColumns(
  N: number,
  effectiveW: number,
  availHeight: number,
  c: FitConstants,
  mode: 'full' | 'peek',
): {zoom: number; C: number} {
  const hardMaxC = Math.min(N, Math.max(1, Math.floor((effectiveW + c.gap) / (c.cardNaturalW * c.minZoom + c.gap))));
  let bestZoom = -1;
  let bestC = 1;
  for (let C = 1; C <= hardMaxC; C++) {
    const widthZoom = (effectiveW - (C - 1) * c.gap) / (C * c.cardNaturalW);
    const perCol = Math.ceil(N / C);
    let heightZoom: number;
    if (mode === 'full') {
      // perCol full cards stacked with a gap between each.
      heightZoom = (availHeight - (perCol - 1) * c.fullCardGap) / (perCol * c.cardNaturalH);
    } else {
      const heightFactor = (perCol - 1) * c.peekFraction + 1;
      heightZoom = availHeight / (c.cardNaturalH * heightFactor);
    }
    const z = clamp(c.minZoom, c.maxZoom, Math.min(widthZoom, heightZoom));
    if (z > bestZoom + 1e-4 || (Math.abs(z - bestZoom) < 1e-4 && C > bestC)) {
      bestZoom = z;
      bestC = C;
    }
  }
  return {zoom: bestZoom, C: bestC};
}

export function planProjectBand(
  sections: ReadonlyArray<ProjectSection>,
  availWidth: number,
  availHeight: number,
  cardNaturalH: number = FIT.cardNaturalH,
  constants: Partial<FitConstants> = {},
): ProjectBandPlan {
  const c = {...FIT, ...constants, cardNaturalH};
  const live = sections.filter((s) => s.count > 0);
  const N = live.reduce((s, x) => s + x.count, 0);

  if (N === 0 || availWidth <= 0 || availHeight <= 0) {
    return {
      zoom: c.maxZoom,
      peekNatural: c.cardNaturalH,
      peek: false,
      density: 'spacious',
      sections: live.map((s) => ({key: s.key, columns: 1, chunks: balancedChunks(s.count, 1)})),
    };
  }

  // Width the columns actually get (sections sit side by side with a gap each).
  const effectiveW = Math.max(c.cardNaturalW * c.minZoom, availWidth - (live.length - 1) * c.sectionGap);

  // 1. PREFER FULL CARDS. Find the column count that shows every card in FULL
  //    (no peek) at the largest zoom that fits the box. If that zoom is decent
  //    (>= fullMinZoom) we use it — the player wanted fuller cards spread across
  //    the width, not tall compressed piles. Only when there are too many cards
  //    for full cards to stay readable do we fall back to PEEK (which fits the
  //    same cards at a bigger zoom by overlapping them).
  const full = searchColumns(N, effectiveW, availHeight, c, 'full');
  let zoom: number;
  let bestC: number;
  let peek: boolean;
  if (full.zoom >= c.fullMinZoom) {
    zoom = full.zoom;
    bestC = full.C;
    peek = false;
  } else {
    const pk = searchColumns(N, effectiveW, availHeight, c, 'peek');
    zoom = pk.zoom;
    bestC = pk.C;
    peek = true;
  }

  // 2. Allocate the columns to sections by crowdedness.
  const cols = allocateColumns(live.map((s) => s.count), bestC);

  // 3. Peek height: full cards show whole (peekNatural = cardNaturalH); peeked
  //    piles get a strip that fills the leftover height, clamped so the title
  //    always shows and never exceeds a full card.
  let peekNatural = c.cardNaturalH;
  if (peek) {
    let perColMax = 1;
    live.forEach((s, i) => {
      perColMax = Math.max(perColMax, Math.ceil(s.count / cols[i]));
    });
    if (perColMax > 1) {
      peekNatural = (availHeight / zoom - c.cardNaturalH) / (perColMax - 1);
    }
    peekNatural = clamp(c.minPeekNatural, c.cardNaturalH, peekNatural);
    peek = peekNatural < c.cardNaturalH - 1;
  }

  const density: Density =
    zoom >= c.maxZoom - 0.02 ? 'spacious' : zoom <= c.minZoom + 0.06 ? 'compact' : 'balanced';

  return {
    zoom,
    peekNatural,
    peek,
    density,
    sections: live.map((s, i) => ({key: s.key, columns: cols[i], chunks: balancedChunks(s.count, cols[i])})),
  };
}
