/*
 * ConsoleCampaignOverview — the Information workspace's «Кампания» route: the whole campaign inside the live mission,
 * read-only. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). Its pad arrives through ONE
 * exposed member — `handleIntent`, which `ConsoleInfoMode` calls through its `campaignView` ref — so every mount here
 * stands under a parent that holds the same ref and sees ONLY what the overview exposes.
 *
 * The cursors and the command contract live in the module `campaignOverviewUi` (the Information host publishes
 * `barCommands` verbatim) and the campaign itself in `campaignState` — both are bundle-shared module state, restored
 * after every test.
 *
 * The mission card, the mission inspect and the seat legacy are their own specs' subjects — stubbed, this spec reads
 * what each is HANDED.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {BoardName} from '@/common/boards/BoardName';
import {Color} from '@/common/Color';
import {CampaignGameContract} from '@/common/campaign/CampaignGameContract';
import {CampaignMissionModel, CampaignModel} from '@/common/campaign/CampaignModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {campaignState} from '@/client/console/campaign/campaignState';
import {campaignOverviewUi} from '@/client/console/campaign/campaignOverviewUi';
import {OverviewMissionCard, SeatLegacyVm} from '@/client/console/campaign/campaignOverviewModel';
import ConsoleCampaignOverview from '@/client/components/console/campaign/ConsoleCampaignOverview.vue';

// (Render functions, not template strings: the runtime compiler is not in this build.)
const MissionCardStub = defineComponent({
  name: 'CampaignMissionCard',
  props: {
    mission: {type: Object as PropType<OverviewMissionCard>, required: true},
    cursor: {type: Boolean, default: false},
    reveal: {type: Boolean, default: false},
    revealDelayMs: {type: Number, default: 0},
  },
  render: () => h('i', {class: 'mission-card-stub'}),
});
const InspectStub = defineComponent({
  name: 'CampaignMissionInspect',
  props: {
    mission: {type: Object as PropType<OverviewMissionCard>, required: true},
    details: {type: Object, default: undefined},
    youSeat: {type: Number, default: undefined},
    botCorporation: {type: String, default: undefined},
    liveGeneration: {type: Number, default: undefined},
    party: {type: Array as PropType<ReadonlyArray<{color: string, name: string}>>, default: () => []},
    missionCount: {type: Number, default: 4},
  },
  render: () => h('i', {class: 'inspect-stub'}),
});
const LegacyStub = defineComponent({
  name: 'CampaignSeatLegacy',
  props: {
    legacy: {type: Object as PropType<SeatLegacyVm>, required: true},
    carriedModels: {type: Array, default: undefined},
    cursorIndex: {type: Number, default: undefined},
  },
  render: () => h('i', {class: 'legacy-stub'}),
});

const STUBS = {CampaignMissionCard: MissionCardStub, CampaignMissionInspect: InspectStub, CampaignSeatLegacy: LegacyStub};

const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};

function mission(slot: number, board: BoardName, state: CampaignMissionModel['state']): CampaignMissionModel {
  return {slot, board, final: slot === 3, state, modifiers: []};
}

/** A campaign in its second mission: mission 1 behind, mission 2 live, three seats (the viewer is seat 0). */
function campaign(overrides: Partial<CampaignModel> = {}): CampaignModel {
  return {
    id: 'ctest',
    rev: 3,
    name: 'Test Campaign',
    createdTimeMs: 0,
    phase: 'missionActive',
    pointer: 1,
    missionCount: 4,
    seats: [
      {seat: 0, kind: 'human', name: 'Alice', color: 'blue', trBoost: 0},
      {seat: 1, kind: 'human', name: 'Bruno', color: 'red', trBoost: 0},
      {seat: 2, kind: 'bot', name: 'MarsBot', color: 'green', trBoost: 0, botDifficulty: 'hard'},
    ],
    you: {seat: 0},
    canLaunch: false,
    launchBlockers: [],
    missions: [
      mission(0, BoardName.THARSIS, 'committed'),
      mission(1, BoardName.HELLAS, 'active'),
      mission(2, BoardName.ELYSIUM, 'locked'),
      mission(3, BoardName.UTOPIA_PLANITIA, 'locked'),
    ],
    progression: {lineages: {}, titles: [], titlePoints: {0: 0, 1: 0, 2: 0}, pendingBonuses: {}},
    ...overrides,
  };
}

