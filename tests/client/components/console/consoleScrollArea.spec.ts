import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
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

/** The same viewport box for an area that scrolls on the X axis. */
function sidewaysBox(el: Element, client: number, scroll: number): void {
  Object.defineProperty(el, 'clientWidth', {value: client, configurable: true});
  Object.defineProperty(el, 'scrollWidth', {value: scroll, configurable: true});
  Object.defineProperty(el, 'scrollLeft', {value: 0, writable: true, configurable: true});
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

  /** The host's own switches — and the one case where real travel is told (class + event) but never drawn. */
  it('wears its props: the X axis and `fill` on the root, the host\'s class on the content wrapper — and no rail when the host asked for none', async () => {
    const wrapper = mount(ConsoleScrollArea, {
      props: {axis: 'x', fill: true, contentClass: 'host-rows', indicator: false},
      slots: {default: () => h('p', {class: 'row'})},
    });
    expect(wrapper.classes()).to.include.members(['con-scroll-area', 'con-scroll-area--x', 'con-scroll-area--fill']);
    expect(wrapper.find('.con-scroll-area__viewport > .con-scroll-area__content.host-rows > .row').exists(), 'the slot stands in the content wrapper')
      .to.eq(true);

    const viewport = wrapper.find('.con-scroll-area__viewport');
    sidewaysBox(viewport.element, 400, 1600);
    Object.defineProperty(wrapper.find('.con-scroll-area__content').element, 'offsetWidth', {value: 1600, configurable: true});
    // The viewport's own scroll event re-measures (the template's `@scroll.passive`).
    await viewport.trigger('scroll');
    await nextFrame();
    await wrapper.vm.$nextTick();

    expect(wrapper.classes(), 'the X axis measured WIDTHS').to.contain('con-scroll-area--overflowing');
    expect(wrapper.emitted('overflow-change')).to.deep.eq([[true]]);
    expect(wrapper.find('.con-scroll-area__rail').exists(), 'the host asked for no indicator').to.eq(false);
    wrapper.unmount();
  });
});

/**
 * WHAT A HOST REACHES THROUGH ITS REF. The scroll area is a `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md — R8): its own `expose({…})` was its contract with the 28 parents that mount it, and
 * `defineExpose` holds exactly that list. Asserted the way a parent reads it — under a host with a string ref — never
 * through `wrapper.vm`, which sees the whole setup state and would stay green with the list gone.
 */
type ScrollAreaReach = {
  scrollByPx(delta: number): void,
  scrollToStart(opts?: {instant?: boolean}): void,
  scrollToEnd(): void,
  ensureVisible(el: Element | null | undefined, margin?: number, opts?: {instant?: boolean}): void,
  measure(): void,
};

/** A client rect that runs `lo … hi` along the scroll axis (100 px across it). */
function rectAt(axis: 'y' | 'x', lo: number, hi: number): DOMRect {
  return axis === 'y' ?
    {top: lo, bottom: hi, left: 0, right: 100, width: 100, height: hi - lo, x: 0, y: lo, toJSON: () => ({})} :
    {left: lo, right: hi, top: 0, bottom: 100, width: hi - lo, height: 100, x: lo, y: 0, toJSON: () => ({})};
}

