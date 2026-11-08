import {expect} from 'chai';
import {nearestInDirection, rowFitZoom, gridFitPlan, GRID_ZOOM_FLOOR, RectLike} from '@/client/console/consoleStartNav';

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

  // NO CLAMP BELOW THE FIT (2026-11-08): on a 16:9 screen the 10-card buy sits AT the 0.4 floor, so a strip that lost
  // height (the start dock grown by the tender chips, the request's tag row above the deal) used to be forced to a
  // zoom the room could not hold — the grid overflowed, centred, its top row's heads hidden, its last row under the
  // status rail. Below the floor the cards shrink to FIT, whatever that takes (X is the detailed read).
  it('keeps the couch floor while the room allows it', () => {
    // 2 rows: hZoom = (900 - 40) / 920 = 0.934 ≥ 0.4 × 2 — the floor is not in play
    const plan = gridFitPlan({...base, availW: 3200, availH: 900}, 1.2);
    expect(plan.zoom).to.be.closeTo(0.934, 0.01);
    expect(plan.zoom).to.be.at.least(GRID_ZOOM_FLOOR * 2);
  });

  it('SHRINKS BELOW the floor rather than overflow a short strip — the fit itself, never a clamp', () => {
    // a short strip: 1 row of 10 is width-bound (3200 - 270) / 3200 = 0.915; 2 rows: (600 - 40) / 920 = 0.609;
    // the best plan (0.915) clears the floor (0.8) — the room is tall enough for one row
    expect(gridFitPlan({...base, availW: 3200, availH: 600}, 1.2).zoom).to.be.closeTo(0.915, 0.01);
    // narrower AND short: 1 row (1400 - 270) / 3200 = 0.353; 2 rows (1400 - 120) / 1600 = 0.8 vs (600 - 40) / 920 = 0.609 → 0.609
    expect(gridFitPlan({...base, availW: 1400, availH: 600}, 1.2).zoom).to.be.closeTo(0.609, 0.01);
    // too short for the floor: 2 rows (700 - 40) / 920 = 0.717 < 0.8 — the old planner forced 0.8 and overflowed;
    // the soft floor hands back the fit itself
    const cramped = gridFitPlan({...base, availW: 1400, availH: 700}, 1.2);
    expect(cramped.zoom).to.be.closeTo(0.717, 0.01);
    expect(cramped.zoom).to.be.below(GRID_ZOOM_FLOOR * 2);
    expect(cramped.cols).to.eq(5);
    // a HEIGHT-bound room far below the floor: 2 rows (400 - 40) / 920 = 0.391 — the fit, never a clamp up (a clamp
    // up on height is the overflow under the status rail the fit exists to prevent)
    const short = gridFitPlan({...base, availW: 1400, availH: 400}, 1.2);
    expect(short.zoom).to.be.closeTo(0.391, 0.01);
    expect(short.cols).to.eq(5);
  });

  it('a WIDTH-bound row keeps one device px of slack per column — planned to the exact pixel, the last tile wraps', () => {
    // 1 row of 10 in a strip exactly 10 × 320 + 9 × 30 = 3470 wide at zoom 1: the plan is 10 × 2 px short of it
    const exact = gridFitPlan({...base, availW: 3470, availH: 99999, maxRows: 1}, 1.2);
    expect(exact.cols).to.eq(10);
    expect(exact.zoom).to.be.closeTo((3470 - 270 - 20) / 3200, 0.0001);
    expect(exact.zoom).to.be.below(1);
  });

  it('never clamps a WIDTH-bound plan up either — a clamp up on width is a wrap, and a wrap is the height overflow', () => {
    // 3 rows of 4 is the best: (600 - 90 - 4 × 2 px of per-column slack) / 1280 = 0.392 by width (the height is
    // generous); a clamp to any minimum above it would not fit the width, flex-wrap would break a fifth row, and the
    // rows would overflow (the box frame of 2026-11-08 19:12 — ten cards planned as one row, laid as 9 + 1)
    const narrow = gridFitPlan({...base, availW: 600, availH: 2000}, 1.2);
    expect(narrow.zoom).to.be.closeTo(0.392, 0.01);
    expect(narrow.cols).to.eq(4);
    // an absurd room: the fit itself
    const absurd = gridFitPlan({...base, availW: 200, availH: 100}, 1.2);
    expect(absurd.zoom).to.be.above(0);
    expect(absurd.zoom).to.be.below(0.1);
  });
});
