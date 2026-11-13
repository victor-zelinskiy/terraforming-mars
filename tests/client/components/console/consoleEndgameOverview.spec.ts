/*
 * ConsoleEndgameOverview — «ОБЗОР ПАРТИИ», the analytics scene of the endgame workspace. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): what it renders for its props over the overview's module state (the head,
 * the tab rail, ONE pane), the pane-swap machine its bumpers drive (out → swap → in, on the motion clock), the
 * «A Подробнее» honesty it writes into the module — and what `ConsoleEndgameWorkspace` reaches through its
 * `ref="overview"`: `handleIntent`, and nothing else. Mounted the way the workspace mounts it: under a host that
 * holds a string ref on it (the workspace reads it through `useTemplateRef('overview')` — whoever holds the ref sees
 * the same exposed object). The six panes are stubbed by name (each is its own spec's subject); a stub answers the
 * PANE API (`nav` / `primary`) the scene forwards the pad to. The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {gsap} from 'gsap';
import {globalConfig} from '../getLocalVue';
import {Color} from '@/common/Color';
import {ViewModel} from '@/common/models/PlayerModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {buildEndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {buildConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {buildConsoleOverviewVm, consoleOverviewExtrasFromView, ConsoleOverviewVm} from '@/client/console/endgame/consoleOverviewModel';
import {consoleOverviewUi, openEndgameOverview, resetConsoleOverview} from '@/client/console/endgame/consoleOverviewState';
import ConsoleEndgameOverview from '@/client/components/console/ConsoleEndgameOverview.vue';

/** What the workspace reads through its ref — the scene's whole contract with its parent. */
type OverviewReach = {handleIntent(intent: GamepadIntent): void};

/** What the standing pane was asked, in order (`<pane>:nav:<dir>` / `<pane>:primary`). */
const asked: Array<string> = [];

// (Render functions, not template strings: the runtime compiler is not in this build.)
function paneStub(name: string, key: string) {
  return defineComponent({
    name,
    props: {
      vm: {type: Object as PropType<ConsoleOverviewVm>, required: true},
      reveal: {type: Boolean, default: false},
      playerView: {type: Object as PropType<ViewModel>, default: undefined},
    },
    methods: {
      nav(dir: NavDirection): void {
        asked.push(key + ':nav:' + dir);
      },
      primary(): void {
        asked.push(key + ':primary');
      },
    },
    render() {
      return h('i', {'class': 'pane-stub', 'data-pane': key, 'data-reveal': String(this.reveal), 'data-generation': String(this.vm.generation)});
    },
  });
}

const DigestStub = paneStub('ConsoleOvTabDigest', 'digest');
const ScoreStub = paneStub('ConsoleOvTabScore', 'score');
const TimelineStub = paneStub('ConsoleOvTabTimeline', 'timeline');
const CardsStub = paneStub('ConsoleOvTabCards', 'cards');
const ParamsStub = paneStub('ConsoleOvTabParams', 'parameters');
const PlayersStub = paneStub('ConsoleOvTabPlayers', 'players');

const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: {type: String, required: true}},
  render() {
    return h('i', {'class': 'glyph-stub', 'data-control': this.control});
  },
});

const stubs = {
  GamepadGlyph: GlyphStub,
  ConsoleOvTabDigest: DigestStub,
  ConsoleOvTabScore: ScoreStub,
  ConsoleOvTabTimeline: TimelineStub,
  ConsoleOvTabCards: CardsStub,
  ConsoleOvTabParams: ParamsStub,
  ConsoleOvTabPlayers: PlayersStub,
};

