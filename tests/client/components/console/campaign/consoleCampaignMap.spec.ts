/*
 * ConsoleCampaignMap — «Кампания»: the campaign's route of missions, the party's position, the seats' rail, and the
 * stages that open out of it (a mission's inspect, a participant's legacy, the carryover picker, the tender bidding).
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md).
 *
 * Two hosts. `App` mounts it STANDALONE: it owns the pad (`installMenuPad`), the page's overflow lock and its own
 * command bar, and root B navigates to the main menu through the app root's port (`vueRoot(this)` before the
 * conversion — § R26). The endgame workspace mounts it EMBEDDED: the host has already opened the campaign, routes the
 * pad into `handleIntent` — the ONE member the map exposes (§ R11) — and reads the map's verbs off the module mirror
 * (`campaignMapUi`); root B there hands the screen back (`close`).
 *
 * The pad reaches the picker and the bidding THROUGH THEIR TEMPLATE REFS (`this.$refs.x` before — § R11), and the
 * terminal hand is dealt in from the viewer's own seat row, found through the map's ROOT ref (`this.$el` before —
 * § R12).
 *
 * A large surface: its journeys (the launch, the auto-join, the kept cards' flight, the curtain) are the e2e's. Here —
 * the minimal honest state of both hosts, what it exposes, the routing through the refs, the port and the mirror.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {CampaignMissionModel, CampaignModel} from '@/common/campaign/CampaignModel';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {dispatchConsoleIntent} from '@/client/console/consoleRouter';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {consoleNativeState} from '@/client/console/composables/consoleNativeSurface';
import {resetSceneTransitionForTest} from '@/client/console/loadingScreenState';
import {campaignState, resetCampaignState} from '@/client/console/campaign/campaignState';
import {campaignMapUi, resetCampaignMapUi} from '@/client/console/campaign/campaignMapUi';
import {biddingRevealKey, tenderBiddingUi} from '@/client/console/campaign/tenderBiddingUi';
import {APP_ROOT, AppRoot} from '@/client/components/appRoot';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import ConsoleCampaignMap from '@/client/components/console/campaign/ConsoleCampaignMap.vue';

// (Render functions, not template strings: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

/** The command bar's stand-in: the context and the verbs the standalone map hands it. */
const BarStub = defineComponent({
  name: 'ConsoleCommandBar',
  props: {context: String, commands: Array},
  render: () => h('div', {class: 'bar-stub'}),
});

/** A route card's stand-in: the mission it paints and whether the cursor stands on it. */
const MissionCardStub = defineComponent({
  name: 'CampaignMissionCard',
  props: {mission: Object, cursor: Boolean, reveal: Boolean, revealDelayMs: Number},
  render: () => h('div', {class: 'mission-card-stub'}),
});

const InspectStub = defineComponent({
  name: 'CampaignMissionInspect',
  props: {mission: Object, details: Object, youSeat: Number, botCorporation: String, missionCount: Number},
  render: () => h('div', {class: 'inspect-stub'}),
});

const LegacyStub = defineComponent({
  name: 'CampaignSeatLegacy',
  props: {legacy: Object, cursorIndex: Number},
  render: () => h('div', {class: 'legacy-stub'}),
});

/** Every intent a stage was handed through the map's ref to it, in order. */
const heard: Array<{surface: 'picker' | 'bidding', intent: GamepadIntent}> = [];
/** Every rect the picker was asked to deal the hand in from. */
const dealt: Array<DOMRect | undefined> = [];
/** What happened on the confirm's road, in order: the kept faces are measured BEFORE the POST. */
const order: Array<string> = [];

/** The carryover picker's stand-in: its props, its emits, and the THREE members the map reads through the ref. */
const PickerStub = defineComponent({
  name: 'ConsoleCarryoverPicker',
  props: {
    eligible: Array, selected: Array, limit: Number, tenderSeats: Number, eligiblePreludes: Array, preludeLimit: Number,
    selectedPreludes: Array, tenders: Array, tenderBusy: String, tenderError: String, nextMission: Number, root: String,
    confirmed: Boolean, submitting: Boolean, error: String,
  },
  emits: ['toggle', 'togglePrelude', 'executeTender', 'confirm', 'back', 'armChange', 'bar'],
  methods: {
    handleIntent(intent: GamepadIntent): boolean {
      heard.push({surface: 'picker', intent});
      return true;
    },
    dealIn(from: DOMRect | undefined): void {
      dealt.push(from);
    },
    keptFaces(): Map<CardName, {el: HTMLElement, rect: DOMRect}> {
      order.push('faces');
      return new Map();
    },
  },
  render: () => h('div', {class: 'picker-stub'}),
});

