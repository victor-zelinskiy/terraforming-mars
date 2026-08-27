import {mount, VueWrapper} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ArcScale from '@/client/components/board/ArcScale.vue';
import {ARC_SCALE_THEMES} from '@/client/components/board/arcScaleTheme';
import {OCEAN_ARC, OXYGEN_ARC} from '@/client/components/board/arcScaleConfigs';

/**
 * THE CURSOR MAY NEVER LAG THE DIAL IT SITS ON.
 *
 * `AnimatedScaleMarker` is mounted through its real host (`ArcScale`), so
 * the `.global-numbers-value.val-*` anchors it reads are the ones the
 * product renders — and the assertions below are all on RENDERED state
 * (the readiness class, the inline transform), never on internals.
 *
 * jsdom has no layout: `offsetLeft` / `offsetTop` are 0 for everything and
 * `offsetParent` is null. The first is fixed here by resolving those two
 * off the inline `left` / `top` ArcScale itself writes (restored in
 * `after`, since module/prototype state is bundle-shared); the second is
 * left alone on purpose — a null offsetParent is "not being rendered", so
 * the marker takes its SNAP path and no WAAPI is involved. Where the glide
 * actually lands is measured on a real board in
 * `tests/e2e/console-scale-marker.spec.ts`.
 *
 * The regression this pins: the ocean dial's digits run 1..9 while the
 * parameter starts at 0, so on a fresh game the cursor mounts with nothing
 * to point at. It used to record that as a permanent `ready = false` latch
 * AND gate its own `value` watcher on that latch — so the ocean cursor
 * never appeared again for the rest of the session, however many oceans
 * were placed.
 */

type Offsets = {get(this: HTMLElement): number};

let savedLeft: PropertyDescriptor | undefined;
let savedTop: PropertyDescriptor | undefined;

/** Resolve a digit's offset from the inline coordinate ArcScale wrote. */
function inlineOffset(prop: 'left' | 'top'): Offsets {
  return {
    get(this: HTMLElement): number {
      return parseFloat(this.style?.getPropertyValue(prop) ?? '') || 0;
    },
  };
}

/** Mount and let the marker's own `mounted()` placement reach the DOM. */
async function mountScale(theme: 'oceans' | 'oxygen', value: number): Promise<VueWrapper> {
  const wrapper = mount(ArcScale, {
    ...globalConfig,
    props: {
      theme: ARC_SCALE_THEMES[theme],
      config: theme === 'oceans' ? OCEAN_ARC : OXYGEN_ARC,
      value,
    },
  });
  await wrapper.vm.$nextTick();
  return wrapper as VueWrapper;
}

/** The transform the cursor currently carries. */
function cursorTransform(wrapper: VueWrapper): string {
  return (wrapper.find('.scale-marker').element as HTMLElement).style.transform;
}

/** Where the dial's `value` cell actually sits (the anchor the cursor owes). */
function cellCentre(wrapper: VueWrapper, value: number): string {
  const cell = wrapper.find(`.arc-scale__digit.val-${value}`).element as HTMLElement;
  return `translate(${cell.offsetLeft}px, ${cell.offsetTop}px)`;
}

function onDial(wrapper: VueWrapper): boolean {
  return wrapper.find('.scale-marker--ready').exists();
}

describe('AnimatedScaleMarker', () => {
  before(() => {
    savedLeft = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft');
    savedTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
    Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {...inlineOffset('left'), configurable: true});
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {...inlineOffset('top'), configurable: true});
  });
  after(() => {
    // Module state (and prototypes) are BUNDLE-SHARED in mochapack.
    if (savedLeft !== undefined) {
      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', savedLeft);
    }
    if (savedTop !== undefined) {
      Object.defineProperty(HTMLElement.prototype, 'offsetTop', savedTop);
    }
  });

  it('is off the dial while the value has no printed cell', async () => {
    const wrapper = await mountScale('oceans', 0);
    expect(onDial(wrapper), '0 oceans has no cell on a 1..9 dial').to.be.false;
    expect(wrapper.find('.scale-marker--pending').exists()).to.be.true;
  });

  it('steps ONTO the dial as soon as the value has one', async () => {
    const wrapper = await mountScale('oceans', 0);
    await wrapper.setProps({value: 1});
    expect(onDial(wrapper), 'the cursor never came back after an off-dial mount').to.be.true;
    expect(cursorTransform(wrapper)).to.contain(cellCentre(wrapper, 1));
  });

  it('keeps following the value after that', async () => {
    const wrapper = await mountScale('oceans', 0);
    await wrapper.setProps({value: 1});
    await wrapper.setProps({value: 4});
    expect(cursorTransform(wrapper)).to.contain(cellCentre(wrapper, 4));
    await wrapper.setProps({value: 9});
    expect(cursorTransform(wrapper)).to.contain(cellCentre(wrapper, 9));
  });

  it('steps back OFF the dial if the value leaves its range, and returns', async () => {
    const wrapper = await mountScale('oceans', 3);
    expect(onDial(wrapper)).to.be.true;
    await wrapper.setProps({value: 0});
    expect(onDial(wrapper)).to.be.false;
    await wrapper.setProps({value: 2});
    expect(onDial(wrapper)).to.be.true;
    expect(cursorTransform(wrapper)).to.contain(cellCentre(wrapper, 2));
  });

  it('tracks a scale whose first value IS the parameter start', async () => {
    const wrapper = await mountScale('oxygen', 0);
    expect(onDial(wrapper), 'oxygen 0 is a printed cell').to.be.true;
    await wrapper.setProps({value: 14});
    expect(cursorTransform(wrapper)).to.contain(cellCentre(wrapper, 14));
  });
});
