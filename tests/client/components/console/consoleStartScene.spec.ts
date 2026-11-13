/*
 * ConsoleStartScene — the GAME START WORKSPACE (the wizard of the initial cards and the deployment's ceremony), the
 * largest surface of the client. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). The surface
 * itself — the dock flights, the materialization, the deployment's stages — is its e2e specs' subject (none of them can
 * stand in jsdom); this spec pins what a conversion could break:
 *  · it mounts in an honest minimal state with no warning — a fresh game on its corporation step (every `immediate`
 *    watcher has run by then: § 1's order, nothing read before its declaration);
 *  · the bar's verbs and the watchdog's verdict are published by the `immediate` watchers (in setup — they stand with
 *    the first render) and taken back at the unmount;
 *  · a deal that cannot fly (no proxies, nothing measurable) reveals its cards — on the scene's own owned waits;
 *  · a parent's ref reaches exactly `handleIntent` · `healStrand` · `releaseByDirector` (the shell's pad router, the
 *    start watchdog and the start director — R11);
 *  · the pad it is handed: a press mid-deal only skips the deal, the cursor walks and stops at the wall, A marks the
 *    card, RT on an incomplete step only nudges, B asks the shell to minimize; the marks outlive the surface; a
 *    yielded scene takes no press;
 *  · the page's two handles the scene keeps in `consoleStartSceneState.ts` (R25 — module state, never per instance).
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleStartScene from '@/client/components/console/ConsoleStartScene.vue';
import {
  observedStartQueueBox, observeStartQueueBox, releaseStartQueueBox, retireStartReactorPlace, standStartReactorPlace,
} from '@/client/components/console/consoleStartSceneState';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import * as titles from '@/common/inputs/SelectInitialCards';
import {consoleStartState, releaseStartScene} from '@/client/console/consoleStartState';
import {consoleStartUi, resetConsoleStartUi} from '@/client/console/consoleStartUi';
import {resetStartTransition} from '@/client/console/startStageDirector';
import {resetCardDealMemory} from '@/client/console/cardDeal/cardDealMemory';
import {findReactorPlace, ReactorPlace, resetReactorPlaces} from '@/client/console/cardReaction/reactorPlaces';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

// The children are their own specs' subjects; this one reads what the scene HANDS them. (Render functions, not template
// strings: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'Card',
  props: {card: {type: Object, required: true}, lightweight: Boolean},
  render() {
    return h('div', {class: 'card-stub'}, String((this.card as {name: string}).name));
  },
});
const HeadStub = defineComponent({
  name: 'ConsoleWsHead',
  props: {root: String, mark: String, subject: String, stage: String, stageRaw: Boolean, committed: Boolean},
  setup(_props, {slots}) {
    return () => h('header', {class: 'head-stub'}, [slots.flow?.(), slots.trailing?.()]);
  },
});
// The deal layer is reached through `ref="dealLayer"` for its two exposed functions — a stand-in with no proxies is a
// deal that cannot fly (jsdom measures nothing either): the scene must then simply reveal its cards.
const DealLayerStub = defineComponent({
  name: 'ConsoleCardDealLayer',
  props: ['cards', 'models', 'nonce'],
  setup(_props, {expose}) {
    expose({proxyEls: (): Array<HTMLElement> => [], deckEl: (): HTMLElement | null => null});
    return () => h('i', {class: 'deal-layer-stub'});
  },
});
const STUBS = {
  Card: CardStub,
  ConsoleWsHead: HeadStub,
  ConsoleCardDealLayer: DealLayerStub,
  ConsoleJourneyRail: true,
  ConsoleStartSelectionDock: true,
  ConsoleStartPlayedDock: true,
  ConsoleCardAvailabilityPanel: true,
  ConsolePlayedCardLite: true,
  ActionEffectChip: true,
  ConsoleForecastRow: true,
  ConsoleForecastLayer: true,
  ConsolePreludeVariantStep: true,
  ConsoleTenderPortfolio: true,
  ConsoleTenderChip: true,
  ConsoleTenderCard: true,
  ConsoleTenderActivation: true,
  GamepadGlyph: true,
};

const ME = {color: 'red', name: 'Ada', tableau: [], megacredits: 0, terraformRating: 20, cardsInHandNbr: 0, isActive: true};
const CORPS = [CardName.THARSIS_REPUBLIC, CardName.CREDICOR];
const PROJECTS = [CardName.BIRDS, CardName.ANTS, CardName.FISH];

function cardOption(title: string, names: ReadonlyArray<CardName>, min: number, max: number) {
  return {type: 'card' as const, title, min, max, cards: names.map((name) => ({name}))};
}

/** A fresh solo game: the server asks for the initial cards — one corporation of two, then the project buy. */
function wizardView(id: string): PlayerViewModel {
  return {
    id,
    game: {phase: Phase.RESEARCH, generation: 1, passedPlayers: [], gameOptions: {}},
    thisPlayer: ME,
    players: [ME],
    cardsInHand: [],
    waitingFor: {
      type: 'initialCards',
      title: 'Select initial cards',
      options: [
        cardOption(titles.SELECT_CORPORATION_TITLE, CORPS, 1, 1),
        cardOption(titles.SELECT_PROJECTS_TITLE, PROJECTS, 0, 10),
      ],
    },
  } as unknown as PlayerViewModel;
}

