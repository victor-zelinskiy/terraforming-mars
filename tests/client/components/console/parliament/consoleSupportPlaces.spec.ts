/*
 * ConsoleSupportPlaces — popular support as PLACES: the one markup of a party's support area. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md); nothing reaches it through a ref — its whole contract is what it
 * renders for its props, on the root its host names through fall-through attributes.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsoleSupportPlaces from '@/client/components/console/parliament/ConsoleSupportPlaces.vue';
import {PARLIAMENT_MAX_POPULAR_SUPPORT} from '@/common/parliament/ParliamentTypes';

// The cube is the delegate figure — its own subject; this spec reads what each place HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const DelegateStub = defineComponent({
  name: 'PlayerDelegate',
  props: {color: String, steel: Boolean, glow: {type: Boolean, default: true}},
  render: () => h('i', {class: 'delegate-stub'}),
});

function places(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(ConsoleSupportPlaces as any, {
    ...globalConfig,
    props,
    attrs,
    global: {...globalConfig.global, stubs: {PlayerDelegate: DelegateStub}},
  });
}

const PLACE = '.con-pseal__support-place';

describe('ConsoleSupportPlaces — popular support as places', () => {
  it('the sockets are ALWAYS reserved; a neutral steel cube stands in each filled one', () => {
    const empty = places({filled: 0});
    expect(empty.findAll(PLACE).map((p) => p.attributes('data-support-place')))
      .to.deep.eq(Array.from({length: PARLIAMENT_MAX_POPULAR_SUPPORT}, (_, i) => String(i + 1)));
    expect(empty.find('.delegate-stub').exists()).to.eq(false);
    expect(empty.attributes('aria-hidden')).to.eq('true');

    const two = places({filled: 2});
    const sockets = two.findAll(PLACE);
    expect(sockets.map((p) => p.classes().includes('con-pseal__support-place--on'))).to.deep.eq([true, true, false]);
    expect(sockets.map((p) => p.find('.delegate-stub').exists())).to.deep.eq([true, true, false]);
    const cube = two.findComponent(DelegateStub);
    expect(cube.props('color')).to.eq('neutral');
    expect(cube.props('steel')).to.eq(true);
    expect(cube.props('glow')).to.eq(false);
  });

  it('a forecast is an outline, never a cube: incoming after the standing ones, outgoing from the last, counted from the first', () => {
    const w = places({filled: 1, incoming: 1, outgoing: 1, counted: 1});
    const sockets = w.findAll(PLACE);
    expect(sockets.map((p) => p.attributes('data-support-incoming'))).to.deep.eq([undefined, '', undefined]);
    expect(sockets.map((p) => p.attributes('data-support-outgoing'))).to.deep.eq(['', undefined, undefined]);
    expect(sockets.map((p) => p.attributes('data-support-counted'))).to.deep.eq(['', undefined, undefined]);
    expect(sockets[1].classes()).to.include('con-pseal__support-place--incoming');
    expect(sockets[0].classes()).to.include.members(['con-pseal__support-place--outgoing', 'con-pseal__support-place--counted']);
    expect(w.findAll('.delegate-stub').length, 'an arriving place draws no cube').to.eq(1);
  });

  it('void empty places: one by one beside a standing cube, the whole block with none — and it follows its props', async () => {
    const w = places({filled: 1, voidEmpty: true});
    expect(w.classes(), 'a cube that IS standing is a fact').to.not.include('con-pseal__support--void');
    expect(w.findAll(PLACE).map((p) => p.classes().includes('con-pseal__support-place--void'))).to.deep.eq([false, true, true]);

    await w.setProps({filled: 0});
    expect(w.classes()).to.include('con-pseal__support--void');

    await w.setProps({incoming: 1});
    expect(w.classes(), 'a place about to be taken is not void').to.not.include('con-pseal__support--void');

    await w.setProps({incoming: 0, voidEmpty: false});
    expect(w.classes()).to.not.include('con-pseal__support--void');
  });

  it('the template STARTS WITH ITS ROOT — the host names the block through its own attributes', () => {
    const w = places({filled: 0}, {'class': 'con-parl__support-places', 'data-parl-support': ''});
    expect((w.element as HTMLElement).tagName).to.eq('SPAN');
    expect(w.classes()).to.include.members(['con-pseal__support', 'con-parl__support-places']);
    expect(w.attributes('data-parl-support')).to.eq('');
  });
});