/** The tender bidding's stand-in: its props, its emits, and `handleIntent` — the one member the map reads. */
const BiddingStub = defineComponent({
  name: 'ConsoleTenderBidding',
  props: {
    bidding: Object, seats: Array, youSeat: Number, missionLabel: String, revealKey: String, root: String,
    submitting: Boolean, error: String, embedded: Boolean,
  },
  emits: ['bid', 'back'],
  methods: {
    handleIntent(intent: GamepadIntent): boolean {
      heard.push({surface: 'bidding', intent});
      return true;
    },
  },
  render: () => h('div', {class: 'bidding-stub'}),
});

const STUBS = {
  GamepadGlyph: GlyphStub,
  ConsoleCommandBar: BarStub,
  CampaignMissionCard: MissionCardStub,
  CampaignMissionInspect: InspectStub,
  CampaignSeatLegacy: LegacyStub,
  ConsoleCarryoverPicker: PickerStub,
  ConsoleTenderBidding: BiddingStub,
  ConsoleTenderChip: true,
};

const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const X: GamepadIntent = {kind: 'press', button: 'secondary'};
const Y: GamepadIntent = {kind: 'press', button: 'inspect'};

function mission(slot: number, board: BoardName, state: CampaignMissionModel['state'], extra: Partial<CampaignMissionModel> = {}): CampaignMissionModel {
  return {slot, board, final: slot === 3, state, modifiers: [], ...extra};
}

/** A fresh campaign as its creator sees it: nothing played, mission 1 ready to launch. */
function fresh(overrides: Partial<CampaignModel> = {}): CampaignModel {
  return {
    id: 'ctest',
    rev: 3,
    name: 'Test Campaign',
    createdTimeMs: 0,
    phase: 'generated',
    pointer: 0,
    missionCount: 4,
    seats: [
      {seat: 0, kind: 'human', name: 'Alice', color: 'blue', trBoost: 0},
      {seat: 1, kind: 'human', name: 'Bruno', color: 'red', trBoost: 0},
      {seat: 2, kind: 'bot', name: 'MarsBot', color: 'green', trBoost: 0, botDifficulty: 'hard'},
    ],
    you: {seat: 0},
    canLaunch: true,
    launchBlockers: [],
    missions: [
      mission(0, BoardName.THARSIS, 'ready'),
      mission(1, BoardName.HELLAS, 'locked'),
      mission(2, BoardName.ELYSIUM, 'locked'),
      mission(3, BoardName.UTOPIA_PLANITIA, 'locked'),
    ],
    progression: {lineages: {}, titles: [], titlePoints: {0: 0, 1: 0, 2: 0}, pendingBonuses: {}},
    ...overrides,
  };
}

/** The interlude after mission 1: the viewer's own carryover door is the campaign's next move (a hand of three, a limit of two). */
function interlude(overrides: Partial<CampaignModel> = {}): CampaignModel {
  return fresh({
    phase: 'interlude',
    pointer: 1,
    canLaunch: false,
    launchBlockers: ['Waiting for the project carryover selections'],
    missions: [
      mission(0, BoardName.THARSIS, 'committed', {gameId: 'g1', yourPlayerId: 'p-you'}),
      mission(1, BoardName.HELLAS, 'ready'),
      mission(2, BoardName.ELYSIUM, 'locked'),
      mission(3, BoardName.UTOPIA_PLANITIA, 'locked'),
    ],
    carryover: {
      sourceSlot: 0,
      bySeat: [
        {seat: 0, status: 'pending', count: 0, limit: 2},
        {seat: 1, status: 'confirmed', count: 2, limit: 2},
      ],
      yourCards: [],
      yourEligible: [CardName.ANTS, CardName.ALGAE, CardName.BIRDS],
      yourLimit: 2,
    },
    ...overrides,
  });
}

