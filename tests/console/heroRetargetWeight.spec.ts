import {expect} from 'chai';
import {readFileSync} from 'fs';
import {resolve} from 'path';
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

/**
 * THE FLIGHT FOLLOWS THE LIVE SLOT, AND ITS SAFETY CATCHES IT UP (CI 2026-11-09, `console-play-landing-geometry` fhd —
 * the card touched down 1.6–3 px off a slot still finishing its stage's emergence, then the commit glided it the rest).
 * Read off the director's source: no one-shot gate on the read past the mark, and every guarded run hands its
 * animation back so the wall-clock safety finishes it (`progress(1)`) instead of resolving a card still in the air.
 */
describe('playedHeroDirector · the touchdown is the live slot by construction', () => {
  const src = readFileSync(resolve(__dirname, '../../src/client/console/played/playedHeroDirector.ts'), 'utf8');

  it('reads the slot on every frame past the mark (no one-shot read)', () => {
    expect(src).not.to.match(/if \(corr\.from < 0 && prog\.q >= HERO_RETARGET_AT/);
    expect(src).to.match(/if \(prog\.q >= HERO_RETARGET_AT && opts\.retarget !== undefined\)/);
  });

  it('every guarded run returns its animation for the safety to finish', () => {
    const runs = src.split('return guarded((done) => {').slice(1).map((body) => body.split(/\n {2}\}, (?:opts\.)?durationMs\);/)[0]);
    expect(runs.length).to.be.greaterThan(0);
    for (const body of runs) {
      expect(body, body.slice(0, 120)).to.match(/return (tl|gsap\.)/);
    }
    expect(src).to.match(/anim\.progress\(1\)/);
  });
});
