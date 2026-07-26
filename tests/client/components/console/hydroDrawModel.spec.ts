import {expect} from 'chai';
import {
  emergeDelayMs, hydroDrawTimings, hydroFanCentre, hydroFanOffsets, hydroSceneBudgetMs,
  reducedHydroDrawTimings, stackStartRect, stackOffset, travelDelayMs,
} from '@/client/console/hydroDraw/hydroDrawModel';

/*
 * The PURE plan of the «Гидромоделирование» flight: the cards come out of the
 * track cell the marker just landed on, open into a fan, hold, then travel into
 * the pick modal. What is guarded here is the SHAPE of the choreography — the
 * things that make it read as premium rather than as four cards being thrown.
 */
describe('hydroDrawModel', () => {
  const CARD_ASPECT = 320 / 460;

  describe('the fan', () => {
    it('is symmetric — cards spread evenly either side of centre, tilting outward', () => {
      const fan = hydroFanOffsets(4);
      expect(fan.length).to.eq(4);
      // Symmetric about the middle: the offsets cancel out.
      const spreadSum = fan.reduce((a, o) => a + o.spread, 0);
      const rotSum = fan.reduce((a, o) => a + o.rot, 0);
      expect(Math.abs(spreadSum)).to.be.lessThan(1e-9);
      expect(Math.abs(rotSum)).to.be.lessThan(1e-9);
      // Left to right, and tilted the same way — a hand of cards, not a heap.
      for (let i = 1; i < fan.length; i++) {
        expect(fan[i].spread).to.be.greaterThan(fan[i - 1].spread);
        expect(fan[i].rot).to.be.greaterThan(fan[i - 1].rot);
      }
      // The outer cards ride lower than the middle ones (the fan's arc).
      expect(fan[0].drop).to.be.greaterThan(fan[1].drop);
      expect(fan[3].drop).to.be.greaterThan(fan[2].drop);
    });

    it('degenerates cleanly: one card sits dead centre, untilted', () => {
      const fan = hydroFanOffsets(1);
      expect(fan.length).to.eq(1);
      expect(fan[0]).to.deep.eq({spread: 0, drop: 0, rot: 0});
      expect(hydroFanOffsets(0)).to.deep.eq([]);
    });

    it('opens where the player is looking — near the cell, on the way to the modal', () => {
      const cell = {left: 900, top: 200, width: 60, height: 300};
      const targets = [
        {left: 600, top: 700, width: 200, height: 290},
        {left: 900, top: 700, width: 200, height: 290},
      ];
      const centre = hydroFanCentre(cell, targets, {width: 1920, height: 1080}, 90);
      const cellCy = cell.top + cell.height / 2;
      const targetCy = 700 + 290 / 2;
      // Between the two, but firmly on the cell's side of the journey.
      expect(centre.y).to.be.greaterThan(cellCy);
      expect(centre.y).to.be.lessThan(targetCy);
      expect(centre.y - cellCy).to.be.lessThan((targetCy - cellCy) / 2);
      // Vertically it clears the cell more than it drifts sideways: a fanned
      // card is far taller than a rail stop and must not cover its own source.
      const cellCx = cell.left + cell.width / 2;
      const targetCx = 800; // centroid of the two target rects
      const xPull = Math.abs(centre.x - cellCx) / Math.abs(targetCx - cellCx);
      const yPull = (centre.y - cellCy) / (targetCy - cellCy);
      expect(yPull).to.be.greaterThan(xPull);
    });

    it('is clamped inside the viewport — a rail stop in a corner cannot push it off screen', () => {
      const cell = {left: 0, top: 0, width: 40, height: 40};
      const targets = [{left: -400, top: -400, width: 100, height: 140}];
      const centre = hydroFanCentre(cell, targets, {width: 1280, height: 720}, 90);
      expect(centre.x).to.be.at.least(90);
      expect(centre.y).to.be.at.least(90);
      expect(centre.x).to.be.at.most(1280 - 90);
      expect(centre.y).to.be.at.most(720 - 90);
    });
  });

  describe('the stack in the cell', () => {
    it('starts card-shaped INSIDE the cell, centred — the cards come out of it', () => {
      const cell = {left: 100, top: 200, width: 80, height: 300};
      const r = stackStartRect(cell, CARD_ASPECT);
      expect(r.width).to.be.lessThan(cell.width); // inside, never replacing it
      expect(Math.abs(r.width / r.height - CARD_ASPECT)).to.be.lessThan(1e-9);
      expect(r.left + r.width / 2).to.be.closeTo(cell.left + cell.width / 2, 1e-9);
      expect(r.top + r.height / 2).to.be.closeTo(cell.top + cell.height / 2, 1e-9);
    });

    it('offsets the stacked cards a hair so a packet of four reads as four', () => {
      expect(stackOffset(0)).to.deep.eq({dx: -0, dy: 0});
      expect(stackOffset(2).dy).to.be.greaterThan(stackOffset(1).dy);
    });
  });

  describe('the beats', () => {
    it('NOBODY departs before the whole fan is open and has held', () => {
      const t = hydroDrawTimings();
      const fanFullyOpen = emergeDelayMs(3, t) + t.emergeMs;
      // The first card to leave still waits for the last one to arrive + the hold.
      expect(travelDelayMs(0, 4, t)).to.eq(fanFullyOpen + t.fanHoldMs);
      // …and the group leaves in order, staggered.
      for (let i = 1; i < 4; i++) {
        expect(travelDelayMs(i, 4, t)).to.be.greaterThan(travelDelayMs(i - 1, 4, t));
      }
      expect(emergeDelayMs(0, t)).to.eq(0);
    });

    it('is deliberately unhurried — every beat outlasts the board bonus it is based on', () => {
      const t = hydroDrawTimings();
      // The reference (boardCardBonusModel): lift 300, fan 430, frame 240.
      expect(t.emergeMs).to.be.greaterThan(300);
      expect(t.travelMs).to.be.greaterThan(430);
      expect(t.frameMs).to.be.greaterThan(240);
      expect(t.fanHoldMs).to.be.greaterThan(0);
      // The whole flight is a presentation, not a transition.
      expect(hydroSceneBudgetMs(4, t)).to.be.greaterThan(2000);
    });

    it('reduced motion keeps the full story but strips the theatrics', () => {
      const t = reducedHydroDrawTimings();
      const full = hydroDrawTimings();
      expect(t.fanHoldMs).to.eq(0); // no presentation beat
      expect(t.travelArcLag).to.eq(0); // no arc
      expect(t.emergeMs).to.be.lessThan(full.emergeMs);
      expect(t.travelMs).to.be.lessThan(full.travelMs);
      expect(hydroSceneBudgetMs(4, t)).to.be.lessThan(hydroSceneBudgetMs(4, full) / 3);
      expect(hydroSceneBudgetMs(4, t)).to.be.greaterThan(0);
    });

    it('the budget covers the last card plus the modal beats (the safety net)', () => {
      const t = hydroDrawTimings();
      const lastCardLands = travelDelayMs(3, 4, t) + t.travelMs;
      expect(hydroSceneBudgetMs(4, t)).to.eq(lastCardLands + t.frameMs + t.handoffMs);
      // A degenerate count never yields a negative / zero budget.
      expect(hydroSceneBudgetMs(0, t)).to.be.greaterThan(0);
    });
  });
});
