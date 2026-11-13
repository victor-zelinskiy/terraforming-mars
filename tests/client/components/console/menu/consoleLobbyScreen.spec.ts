/*
 * ConsoleLobbyScreen — the pregame screen chassis «Мои партии» and «Мои кампании» stand on: the head (context ›
 * title, the slice tabs, the refresh status) and the stage — one of four honest states, or the grid of the host's
 * cards. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). Its hosts (`ConsoleMainMenu`,
 * `ConsoleCampaignsList`) hear `tab` and `grid`, and reach `ensureVisible` THROUGH A REF — so the exposed surface is
 * read here the way they read it, under an Options host with a string ref.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {showcaseGrid} from '@/client/console/menu/lobbyCardModel';
import ConsoleLobbyScreen from '@/client/components/console/menu/ConsoleLobbyScreen.vue';

// (Render functions, not template strings: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

/** The scroll area's stand-in: its slot, and a record of every element it was asked to keep in view. */
const kept: Array<Element | null> = [];
const ScrollStub = defineComponent({
  name: 'ConsoleScrollArea',
  props: {contentClass: String},
  methods: {
    ensureVisible(el: Element | null): void {
      kept.push(el);
    },
  },
  render() {
    return h('div', {class: 'scroll-stub'}, this.$slots.default?.());
  },
});

const TABS = [
  {id: 'active', label: 'Active', count: 2},
  {id: 'finished', label: 'Finished', count: undefined},
];

const globalOptions = {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub, ConsoleScrollArea: ScrollStub}};

function mountScreen(props: Record<string, unknown> = {}) {
  return mount(ConsoleLobbyScreen, {
    global: globalOptions,
    props: {kind: 'games', titleKey: 'My games', tabs: TABS, tab: 'active', ...props},
    slots: {
      default: () => h('article', {class: 'card-probe'}),
      band: () => h('div', {class: 'band-probe'}),
    },
  });
}

/** Give an element the box jsdom never lays out — the screen solves its grid from the MEASURED stage. */
function box(el: Element, width: number, height: number): void {
  Object.defineProperty(el, 'clientWidth', {configurable: true, value: width});
  Object.defineProperty(el, 'clientHeight', {configurable: true, value: height});
}

