/*
 * ConsoleParliamentAgenda — the Parliament's CAREER tier: the read-only track and the ONE marker in motion on it. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). `ConsoleParliamentSection` stands it under
 * `ref="agenda"` and asks it for the walk THROUGH THAT REF (`playAgendaWalk` — the sitting's beat, the chairmanship's,
 * a card's — and `stopAgendaGlide`), so the tier is mounted here the way the section mounts it, under a host with a
 * string ref, and the spec reads what that ref carries.
 *
 * What the track PRINTS for a reading (the final influence, the spans, the coins) is `influenceReadingSurfaces.spec.ts`;
 * what a flow's seed holds is `chairmanQuestFlow.spec.ts`. Here: the walk's DOM half — the proxy, the cube under it,
 * the tier's animation hold, every ending landing for the walk's owner. (jsdom measures every rect as 0 × 0, so a leg
 * can never be measured: the walk ends by the tier's own honest ending, `finishAgendaGlide` — which is the ending
 * under test; the glide's motion itself is the e2e's.)
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import ConsoleParliamentAgenda from '@/client/components/console/parliament/ConsoleParliamentAgenda.vue';
import {agendaViewOf, buildParliamentView} from '@/client/console/parliament/consoleParliamentModel';
import {consoleParliamentUi, parliamentFlow, resetParliamentFlow, setParliamentRootEl} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {sittingMotion} from '@/client/console/parliament/sittingDirector';
import {AgendaWalkBeatScheduler, agendaWalkMotion, AgendaWalkRecordLike} from '@/client/console/parliament/agendaWalkDirector';
import {activeAnimationHoldLabels} from '@/client/components/presentation/animationHold';

const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const SEATS = [{color: BLUE, name: 'Blue'}, {color: RED, name: 'Red'}];

/** What the section reads through its ref — the component's whole contract with its parent. */
type AgendaReach = {
  playAgendaWalk(record: AgendaWalkRecordLike, opts?: {onLanded?: () => void, beat?: AgendaWalkBeatScheduler}): void,
  stopAgendaGlide(): void,
};

function seat(color: Color, agenda: number): ParliamentPlayerModel {
  return {
    color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence: 1,
    access: [], partyActionUses: {}, resolutionActionUses: 0,
  };
}

function model(players: ReadonlyArray<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {
    slots: [], rulingParty: PartyName.SCIENTISTS, popularSupport: {}, deckSize: 9, discardSize: 0, neutralSupply: 14, botMode: 'none',
    players: [...players],
    viewer: {vote: {available: true, reason: '', source: 'lobby', cost: 0, projections: []}, partyActions: []},
    ...over,
  };
}

// (A render function, not a template string: the runtime compiler is not in this build.) The quest plate is its own
// component with its own spec — here only the props the tier threads through to it.
const EngineStub = defineComponent({
  name: 'ConsoleParliamentEngine',
  props: {view: Object, players: Array, viewerColor: String, sittingStage: String, focused: Boolean},
  render: () => h('div', {class: 'engine-stub'}),
});

function mountUnderHost(initial: ParliamentModel) {
  const table = shallowRef(initial);
  const Host = defineComponent({
    render: () => {
      const vm = buildParliamentView(table.value, BLUE, SEATS as never);
      return h('div', {class: 'host'}, [h(ConsoleParliamentAgenda, {
        ref: 'agenda', view: vm, model: table.value, agendaVm: agendaViewOf(vm), players: SEATS as never, viewerColor: BLUE, viewerParticipates: true,
      })]);
    },
  });
  // `globalConfig` promotes every Vue warning to a failure: «mounts without a warning» is part of each test.
  const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: {ConsoleParliamentEngine: EngineStub}}});
  return {
    wrapper,
    table,
    /** Exactly the section's read: `agenda.value ?? undefined`. */
    reach: (): AgendaReach => {
      const agenda = (wrapper.vm.$refs.agenda ?? undefined) as AgendaReach | undefined;
      if (agenda === undefined) {
        throw new Error('the host holds no ref to the tier');
      }
      return agenda;
    },
    cube: (step: number, color: Color) => wrapper.find(`[data-agenda-markers="${step}"] [data-agenda-cube="${color}"]`),
    step: (index: number) => wrapper.find(`.con-parl__step[data-step="${index}"]`),
  };
}

/** The proxy in flight is teleported to the body. */
const proxy = (): Element | null => document.body.querySelector('.con-parl__flight--agenda .con-parl__agenda-dot--proxy');
const glideHeld = (): boolean => activeAnimationHoldLabels().some((label) => label.startsWith('parliament-agenda-glide'));

/** The walk's own clock, in the spec's hands (`opts.beat`): a beat fires when the spec says so. */
function handClock() {
  const due: Array<() => void> = [];
  const beat: AgendaWalkBeatScheduler = (_delayMs, fire) => {
    due.push(fire);
    return {kill: () => {}};
  };
  return {beat, fireAll: () => due.splice(0).forEach((fire) => fire())};
}