/** What a test left standing — unmounted while the test's own clock is still the kernel's (see `afterEach`). */
const standing: Array<{unmount(): void}> = [];

function mountScene(playerView: PlayerViewModel) {
  const wrapper = mount(ConsoleStartScene, {
    ...globalConfig,
    props: {playerView, waitingOnPlayers: ['red']},
    global: {...globalConfig.global, stubs: STUBS},
  });
  standing.push(wrapper);
  return wrapper;
}

type Scene = {handleIntent(intent: GamepadIntent): void, healStrand(): string, releaseByDirector(): string};
const sceneOf = (wrapper: {vm: unknown}) => wrapper.vm as Scene;
const press = (button: 'confirm' | 'back' | 'triggerR'): GamepadIntent => ({kind: 'press', button});
const nav = (dir: 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const barLabels = () => consoleStartUi.commands.map((c) => c.label);
const corpSlots = (wrapper: ReturnType<typeof mountScene>) => wrapper.findAll('[data-step-slot^="corp|"]');
const flags = (slots: ReturnType<typeof corpSlots>, cls: string) => slots.map((s) => s.classes().includes(cls));

/** The start's module state is the page's: every test begins and ends on a table nobody sat at. */
function resetStartModules(): void {
  consoleStartState.ownerId = '';
  consoleStartState.signature = '';
  consoleStartState.deploymentBegun = false;
  consoleStartState.flow = 'idle';
  releaseStartScene();
  resetStartTransition();
  resetConsoleStartUi();
  resetCardDealMemory();
  resetReactorPlaces();
  releaseStartQueueBox();
  retireStartReactorPlace();
}

describe('ConsoleStartScene — the game start workspace', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    resetStartModules();
    // The scene's timers are owned waits of the flow kernel: the spec moves their clock, nothing fires behind its back.
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    // The scene's scope takes its timers back on the clock that armed them — so it leaves before the clock does.
    standing.splice(0).forEach((wrapper) => wrapper.unmount());
    setFlowClock(undefined);
    resetStartModules();
  });

  it('a fresh game opens on the corporation step: the deal armed, the bar\'s verb and the watchdog\'s verdict published with the first render', () => {
    const wrapper = mountScene(wizardView('p-start-spec-open'));

    // PREPARATION is full-bleed: the workspace band (`con-ws`) and the ceremony's bounds belong to the deployment.
    expect(wrapper.classes()).to.contain('con-start');
    expect(wrapper.classes().filter((c) => ['con-start--ceremony', 'con-start--bounded', 'con-ws', 'con-start--yielded'].includes(c)))
      .to.deep.eq([]);
    expect(wrapper.attributes('role')).to.eq('dialog');
    expect(wrapper.attributes('aria-label')).to.eq('Start of the game');
    expect(wrapper.attributes('data-start-serves'), 'what the scene answers — the leak detector reads it').to.eq('wizard');
    expect(wrapper.attributes('data-first-stage')).to.eq('idle');
    expect(wrapper.attributes('data-bonus-stage')).to.eq('idle');
    expect(wrapper.attributes('data-start-press-refused'), 'no press was refused').to.eq(undefined);

    // The header is the workspace's ONE crumb — the root, then the step the server's deal opens on.
    const head = wrapper.findComponent(HeadStub);
    expect(head.classes()).to.contain('con-start__wshead');
    expect(head.props()).to.include({root: 'Start of the game', mark: '◈', committed: false, stageRaw: false});
    expect(head.find('.con-start__count').attributes('aria-label')).to.eq('Selected 0 of 1');
    expect(head.find('[data-purchase-ledger]').exists(), 'the purchase ledger is the project step\'s').to.eq(false);
    expect(head.findAll('.con-start__crewchip').map((c) => c.find('.con-start__crewname').text())).to.deep.eq(['Ada']);

    // Every step's table is mounted ONCE and parked: the corporation's stands, the projects' waits behind it.
    const panes = wrapper.findAll('.con-start__steppane');
    expect(panes.map((p) => (p.element as HTMLElement).style.display !== 'none')).to.deep.eq([true, false]);
    const slots = corpSlots(wrapper);
    expect(slots.map((s) => s.attributes('data-step-slot'))).to.deep.eq(CORPS.map((n) => 'corp|' + n));
    expect(slots.map((s) => s.attributes('data-zoom-slot')), 'the live pane\'s cards are the viewer\'s origins').to.deep.eq(CORPS);
    expect(slots.map((s) => s.find('.card-stub').text()), 'each slot holds its own face').to.deep.eq(CORPS);
    expect(flags(slots, 'con-cards__slot--focused'), 'the cursor').to.deep.eq([true, false]);
    expect(flags(slots, 'con-cards__slot--picked')).to.deep.eq([false, false]);
    const parked = wrapper.findAll('[data-step-slot^="projects|"]');
    expect(parked.map((s) => s.attributes('data-step-slot'))).to.deep.eq(PROJECTS.map((n) => 'projects|' + n));
    expect(parked.some((s) => s.attributes('data-zoom-slot') !== undefined), 'a parked pane lends no origin').to.eq(false);

    // The first visit DEALS: the real cards are held from their very first frame (the `immediate` deal watcher ran in
    // setup, before the render), the deal's stage is up, and the bar names the one verb a deal has.
    expect(flags(slots, 'con-deal-hold')).to.deep.eq([true, true]);
    expect(slots.map((s) => s.attributes('data-deal-dealing'))).to.deep.eq(['yes', 'yes']);
    expect(flags(parked, 'con-deal-hold'), 'only THIS step\'s cards are dealt').to.deep.eq([false, false, false]);
    expect(wrapper.find('.deal-layer-stub').exists()).to.eq(true);
    expect(wrapper.find('.con-start__body--cards').attributes('data-cursor-pending')).to.eq('');
    expect(consoleStartUi.commands, 'published by the immediate watcher, in setup').to.deep.eq([{control: 'confirm', label: 'Skip'}]);
    expect(consoleStartState.serves, 'the verdict\'s mirror for the shell\'s start watchdog').to.eq('wizard');
    expect(consoleStartState.ownerId, 'the deal identity pins the picks in module state').to.eq('p-start-spec-open');
    expect((window as unknown as {__conStartDiag?: () => {mode: string}}).__conStartDiag?.().mode, 'the read-only probe').to.eq('wizard');

    // The scene takes its bar, its verdict and its probe with it.
    wrapper.unmount();
    expect(consoleStartUi.commands).to.deep.eq([]);
    expect(consoleStartState.serves).to.eq(undefined);
    expect((window as unknown as {__conStartDiag?: unknown}).__conStartDiag).to.eq(undefined);
  });

  it('a deal that cannot fly reveals its cards: the launch finds no proxies, the holds let go and the step\'s own verbs take the bar', async () => {
    const wrapper = mountScene(wizardView('p-start-spec-deal'));
    expect(flags(corpSlots(wrapper), 'con-deal-hold')).to.deep.eq([true, true]);

    // The room's return settles first (the mount's `immediate` room watcher — a deal never measures a surface that is
    // still travelling); then the launch waits out the frame swap, an owned wait of the scene's scope, and a painted frame.
    await flushPromises();
    clock.advance(1000);
    await nextTick();

    expect(flags(corpSlots(wrapper), 'con-deal-hold'), 'never a card held under a flight that will not come').to.deep.eq([false, false]);
    expect(wrapper.find('.deal-layer-stub').exists(), 'the deal\'s stage lives only while a deal runs').to.eq(false);
    expect(wrapper.find('.con-start__body--cards').attributes('data-cursor-pending')).to.eq(undefined);
    expect(barLabels(), 'the step\'s own verbs').to.deep.eq(['Select', 'Inspect', 'Next step', 'Minimize']);
    expect(consoleStartUi.commands[2], 'RT is gated on the step\'s minimum — shown disabled, never hidden')
      .to.include({control: 'triggerR', enabled: false});
  });

  it('a parent\'s ref reaches exactly `handleIntent` · `healStrand` · `releaseByDirector` — and each answers', async () => {
    const view = wizardView('p-start-spec-ref');
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleStartScene, {ref: 'scene', playerView: view, waitingOnPlayers: ['red']})]),
    });
    const host = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: STUBS}});
    standing.push(host);
    const scene = host.vm.$refs.scene as Scene;
    expect(Object.keys(scene).sort(), 'the pad router, the start watchdog and the start director are its readers')
      .to.deep.eq(['handleIntent', 'healStrand', 'releaseByDirector']);

    // The watchdog's heal re-runs the scene's own phrases — a wizard page strands nothing.
    expect(scene.healStrand()).to.eq('nothing-to-heal');

    // The director's release: outside the ceremony there is nothing to dissolve — the lifetime hold lets go at once.
    consoleStartState.hold = true;
    expect(scene.releaseByDirector()).to.eq('hold-released');
    expect(consoleStartState.hold).to.eq(false);

    // The pad: ANY input mid-deal skips the cinematic and is consumed — the cursor does not move under it…
    const slots = () => host.findAll('[data-step-slot^="corp|"]');
    scene.handleIntent(nav('right'));
    await nextTick();
    expect(slots().map((s) => s.classes().includes('con-deal-hold')), 'the deal jumped to its end').to.deep.eq([false, false]);
    expect(slots().map((s) => s.classes().includes('con-cards__slot--focused')), 'the press was the skip\'s').to.deep.eq([true, false]);

    // …then it walks, and a wall is a wall: the ring clamps, it never wraps.
    scene.handleIntent(nav('right'));
    await nextTick();
    expect(slots().map((s) => s.classes().includes('con-cards__slot--focused'))).to.deep.eq([false, true]);
    scene.handleIntent(nav('right'));
    await nextTick();
    expect(slots().map((s) => s.classes().includes('con-cards__slot--focused'))).to.deep.eq([false, true]);
  });

  it('A marks the corporation under the cursor, RT on an incomplete step only nudges, B asks the shell to minimize — and the mark outlives the surface', async () => {
    const view = wizardView('p-start-spec-pick');
    const wrapper = mountScene(view);
    sceneOf(wrapper).handleIntent(press('confirm')); // the deal's skip
    await nextTick();
    expect(consoleStartState.corp, 'the skip chose nothing').to.eq(undefined);
    const count = () => wrapper.find('.con-start__count');

    // RT is the step forward — gated on the step's own minimum: nothing picked, so the counter replays its nudge.
    sceneOf(wrapper).handleIntent(press('triggerR'));
    await nextTick();
    expect(count().classes()).to.contain('con-start__count--nudge');
    expect(count().classes()).to.not.contain('con-start__count--ready');
    expect(consoleStartState.stepIdx, 'the step did not advance').to.eq(0);

    sceneOf(wrapper).handleIntent(press('confirm'));
    await nextTick();
    expect(consoleStartState.corp, 'the pick lives in module state').to.eq(CardName.THARSIS_REPUBLIC);
    expect(flags(corpSlots(wrapper), 'con-cards__slot--picked')).to.deep.eq([true, false]);
    expect(corpSlots(wrapper)[0].find('.con-cards__pickband').exists()).to.eq(true);
    expect(count().attributes('aria-label')).to.eq('Selected 1 of 1');
    expect(count().classes()).to.contain('con-start__count--ready');

    sceneOf(wrapper).handleIntent(press('back'));
    expect(wrapper.emitted('defer'), 'B is «свернуть» — the shell\'s collapse').to.have.length(1);
    expect(wrapper.emitted('submit'), 'nothing was sent').to.eq(undefined);
    expect(wrapper.emitted('submit-batch')).to.eq(undefined);

    // «Свернуть» unmounts the surface; the restore mounts a fresh one over the SAME table: the mark is the player's,
    // and a deal the player already watched is never replayed.
    wrapper.unmount();
    const restored = mountScene(view);
    expect(flags(corpSlots(restored), 'con-cards__slot--picked')).to.deep.eq([true, false]);
    expect(flags(corpSlots(restored), 'con-deal-hold'), 'no second deal').to.deep.eq([false, false]);
    expect(restored.find('.deal-layer-stub').exists()).to.eq(false);
    expect(restored.find('.con-start__count').attributes('aria-label')).to.eq('Selected 1 of 1');
  });

  it('YIELDED — the board owns the screen: the scene stays mounted, says so on its root and takes no press', async () => {
    const wrapper = mountScene(wizardView('p-start-spec-yield'));
    await wrapper.setProps({yielded: true});

    expect(wrapper.classes()).to.contain('con-start--yielded');
    sceneOf(wrapper).handleIntent(press('confirm'));
    sceneOf(wrapper).handleIntent(nav('right'));
    await nextTick();
    expect(flags(corpSlots(wrapper), 'con-deal-hold'), 'not even the deal\'s skip').to.deep.eq([true, true]);
    expect(flags(corpSlots(wrapper), 'con-cards__slot--focused')).to.deep.eq([true, false]);
    expect(consoleStartState.corp).to.eq(undefined);
  });
});