describe('ConsoleLobbyScreen — the pregame screen chassis', () => {
  beforeEach(() => {
    kept.length = 0;
  });

  it('the head: the kind on the root, the context › title crumb, one tab per slice with its count, the status', async () => {
    const wrapper = mountScreen();
    const root = wrapper.find('section.cm-screen.cm-lobby');
    expect(root.classes()).to.include('cm-lobby--games');
    expect(root.attributes('data-lobby-screen')).to.eq('games');
    expect(root.attributes('aria-label')).to.eq($t('My games'));
    expect(wrapper.find('.cm-screen__kicker').text()).to.eq($t('Main menu'));
    expect(wrapper.find('.cm-screen__title').text()).to.eq($t('My games'));

    const tabs = wrapper.findAll('button.cm-gametab');
    expect(tabs.map((tab) => tab.classes().includes('cm-gametab--on'))).to.deep.eq([true, false]);
    expect(tabs.map((tab) => tab.attributes('aria-selected'))).to.deep.eq(['true', 'false']);
    expect(tabs.map((tab) => tab.find('.cm-gametab__count').text()), 'a count not known yet is a dot, never a zero').to.deep.eq(['2', '·']);
    expect(tabs.map((tab) => tab.find('.cm-gametab__count').classes().includes('cm-gametab__count--pending'))).to.deep.eq([false, true]);

    expect(wrapper.find('.cm-screen__status').classes()).to.not.include('cm-screen__status--busy');
    await wrapper.setProps({refreshing: true, tab: 'finished', kind: 'campaigns'});
    expect(wrapper.find('.cm-screen__status').classes()).to.include('cm-screen__status--busy');
    expect(wrapper.findAll('button.cm-gametab').map((tab) => tab.classes().includes('cm-gametab--on'))).to.deep.eq([false, true]);
    expect(wrapper.find('section.cm-lobby').attributes('data-lobby-screen')).to.eq('campaigns');
  });

  it('the stage: the host\'s cards in the scroll area for `list`; each other state stands in their place, in its own words', async () => {
    const wrapper = mountScreen({items: 2});
    expect(wrapper.find('.cm-screen__stage > .band-probe').exists(), 'the band slot stands above the cards').to.eq(true);
    const scroll = wrapper.findComponent(ScrollStub);
    expect(scroll.props('contentClass')).to.eq('cm-lobby__grid');
    expect(scroll.classes()).to.include('cm-lobby__scroll');
    expect(scroll.attributes('data-lobby-cols'), 'a short list takes as many columns as it has cards').to.eq('2');
    expect(scroll.find('.card-probe').exists()).to.eq(true);
    expect(wrapper.find('.cm-lobby__state').exists()).to.eq(false);

    await wrapper.setProps({state: 'loading', stateKey: 'Loading your games'});
    expect(wrapper.findComponent(ScrollStub).exists(), 'a state replaces the grid').to.eq(false);
    const loading = wrapper.find('.cm-lobby__state');
    expect(loading.attributes('data-lobby-state')).to.eq('loading');
    expect(loading.classes()).to.include('cm-lobby__state--loading');
    expect(loading.find('.cm-lobby__spinner').exists()).to.eq(true);
    expect(loading.find('.cm-lobby__state-title').text()).to.eq($t('Loading your games') + '…');
    expect(loading.find('.cm-lobby__state-hint').exists(), 'no hint key — no hint line').to.eq(false);
    expect(wrapper.findAllComponents(GlyphStub).map((glyph) => glyph.props('control')), 'only the tabs\' stick').to.deep.eq(['stickL']);

    await wrapper.setProps({state: 'error', stateKey: 'Could not load the games', stateHintKey: 'Try again'});
    const error = wrapper.find('.cm-lobby__state');
    expect(error.find('.cm-lobby__spinner').exists()).to.eq(false);
    expect(error.find('.cm-lobby__state-glyph').text()).to.eq('!');
    expect(error.find('.cm-lobby__state-title').classes()).to.include('cm-gamelist__empty--error');
    expect(error.find('.cm-lobby__state-title').text()).to.eq($t('Could not load the games'));
    expect(error.find('.cm-lobby__state-hint').text()).to.eq($t('Try again'));
    expect(wrapper.findAllComponents(GlyphStub).map((glyph) => glyph.props('control')), 'the tabs\' stick, and the retry verb wearing its control').to.deep.eq(['stickL', 'triggerR']);

    await wrapper.setProps({state: 'empty', stateKey: 'You have no games yet', stateHintKey: ''});
    expect(wrapper.find('.cm-lobby__state-glyph').text()).to.eq('⧉');
    expect(wrapper.find('.cm-lobby__state-hint').exists()).to.eq(false);
  });

  it('emits `tab` for a pressed slice, and `grid` with the columns the cards TAKE — at once, then on every change', async () => {
    const wrapper = mountScreen({items: 5});
    expect(wrapper.emitted('grid'), 'the host has its row length before the first frame').to.deep.eq([[3]]);

    await wrapper.findAll('button.cm-gametab')[1].trigger('click');
    expect(wrapper.emitted('tab')).to.deep.eq([['finished']]);

    await wrapper.setProps({items: 1});
    expect(wrapper.emitted('grid'), 'one card — one column').to.deep.eq([[3], [1]]);
    await wrapper.setProps({items: 0});
    expect(wrapper.emitted('grid'), 'no cards — the solved grid\'s own columns').to.deep.eq([[3], [1], [3]]);
  });

  it('solves the grid from the MEASURED stage when the state changes, and hands it to the cards as tokens', async () => {
    const wrapper = mountScreen({items: 5});
    // jsdom lays nothing out: the stage is given a box, and a state with no scroll area measures the stage itself.
    // What it must solve is the pure model's answer for that box and the card's bounds in rem (24–34 wide, 12–21
    // tall, a 1.2 rem gap) — two columns in 1000 px at any rem jsdom may report.
    box(wrapper.find('.cm-screen__stage').element, 1000, 600);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 20;
    const solved = showcaseGrid(1000, 600, {gap: 1.2 * rem, minW: 24 * rem, maxW: 34 * rem, minH: 12 * rem, maxH: 21 * rem});
    expect(solved.cols, 'the probe box is a two-column one').to.eq(2);
    await wrapper.setProps({state: 'empty', stateKey: 'You have no games yet'});
    await nextTick();
    await nextTick();
    expect(wrapper.emitted('grid'), 'the host hears the new row length').to.deep.eq([[3], [2]]);

    await wrapper.setProps({state: 'list'});
    await nextTick();
    await nextTick();
    const scroll = wrapper.findComponent(ScrollStub);
    expect(scroll.attributes('data-lobby-cols')).to.eq('2');
    const style = (scroll.element as HTMLElement).style;
    expect(style.getPropertyValue('--cm-lobby-cols')).to.eq('2');
    expect(style.getPropertyValue('--cm-lobby-card-w')).to.eq(`${solved.cardW}px`);
    expect(style.getPropertyValue('--cm-lobby-row-h')).to.eq(`${solved.rowH}px`);
    expect(wrapper.emitted('grid'), 'a box that cannot be measured changes nothing').to.deep.eq([[3], [2]]);
  });

  it('a PARENT\'s ref sees `ensureVisible` and nothing else — and it is the scroll area\'s own follow', () => {
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleLobbyScreen, {ref: 'screen', kind: 'games', titleKey: 'My games', tabs: TABS, tab: 'active'}, {
        default: () => h('article', {class: 'card-probe'}),
      })]),
    });
    const wrapper = mount(Host, {global: globalOptions});
    // Exactly the hosts' read: `(this.$refs.screen ?? undefined) as {ensureVisible?: (el: Element | null) => void} | undefined`.
    const screen = (wrapper.vm.$refs.screen ?? undefined) as {ensureVisible(el: Element | null): void} | undefined;
    if (screen === undefined) {
      throw new Error('the host holds no ref to the screen');
    }
    expect(Object.keys(screen), 'exactly what the screen exposes').to.deep.eq(['ensureVisible']);
    const leaked = ['grid', 'cols', 'gridStyle', 'stateGlyph', 'measure']
      .filter((key) => (screen as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);

    const card = wrapper.find('.card-probe').element;
    screen.ensureVisible(card);
    screen.ensureVisible(null);
    expect(kept, 'the scroll area was handed the cursor\'s card, and a miss as it came').to.deep.eq([card, null]);
  });
});
