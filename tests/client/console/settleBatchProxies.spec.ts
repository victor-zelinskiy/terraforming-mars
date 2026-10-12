/*
 * PL-222 (TR50 route) — THE HANDOFF OF A WORKSPACE DRAW IS «SHOW, THEN REMOVE».
 *
 * A card a «Действия карт» draw dealt lands as a proxy over its real slot; `settleBatchProxiesOnto` releases the
 * real card and hands the proxies back (`onDone` unmounts them). The embedded reveal the card lands in carries a
 * release FADE on the card (`.con-reveal--bonus-mode … > .pcard { transition: opacity 160ms }`), so releasing the
 * hold and taking the proxies in the same frame left the slot EMPTY for the fade's first frames — measured 130 ms at
 * 4K, a blink on every drawn card. The law (console-ui § A FLYING CARD): reveal the destination, then remove the
 * proxy on the NEXT frame. Pinned here on the reduced-motion road, which hands over at once — the same `finish`.
 */
import {expect} from 'chai';
import {settleBatchProxiesOnto} from '@/client/console/consoleBatchArrivalMotion';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import {reduceMotionOverrideState} from '@/client/utils/reducedMotion';

describe('settleBatchProxiesOnto — show the real card, then take the proxy (PL-222)', () => {
  let before = false;
  beforeEach(() => {
    before = reduceMotionOverrideState.enabled;
    reduceMotionOverrideState.enabled = true;
  });
  afterEach(() => {
    reduceMotionOverrideState.enabled = before;
    document.body.innerHTML = '';
  });

  it('the real card is released SNAPPED (no transition) and the proxies are taken only a tick later', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const proxy = document.createElement('div');
    document.body.appendChild(proxy);
    let atDone: {held: boolean, transition: string} | undefined;
    settleBatchProxiesOnto({
      pairs: [{proxy, target}],
      onDone: () => {
        atDone = {held: target.classList.contains('con-deal-hold'), transition: target.style.transition};
      },
    });
    expect(target.classList.contains('con-deal-hold'), 'the real card is released at once').is.false;
    expect(target.style.transition, 'released WITHOUT the slot\'s release fade').eq('none');
    expect(atDone, 'the proxies are never taken in the frame the card is released').is.undefined;
    await new Promise((resolve) => setTimeout(resolve, PROBE_TICK_FALLBACK_MS + 30));
    expect(atDone, 'the proxies go one tick later, over a card already painted — and the card\'s own transition is back')
      .deep.eq({held: false, transition: ''});
  });

  it('a pair with no real counterpart still finishes (nothing is held, nothing waits)', () => {
    const proxy = document.createElement('div');
    let done = false;
    settleBatchProxiesOnto({pairs: [{proxy, target: undefined}], onDone: () => {
      done = true;
    }});
    expect(done).is.true;
  });
});
