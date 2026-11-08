import {expect} from 'chai';
import {heroRetargetWeight} from '../../src/client/console/played/playedHeroModel';

/**
 * THE FINAL-APPROACH CORRECTION survives a starved frame (CI 2026-11-08,
 * `console-play-landing-geometry`): a frame — or the backstop's `progress(1)`
 * catch-up — that jumps the flight from before the read straight to its end
 * takes the read ON the touchdown, and the correction must then land WHOLE,
 * never be weighed at zero by a ramp of no length.
 */
describe('heroRetargetWeight', () => {
  it('no read yet → no correction', () => {
    expect(heroRetargetWeight(-1, 0.5)).to.eq(0);
    expect(heroRetargetWeight(-1, 1)).to.eq(0);
  });

  it('ramps from the read to the touchdown', () => {
    expect(heroRetargetWeight(0.8, 0.8)).to.eq(0);
    expect(heroRetargetWeight(0.8, 0.9)).to.be.closeTo(0.5, 1e-9);
    expect(heroRetargetWeight(0.8, 1)).to.eq(1);
  });

  it('a read taken ON the touchdown frame applies whole', () => {
    expect(heroRetargetWeight(1, 1)).to.eq(1);
  });
});
