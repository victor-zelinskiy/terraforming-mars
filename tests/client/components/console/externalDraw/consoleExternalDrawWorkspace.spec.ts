/*
 * ConsoleExternalDrawWorkspace — «ДОБОР КАРТ», the mandatory take of cards an EXTERNAL effect drew for the viewer. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): that it mounts in an honest state without a
 * warning (the deal, then the cursor), what it renders standalone and as a step of another workspace (`embedded`
 * strips the shell chrome — the head, the cause plate, the `con-ws` marker and the motion id), the command contract
 * it publishes to the shell's one bar, what the shell's pad router reaches through the surface registry —
 * `handleIntent`, and nothing else — and the surface's own behaviours a conversion could break:
 *  - the take: ONE answer per press, the pad absorbed while it flies, the row re-seated on the server's answer;
 *  - a REFUSED take (the same question still standing past the grace) gives the cards back;
 *  - THE SURFACE LEFT WITH ITS QUESTION: an unmount releases the wait at once — the take's watcher is created by the
 *    take itself, after setup, so nothing but the surface's own release ends it (R6 · R9);
 *  - X / L3: the viewer's physical origin resolves through the surface's ROOT ref (R12) and answers «no element» once
 *    the surface is gone.
 * Mounted the way the shell mounts it: under a host that holds a ref. The card face, the head, the source dock (one of
 * the three lazy bindings — keyed `VaporAsyncComponentWrapper`) and the availability line are stubbed. The unit runner
 * renders the English keys.
 *
 * (The flow's MODULE — `consoleExternalDraw.ts` — is plain state; the take's flights are its e2e's:
 * `console-external-draw`, the Parliament's climate specs.)
 */
import {expect} from 'chai';
import {flushPromises, mount, VueWrapper} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowReactive} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GamepadIntent, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {closeConsoleCardZoom, consoleCardZoom} from '@/client/console/consoleCardZoom';
import {clearPanelCommands, consolePanelUi} from '@/client/console/consolePanelUi';
import {clearDeckPickFlight, deckPickFlightState} from '@/client/console/deckPick/consoleDeckPick';
import {externalDrawHolding, externalDrawState, resetExternalDraw} from '@/client/console/externalDraw/consoleExternalDraw';
import {activeInputAbsorbers} from '@/client/console/inputAbsorb';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import ConsoleExternalDrawWorkspace from '@/client/components/console/externalDraw/ConsoleExternalDrawWorkspace.vue';

/** What the pad router reads through the registry — the surface's whole contract with the shell. */
type ExternalDrawReach = {handleIntent(intent: GamepadIntent): void};

const ABSORBER = 'external-draw-beat';

// (Render functions, not template strings: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'Card',
  props: {card: {type: Object, required: true}, lightweight: Boolean},
  render() {
    return h('i', {'class': 'card-stub pcard', 'data-name': (this.card as {name: string}).name});
  },
});

const WsHeadStub = defineComponent({
  name: 'ConsoleWsHead',
  props: {
    root: {type: String, default: ''},
    emblem: {type: String, default: ''},
    subject: {type: String, default: ''},
    stage: {type: String, default: ''},
    committed: Boolean,
  },
  render() {
    return h('header', {'class': 'wshead-stub'});
  },
});

const DockStub = defineComponent({
  name: 'VaporAsyncComponentWrapper',
  props: {view: {type: Object, default: undefined}, compact: Boolean},
  render() {
    return h('i', {'class': 'dock-stub'});
  },
});

const STUBS = {
  Card: CardStub,
  ConsoleWsHead: WsHeadStub,
  VaporAsyncComponentWrapper: DockStub,
  ConsoleCardAvailabilityPanel: true,
};

const A = CardName.ALGAE;
const B = CardName.ANTS;
const C = CardName.BIRDS;

/** The viewer's own Solar Logistics answered a rival's space event. */
const CARD_CAUSE = {kind: 'card', effectCard: CardName.SOLAR_LOGISTICS, effectCardOwner: 'you', initiator: 'red', triggerCard: CardName.ASTEROID};
/** An enacted resolution pays the cards (Turmoil Redux) — nobody «did» it to the viewer. */
const RESOLUTION_CAUSE = {kind: 'resolution', resolution: 'climateResearch'};

