/*
 * ConsoleDeckPick — the DRAW & SELECT surface («посмотри N карт колоды, оставь K»). A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): that it mounts in an honest state without a warning (the deal, then the
 * cursor), what it renders for its two props, the command contract it publishes to the shell's one bar, what the
 * shell's pad router reaches through the surface registry — `handleIntent`, and nothing else — and the surface's own
 * behaviours a conversion could break: the pad over the measured slots, the commit that holds its row past the
 * prompt, the refusal that gives the screen back, the table parked across a remount. Mounted the way the shell
 * mounts it: under a host that holds a ref. The card face, the two heads and the step surfaces are stubbed by name.
 * The unit runner renders the English keys.
 *
 * (The flow's MODULE — `consoleDeckPick.ts`, the hold after the submit — has its own spec:
 * tests/client/components/console/consoleDeckPick.spec.ts. The prelude pick's play mode is its e2e's.)
 */
import {expect} from 'chai';
import {flushPromises, mount, VueWrapper} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowReactive} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GamepadIntent, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {clearPanelCommands, consolePanelUi} from '@/client/console/consolePanelUi';
import {displayedDeckSize, releaseDeckDisplay} from '@/client/console/consoleDeckDisplay';
import {setWorkspaceOutcomePhase, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {deckPickFlightState, deckPickHolding, deckPickState, resetDeckPick} from '@/client/console/deckPick/consoleDeckPick';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import ConsoleDeckPick from '@/client/components/console/deckPick/ConsoleDeckPick.vue';

/** What the pad router reads through the registry — the surface's whole contract with the shell. */
type DeckPickReach = {handleIntent(intent: GamepadIntent): void};

// (Render functions, not template strings: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'Card',
  props: {card: {type: Object, required: true}, lightweight: Boolean},
  render() {
    return h('i', {'class': 'card-stub', 'data-name': (this.card as {name: string}).name, 'data-lightweight': String(this.lightweight)});
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

const StageHeadStub = defineComponent({
  name: 'ConsoleWsStageHead',
  props: {title: {type: String, required: true}},
  render() {
    return h('header', {'class': 'stagehead-stub'}, this.$slots.badges?.());
  },
});

const STUBS = {
  Card: CardStub,
  ConsoleWsHead: WsHeadStub,
  ConsoleWsStageHead: StageHeadStub,
  ConsoleCardAvailabilityPanel: true,
  ConsolePreludeDeck: true,
  ConsoleTableImpact: true,
  ConsolePreludeVariantStep: true,
  ConsolePaymentPanel: true,
};

const A = CardName.ANTS;
const B = CardName.ALGAE;
const C = CardName.BIRDS;

/** «Keep `count` of these» — the server's ask, carried by its `deckPickPrompt` marker. */
function keep(names: ReadonlyArray<CardName>, count: number): unknown {
  return {
    type: 'card',
    title: `Keep ${count} cards`,
    buttonLabel: 'Confirm',
    cards: names.map((name) => ({name})),
    deckPickPrompt: {revealed: names.length, min: count, max: count, origin: 'deck', mode: 'keep'},
  };
}

/** The viewer's game with `waitingFor` standing (or with no prompt at all — the server moved on). */
function viewOf(waitingFor: unknown): PlayerViewModel {
  return {
    id: 'p-viewer',
    waitingFor,
    game: {deckSize: 40},
    players: [],
    thisPlayer: {megacredits: 20, tableau: []},
  } as unknown as PlayerViewModel;
}

const press = (button: SemanticButton): GamepadIntent => ({kind: 'press', button});
const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

describe('ConsoleDeckPick — the draw & select surface', () => {
  let clock: ManualFlowClock;
  let mounted: Array<VueWrapper> = [];

  beforeEach(() => {
    resetDeckPick();
    // The deal's ceiling, the probe tick that opens the cursor, the refusal's grace and the rest's exit all wait on
    // the kernel's clock: the spec moves it, never sleeps.
    clock = createManualClock();
    setFlowClock(clock);
  });

  afterEach(async () => {
    for (const wrapper of mounted) {
      wrapper.unmount();
    }
    mounted = [];
    // What a test left standing runs out here — a commit let go by the leaving surface, a probe tick of the session —
    // so nothing is stranded on a clock nobody advances. Then the bundle-shared module state is put back.
    await flushPromises();
    clock.advance(60_000);
    await flushPromises();
    resetDeckPick();
    clearPanelCommands('deckPick');
    releaseDeckDisplay();
    setWorkspaceOutcomePhase('');
    setFlowClock(undefined);
  });

  function mountUnderHost(playerView: PlayerViewModel, embedded = false) {
    const props = shallowReactive<{playerView: PlayerViewModel, embedded: boolean}>({playerView, embedded});
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleDeckPick, {ref: 'deckPick', playerView: props.playerView, embedded: props.embedded})]),
    });
    const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: STUBS}});
    mounted.push(wrapper);
    const slots = () => wrapper.findAll('.con-deckpick__slot');
    return {
      wrapper,
      props,
      surface: () => wrapper.findComponent(ConsoleDeckPick),
      reach: () => (wrapper.vm.$refs.deckPick ?? undefined) as DeckPickReach | undefined,
      root: () => wrapper.find('.con-deckpick'),
      slots,
      focused: () => slots().findIndex((slot) => slot.classes().includes('con-cards__slot--focused')),
      picked: () => slots().filter((slot) => slot.classes().includes('con-cards__slot--picked')).map((slot) => slot.attributes('data-deckpick-slot')),
      badge: () => wrapper.find('.con-ws-stage-badge__num').text(),
      status: () => wrapper.find('.con-deckpick__status .con-cards__verdict').text(),
      head: () => wrapper.findComponent(WsHeadStub),
      title: () => wrapper.findComponent(StageHeadStub).props('title'),
    };
  }

  /** The deal plays out: fit, then launch — no flight layer stands in a unit mount, so the cards are handed over at
   *  once — and the cursor opens one probe tick after the handoff. */
  async function dealt(): Promise<void> {
    await flushPromises();
    clock.advance(PROBE_TICK_FALLBACK_MS);
    await nextTick();
  }

  /** A surface standing with its batch dealt and the cursor open. */
  async function standing(playerView: PlayerViewModel, embedded = false) {
    const stand = mountUnderHost(playerView, embedded);
    await dealt();
    expect(deckPickState.phase, 'the cursor is open').to.eq('choosing');
    return stand;
  }

  /** Picks the first two cards and commits the set (A · → · A · RT). */
  function commitFirstTwo(reach: DeckPickReach): void {
    reach.handleIntent(press('confirm'));
    reach.handleIntent(nav('right'));
    reach.handleIntent(press('confirm'));
    reach.handleIntent(press('triggerR'));
  }

  /** The cards nobody took have finished leaving (their own `animationend` — the beat's real end). */
  async function restHasLeft(slot: {element: Element}): Promise<void> {
    await flushPromises();
    // (The DOM's own `Event`: node's global one is not an event to jsdom's `dispatchEvent`.)
    slot.element.dispatchEvent(new window.Event('animationend'));
    await flushPromises();
  }

  it('mounts without a warning: the root first, the batch in its slots under the deal — then the handoff opens the cursor and the bar', async () => {
    const {wrapper, root, slots, head, title, status, badge, focused} = mountUnderHost(viewOf(keep([A, B, C], 2)));
    expect(root().element, 'the template starts with its root — no comment node before it').to.eq((wrapper.element as Element).children[0]);
    expect(root().classes()).to.include.members(['con-deckpick', 'con-ws']);
    expect(root().classes()).to.not.include('con-deckpick--embedded');
    expect(root().attributes('role')).to.eq('dialog');
    expect(root().attributes('aria-label')).to.eq('Keep 2 cards');
    expect(root().attributes('data-motion-surface')).to.eq('deck-pick');

    // THE DEAL: the faces are named to the app-level layer, every real slot is held under its proxy, the HUD's deck
    // counter stands on the pre-draw number, the pad is shut.
    expect(root().attributes('data-flow')).to.eq('dealing');
    expect(deckPickFlightState.cards).to.deep.eq([A, B, C]);
    expect(displayedDeckSize(40)).to.eq(43);
    expect(slots().map((slot) => slot.attributes('data-deckpick-slot'))).to.deep.eq([A, B, C]);
    expect(slots().map((slot) => slot.attributes('data-zoom-slot'))).to.deep.eq([A, B, C]);
    expect(slots().map((slot) => slot.classes().includes('con-deal-hold'))).to.deep.eq([true, true, true]);
    expect(wrapper.findAllComponents(CardStub).map((card) => card.attributes('data-name'))).to.deep.eq([A, B, C]);
    expect(wrapper.findAllComponents(CardStub).map((card) => card.attributes('data-lightweight'))).to.deep.eq(['true', 'true', 'true']);
    expect(head().props()).to.deep.eq({root: 'Card draw', emblem: 'cards', subject: '', stage: 'Drawing cards…', committed: false});
    expect(title()).to.eq('Drawing cards…');
    expect(status()).to.eq('Cards from the deck: 3');
    expect(focused(), 'no ring while the cards arrive').to.eq(-1);
    expect(consolePanelUi.owner).to.eq('deckPick');
    expect(consolePanelUi.commands, 'a beat in flight advertises no verb').to.deep.eq([]);

    await dealt();
    expect(root().attributes('data-flow')).to.eq('choosing');
    expect(deckPickFlightState.cards, 'the flight is over').to.deep.eq([]);
    expect(displayedDeckSize(40), 'the counter is the server\'s again').to.eq(40);
    expect(slots().map((slot) => slot.classes().includes('con-deal-hold'))).to.deep.eq([false, false, false]);
    expect(head().props('stage')).to.eq('Selection');
    expect(title(), 'the server\'s own ask').to.eq('Keep 2 cards');
    expect(status()).to.eq('Choose 2 more');
    expect(badge()).to.eq('0/2');
    expect(focused()).to.eq(0);
    expect(wrapper.find('.con-cards__verdict-name').text()).to.eq(A);
    expect(consolePanelUi.commands).to.deep.eq([
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Select', enabled: true},
      {control: 'secondary', label: 'Inspect'},
      {control: 'triggerR', label: 'Confirm', enabled: false, priority: 0},
      {control: 'back', label: 'Minimize'},
    ]);

    wrapper.unmount();
    expect(consolePanelUi.owner, 'the bar is given back when the surface leaves').to.eq(undefined);
  });

  it('EMBEDDED it strips its shell and hands its stage name UP — retracted when it stops being embedded and when it leaves', async () => {
    const {wrapper, props, root, head} = mountUnderHost(viewOf(keep([A, B, C], 2)), true);
    expect(root().classes()).to.include('con-deckpick--embedded');
    expect(root().classes()).to.not.include('con-ws');
    expect(root().attributes('role')).to.eq('group');
    expect(root().attributes('data-motion-surface'), 'a kept motion id would claim the shared shade').to.eq(undefined);
    expect(head().exists(), 'the host\'s crumb names the stage — no header of its own').to.eq(false);
    expect(workspaceOutcomeState.phaseKey).to.eq('Drawing cards…');

    await dealt();
    expect(workspaceOutcomeState.phaseKey, 'the tail follows the stage').to.eq('Selection');

    props.embedded = false;
    await nextTick();
    expect(workspaceOutcomeState.phaseKey).to.eq('');
    expect(root().classes()).to.include('con-ws');
    expect(head().props('stage')).to.eq('Selection');

    props.embedded = true;
    await nextTick();
    expect(workspaceOutcomeState.phaseKey).to.eq('Selection');
    wrapper.unmount();
    expect(workspaceOutcomeState.phaseKey).to.eq('');
  });

  it('a PARENT\'s ref sees exactly `handleIntent` — the d-pad walks the MEASURED slots, A toggles a pick up to the bound, B defers', async () => {
    const {reach, surface, slots, focused, picked, badge, status, wrapper} = await standing(viewOf(keep([A, B, C], 2)));
    const pad = reach();
    expect(pad, 'the shell\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(pad!), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['handleIntent']);
    for (const inner of ['confirm', 'toggleFocused', 'startDeal', 'fitRow', 'picks', 'focusIdx', 'submitting', 'frozen', 'footCommands', 'props', 'emit']) {
      expect((pad as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    // A wrapped group: A and B on the first row, C centred nowhere near a column — under A. The cursor goes where the
    // card physically is (an index stepper would leave «down» on A and «right» on C).
    const at: Record<string, {left: number, top: number}> = {[A]: {left: 0, top: 0}, [B]: {left: 120, top: 0}, [C]: {left: 0, top: 180}};
    for (const slot of slots()) {
      const {left, top} = at[slot.attributes('data-deckpick-slot') ?? ''];
      (slot.element as HTMLElement).getBoundingClientRect = () => ({left, top, width: 100, height: 140, right: left + 100, bottom: top + 140, x: left, y: top} as DOMRect);
    }
    const walk: Array<number> = [];
    for (const dir of ['down', 'right', 'left'] as const) {
      pad!.handleIntent(nav(dir));
      await nextTick();
      walk.push(focused());
    }
    expect(walk, 'A ↓ C → B ← A').to.deep.eq([2, 1, 0]);

    pad!.handleIntent(press('confirm'));
    await nextTick();
    expect(picked()).to.deep.eq([A]);
    expect(slots()[0].find('.con-cards__pickband').text()).to.eq('✓ Card selected');
    expect(badge()).to.eq('1/2');
    expect(status()).to.eq('Choose 1 more');
    expect(consolePanelUi.commands.find((c) => c.control === 'confirm')?.label, 'A on a picked card takes it back').to.eq('Deselect');
    expect(consolePanelUi.commands.find((c) => c.control === 'triggerR')?.enabled).to.eq(false);

    pad!.handleIntent(nav('right'));
    pad!.handleIntent(press('confirm'));
    await nextTick();
    expect(picked()).to.deep.eq([A, B]);
    expect(badge()).to.eq('2/2');
    expect(wrapper.find('.con-ws-stage-badge').classes()).to.include('con-ws-stage-badge--ready');
    expect(status()).to.eq('Selection complete');
    expect(slots().map((slot) => slot.classes().includes('con-cards__slot--dim')), 'at the bound the card not taken calms down').to.deep.eq([false, false, true]);
    expect(consolePanelUi.commands.find((c) => c.control === 'triggerR')?.enabled).to.eq(true);

    // At the bound A on a third card takes nothing — and says so on the bar.
    pad!.handleIntent(nav('down'));
    await nextTick();
    expect(focused()).to.eq(2);
    expect(consolePanelUi.commands.find((c) => c.control === 'confirm')?.enabled).to.eq(false);
    pad!.handleIntent(press('confirm'));
    await nextTick();
    expect(picked()).to.deep.eq([A, B]);

    pad!.handleIntent(press('back'));
    expect(surface().emitted('defer')).to.have.length(1);
    expect(surface().emitted('submit'), 'nothing was answered').to.eq(undefined);
  });

  it('RT commits ONCE: the answer goes out, the row stands on its snapshot while the server moves on, and the flow ends when the rest have left', async () => {
    const {reach, surface, props, root, slots, picked, title, status, head} = await standing(viewOf(keep([A, B, C], 2)));
    commitFirstTwo(reach()!);
    expect(surface().emitted('submit')).to.deep.eq([[{type: 'card', cards: [A, B]}]]);
    expect(surface().emitted('submit-batch'), 'a plain keep is one answer').to.eq(undefined);
    expect(deckPickState.phase, 'synchronous with the submit').to.eq('sending');
    expect(deckPickHolding(), 'the shell keeps the surface mounted').to.eq(true);

    // A beat in flight absorbs the pad — no second answer, no verb on the bar.
    reach()!.handleIntent(press('triggerR'));
    reach()!.handleIntent(press('confirm'));
    expect(surface().emitted('submit')).to.have.length(1);

    // The answer lands at once: the prompt is gone, the surface is held by the commit — and renders its snapshot.
    props.playerView = viewOf(undefined);
    await flushPromises();
    expect(root().attributes('data-flow'), 'no dock stands in a unit mount: the rest leave at once').to.eq('clearing');
    expect(root().classes()).to.include('con-deckpick--clearing');
    expect(slots().map((slot) => slot.attributes('data-deckpick-slot')), 'the row is the frozen batch').to.deep.eq([A, B, C]);
    expect(picked()).to.deep.eq([A, B]);
    expect(title()).to.eq('Taken into hand: 2');
    expect(status()).to.eq('The rest is discarded');
    expect(head().props()).to.include({stage: 'Received', committed: true});
    expect(consolePanelUi.commands).to.deep.eq([]);
    expect(deckPickHolding()).to.eq(true);

    await restHasLeft(slots()[2]);
    expect(deckPickState.phase, 'the commit is over').to.eq('idle');
    expect(deckPickHolding(), 'the surface may unmount').to.eq(false);
    expect(slots(), 'the snapshot is let go with the commit').to.have.length(0);
  });

  it('a REFUSED submit gives the screen back: the same question still standing after the grace rolls the flow back to the choice', async () => {
    const {reach, surface, root, slots, picked, badge, focused} = await standing(viewOf(keep([A, B, C], 2)));
    commitFirstTwo(reach()!);
    expect(surface().emitted('submit')).to.have.length(1);
    await restHasLeft(slots()[2]);
    expect(deckPickHolding(), 'the beats are over — the commit waits for the server alone').to.eq(true);
    expect(root().attributes('data-flow')).to.eq('clearing');

    // The grace's end is SAID (the wait graph's ceiling line) — collected here, never printed over the run.
    const said: Array<string> = [];
    const warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      said.push(args.map(String).join(' '));
    };
    try {
      clock.advance(2_000);
      await flushPromises();
    } finally {
      console.warn = warn;
    }
    expect(said.filter((line) => line.includes('[wait-graph] ceiling deck-pick:prompt-moved')), 'the wait ended on its ceiling, once').to.have.length(1);
    expect(deckPickState.phase).to.eq('choosing');
    expect(deckPickHolding()).to.eq(false);
    expect(root().attributes('data-flow')).to.eq('choosing');
    expect(picked(), 'a clean table').to.deep.eq([]);
    expect(badge()).to.eq('0/2');
    expect(focused()).to.eq(0);
    expect(consolePanelUi.commands.map((c) => c.label), 'the verbs are back').to.deep.eq(['Navigate', 'Select', 'Inspect', 'Confirm', 'Minimize']);
  });

  it('an answer that lands INSIDE the grace ends the commit at once — the surface watches the prompt, the grace is taken back', async () => {
    const {reach, props, slots} = await standing(viewOf(keep([A, B, C], 2)));
    commitFirstTwo(reach()!);
    await restHasLeft(slots()[2]);
    expect(deckPickHolding()).to.eq(true);

    props.playerView = viewOf(undefined);
    await flushPromises();
    expect(deckPickState.phase).to.eq('idle');
    expect(deckPickHolding()).to.eq(false);

    const said: Array<string> = [];
    const warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      said.push(args.map(String).join(' '));
    };
    try {
      clock.advance(5_000);
      await flushPromises();
    } finally {
      console.warn = warn;
    }
    expect(said, 'no grace is left standing').to.deep.eq([]);
    expect(deckPickState.phase).to.eq('idle');
  });

  it('PARKS the table, not the answer: an unanswered batch keeps its picks and cursor across a remount — adopted, never dealt twice', async () => {
    const view = viewOf(keep([A, B, C], 2));
    const first = await standing(view);
    first.reach()!.handleIntent(press('confirm'));
    first.reach()!.handleIntent(nav('right'));
    await nextTick();
    expect(first.picked()).to.deep.eq([A]);
    expect(first.focused()).to.eq(1);
    first.wrapper.unmount();

    // The hosting workspace was collapsed and reopened over the SAME server ask.
    const again = mountUnderHost(view);
    expect(again.root().attributes('data-flow'), 'a settled table — no second deal').to.eq('choosing');
    expect(deckPickFlightState.cards, 'no face is named to the flight layer').to.deep.eq([]);
    expect(displayedDeckSize(40), 'the deck counter is not held back again').to.eq(40);
    expect(again.picked()).to.deep.eq([A]);
    expect(again.focused()).to.eq(1);
    expect(again.badge()).to.eq('1/2');
    expect(again.surface().emitted('submit'), 'nothing was answered for the player').to.eq(undefined);
  });
});
