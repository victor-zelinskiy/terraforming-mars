import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';

/**
 * THE SCROLL RAIL IS AN AFFORDANCE, NOT A MEASUREMENT REPORT.
 *
 * It states «there is somewhere to go», and a few pixels of travel is not
 * somewhere. The content still scrolls if something forces it; it just stops
 * advertising a journey the player cannot make. Two ways that promise has been
 * broken, both of which shipped as a permanent bright line down the right edge
 * of the card-play composer — a scrollbar on a screen that fits:
 *
 *  1. a sub-pixel row of fractional layout counting as overflow;
 *  2. an ENTRANCE TRANSFORM counting as overflow. Every console surface tweens
 *     its groups in from `y: 9 * uiScale`, which inflates the viewport's
 *     scrollable overflow for the length of the cascade — and because a
 *     transform fires no ResizeObserver, the flag latched true mid-animation
 *     and nothing ever ran `measure` again to clear it.
 *
 * Both are answered by measuring the CONTENT'S LAYOUT SIZE rather than
 * `scrollHeight`: it is integer-rounded, immune to a transform, and it is
 * exactly what the component's ResizeObservers watch — so the measured quantity
 * and the observed quantity are the same thing and the state cannot go stale.
 */
function viewportBox(el: Element | null | undefined, client: number, scroll: number): void {
  if (el === null || el === undefined) {
    throw new Error('expected the scroll viewport to exist');
  }
  Object.defineProperty(el, 'clientHeight', {value: client, configurable: true});
  Object.defineProperty(el, 'scrollHeight', {value: scroll, configurable: true});
  Object.defineProperty(el, 'scrollTop', {value: 0, writable: true, configurable: true});
}

function contentBox(el: Element | null | undefined, offset: number): void {
  if (el === null || el === undefined) {
    throw new Error('expected the scroll content wrapper to exist');
  }
  Object.defineProperty(el, 'offsetHeight', {value: offset, configurable: true});
}

type RafHost = {requestAnimationFrame?: (cb: (t: number) => void) => number};

/** `measure()` is rAF-coalesced on purpose (no layout thrash per scroll event),
 *  and JSDOM has no frame clock — so this file lends it one. Module state is
 *  BUNDLE-SHARED under mochapack, so the loan is scoped and given back. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Mount, size the two boxes, measure. `scroll` is the viewport's scrollable
 * overflow and `layout` the content's laid-out height — normally equal, and
 * deliberately DIFFERENT while a transform is in flight.
 */
async function mountMeasured(client: number, layout: number, scroll = layout) {
  const wrapper = mount(ConsoleScrollArea);
  viewportBox(wrapper.element.querySelector('.con-scroll-area__viewport'), client, scroll);
  contentBox(wrapper.element.querySelector('.con-scroll-area__content'), layout);
  (wrapper.vm as unknown as {measure: () => void}).measure();
  await nextFrame();
  await wrapper.vm.$nextTick();
  return wrapper;
}

async function railOf(client: number, layout: number, scroll = layout): Promise<boolean> {
  const wrapper = await mountMeasured(client, layout, scroll);
  const shown = wrapper.element.querySelector('.con-scroll-area__rail') !== null;
  wrapper.unmount();
  return shown;
}

describe('ConsoleScrollArea — the rail only promises a journey that exists', () => {
  let borrowed = false;

  before(() => {
    const host = globalThis as unknown as RafHost;
    borrowed = host.requestAnimationFrame === undefined;
    if (borrowed) {
      host.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0) as unknown as number;
    }
  });

  after(() => {
    if (borrowed) {
      delete (globalThis as unknown as RafHost).requestAnimationFrame;
    }
  });

  it('draws NO rail when the content fits', async () => {
    expect(await railOf(400, 400)).to.eq(false);
  });

  /** A hairline of overflow is a rounding artifact of fractional layout — both
   *  readings are integer-rounded, so they can disagree by one pixel. */
  it('draws NO rail for a sub-pixel-rounding overflow', async () => {
    expect(await railOf(400, 401)).to.eq(false);
  });

  /**
   * THE REGRESSION. The entrance cascade holds the work-surface groups at
   * `translateY(9px)` for the length of its tween: the viewport reports 9px of
   * scrollable overflow while the CONTENT still measures exactly the viewport's
   * height. Nothing has moved, so nothing may be advertised — and since the
   * transform ends without a resize, a rail raised here would never come down.
   */
  it('draws NO rail while an entrance transform inflates the scroll range', async () => {
    expect(await railOf(400, 400, 415)).to.eq(false);
  });

  it('draws the rail once there is real travel', async () => {
    expect(await railOf(400, 900)).to.eq(true);
  });

  /** The thumb reflects the REAL position and proportion — a rail that always
   *  showed a full-height thumb would be the same lie in a different shape. */
  it('sizes the thumb to the visible proportion', async () => {
    const wrapper = await mountMeasured(400, 1600);
    const thumb = wrapper.element.querySelector('.con-scroll-area__thumb') as HTMLElement | null;
    expect(thumb, 'expected a thumb inside the rail').to.not.eq(null);
    expect(thumb?.style.height).to.eq('25%');
    wrapper.unmount();
  });
});
