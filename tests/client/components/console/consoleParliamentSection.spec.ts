/*
 * ConsoleParliamentSection — «ПАРЛАМЕНТ», the root of the Mars Parliament workspace (Turmoil Redux): the stage machine
 * over the shared flow record, the browse layer's grammar, the submit funnel and the crumb. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md). A surface this size is proven by its e2e; what this spec owns is
 * the conversion's contract:
 *  · it mounts on its browse layer without a Vue warning (`globalConfig` promotes one to a failure), publishes its
 *    command contract and takes it back with itself;
 *  · a parent's ref reaches EXACTLY the three members the shell's controllers call through the surface registry
 *    (R11 — `padRouterController`, `startController`, `parliamentController`), and each still does its work;
 *  · THE ORDER (R9): the flow record is reset ABOVE every declaration, so the `immediate` watchers open their stage
 *    on a clean record — a section mounted FOR a chairman-seat pick is born on its seat stage; and that pick's answer
 *    leaves once and the server's answer ends the flow.
 *
 * What the question door DECIDES is `tests/client/console/parliamentQuestionDoor.spec.ts` (the sibling module's
 * bodies against a stub port). The tiers are stand-ins by name — each has a spec of its own; this one reads what the
 * SECTION hands them and what it asks of them. (Render functions, not template strings: the runtime compiler is not
 * in this build.)
 */
