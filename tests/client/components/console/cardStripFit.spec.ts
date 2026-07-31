import {expect} from 'chai';
import {fitRowZoom} from '@/client/console/cardStripFit';

/**
 * The SHARED row-fit formula — the single size source behind the buy pick's
 * strip AND the embedded drawn reveal. These numbers pin the formula itself:
 * a change here re-sizes BOTH stages together (which is the point), so the
 * spec exists to make an accidental one-sided drift impossible to reintroduce
 * without noticing.
 */
describe('fitRowZoom — one size source for buy and reveal', () => {
  const slot = {slotW: 340, slotH: 480};

  it('a lone hero fills the vertical band (height-bound)', () => {
    const zoom = fitRowZoom({availW: 900, availH: 620, ...slot, n: 1, colGap: 14, ui: 1});
    // hZoom = 620/480 ≈ 1.292 < wZoom (0.96*900/340 ≈ 2.54) < cap 1.6.
    expect(zoom).to.be.closeTo(620 / 480, 1e-9);
  });

  it('a wide row is width-bound with the focus-lift headroom (0.96)', () => {
    const zoom = fitRowZoom({availW: 900, availH: 620, ...slot, n: 4, colGap: 14, ui: 1});
    const wZoom = (0.96 * 900 - 3 * 14) / (4 * 340);
    expect(zoom).to.be.closeTo(wZoom, 1e-9);
  });

  it('caps at 1.6×ui — a huge band never balloons the card', () => {
    expect(fitRowZoom({availW: 4000, availH: 4000, ...slot, n: 1, colGap: 14, ui: 1})).to.eq(1.6);
  });

  it('floors at 0.5×ui — a starved band never crushes it unreadable', () => {
    expect(fitRowZoom({availW: 200, availH: 100, ...slot, n: 6, colGap: 14, ui: 1})).to.eq(0.5);
  });

  it('cap and floor ride the TV rem factor', () => {
    expect(fitRowZoom({availW: 8000, availH: 8000, ...slot, n: 1, colGap: 14, ui: 2})).to.eq(3.2);
    expect(fitRowZoom({availW: 200, availH: 100, ...slot, n: 6, colGap: 14, ui: 2})).to.eq(1);
  });
});
