/*
 * ConsoleEndgameWorkspace — the FINAL SCORING workspace of the console. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). A large surface: the ceremony's choreography is the director's own spec
 * (`consoleEndgameDirector.spec.ts`) and its look is the e2e's (`console-endgame*`); this spec pins what belongs to
 * the COMPONENT and what a conversion can break with no type error:
 *  · it mounts on the SETTLED state of a reload into an ended game with no Vue warning (`globalConfig` throws on
 *    one) — the template starts with its root, the podium stands ranked, the totals are written straight into the
 *    unbound number nodes (through the root's template ref), the action list is up and the immediate watcher has
 *    published the bar's contract;
 *  · what the SHELL reaches through the surface registry's ref: `expandFromBoard` and `handleIntent` — nothing else;
 *  · the pad over the action list and down into the overview scene (its own `ref="overview"`), «Свернуть» and the
 *    road back, and a LIVE ceremony driven through the component's hooks to its end.
 * Mounted the way the shell mounts it: under a host that holds a ref on it. The children are stubbed by name (each
 * is its own spec's subject). The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {gsap} from 'gsap';
import {globalConfig} from '../getLocalVue';
import {Color} from '@/common/Color';
import {ViewModel} from '@/common/models/PlayerModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {EndgameModel} from '@/client/components/endgame/endgameModel';
import {ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {consoleEndgameUi, noteConsoleEndgameLivePhase, resetConsoleEndgame} from '@/client/console/endgame/consoleEndgameState';
import {consoleOverviewUi} from '@/client/console/endgame/consoleOverviewState';
import {clearPanelCommands, consolePanelUi} from '@/client/console/consolePanelUi';
import {resetRematchState} from '@/client/components/rematch/rematchState';
import ConsoleEndgameWorkspace from '@/client/components/console/ConsoleEndgameWorkspace.vue';

/** What the shell reads through the registry's ref — the workspace's whole contract with its parent. */
type WorkspaceReach = {expandFromBoard(): void, handleIntent(intent: GamepadIntent): void};

/** What the overview scene was handed through the workspace's own `ref="overview"`, in order. */
const overviewAsked: Array<GamepadIntent> = [];

// (Render functions, not template strings: the runtime compiler is not in this build.)
const OverviewStub = defineComponent({
  name: 'ConsoleEndgameOverview',
  props: {
    playerView: {type: Object as PropType<ViewModel>, required: true},
    model: {type: Object as PropType<EndgameModel>, required: true},
    egVm: {type: Object as PropType<ConsoleEndgameVm>, required: true},
  },
  methods: {
    handleIntent(intent: GamepadIntent): void {
      overviewAsked.push(intent);
    },
  },
  render() {
    return h('i', {'class': 'overview-stub', 'data-generation': String(this.egVm.generation)});
  },
});