import {expect} from 'chai';
import gsap from 'gsap';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {ParliamentModel, ParliamentPlayerModel, ParliamentSlotModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import {resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {agendaWalkFlow, resetAgendaWalkFlow} from '@/client/console/parliament/agendaWalk';
import {resetChairmanQuestFlow} from '@/client/console/parliament/consoleChairmanQuest';
import {
  consoleParliamentUi, parliamentCrumbSubject, parliamentFlow, parliamentRootEl, resetConsoleParliamentUi, resetParliamentFlow, setParliamentRootEl,
} from '@/client/console/parliament/consoleParliamentFlow';
import {ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {resetNeutralRallyFlow} from '@/client/console/parliament/neutralRally';
import {freezeParliamentFit} from '@/client/console/parliament/parliamentCardFit';
import {resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {resetParliamentRewards} from '@/client/console/parliament/parliamentRewardBeat';
import ConsoleParliamentSection from '@/client/components/console/ConsoleParliamentSection.vue';

const BLUE: Color = 'blue';
const RED: Color = 'red';
/** Two shipped bills (the catalog's own — a re-declared card fails here): the Greens' and the Industrialists'. */
const AQUIFER = 'RDX_GREENS_AQUIFER_CONTEST';
const GRID = 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID';

const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const X: GamepadIntent = {kind: 'press', button: 'secondary'};

/**
 * The sheet's MUST EXPOSE list (`node scripts/vapor/inventory.mjs --component …`) — the three doors, and the section's
 * ROOT by the one name a parent reads it by (`rootEl` — a Vapor child's ref answers no `$el`, components/rootEl.ts).
 */
const EXPOSED = ['handleIntent', 'openWalkFlow', 'resetSubmitting', 'rootEl'];

/** What the shell's controllers reach through the surface registry (`'parliamentSection'`). */
type Exposed = {
  handleIntent(intent: GamepadIntent): void,
  openWalkFlow(): void,
  resetSubmitting(): void,
  readonly rootEl: HTMLElement | null,
};

/** What the section asked of the tiers it holds a ref on. */
const asked: Array<string> = [];

const HeadStub = defineComponent({
  name: 'ConsoleWsHead',
  inheritAttrs: false,
  props: ['root', 'emblem', 'wheelAnchor', 'subject', 'subjectRaw', 'stage', 'stageRaw', 'committed'],
  setup: (_, {slots}) => () => h('header', {class: 'head-stub'}, slots.trailing?.()),
});
/** The vote mode: the section opens, folds and answers it through its ref (`voteMode`). */
const VoteModeStub = defineComponent({
  name: 'ConsoleParliamentVoteMode',
  inheritAttrs: false,
  props: ['view', 'model', 'playerView', 'viewerColor', 'viewerParticipates', 'awaitingInput', 'bridge', 'voteTile', 'winningSlot', 'benchSource', 'benchWarn',
    'canActNow', 'canVoteNow', 'cardReceipt', 'stagedFlow'],
  setup(_, {expose}) {
    expose({
      openVote: () => asked.push('voteMode.openVote'),
      closeVote: () => asked.push('voteMode.closeVote'),
      enterArmedVote: () => asked.push('voteMode.enterArmedVote'),
      answerAfterSubmit: () => asked.push('voteMode.answerAfterSubmit'),
      answerWhilePaying: () => asked.push('voteMode.answerWhilePaying'),
      handleIntent: () => asked.push('voteMode.handleIntent'),
    });
    return () => h('i', {class: 'votemode-stub'});
  },
});
/** The career edge: the walk's director is the tier's (`agenda`). */
const AgendaStub = defineComponent({
  name: 'ConsoleParliamentAgenda',
  inheritAttrs: false,
  setup(_, {expose}) {
    expose({
      playAgendaWalk: () => {
        asked.push('agenda.playAgendaWalk');
        return Promise.resolve();
      },
      stopAgendaGlide: () => asked.push('agenda.stopAgendaGlide'),
    });
    return () => h('i', {class: 'agenda-stub'});
  },
});
/** The chairman-seat pick: its A is the stage's `submit` (the rect of the cube that leaves the card). */
const SeatPickStub = defineComponent({
  name: 'ConsoleParliamentSeatPick',
  inheritAttrs: false,
  props: ['view', 'slot', 'viewerColor', 'seatCandidates'],
  emits: ['submit', 'inspect'],
  setup(_, {expose}) {
    expose({handleIntent: () => asked.push('seatPick.handleIntent')});
    return () => h('i', {class: 'seatpick-stub'});
  },
});
const CareerDossierStub = defineComponent({name: 'ConsoleParliamentCareerDossier', inheritAttrs: false, render: () => h('i', {class: 'career-dossier-stub'})});

const global = {
  ...globalConfig.global,
  stubs: {
    ConsoleWsHead: HeadStub, ConsoleParliamentVoteMode: VoteModeStub, ConsoleParliamentAgenda: AgendaStub, ConsoleParliamentSeatPick: SeatPickStub,
    ConsoleParliamentCareerDossier: CareerDossierStub,
    ConsoleParliamentSeats: true, ConsoleParliamentParties: true, ConsoleParliamentGovernment: true, ConsoleParliamentEffects: true,
    ConsoleParliamentEffectsStep: true, ConsoleParliamentBand: true, ConsoleParliamentVotingArea: true, ConsoleParliamentSupportMode: true,
    ConsoleParliamentBannerMode: true, ConsoleBannerCubeStage: true, ConsoleParliamentSitting: true, ConsoleParliamentTableAnswer: true,
    ConsoleParliamentDrawStage: true, ConsoleParliamentDelegateMode: true, ConsoleParliamentQuestDossier: true, ConsoleSourceDock: true,
  },
};

function shipped(id: string): IClientResolution {
  const resolution = getResolution(id);
  if (resolution === undefined) {
    throw new Error(`${id} is not in the client catalog`);
  }
  return resolution;
}

function seat(color: Color): ParliamentPlayerModel {
  return {
    color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false,
    agenda: 2, influence: influenceAtAgenda(2), access: [], partyActionUses: {}, resolutionActionUses: 0,
  };
}

function bill(id: string, tiePriority: number): ParliamentSlotModel {
  return {instance: `${id}#0`, resolution: id, party: shipped(id).party, votes: [], totalVotes: 0, isWinning: false, tiePriority, viewerVotes: 0};
}

/** The server's Parliament between two sittings: two seats, two bills on the table, nothing enacted, no phase. */
function parliament(): ParliamentModel {
  return {
    slots: [bill(AQUIFER, 1), bill(GRID, 2)],
    rulingParty: PartyName.GREENS, popularSupport: {}, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none',
    players: [seat(BLUE), seat(RED)],
    viewer: {vote: {available: true, reason: '', source: 'lobby', cost: 0, projections: []}, partyActions: []},
  };
}

const PLAYERS = [
  {color: BLUE, name: 'Anna', terraformRating: 20, megacredits: 30, steel: 0, titanium: 0, steelValue: 2, titaniumValue: 3, tableau: [], actionsThisGeneration: []},
  {color: RED, name: 'Boris', terraformRating: 22, megacredits: 30, steel: 0, titanium: 0, steelValue: 2, titaniumValue: 3, tableau: [], actionsThisGeneration: []},
] as unknown as ReadonlyArray<PublicPlayerModel>;

/** The viewer's view of the game: the Parliament as the server sends it, and what it asks of this seat (if anything). */
function playerView(over: {waitingFor?: unknown, gameAge?: number} = {}): PlayerViewModel {
  return {
    id: 'p-parliament',
    players: PLAYERS,
    thisPlayer: PLAYERS[0],
    cardsInHand: [],
    game: {gameAge: over.gameAge ?? 1, generation: 3, parliament: parliament(), gameOptions: {boardName: 'tharsis'}},
    waitingFor: over.waitingFor,
  } as unknown as PlayerViewModel;
}

/** The stand-alone chairman-seat pick as the server asks it (its structural marker — never its title). */
function seatPick(): unknown {
  return {type: 'party', title: 'Select a resolution for your delegate', buttonLabel: 'Confirm', parties: [PartyName.INDUSTRIALISTS], votePrompt: {source: 'chairman-seat'}, promptId: 9};
}

function section(over: Record<string, unknown> = {}) {
  return mount(ConsoleParliamentSection as any, {...globalConfig, props: {playerView: playerView(), ...over}, global});
}

/**
 * The section under a PARENT that holds a ref to it and hears its events — what that ref carries is what the shell's
 * surface registry hands its controllers. `hand` re-renders the parent with new props (the server's answer applied).
 */
function underHost(over: Record<string, unknown> = {}) {
  const held = shallowRef<Exposed | null>(null);
  const heard: Array<[string, unknown]> = [];
  const handed = shallowRef<Record<string, unknown>>({playerView: playerView(), ...over});
  const Host = defineComponent({
    name: 'ParliamentSectionHost',
    setup: () => () => h('div', {'data-host': ''}, [h(ConsoleParliamentSection as never, {
      ...handed.value,
      ref: held,
      onClose: () => heard.push(['close', undefined]),
      onSubmit: (response: unknown) => heard.push(['submit', response]),
      onNotice: (text: string) => heard.push(['notice', text]),
      onCollapse: () => heard.push(['collapse', undefined]),
      onFlowComplete: (stage: string) => heard.push(['flow-complete', stage]),
    })]),
  });
  const hand = async (next: Record<string, unknown>): Promise<void> => {
    handed.value = {...handed.value, ...next};
    await nextTick();
  };
  return {wrapper: mount(Host, {...globalConfig, global}), held, heard, hand};
}

describe('ConsoleParliamentSection — the Parliament\'s root: its browse layer, the stage it is born on, and what the shell reaches through its ref', () => {
  let clock: ManualFlowClock;

  // The flow record, the published contract, the fit's freeze, the section's root, the workspace stack and the walk /
  // quest / rally records are module state the whole bundle shares: every test starts from, and leaves, the clean one.
  // The section's nets and the probe ticks are waits of the flow kernel — the spec drives the kernel's clock.
  const reset = () => {
    resetChairmanQuestFlow();
    resetAgendaWalkFlow();
    resetNeutralRallyFlow();
    resetParliamentFlow();
    resetParliamentHolds();
    resetParliamentRewards();
    resetConsoleParliamentUi();
    consoleParliamentUi.hall = false;
    freezeParliamentFit(false);
    setParliamentRootEl(undefined);
    resetWorkspaceStack();
    asked.length = 0;
  };
  beforeEach(() => {
    reset();
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
    reset();
  });
  // Every tier is a stand-in, so the section's leave has no bill, tally or cube to bring back to rest — GSAP would say
  // «target not found» on each unmount (a line of its own, not a Vue warning). Its say is lent for the suite only.
  before(() => {
    gsap.config({nullTargetWarn: false});
  });
  after(() => {
    gsap.config({nullTargetWarn: true});
  });

  it('mounts on its browse layer without a warning — the root, the head, the view its tiers read, the command contract — and takes them back with itself', async () => {
    const w = section();
    // The template STARTS WITH ITS ROOT (its opening comment lives in the script now).
    expect((w.element as Element).tagName).to.eq('SECTION');
    expect(w.classes()).to.include.members(['con-parl', 'con-ws', 'con-parl--hall', 'con-parl--zone-voting']);
    expect(w.classes()).to.not.include.members(['con-parl--embedded']);
    expect(w.attributes('role')).to.eq('region');
    expect(w.attributes('aria-label')).to.eq($t('Parliament'));
    expect(w.attributes('data-stage')).to.eq('browse');
    expect(w.attributes('data-zone')).to.eq('voting');
    expect(w.attributes('aria-hidden')).to.eq(undefined);
    expect(w.attributes('data-sitting-stage'), 'no sitting stands between two phases').to.eq(undefined);

    // THE HEAD: the workspace's own root, the overview as its subject, no stage past the commit.
    const head = w.findComponent(HeadStub);
    expect(head.props()).to.include({root: 'Parliament', emblem: 'parliament', wheelAnchor: 'parliament', subject: parliamentCrumbSubject(), stage: '', committed: false});

    // THE TIERS read ONE view, built off the server's Parliament; the execution gate is the viewer's own window.
    const mode = w.findComponent(VoteModeStub);
    expect((mode.props('view') as ParliamentViewVm).slots.map((slot) => slot.resolutionId)).to.deep.eq([AQUIFER, GRID]);
    expect(mode.props()).to.include({viewerColor: BLUE, viewerParticipates: true, benchSource: 'lobby', canActNow: false, stagedFlow: 'play'});
    await w.setProps({myTurn: true, awaitingInput: true});
    expect(mode.props('canActNow')).to.eq(true);

    // PUBLISHED at setup: the command contract and the hall; on the mounted DOM: the section's root.
    expect(consoleParliamentUi.commands.length, 'the one command contract is on the shell\'s bar').to.be.greaterThan(0);
    expect(consoleParliamentUi.hall).to.eq(true);
    expect(consoleParliamentUi.voteStanding).to.eq(false);
    expect(parliamentRootEl()).to.eq(w.element);

    w.unmount();
    expect(consoleParliamentUi.commands).to.deep.eq([]);
    expect(consoleParliamentUi.hall).to.eq(false);
    expect(parliamentRootEl()).to.eq(undefined);
  });

  it('HOSTED as a step it sheds the frame — no head, no `con-ws` marker, the bench in a toolbar of its own; WARMING it shows and publishes nothing', () => {
    const hosted = section({embedded: true});
    expect(hosted.classes()).to.include('con-parl--embedded');
    expect(hosted.classes()).to.not.include('con-ws');
    expect(hosted.findComponent(HeadStub).exists()).to.eq(false);
    expect(hosted.find('[data-parl-toolbar]').exists()).to.eq(true);
    hosted.unmount();

    const warm = section({embedded: true, warm: true});
    expect(warm.classes()).to.include('con-parl--warm');
    expect(warm.attributes('aria-hidden')).to.eq('true');
    expect(warm.attributes('data-surface-warm')).to.eq('');
    expect(consoleParliamentUi.hall, 'a warming mount holds no vote').to.eq(false);
  });

  it('a PARENT\'s ref sees the three doors the shell opens and its root, nothing else — the pad, a refused submit, a walk owed to it', async () => {
    const {wrapper, held, heard} = underHost();
    const root = () => wrapper.find('.con-parl');
    expect(held.value, 'the parent\'s ref is set').to.not.eq(null);
    expect(Object.keys(held.value!).sort(), 'exactly what the section exposes').to.deep.eq([...EXPOSED].sort());
    expect(held.value!.rootEl, 'the section\'s root element').to.eq(root().element);
    const leaked = ['send', 'closeStage', 'serveStandingQuestion', 'voteModeNow', 'reconcileStandingPrompts', 'port', 'view', 'bridge', 'flow', 'stageUp', 'walking']
      .filter((key) => (held.value as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
    const pad = held.value!.handleIntent;

    // THE BROWSE LAYER: B closes the workspace; A on the voting area opens the vote mode — through the section's ref on it.
    pad(B);
    expect(heard).to.deep.eq([['close', undefined]]);
    pad(A);
    expect(asked).to.deep.eq(['voteMode.openVote']);

    // X on the CAREER reads its dossier — a read-only layer: nothing else reaches the hall under it, and B folds IT.
    parliamentFlow.zone = 'agenda';
    pad(X);
    await nextTick();
    expect(wrapper.find('.career-dossier-stub').exists()).to.eq(true);
    parliamentFlow.zone = 'voting';
    pad(A);
    expect(asked, 'the dossier absorbs the press').to.deep.eq(['voteMode.openVote']);
    pad(B);
    await nextTick();
    expect(wrapper.find('.career-dossier-stub').exists()).to.eq(false);
    expect(heard.length, 'B folded the dossier, never the workspace').to.eq(1);

    // `resetSubmitting` — a REFUSED submit hands the stage back to the player (and a refused close leads nowhere).
    parliamentFlow.stageBeforeSubmit = 'seat';
    parliamentFlow.stage = 'submitting';
    consoleParliamentUi.closeInto = 'draft';
    held.value!.resetSubmitting();
    expect(parliamentFlow.stage).to.eq('seat');
    expect(consoleParliamentUi.closeInto).to.eq(undefined);
    held.value!.resetSubmitting();
    expect(parliamentFlow.stage, 'nothing in flight: nothing to hand back').to.eq('seat');
    parliamentFlow.stage = 'browse';
    await nextTick();

    // `openWalkFlow` — the walk pose opens at once (a transient beat, the track the hero); with no record owed there is
    // nothing to play, and the flow ends by its own hand on the mounted DOM (a tick and a probe tick later).
    held.value!.openWalkFlow();
    expect([parliamentFlow.stage, parliamentFlow.zone, agendaWalkFlow.live, agendaWalkFlow.beat]).to.deep.eq(['walk', 'government', true, 'walk']);
    await nextTick();
    expect(root().classes()).to.include.members(['con-parl--walk', 'con-parl--zone-government']);
    expect(root().attributes('data-walk-beat')).to.eq('walk');
    expect(heard.length).to.eq(1);
    clock.advance(PROBE_TICK_FALLBACK_MS + 10);
    expect(heard[1]).to.deep.eq(['flow-complete', 'walk']);
    expect(agendaWalkFlow.beat).to.eq('done');
    expect(asked, 'no record: the tier is asked for no walk').to.deep.eq(['voteMode.openVote']);
  });

  it('the flow record is reset ABOVE the watchers: mounted FOR a chairman-seat pick it is born on the seat stage — its answer leaves once, the server\'s ends the flow', async () => {
    // What a previous section left behind (module state outlives a component). The seat door opens from the browse
    // layer only: with no reset it stays shut; with a reset standing AFTER the watchers the stage they opened is wiped.
    parliamentFlow.stage = 'landed';
    parliamentFlow.zone = 'agenda';
    const {wrapper, held, heard, hand} = underHost({playerView: playerView({waitingFor: seatPick()})});
    const root = () => wrapper.find('.con-parl');
    expect([parliamentFlow.stage, parliamentFlow.zone, parliamentFlow.slotIndex], 'the stage, on the bill the seat may take').to.deep.eq(['seat', 'voting', 1]);
    expect(root().attributes('data-stage')).to.eq('seat');
    expect(root().classes()).to.include('con-parl--stage');
    expect(root().find('[data-parl-stage="seat"]').exists()).to.eq(true);
    const pick = wrapper.findComponent(SeatPickStub);
    expect((pick.props('slot') as {resolutionId: string}).resolutionId).to.eq(GRID);
    expect(pick.props('seatCandidates')).to.deep.eq([1]);

    // The pad goes to the stage that stands — through the section's ref on it.
    held.value!.handleIntent(A);
    expect(asked).to.deep.eq(['seatPick.handleIntent']);

    // THE PICK'S A: the byte-identical answer leaves ONCE, the stage reads its commit.
    pick.vm.$emit('submit', {left: 10, top: 20, width: 8, height: 8});
    expect(heard).to.deep.eq([['submit', {type: 'party', partyName: PartyName.INDUSTRIALISTS}]]);
    expect([parliamentFlow.stage, parliamentFlow.stageBeforeSubmit]).to.deep.eq(['submitting', 'seat']);
    held.value!.handleIntent(A);
    expect(asked, 'a beat in flight absorbs the pad').to.deep.eq(['seatPick.handleIntent']);
    await nextTick();
    expect(root().attributes('data-stage')).to.eq('submitting');

    // THE SERVER ANSWERED (the game moved on, the prompt is gone): the stage folds back and the flow reports its end.
    await hand({playerView: playerView({gameAge: 2})});
    await nextTick();
    expect(parliamentFlow.stage).to.eq('browse');
    expect(heard[1]).to.deep.eq(['flow-complete', 'seat']);
    expect(heard.length).to.eq(2);
    await nextTick();
    expect(root().attributes('data-stage')).to.eq('browse');
    expect(wrapper.findComponent(SeatPickStub).exists()).to.eq(false);
    expect(clock.pending(), 'the submit\'s safety net was taken back with the answer').to.eq(0);
  });
});
