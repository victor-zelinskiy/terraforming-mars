import {mount, VueWrapper} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import AnimatedScaleMarker from '@/client/components/board/AnimatedScaleMarker.vue';
import {accentBaseline, AccentName} from '@/client/components/board/animatedScaleMarkerState';
import ArcScale from '@/client/components/board/ArcScale.vue';
import {ARC_SCALE_THEMES} from '@/client/components/board/arcScaleTheme';
import {OCEAN_ARC, OXYGEN_ARC} from '@/client/components/board/arcScaleConfigs';
import {scaleMarkerArrived, scaleMarkerPoses, scaleMarkerRestsOn} from '@/client/components/board/scaleMarkerArrival';

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
 *
 * The marker is a `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md); the second half of this file is its own
 * surface, mounted beside the digits of a bare dial: what it renders for its
 * two props, where it says it rests (the element's `data-scale-marker-at` and
 * the arrival signal a scene waits for), that it exposes nothing — and that
 * the baseline a remount glides FROM is the MODULE's
 * (`animatedScaleMarkerState.ts`): a statement of the script itself would be
 * one per instance, and no cursor would ever have a previous value.
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

/** Mount and let the marker's own `onMounted` placement reach the DOM. */
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

/** The values a bare dial prints, 20 px apart on one line: 0 at x 10, 2 at 30, 4 at 50, 6 at 70 — all at y 50. */
const DIAL_VALUES = [0, 2, 4, 6];
const ACCENTS: ReadonlyArray<AccentName> = ['temperature', 'oxygen', 'venus', 'oceans'];

/**
 * The marker as the product stands it: a sibling of the `.global-numbers-value.val-N` digits inside one box, under a
 * host that holds a ref on it. (A render function, not a template string: the runtime compiler is not in this build.)
 */
const Dial = defineComponent({
  props: {
    value: {type: Number, required: true},
    accent: {type: String as PropType<AccentName>, default: 'venus'},
  },
  render() {
    return h('div', {class: 'dial'}, [
      ...DIAL_VALUES.map((value, i) => h('div', {class: `global-numbers-value val-${value}`, style: {left: `${10 + 20 * i}px`, top: '50px'}})),
      h(AnimatedScaleMarker, {ref: 'marker', value: this.value, accent: this.accent}),
    ]);
  },
});

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

  describe('the component itself — a `<script setup>` cursor beside the digits of a bare dial', () => {
    let saved: Record<AccentName, number | undefined>;

    // Module state is BUNDLE-SHARED: every test here starts from «no scale was ever seen», and the baselines the
    // earlier specs left are put back for the later ones. (The arrival signal needs no restore: a cursor that
    // unmounts — the bundle's auto-unmount included — publishes «rests nowhere» itself.)
    beforeEach(() => {
      saved = {
        temperature: accentBaseline.temperature.lastValue,
        oxygen: accentBaseline.oxygen.lastValue,
        venus: accentBaseline.venus.lastValue,
        oceans: accentBaseline.oceans.lastValue,
      };
      for (const accent of ACCENTS) {
        accentBaseline[accent].lastValue = undefined;
      }
    });
    afterEach(() => {
      for (const accent of ACCENTS) {
        accentBaseline[accent].lastValue = saved[accent];
      }
    });

    it('is ONE root — the cursor: its accent as a class and an attribute, four parts, hidden from readers; what a host lets fall through lands on it', () => {
      const wrapper = mount(AnimatedScaleMarker, {
        ...globalConfig,
        props: {value: 3, accent: 'temperature'},
        attrs: {'data-from-host': 'yes'},
      });
      expect(wrapper.element.tagName, 'the template starts with its root — the comment that opened it lives in the script').to.eq('DIV');
      expect(wrapper.attributes('data-from-host')).to.eq('yes');
      expect(wrapper.attributes('data-scale-marker')).to.eq('temperature');
      expect(wrapper.attributes('aria-hidden')).to.eq('true');
      // No digit stands beside it: nothing to point at, so it waits off the dial.
      expect(wrapper.classes()).to.deep.eq(['scale-marker', 'scale-marker--temperature', 'scale-marker--pending']);
      expect(Array.from(wrapper.element.children).map((part) => (part as Element).className)).to.deep.eq([
        'scale-marker__glass',
        'scale-marker__ping',
        'scale-marker__tick scale-marker__tick--top',
        'scale-marker__tick scale-marker__tick--bottom',
      ]);
    });

    it('stands on the digit of its value, follows it, and says where it rests — on the element and to whoever waits for its arrival', async () => {
      const host = mount(Dial, {...globalConfig, props: {value: 2}});
      await nextTick();
      const cursor = () => host.find('.scale-marker');
      const transform = () => (cursor().element as HTMLElement).style.transform;

      expect(cursor().classes()).to.include.members(['scale-marker--venus', 'scale-marker--ready']);
      expect(transform()).to.contain('translate(30px, 50px)');
      expect(cursor().attributes('data-scale-marker-at')).to.eq('2');
      expect(scaleMarkerPoses.venus).to.deep.eq({value: 2, moving: false, target: undefined});
      expect(scaleMarkerArrived('venus', 2)).to.be.true;

      await host.setProps({value: 6});
      expect(transform()).to.contain('translate(70px, 50px)');
      expect(cursor().attributes('data-scale-marker-at')).to.eq('6');
      expect(scaleMarkerRestsOn('venus', 6)).to.be.true;

      // A value the dial does not print: the cursor steps off and rests nowhere…
      await host.setProps({value: 5});
      expect(cursor().classes()).to.contain('scale-marker--pending');
      expect(cursor().attributes('data-scale-marker-at')).to.be.undefined;
      expect(scaleMarkerPoses.venus.value).to.be.undefined;

      // …and is back on the first value that has a cell.
      await host.setProps({value: 4});
      expect(cursor().classes()).to.contain('scale-marker--ready');
      expect(transform()).to.contain('translate(50px, 50px)');
      expect(scaleMarkerRestsOn('venus', 4)).to.be.true;

      host.unmount();
      expect(scaleMarkerPoses.venus, 'a cursor that is gone rests nowhere').to.deep.eq({value: undefined, moving: false, target: undefined});
    });

    it('after a remount the cursor starts where its scale STOOD and moves to where it stands — the baseline is the module\'s, one per scale, never the instance\'s', async () => {
      const first = mount(Dial, {...globalConfig, props: {value: 2}});
      await nextTick();
      expect(accentBaseline.venus.lastValue).to.eq(2);
      await first.setProps({value: 6});
      expect(accentBaseline.venus.lastValue, 'a change seen through the prop moves the baseline too').to.eq(6);
      first.unmount();

      // The same scale mounts again at another value: the first frame is the PREVIOUS value's digit, a tick later
      // the cursor stands on the value (jsdom renders nothing, so the trip between the two is the snap).
      const second = mount(Dial, {...globalConfig, props: {value: 0}});
      const cursor = second.find('.scale-marker').element as HTMLElement;
      expect(cursor.style.transform, 'the first frame is where the scale stood').to.contain('translate(70px, 50px)');
      expect(cursor.dataset.scaleMarkerAt).to.eq('6');
      expect(accentBaseline.venus.lastValue).to.eq(0);
      await nextTick();
      await nextTick();
      expect(cursor.style.transform).to.contain('translate(10px, 50px)');
      expect(cursor.dataset.scaleMarkerAt).to.eq('0');

      // Another scale has a baseline of its own: nothing to start from, so it stands on its value at once.
      const other = mount(Dial, {...globalConfig, props: {value: 4, accent: 'temperature'}});
      expect((other.find('.scale-marker').element as HTMLElement).style.transform).to.contain('translate(50px, 50px)');
      expect(accentBaseline.temperature.lastValue).to.eq(4);
      expect(accentBaseline.venus.lastValue, 'the other scale\'s baseline is untouched').to.eq(0);
    });

    it('a parent\'s ref reaches nothing — the band drives the cursor by its two props alone', () => {
      const host = mount(Dial, {...globalConfig, props: {value: 2}});
      expect(host.find('.scale-marker').exists()).to.be.true;
      expect(Object.keys((host.vm.$refs.marker ?? {}) as object), 'no `defineExpose`: ArcScale stands no ref on it').to.deep.eq([]);
    });
  });
});
