import {expect} from 'chai';
import {
  approachReadyMs, arcHeadingDeg, fleetTimings, fleetTotalMs, launchArcControl, reducedFleetTimings,
} from '@/client/console/colonyFleet/tradeFleetModel';

describe('tradeFleetModel', () => {
  it('keeps the launch bounded but rich (~1.7s worst-case, arc leg ~1.1s)', () => {
    const t = fleetTimings();
    expect(approachReadyMs(t)).to.be.within(900, 1300); // the client-side leg
    expect(fleetTotalMs(t)).to.be.within(1400, 2200); // incl. approach + dock + ack
    // The approach leg strictly precedes the dock (pending honesty).
    expect(approachReadyMs(t)).to.be.lessThan(fleetTotalMs(t));
  });

  it('reduced motion is short but still a full path', () => {
    const r = reducedFleetTimings();
    const full = fleetTimings();
    expect(fleetTotalMs(r)).to.be.lessThan(fleetTotalMs(full));
    // Never collapses to zero — the path (sent → arrived → docked) still reads.
    expect(r.transitMs).to.be.greaterThan(0);
    expect(r.dockMs).to.be.greaterThan(0);
  });

  it('the launch arc bows ABOVE the straight chord', () => {
    const from = {x: 400, y: 620};
    const to = {x: 900, y: 200};
    const ctrl = launchArcControl(from, to);
    // The apex is higher (smaller y) than both endpoints — a climb, not a slide.
    expect(ctrl.y).to.be.lessThan(Math.min(from.y, to.y));
    // Deterministic (no randomness).
    expect(launchArcControl(from, to)).to.deep.eq(ctrl);
  });

  it('a tiny hop still gets a readable arc lift', () => {
    const ctrl = launchArcControl({x: 500, y: 400}, {x: 520, y: 410});
    expect(Math.min(400, 410) - ctrl.y).to.be.at.least(70);
  });

  it('the heading points the nose along the travel tangent', () => {
    const from = {x: 100, y: 500};
    const ctrl = launchArcControl(from, {x: 700, y: 500});
    const to = {x: 700, y: 500};
    // Early in the flight the ship climbs (arc rising) → nose tilts up-right.
    const early = arcHeadingDeg(from, ctrl, to, 0.1);
    // Late in the flight it descends onto the berth → nose tilts down-right.
    const late = arcHeadingDeg(from, ctrl, to, 0.9);
    expect(early).to.not.eq(late);
    expect(Number.isFinite(early)).to.eq(true);
  });
});
