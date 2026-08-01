import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';

/**
 * THE SCROLL RAIL IS AN AFFORDANCE, NOT A MEASUREMENT REPORT.
 *
 * `scrollHeight > clientHeight` is true for a few sub-pixel rows of any
 * fractionally-laid-out content, and the rail that produced was the worst
 * possible shape: a nearly-full-height thumb, which reads as a scrollbar on a
 * surface that has nothing to scroll. It shipped that way down the right edge
 * of the card-play composer — a permanent bright line on a screen that fits.
 *
 * So the rail states «there is somewhere to go», and a few pixels of travel is
 * not somewhere. The content still scrolls if something forces it; it just
 * stops advertising a journey the player cannot make.
 */
function box(el: Element | null | undefined, client: number, scroll: number): void {
  if (el === null || el === undefined) {
    throw new Error('expected the scroll viewport to exist');
  }
  Object.defineProperty(el, 'clientHeight', {value: client, configurable: true});
  Object.defineProperty(el, 'scrollHeight', {value: scroll, configurable: true});
  Object.defineProperty(el, 'scrollTop', {value: 0, writable: true, configurable: true});
}

type RafHost = {requestAnimationFrame?: (cb: (t: number) => void) => number};

/** `measure()` is rAF-coalesced on purpose (no layout thrash per scroll event),
 *  and JSDOM has no frame clock — so this file lends it one. Module state is
 *  BUNDLE-SHARED under mochapack, so the loan is scoped and given back. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function railOf(client: number, scroll: number): Promise<boolean> {
  const wrapper = mount(ConsoleScrollArea);
  const viewport = wrapper.element.querySelector('.con-scroll-area__viewport');
  box(viewport, client, scroll);
  (wrapper.vm as unknown as {measure: () => void}).measure();
  await nextFrame();
  await wrapper.vm.$nextTick();
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

  /** THE REGRESSION. A hairline of overflow is a rounding artifact of
   *  fractional layout, not a scroll. */
  it('draws NO rail for a sub-pixel-rounding overflow', async () => {
    expect(await railOf(400, 403)).to.eq(false);
  });

  it('draws the rail once there is real travel', async () => {
    expect(await railOf(400, 900)).to.eq(true);
  });

  /** The thumb reflects the REAL position and proportion — a rail that always
   *  showed a full-height thumb would be the same lie in a different shape. */
  it('sizes the thumb to the visible proportion', async () => {
    const wrapper = mount(ConsoleScrollArea);
    const viewport = wrapper.element.querySelector('.con-scroll-area__viewport');
    box(viewport, 400, 1600);
    (wrapper.vm as unknown as {measure: () => void}).measure();
    await nextFrame();
    await wrapper.vm.$nextTick();
    const thumb = wrapper.element.querySelector('.con-scroll-area__thumb') as HTMLElement | null;
    expect(thumb, 'expected a thumb inside the rail').to.not.eq(null);
    expect(thumb?.style.height).to.eq('25%');
    wrapper.unmount();
  });
});