const WALK: AgendaWalkRecordLike = {player: BLUE, from: 2, to: 3, steps: []};

describe('ConsoleParliamentAgenda — the Career tier and the marker\'s walk', () => {
  beforeEach(() => {
    // Module state is bundle-shared.
    resetParliamentFlow();
    resetParliamentHolds();
  });

  afterEach(() => {
    resetParliamentFlow();
    resetParliamentHolds();
    setParliamentRootEl(undefined);
    sittingMotion.agendaSegment = undefined;
    agendaWalkMotion.awaitingCard = undefined;
    consoleParliamentUi.agendaSettling = false;
  });

  it('a PARENT\'s ref sees the walk\'s two doors and nothing else; the quest plate gets the tier\'s own props', async () => {
    const {wrapper, reach} = mountUnderHost(model([seat(BLUE, 3), seat(RED, 0)]));
    const agenda = reach();
    expect(Object.keys(agenda), 'exactly what the tier exposes').to.deep.eq(['playAgendaWalk', 'stopAgendaGlide']);
    expect(agenda.playAgendaWalk).to.be.a('function');
    expect(agenda.stopAgendaGlide).to.be.a('function');
    // Neither the tier's state nor its other functions are reachable through the ref.
    const leaked = ['shown', 'agendaFlight', 'agendaHidden', 'agendaPhase', 'finishAgendaGlide', 'raiseAgendaGlideHold', 'pulseAgendaStep', 'flow']
      .filter((key) => (agenda as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);

    const engine = wrapper.findComponent(EngineStub);
    expect(engine.props('viewerColor')).to.eq(BLUE);
    expect(engine.props('players')).to.deep.eq(SEATS);
    expect(engine.props('sittingStage')).to.eq('');
    expect(engine.props('focused')).to.eq(false);

    // The tier reads the Parliament's cursor off the flow module: its own zone lights the root, the engine's the plate.
    const root = wrapper.find('[data-parl-agenda]');
    expect(root.classes()).to.not.include('con-parl__agenda--focus');
    parliamentFlow.zone = 'agenda';
    await nextTick();
    expect(root.classes()).to.include('con-parl__agenda--focus');
    parliamentFlow.zone = 'engine';
    await nextTick();
    expect(root.classes()).to.not.include('con-parl__agenda--focus');
    expect(wrapper.findComponent(EngineStub).props('focused')).to.eq(true);
  });

  it('a HELD walk keeps the marker on the step it left; the hold\'s release is what moves it', async () => {
    parliamentHolds.agendaAwaits = {player: BLUE, from: 2, to: 3};
    const {cube, step} = mountUnderHost(model([seat(BLUE, 3), seat(RED, 0)]));
    expect(cube(2, BLUE).exists(), 'the cube is still drawn on the old step').to.eq(true);
    expect(cube(3, BLUE).exists(), 'and NOT on the new one').to.eq(false);
    expect(step(2).classes(), 'the viewer still stands there').to.include('con-parl__step--here');
    expect(cube(0, RED).exists(), 'a seat nobody holds stands where the model says').to.eq(true);

    parliamentHolds.agendaAwaits = undefined;
    await nextTick();
    expect(cube(2, BLUE).exists()).to.eq(false);
    expect(cube(3, BLUE).exists()).to.eq(true);
    expect(step(3).classes()).to.include('con-parl__step--here');
  });

  it('an advance seen LIVE walks; a mount never replays one — and with no Parliament on screen the reached step blooms once', async () => {
    const before = model([seat(BLUE, 3), seat(RED, 0)], {lastAdvance: {seq: 4, player: BLUE, from: 2, to: 3, steps: [], reason: 'card', generation: 2}} as never);
    const {wrapper, table, cube, step} = mountUnderHost(before);
    await nextTick();
    expect(wrapper.find('.con-parl__step--pulse').exists(), 'the record the tier was mounted with is history').to.eq(false);

    table.value = model([seat(BLUE, 3), seat(RED, 1)], {lastAdvance: {seq: 5, player: RED, from: 0, to: 1, steps: [], reason: 'card', generation: 2}} as never);
    await nextTick();
    await nextTick();
    expect(cube(1, RED).exists()).to.eq(true);
    expect(step(1).classes(), 'no stage to glide on — the step still says «something landed here»').to.include('con-parl__step--pulse');
    expect(proxy(), 'no proxy without a stage').to.eq(null);
    expect(glideHeld()).to.eq(false);

    // The bloom is a one-shot: its own end clears the flag (another animation's end does not).
    await step(1).trigger('animationend', {animationName: 'con-track-marker-settle'});
    expect(step(1).classes()).to.include('con-parl__step--pulse');
    await step(1).trigger('animationend', {animationName: 'con-parl-node-bloom'});
    expect(step(1).classes()).to.not.include('con-parl__step--pulse');

    // The sitting plays its own walks: an advance that arrives during it is not the tier's to replay.
    parliamentFlow.stage = 'sitting';
    table.value = model([seat(BLUE, 3), seat(RED, 2)], {lastAdvance: {seq: 6, player: RED, from: 1, to: 2, steps: [], reason: 'card', generation: 2}} as never);
    await nextTick();
    await nextTick();
    expect(wrapper.find('.con-parl__step--pulse').exists()).to.eq(false);
  });

  it('ON STAGE: the proxy is born in the body over a hidden cube under the tier\'s hold, which stands down for a card\'s take; a leg that cannot be measured sets the marker down and its owner continues', async () => {
    const {wrapper, reach, cube, step} = mountUnderHost(model([seat(BLUE, 3), seat(RED, 0)]));
    setParliamentRootEl(wrapper.element as HTMLElement);
    const clock = handClock();
    let landed = 0;
    reach().playAgendaWalk(WALK, {beat: clock.beat, onLanded: () => landed++});
    await nextTick();

    const dot = proxy();
    expect(dot, 'ONE proxy for the whole walk, out of the tier\'s box').to.not.eq(null);
    expect([...(dot as Element).classList]).to.include.members(['player_bg_color_blue', 'con-parl__agenda-dot--charge']);
    expect(cube(3, BLUE).classes(), 'the real cube at the destination hides under the proxy').to.include('con-parl__agenda-cube--hidden');
    expect(step(3).classes(), 'the lead lights the segment the marker is about to cross').to.include('con-parl__step--segment');
    expect(consoleParliamentUi.agendaSettling, 'the card-bonus scene waits for the marker').to.eq(true);
    expect(glideHeld(), 'the walk is an animation the tier holds').to.eq(true);
    expect(landed).to.eq(0);

    // A card step's take is in the player's hands: the hold stands down for it, and up again when the walk resumes.
    agendaWalkMotion.awaitingCard = 3;
    await nextTick();
    expect(glideHeld(), 'no ceiling over a player\'s reading').to.eq(false);
    agendaWalkMotion.awaitingCard = undefined;
    await nextTick();
    expect(glideHeld()).to.eq(true);

    // The lead is over; the leg leaves — and cannot be measured here.
    clock.fireAll();
    expect(landed, 'the owner\'s continuation ran, once').to.eq(1);
    expect(glideHeld()).to.eq(false);
    expect(consoleParliamentUi.agendaSettling).to.eq(false);
    expect(sittingMotion.agendaSegment).to.eq(undefined);
    await nextTick();
    expect(proxy()).to.eq(null);
    expect(cube(3, BLUE).classes(), 'the marker is set down on the walk\'s last step').to.not.include('con-parl__agenda-cube--hidden');
    expect(step(3).classes()).to.include('con-parl__step--pulse');
    expect(step(3).classes()).to.not.include('con-parl__step--segment');

    clock.fireAll();
    expect(landed, 'nothing lands twice').to.eq(1);
  });

  it('a walk DISPLACED by another still lands for its owner; `stopAgendaGlide` takes the stage down and calls no hook; leaving releases the hold', async () => {
    const {wrapper, reach} = mountUnderHost(model([seat(BLUE, 3), seat(RED, 1)]));
    setParliamentRootEl(wrapper.element as HTMLElement);
    const clock = handClock();
    let first = 0;
    let second = 0;
    reach().playAgendaWalk(WALK, {beat: clock.beat, onLanded: () => first++});
    reach().playAgendaWalk({player: RED, from: 0, to: 1, steps: []}, {beat: clock.beat, onLanded: () => second++});
    expect(first, 'the flow waiting on the displaced walk continues from its landing').to.eq(1);
    expect(second).to.eq(0);
    await nextTick();
    expect([...(proxy() as Element).classList], 'the stage is the newer walk\'s').to.include('player_bg_color_red');
    expect(glideHeld()).to.eq(true);

    reach().stopAgendaGlide();
    await nextTick();
    expect(proxy()).to.eq(null);
    expect(glideHeld()).to.eq(false);
    expect(consoleParliamentUi.agendaSettling).to.eq(false);
    clock.fireAll();
    expect([first, second], 'a stopped walk fires no beat and no hook').to.deep.eq([1, 0]);

    reach().playAgendaWalk(WALK, {beat: clock.beat});
    expect(glideHeld()).to.eq(true);
    wrapper.unmount();
    expect(glideHeld(), 'the tier leaves nothing held behind it').to.eq(false);
    expect(consoleParliamentUi.agendaSettling).to.eq(false);
    expect(proxy()).to.eq(null);
  });
});
