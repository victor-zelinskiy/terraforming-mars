import {expect} from 'chai';
import {
  cardSelectionRowPlan,
  FIT_MAX_CONTENT_W,
  FIT_MIN_ZOOM,
  FIT_SINGLE_ROW_MAX,
} from '@/client/components/cardSelectionFit';

// Mirror the component's availW derivation so the test exercises the real
// viewport→availW mapping (cap to FIT_MAX_CONTENT_W and to the viewport).
const VIEWPORT_W_MARGIN = 80;
function availWFor(innerWidth: number): number {
  return Math.max(320, Math.min(FIT_MAX_CONTENT_W, innerWidth - VIEWPORT_W_MARGIN));
}

// A row physically fits on one line iff the sum of the slot widths + the gaps
// between them is no wider than the grid's content box (contentW minus padX).
// This is exactly the condition the browser's flex-wrap evaluates.
function rowFits(plan: {cols: number; slotW: number; contentW: number}, gap: number, padX: number): boolean {
  const need = plan.cols * plan.slotW + (plan.cols - 1) * gap;
  const have = plan.contentW - padX;
  return have >= need;
}

// Realistic grid metrics (from card_selection.less): card-container ~300px,
// column-gap 22px. padX is the FULL horizontal inset between the content width
// and the slots: `.card-selection` padding (18+18) PLUS the grid's own
// `.card-selection__cards` padding (4+4). The component sums both — forgetting
// the grid's 8px was the root cause of the last-card-wraps bug.
const NATURAL_W = 300;
const GAP = 22;
const PAD_X = 18 + 18 + 4 + 4;

describe('cardSelectionRowPlan — single-row guarantee for small picks', () => {
  // The regression the player hit: 3 cards rendered 2+1, 4 cards rendered 3+1.
  // Cause was a content width computed EXACTLY equal to the slot sum, so any
  // sub-pixel overflow wrapped the last card. The plan must give every small
  // pick (n ≤ 4) exactly ONE row WITH horizontal slack.
  for (const n of [1, 2, 3, 4]) {
    it(`keeps ${n} card(s) on a single row at a typical desktop width (1920)`, () => {
      const availW = availWFor(1920);
      const plan = cardSelectionRowPlan({n, naturalW: NATURAL_W, availW, gap: GAP, padX: PAD_X});

      expect(plan.singleRow, 'n ≤ 4 must be treated as a single-row pick').to.eq(true);
      expect(plan.cols, 'columns must equal the card count (one row)').to.eq(n);
      // The crucial assertion: the row must have STRICTLY more room than the
      // slot sum needs — i.e. real slack, not an exactly-flush width that
      // flex-wrap can bump.
      const need = plan.cols * plan.slotW + (plan.cols - 1) * GAP;
      const have = plan.contentW - PAD_X;
      expect(have, `row must fit with slack (need ${need}, have ${have})`).to.be.greaterThan(need);
      // Never wider than the available width (would burst the modal frame).
      expect(plan.contentW).to.be.most(availW);
    });
  }

  it('5+ cards are NOT forced to one row (balanced grid)', () => {
    const availW = availWFor(1920);
    const plan = cardSelectionRowPlan({n: 5, naturalW: NATURAL_W, availW, gap: GAP, padX: PAD_X});
    expect(plan.singleRow).to.eq(false);
    expect(plan.cols).to.be.lessThan(5);
  });

  it('FIT_SINGLE_ROW_MAX is the cutoff: that count is single-row, one more is not', () => {
    const availW = availWFor(1920);
    const atMax = cardSelectionRowPlan({n: FIT_SINGLE_ROW_MAX, naturalW: NATURAL_W, availW, gap: GAP, padX: PAD_X});
    const overMax = cardSelectionRowPlan({n: FIT_SINGLE_ROW_MAX + 1, naturalW: NATURAL_W, availW, gap: GAP, padX: PAD_X});
    expect(atMax.singleRow).to.eq(true);
    expect(overMax.singleRow).to.eq(false);
  });

  it('shrinks the start zoom on a narrower viewport but still keeps one row', () => {
    // 900px window → availW 820. 4 full-size cards (4×300 + gaps) overflow, so
    // the plan must scale zoom down rather than wrap to 3+1.
    const availW = availWFor(900);
    const plan = cardSelectionRowPlan({n: 4, naturalW: NATURAL_W, availW, gap: GAP, padX: PAD_X});
    expect(plan.cols).to.eq(4);
    expect(plan.zoom, 'zoom must drop below 1 to fit the narrower row').to.be.lessThan(1);
    expect(plan.zoom).to.be.least(FIT_MIN_ZOOM);
    expect(rowFits(plan, GAP, PAD_X), 'row still fits on one line after shrink').to.eq(true);
    expect(plan.contentW).to.be.most(availW);
  });

  it('height-fit re-plan (explicit zoom override) keeps cols pinned to n', () => {
    // The component's height-fit loop re-plans with a shrunk zoom. A small pick
    // must stay one row (cols = n) and still fit horizontally.
    const availW = availWFor(1920);
    const plan = cardSelectionRowPlan({n: 4, naturalW: NATURAL_W, availW, gap: GAP, padX: PAD_X, zoom: 0.7});
    expect(plan.cols).to.eq(4);
    expect(plan.zoom).to.eq(0.7);
    expect(rowFits(plan, GAP, PAD_X)).to.eq(true);
  });

  it('the previous 3-card case (regression) now fits one row across desktop widths', () => {
    for (const innerWidth of [1280, 1440, 1600, 1920, 2560]) {
      const availW = availWFor(innerWidth);
      const plan = cardSelectionRowPlan({n: 3, naturalW: NATURAL_W, availW, gap: GAP, padX: PAD_X});
      expect(plan.cols, `3 cards must be one row at ${innerWidth}px`).to.eq(3);
      expect(rowFits(plan, GAP, PAD_X), `row fits at ${innerWidth}px`).to.eq(true);
    }
  });
});