describe('consoleStartSceneState — the handles the start scene keeps for the PAGE (R25)', () => {
  const place = (id: string, card: CardName): ReactorPlace => ({
    id,
    standsIn: (c) => c === card,
    emergeTarget: () => Promise.resolve(),
    settleTarget: () => Promise.resolve(),
    emergedFaceEl: () => undefined,
  });

  afterEach(() => {
    retireStartReactorPlace();
    releaseStartQueueBox();
    resetReactorPlaces();
  });

  it('one start scene at a time: a second registration retires the first, the retire leaves none', () => {
    standStartReactorPlace(place('start', CardName.THARSIS_REPUBLIC));
    expect(findReactorPlace(CardName.THARSIS_REPUBLIC)?.standsIn(CardName.THARSIS_REPUBLIC)).to.eq(true);

    // The scene of a restore registers before the one it replaces is gone for good — the page keeps ONE place.
    standStartReactorPlace(place('start', CardName.CREDICOR));
    expect(findReactorPlace(CardName.THARSIS_REPUBLIC), 'the first scene\'s place is retired').to.eq(undefined);
    expect(findReactorPlace(CardName.CREDICOR)?.standsIn(CardName.CREDICOR)).to.eq(true);

    retireStartReactorPlace();
    expect(findReactorPlace(CardName.CREDICOR)).to.eq(undefined);
    retireStartReactorPlace(); // idempotent — a scene that never stood retires nothing
  });

  it('the queue box is observed once per box: a new box answers «solve now», the same one does not, the release lets it go', () => {
    type Observer = {cb: () => void, observed: Array<Element>, disconnected: boolean};
    const made: Array<Observer> = [];
    const host = globalThis as unknown as {ResizeObserver?: unknown};
    const before = host.ResizeObserver;
    host.ResizeObserver = class {
      private readonly record: Observer;
      constructor(cb: () => void) {
        this.record = {cb, observed: [], disconnected: false};
        made.push(this.record);
      }
      observe(el: Element): void {
        this.record.observed.push(el);
      }
      disconnect(): void {
        this.record.disconnected = true;
      }
    };
    try {
      let resized = 0;
      const first = document.createElement('div');
      const second = document.createElement('div');

      expect(observedStartQueueBox()).to.eq(undefined);
      expect(observeStartQueueBox(first, () => resized++), 'a new box').to.eq(true);
      expect(observedStartQueueBox()).to.eq(first);
      expect(made.length).to.eq(1);
      expect(made[0].observed).to.deep.eq([first]);
      made[0].cb();
      expect(resized, 'the box\'s resize reaches the scene').to.eq(1);

      expect(observeStartQueueBox(first, () => resized++), 'the box already observed').to.eq(false);
      expect(made.length, 'no second observer on one box').to.eq(1);

      // The ceremony mounted a new queue: the observer moves with it.
      expect(observeStartQueueBox(second, () => resized++)).to.eq(true);
      expect(made[0].disconnected).to.eq(true);
      expect(made[1].observed).to.deep.eq([second]);
      expect(observedStartQueueBox()).to.eq(second);

      // No queue (the ref of an unmounted element): the observer lets go and there is nothing to solve.
      expect(observeStartQueueBox(undefined, () => resized++)).to.eq(false);
      expect(made[1].disconnected).to.eq(true);
      expect(observedStartQueueBox()).to.eq(undefined);

      expect(observeStartQueueBox(first, () => resized++)).to.eq(true);
      releaseStartQueueBox();
      expect(made[2].disconnected).to.eq(true);
      expect(observedStartQueueBox()).to.eq(undefined);
    } finally {
      host.ResizeObserver = before;
    }
  });
});