/** What a parent's ref to the map carries. */
type MapReach = {handleIntent: (intent: GamepadIntent) => boolean};

describe('ConsoleCampaignMap — the campaign map', () => {
  let clock: ManualFlowClock;
  let savedFetch: unknown;
  let savedTitle: string;
  let savedBiddingCommands: ReadonlyArray<ConsoleCommand>;
  /** Every request sent, in order. */
  let posted: Array<{url: string, body: unknown}>;
  /** What the server answers a carryover POST. */
  let answer: CampaignModel | undefined;

  /** The host seeded the store, as the endgame workspace does before it mounts the scene. */
  function seed(model: CampaignModel): void {
    campaignState.id = model.id;
    campaignState.model = model;
    campaignState.status = 'ok';
  }

  function mountMap(opts: {embedded: boolean, root?: Partial<AppRoot>}) {
    // Mounted under a host with a string ref — what a parent's ref to the map carries is read there.
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleCampaignMap, {ref: 'map', embedded: opts.embedded})]),
    });
    const wrapper = mount(Host, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        stubs: STUBS,
        provide: opts.root === undefined ? {} : {[APP_ROOT as symbol]: opts.root},
      },
    });
    const map = () => wrapper.findComponent(ConsoleCampaignMap);
    const reach = () => wrapper.vm.$refs.map as MapReach;
    const cards = () => wrapper.findAll('.cmap__card');
    return {
      wrapper,
      map,
      reach,
      root: () => wrapper.find('.cmap'),
      /** One intent through the member the map exposes; the DOM it moved is rendered when this resolves. */
      press: async (intent: GamepadIntent): Promise<boolean> => {
        const taken = reach().handleIntent(intent);
        await nextTick();
        return taken;
      },
      /** The route slots the cursor stands on / the rail rows it stands on. */
      routeCursor: () => cards().map((card, slot) => card.classes().includes('cmap__card--cursor') ? slot : -1).filter((slot) => slot >= 0),
      railCursor: () => wrapper.findAll('.cmap__seat').map((row, i) => row.classes().includes('cmap__seat--cursor') ? i : -1).filter((i) => i >= 0),
      picker: () => wrapper.findComponent(PickerStub),
      bidding: () => wrapper.findComponent(BiddingStub),
      bar: () => wrapper.findComponent(BarStub),
    };
  }

  beforeEach(() => {
    // Module state is bundle-shared: the store, the mirror and the curtain start from their own zero.
    resetCampaignState();
    resetCampaignMapUi();
    resetSceneTransitionForTest();
    clock = createManualClock(0);
    setFlowClock(clock);
    heard.length = 0;
    dealt.length = 0;
    order.length = 0;
    posted = [];
    answer = undefined;
    savedTitle = document.title;
    savedBiddingCommands = tenderBiddingUi.commands;
    savedFetch = (globalThis as {fetch?: unknown}).fetch;
    (globalThis as {fetch?: unknown}).fetch = async (url: string, init?: {body?: string}) => {
      order.push('post');
      posted.push({url: String(url), body: init?.body === undefined ? undefined : JSON.parse(init.body)});
      return {ok: answer !== undefined, status: answer !== undefined ? 200 : 500, json: async () => answer, text: async () => answer === undefined ? '' : JSON.stringify(answer)};
    };
  });

  afterEach(() => {
    (globalThis as {fetch?: unknown}).fetch = savedFetch;
    setFlowClock(undefined);
    document.title = savedTitle;
    tenderBiddingUi.commands = savedBiddingCommands;
    resetCampaignState();
    resetCampaignMapUi();
  });

  it('mounts EMBEDDED in its minimal honest state — a fresh campaign the host already opened — without a warning', () => {
    // (`globalConfig` turns every Vue warning into a throw: a mount that returns is a mount without one.)
    const pads = menuPadState.mountedCount;
    const surfaces = consoleNativeState.surfaces;
    seed(fresh());
    const m = mountMap({embedded: true});

    expect(m.root().classes(), 'no reveal, no chronicle, no carryover stage').to.deep.eq(['cmap', 'cmap--embedded']);
    expect(m.wrapper.find('.cm-menu__bg').exists(), 'the host\'s scene is the background').to.eq(false);
    expect(m.bar().exists(), 'the HOST owns the command bar').to.eq(false);
    expect(menuPadState.mountedCount, 'the host owns the pad').to.eq(pads);
    expect(consoleNativeState.surfaces, 'and the page\'s overflow lock').to.eq(surfaces);

    expect(m.wrapper.find('.cmap__title').text()).to.eq('Test Campaign');
    expect(m.wrapper.find('.cmap__progress-label').text()).to.eq(translateTextWithParams('Mission ${0} of ${1}', ['1', '4']));
    // The route: four cards on one connector, the party and the cursor on the mission the campaign is at.
    const faces = m.wrapper.findAllComponents(MissionCardStub);
    expect(faces.map((face) => (face.props('mission') as {slot: number}).slot)).to.deep.eq([0, 1, 2, 3]);
    expect(faces.map((face) => face.props('cursor'))).to.deep.eq([true, false, false, false]);
    expect(m.routeCursor()).to.deep.eq([0]);
    const cards = m.wrapper.findAll('.cmap__card');
    expect(cards[0].classes()).to.include('cmap__card--current');
    expect(cards[1].classes()).to.include('cmap__card--future');
    expect(cards[3].classes()).to.include('cmap__card--final');
    const nodes = m.wrapper.findAll('.cmap__node');
    expect(nodes.map((node) => node.find('.cmap__party').exists())).to.deep.eq([true, false, false, false]);
    expect(nodes[0].findAll('.cmap__party-cube').length, 'a cube per seat').to.eq(3);
    // The rail: a row per seat, the viewer's own marked (the hand is dealt in from it).
    const rows = m.wrapper.findAll('.cmap__seat');
    expect(rows.length).to.eq(3);
    expect(rows.map((row) => row.attributes('data-cmap-seat-you'))).to.deep.eq(['true', undefined, undefined]);
    expect(rows[0].find('.cmap__seat-label').text()).to.eq('Alice');
    expect(m.railCursor()).to.deep.eq([]);
    expect(m.wrapper.find('.cmap__wait-strip').exists(), 'no readiness round is open').to.eq(false);
    expect(m.wrapper.find('.cm-overlay').exists()).to.eq(false);
    expect(m.picker().exists()).to.eq(false);
    expect(m.bidding().exists()).to.eq(false);

    // The mirror the embedded host reads its bar from — written at mount, whole.
    expect(campaignMapUi.overlay).to.eq(undefined);
    expect(campaignMapUi.carryConfirmLabel, 'no hand to carry — the step would be a readiness press').to.eq('Confirm readiness');
    expect(campaignMapUi.commands).to.deep.eq([
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Launch the mission', enabled: true},
      {control: 'secondary', label: 'Inspect the mission'},
      {control: 'back', label: 'Main menu'},
    ]);
  });

  it('exposes exactly `handleIntent`: the host routes the pad through its ref, and the d-pad walks the route and the rail', async () => {
    seed(fresh());
    const m = mountMap({embedded: true});
    expect(Object.keys(m.reach()), 'the sheet\'s MUST EXPOSE list').to.deep.eq(['handleIntent']);

    expect(await m.press(nav('right'))).to.eq(true);
    expect(m.routeCursor()).to.deep.eq([1]);
    expect(await m.press(nav('left'))).to.eq(true);
    expect(await m.press(nav('left'))).to.eq(true);
    expect(m.routeCursor(), 'left from the first mission stays on it').to.deep.eq([0]);
    // Down — the rail; the A verb changes with the zone, and the route's X verb leaves the bar.
    await m.press(nav('down'));
    expect(m.routeCursor()).to.deep.eq([]);
    expect(m.railCursor()).to.deep.eq([0]);
    expect(campaignMapUi.commands).to.deep.eq([
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Open: participant legacy'},
      {control: 'back', label: 'Main menu'},
    ]);
    await m.press(nav('down'));
    await m.press(nav('down'));
    await m.press(nav('down'));
    expect(m.railCursor(), 'down from the last seat stays on it').to.deep.eq([2]);
    // Up from the first row returns to the mission the campaign is at.
    await m.press(nav('up'));
    await m.press(nav('up'));
    await m.press(nav('up'));
    expect(m.railCursor()).to.deep.eq([]);
    expect(m.routeCursor()).to.deep.eq([0]);
  });

  it('A on a seat row opens that participant\'s legacy, X on a route card the mission\'s inspect — B closes one level, each mirrored for the host', async () => {
    seed(fresh());
    const m = mountMap({embedded: true});

    await m.press(nav('down'));
    await m.press(nav('down'));
    await m.press(A);
    const legacy = m.wrapper.findComponent(LegacyStub);
    expect(legacy.exists()).to.eq(true);
    expect((legacy.props('legacy') as {seat: number, name: string})).to.include({seat: 1, name: 'Bruno'});
    expect(legacy.props('cursorIndex'), 'nothing to inspect in an empty legacy').to.eq(undefined);
    expect(campaignMapUi.overlay).to.eq('legacy');
    expect(campaignMapUi.commands).to.deep.eq([{control: 'back', label: 'Close'}]);
    expect(await m.press(A), 'the overlay swallows what it has no use for').to.eq(true);
    expect(m.wrapper.findComponent(LegacyStub).exists()).to.eq(true);
    await m.press(B);
    expect(m.wrapper.findComponent(LegacyStub).exists()).to.eq(false);
    expect(campaignMapUi.overlay).to.eq(undefined);
    expect(m.railCursor(), 'the cursor stands where it was').to.deep.eq([1]);
    expect(m.map().emitted('close'), 'B closed the overlay, not the map').to.eq(undefined);

    await m.press(nav('up'));
    await m.press(nav('up'));
    await m.press(nav('right'));
    await m.press(nav('right'));
    await m.press(X);
    const inspect = m.wrapper.findComponent(InspectStub);
    expect(inspect.exists()).to.eq(true);
    expect((inspect.props('mission') as {slot: number}).slot, 'ANY route card — a future one too').to.eq(2);
    expect(inspect.props('details'), 'a future mission has no results').to.eq(undefined);
    expect(inspect.props('youSeat')).to.eq(0);
    expect(inspect.props('missionCount')).to.eq(4);
    expect(m.wrapper.find('.cm-overlay__title').text()).to.eq(translateTextWithParams('Mission ${0}', ['3']));
    expect(campaignMapUi.overlay).to.eq('mission');
    expect(campaignMapUi.commands).to.deep.eq([{control: 'back', label: 'Close'}]);
    await m.press(B);
    expect(m.wrapper.findComponent(InspectStub).exists()).to.eq(false);
    expect(campaignMapUi.overlay).to.eq(undefined);
    expect(m.routeCursor()).to.deep.eq([2]);
  });

  it('root B — embedded: the host takes the screen back (`close`), nothing navigates; standalone: the main menu through the app root\'s port; with no root above it the press does nothing', async () => {
    const went: Array<string> = [];
    const root = {
      navigateInApp: (path: string) => {
        went.push(path);
      },
    };

    seed(fresh());
    const hosted = mountMap({embedded: true, root});
    expect(await hosted.press(B)).to.eq(true);
    expect(hosted.map().emitted('close'), 'the embedded scene hands the screen back').to.have.length(1);
    expect(went, 'and never navigates — the host is the game').to.deep.eq([]);
    hosted.wrapper.unmount();

    // Standalone the map owns the pad: the press arrives through the product's own dispatch.
    const inApp = mountMap({embedded: false, root});
    expect(dispatchConsoleIntent(B)).to.eq(true);
    expect(went).to.deep.eq(['/']);
    expect(inApp.map().emitted('close'), 'a standalone map has no host to hand back to').to.eq(undefined);
    inApp.wrapper.unmount();

    const bare = mountMap({embedded: false});
    expect(dispatchConsoleIntent(B), 'the press is still the map\'s').to.eq(true);
    expect(went, 'nowhere to navigate').to.deep.eq(['/']);
    expect(bare.root().exists()).to.eq(true);
    expect(bare.map().emitted('close')).to.eq(undefined);
  });

  it('standalone it owns the pad, the page\'s overflow lock and its own bar for its lifetime — and with no campaign loaded it says so, never a dead screen', async () => {
    const pads = menuPadState.mountedCount;
    const surfaces = consoleNativeState.surfaces;
    // No `id` in the address: nothing is asked of the server and the store stays empty (`vm` is undefined — the
    // watchers that fire at creation read the map's model through it).
    const m = mountMap({embedded: false});
    expect(menuPadState.mountedCount).to.eq(pads + 1);
    expect(consoleNativeState.surfaces).to.eq(surfaces + 1);
    expect(posted, 'nothing was asked').to.deep.eq([]);
    expect(m.root().classes()).to.deep.eq(['cmap']);
    expect(m.wrapper.find('.cm-menu__bg').exists(), 'its own background').to.eq(true);
    expect(m.wrapper.find('.cmap__head').exists()).to.eq(false);
    expect(m.wrapper.find('.cmap__load').exists(), 'idle: neither loading nor failed').to.eq(false);
    expect(m.bar().props('context')).to.eq('Campaign');
    expect(m.bar().props('commands')).to.deep.eq([{control: 'confirm', label: 'Retry'}, {control: 'back', label: 'Main menu'}]);
    expect(campaignMapUi.commands).to.deep.eq([{control: 'confirm', label: 'Retry'}, {control: 'back', label: 'Main menu'}]);

    campaignState.status = 'loading';
    await nextTick();
    expect(m.wrapper.find('.cmap__load').text()).to.eq($t('Loading the campaign…'));
    expect(m.wrapper.find('.cmap__load--error').exists()).to.eq(false);

    campaignState.status = 'error';
    await nextTick();
    expect(m.wrapper.find('.cmap__load--error').exists()).to.eq(true);
    expect(m.wrapper.find('.cmap__retry').exists(), 'the failure offers the way out').to.eq(true);
    // A — retry; with no campaign bound there is nothing to ask again, and the press is still the map's.
    expect(dispatchConsoleIntent(A)).to.eq(true);
    expect(posted).to.deep.eq([]);

    m.wrapper.unmount();
    expect(menuPadState.mountedCount, 'the pad goes with it').to.eq(pads);
    expect(consoleNativeState.surfaces, 'and the lock').to.eq(surfaces);
    expect(campaignMapUi.commands, 'the mirror is reset for the next host').to.deep.eq([]);
  });

  it('an unresolved carryover door opens the picker BY ITSELF, deals the hand in from the viewer\'s seat row, and the pad goes to the picker through its ref', async () => {
    seed(interlude());
    const m = mountMap({embedded: true});

    // The step opened at creation (an `immediate` watcher) — the flow's entry IS the picker.
    expect(m.picker().exists()).to.eq(true);
    expect(m.root().classes()).to.include('cmap--carry-open');
    expect(campaignMapUi.overlay).to.eq('carryover');
    expect(m.picker().props()).to.deep.include({
      eligible: [CardName.ANTS, CardName.ALGAE, CardName.BIRDS],
      selected: [],
      limit: 2,
      nextMission: 2,
      root: 'Game results',
      confirmed: false,
      submitting: false,
    });
    expect(m.picker().classes(), 'the map\'s own class falls through onto the stage').to.include('cmap__carry-overlay');
    expect(m.wrapper.find('.cmap__wait-strip').exists(), 'the strip yields to an open stage').to.eq(false);

    // THE ENTRY: one tick and one frame later the hand arrives from the viewer's own row (the map's root finds it).
    expect(dealt).to.deep.eq([]);
    await nextTick();
    expect(clock.pending(), 'the deal is one owned wait of the map\'s flow scope').to.eq(1);
    clock.advance(16);
    expect(dealt.length).to.eq(1);
    expect(dealt[0], 'the rect of `[data-cmap-seat-you]`').to.not.eq(undefined);

    // The pad is the picker's — every intent, through the ref.
    expect(await m.press(nav('right'))).to.eq(true);
    expect(await m.press(A)).to.eq(true);
    expect(await m.press(B), 'B too: the picker decides what its own B means').to.eq(true);
    expect(heard).to.deep.eq([{surface: 'picker', intent: nav('right')}, {surface: 'picker', intent: A}, {surface: 'picker', intent: B}]);
    expect(m.picker().exists()).to.eq(true);

    // The draft is the map's: a toggle in place, never past the SEAT's limit (the server's number).
    m.picker().vm.$emit('toggle', CardName.ANTS);
    m.picker().vm.$emit('toggle', CardName.BIRDS);
    await nextTick();
    expect(m.picker().props('selected')).to.deep.eq([CardName.ANTS, CardName.BIRDS]);
    expect(campaignMapUi.carryConfirmLabel).to.eq('Keep the selection');
    m.picker().vm.$emit('toggle', CardName.ALGAE);
    await nextTick();
    expect(m.picker().props('selected'), 'a third card of a limit of two is refused').to.deep.eq([CardName.ANTS, CardName.BIRDS]);
    m.picker().vm.$emit('toggle', CardName.ANTS);
    await nextTick();
    expect(m.picker().props('selected'), 'A again returns it').to.deep.eq([CardName.BIRDS]);

    // The picker's bar facts are mirrored up into the ONE command list.
    m.picker().vm.$emit('bar', {primary: 'Execute the tender', pages: 1, stage: 'sheet', primaryEnabled: false});
    await nextTick();
    expect(campaignMapUi.commands).to.deep.eq([
      {control: 'confirm', label: 'Execute the tender', enabled: false, highlight: false},
      {control: 'secondary', label: 'Inspect'},
      {control: 'back', label: 'Back'},
    ]);

    // B out of the picker (its own emit): the draft closes, the door stays — the strip names the viewer's next move.
    m.picker().vm.$emit('back');
    await nextTick();
    expect(m.picker().exists()).to.eq(false);
    expect(campaignMapUi.overlay).to.eq(undefined);
    expect(m.root().classes()).to.not.include('cmap--carry-open');
    expect(m.wrapper.find('.cmap__wait-title').text()).to.eq($t('Waiting for the crew'));
    expect(m.wrapper.find('.cmap__wait-strip').classes()).to.not.include('cmap__wait-strip--ready');
    expect(campaignMapUi.commands.find((command) => command.control === 'confirm'), 'A on the current mission re-opens the door').to.deep.eq(
      {control: 'confirm', label: 'Choose projects to carry over', enabled: true});
  });

  it('the confirm measures the kept faces BEFORE the POST, lands everyone back on the map on a yes — and Y re-opens the SAME picker as a revision, nothing dealt', async () => {
    seed(interlude());
    const m = mountMap({embedded: true});
    await nextTick();
    clock.advance(16);
    expect(dealt.length).to.eq(1);
    m.picker().vm.$emit('toggle', CardName.ANTS);
    await nextTick();

    // The server's yes: the viewer's selection is confirmed, the crew is ready, the creator may launch.
    answer = interlude({
      rev: 4,
      canLaunch: true,
      launchBlockers: [],
      carryover: {
        sourceSlot: 0,
        bySeat: [
          {seat: 0, status: 'confirmed', count: 1, limit: 2},
          {seat: 1, status: 'confirmed', count: 2, limit: 2},
        ],
        yourCards: [CardName.ANTS],
        yourEligible: [CardName.ANTS, CardName.ALGAE, CardName.BIRDS],
        yourLimit: 2,
      },
    });
    m.picker().vm.$emit('confirm');
    await flushPromises();
    expect(order, 'ARM → DETECT: the faces are read off the picker\'s ref while it still stands').to.deep.eq(['faces', 'post']);
    expect(posted.length).to.eq(1);
    expect(posted[0].body, 'the bearer is the viewer\'s seat in the SOURCE mission').to.deep.eq({playerId: 'p-you', cards: [CardName.ANTS], preludes: []});

    // ONE FLOW: no confirm modal — the stage folds, the cursor stands on the next mission, the strip states the move.
    expect(m.picker().exists()).to.eq(false);
    expect(campaignMapUi.overlay).to.eq(undefined);
    expect(m.routeCursor()).to.deep.eq([1]);
    expect(m.wrapper.find('.cmap__wait-title').text()).to.eq($t('The crew is ready'));
    expect(m.wrapper.find('.cmap__wait-strip').classes()).to.include('cmap__wait-strip--ready');
    expect(m.wrapper.find('[data-cmap-seat-carry]').text()).to.eq(translateTextWithParams('carrying ${0}', ['1']));
    expect(campaignMapUi.commands).to.deep.include({control: 'inspect', label: 'Change the carried projects'});

    // Y — the CHANGE door: the kept card already stands in its kant, so nothing is dealt a second time.
    await m.press(Y);
    expect(m.picker().exists()).to.eq(true);
    expect(m.picker().props('selected')).to.deep.eq([CardName.ANTS]);
    expect(m.picker().props('confirmed'), 'confirmed and not yet touched').to.eq(true);
    await nextTick();
    clock.advance(64);
    expect(dealt.length, 'a revision deals nothing').to.eq(1);
    m.picker().vm.$emit('toggle', CardName.ALGAE);
    await nextTick();
    expect(m.picker().props('confirmed'), 'a touched draft is no longer the confirmed one').to.eq(false);
  });

  it('a refused confirm keeps the picker standing with the server\'s word', async () => {
    seed(interlude());
    const m = mountMap({embedded: true});
    await nextTick();
    clock.advance(16);

    m.picker().vm.$emit('confirm'); // `answer` is undefined — the server says no
    await flushPromises();
    expect(order).to.deep.eq(['faces', 'post']);
    expect(m.picker().exists(), 'nothing flew, nothing closed').to.eq(true);
    expect(campaignMapUi.overlay).to.eq('carryover');
    expect(m.picker().props('error')).to.eq('Could not save the project selection. Please try again.');
    expect(m.picker().props('submitting')).to.eq(false);
  });

  it('an open tender bidding opens BY ITSELF and takes the pad through its ref; a finished bidding closes its own stage', async () => {
    tenderBiddingUi.commands = [{control: 'confirm', label: 'Take the tender'}, {control: 'back', label: 'Minimize'}];
    const bidding = {
      sourceSlot: 0,
      offer: [{instance: 't0-0', id: 'gamblePreludes' as const}, {instance: 't0-1', id: 'restructuring' as const}],
      order: [1, 0, 2],
      lots: [],
      pointer: 0,
      done: false,
      yourTurn: true,
    };
    // The viewer is seat 1 and already confirmed: the bidding is the only step the map owes them.
    const model = interlude({you: {seat: 1}, rewardMode: 'tenders', launchBlockers: ['Waiting for the tender bidding'], bidding});
    seed(model);
    const m = mountMap({embedded: true});

    expect(m.bidding().exists()).to.eq(true);
    expect(m.picker().exists(), 'one stage at a time').to.eq(false);
    expect(campaignMapUi.overlay).to.eq('bidding');
    expect(m.bidding().props()).to.deep.include({
      youSeat: 1,
      missionLabel: translateTextWithParams('Mission ${0}', ['1']),
      revealKey: biddingRevealKey('ctest', 0),
      root: 'Game results',
      embedded: true,
      submitting: false,
    });
    expect((m.bidding().props('bidding') as {offer: ReadonlyArray<unknown>}).offer.length).to.eq(2);
    expect((m.bidding().props('seats') as ReadonlyArray<unknown>).length).to.eq(3);
    expect(m.bidding().classes()).to.include('cmap__bidding-overlay');
    // The scene's OWN verbs, mirrored whole — its root B reads «Close» here (the map's overlay is what it closes).
    expect(campaignMapUi.commands).to.deep.eq([
      {control: 'confirm', label: 'Take the tender'},
      {control: 'back', label: 'Close', priority: 5},
    ]);
    // The seats' rail speaks tenders in this mode.
    expect(m.wrapper.find('[data-cmap-rail-note="tenders"]').exists()).to.eq(true);
    expect(m.wrapper.findAll('[data-cmap-seat-tenders]').length).to.eq(3);

    expect(await m.press(A)).to.eq(true);
    expect(await m.press(nav('left'))).to.eq(true);
    expect(heard).to.deep.eq([{surface: 'bidding', intent: A}, {surface: 'bidding', intent: nav('left')}]);

    // The table closes: the stage goes by itself — nobody pressed anything.
    campaignState.model = {...model, rev: 4, bidding: {...bidding, done: true}};
    await nextTick();
    expect(m.bidding().exists()).to.eq(false);
    expect(campaignMapUi.overlay).to.eq(undefined);
    expect(await m.press(nav('down')), 'the pad is the map\'s again').to.eq(true);
    expect(heard.length).to.eq(2);
    expect(m.railCursor()).to.deep.eq([0]);
  });
});
