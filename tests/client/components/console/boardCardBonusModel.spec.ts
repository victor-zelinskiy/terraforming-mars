import {expect} from 'chai';
import {
  bonusSceneTimings, coverLiftRise, fanDelayMs, gatherPoint, multiSceneBudgetMs,
  presentationTarget, reducedBonusSceneTimings, singleSceneBudgetMs,
} from '@/client/console/boardCardBonus/boardCardBonusModel';

describe('boardCardBonusModel', () => {
  it('is a calm, bounded scene — deliberate but never a slog', () => {
    const t = bonusSceneTimings();
    expect(t.liftMs).to.be.greaterThan(0);
    expect(t.gatherMs).to.be.greaterThan(0);
    expect(t.fanMs).to.be.greaterThan(0);
    expect(t.frameMs).to.be.greaterThan(0);
    expect(t.handoffMs).to.be.greaterThan(0);
    expect(t.flipPortion).to.be.greaterThan(0).and.lessThan(1);
    // The whole 3-card transfer (post-server) stays under ~1.6s.
    expect(multiSceneBudgetMs(3, t)).to.be.lessThan(1600);
    // The single-card handover is even tighter.
    expect(singleSceneBudgetMs(t)).to.be.lessThan(1100);
    // Budgets grow monotonically with the card count (stagger).
    expect(multiSceneBudgetMs(3, t)).to.be.greaterThan(multiSceneBudgetMs(2, t));
  });

  it('reduced motion is short but still a full physical path', () => {
    const t = reducedBonusSceneTimings();
    const full = bonusSceneTimings();
    // Every story beat still exists (lift → travel → frame → handoff)…
    expect(t.liftMs).to.be.greaterThan(0);
    expect(t.gatherMs).to.be.greaterThan(0);
    expect(t.fanMs).to.be.greaterThan(0);
    expect(t.singleFlightMs).to.be.greaterThan(0);
    expect(t.frameMs).to.be.greaterThan(0);
    expect(t.handoffMs).to.be.greaterThan(0);
    // …just faster, and without the pending float loop.
    expect(t.hoverLoopMs).to.eq(0);
    expect(multiSceneBudgetMs(3, t)).to.be.lessThan(multiSceneBudgetMs(3, full));
    expect(singleSceneBudgetMs(t)).to.be.lessThan(singleSceneBudgetMs(full));
  });

  it('fan launches are staggered deterministically', () => {
    const t = bonusSceneTimings();
    expect(fanDelayMs(0, t)).to.eq(0);
    expect(fanDelayMs(2, t)).to.eq(2 * t.fanStaggerMs);
  });

  it('cover lift rise is proportional but clamped to the hex area', () => {
    expect(coverLiftRise(20)).to.eq(27);
    expect(coverLiftRise(4)).to.eq(18); // floor — a tiny icon still visibly lifts
    expect(coverLiftRise(200)).to.eq(40); // ceiling — never leaves the cell zone
  });

  it('gather point sits between the cover and the slots, clear of the top HUD', () => {
    const cover = {left: 100, top: 600, width: 16, height: 20};
    const slots = [
      {left: 400, top: 300, width: 200, height: 280},
      {left: 700, top: 300, width: 200, height: 280},
    ];
    const g = gatherPoint(cover, slots);
    const slotsCx = (500 + 800) / 2;
    // Pulled from the slot centroid TOWARD the cover…
    expect(g.x).to.be.lessThan(slotsCx);
    expect(g.x).to.be.greaterThan(cover.left + cover.width / 2);
    // …and never under the top HUD.
    expect(g.y).to.be.at.least(120);
    const high = gatherPoint({left: 100, top: 40, width: 16, height: 20}, [{left: 200, top: 10, width: 100, height: 100}]);
    expect(high.y).to.eq(120);
  });

  it('single-card presentation target is centred and readably sized', () => {
    const p = presentationTarget(1280, 800, 300, 420);
    expect(p.x).to.eq(640);
    expect(p.y).to.be.closeTo(352, 0.5);
    expect(p.scale).to.be.at.least(0.28).and.at.most(0.5);
    // A tiny viewport clamps at the floor, a huge one at the ceiling.
    expect(presentationTarget(600, 300, 300, 420).scale).to.eq(0.28);
    expect(presentationTarget(2560, 1600, 300, 420).scale).to.eq(0.5);
  });
});
