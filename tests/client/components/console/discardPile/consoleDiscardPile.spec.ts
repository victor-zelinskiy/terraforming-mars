/*
 * ConsoleDiscardPile — «СБРОШЕННЫЕ», the discard pile of the table. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — its whole input is the pile's MODULE state
 * (`discardPile.ts`) and the hand's «tray armed» flag, so the spec is what it renders for that state, that it FOLLOWS
 * it, and what it reports back to the module (the landing box and the stack; the end of its leave). The count's
 * readout and the glyph are stubbed by name (the spec reads what the pile hands them); `<transition>` is test-utils'
 * stub — the leave's end is said by emitting its `after-leave`.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {
  discardPileSlotEl, discardPileStackEl, discardPileState, landOnDiscardPile, openDiscardPile, releaseDiscardPile, resetDiscardPile,
} from '@/client/console/discardPile/discardPile';
import {cardDiscardState} from '@/client/console/cardDiscard/cardDiscardState';
import ConsoleDiscardPile from '@/client/components/console/discardPile/ConsoleDiscardPile.vue';

const FlipValueStub = defineComponent({
  name: 'ConsoleFlipValue',
  props: {value: {type: Number, default: -1}, accent: {type: String, default: ''}},
  render: () => h('i', {class: 'flip-stub'}),
});
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: {type: String, default: ''}},
  render: () => h('i', {class: 'glyph-stub'}),
});

function pile() {
  return mount(ConsoleDiscardPile, {
    attachTo: document.body,
    global: {...globalConfig.global, stubs: {ConsoleFlipValue: FlipValueStub, GamepadGlyph: GlyphStub}},
  });
}

describe('ConsoleDiscardPile — the discard pile of the table', () => {
  // Module state every spec of the bundle shares: the pile starts and ends at rest, the tray flag is put back.
  let trayArmed: boolean;

  beforeEach(() => {
    resetDiscardPile();
    trayArmed = cardDiscardState.trayArmed;
    cardDiscardState.trayArmed = false;
  });
  afterEach(() => {
    cardDiscardState.trayArmed = trayArmed;
    resetDiscardPile();
  });

  it('is in while nobody holds a lease, and reports no landing box', () => {
    const w = pile();
    expect(w.find('.con-dpile').exists()).to.eq(false);
    expect(discardPileSlotEl()).to.eq(undefined);
    expect(discardPileStackEl()).to.eq(null);
  });

  it('comes out at its anchor with its leases, its count and its berth — and hands the module its landing box and stack', async () => {
    const w = pile();
    openDiscardPile('scene:1');
    discardPileState.anchor = {left: 300, top: 44};
    await nextTick();
    const root = w.find('.con-dpile');
    expect(root.attributes('aria-hidden')).to.eq('true');
    expect(root.attributes('data-discard-pile')).to.eq('');
    expect(root.attributes('data-discard-pile-count')).to.eq('0');
    expect(root.attributes('data-discard-pile-expected')).to.eq('0');
    expect(root.attributes('data-discard-pile-holders')).to.eq('scene:1');
    const {left, top} = (root.element as HTMLElement).style;
    expect({left, top}).to.deep.eq({left: '300px', top: '44px'});
    expect(root.find('.con-dpile__label').text()).to.eq('DISCARDED');
    expect(w.findComponent(FlipValueStub).props()).to.deep.eq({value: 0, accent: 'gold'});

    // Before the first card the berth is the only thing drawn.
    const stack = root.find('.con-dpile__stack');
    expect(stack.classes()).to.include('con-dpile__stack--empty');
    expect(Array.from(stack.element.children).map((el) => el.className)).to.deep.eq(['con-dpile__slot']);
    expect(discardPileSlotEl() === stack.find('.con-dpile__slot').element, 'the box a flying card aims at').to.eq(true);
    expect(discardPileStackEl() === stack.element, 'the viewer\'s physical origin').to.eq(true);

    // The tray is armed by the hand — the receiver lights up; a reveal's lease offers its viewer.
    expect(root.find('.con-dpile__plate').classes()).to.not.include('con-dpile__plate--armed');
    expect(root.find('[data-discard-pile-hint]').exists()).to.eq(false);
    cardDiscardState.trayArmed = true;
    openDiscardPile('reveal:1');
    await nextTick();
    expect(root.find('.con-dpile__plate').classes()).to.include('con-dpile__plate--armed');
    expect(root.attributes('data-discard-pile-holders')).to.eq('reveal:1 scene:1');
    expect(w.findComponent(GlyphStub).props('control')).to.eq('stickR');
  });

  it('a landing ticks the count, thickens the stack up to three backs and plays its one-shot pulse', async () => {
    const w = pile();
    openDiscardPile('scene:1');
    await nextTick();
    const stack = w.find('.con-dpile__stack');
    const backs = (): number => stack.findAll('.con-dpile__back').length;

    landOnDiscardPile();
    await flushPromises();
    expect(w.find('.con-dpile').attributes('data-discard-pile-count')).to.eq('1');
    expect(w.findComponent(FlipValueStub).props('value')).to.eq(1);
    expect(backs()).to.eq(1);
    expect(stack.classes()).to.not.include('con-dpile__stack--empty');
    expect(stack.classes(), 'the pile answers the contact').to.include('con-dpile__stack--pulse');

    // The pulse ends on its own `animationend` (a child's does not end it).
    await stack.find('.con-dpile__slot').trigger('animationend');
    expect(stack.classes()).to.include('con-dpile__stack--pulse');
    await stack.trigger('animationend');
    expect(stack.classes()).to.not.include('con-dpile__stack--pulse');

    for (let i = 0; i < 4; i++) {
      landOnDiscardPile();
    }
    await flushPromises();
    expect(w.findComponent(FlipValueStub).props('value')).to.eq(5);
    expect(backs(), 'the count carries the rest').to.eq(3);
  });

  it('the last lease released takes it in; the end of its leave closes the episode — and an unmount hands the boxes back', async () => {
    const w = pile();
    openDiscardPile('scene:1');
    landOnDiscardPile();
    await flushPromises();
    expect(discardPileStackEl()).to.not.eq(null);

    releaseDiscardPile('scene:1');
    await flushPromises();
    expect(w.find('.con-dpile').exists()).to.eq(false);
    expect(discardPileState.count, 'the count lives until the pile has fully closed').to.eq(1);
    w.findComponent({name: 'transition'}).vm.$emit('after-leave');
    expect(discardPileState.count, 'the episode is over').to.eq(0);

    openDiscardPile('scene:2');
    await flushPromises();
    expect(discardPileSlotEl()).to.not.eq(undefined);
    w.unmount();
    expect(discardPileSlotEl(), 'a pile that left the screen is no landing box').to.eq(undefined);
  });
});
