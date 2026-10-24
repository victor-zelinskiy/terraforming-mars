import {expect} from 'chai';
import {
  delegateFlightMs,
  delegateFlightPose,
  FIGURE_LIFT_GROW,
  planDelegateFlight,
} from '../../src/client/console/parliament/delegateFlightPose';

/**
 * THE DELEGATE'S FLIGHT AS PHYSICS — «взял → понёс → поставил» (the probe П3
 * as a unit): the shadow stays on the table while the body is carried, the
 * body never spins, and at the touchdown everything is at rest on the
 * destination's footprint — the proxy pixel-identical to the figure that
 * materializes under it.
 */
describe('delegateFlightPose — a standee carried by a hand', () => {
  const from = {x: 100, y: 400};
  const to = {x: 700, y: 180};
  const plan = planDelegateFlight({from, fromHeight: 40, to, toHeight: 46, durationMs: 700, unitPx: 2});

  it('at the birth the figure stands on its source footprint, at rest', () => {
    const pose = delegateFlightPose(plan, 0, 40);
    expect(pose.ground).deep.eq(from);
    expect(pose.liftPx).eq(0);
    expect(pose.tiltDeg).eq(0);
    expect(pose.grow).eq(1);
    expect(pose.air).eq(0);
    expect(pose.scale).to.be.closeTo(1, 1e-9);
  });

  it('mid-carry the body is HIGH above its shadow, and the shadow rides the straight line on the table', () => {
    const pose = delegateFlightPose(plan, 0.5, 40);
    expect(pose.liftPx, 'the body above the table').to.be.greaterThan(plan.liftPx * 0.9);
    expect(pose.air).to.be.greaterThan(0.5);
    // the ground point is ON the segment from → to (the shadow never arcs)
    const t = (pose.ground.x - from.x) / (to.x - from.x);
    expect(pose.ground.y).to.be.closeTo(from.y + (to.y - from.y) * t, 1e-6);
    expect(t).to.be.within(0.05, 0.95);
    expect(pose.grow).to.be.closeTo(FIGURE_LIFT_GROW, 1e-9);
  });

  it('leans INTO the travel and never spins (the lean is bounded, the sign is the direction)', () => {
    let maxAbs = 0;
    for (let i = 0; i <= 100; i++) {
      const pose = delegateFlightPose(plan, i / 100, 40);
      maxAbs = Math.max(maxAbs, Math.abs(pose.tiltDeg));
    }
    expect(maxAbs).to.be.within(8, 13);
    expect(delegateFlightPose(plan, 0.5, 40).tiltDeg, 'to the right → a positive lean').to.be.greaterThan(0);
    const back = planDelegateFlight({from: to, fromHeight: 46, to: from, toHeight: 40, durationMs: 700, unitPx: 2});
    expect(delegateFlightPose(back, 0.5, 46).tiltDeg).to.be.lessThan(0);
  });

  it('the body comes DOWN onto its base before the end: past the descent it falls monotonically', () => {
    let prev = Infinity;
    for (let p = plan.dropStart + 0.04; p <= 1; p += 0.02) {
      const pose = delegateFlightPose(plan, p, 40);
      expect(pose.liftPx).to.be.at.most(prev + 1e-9);
      prev = pose.liftPx;
    }
  });

  it('at the touchdown everything is at rest on the destination, at the destination height', () => {
    const pose = delegateFlightPose(plan, 1, 40);
    expect(pose.ground).deep.eq(to);
    expect(pose.liftPx).eq(0);
    expect(pose.tiltDeg).eq(0);
    expect(pose.grow).eq(1);
    expect(pose.air).eq(0);
    expect(pose.scale * 40).to.be.closeTo(46, 1e-9);
  });

  it('a column lift barely leans; a sideways carry leans fully', () => {
    const up = planDelegateFlight({from: {x: 0, y: 500}, fromHeight: 40, to: {x: 0, y: 100}, toHeight: 40, durationMs: 600, unitPx: 1});
    const side = planDelegateFlight({from: {x: 0, y: 100}, fromHeight: 40, to: {x: 400, y: 100}, toHeight: 40, durationMs: 600, unitPx: 1});
    expect(Math.abs(up.tiltDeg)).to.be.lessThan(Math.abs(side.tiltDeg));
  });

  it('the flight paces by distance, bounded on both sides', () => {
    expect(delegateFlightMs(0)).eq(140 + 380 + 160);
    expect(delegateFlightMs(10_000)).eq(140 + 620 + 160);
    expect(delegateFlightMs(400)).to.be.greaterThan(delegateFlightMs(100));
  });
});
