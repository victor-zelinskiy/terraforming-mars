import {expect} from 'chai';
import {
  aresGlideEase,
  aresGlideValue,
  glidedThreshold,
  resetAresMarkerGlide,
  ARES_MARKER_GLIDE_MS,
} from '@/client/components/board/aresMarkerGlide';

describe('aresMarkerGlide', () => {
  beforeEach(() => resetAresMarkerGlide());

  it('ease is clamped 0..1 and symmetric in the middle', () => {
    expect(aresGlideEase(0)).to.eq(0);
    expect(aresGlideEase(1)).to.eq(1);
    expect(aresGlideEase(0.5)).to.eq(0.5);
    expect(aresGlideEase(-1)).to.eq(0); // clamped
    expect(aresGlideEase(2)).to.eq(1); // clamped
  });

  it('interpolates from→target across the duration', () => {
    expect(aresGlideValue(3, 6, 0, 0)).to.eq(3); // start
    expect(aresGlideValue(3, 6, 0, ARES_MARKER_GLIDE_MS)).to.eq(6); // end
    const mid = aresGlideValue(3, 6, 0, ARES_MARKER_GLIDE_MS / 2);
    expect(mid).to.be.greaterThan(3).and.lessThan(6);
  });

  it('first sighting returns the target (no animation); a changed target without rAF snaps', () => {
    expect(glidedThreshold('oceans-erosions', 3)).to.eq(3); // first → snap
    expect(glidedThreshold('oceans-erosions', 3)).to.eq(3); // unchanged
    // No requestAnimationFrame in the test env → the controller snaps to the new target.
    expect(glidedThreshold('oceans-erosions', 2)).to.eq(2);
  });

  it('tracks markers independently by id', () => {
    expect(glidedThreshold('a', 3)).to.eq(3);
    expect(glidedThreshold('b', 6)).to.eq(6);
    expect(glidedThreshold('a', 4)).to.eq(4);
    expect(glidedThreshold('b', 6)).to.eq(6);
  });
});
