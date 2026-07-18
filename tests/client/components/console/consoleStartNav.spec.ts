import {expect} from 'chai';
import {nearestInDirection, rowFitZoom, gridFitPlan, RectLike} from '@/client/console/consoleStartNav';

/**
 * The start scene's PURE spatial-navigation + fit maths (DOM-free, so the
 * geometry is unit-tested without a browser — the scene wires these to real
 * rects + the measured slot size).
 */

/** A summary-like layout: a 3-tile top row (corp + 2 preludes) over a 5-tile
 *  project row — the exact mixed-section case the 2D d-pad must handle. */
function summaryRects(): Array<RectLike> {
  const W = 80;
  const H = 100;
  const top = [0, 100, 200].map((left) => ({left, top: 0, width: W, height: H}));
  const bottom = [0, 100, 200, 300, 400].map((left) => ({left, top: 200, width: W, height: H}));
  return [...top, ...bottom]; // 0..2 top, 3..7 bottom
}

describe('consoleStartNav.nearestInDirection', () => {
  const r = summaryRects();

  it('DOWN from a top-row tile lands on the project directly under it', () => {
    expect(nearestInDirection(r, 0, 'down')).to.eq(3); // corp → project below
    expect(nearestInDirection(r, 1, 'down')).to.eq(4);
    expect(nearestInDirection(r, 2, 'down')).to.eq(5);
  });

  it('UP from a project returns to the nearest top-section card', () => {
    expect(nearestInDirection(r, 3, 'up')).to.eq(0);
    expect(nearestInDirection(r, 4, 'up')).to.eq(1);
    // projects 6/7 have no aligned top card → nearest is the last top tile (2)
    expect(nearestInDirection(r, 6, 'up')).to.eq(2);
    expect(nearestInDirection(r, 7, 'up')).to.eq(2);
  });

  it('LEFT / RIGHT move to the row neighbour', () => {
    expect(nearestInDirection(r, 1, 'left')).to.eq(0);
    expect(nearestInDirection(r, 0, 'right')).to.eq(1);
    expect(nearestInDirection(r, 4, 'left')).to.eq(3);
    expect(nearestInDirection(r, 4, 'right')).to.eq(5);
  });

  it('returns -1 (focus stays) when nothing lies in that direction — no wrap', () => {
    expect(nearestInDirection(r, 0, 'left')).to.eq(-1); // leftmost
    expect(nearestInDirection(r, 0, 'up')).to.eq(-1);   // top row, nothing above
    expect(nearestInDirection(r, 7, 'down')).to.eq(-1); // bottom row, nothing below
    expect(nearestInDirection(r, 7, 'right')).to.eq(-1); // rightmost
  });

  it('guards an out-of-range current index', () => {
    expect(nearestInDirection(r, 99, 'down')).to.eq(-1);
    expect(nearestInDirection([], 0, 'up')).to.eq(-1);
  });
});

describe('consoleStartNav.rowFitZoom', () => {
  const base = {n: 4, slotW: 320, slotH: 460, colGap: 30, rowGap: 30, scale: 2};

  it('is WIDTH-limited when many cards share a wide-but-short strip', () => {
    const z = rowFitZoom({...base, availW: 3000, availH: 2000}, 1.35);
    // (0.96*3000 - 3*30)/(4*320) = 2.180…  < heightZoom (2000/460)
    expect(z).to.be.closeTo(2.18, 0.02);
  });

  it('is capped at the ceiling (ceil × scale) when the space is huge', () => {
    const z = rowFitZoom({...base, availW: 99999, availH: 99999}, 1.35);
    expect(z).to.be.closeTo(1.35 * 2, 0.001);
  });

  it('never drops below the floor (0.5 × scale)', () => {
    const z = rowFitZoom({...base, availW: 200, availH: 200}, 1.35);
    expect(z).to.be.closeTo(0.5 * 2, 0.001);
  });

  it('is HEIGHT-limited for a couple of tall cards in a short strip', () => {
    const z = rowFitZoom({...base, n: 2, availW: 5000, availH: 700}, 1.35);
    expect(z).to.be.closeTo(700 / 460, 0.02); // heightZoom < widthZoom, < ceiling
  });
});

describe('consoleStartNav.gridFitPlan', () => {
  const base = {n: 10, slotW: 320, slotH: 460, colGap: 30, rowGap: 40, scale: 2, maxRows: 3};

  it('picks the balanced 5+5 (2 rows) for a 10-card buy', () => {
    const plan = gridFitPlan({...base, availW: 3200, availH: 1800}, 1.2);
    expect(plan.cols).to.eq(5);
    expect(plan.zoom).to.be.closeTo(1.91, 0.03); // the 2-row fit, both axes
  });

  it('respects the ceiling when the space is generous', () => {
    const plan = gridFitPlan({...base, availW: 99999, availH: 99999}, 1.2);
    expect(plan.zoom).to.be.closeTo(1.2 * 2, 0.001);
  });
});
