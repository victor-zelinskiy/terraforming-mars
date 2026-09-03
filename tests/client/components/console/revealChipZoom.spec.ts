import {expect} from 'chai';
import {revealChipHandZoom} from '@/client/console/handDock/handRevealDirector';

/*
 * THE FLYING CHIP'S ZOOM CONTEXT — «плашка недоступности раздувается на время
 * анимации карты».
 *
 * The blocker chip on a hand-album body obeys the SAME counter-zoom law as
 * the resting slot's chip (`<emphasis> / var(--con-hand-zoom)` — see
 * tests/console/cardStatusContract.spec.ts for the stylesheet lock-step),
 * but a body lives outside the album page's CSS context, so the director
 * stamps the equivalent `--con-hand-zoom` per body from the pair's
 * ALBUM-side rect. This spec guards the pure half of that stamp: the value
 * is the album slot's implied card zoom (target width over the body's
 * natural width — with it, the chip lands byte-identical to the slot chip
 * and rides the card's transform as one composition mid-flight), and a
 * degenerate placeholder rect (the filter episode's `{width: 1}` fallbacks)
 * stamps NOTHING rather than a ~0 zoom that would blow the division up.
 */
describe('revealChipHandZoom — the album-side card zoom a seized body stamps', () => {
  it('is the target rect width over the natural card width', () => {
    expect(revealChipHandZoom(320, 320)).to.eq(1);
    expect(revealChipHandZoom(211.2, 320)).to.be.closeTo(0.66, 1e-9);
    // A 4K showcase slot (~2× natural) — exactly where the unset var used to
    // render the chip ~3× too big for the whole animation.
    expect(revealChipHandZoom(640, 320)).to.eq(2);
  });

  it('answers undefined for a degenerate placeholder rect — no stamp, CSS default applies', () => {
    expect(revealChipHandZoom(1, 320)).to.eq(undefined);
    expect(revealChipHandZoom(0, 320)).to.eq(undefined);
    expect(revealChipHandZoom(320, 0)).to.eq(undefined);
  });
});
