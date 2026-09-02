import {expect} from 'chai';
import {
  PackAnchor, dockedBodyPose, packProfileTuning, poseRideSpec, rideDurationForRemainder,
} from '@/client/console/handDock/handBodies';

/**
 * THE PACK'S POSE GEOMETRY + TRANSITION CHOREOGRAPHY (pose iteration).
 *
 * The three poses are one physical object changing posture, and the
 * transitions between them carry SEMANTIC priorities — «→ compact» is the
 * quietest move in the console (a background settle the player must be able
 * to not notice), «→ raised» is the RT wheel's echo (the wheel pops first,
 * the hand follows a beat later). These invariants died once each in the
 * shared-tween era (one 340ms power2.out for every pair — the velocity
 * burst on frame one was the reported «мельтешение»), so they are pinned.
 */
describe('handBodies pose model', () => {
  const anchor: PackAnchor = {
    ax: 960, ay: 1071, remPx: 20,
    ...packProfileTuning('base'),
  };

  describe('the COMPACT pose is a TUCK, not a shrink', () => {
    it('keeps the card rhythm nearly intact (scale ≥ 0.85 on every profile)', () => {
      // The old 0.7 shrink changed the gold-edge rhythm by 30% in one move —
      // the loudest single ingredient of the «интерфейс перестроился» read.
      expect(packProfileTuning('base').compactScale).to.be.gte(0.85);
      expect(packProfileTuning('handheld').compactScale).to.be.gte(0.85);
    });

    it('carries the pose in the SINK (deeper than the old hair-depth tuck)', () => {
      expect(packProfileTuning('base').compactSink).to.be.gte(0.5);
      expect(packProfileTuning('handheld').compactSink).to.be.gte(0.4);
    });

    it('flattens the fan arc — the crown over the plate is one level line', () => {
      // Outer cards dip below the centre at rest (the fan's arc); tucked,
      // every top must sit level or the crown reads as a fan CUT OFF by the
      // plate instead of cards seated in a holder.
      const n = 13;
      const restEdge = dockedBodyPose(0, n, 'rest', anchor);
      const restMid = dockedBodyPose(6, n, 'rest', anchor);
      expect(restEdge.y, 'rest keeps the arc (outer cards sit lower)').to.be.greaterThan(restMid.y);
      const tuckEdge = dockedBodyPose(0, n, 'compact', anchor);
      const tuckMid = dockedBodyPose(6, n, 'compact', anchor);
      expect(Math.abs(tuckEdge.y - tuckMid.y), 'compact irons the arc flat').to.be.lessThan(0.5);
    });

    it('sinks every card below its rest seat', () => {
      const n = 9;
      for (const i of [0, 4, 8]) {
        const rest = dockedBodyPose(i, n, 'rest', anchor);
        const tuck = dockedBodyPose(i, n, 'compact', anchor);
        expect(tuck.y, `card ${i} settles down into the tray`).to.be.greaterThan(rest.y + 5);
        expect(tuck.scale, `card ${i} steps back only lightly`).to.be.closeTo(rest.scale * 0.9, 0.001);
      }
    });
  });

  describe('the AWAY pose — the tuck taken all the way (the dock\'s inspection handover)', () => {
    it('sinks the whole card behind the plate: the top ends below the tray axis on every profile', () => {
      for (const profile of ['base', 'handheld']) {
        const a: PackAnchor = {ax: 960, ay: 1071, remPx: 20, ...packProfileTuning(profile)};
        const n = 13;
        for (const i of [0, 6, 12]) {
          // `y` is the box's TOP-LEFT: past the tray axis (`ay`) the WHOLE
          // card is below the line the plate covers from — nothing peeks.
          const away = dockedBodyPose(i, n, 'away', a);
          expect(away.y, `${profile} card ${i} top clears the tray axis`).to.be.greaterThan(a.ay);
        }
      }
    });

    it('keeps the compact pose\'s x-geometry — the guest fan can stand in the exact same tray', () => {
      const n = 9;
      for (const i of [0, 4, 8]) {
        const tuck = dockedBodyPose(i, n, 'compact', anchor);
        const away = dockedBodyPose(i, n, 'away', anchor);
        expect(away.x, `card ${i} x parity with compact`).to.be.closeTo(tuck.x, 0.01);
        expect(away.scale).to.be.closeTo(tuck.scale, 0.001);
        expect(away.rotation).to.eq(0);
        // The away sink is exactly one card height past compact.
        expect(away.y - tuck.y).to.be.closeTo(anchor.cardH * anchor.remPx, 0.01);
      }
    });

    it('«→ away» is a quiet settle; the return home is the ordinary tucked rise', () => {
      for (const from of ['rest', 'compact', 'raised'] as const) {
        const ride = poseRideSpec(from, 'away');
        expect(ride.ease, `${from}→away`).to.match(/inOut/);
        expect(ride.delayMs).to.eq(0);
        expect(ride.staggerMaxMs).to.eq(0);
        expect(ride.durationMs).to.be.gte(520);
      }
      expect(poseRideSpec('away', 'rest').durationMs).to.eq(poseRideSpec('compact', 'rest').durationMs);
      expect(poseRideSpec('away', 'compact').ease).to.match(/inOut/);
    });
  });

  describe('the RAISED pose', () => {
    it('lifts, spreads and fans — and keeps full card size', () => {
      const n = 13;
      const rest = dockedBodyPose(0, n, 'rest', anchor);
      const up = dockedBodyPose(0, n, 'raised', anchor);
      expect(up.scale).to.be.closeTo(rest.scale, 0.001);
      expect(up.y).to.be.lessThan(rest.y); // the lift
      expect(Math.abs(up.rotation)).to.be.greaterThan(0); // the fan opens
      expect(dockedBodyPose(6, n, 'raised', anchor).rotation).to.be.closeTo(0, 0.01); // centre card stays level
    });
  });

  describe('poseRideSpec — semantic transition priorities', () => {
    it('«→ compact» is the slowest, softest move, with no stagger', () => {
      for (const from of ['rest', 'raised'] as const) {
        const ride = poseRideSpec(from, 'compact');
        expect(ride.durationMs, `${from}→compact duration`).to.be.gte(520);
        expect(ride.ease, `${from}→compact ease`).to.match(/inOut/);
        expect(ride.delayMs).to.equal(0);
        expect(ride.staggerMaxMs).to.equal(0);
      }
    });

    it('«→ compact» outlasts every other transition (background priority)', () => {
      const settle = poseRideSpec('rest', 'compact').durationMs;
      expect(settle).to.be.gte(poseRideSpec('rest', 'raised').durationMs);
      expect(settle).to.be.gte(poseRideSpec('compact', 'rest').durationMs);
      expect(settle).to.be.gte(poseRideSpec('raised', 'rest').durationMs);
    });

    it('«→ raised» starts a beat AFTER the wheel pop and opens centre-out', () => {
      const ride = poseRideSpec('rest', 'raised');
      expect(ride.delayMs, 'the wheel (120ms) is the primary object — the hand is its echo').to.be.within(40, 120);
      expect(ride.staggerMaxMs, 'the fan opens centre-out').to.be.greaterThan(0);
      expect(ride.ease, 'a soft rise, never an out-burst').to.match(/inOut/);
    });

    it('every ease is an in-out — no transition may put its velocity peak on frame one', () => {
      const poses = ['rest', 'compact', 'raised', 'away'] as const;
      for (const from of poses) {
        for (const to of poses) {
          if (from === to) {
            continue;
          }
          expect(poseRideSpec(from, to).ease, `${from}→${to}`).to.match(/inOut/);
        }
      }
    });
  });

  describe('rideDurationForRemainder — interrupted rides continue, never snap or crawl', () => {
    it('a full travel keeps the full budget', () => {
      expect(rideDurationForRemainder(640, 30, 30)).to.equal(640);
    });

    it('a short remainder shortens the ride (no full-budget crawl over 2px)', () => {
      const d = rideDurationForRemainder(640, 3, 30);
      expect(d).to.be.lessThan(400);
      expect(d, 'and never a snap').to.be.gte(640 * 0.4);
    });

    it('degenerate inputs fall back to the base duration', () => {
      expect(rideDurationForRemainder(420, 10, 0)).to.equal(420);
      expect(rideDurationForRemainder(420, Number.NaN, 30)).to.equal(420);
    });
  });
});
