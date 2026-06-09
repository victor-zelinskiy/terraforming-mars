import {expect} from 'chai';
import {
  allocateColumns,
  balancedChunks,
  FIT,
  planProjectBand,
} from '@/client/components/playedCards/playedTableauFit';

const NAT_H = 410;

describe('playedTableauFit.balancedChunks', () => {
  it('splits evenly with larger chunks first and always sums to count', () => {
    expect(balancedChunks(16, 3)).to.deep.equal([6, 5, 5]);
    expect(balancedChunks(9, 3)).to.deep.equal([3, 3, 3]);
    expect(balancedChunks(3, 9)).to.deep.equal([1, 1, 1]); // never more columns than cards
    for (const [n, c] of [[40, 5], [24, 3], [15, 2], [1, 1]] as const) {
      expect(balancedChunks(n, c).reduce((s, x) => s + x, 0), `${n}/${c}`).to.equal(n);
    }
  });
});

describe('playedTableauFit.allocateColumns', () => {
  it('gives more columns to the heavier (more crowded) groups', () => {
    // 8 columns over Automated(40) / Active(24) / Events(15).
    expect(allocateColumns([40, 24, 15], 8)).to.deep.equal([5, 2, 1]);
  });

  it('never exceeds a section card count and always gives at least 1', () => {
    expect(allocateColumns([2, 2], 10)).to.deep.equal([2, 2]); // capped at count
    expect(allocateColumns([5, 1, 1], 3)).to.deep.equal([1, 1, 1]); // 1 each (budget = sections)
  });
});

describe('playedTableauFit.planProjectBand', () => {
  const sections = [{key: 'active', count: 24}, {key: 'automated', count: 40}, {key: 'event', count: 15}];

  it('keeps the zoom within bounds and chunks consistent', () => {
    const plan = planProjectBand(sections, 1900, 700, NAT_H);
    expect(plan.zoom).to.be.within(FIT.minZoom, FIT.maxZoom);
    plan.sections.forEach((s) => {
      expect(s.columns).to.equal(s.chunks.length);
      const total = s.chunks.reduce((a, b) => a + b, 0);
      const orig = sections.find((x) => x.key === s.key)!.count;
      expect(total, s.key).to.equal(orig);
    });
  });

  it('allocates more columns to the heavier group', () => {
    const plan = planProjectBand(sections, 1900, 700, NAT_H);
    const cols = Object.fromEntries(plan.sections.map((s) => [s.key, s.columns]));
    expect(cols.automated).to.be.at.least(cols.active);
    expect(cols.active).to.be.at.least(cols.event);
  });

  it('NEVER clips the title — a peeked card always shows at least the min peek', () => {
    // A dense, short band forces peeking; the peek must still show the title.
    const plan = planProjectBand([{key: 'automated', count: 60}], 1400, 400, NAT_H);
    expect(plan.peek).to.equal(true);
    expect(plan.peekNatural).to.be.at.least(FIT.minPeekNatural);
  });

  it('GROWS for few cards — big, full cards, no peek (spacious)', () => {
    const plan = planProjectBand([{key: 'active', count: 3}], 1900, 700, NAT_H);
    expect(plan.zoom).to.equal(FIT.maxZoom);
    expect(plan.peek).to.equal(false); // full cards, nothing cut off
    expect(plan.density).to.equal('spacious');
  });

  it('PREFERS full cards when a roomy area can show them all', () => {
    // 54 cards in a big area → every card shown FULL (no peek), filling width.
    const plan = planProjectBand([{key: 'active', count: 24}, {key: 'automated', count: 30}], 2600, 1500, NAT_H);
    expect(plan.peek).to.equal(false);
    expect(plan.zoom).to.be.within(FIT.fullMinZoom, FIT.maxZoom);
  });

  it('uses MORE of a wide screen — bigger cards than a narrow one', () => {
    const narrow = planProjectBand(sections, 1100, 700, NAT_H);
    const wide = planProjectBand(sections, 2800, 700, NAT_H);
    expect(wide.zoom).to.be.greaterThan(narrow.zoom);
  });

  it('shows cards MORE FULLY when the band is taller', () => {
    const short = planProjectBand([{key: 'automated', count: 40}], 1600, 480, NAT_H);
    const tall = planProjectBand([{key: 'automated', count: 40}], 1600, 1100, NAT_H);
    // More vertical room → fuller cards (a bigger peek strip, or full cards).
    expect(tall.peekNatural).to.be.greaterThan(short.peekNatural);
    expect(short.peekNatural).to.be.at.least(FIT.minPeekNatural); // title always shown
  });

  it('handles an empty band without throwing', () => {
    const plan = planProjectBand([], 1900, 700, NAT_H);
    expect(plan.sections).to.have.length(0);
    expect(plan.zoom).to.be.within(FIT.minZoom, FIT.maxZoom);
  });
});
