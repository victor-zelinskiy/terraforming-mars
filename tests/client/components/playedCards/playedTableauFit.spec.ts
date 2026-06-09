import {expect} from 'chai';
import {
  balancedChunks,
  maxColumnsForWidth,
  planTableau,
  planTableauSection,
  PLAN_DEFAULTS,
} from '@/client/components/playedCards/playedTableauFit';

// Realistic project-card metrics (cards.less `.card-container { width: 300px }`,
// played overlay COL_GAP = 14, a mid zoom 0.5 → cardW = 150).
const CARD_W = 150;
const GAP = 14;

describe('playedTableauFit.balancedChunks', () => {
  it('splits evenly with larger chunks first', () => {
    expect(balancedChunks(16, 3)).to.deep.equal([6, 5, 5]);
    expect(balancedChunks(9, 3)).to.deep.equal([3, 3, 3]);
    expect(balancedChunks(10, 4)).to.deep.equal([3, 3, 2, 2]);
  });

  it('clamps columns to [1, count] and always sums to count', () => {
    expect(balancedChunks(3, 9)).to.deep.equal([1, 1, 1]); // never more columns than cards
    expect(balancedChunks(5, 1)).to.deep.equal([5]);
    for (const [n, c] of [[16, 3], [32, 5], [7, 2], [1, 1]] as const) {
      const chunks = balancedChunks(n, c);
      expect(chunks.reduce((s, x) => s + x, 0), `${n}/${c}`).to.equal(n);
    }
  });
});

describe('playedTableauFit.maxColumnsForWidth', () => {
  it('counts how many card+gap columns fit the width', () => {
    // 6 cards of 150 + 5 gaps of 14 = 970 ≤ 1000; a 7th (1134) overflows.
    expect(maxColumnsForWidth(1000, CARD_W, GAP)).to.equal(6);
    expect(maxColumnsForWidth(150, CARD_W, GAP)).to.equal(1);
    expect(maxColumnsForWidth(10, CARD_W, GAP)).to.equal(1); // never below 1
  });
});

describe('playedTableauFit.planTableauSection', () => {
  it('lays a FEW cards out as a roomy full-card grid (no peek)', () => {
    const plan = planTableauSection({key: 'event', count: 3}, 1200, CARD_W, GAP);
    expect(plan.layout).to.equal('grid');
    expect(plan.peek).to.equal(false);
    expect(plan.chunks).to.have.length(0);
  });

  it('lays MANY cards out as vertical peek columns', () => {
    const plan = planTableauSection({key: 'automated', count: 32}, 1400, CARD_W, GAP);
    expect(plan.layout).to.equal('columns');
    // chunks sum to the card count and never exceed the width budget.
    expect(plan.chunks.reduce((s, x) => s + x, 0)).to.equal(32);
    expect(plan.columns).to.equal(plan.chunks.length);
    expect(plan.columns).to.be.at.most(maxColumnsForWidth(1400, CARD_W, GAP));
    expect(plan.columns).to.be.at.least(PLAN_DEFAULTS.minColumns);
    // 32 cards in a handful of columns → tall columns → peek.
    expect(plan.peek).to.equal(true);
  });

  it('never plans more columns than fit the width (narrow viewport)', () => {
    // Width fits only 2 columns; a big section must cap there (taller columns),
    // never overflow horizontally.
    const narrow = 2 * CARD_W + GAP + 4;
    const plan = planTableauSection({key: 'active', count: 30}, narrow, CARD_W, GAP);
    expect(plan.columns).to.be.at.most(2);
    expect(plan.chunks.reduce((s, x) => s + x, 0)).to.equal(30);
  });

  it('a medium section uses a couple of balanced columns', () => {
    const plan = planTableauSection({key: 'active', count: 12}, 1400, CARD_W, GAP);
    expect(plan.layout).to.equal('columns');
    // 12 cards / target 6 = 2 columns of 6 (balanced).
    expect(plan.columns).to.equal(2);
    expect(plan.chunks).to.deep.equal([6, 6]);
  });

  it('handles an empty section without throwing', () => {
    const plan = planTableauSection({key: 'event', count: 0}, 1200, CARD_W, GAP);
    expect(plan.layout).to.equal('grid');
    expect(plan.chunks).to.have.length(0);
  });
});

describe('playedTableauFit.planTableau', () => {
  it('plans each section independently', () => {
    const plans = planTableau(
      [{key: 'active', count: 16}, {key: 'automated', count: 32}, {key: 'event', count: 3}],
      1500,
      CARD_W,
      GAP,
    );
    expect(plans.map((p) => p.key)).to.deep.equal(['active', 'automated', 'event']);
    expect(plans[2].layout).to.equal('grid'); // 3 events → grid
    expect(plans[0].layout).to.equal('columns'); // 16 active → columns
    expect(plans[1].layout).to.equal('columns'); // 32 automated → columns
  });
});
