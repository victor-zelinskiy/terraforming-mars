import {expect} from 'chai';
import {
  planHeroPath,
  heroPoint,
  heroTiltAt,
  heroScaleAt,
  heroFlipAt,
  heroProgressAt,
  peakTiltFor,
  heroCenter,
  HERO_LIFT_SCALE,
  HERO_FLIP_START_T,
  HERO_FLIP_END_T,
  HeroRect,
} from '@/client/console/played/playedHeroModel';

const VIEW = {viewportW: 1920, viewportH: 1080};

function rect(x: number, y: number, w: number, h: number): HeroRect {
  return {x, y, w, h};
}

describe('playedHeroModel', () => {
  describe('planHeroPath', () => {
    it('the arc starts at the source centre and ends at the target centre', () => {
      const source = rect(800, 300, 200, 288);
      const target = rect(300, 700, 140, 200);
      const plan = planHeroPath({source, target, ...VIEW});
      expect(heroPoint(plan, 0)).to.deep.eq(heroCenter(source));
      expect(heroPoint(plan, 1)).to.deep.eq(heroCenter(target));
    });

    it('the apex rises ABOVE both endpoints (a spatial arc, not a slide)', () => {
      const source = rect(900, 400, 200, 288);
      const target = rect(300, 720, 140, 200);
      const plan = planHeroPath({source, target, ...VIEW});
      const apex = heroPoint(plan, 0.5);
      expect(apex.y).to.be.lessThan(Math.min(heroCenter(source).y, heroCenter(target).y));
    });

    it('the apex respects the safe top band (never clips the HUD)', () => {
      const source = rect(900, 120, 200, 288);
      const target = rect(300, 200, 140, 200);
      const plan = planHeroPath({source, target, ...VIEW, safeTop: 90});
      const apex = heroPoint(plan, 0.5);
      // safeTop + 55% of the taller card's height is the clamp floor.
      expect(apex.y).to.be.at.least(90 + 288 * 0.55 - 1e-6);
    });

    it('targetScale is the real box ratio; apex stays a restrained boost', () => {
      const source = rect(800, 300, 200, 288);
      const target = rect(300, 700, 140, 200);
      const plan = planHeroPath({source, target, ...VIEW});
      expect(plan.targetScale).to.be.closeTo(140 / 200, 1e-9);
      expect(plan.apexScale).to.be.greaterThan(HERO_LIFT_SCALE);
      expect(plan.apexScale).to.be.lessThan(1.2);
    });

    it('identical input → identical plan (deterministic)', () => {
      const source = rect(812, 305, 197, 285);
      const target = rect(311, 707, 143, 205);
      expect(planHeroPath({source, target, ...VIEW})).to.deep.eq(planHeroPath({source, target, ...VIEW}));
    });
  });

  describe('tilt profile', () => {
    it('roll direction follows the horizontal travel and is capped at 7°', () => {
      expect(peakTiltFor(900)).to.be.greaterThan(0);
      expect(peakTiltFor(-900)).to.be.lessThan(0);
      expect(peakTiltFor(5000)).to.eq(7);
      expect(peakTiltFor(-5000)).to.eq(-7);
    });

    it('ramps in, peaks mid-arc, and is fully level before landing', () => {
      const peak = 6;
      expect(heroTiltAt(0, peak)).to.eq(0);
      expect(Math.abs(heroTiltAt(0.35, peak))).to.be.closeTo(6, 1e-9);
      expect(heroTiltAt(0.9, peak)).to.eq(0);
      expect(heroTiltAt(1, peak)).to.eq(0);
    });
  });

  describe('scale profile', () => {
    const plan = planHeroPath({source: rect(800, 300, 200, 288), target: rect(300, 700, 140, 200), ...VIEW});

    it('starts at the lift scale, peaks at the apex, lands exactly on target', () => {
      expect(heroScaleAt(0, plan)).to.be.closeTo(HERO_LIFT_SCALE, 1e-9);
      expect(heroScaleAt(0.5, plan)).to.be.closeTo(plan.apexScale, 1e-9);
      expect(heroScaleAt(1, plan)).to.be.closeTo(plan.targetScale, 1e-9);
    });
  });

  describe('flight progress profile (the apex-glide speed curve)', () => {
    it('spans [0,1] and is strictly monotone — the card never backs up', () => {
      expect(heroProgressAt(0)).to.eq(0);
      expect(heroProgressAt(1)).to.be.closeTo(1, 1e-9);
      let prev = 0;
      for (let q = 0.01; q <= 1.0001; q += 0.01) {
        const p = heroProgressAt(Math.min(1, q));
        expect(p).to.be.greaterThan(prev);
        prev = p;
      }
    });

    it('reaches the apex (p=0.5) at ~42% of the time — a brisk approach', () => {
      expect(heroProgressAt(0.42)).to.be.closeTo(0.5, 1e-9);
    });

    it('SLOWS at the apex and lands calm: apex + landing velocity are the two minima', () => {
      const v = (q: number) => (heroProgressAt(q + 0.01) - heroProgressAt(q - 0.01)) / 0.02;
      const cruiseIn = v(0.2);
      const apex = v(0.42);
      const cruiseOut = v(0.7);
      const landing = v(0.97);
      expect(apex).to.be.lessThan(cruiseIn); // cinematic apex glide…
      expect(apex).to.be.lessThan(cruiseOut); // …between two faster legs
      expect(apex).to.be.greaterThan(0.2); // but NEVER a stop
      expect(landing).to.be.lessThan(apex); // the final 20% is the calmest
    });
  });

  describe('event flip profile', () => {
    it('face-up before the flip window, back-up after, 90° inside it', () => {
      expect(heroFlipAt(0)).to.eq(0);
      expect(heroFlipAt(HERO_FLIP_START_T)).to.eq(0);
      expect(heroFlipAt(HERO_FLIP_END_T)).to.eq(180);
      expect(heroFlipAt(1)).to.eq(180);
      const mid = heroFlipAt((HERO_FLIP_START_T + HERO_FLIP_END_T) / 2);
      expect(mid).to.be.closeTo(90, 1e-9);
    });

    it('is monotonic — the card never wobbles back', () => {
      let prev = -1;
      for (let t = 0; t <= 1.0001; t += 0.02) {
        const v = heroFlipAt(Math.min(1, t));
        expect(v).to.be.at.least(prev - 1e-9);
        prev = v;
      }
    });
  });
});
