import {expect} from 'chai';
import {
  bayCommandSplit,
  commandWidthRem,
  handDockBayRem,
  handDockPlan,
  HAND_DOCK_CARD_W_REM,
  HAND_DOCK_PACK_USABLE_REM,
  HAND_DOCK_STEP_MAX_REM,
  HAND_DOCK_VISIBLE_MAX,
} from '@/client/console/consoleHandDock';

describe('consoleHandDock', () => {
  describe('handDockPlan', () => {
    it('0 cards → an empty tray (no silhouettes, no depth)', () => {
      const plan = handDockPlan(0);
      expect(plan.empty).to.be.true;
      expect(plan.visible).to.eq(0);
      expect(plan.slots).to.deep.eq([]);
      expect(plan.depth).to.eq(0);
      expect(plan.overflow).to.eq(0);
    });

    it('1 card → exactly one centred, untilted back', () => {
      const plan = handDockPlan(1);
      expect(plan.empty).to.be.false;
      expect(plan.visible).to.eq(1);
      expect(plan.slots).to.deep.eq([{dx: 0, tilt: 0}]);
      expect(plan.depth).to.eq(0);
    });

    it('a small hand stays a compact pack (step capped) and reads its count from the silhouette', () => {
      for (const n of [2, 3, 4]) {
        const plan = handDockPlan(n);
        expect(plan.visible, `visible for ${n}`).to.eq(n);
        expect(plan.depth, `depth for ${n}`).to.eq(0);
        expect(plan.overflow, `overflow for ${n}`).to.eq(0);
        // Per-slot rounding to 0.01rem may shave a hundredth off the step.
        const step = plan.slots[1].dx - plan.slots[0].dx;
        expect(step, `step for ${n}`).to.be.closeTo(HAND_DOCK_STEP_MAX_REM, 0.02);
      }
    });

    it('slots are symmetric around the pack centre', () => {
      for (const n of [2, 3, 5, 6]) {
        const plan = handDockPlan(n);
        const sum = plan.slots.reduce((acc, s) => acc + s.dx, 0);
        expect(sum, `dx sum for ${n}`).to.be.closeTo(0, 0.03);
        const tiltSum = plan.slots.reduce((acc, s) => acc + s.tilt, 0);
        expect(tiltSum, `tilt sum for ${n}`).to.be.closeTo(0, 0.03);
      }
    });

    it('a full row narrows its step to fit the tray band', () => {
      const plan = handDockPlan(HAND_DOCK_VISIBLE_MAX);
      expect(plan.visible).to.eq(HAND_DOCK_VISIBLE_MAX);
      const first = plan.slots[0];
      const last = plan.slots[plan.slots.length - 1];
      // Outermost card EDGES stay inside the usable band.
      const span = (last.dx - first.dx) + HAND_DOCK_CARD_W_REM;
      expect(span).to.be.at.most(HAND_DOCK_PACK_USABLE_REM + 0.01);
      // The focused fan stays a strict, bounded tilt (±3.2° at the edges).
      expect(Math.abs(last.tilt)).to.be.at.most(3.21);
    });

    it('beyond the visible max the pack grows DEPTH, not width', () => {
      const seven = handDockPlan(7);
      expect(seven.visible).to.eq(HAND_DOCK_VISIBLE_MAX);
      expect(seven.overflow).to.eq(1);
      expect(seven.depth).to.eq(1);
      expect(handDockPlan(10).depth).to.eq(1);
      expect(handDockPlan(11).depth).to.eq(2);
      expect(handDockPlan(14).depth).to.eq(2);
      expect(handDockPlan(15).depth).to.eq(3);
      // Thickness caps — the counter carries the exact total from here on.
      expect(handDockPlan(40).depth).to.eq(3);
      expect(handDockPlan(40).overflow).to.eq(34);
    });

    it('the visible layout is IDENTICAL for every over-max hand (only depth/overflow move)', () => {
      const a = handDockPlan(7);
      const b = handDockPlan(23);
      expect(a.slots).to.deep.eq(b.slots);
    });
  });

  describe('bayCommandSplit', () => {
    it('everything fits the right zone → the classic right-anchored run (no left cluster)', () => {
      expect(bayCommandSplit([5, 5, 5], 20, 20)).to.eq(0);
      expect(bayCommandSplit([], 20, 20)).to.eq(0);
    });

    it('overflows flow to the left zone, keeping the run tail on the right', () => {
      expect(bayCommandSplit([5, 5, 5], 10, 8)).to.eq(2);
      expect(bayCommandSplit([3, 3, 3, 3], 7, 6.5)).to.eq(2);
    });

    it('a hint set too big for BOTH zones splits at the least-total-overflow point', () => {
      // Any split overflows; k=2 balances 8-over-left vs 8-over-right.
      expect(bayCommandSplit([9, 9, 9, 9], 10, 10)).to.eq(2);
    });

    it('respects the LEFT capacity (a right-greedy pack used to decapitate the left cluster)', () => {
      // Right could hold two (10 ≤ 12), and pushing three left would
      // overflow the narrow left zone — the balance keeps left within cap.
      expect(bayCommandSplit([4, 4, 5, 5], 8, 12)).to.eq(2);
    });
  });

  describe('width estimation', () => {
    it('longer labels and extras estimate wider', () => {
      const short = commandWidthRem('Back');
      const long = commandWidthRem('Basic actions');
      expect(long).to.be.greaterThan(short);
      expect(commandWidthRem('Back', {badge: true})).to.be.greaterThan(short);
      expect(commandWidthRem('Back', {twoGlyphs: true})).to.be.greaterThan(short);
    });

    it('the bay narrows on the handheld profile', () => {
      expect(handDockBayRem('handheld')).to.be.lessThan(handDockBayRem('standard'));
      expect(handDockBayRem('tv')).to.eq(handDockBayRem('standard'));
    });
  });
});
