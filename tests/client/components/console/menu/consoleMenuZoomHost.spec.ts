/*
 * ConsoleMenuZoomHost — the App-level host of the fullscreen card viewer OUTSIDE a game (main menu, create game, the
 * campaign map). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md) with no props, no emits and
 * nothing exposed: ONE module state opens it (`consoleCardZoom` — a screen calls `openConsoleCardZoom(…)`), and the
 * pad reaches it through the bridge `installMenuPad` consults before any screen (`menuZoomIntent`) — so the spec
 * drives it the way the app does, through the module and the bridge, never through its instance.
 *
 * The select bridge end to end (a picker's X → the host's A) is `ConsoleDevCardPicker.spec.ts`; here the host's own
 * edges: who serves the module, who owns the pad, and that no ending leaves the module / the body class behind.
 * (jsdom has no landing geometry, so the open is the vanilla one — `show()` with no proxy flight; the flight is the
 * e2e's.)
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, ref} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {closeConsoleCardZoom, consoleCardZoom, openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {consoleState} from '@/client/console/consoleRouter';
import {menuZoomIntent} from '@/client/console/menu/consoleMenuZoomBridge';
import ConsoleMenuZoomHost from '@/client/components/console/menu/ConsoleMenuZoomHost.vue';

const CARDS = [{name: CardName.ALGAE} as CardModel, {name: CardName.BUSHES} as CardModel];

const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};

// (Render functions, not template strings: the runtime compiler is not in this build.)
/** The viewer's stand-in: its props, its two emits, its slots — and a record of what the host asked of it. */
const asked: Array<string> = [];
const ZoomStub = defineComponent({
  name: 'CardZoomModal',
  props: {
    card: {type: Object, required: true}, cards: Array, index: Number, selected: Boolean, dismissable: Boolean, closing: Boolean,
    navCounter: Boolean, consoleMotion: Boolean, annotationsSuppressed: Boolean, flankMotion: Boolean, lore: Boolean,
  },
  emits: ['navigate', 'close'],
  // Exposes what the real viewer does: its members and its ROOT by the one name the host reads it by (`rootEl` — a
  // Vapor child's ref answers no `$el`, components/rootEl.ts); the host opens only once it finds that element.
  setup(_, {emit, expose, slots}) {
    const root = ref<HTMLElement | null>(null);
    expose({
      // jsdom: no landing geometry → the host opens vanilla (`show()`, no proxy flight).
      measureLanding: async (): Promise<undefined> => undefined,
      show: (): void => {
        asked.push('show');
      },
      prev: (): void => {
        asked.push('prev');
      },
      next: (): void => {
        asked.push('next');
      },
      close: (): void => {
        asked.push('close');
        emit('close');
      },
      rootEl: root,
    });
    return () => h('div', {ref: root, class: 'zoom-stub'}, [slots.side?.({nonce: 1, closing: false}), slots.actions?.()]);
  },
});

/** The rules column's stand-in: a record of every scroll it was handed. */
const scrolled: Array<number> = [];
const RulesStub = defineComponent({
  name: 'ConsoleCardRulesPanel',
  props: {cardName: String, nonce: Number, closing: Boolean},
  methods: {
    scrollBody(dy: number): boolean {
      scrolled.push(dy);
      return true;
    },
  },
  render: () => h('aside', {class: 'rules-stub'}),
});

const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

function mountUnderHost() {
  const Host = defineComponent({render: () => h('div', {class: 'host'}, [h(ConsoleMenuZoomHost, {ref: 'zoomHost'})])});
  // `globalConfig` promotes every Vue warning to a failure: «mounts without a warning» is part of each test.
  return mount(Host, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {CardZoomModal: ZoomStub, CardZoomCard: true, ConsoleCardRulesPanel: RulesStub, GamepadGlyph: GlyphStub}},
  });
}

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

const bodyOwned = (): boolean => document.body.classList.contains('con-zoom-open');