describe('ConsoleScrollArea — what a parent\'s ref reaches', () => {
  // Every exposed function ends in the rAF-coalesced `measure()` — the same loan as the suite above, given back.
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

  function mountUnderHost(axis?: 'y' | 'x') {
    const overflow: Array<boolean> = [];
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleScrollArea, {
        ref: 'scroll',
        axis,
        onOverflowChange: (now: boolean) => {
          overflow.push(now);
        },
      }, {default: () => h('p', {class: 'row'})})]),
    });
    const host = mount(Host);
    return {
      host,
      overflow,
      /** Exactly the parents' read: `(this.$refs.scroll ?? undefined) as … | undefined`. */
      reach: () => (host.vm.$refs.scroll ?? undefined) as ScrollAreaReach | undefined,
      viewport: () => host.find('.con-scroll-area__viewport').element as HTMLElement,
    };
  }

  it('sees exactly the five functions the component exposed — nothing else of the script', () => {
    const {reach} = mountUnderHost();
    const scroll = reach();
    expect(scroll, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(scroll ?? {}), 'the exposed list is the contract')
      .to.deep.eq(['scrollByPx', 'scrollToStart', 'scrollToEnd', 'ensureVisible', 'measure']);
    // `overflowing` among them: the component never exposed it (RECIPES R8 — its own `expose` wins over a parent's read).
    for (const inner of ['viewport', 'content', 'overflowing', 'progress', 'ratio', 'thumbStyle', 'rootClasses', 'onScroll', 'stopScroll', 'flow']) {
      expect((scroll as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }
  });

  it('each exposed function drives THIS viewport: by a delta, to the end, back to the start, onto a row', () => {
    const {host, reach, viewport} = mountUnderHost();
    const scroll = reach();
    const vp = viewport();
    viewportBox(vp, 400, 1600);

    scroll?.scrollByPx(120);
    expect(vp.scrollTop, 'the right stick\'s delta').to.eq(120);
    scroll?.scrollByPx(-20);
    expect(vp.scrollTop).to.eq(100);

    scroll?.scrollToEnd();
    expect(vp.scrollTop, 'follow-latest: the whole scroll height').to.eq(1600);

    scroll?.scrollToStart({instant: true});
    expect(vp.scrollTop, 'back to the first row, settled now').to.eq(0);

    // A row below the fold: the least move that shows it with the margin (never `scrollIntoView`).
    const row = host.find('.row').element;
    vp.getBoundingClientRect = () => rectAt('y', 0, 400);
    row.getBoundingClientRect = () => rectAt('y', 900, 950);
    scroll?.ensureVisible(row, 12, {instant: true});
    expect(vp.scrollTop, 'the row\'s bottom + the margin at the viewport\'s bottom').to.eq(950 - (400 - 12));

    // Nothing to keep in view is not a move — and not a throw.
    scroll?.ensureVisible(null);
    scroll?.ensureVisible(undefined);
    expect(vp.scrollTop).to.eq(562);
  });

  it('on the X axis the same functions drive the viewport SIDEWAYS — the start and a row included', () => {
    const {host, reach, viewport} = mountUnderHost('x');
    const scroll = reach();
    const vp = viewport();
    sidewaysBox(vp, 400, 1600);

    scroll?.scrollByPx(120);
    expect(vp.scrollLeft, 'the delta moves the scroll axis').to.eq(120);

    scroll?.scrollToEnd();
    expect(vp.scrollLeft).to.eq(1600);

    scroll?.scrollToStart({instant: true});
    expect(vp.scrollLeft).to.eq(0);

    const row = host.find('.row').element;
    vp.getBoundingClientRect = () => rectAt('x', 0, 400);
    row.getBoundingClientRect = () => rectAt('x', 900, 950);
    scroll?.ensureVisible(row, 12, {instant: true});
    expect(vp.scrollLeft, 'the row\'s right edge + the margin at the viewport\'s right').to.eq(950 - (400 - 12));
  });

  it('`measure()` re-reads the boxes: the rail comes up and the host hears `overflow-change`', async () => {
    const {host, overflow, reach, viewport} = mountUnderHost();
    viewportBox(viewport(), 400, 1600);
    contentBox(host.find('.con-scroll-area__content').element, 1600);
    expect(host.find('.con-scroll-area__rail').exists(), 'nothing measured yet').to.eq(false);

    reach()?.measure();
    await nextFrame();
    await host.vm.$nextTick();

    expect(host.find('.con-scroll-area__rail').exists(), 'real travel is advertised').to.eq(true);
    expect(host.find('.con-scroll-area').classes()).to.contain('con-scroll-area--overflowing');
    expect(overflow, 'told once, with the new state').to.deep.eq([true]);
  });
});
