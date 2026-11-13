/*
 * A TEMPLATE REF NAMED LIKE A REF-TYPED MEMBER — the twin (docs/claude/vapor/RECIPES.md § 1 · R11).
 *
 * `ref="sitting"` beside a computed `sitting` the template reads: the Options API kept them apart (`$refs` was its own
 * namespace), a `<script setup>` script has ONE scope. The conversion keeps the member's name — the template reads it,
 * and the template does not change — and names the ref's const `<key>El` (`const sittingEl = useTemplateRef('sitting')`).
 *
 * That is only right while the runtime never writes the element into the MEMBER: a computed would refuse the write
 * (with a warning), a data field would silently become the element. Vue decides it by `isTemplateRefKey` — a key that
 * `useTemplateRef` holds is set on the template ref alone — in BOTH shapes a template compiles to:
 *  · the STRING shape (a development build / this suite: `ref: 'sitting'`, resolved against the setup state);
 *  · the `ref_key` shape (an INLINE template — the production build: `{ref_key: 'sitting', ref: sitting}`).
 * This spec pins both, so a release that changes the rule is red here and not in a Parliament sitting.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {computed, defineComponent, h, nextTick, ref, useTemplateRef} from 'vue';
import RefKeyTwinProbe from './fixtures/RefKeyTwinProbe.vue';

type Twin = {panel: string, count: number, panelEl: HTMLElement | null, countEl: HTMLElement | null, bump?: () => void};

/** What the SFC compiler emits for the probe's template when it is INLINED into `setup()` (a production build). */
const InlineTwin = defineComponent({
  props: {side: {type: String, required: true}},
  setup(props, {expose}) {
    const panel = computed(() => props.side);
    const count = ref(1);
    const panelEl = useTemplateRef<HTMLElement>('panel');
    const countEl = useTemplateRef<HTMLElement>('count');
    expose({panel, count, panelEl, countEl});
    return () => h('section', {'class': 'twin', 'data-side': panel.value, 'data-count': count.value}, [
      h('b', {ref_key: 'panel', ref: panel, class: 'twin__panel'}, 'panel'),
      h('i', {ref_key: 'count', ref: count, class: 'twin__count'}, 'count'),
    ]);
  },
});

describe('a template ref named like a ref-typed member — the member keeps its value, the ref gets the element', () => {
  let warn: typeof console.warn;
  let warned: Array<string>;

  beforeEach(() => {
    warn = console.warn;
    warned = [];
    console.warn = (...args: Array<unknown>): void => {
      warned.push(String(args[0]).slice(0, 160));
    };
  });

  afterEach(() => {
    console.warn = warn;
  });

  for (const [shape, component] of [['the STRING shape (a development build)', RefKeyTwinProbe], ['the `ref_key` shape (an inline template — production)', InlineTwin]] as const) {
    it(`${shape}: the computed and the data field are never written, the template refs hold the elements`, async () => {
      const Host = defineComponent({
        components: {Twin: component},
        props: {side: {type: String, required: true}},
        template: '<div class="host"><Twin ref="twin" :side="side" /></div>',
      });
      const wrapper = mount(Host, {props: {side: 'left'}});
      await nextTick();
      const twin = wrapper.vm.$refs.twin as unknown as Twin;

      expect(twin.panel, 'the computed still answers').to.equal('left');
      expect(twin.count, 'the data field is still a number — never the element').to.equal(1);
      expect(twin.panelEl, 'the ref of the computed\'s name holds its element').to.equal(wrapper.find('.twin__panel').element);
      expect(twin.countEl, 'the ref of the data field\'s name holds its element').to.equal(wrapper.find('.twin__count').element);
      expect(wrapper.find('.twin').attributes('data-side'), 'the template reads the member').to.equal('left');

      await wrapper.setProps({side: 'right'});
      expect(twin.panel, 'the computed keeps following its source').to.equal('right');
      expect(wrapper.find('.twin').attributes('data-side')).to.equal('right');
      expect(wrapper.find('.twin').attributes('data-count'), 'a re-render re-sets the refs — and still writes no member').to.equal('1');
      expect(twin.count).to.equal(1);
      expect(twin.panelEl).to.equal(wrapper.find('.twin__panel').element);

      wrapper.unmount();
      expect(twin.count, 'an unmount clears the template ref, never the member').to.equal(1);
      expect(warned, 'no warning — not «used on a non-ref value», not «computed value is readonly»').to.deep.equal([]);
    });
  }

  it('the data field stays the component\'s own state (a write of its own still lands)', async () => {
    const Host = defineComponent({
      components: {RefKeyTwinProbe},
      template: '<div class="host"><RefKeyTwinProbe ref="twin" side="left" /></div>',
    });
    const wrapper = mount(Host);
    await nextTick();
    const twin = wrapper.vm.$refs.twin as unknown as Twin;
    twin.bump?.();
    await nextTick();
    expect(twin.count).to.equal(2);
    expect(wrapper.find('.twin').attributes('data-count')).to.equal('2');
    expect(twin.countEl).to.equal(wrapper.find('.twin__count').element);
    expect(warned).to.deep.equal([]);
  });
});