/** «Take these» — the server's ask, carried by its `externalDrawPrompt` marker (`total` granted, `names` still owed). */
function take(names: ReadonlyArray<CardName>, total: number, cause: unknown = CARD_CAUSE): unknown {
  return {
    type: 'card',
    title: 'Take the cards',
    buttonLabel: 'Take',
    cards: names.map((name) => ({name})),
    externalDrawPrompt: {intakeId: 7, count: total, remaining: names.length, cause},
  };
}

/** The viewer's game with `waitingFor` standing (or with no prompt at all — the server moved on). */
function viewOf(waitingFor: unknown): PlayerViewModel {
  return {
    id: 'p-viewer',
    waitingFor,
    players: [{color: 'blue', name: 'Viewer'}, {color: 'red', name: 'Rival'}],
    thisPlayer: {color: 'blue', tableau: [{name: CardName.SOLAR_LOGISTICS}]},
  } as unknown as PlayerViewModel;
}

const press = (button: SemanticButton): GamepadIntent => ({kind: 'press', button});
const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

/** Runs `act` and returns what it said through `console.warn` (the wait graph's ceiling line) — never printed over the run. */
async function saidDuring(act: () => Promise<void>): Promise<Array<string>> {
  const said: Array<string> = [];
  const warn = console.warn;
  console.warn = (...args: Array<unknown>) => {
    said.push(args.map(String).join(' '));
  };
  try {
    await act();
  } finally {
    console.warn = warn;
  }
  return said;
}

