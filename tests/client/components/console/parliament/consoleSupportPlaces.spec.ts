/*
 * ConsoleSupportPlaces — popular support as PLACES: the one markup of a party's support area. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md); nothing reaches it through a ref — its whole contract is what it
 * renders for its props, on the root its host names through fall-through attributes.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, reactive} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsoleSupportPlaces from '@/client/components/console/parliament/ConsoleSupportPlaces.vue';
import {PARLIAMENT_MAX_POPULAR_SUPPORT, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {PartyName} from '@/common/turmoil/PartyName';
import {
  answerSupportPlaceOnce, answeringSupportPlaces, endSupportPlaceAnswer, SUPPORT_PLACE_ANSWER_ATTR, SupportPlaceAnswer,
} from '@/client/console/parliament/supportPlaceAnswer';
import {flySupportDiscard} from '@/client/console/parliament/supportDiscardScene';

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

/** The block as a plaque hosts it: its counts in the host's reactive state, the block named by the plaque's attribute. */
function plaqueBlock(state: {filled: number, incoming: number}, party: ReduxParty) {
  const Host = defineComponent({
    render: () => h(ConsoleSupportPlaces as any, {'filled': state.filled, 'incoming': state.incoming, 'data-parl-support': party}),
  });
  return mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: {PlayerDelegate: DelegateStub}}});
}

/** Is a place playing its one-shot answer? (The ONE reader — the mark is the product's attribute.) */
const answering = (el: Element, answer: SupportPlaceAnswer): boolean => el.hasAttribute(SUPPORT_PLACE_ANSWER_ATTR[answer]);

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

  /*
   * THE ONE-SHOT ANSWERS ARE ATTRIBUTES, never classes (FLAKE ZERO, 2026-11-16): a socket is a `v-for` row of a Vapor
   * template, and on a NON-ROOT element a class binding whose value changes writes `className` WHOLE. The callback
   * that lights an answer also moves the count those bindings read — so a class written there was wiped by that very
   * flush (`console-parliament-sitting-v4`: no socket ever answered a landing).
   */
  it('the TOUCHDOWN answer survives the landing\'s own re-render — the socket turns `--on` in the same task', async () => {
    const state = reactive({filled: 1, incoming: 1});
    const w = plaqueBlock(state, PartyName.UNITY);
    const place = w.findAll(PLACE)[1].element as HTMLElement;
    expect(place.classList.contains('con-pseal__support-place--incoming')).to.eq(true);
    // The sitting's landing (`sittingDirector.answerSupportPlace`, then the hold consumed): ONE task.
    answerSupportPlaceOnce(place, 'landed');
    place.classList.add('probe-imperative-class');
    state.filled = 2;
    state.incoming = 0;
    await nextTick();
    expect(place.classList.contains('con-pseal__support-place--on'), 'the landing re-rendered the socket').to.eq(true);
    expect(answering(place, 'landed'), 'the answer stands through the re-render').to.eq(true);
    expect(place.classList.contains('probe-imperative-class'), 'a CLASS written there is wiped — why the answer is not one').to.eq(false);
    expect((w.element as Element).querySelectorAll(answeringSupportPlaces('landed')), 'one socket answers').to.have.length(1);
    // …and it ends on its own `animationend`; the next socket's answer ends it at once.
    place.dispatchEvent(new window.Event('animationend'));
    expect(answering(place, 'landed')).to.eq(false);
    answerSupportPlaceOnce(place, 'landed');
    endSupportPlaceAnswer(place, 'landed');
    expect(answering(place, 'landed')).to.eq(false);
  });

  it('the LIFT-OFF answer survives the lift\'s own re-render — the discard lowers the stock and lights the place in one task', async () => {
    const state = reactive({filled: 2, incoming: 0});
    const w = plaqueBlock(state, PartyName.REDS);
    // The two places whose cubes leave (the third stands empty throughout — its bindings never change).
    const sockets = w.findAll(PLACE).map((p) => p.element as HTMLElement).slice(0, 2);
    sockets.forEach((el) => el.classList.add('probe-imperative-class'));
    const lifted: Array<number> = [];
    // No measurable figure in a unit mount: every cube «lifts» and lands at once — the same order of writes.
    flySupportDiscard(w.element as HTMLElement, PartyName.REDS, 2, {
      onLifted: (place) => {
        lifted.push(place);
        state.filled -= 1; // `liftSupportDiscardCube` — the plaque stops drawing the cube
      },
      onLanded: () => undefined,
      onDone: () => undefined,
      onDegraded: () => undefined,
    });
    await nextTick();
    expect(lifted, 'the places from the right').to.deep.eq([2, 1]);
    expect(sockets.map((el) => el.classList.contains('con-pseal__support-place--on')), 'the lift re-rendered the sockets').to.deep.eq([false, false]);
    expect(sockets.map((el) => answering(el, 'left')), 'each place that let its cube go answers').to.deep.eq([true, true]);
    expect(sockets.map((el) => el.classList.contains('probe-imperative-class')), 'a CLASS written there is wiped').to.deep.eq([false, false]);
    sockets.forEach((el) => el.dispatchEvent(new window.Event('animationend')));
    expect(sockets.map((el) => answering(el, 'left'))).to.deep.eq([false, false]);
  });
});
