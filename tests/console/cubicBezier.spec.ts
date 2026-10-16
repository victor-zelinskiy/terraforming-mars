import {expect} from 'chai';
import {cubicBezierEase, cubicBezierFromCss} from '../../src/client/components/motion/cubicBezier';
import {CURSOR_EASE} from '../../src/client/components/motion/motionTokens';

/*
 * The JS twin of a CSS `cubic-bezier()` (TR58 — the cursor's scroll rides the SAME curve its ring and lift declare in
 * CSS). Endpoints are exact, the curve is monotone for the ease family, and the linear bezier is the identity.
 */
describe('cubicBezier — the CSS curve for a JS tween', () => {
  it('the endpoints are exact and the linear bezier is the identity', () => {
    const lin = cubicBezierEase(0, 0, 1, 1);
    for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expect(lin(p)).to.be.closeTo(p, 1e-4);
    }
    const ease = cubicBezierEase(0.22, 0.61, 0.36, 1);
    expect(ease(0)).to.eq(0);
    expect(ease(1)).to.eq(1);
    expect(ease(-1)).to.eq(0);
    expect(ease(2)).to.eq(1);
  });

  it('the cursor ease is monotone and front-loaded (quick start, gentle landing)', () => {
    const ease = cubicBezierFromCss(CURSOR_EASE)!;
    expect(ease, 'CURSOR_EASE parses').to.not.eq(undefined);
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const v = ease(i / 100);
      expect(v, `monotone at ${i}`).to.be.at.least(prev - 1e-9);
      prev = v;
    }
    expect(ease(0.5), 'past halfway at half the time').to.be.greaterThan(0.6);
  });

  it('a string that is not a cubic-bezier is refused', () => {
    expect(cubicBezierFromCss('ease-out')).to.eq(undefined);
  });
});