const stubs = {
  ConsoleEndgameOverview: OverviewStub,
  ConsoleScoreDisc: true,
  ConsoleVpBadge: true,
  ConsoleCardFaceLite: true,
  MarsBotCorpFace: true,
  ConsoleCampaignMap: true,
  ConsoleTenderBidding: true,
  ConsoleTenderCard: true,
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

function seat(color: Color, name: string, terraformRating: number) {
  return {
    color,
    name,
    tableau: [],
    tags: {},
    megacredits: 0,
    steel: 0,
    titanium: 0,
    plants: 0,
    energy: 0,
    heat: 0,
    megacreditProduction: 0,
    steelProduction: 0,
    titaniumProduction: 0,
    plantProduction: 0,
    energyProduction: 0,
    heatProduction: 0,
    victoryPointsBreakdown: breakdown(terraformRating),
    victoryPointsByGeneration: [],
    globalParameterSteps: {},
  };
}

/**
 * A finished two-seat game in generation 10 — Ben sits first, Ada wins 31 : 24 (so the ranked podium is NOT the
 * seating order). No id: the facts fetch is not fired in a unit mount. No campaign, no bot, no corporations (a
 * corpless seat shows its prepared place).
 */
function endedView(): ViewModel {
  return {
    id: undefined,
    game: {gameOptions: {expansions: {}}, generation: 10, colonies: []},
    players: [seat('blue', 'Ben', 24), seat('red', 'Ada', 31)],
  } as unknown as ViewModel;
}

/** A long beat of the MOTION clock (GSAP's — the pill's commit and the director's timeline ride it). */
function passMotionBeat(seconds: number = 5): void {
  gsap.globalTimeline.time(gsap.globalTimeline.time() + seconds);
}

describe('ConsoleEndgameWorkspace — the final scoring workspace', () => {
  /** Takes the mounted workspace down (its flow scope and its ceremony end with it). */
  let unmountWorkspace: (() => void) | undefined;

  function mountUnderHost() {
    const playerView = endedView();
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleEndgameWorkspace, {ref: 'endgameWs', playerView})]),
    });
    const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs}});
    unmountWorkspace = () => wrapper.unmount();
    return {
      wrapper,
      playerView,
      /** The shell's read: the surface standing under its ref. */
      reach: () => (wrapper.vm.$refs.endgameWs ?? undefined) as WorkspaceReach | undefined,
      rows: () => wrapper.findAll('[data-eg-row]').map((r) => r.attributes('data-eg-row')),
      total: (color: Color) => wrapper.find(`[data-eg-total="${color}"]`).text(),
      actionLabels: () => wrapper.findAll('.con-eg__action-label').map((a) => a.text()),
      bar: () => consolePanelUi.commands.map((c) => c.label),
    };
  }

  beforeEach(() => {
    overviewAsked.length = 0;
    resetConsoleEndgame();
    resetRematchState();
    clearPanelCommands('endgame');
  });
  afterEach(() => {
    // The workspace's unmount takes its ceremony and its commands back — let it, THEN wipe the modules' memory.
    unmountWorkspace?.();
    unmountWorkspace = undefined;
    resetConsoleEndgame();
    resetRematchState();
    clearPanelCommands('endgame');
  });

  it('lands SETTLED on a reload into an ended game: the root first, the podium ranked, the totals in the unbound numbers, the actions and the bar', async () => {
    const {wrapper, rows, total, actionLabels} = mountUnderHost();
    await nextTick();

    const scene = wrapper.find('div.con-endgame');
    expect(scene.exists()).to.eq(true);
    expect(scene.element, 'the template starts with its root — no comment node before it').to.eq((wrapper.element as Element).childNodes[0]);
    expect(scene.attributes('aria-label')).to.eq('Final scoring');
    expect(scene.classes()).to.include('con-endgame--actions');
    expect(scene.classes()).to.not.include('con-endgame--ovopen');
    expect(consoleEndgameUi.phase, 'arriving never replays the count').to.eq('actions');
    expect(consoleEndgameUi.ceremonyPlayed).to.eq(true);

    expect(scene.find('.con-eg__kicker').text()).to.contain('Game results');
    expect(scene.find('.con-eg__meta').text()).to.eq('Generation 10');
    expect(scene.find('.con-eg').classes()).to.include('con-eg--n2');

    expect(rows(), 'the settled podium stands in RANKED order — the winner first').to.deep.eq(['red', 'blue']);
    expect(wrapper.findAll('.con-eg__name').map((n) => n.text())).to.deep.eq(['Ada', 'Ben']);
    expect(wrapper.findAll('.con-eg__place-num').map((n) => n.text())).to.deep.eq(['1', '2']);
    expect(wrapper.find('[data-eg-row="red"]').classes()).to.include('con-eg__row--winner');
    expect(wrapper.find('[data-eg-row="blue"]').classes()).to.include('con-eg__row--rest');
    expect(wrapper.findAll('.con-eg__ribbon').map((r) => r.text())).to.deep.eq(['Winner']);
    expect(wrapper.findAll('[data-eg-face]').map((f) => f.attributes('data-eg-face')), 'a corpless seat shows its prepared place').to.deep.eq(['none', 'none']);

    // The count-up sink: no binding on the number — the component writes textContent itself.
    expect(total('red')).to.eq('31');
    expect(total('blue')).to.eq('24');

    expect(actionLabels()).to.deep.eq(['Game overview', 'Replay scoring', 'To main menu']);
    expect(wrapper.findAll('.con-eg__action--focused').map((a) => a.find('.con-eg__action-label').text())).to.deep.eq(['Game overview']);
    expect(wrapper.find('.overview-stub').exists(), 'the overview scene is mounted only while it lives').to.eq(false);

    expect(consolePanelUi.owner, 'the immediate watcher published the bar\'s contract').to.eq('endgame');
    expect(consolePanelUi.commands).to.deep.eq([
      {control: 'dpad', label: 'Select'},
      {control: 'confirm', label: 'Confirm'},
      {control: 'back', label: 'Minimize'},
    ]);
  });

  it('the SHELL\'s ref sees exactly `expandFromBoard` and `handleIntent` — the pad walks the action list, A descends into the overview, which then owns the pad', async () => {
    const {wrapper, reach, bar} = mountUnderHost();
    await nextTick();
    const ws = reach();
    expect(ws, 'the registry\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(ws!), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['expandFromBoard', 'handleIntent']);
    for (const inner of ['collapseToBoard', 'startCeremony', 'skipCeremony', 'teardown', 'actions', 'ui', 'vm', 'handle', 'flow', 'props']) {
      expect((ws as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    // The d-pad walks the ring of post-game verbs (down / right = next, up / left = previous) — and wraps.
    ws!.handleIntent({kind: 'nav', dir: 'down', repeat: false});
    expect(consoleEndgameUi.actionsFocus).to.eq(1);
    ws!.handleIntent({kind: 'nav', dir: 'up', repeat: false});
    ws!.handleIntent({kind: 'nav', dir: 'left', repeat: false});
    expect(consoleEndgameUi.actionsFocus, 'the ring wraps').to.eq(2);
    ws!.handleIntent({kind: 'nav', dir: 'right', repeat: false});
    expect(consoleEndgameUi.actionsFocus).to.eq(0);
    ws!.handleIntent({kind: 'release', button: 'confirm'});
    expect(consoleOverviewUi.phase, 'a release is nobody\'s').to.eq('closed');

    // A on «Game overview»: the pill's short commit, THEN the scene descends.
    ws!.handleIntent({kind: 'press', button: 'confirm'});
    await nextTick();
    expect(wrapper.find('.con-eg__action--committed .con-eg__action-label').text()).to.eq('Game overview');
    expect(consoleOverviewUi.phase, 'the commit beat comes first').to.eq('closed');
    passMotionBeat();
    await nextTick();
    expect(consoleOverviewUi.phase).to.eq('entering');
    expect(wrapper.find('.con-eg__action--committed').exists()).to.eq(false);
    expect(wrapper.find('.con-endgame').classes(), 'the scoring stage parks under the scene').to.include('con-endgame--ovopen');
    const overview = wrapper.findComponent(OverviewStub);
    expect(overview.exists()).to.eq(true);
    expect(overview.props('egVm').rankedColors, 'the scene is handed the workspace\'s own VM').to.deep.eq(['red', 'blue']);
    expect(overview.props('model').generation).to.eq(10);
    expect(bar(), 'the bar speaks the overview level\'s verbs').to.deep.eq(['Tab', 'Select', 'Game results']);

    // The scene under the workspace's own ref owns the pad while it stands — the action list behind it does not move.
    const down: GamepadIntent = {kind: 'nav', dir: 'down', repeat: false};
    const confirm: GamepadIntent = {kind: 'press', button: 'confirm'};
    ws!.handleIntent(down);
    ws!.handleIntent(confirm);
    expect(overviewAsked).to.deep.eq([down, confirm]);
    expect(consoleEndgameUi.actionsFocus).to.eq(0);
    expect(consoleEndgameUi.collapsed).to.eq(false);
  });

  it('B at the settled root collapses the scene to the board — the bar goes quiet, a hidden scene eats no press — and `expandFromBoard` is the road back', async () => {
    const {reach, bar} = mountUnderHost();
    await nextTick();
    const ws = reach()!;

    ws.handleIntent({kind: 'press', button: 'back'});
    expect(consoleEndgameUi.collapsed).to.eq(true);
    await nextTick();
    expect(consolePanelUi.owner).to.eq('endgame');
    expect(bar(), 'the board is on show — the free roam\'s surfaces publish their own verbs').to.deep.eq([]);

    ws.handleIntent({kind: 'nav', dir: 'down', repeat: false});
    ws.handleIntent({kind: 'press', button: 'confirm'});
    expect(consoleEndgameUi.actionsFocus, 'collapsed, the workspace takes nothing').to.eq(0);
    expect(consoleOverviewUi.phase).to.eq('closed');

    ws.expandFromBoard();
    expect(consoleEndgameUi.collapsed).to.eq(false);
    await nextTick();
    expect(bar()).to.deep.eq(['Select', 'Confirm', 'Minimize']);
  });

  it('a game that ENDED in front of the player plays the ceremony through the component\'s hooks: X hurries the count, the totals tick in the DOM, the podium ranks', async () => {
    noteConsoleEndgameLivePhase();
    const {wrapper, reach, rows, total, actionLabels} = mountUnderHost();
    await nextTick();
    const ws = reach()!;

    expect(consoleEndgameUi.ceremonyPlayed, 'the count started').to.eq(true);
    expect(consoleEndgameUi.phase).to.not.eq('actions');
    expect(rows(), 'while the count runs the seats stand in the seating order').to.deep.eq(['blue', 'red']);
    expect(total('red'), 'the director\'s first write went through the sink').to.eq('0');
    expect(actionLabels(), 'no action list before the count is told').to.deep.eq([]);
    expect(consolePanelUi.commands, 'B parks the count, X hurries it').to.deep.eq([
      {control: 'back', label: 'Minimize'},
      {control: 'secondary', label: 'Hurry the count', priority: 0},
    ]);

    // A is nobody's while the count runs (it is not a dialog); X hurries it — once.
    ws.handleIntent({kind: 'press', button: 'confirm'});
    expect(consoleEndgameUi.hurry).to.eq('off');
    ws.handleIntent({kind: 'press', button: 'secondary'});
    expect(consoleEndgameUi.hurry).to.eq('on');
    await nextTick();
    expect(consolePanelUi.commands, 'once hurried the bar offers B alone').to.deep.eq([{control: 'back', label: 'Minimize'}]);

    // The motion clock runs the director's timeline to its end; the component's hooks do the DOM half.
    for (let i = 0; i < 60 && consoleEndgameUi.phase !== 'actions'; i++) {
      passMotionBeat(2);
      await nextTick();
    }
    await nextTick();
    expect(consoleEndgameUi.phase, 'the ceremony reached its settled end').to.eq('actions');
    expect(rows(), 'the ranking flipped the seats into order').to.deep.eq(['red', 'blue']);
    expect(total('red')).to.eq('31');
    expect(total('blue')).to.eq('24');
    expect(wrapper.findAll('.con-eg__ribbon').map((r) => r.text())).to.deep.eq(['Winner']);
    expect(actionLabels()).to.deep.eq(['Game overview', 'Replay scoring', 'To main menu']);
    expect(wrapper.find('[data-eg-beam]').attributes('data-eg-beam'), 'no light is left standing over the settled podium').to.eq('');
  });

  it('gives the bar back when it is unmounted — also in the middle of a count', async () => {
    noteConsoleEndgameLivePhase();
    const {wrapper, reach} = mountUnderHost();
    await nextTick();
    expect(consolePanelUi.owner).to.eq('endgame');
    reach()!.handleIntent({kind: 'press', button: 'back'});
    expect(consoleEndgameUi.collapsed, 'B parks a running count').to.eq(true);

    wrapper.unmount();
    unmountWorkspace = undefined;
    expect(consolePanelUi.owner).to.eq(undefined);
    expect(consolePanelUi.commands).to.deep.eq([]);
    // The director went with the workspace: the motion clock moves nothing any more.
    const phase = consoleEndgameUi.phase;
    passMotionBeat(120);
    expect(consoleEndgameUi.phase).to.eq(phase);
  });
});
