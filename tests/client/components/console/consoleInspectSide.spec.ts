/*
 * ConsoleInspectSide — the two-tab dossier of the card viewer's inspect mode. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its props (the tab bar's active tab, the ONE body — the rules
 * panel with the viewer's facts forwarded, or the statistics — and the closing class), and what the shell reaches on
 * it. The shell stands it in the surface registry (`:ref="surfaces.bind.zoomInspectSide"`) and its viewer pages the
 * dossier through that name — `surfaces.at('zoomInspectSide')?.scrollBody(dy)` (console/shell/viewerController.ts);
 * the ref of a `<script setup>` child carries only what it exposes, so the exposed list is asserted through a host's
 * ref, never through `wrapper.vm`. The two bodies and the glyph are stubbed by name (each is its own component's
 * subject). The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {ActionInspectHistory} from '@/client/components/actions/actionInspectHistory';
import {ConsoleZoomInspectTab} from '@/client/console/consoleCardZoom';
import ConsoleInspectSide from '@/client/components/console/ConsoleInspectSide.vue';

/** What the shell's viewer reads off the surface — the dossier's whole contract with it. */
type Side = {scrollBody(delta: number): boolean};

const RulesStub = defineComponent({
  name: 'ConsoleCardRulesPanel',
  props: {
    cardName: {type: String, required: true},
    nonce: {type: Number, default: 0},
    closing: {type: Boolean, default: false},
    embedded: {type: Boolean, default: false},
  },
  render() {
    return h('div', {'class': 'rules-stub'}, [h('div', {'class': 'con-scroll-area__viewport'})]);
  },
});

const HistoryStub = defineComponent({
  name: 'ConsoleCardHistoryPanel',
  props: {history: {type: Object as PropType<ActionInspectHistory>, required: true}},
  render() {
    return h('div', {'class': 'history-stub'}, [h('div', {'class': 'con-scroll-area__viewport'})]);
  },
});

const global = {
  ...globalConfig.global,
  stubs: {ConsoleCardRulesPanel: RulesStub, ConsoleCardHistoryPanel: HistoryStub, GamepadGlyph: true},
};

// The dossier hands the history on untouched — its shape is the statistics panel's subject.
const HISTORY = {card: {marker: 'the card block'}, action: {marker: 'the action block'}} as unknown as ActionInspectHistory;

function sideProps(tab: ConsoleZoomInspectTab = 'rules') {
  return {cardName: CardName.BIRDS, history: HISTORY, tab, nonce: 3};
}

/** The dossier the way the shell mounts it: under a host that holds a ref on it. */
function underViewer(tab: ConsoleZoomInspectTab = 'rules') {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleInspectSide, {ref: 'side', ...sideProps(tab)})]),
  });
  const wrapper = mount(Host, {global});
  return {
    wrapper,
    side: () => (wrapper.vm.$refs.side ?? undefined) as Side | undefined,
  };
}

/** Give a (stub) scroll viewport a box that overflows, and a scroll position the test can read back. */
function overflow(viewport: Element): {top: () => number} {
  let top = 0;
  Object.defineProperty(viewport, 'scrollHeight', {configurable: true, value: 500});
  Object.defineProperty(viewport, 'clientHeight', {configurable: true, value: 100});
  Object.defineProperty(viewport, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = value;
    },
  });
  return {top: () => top};
}

describe('ConsoleInspectSide — the inspect dossier of the card viewer', () => {
  it('the tab bar marks the ACTIVE tab and the body is that tab\'s ONE panel — the rules with the viewer\'s facts forwarded, or the statistics', async () => {
    const w = mount(ConsoleInspectSide, {global, props: sideProps()});
    // The template starts with its root: the wrapper IS the dossier.
    expect(w.classes()).to.include.members(['con-inspect-side', 'con-zoom-rules-host']);
    expect(w.classes()).to.not.include('con-zoom-rules-host--closing');

    const tabs = () => w.findAll('.con-inspect-side__tab');
    const active = () => tabs().map((t) => [t.classes().includes('con-inspect-side__tab--active'), t.attributes('aria-selected')]);
    expect(tabs().map((t) => t.findAll('span')[1].text())).to.deep.eq(['Rules', 'Statistics']);
    expect(active()).to.deep.eq([[true, 'true'], [false, 'false']]);

    const rules = w.findComponent(RulesStub);
    expect(rules.exists(), 'the rules body stands').to.eq(true);
    expect(rules.props()).to.deep.eq({cardName: CardName.BIRDS, nonce: 3, closing: false, embedded: true});
    expect(w.findComponent(HistoryStub).exists(), 'one body at a time').to.eq(false);

    await w.setProps({tab: 'history', closing: true});
    expect(active()).to.deep.eq([[false, 'false'], [true, 'true']]);
    expect(w.classes(), 'the close flight hides the dossier at once').to.include('con-zoom-rules-host--closing');
    expect(w.findComponent(RulesStub).exists()).to.eq(false);
    expect(w.findComponent(HistoryStub).props('history')).to.deep.eq(HISTORY);
  });

  it('the shell\'s ref sees `scrollBody` — and nothing else', () => {
    const {side} = underViewer();
    expect(side(), 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(side()!), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['scrollBody']);
    const leaked = ['content', 'reduced', 'cardName', 'history', 'tab', 'nonce', 'closing']
      .filter((key) => (side() as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('`scrollBody` pages the active body\'s overflowing viewport by the delta — and answers false while nothing overflows', () => {
    const {wrapper, side} = underViewer();
    // Nothing overflows (the stub's viewport has no box): the shell keeps swallowing the input.
    expect(side()!.scrollBody(40)).to.eq(false);

    const rules = overflow(wrapper.find('.rules-stub > .con-scroll-area__viewport').element);
    expect(side()!.scrollBody(40)).to.eq(true);
    expect(side()!.scrollBody(-15)).to.eq(true);
    expect(rules.top(), 'the deltas add up on the viewport').to.eq(25);

    // The other tab is another body: its own viewport is the one that pages.
    const other = underViewer('history');
    expect(other.side()!.scrollBody(40), 'a body with no overflow of its own').to.eq(false);
    const history = overflow(other.wrapper.find('.history-stub > .con-scroll-area__viewport').element);
    expect(other.side()!.scrollBody(60)).to.eq(true);
    expect([history.top(), rules.top()]).to.deep.eq([60, 25]);
  });
});
