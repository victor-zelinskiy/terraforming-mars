import {expect} from 'chai';
import {
  bayCommandSplit,
  commandWidthRem,
  handDockBayRem,
  handDockPlan,
  HAND_DOCK_CARD_W_REM,
  HAND_DOCK_DISTINCT_MAX,
  HAND_DOCK_PACK_USABLE_REM,
  HAND_DOCK_STEP_MAX_REM,
} from '@/client/console/consoleHandDock';

/** The narrowest edge a 20-card hand reads at, rem (≈8.7px logical). */
const MIN_EDGE_REM = (HAND_DOCK_PACK_USABLE_REM - HAND_DOCK_CARD_W_REM) / (HAND_DOCK_DISTINCT_MAX - 1) - 0.02;

describe('consoleHandDock', () => {
  describe('handDockPlan', () => {
    it('0 cards → an empty tray', () => {
      const plan = handDockPlan(0);
      expect(plan.empty).to.be.true;
      expect(plan.slots).to.deep.eq([]);
      expect(plan.distinct).to.eq(0);
      expect(plan.overflow).to.eq(0);
    });

    it('1 card → exactly one centred, level, untilted back', () => {
      const plan = handDockPlan(1);
      expect(plan.empty).to.be.false;
      expect(plan.slots).to.deep.eq([{dx: 0, dy: 0, tilt: 0, deep: false}]);
      expect(plan.distinct).to.eq(1);
    });

    it('EVERY card is a physical slot — the count never truncates', () => {
      for (const n of [2, 8, 12, 20, 21, 30, 40]) {
        const plan = handDockPlan(n);
        expect(plan.slots.length, `slots for ${n}`).to.eq(n);
        expect(plan.distinct, `distinct for ${n}`).to.eq(Math.min(n, HAND_DOCK_DISTINCT_MAX));
        expect(plan.overflow, `overflow for ${n}`).to.eq(Math.max(0, n - HAND_DOCK_DISTINCT_MAX));
      }
    });

    it('a small hand stays a compact pack (step capped)', () => {
      for (const n of [2, 3, 4]) {
        const plan = handDockPlan(n);
        const step = plan.slots[1].dx - plan.slots[0].dx;
        expect(step, `step for ${n}`).to.be.closeTo(HAND_DOCK_STEP_MAX_REM, 0.02);
      }
    });

    it('slots are symmetric around the pack centre (odd centres ON the axis, even BETWEEN the pair)', () => {
      for (const n of [2, 3, 5, 6, 8, 12, 20]) {
        const plan = handDockPlan(n);
        // Per-slot rounding is 0.01rem — the symmetric sum drifts ≤ n/2 ticks.
        const tol = 0.01 + n * 0.005;
        const sum = plan.slots.reduce((acc, s) => acc + s.dx, 0);
        expect(sum, `dx sum for ${n}`).to.be.closeTo(0, tol);
        const tiltSum = plan.slots.reduce((acc, s) => acc + s.tilt, 0);
        expect(tiltSum, `tilt sum for ${n}`).to.be.closeTo(0, tol);
        if (n % 2 === 1) {
          expect(plan.slots[(n - 1) / 2].dx, `odd centre for ${n}`).to.eq(0);
        } else {
          expect(plan.slots[n / 2 - 1].dx, `even pair for ${n}`).to.be.closeTo(-plan.slots[n / 2].dx, 0.02);
        }
      }
    });

    it('every hand up to 20 keeps a READABLE edge and stays inside the tray band', () => {
      for (const n of [6, 8, 12, 16, 20]) {
        const plan = handDockPlan(n);
        const step = plan.slots[1].dx - plan.slots[0].dx;
        expect(step, `edge for ${n}`).to.be.at.least(MIN_EDGE_REM);
        const span = (plan.slots[n - 1].dx - plan.slots[0].dx) + HAND_DOCK_CARD_W_REM;
        expect(span, `span for ${n}`).to.be.at.most(HAND_DOCK_PACK_USABLE_REM + 0.03);
        // The focused fan stays a strict, bounded tilt (±3.2° at the edges).
        expect(Math.abs(plan.slots[n - 1].tilt), `fan for ${n}`).to.be.at.most(3.21);
        // The arc is subtle and symmetric: centre level, edges a touch lower.
        expect(plan.slots[0].dy, `arc for ${n}`).to.be.greaterThan(0);
        expect(plan.slots[0].dy).to.be.closeTo(plan.slots[n - 1].dy, 0.02);
        expect(plan.slots[0].dy).to.be.at.most(0.13);
      }
    });

    it('beyond 20 the extra cards are REAL deep slots anchored across the whole pack', () => {
      const plan = handDockPlan(30);
      const deep = plan.slots.filter((s) => s.deep);
      const distinct = plan.slots.filter((s) => !s.deep);
      expect(deep.length).to.eq(10);
      expect(distinct.length).to.eq(20);
      // The plan is HEAD-deep (oldest cards form the thickness, lowest z).
      expect(plan.slots.slice(0, 10).every((s) => s.deep)).to.be.true;
      // Thickness spreads across the pack — never one flank: the deep
      // anchors span most of the distinct band on both sides of centre.
      const minDx = Math.min(...deep.map((s) => s.dx));
      const maxDx = Math.max(...deep.map((s) => s.dx));
      expect(minDx).to.be.lessThan(-2);
      expect(maxDx).to.be.greaterThan(2);
      // Every deep slot stays inside the band (jitter included).
      const edge = (HAND_DOCK_PACK_USABLE_REM - HAND_DOCK_CARD_W_REM) / 2 + 0.1;
      deep.forEach((s) => {
        expect(Math.abs(s.dx)).to.be.at.most(edge);
        expect(s.dy).to.be.greaterThan(0); // tucked slightly deeper
      });
    });

    it('the DISTINCT layout is identical for every over-20 hand (only thickness grows)', () => {
      const a = handDockPlan(21).slots.filter((s) => !s.deep);
      const b = handDockPlan(40).slots.filter((s) => !s.deep);
      expect(a).to.deep.eq(b);
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