function breakdown(terraformRating: number): VictoryPointsBreakdown {
  return {
    terraformRating,
    terraformRatingBreakdown: {base: terraformRating, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
    milestones: 0,
    awards: 0,
    greenery: 0,
    city: 0,
    escapeVelocity: 0,
    moonHabitats: 0,
    moonMines: 0,
    moonRoads: 0,
    planetaryTracks: 0,
    deltaProject: 0,
    victoryPoints: 0,
    total: terraformRating,
    detailsCards: [],
    detailsMilestones: [],
    detailsAwards: [],
    detailsPlanetaryTracks: [],
    negativeVP: 0,
  };
}

function seat(color: Color, name: string, terraformRating: number): EndgamePlayerInput {
  return {color, name, corporations: [], megacredits: 0, breakdown: breakdown(terraformRating), vpByGeneration: [], globalSteps: {}};
}

/** A finished two-seat game: Ada wins 31 : 24 in generation 10. */
function sceneProps() {
  const inputs = [seat('red', 'Ada', 31), seat('blue', 'Ben', 24)];
  const model = buildEndgameModel(inputs, {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 10});
  const egVm = buildConsoleEndgameVm(model, inputs.map((p) => p.color), {botColors: []});
  const playerView = {
    game: {gameOptions: {expansions: {}}, globalsPerGeneration: []},
    players: [],
  } as unknown as ViewModel;
  return {model, egVm, playerView, vm: buildConsoleOverviewVm(model, egVm, consoleOverviewExtrasFromView(playerView))};
}

/**
 * A long beat of the MOTION clock (GSAP's — `motionAfter` / `motionGuarantee` ride it): five seconds, past every beat
 * of the pane swap (130 ms out, 230 ms in) and the reveal mark (900 ms) at any motion scale a suite could leave set.
 */
function passMotionBeat(): void {
  gsap.globalTimeline.time(gsap.globalTimeline.time() + 5);
}

describe('ConsoleEndgameOverview — the analytics scene of the endgame', () => {
  /** Takes the mounted scene down (its flow scope ends with it). */
  let unmountScene: (() => void) | undefined;

  function mountUnderHost() {
    const {model, egVm, playerView, vm} = sceneProps();
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleEndgameOverview, {ref: 'overview', playerView, model, egVm})]),
    });
    const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs}});
    unmountScene = () => wrapper.unmount();
    return {
      wrapper,
      vm,
      playerView,
      /** The workspace's read — `overview.value` of its `useTemplateRef('overview')` — taken here off the host's `$refs`. */
      reach: () => (wrapper.vm.$refs.overview ?? undefined) as OverviewReach | undefined,
      panes: () => wrapper.findAll('.pane-stub').map((p) => p.attributes('data-pane')),
    };
  }

  beforeEach(() => {
    asked.length = 0;
    resetConsoleOverview();
  });
  afterEach(() => {
    // The scene's scope releases its owed marks when it ends — let it, THEN wipe the module's memory.
    unmountScene?.();
    unmountScene = undefined;
    resetConsoleOverview();
  });

  it('renders the head, the six tabs of the ring with the active one marked, and ONE pane handed the overview\'s model', () => {
    const {wrapper, vm, panes} = mountUnderHost();
    const scene = wrapper.find('div.con-egov');
    expect(scene.exists()).to.eq(true);
    expect(scene.element, 'the template starts with its root — no comment node before it').to.eq((wrapper.element as Element).children[0]);
    expect(scene.find('.con-egov__kicker').text()).to.contain('Game overview');
    expect(scene.find('.con-egov__meta > span').text()).to.eq('Generation 10');
    expect(vm.winner, 'the fixture has a winner').to.deep.eq({color: 'red', name: 'Ada', total: 31});
    const win = scene.find('.con-egov__meta-win');
    expect(win.text()).to.eq('Ada · 31 VP');
    expect(win.find('.con-egov-legend__dot').classes()).to.include('player_bg_color_red');

    const rail = scene.find('nav.con-egov__tabs');
    expect(rail.attributes('aria-label')).to.eq('Game overview');
    expect(rail.findAll('.con-egov__tab').map((t) => t.text())).to.deep.eq(['Overview', 'Score', 'Chronology', 'Cards', 'Parameters', 'Players']);
    expect(rail.findAll('.con-egov__tab--active').map((t) => t.text())).to.deep.eq(['Overview']);
    expect(rail.findAll('.con-egov__tab-glyph > .glyph-stub').map((g) => g.attributes('data-control'))).to.deep.eq(['bumperL', 'bumperR']);

    expect(panes(), 'one pane in the viewport — the landing tab').to.deep.eq(['digest']);
    expect(wrapper.findComponent(DigestStub).props('vm')).to.deep.eq(vm);
    expect(scene.find('.con-egov__viewport').classes()).to.deep.eq(['con-egov__viewport', 'con-egov__viewport--dir-r']);
  });

  it('follows the module state: the scene\'s phase classes, the tab the ring stands on, and what each pane is handed', async () => {
    consoleOverviewUi.tab = 'timeline';
    const {wrapper, playerView, panes} = mountUnderHost();
    const scene = wrapper.find('.con-egov');
    expect(scene.classes()).to.not.include('con-egov--entering');
    expect(panes()).to.deep.eq(['timeline']);
    expect(wrapper.findComponent(TimelineStub).props('reveal'), 'a chart nobody saw yet draws its line').to.eq(true);

    openEndgameOverview();
    await nextTick();
    expect(scene.classes()).to.include('con-egov--entering');

    consoleOverviewUi.revealed = {timeline: true};
    await nextTick();
    expect(wrapper.findComponent(TimelineStub).props('reveal'), 'a chart already drawn lands settled').to.eq(false);

    consoleOverviewUi.tab = 'cards';
    await nextTick();
    expect(panes()).to.deep.eq(['cards']);
    expect(wrapper.findComponent(CardsStub).props('playerView')).to.deep.eq(playerView);
    expect(wrapper.findAll('.con-egov__tab--active').map((t) => t.text())).to.deep.eq(['Cards']);

    consoleOverviewUi.tab = 'players';
    await nextTick();
    expect(panes(), 'the ring\'s last tab is the chain\'s `v-else`').to.deep.eq(['players']);
  });

  it('a PARENT\'s ref sees exactly `handleIntent` — the pad goes to the standing pane, B folds one level', async () => {
    openEndgameOverview();
    const {reach} = mountUnderHost();
    const scene = reach();
    expect(scene, 'the workspace\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(scene!), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['handleIntent']);
    for (const inner of ['switchTab', 'beginPaneOut', 'completePaneSwap', 'markRevealedSoon', 'pane', 'ui', 'ovVm', 'flow', 'props']) {
      expect((scene as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    scene!.handleIntent({kind: 'nav', dir: 'down', repeat: false});
    scene!.handleIntent({kind: 'press', button: 'confirm'});
    scene!.handleIntent({kind: 'release', button: 'confirm'});
    expect(asked, 'a release is nobody\'s').to.deep.eq(['digest:nav:down', 'digest:primary']);

    // The pane the ref names is the one that STANDS: after the tab moved, the pad goes to the new one.
    consoleOverviewUi.tab = 'score';
    await nextTick();
    scene!.handleIntent({kind: 'nav', dir: 'left', repeat: false});
    expect(asked[asked.length - 1]).to.eq('score:nav:left');

    // B: a nested detail first, then the scene itself.
    consoleOverviewUi.detail = {kind: 'score-category', catKey: 'tr'};
    scene!.handleIntent({kind: 'press', button: 'back'});
    expect(consoleOverviewUi.detail).to.eq(undefined);
    expect(consoleOverviewUi.phase, 'the scene still stands').to.eq('entering');
    scene!.handleIntent({kind: 'press', button: 'back'});
    expect(consoleOverviewUi.phase, 'B at the root folds the overview').to.eq('leaving');
  });

  it('LB / RB run the pane-swap machine: out → swap → in → idle, a press mid-swap only retargets the pending tab', async () => {
    const {wrapper, reach, panes} = mountUnderHost();
    const viewport = wrapper.find('.con-egov__viewport');

    reach()!.handleIntent({kind: 'press', button: 'bumperR'});
    expect(consoleOverviewUi.paneStage).to.eq('out');
    expect(consoleOverviewUi.pendingTab).to.eq('score');
    expect(consoleOverviewUi.tab, 'the tab swaps only once the pane has left').to.eq('digest');
    reach()!.handleIntent({kind: 'press', button: 'bumperR'});
    expect(consoleOverviewUi.pendingTab, 'a second press retargets — nothing queues').to.eq('timeline');
    expect(consoleOverviewUi.paneStage).to.eq('out');
    await nextTick();
    expect(viewport.classes()).to.include('con-egov__viewport--out');
    expect(viewport.classes()).to.include('con-egov__viewport--dir-r');
    expect(panes()).to.deep.eq(['digest']);

    passMotionBeat();
    await nextTick();
    expect(consoleOverviewUi.tab).to.eq('timeline');
    expect(consoleOverviewUi.pendingTab).to.eq(undefined);
    expect(consoleOverviewUi.paneStage).to.eq('in');
    expect(viewport.classes()).to.include('con-egov__viewport--in');
    expect(panes()).to.deep.eq(['timeline']);

    passMotionBeat();
    await nextTick();
    expect(consoleOverviewUi.paneStage).to.eq('idle');
    expect(viewport.classes()).to.not.include('con-egov__viewport--in');

    // The landed tab's charts count as revealed a beat later (the module's memory).
    expect(consoleOverviewUi.revealed.timeline).to.not.eq(true);
    passMotionBeat();
    expect(consoleOverviewUi.revealed.timeline).to.eq(true);

    // LB walks the ring the other way — and wraps.
    reach()!.handleIntent({kind: 'press', button: 'bumperL'});
    expect(consoleOverviewUi.tabDir).to.eq(-1);
    expect(consoleOverviewUi.pendingTab).to.eq('score');
    await nextTick();
    expect(viewport.classes()).to.include('con-egov__viewport--dir-l');
  });

  it('writes «A Подробнее» into the module at mount and on every change of what the focus stands on', async () => {
    consoleOverviewUi.tab = 'score';
    consoleOverviewUi.primaryAvailable = false;
    const {vm} = mountUnderHost();
    expect(vm.score.categories.length, 'the fixture scores something').to.be.greaterThan(0);
    expect(consoleOverviewUi.primaryAvailable, 'written by the immediate watcher — a category to open').to.eq(true);

    consoleOverviewUi.detail = {kind: 'score-category', catKey: 'tr'};
    await nextTick();
    expect(consoleOverviewUi.primaryAvailable, 'a detail is already open').to.eq(false);

    consoleOverviewUi.detail = undefined;
    consoleOverviewUi.tab = 'digest';
    await nextTick();
    expect(consoleOverviewUi.primaryAvailable, 'the landing tab has nothing to open').to.eq(false);

    consoleOverviewUi.tab = 'timeline';
    await nextTick();
    expect(consoleOverviewUi.primaryAvailable).to.eq(vm.timeline.gens >= 2);
  });
});