describe('ConsoleExternalDrawWorkspace — the mandatory take of an external draw', () => {
  let clock: ManualFlowClock;
  let mounted: Array<VueWrapper> = [];

  beforeEach(() => {
    resetExternalDraw();
    // The row's fit retries and the refusal's grace wait on the kernel's clock: the spec moves it, never sleeps.
    clock = createManualClock();
    setFlowClock(clock);
  });

  afterEach(async () => {
    for (const wrapper of mounted) {
      wrapper.unmount();
    }
    mounted = [];
    // What a test left standing runs out here, then the bundle-shared module state is put back.
    await flushPromises();
    clock.advance(60_000);
    await flushPromises();
    resetExternalDraw();
    clearDeckPickFlight();
    clearPanelCommands('externalDraw');
    closeConsoleCardZoom();
    setFlowClock(undefined);
  });

  function mountUnderHost(playerView: PlayerViewModel, embedded = false) {
    const props = shallowReactive<{playerView: PlayerViewModel, embedded: boolean, shown: boolean}>({playerView, embedded, shown: true});
    const Host = defineComponent({
      render: () => h('div', props.shown ?
        [h(ConsoleExternalDrawWorkspace, {ref: 'extDrawWs', playerView: props.playerView, embedded: props.embedded})] :
        []),
    });
    const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: STUBS}});
    mounted.push(wrapper);
    const slots = () => wrapper.findAll('.con-extdraw__slot');
    return {
      wrapper,
      props,
      surface: () => wrapper.findComponent(ConsoleExternalDrawWorkspace),
      reach: () => (wrapper.vm.$refs.extDrawWs ?? undefined) as ExternalDrawReach | undefined,
      root: () => wrapper.find('.con-extdraw'),
      slots,
      names: () => slots().map((slot) => slot.attributes('data-extdraw-slot')),
      focused: () => slots().findIndex((slot) => slot.classes().includes('con-cards__slot--focused')),
      progress: () => wrapper.find('.con-extdraw__status .con-cards__verdict').text(),
      head: () => wrapper.findComponent(WsHeadStub),
    };
  }

  /** A surface standing with its batch dealt (no flight layer stands in a unit mount: the cards are handed over at
   *  once) and the cursor open. */
  async function standing(playerView: PlayerViewModel, embedded = false) {
    const stand = mountUnderHost(playerView, embedded);
    await flushPromises();
    expect(externalDrawState.phase, 'the cursor is open').to.eq('ready');
    return stand;
  }

  it('mounts without a warning: the root first, the cause and the batch under the deal — then the handoff opens the cursor and the bar', async () => {
    const {wrapper, root, slots, names, focused, progress, head} = mountUnderHost(viewOf(take([A, B, C], 3)));
    expect(root().element, 'the template starts with its root — no comment node before it').to.eq((wrapper.element as Element).childNodes[0]);
    expect(root().classes()).to.include.members(['con-extdraw', 'con-ws']);
    expect(root().classes()).to.not.include('con-extdraw--embedded');
    expect(root().attributes('data-motion-surface')).to.eq('external-draw');
    expect(root().attributes('aria-label')).to.eq('Your Solar Logistics effect: take 3 card(s)');

    // THE CAUSE — who set it off, by which card, and the effect's own promise; the source seat holds the effect card.
    expect(wrapper.find('.con-extdraw__actor').text()).to.eq('Rival');
    expect(wrapper.find('.con-extdraw__actor').classes()).to.include('player_color_red');
    expect(wrapper.find('.con-extdraw__cause-text').text()).to.eq('played Asteroid');
    expect(wrapper.find('.con-extdraw__cause-line--effect').text()).to.eq('Your Solar Logistics effect: take 3 card(s)');
    expect(wrapper.findComponent(DockStub).props()).to.deep.eq({
      view: {card: CardName.SOLAR_LOGISTICS, kindKey: 'Your card', inspectable: true}, compact: true,
    });

    // THE DEAL: the faces are named to the app-level layer, every real slot is held under its proxy, the pad is shut.
    expect(root().attributes('data-flow')).to.eq('dealing');
    expect(deckPickFlightState.cards).to.deep.eq([A, B, C]);
    expect(names()).to.deep.eq([A, B, C]);
    expect(slots().map((slot) => slot.attributes('data-zoom-slot'))).to.deep.eq([A, B, C]);
    expect(slots().map((slot) => slot.classes().includes('con-deal-hold'))).to.deep.eq([true, true, true]);
    expect(wrapper.findAllComponents(CardStub).map((card) => card.attributes('data-name'))).to.deep.eq([A, B, C]);
    expect(head().props()).to.deep.eq({root: 'Card draw', emblem: 'cards', subject: CardName.SOLAR_LOGISTICS, stage: 'Drawing cards…', committed: true});
    expect(progress()).to.eq('Cards from the deck: 3');
    expect(focused(), 'no ring while the cards arrive').to.eq(-1);
    expect(consolePanelUi.owner).to.eq('externalDraw');
    expect(consolePanelUi.commands, 'a beat in flight advertises no verb').to.deep.eq([]);
    expect(activeInputAbsorbers(), 'the beat\'s gate is on the input-absorb ledger').to.include(ABSORBER);

    await flushPromises();
    expect(root().attributes('data-flow')).to.eq('ready');
    expect(deckPickFlightState.cards, 'the flight layer is let go').to.deep.eq([]);
    expect(slots().map((slot) => slot.classes().includes('con-deal-hold'))).to.deep.eq([false, false, false]);
    expect(focused()).to.eq(0);
    expect(wrapper.find('.con-cards__strip').classes()).to.include('con-cards__strip--has-focus');
    expect(wrapper.find('.con-extdraw__status').classes()).to.not.include('con-cards__verdictbar--held');
    expect(wrapper.find('.con-cards__verdict-name').text(), 'the rail reads the card under the cursor').to.eq(A);
    expect(wrapper.find('.con-extdraw__status-cause').exists(), 'the standalone surface states its cause in its own block').to.eq(false);
    expect(progress()).to.eq('Take 3 cards');
    expect(head().props('stage')).to.eq('Intake');
    expect(consolePanelUi.commands.map((c) => [c.control, c.label])).to.deep.eq([
      ['dpad', 'Navigate'], ['confirm', 'Collect the card'], ['secondary', 'Inspect'], ['stickL', 'Source'], ['back', 'Collect all'],
    ]);
    expect(activeInputAbsorbers()).to.not.include(ABSORBER);
  });

  it('EMBEDDED, the shell chrome goes: no head, no cause plate, no `con-ws` marker, no motion id — the promise folds into the status rail', async () => {
    const {wrapper, root, head, progress} = await standing(viewOf(take([A, B], 2, RESOLUTION_CAUSE)), true);

    expect(root().classes()).to.include('con-extdraw--embedded');
    expect(root().classes(), 'the host carries the workspace marker').to.not.include('con-ws');
    expect(root().attributes('data-motion-surface'), 'an embedded step never claims the shared shade').to.eq(undefined);
    expect(head().exists(), 'the host\'s header carries the crumb').to.eq(false);
    expect(wrapper.find('.con-extdraw__cause').exists()).to.eq(false);
    expect(wrapper.find('.con-extdraw__status-cause').text()).to.eq('The enacted resolution draws 2 card(s) for you');
    expect(progress()).to.eq('Take 2 cards');
    // A resolution with no source marker on the prompt has nothing to inspect — the bar offers no «Source».
    expect(wrapper.findComponent(DockStub).props('view')).to.deep.eq({card: undefined, kindKey: 'Card', inspectable: false});
    expect(consolePanelUi.commands.map((c) => c.label)).to.deep.eq(['Navigate', 'Collect the card', 'Inspect', 'Collect all']);
  });

  it('the surface registry reaches `handleIntent` and nothing else; A takes ONE card per press, the pad is absorbed while it flies, and the answer re-seats the row', async () => {
    const {reach, surface, props, root, names, focused, progress} = await standing(viewOf(take([A, B, C], 3)));
    expect(Object.keys(reach() as object), 'defineExpose is the sheet\'s MUST EXPOSE list').to.deep.eq(['handleIntent']);

    // The d-pad walks the row (no layout in the unit box — the grid fallback, one row).
    reach()!.handleIntent(nav('right'));
    await nextTick();
    expect(focused()).to.eq(1);
    reach()!.handleIntent(nav('left'));
    await nextTick();
    expect(focused()).to.eq(0);

    // A — the focused card: the answer goes out and the hold is up in the same stretch.
    reach()!.handleIntent(press('confirm'));
    expect(surface().emitted('submit')).to.deep.eq([[{type: 'card', cards: [A]}]]);
    expect(externalDrawState.phase, 'synchronous with the submit').to.eq('sending');
    expect(externalDrawHolding(), 'the shell keeps the frame').to.eq(true);
    await nextTick();
    expect(root().attributes('data-flow')).to.eq('sending');
    expect(progress()).to.eq('Taking the card…');
    expect(consolePanelUi.commands, 'a beat in flight advertises no verb').to.deep.eq([]);
    expect(activeInputAbsorbers()).to.include(ABSORBER);

    // A held button, a double press, «take all»: absorbed BY PHASE — no second answer.
    reach()!.handleIntent(press('confirm'));
    reach()!.handleIntent(press('back'));
    expect(surface().emitted('submit')).to.have.length(1);

    // The server re-issues the remainder: the submission is re-armed, the taken seat leaves (no dock stands in a unit
    // mount — the card has «landed» at once), the cursor follows the next card.
    props.playerView = viewOf(take([B, C], 3));
    await flushPromises();
    expect(externalDrawState.phase).to.eq('ready');
    expect(externalDrawHolding()).to.eq(false);
    expect(names()).to.deep.eq([B, C]);
    expect(focused()).to.eq(0);
    expect(progress()).to.eq('Taken: 1 of 3');

    // B — everything still owed, in batch order.
    reach()!.handleIntent(press('back'));
    expect(surface().emitted('submit')?.[1]).to.deep.eq([{type: 'card', cards: [B, C]}]);

    // The LAST take ends the prompt: the surface keeps its last frame for the shell to fold, the hold drops.
    props.playerView = viewOf(undefined);
    await flushPromises();
    expect(externalDrawHolding(), 'the shell may fold the workspace').to.eq(false);
    const said = await saidDuring(async () => {
      clock.advance(5_000);
      await flushPromises();
    });
    expect(said, 'no grace is left standing').to.deep.eq([]);
  });

  it('a REFUSED take gives the cards back: the same question still standing after the grace rolls the take back', async () => {
    const {reach, surface, root, names, focused} = await standing(viewOf(take([A, B], 2)));
    reach()!.handleIntent(press('confirm'));
    expect(surface().emitted('submit')).to.have.length(1);
    await flushPromises();
    expect(externalDrawHolding(), 'the take waits for the server alone').to.eq(true);
    expect(externalDrawState.taken).to.deep.eq([A]);

    // The grace's end is SAID (the wait graph's ceiling line).
    const said = await saidDuring(async () => {
      clock.advance(5_000);
      await flushPromises();
    });
    expect(said.filter((line) => line.includes('[wait-graph] ceiling external-draw:prompt-moved')), 'the wait ended on its ceiling, once').to.have.length(1);
    expect(externalDrawState.phase).to.eq('ready');
    expect(externalDrawHolding()).to.eq(false);
    expect(externalDrawState.taken, 'the card is back in play').to.deep.eq([]);
    expect(root().attributes('data-flow')).to.eq('ready');
    expect(names()).to.deep.eq([A, B]);
    expect(focused()).to.eq(0);
    expect(consolePanelUi.commands.map((c) => c.label), 'the verbs are back').to.deep.eq(['Navigate', 'Collect the card', 'Inspect', 'Source', 'Collect all']);

    // …and the submission is re-armed: the same press answers again.
    reach()!.handleIntent(press('confirm'));
    expect(surface().emitted('submit')).to.have.length(2);
  });

  it('THE SURFACE LEFT WITH ITS QUESTION: an unmount releases the take\'s wait at once — no grace, no refusal — and takes its registrations back', async () => {
    const {reach, surface, props, wrapper} = await standing(viewOf(take([A], 1)));
    const emitted = surface();
    reach()!.handleIntent(press('confirm'));
    await flushPromises();
    expect(emitted.emitted('submit')).to.deep.eq([[{type: 'card', cards: [A]}]]);
    expect(externalDrawHolding(), 'the take waits for the prompt to move').to.eq(true);

    // The shell folds the surface before any view reaches it (the last take answered).
    props.shown = false;
    const said = await saidDuring(async () => {
      await flushPromises();
      expect(wrapper.find('.con-extdraw').exists()).to.eq(false);
      expect(externalDrawHolding(), 'released by the unmount itself — never by the 1.5 s grace').to.eq(false);
      expect(externalDrawState.taken, 'a landed take, not a refusal').to.deep.eq([A]);
      clock.advance(5_000);
      await flushPromises();
    });
    expect(said, 'the grace was taken back with the surface — nothing is said').to.deep.eq([]);
    expect(externalDrawHolding()).to.eq(false);
    expect(consolePanelUi.owner, 'the bar\'s contract is taken back').to.eq(undefined);
    expect(activeInputAbsorbers(), 'the beat\'s gate is taken back').to.not.include(ABSORBER);
    expect(deckPickFlightState.cards).to.deep.eq([]);
  });

  it('a remount over the SAME intake adopts the standing cards — never dealt twice', async () => {
    const view = viewOf(take([A, B], 2));
    const first = await standing(view);
    first.wrapper.unmount();

    const again = mountUnderHost(view);
    expect(again.root().attributes('data-flow'), 'a settled row — no second deal').to.eq('ready');
    expect(deckPickFlightState.cards, 'no face is named to the flight layer').to.deep.eq([]);
    expect(again.slots().map((slot) => slot.classes().includes('con-deal-hold'))).to.deep.eq([false, false]);
    expect(again.focused()).to.eq(0);
    expect(again.surface().emitted('submit'), 'nothing was answered for the player').to.eq(undefined);
  });

  it('X opens the cards still owed with a PHYSICAL origin resolved through the surface\'s root; L3 opens the source card', async () => {
    const {reach, wrapper, focused} = await standing(viewOf(take([A, B, C], 3)));

    reach()!.handleIntent(nav('right'));
    reach()!.handleIntent(press('secondary'));
    expect(consoleCardZoom.cards.map((card) => card.name)).to.deep.eq([A, B, C]);
    expect(consoleCardZoom.index, 'opened on the card under the cursor').to.eq(1);
    expect(consoleCardZoom.availability).to.eq('draft');
    const origin = consoleCardZoom.origin;
    expect(origin.kind).to.eq('physical');
    expect(origin.resolve?.(2), 'the slot the card visually lives in').to.eq(wrapper.find(`[data-zoom-slot="${C}"]`).element);
    // Browsing inside the viewer keeps the row's cursor in lockstep.
    origin.onBrowse?.(2);
    await nextTick();
    expect(focused()).to.eq(2);

    reach()!.handleIntent({kind: 'press', button: 'stickL'});
    expect(consoleCardZoom.cards.map((card) => card.name)).to.deep.eq([CardName.SOLAR_LOGISTICS]);
    expect(consoleCardZoom.statusLabel).to.eq('Source');
    expect(consoleCardZoom.contextLabel).to.eq('Card draw');

    // A getter handed to a module that outlives the surface answers «no element» once the surface is gone (R12).
    wrapper.unmount();
    expect(origin.resolve?.(2)).to.eq(null);
  });
});