describe('ConsoleMenuZoomHost — the fullscreen viewer\'s host outside a game', () => {
  let shellMountedBefore = false;

  beforeEach(() => {
    // Module state is bundle-shared.
    closeConsoleCardZoom();
    shellMountedBefore = consoleState.shellMounted;
    consoleState.shellMounted = false;
    document.body.classList.remove('con-zoom-open');
    asked.length = 0;
    scrolled.length = 0;
  });

  afterEach(() => {
    closeConsoleCardZoom();
    consoleState.shellMounted = shellMountedBefore;
    document.body.classList.remove('con-zoom-open');
  });

  it('exposes nothing; idle it is an empty host that takes no intent; IN A GAME it is nothing at all — the shell\'s host serves the module', async () => {
    const wrapper = mountUnderHost();
    expect(Object.keys(wrapper.vm.$refs.zoomHost as object), 'no parent stands a ref on it').to.deep.eq([]);
    const host = wrapper.find('.con-menu-zoom-host');
    expect(host.exists()).to.eq(true);
    expect(
      [host.find('.con-zoom-veil').exists(), host.find('.con-zoom-flight-layer').exists(), wrapper.findComponent(ZoomStub).exists()],
      'no veil, no proxy, no viewer while nothing is inspected',
    ).to.deep.eq([false, false, false]);
    expect(menuZoomIntent(B), 'nothing open — the screen\'s own handler runs').to.eq(false);

    consoleState.shellMounted = true;
    await nextTick();
    expect(wrapper.find('.con-menu-zoom-host').exists()).to.eq(false);
    openConsoleCardZoom(CARDS, 0);
    await settle();
    expect(wrapper.findComponent(ZoomStub).exists(), 'the open is not this host\'s to serve').to.eq(false);
    expect(asked).to.deep.eq([]);
    expect(bodyOwned()).to.eq(false);
    expect(menuZoomIntent(A), 'nor is the pad').to.eq(false);
    expect(consoleCardZoom.card?.name, 'the module is left to the shell').to.eq(CardName.ALGAE);
  });

  it('a screen opens the MODULE and the host serves it: the viewer with the console chrome, the pad through the bridge, B closes it', async () => {
    const wrapper = mountUnderHost();
    openConsoleCardZoom(CARDS, 0, undefined, undefined, {contextLabel: 'Guaranteed cards'});
    await settle();

    const zoom = wrapper.findComponent(ZoomStub);
    expect(zoom.exists()).to.eq(true);
    expect(zoom.classes()).to.include('con-zoom');
    expect(zoom.props('card')).to.deep.eq(CARDS[0]);
    expect(zoom.props('cards'), 'a list of several is browsable').to.have.length(2);
    expect(zoom.props('dismissable')).to.eq(true);
    expect(zoom.props('consoleMotion')).to.eq(true);
    expect(zoom.props('lore')).to.eq(true);
    expect(asked, 'no landing to fly to — the dialog is shown at once').to.deep.eq(['show']);
    expect(bodyOwned(), 'the body knows a viewer is up').to.eq(true);
    expect(wrapper.find('.con-zoom-veil').exists()).to.eq(true);
    expect(wrapper.find('.con-zoom__context').text()).to.contain('Guaranteed cards');
    expect(wrapper.find('.con-zoom__btn--select').exists(), 'no select bridge attached — no select verb').to.eq(false);
    expect(wrapper.find('.con-zoom__cmd--flip').exists(), 'the browse hint of a list').to.eq(true);

    // The viewer owns the pad completely while it is open.
    expect(menuZoomIntent(nav('right'))).to.eq(true);
    expect(menuZoomIntent(nav('left'))).to.eq(true);
    expect(menuZoomIntent({kind: 'press', button: 'bumperR'})).to.eq(true);
    expect(asked).to.deep.eq(['show', 'next', 'prev', 'next']);
    expect(menuZoomIntent(nav('down'))).to.eq(true);
    expect(menuZoomIntent(nav('up'))).to.eq(true);
    expect(scrolled.map(Math.sign), '↑ / ↓ read the rules column').to.deep.eq([1, -1]);
    expect(menuZoomIntent(A), 'A with nothing to select is swallowed, never the screen\'s').to.eq(true);
    expect(consoleCardZoom.card?.name).to.eq(CardName.ALGAE);

    // The viewer's own navigation re-points the module.
    zoom.vm.$emit('navigate', CARDS[1], 1);
    await nextTick();
    expect(consoleCardZoom.card?.name).to.eq(CardName.BUSHES);
    expect(consoleCardZoom.index).to.eq(1);

    expect(menuZoomIntent(B)).to.eq(true);
    await settle();
    expect(asked[asked.length - 1], 'the dialog is closed after the card went back').to.eq('close');
    expect(consoleCardZoom.card, 'the module is cleared').to.eq(undefined);
    expect(bodyOwned()).to.eq(false);
    expect(wrapper.findComponent(ZoomStub).exists()).to.eq(false);
    expect(menuZoomIntent(B), 'and the pad is the screen\'s again').to.eq(false);
  });

  it('a MANDATORY viewer takes B and stays', async () => {
    const wrapper = mountUnderHost();
    openConsoleCardZoom([CARDS[0]], 0, undefined, undefined, {mandatory: true});
    await settle();
    expect(wrapper.findComponent(ZoomStub).props('dismissable')).to.eq(false);
    expect(wrapper.findComponent(ZoomStub).props('cards'), 'one card is not a list').to.eq(undefined);
    expect(wrapper.find('.con-zoom__cmd--flip').exists()).to.eq(false);
    expect(menuZoomIntent(B)).to.eq(true);
    await settle();
    expect(consoleCardZoom.card?.name).to.eq(CardName.ALGAE);
    expect(asked).to.deep.eq(['show']);
  });

  it('no ending strands it: an opener that clears the module itself is unwound, and a host that leaves mid-fullscreen clears the module', async () => {
    const wrapper = mountUnderHost();
    openConsoleCardZoom(CARDS, 0);
    await settle();
    expect(bodyOwned()).to.eq(true);

    closeConsoleCardZoom();
    await settle();
    expect(bodyOwned(), 'the external clear gave the body back').to.eq(false);
    expect(wrapper.findComponent(ZoomStub).exists()).to.eq(false);
    expect(wrapper.find('.con-zoom-flight-layer').exists()).to.eq(false);

    openConsoleCardZoom(CARDS, 1);
    await settle();
    expect(bodyOwned()).to.eq(true);
    expect(consoleCardZoom.card?.name).to.eq(CardName.BUSHES);
    wrapper.unmount();
    expect(consoleCardZoom.card, 'a screen switch never leaves the module open').to.eq(undefined);
    expect(bodyOwned()).to.eq(false);
    expect(menuZoomIntent(B), 'the bridge lost its handler with the host').to.eq(false);
  });
});