/** The live mission's view as the Information host hands it: only what the overview reads of it. */
function playerView(contract?: Partial<CampaignGameContract>, generation = 6): PlayerViewModel {
  return {
    game: {gameOptions: {campaign: contract}, generation},
    players: [],
    campaignCarriedCards: undefined,
    campaignBonusGranted: undefined,
  } as unknown as PlayerViewModel;
}

/** What a parent's ref to the overview carries. */
type OverviewReach = {handleIntent(intent: GamepadIntent): boolean};

/** The overview under a PARENT that holds a ref to it — what the Information workspace's «Кампания» branch does. */
function overview(view: PlayerViewModel = playerView(), viewedColor: Color = 'red') {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleCampaignOverview, {ref: 'overview', playerView: view, viewedColor})]),
  });
  const wrapper = mount(Host, {global: {...globalConfig.global, stubs: STUBS}});
  const reach = () => wrapper.vm.$refs.overview as OverviewReach;
  const cursors = () => wrapper.findAllComponents(MissionCardStub).map((card) => card.props('cursor'));
  return {wrapper, reach, cursors};
}

describe('ConsoleCampaignOverview — the campaign inside the live mission', () => {
  let savedModel: CampaignModel | undefined;
  let savedUi: typeof campaignOverviewUi;

  beforeEach(() => {
    savedModel = campaignState.model;
    savedUi = {...campaignOverviewUi};
  });

  afterEach(() => {
    campaignState.model = savedModel;
    Object.assign(campaignOverviewUi, savedUi);
  });

  it('no campaign document yet: the loading line stands, the bar offers only the way back and the pad is NOT consumed', () => {
    campaignState.model = undefined;
    const {wrapper, reach} = overview();
    expect(wrapper.find('.con-cmpov__load').exists()).is.true;
    expect(wrapper.find('.con-cmpov__base').exists()).is.false;
    expect(campaignOverviewUi.barCommands).to.deep.eq([{control: 'back', label: 'To overview'}]);
    expect(reach().handleIntent(A), 'the host keeps the press').is.false;
    expect(reach().handleIntent(nav('right'))).is.false;
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else', () => {
    campaignState.model = campaign();
    const {reach} = overview();
    expect(reach(), 'the parent\'s ref is set').to.not.eq(null);
    expect(Object.keys(reach()), 'exactly what the overview exposes').to.deep.eq(['handleIntent']);
    const leaked = ['ui', 'state', 'vm', 'layerOrigin', 'footCommands', 'openLegacy', 'openMissionInspect', 'closeLayer', 'navigateBase']
      .filter((key) => (reach() as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('the base layer: the route with its cursor on the current mission, the participants on one grid; the bar\'s verb follows the cursor', async () => {
    campaignState.model = campaign();
    const {wrapper, reach, cursors} = overview();
    await nextTick();
    expect(wrapper.find('.con-cmpov').classes()).to.not.include('con-cmpov--layered');
    expect(wrapper.find('.con-cmpov__name').text()).to.eq('Test Campaign');
    // A mount IS the entry: the cursor stands on the campaign's current mission (the pointer), whatever stood before.
    expect(campaignOverviewUi.routeIndex).to.eq(1);
    expect(cursors()).to.deep.eq([false, true, false, false]);
    // The party stands on the current mission's node — one cube per seat.
    const nodes = wrapper.findAll('.con-cmpov__node');
    expect(nodes.map((node) => node.findAll('.con-cmpov__party-cube').length)).to.deep.eq([0, 3, 0, 0]);
    // The participants: the viewer is marked, the seat the Information workspace looks at wears `--viewed`.
    const seats = wrapper.findAll('.con-cmpov__seat');
    expect(seats).to.have.length(3);
    expect(seats.map((seat) => seat.find('.con-cmpov__seat-you').exists())).to.deep.eq([true, false, false]);
    expect(seats.map((seat) => seat.classes().includes('con-cmpov__seat--viewed'))).to.deep.eq([false, true, false]);
    expect(campaignOverviewUi.barCommands).to.deep.eq([
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Inspect the mission'},
      {control: 'back', label: 'To overview'},
    ]);

    // ◀ ▶ walk the route (clamped at both ends); ▼ drops to the participants and the verb turns to theirs.
    expect(reach().handleIntent(nav('right'))).is.true;
    expect(reach().handleIntent(nav('right'))).is.true;
    expect(reach().handleIntent(nav('right'))).is.true;
    await nextTick();
    expect(cursors()).to.deep.eq([false, false, false, true]);
    reach().handleIntent(nav('down'));
    await nextTick();
    expect(cursors(), 'the route lets the cursor go').to.deep.eq([false, false, false, false]);
    expect(wrapper.findAll('.con-cmpov__seat').map((seat) => seat.classes().includes('con-cmpov__seat--cursor'))).to.deep.eq([true, false, false]);
    expect(campaignOverviewUi.barCommands?.[1]).to.deep.eq({control: 'confirm', label: 'Open: participant legacy'});
    // B at the base layer is NOT the overview's — the host walks back to the summary.
    expect(reach().handleIntent(B)).is.false;
  });

  it('A opens ONE nested layer over the base (the mission inspect / the seat\'s legacy), B walks exactly one level back', async () => {
    campaignState.model = campaign();
    const {wrapper, reach} = overview();
    await nextTick();

    // The route: A inspects the mission under the cursor — the layer opens FROM it (its origin on this surface).
    expect(reach().handleIntent(A)).is.true;
    await nextTick();
    expect(campaignOverviewUi.level).to.eq('mission');
    expect(wrapper.find('.con-cmpov').classes()).to.include('con-cmpov--layered');
    const inspect = wrapper.findComponent(InspectStub);
    expect(inspect.exists()).is.true;
    expect(inspect.props('mission').slot).to.eq(1);
    expect(inspect.props('youSeat')).to.eq(0);
    expect(inspect.props('missionCount')).to.eq(4);
    expect((inspect.props('party') as ReadonlyArray<{color: string}>).map((p: {color: string}) => p.color)).to.deep.eq(['blue', 'red', 'green']);
    expect(wrapper.find('.con-cmpov__layer').attributes('style')).to.contain('--cov-ox: 50%');
    expect(campaignOverviewUi.barCommands, 'nothing to inspect on a mission with no carried cards').to.deep.eq([{control: 'back', label: 'Back'}]);
    // The layer owns the pad: an arrow moves nothing and is consumed; B is one level.
    expect(reach().handleIntent(nav('down'))).is.true;
    expect(campaignOverviewUi.zone).to.eq('route');
    expect(reach().handleIntent(B)).is.true;
    await nextTick();
    expect(campaignOverviewUi.level).to.eq('route');
    expect(wrapper.findComponent(InspectStub).exists()).is.false;

    // The participants: A opens the legacy of the seat under the cursor.
    reach().handleIntent(nav('down'));
    reach().handleIntent(nav('down'));
    expect(reach().handleIntent(A)).is.true;
    await nextTick();
    expect(campaignOverviewUi.level).to.eq('legacy');
    const legacy = wrapper.findComponent(LegacyStub);
    expect(legacy.exists()).is.true;
    expect(legacy.props('legacy').seat).to.eq(1);
    expect(legacy.props('cursorIndex'), 'no ring over a seat with nothing to inspect').to.eq(undefined);
    expect(campaignOverviewUi.barCommands).to.deep.eq([{control: 'dpad', label: 'Choose'}, {control: 'back', label: 'Back'}]);
    expect(reach().handleIntent(B)).is.true;
    await nextTick();
    expect(wrapper.find('.con-cmpov').classes()).to.not.include('con-cmpov--layered');
  });

  it('inside a live mission the entry stands on THAT mission, and only its inspect reads the live generation; a click on a mission opens it', async () => {
    campaignState.model = campaign({pointer: 2});
    const {wrapper, reach, cursors} = overview(playerView({missionSlot: 1, grants: []}, 6));
    await nextTick();
    expect(cursors(), 'the open mission of the game, not the campaign\'s pointer').to.deep.eq([false, true, false, false]);
    reach().handleIntent(A);
    await nextTick();
    expect(wrapper.findComponent(InspectStub).props('liveGeneration')).to.eq(6);
    reach().handleIntent(B);
    await nextTick();

    await wrapper.findAllComponents(MissionCardStub)[0].trigger('click');
    expect(campaignOverviewUi.level).to.eq('mission');
    expect(campaignOverviewUi.missionSlot).to.eq(0);
    expect(wrapper.findComponent(InspectStub).props('mission').slot).to.eq(0);
    expect(wrapper.findComponent(InspectStub).props('liveGeneration'), 'a finished mission has no live generation').to.eq(undefined);
  });

  it('leaving the route takes its command contract back', () => {
    campaignState.model = campaign();
    const {wrapper} = overview();
    expect(campaignOverviewUi.barCommands).to.not.eq(undefined);
    wrapper.unmount();
    expect(campaignOverviewUi.barCommands).to.eq(undefined);
  });
});
