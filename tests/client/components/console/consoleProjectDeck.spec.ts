import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleProjectDeck from '@/client/components/console/ConsoleProjectDeck.vue';
import {
  DECK_LOW_THRESHOLD, DECK_TIER_LAYERS, deckStackTier,
  displayedDeckSize, holdDeckDisplay, isDeckDisplayHeld, releaseDeckDisplay,
} from '@/client/console/consoleDeckDisplay';

/**
 * The top-HUD project draw pile. The COUNT is the server-authoritative
 * GameModel.deckSize (drawPile.length) — the widget only presents it; the
 * hold seam exists for the future hero draw animation.
 */
describe('consoleDeckDisplay (pure model)', () => {
  afterEach(() => {
    releaseDeckDisplay();
  });

  it('tiers the physical stack by the remaining count', () => {
    expect(deckStackTier(0)).to.eq('empty');
    expect(deckStackTier(-1)).to.eq('empty');
    expect(deckStackTier(1)).to.eq('thin');
    expect(deckStackTier(DECK_LOW_THRESHOLD)).to.eq('thin');
    expect(deckStackTier(DECK_LOW_THRESHOLD + 1)).to.eq('half');
    expect(deckStackTier(60)).to.eq('half');
    expect(deckStackTier(61)).to.eq('full');
    expect(deckStackTier(180)).to.eq('full');
  });

  it('an EMPTY deck renders zero side layers, a FULL one three', () => {
    expect(DECK_TIER_LAYERS[deckStackTier(0)]).to.eq(0);
    expect(DECK_TIER_LAYERS[deckStackTier(200)]).to.eq(3);
  });

  it('the hold seam freezes the displayed value until released', () => {
    expect(displayedDeckSize(120)).to.eq(120);
    expect(isDeckDisplayHeld()).to.eq(false);
    holdDeckDisplay(120);
    expect(isDeckDisplayHeld()).to.eq(true);
    // The authoritative value already committed to 117 — the display holds.
    expect(displayedDeckSize(117)).to.eq(120);
    releaseDeckDisplay();
    expect(isDeckDisplayHeld()).to.eq(false);
    expect(displayedDeckSize(117)).to.eq(117);
  });
});

describe('ConsoleProjectDeck', () => {
  afterEach(() => {
    releaseDeckDisplay();
  });

  it('renders the authoritative count with the full physical stack', () => {
    const wrapper = mount(ConsoleProjectDeck, {props: {deckSize: 142}});
    expect(wrapper.text()).to.contain('142');
    expect(wrapper.classes()).to.contain('con-deckstack--full');
    expect(wrapper.findAll('.con-deckstack__layer')).to.have.length(3);
    expect(wrapper.find('.con-deckstack__top').exists()).to.eq(true);
    wrapper.unmount();
  });

  it('a LOW deck warms the count and thins the pile', () => {
    const wrapper = mount(ConsoleProjectDeck, {props: {deckSize: 4}});
    expect(wrapper.classes()).to.contain('con-deckstack--low');
    expect(wrapper.classes()).to.contain('con-deckstack--thin');
    expect(wrapper.findAll('.con-deckstack__layer')).to.have.length(1);
    wrapper.unmount();
  });

  it('an EMPTY deck stays in layout — top slot rendered, zero side layers', () => {
    const wrapper = mount(ConsoleProjectDeck, {props: {deckSize: 0}});
    expect(wrapper.classes()).to.contain('con-deckstack--empty');
    expect(wrapper.findAll('.con-deckstack__layer')).to.have.length(0);
    expect(wrapper.find('.con-deckstack__top').exists()).to.eq(true);
    expect(wrapper.text()).to.contain('0');
    wrapper.unmount();
  });

  it('the count follows the server value (decrease AND increase — undo / reshuffle)', async () => {
    const wrapper = mount(ConsoleProjectDeck, {props: {deckSize: 30}});
    await wrapper.setProps({deckSize: 27});
    expect(wrapper.text()).to.contain('27');
    await wrapper.setProps({deckSize: 41}); // discard reshuffled into a new draw pile
    expect(wrapper.text()).to.contain('41');
    wrapper.unmount();
  });

  it('an engaged hold keeps the pre-draw count on screen until released', async () => {
    const wrapper = mount(ConsoleProjectDeck, {props: {deckSize: 50}});
    holdDeckDisplay(50);
    await wrapper.setProps({deckSize: 47});
    expect(wrapper.text()).to.contain('50');
    releaseDeckDisplay();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).to.contain('47');
    wrapper.unmount();
  });

  it('is informational: no focusable control, aria names the deck', () => {
    const wrapper = mount(ConsoleProjectDeck, {props: {deckSize: 12}});
    expect(wrapper.find('button').exists()).to.eq(false);
    expect(wrapper.attributes('role')).to.eq('img');
    expect(wrapper.attributes('aria-label')).to.contain('12');
    wrapper.unmount();
  });
});
