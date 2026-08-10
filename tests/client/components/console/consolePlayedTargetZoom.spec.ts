import {expect} from 'chai';
import {playedTargetZoomOrigin} from '@/client/console/played/consolePlayedTargetZoom';

/**
 * X ON THE SELF-TARGET LIFTS THE REAL CARD.
 *
 * The bug this pins: the embedded target step gave every candidate a
 * `data-zoom-slot`, so X on the «ИСТОЧНИК · ЭТА КАРТА» proxy resolved the zoom
 * origin to the little text chip. The viewer rose out of the chip and the
 * choreography held THAT slot empty — while the card the proxy names went on
 * standing, fully visible, in the hero column. Two copies of one physical
 * object, which is the exact thing the proxy exists to prevent.
 *
 * The origin is where that is decided, so the origin is what is pinned. The
 * hiding of the source and the mirrored close are the console's ONE zoom
 * choreography acting on whatever element this returns — there is no second
 * mechanism to test, and deliberately so.
 */
describe('played-target zoom origin — one card on screen, always', () => {
  const CARDS = ['Mars Hydro Turbines', 'Predators'];
  const keyOf = (i: number) => CARDS[i] ?? '';

  /**
   * The host root, shaped like the real one: a hero card that carries BOTH the
   * source anchor and (in the action composer) a `data-zoom-slot` of its own,
   * standing BEFORE the step in document order.
   */
  function host(): HTMLElement {
    const root = document.createElement('div');
    root.innerHTML =
      '<div class="hero" data-ptsel-source data-zoom-slot="Predators"></div>' +
      '<div class="con-ptsel">' +
      '<div class="slot-a" data-zoom-slot="Mars Hydro Turbines"></div>' +
      '<div class="proxy" data-ptsel-self></div>' +
      '</div>';
    return root;
  }

  it('resolves an ordinary candidate to its own slot', () => {
    const root = host();
    const origin = playedTargetZoomOrigin(() => root, keyOf, 'Predators');
    expect(origin.kind).to.eq('physical');
    expect(origin.resolve?.(0)?.className).to.eq('slot-a');
  });

  /**
   * THE REDIRECTION. The self-target's index resolves to the hero, not to a
   * slot of its own — and the proxy deliberately publishes no `data-zoom-slot`,
   * so there is nothing for a future edit to accidentally resolve to instead.
   */
  it('resolves the SELF-TARGET to the physical source card', () => {
    const root = host();
    const origin = playedTargetZoomOrigin(() => root, keyOf, 'Predators');
    expect(origin.resolve?.(1)?.className).to.eq('hero');
    expect(root.querySelector('[data-ptsel-self][data-zoom-slot]'),
      'the proxy must never be a zoom slot — that is what made the chip an origin',
    ).to.eq(null);
  });

  /** No self-target in the model → nothing is redirected. */
  it('redirects nothing when the step has no self-target', () => {
    const root = host();
    const origin = playedTargetZoomOrigin(() => root, keyOf, '');
    expect(origin.resolve?.(0)?.className).to.eq('slot-a');
  });

  /**
   * AN ORDINARY CANDIDATE RESOLVES INSIDE THE STEP, never merely inside the
   * host. The action composer's hero wrap carries a `data-zoom-slot` of its own
   * and stands FIRST in document order, so a host-wide query would prefer it —
   * harmless while the acting card IS the source, and wrong the moment the two
   * diverge (a Viron repeat re-points the hero to the inner action's card while
   * the outer one is still an ordinary candidate in the step).
   */
  it('never resolves an ordinary candidate to a look-alike slot outside the step', () => {
    const root = host();
    // `Predators` is the hero's own slot key here, and NOT the source card.
    const origin = playedTargetZoomOrigin(() => root, keyOf, '');
    expect(origin.resolve?.(1), 'the hero is not a candidate slot').to.eq(null);
  });

  /**
   * SCOPED TO THE HOST, NEVER `document`. Both composers can exist in the DOM
   * at once (one parked, `v-show`-hidden, with zero-rect slots); a document-wide
   * query would let the dead one shadow the live one and the entrance would
   * silently degrade to the textual rise.
   */
  it('never reaches outside the host root', () => {
    const stray = document.createElement('div');
    stray.innerHTML = '<div class="stray-hero" data-ptsel-source></div>';
    document.body.appendChild(stray);
    try {
      const root = document.createElement('div');
      root.innerHTML = '<div class="step"></div>';
      const origin = playedTargetZoomOrigin(() => root, keyOf, 'Predators');
      expect(origin.resolve?.(1), 'a hero in another composer is not this step\'s source').to.eq(null);
    } finally {
      stray.remove();
    }
  });

  /** A host that is gone (the step unmounted while the press was in flight) is
   *  a null origin, never a throw — the viewer degrades to its textual rise. */
  it('survives a host that is no longer there', () => {
    const origin = playedTargetZoomOrigin(() => undefined, keyOf, 'Predators');
    expect(origin.resolve?.(1)).to.eq(null);
  });
});
