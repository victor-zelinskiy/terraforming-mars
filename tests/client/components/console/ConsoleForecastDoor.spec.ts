/*
 * ConsoleForecastDoor — the door of the R3 «Эффекты» layer on a stage. A VAPOR component (the Vue 3.6 pilot —
 * docs/claude/vapor/ROADMAP.md §3.6) mounted under a virtual-DOM host, as it is in the four hosts that use it: its
 * root is a `v-if`, the host lets `data-unfold-late` fall through onto it and listens to `open`, and it hosts two
 * virtual-DOM children (the reactions group, the glyph).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, reactive} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleForecastDoor from '@/client/components/console/ConsoleForecastDoor.vue';
import {VariantReaction} from '@/client/console/effectForecastModel';

// No stubs: test-utils' `stubs` reach components resolved by the virtual-DOM renderer, and the two children here are
// created by a Vapor parent — they are the real ones (the capability table, ROADMAP §3.6).
const NONE: VariantReaction = {chips: [], more: 0, total: 0};
const FOLDED: VariantReaction = {chips: [], more: 2, total: 2};

function mountDoor(initial: {reaction: VariantReaction, canOpen?: boolean, pulse?: boolean}) {
  const props = reactive({canOpen: false, pulse: false, ...initial});
  const opened: Array<number> = [];
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleForecastDoor, {...props, 'data-unfold-late': '', 'onOpen': () => opened.push(1)})]),
  });
  const wrapper = mount(Host, {...globalConfig, attachTo: document.body});
  return {wrapper, props, opened, door: () => wrapper.find('[data-forecast-row]')};
}

describe('ConsoleForecastDoor (a Vapor leaf)', () => {
  it('is absent while the table adds nothing; present with the host\'s attribute the moment it does', async () => {
    const {props, door} = mountDoor({reaction: NONE});
    expect(door().exists(), 'nothing to show — no door').to.equal(false);

    props.reaction = FOLDED;
    await nextTick();
    expect(door().exists()).to.equal(true);
    expect(door().classes()).to.include('con-fxdoor');
    expect(door().attributes('data-unfold-late'), 'the host\'s attribute falls through onto the returned root').to.equal('');
    expect(door().find('[data-forecast-vfx]').exists(), 'the virtual-DOM child (the reactions group) rendered from its prop').to.equal(true);
  });

  it('draws the key only while the host says the door may open; a click opens the layer', async () => {
    const {props, door, opened} = mountDoor({reaction: FOLDED});
    expect(door().find('.con-forecast__key').exists()).to.equal(false);

    props.canOpen = true;
    await nextTick();
    expect(door().find('.con-forecast__key').element.childElementCount, 'the R3 glyph (a virtual-DOM child) stands in the key').to.be.greaterThan(0);

    await door().trigger('click');
    expect(opened, 'the host heard `open`').to.deep.equal([1]);
  });

  it('wears the commit flare while the host pulses it', async () => {
    const {props, door} = mountDoor({reaction: FOLDED});
    expect(door().classes()).to.not.include('con-forecast--descend');
    props.pulse = true;
    await nextTick();
    expect(door().classes()).to.include('con-forecast--descend');
  });
});
