/*
 * ConsoleParliamentVoteMode — «ГОЛОСОВАНИЕ», the Parliament frame's phase descent: the reading of the bill under the
 * cursor, the pad's verbs over the three proposals, the commit, and the answer landing on the same stage. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md), so a parent's template ref of it is ONLY what it
 * `defineExpose`s — and `ConsoleParliamentSection` reaches it exactly so (its `voteMode()`): `openVote` · `closeVote` ·
 * `enterArmedVote`, the two answers (`answerAfterSubmit` · `answerWhilePaying`) and `handleIntent`.
 *
 * A LARGE surface: this spec is its minimal honest mount, that contract, and two behaviours of its own — the commit and
 * the landing that ends by the mode's own hand. The entrance, the flights and the access scene are measured motion: its
 * e2e's subject (no Parliament root is registered here, so every phrase takes its «nothing measurable» road).
 *
 * (`globalConfig` turns a Vue warning into a throw: a mount that warns fails here. Render functions, not template
 * strings: the runtime compiler is not in this build.)
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateText} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {ParliamentModel, ParliamentPlayerModel, ParliamentSlotModel} from '@/common/models/ParliamentModel';
import {SelectPartyModel} from '@/common/models/PlayerInputModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {activeAnimationHoldLabels, expireAnimationHoldNow} from '@/client/components/presentation/animationHold';
import {
  armGrantVoteFlow, consoleParliamentUi, parliamentFlow, resetConsoleParliamentUi, resetParliamentFlow, setParliamentRootEl,
} from '@/client/console/parliament/consoleParliamentFlow';
import {freezeParliamentFit, parliamentFitFrozen} from '@/client/console/parliament/parliamentCardFit';
import {resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {buildParliamentView, ParliamentPromptBridge} from '@/client/console/parliament/consoleParliamentModel';
import {READING_KICKER_SEATED, VOTE_KICKER} from '@/client/console/parliament/voteInfoModel';
import ConsoleParliamentVoteMode from '@/client/components/console/parliament/ConsoleParliamentVoteMode.vue';

// The readings, the ledger, the fact tiles, the figure and the pad's badge are their own specs' subjects; this one reads
// what the mode HANDS them.
const YieldStub = defineComponent({
  name: 'ConsoleInfluenceYield',
  props: ['yields', 'suffixes', 'formula', 'captions', 'oneNumber', 'note', 'levy', 'person', 'size'],
  render: () => h('i', {class: 'yield-stub'}),
});
const LedgerStub = defineComponent({name: 'ConsoleVoteLedger', props: ['chips', 'subject', 'cubeLogicalPx'], render: () => h('i', {class: 'ledger-stub'})});
const FactStub = defineComponent({name: 'ConsoleVoteFactRow', props: ['fact', 'figurePx', 'variant'], render: () => h('i', {class: 'fact-stub'})});
const DelegateStub = defineComponent({name: 'PlayerDelegate', props: ['color', 'size', 'glow'], render: () => h('i', {class: 'delegate-stub'})});
const GlyphStub = defineComponent({name: 'GamepadGlyph', props: ['control'], render: () => h('i', {class: 'glyph-stub'})});

const global = {
  ...globalConfig.global,
  stubs: {
    ConsoleInfluenceYield: YieldStub, ConsoleVoteLedger: LedgerStub, ConsoleVoteFactRow: FactStub, PlayerDelegate: DelegateStub, GamepadGlyph: GlyphStub,
    ConsolePartyReaction: true, ConsoleColonyLedger: true, ConsoleTileGrant: true, ConsoleAgendaGrant: true, ConsoleLawStanding: true,
    ConsolePartyFormula: true, ConsoleSupportPlaces: true,
  },
};

const BLUE: Color = 'blue';
const RED: Color = 'red';
/** Two shipped bills (the catalog's own — a re-declared card fails here): the Greens' and the Industrialists'. */
const AQUIFER = 'RDX_GREENS_AQUIFER_CONTEST';
const GRID = 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID';
/** The delegate the server's answer stands on the bill. */
const LANDED_SEQ = 7;
/** The blocking hold the landing plays under (the registry prints a hold as `label[scope]`). */
const HOLD = 'parliament-vote-landing';
const holding = (): boolean => activeAnimationHoldLabels().some((label) => label.startsWith(HOLD));
/** The blocked vote's reason, as the server words it. */
const REFUSED = 'Not enough M€';

function shipped(id: string): IClientResolution {
  const resolution = getResolution(id);
  if (resolution === undefined) {
    throw new Error(`${id} is not in the client catalog`);
  }
  return resolution;
}

function seat(color: Color, over: Partial<ParliamentPlayerModel> = {}): ParliamentPlayerModel {
  return {
    color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false,
    agenda: 2, influence: influenceAtAgenda(2), access: [], partyActionUses: {}, resolutionActionUses: 0, ...over,
  };
}

function bill(id: string, tiePriority: number, over: Partial<ParliamentSlotModel> = {}): ParliamentSlotModel {
  return {instance: `${id}#0`, resolution: id, party: shipped(id).party, votes: [], totalVotes: 0, isWinning: false, tiePriority, viewerVotes: 0, ...over};
}

/** The server's Parliament: two seats, two bills, the viewer's lobby delegate free — and, `landed`, that delegate on the Greens' bill. */
function parliament(landed = false): ParliamentModel {
  const mine = landed ? [{owner: BLUE, seq: LANDED_SEQ}] : [];
  return {
    slots: [
      bill(AQUIFER, 1, {votes: mine, totalVotes: mine.length, viewerVotes: mine.length, isWinning: landed, ...(landed ? {leader: BLUE} : {})}),
      bill(GRID, 2),
    ],
    rulingParty: PartyName.GREENS, popularSupport: {}, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none',
    players: [seat(BLUE, landed ? {lobby: false, onResolutions: 1} : {}), seat(RED)],
    viewer: {vote: {available: true, reason: '', source: 'lobby', cost: 0, projections: []}, partyActions: []},
  };
}

/** The seats' public side: the viewer holds a card that can take the Aquifer's animals. */
const PLAYERS = [
  {color: BLUE, name: 'Anna', terraformRating: 20, steel: 0, titanium: 0, steelValue: 2, titaniumValue: 3, tableau: [{name: CardName.FISH}], actionsThisGeneration: []},
  {color: RED, name: 'Boris', terraformRating: 22, steel: 0, titanium: 0, steelValue: 2, titaniumValue: 3, tableau: [], actionsThisGeneration: []},
] as unknown as ReadonlyArray<PublicPlayerModel>;
const PLAYER_VIEW = {players: PLAYERS, thisPlayer: PLAYERS[0], cardsInHand: [], waitingFor: undefined} as unknown as PlayerViewModel;

/** The action menu's vote branch, as the section's bridge finds it (both bills' parties on offer). */
function bridge(): ParliamentPromptBridge {
  return {
    vote: {menuIndex: 3, model: {type: 'party', parties: [PartyName.GREENS, PartyName.INDUSTRIALISTS]} as unknown as SelectPartyModel},
    actions: {}, resolutionAction: undefined, seat: undefined, grant: undefined, supportPick: undefined, delegatePick: undefined, bannerPick: undefined,
  };
}

/** What the section hands the mode — the view built by the model's own builder off the server's Parliament. */
function modeProps(over: Record<string, unknown> = {}, landed = false): Record<string, unknown> {
  const model = parliament(landed);
  const view = buildParliamentView(model, BLUE, PLAYERS);
  return {
    view, model, playerView: PLAYER_VIEW, viewerColor: BLUE, viewerParticipates: true, bridge: bridge(),
    voteTile: view.tiles.find((tile) => tile.id === 'vote'), benchSource: 'lobby', canActNow: true, canVoteNow: true, ...over,
  };
}

function mode(over: Record<string, unknown> = {}) {
  return mount(ConsoleParliamentVoteMode as any, {...globalConfig, props: modeProps(over), global});
}

type ModeRef = {
  openVote(opts?: {fromViewer?: boolean, index?: number}): void,
  closeVote(): void,
  enterArmedVote(): void,
  answerWhilePaying(): void,
  answerAfterSubmit(): void,
  handleIntent(intent: GamepadIntent): void,
};

/**
 * The mode under a PARENT that holds a ref to it and hears its events — what that ref carries is what the section's
 * `$refs.voteMode` does. `hand` re-renders the parent with new props (the server's answer applied to the view).
 */
function underParent(over: Record<string, unknown> = {}) {
  const held = shallowRef<ModeRef | null>(null);
  const heard: Array<[string, unknown]> = [];
  const handed = shallowRef(modeProps(over));
  const Parent = defineComponent({
    name: 'VoteModeParent',
    setup: () => () => h('div', {'data-parent': ''}, [h(ConsoleParliamentVoteMode as never, {
      ...handed.value,
      ref: held,
      onNotice: (text: string) => heard.push(['notice', text]),
      onInspect: (request: unknown) => heard.push(['inspect', request]),
      onSend: (payload: unknown) => heard.push(['send', payload]),
      onFlowComplete: (stage: string) => heard.push(['flow-complete', stage]),
    })]),
  });
  const hand = async (next: Record<string, unknown>): Promise<void> => {
    handed.value = {...handed.value, ...next};
    await nextTick();
  };
  return {wrapper: mount(Parent, {...globalConfig, global}), held, heard, hand};
}

/** Run `work` with the console's warnings collected instead of printed (the ceiling's recovery names itself there). */
function collectingWarnings(work: () => void): Array<string> {
  const warnings: Array<string> = [];
  const native = console.warn;
  console.warn = (...args: Array<unknown>) => {
    warnings.push(args.map(String).join(' '));
  };
  try {
    work();
  } finally {
    console.warn = native;
  }
  return warnings;
}

describe('ConsoleParliamentVoteMode — the bill under the cursor, its verbs, and what a parent reaches through its ref', () => {
  // The flow, the hall flag, the fit's freeze, the section's root and the workspace stack are module state the whole
  // bundle shares: every test starts from, and leaves, the clean one.
  const reset = () => {
    resetParliamentFlow();
    resetConsoleParliamentUi();
    consoleParliamentUi.hall = false;
    freezeParliamentFit(false);
    setParliamentRootEl(undefined);
    resetWorkspaceStack();
  };
  beforeEach(reset);
  afterEach(reset);

  it('mounts under the overview — hidden, already reading the bill under the cursor — and follows the cursor, the mode and its props', async () => {
    const w = mode();
    // The template STARTS WITH ITS ROOT (its opening comment lives in the script now).
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.deep.eq(['con-parl__vote']);
    expect(w.attributes('data-parl-vote')).to.not.eq(undefined);
    expect(w.attributes('aria-hidden'), 'the layer is mounted before the mode stands (the slots\' teleport target)').to.eq('true');
    expect(w.attributes('data-parl-vote-door')).to.eq(undefined);
    expect(w.attributes('data-parl-vote-source-kind')).to.eq('lobby');
    const accent = () => (w.element as HTMLElement).style.getPropertyValue('--parl-accent');
    expect(accent()).to.eq(partyAccent(PartyName.GREENS));
    expect((w.find('[data-parl-vrow]').element as HTMLElement).style.getPropertyValue('--con-parl-slot-count')).to.eq('2');

    // THE READING of the bill under the cursor: its party and name, the viewer's ONE number handed to the one renderer.
    const name = () => w.find('.con-parl__info-name').text();
    expect(w.find('[data-parl-vote-body] .con-parl__info-emblem').attributes('src')).to.eq(partyEmblemUrl(PartyName.GREENS));
    expect(name()).to.eq($t(shipped(AQUIFER).text.name));
    expect(w.find('[data-parl-kicker="reading"]').text()).to.eq($t(READING_KICKER_SEATED));
    expect(w.find('[data-parl-info="own"]').attributes('data-parl-subject')).to.eq(BLUE);
    const reading = () => w.findComponent(YieldStub);
    expect(reading().props('oneNumber')).to.eq(true);
    expect(reading().props('size'), 'a hosted door\'s band keeps its compact pieces').to.eq('compact');
    expect((reading().props('yields') as Array<{context: string}>).map((y) => y.context)).to.deep.eq(['estimate']);
    // The row of seats compares the table: the viewer's chip first, then the model's order.
    const ledger = w.findComponent(LedgerStub);
    expect((ledger.props('chips') as Array<{color: Color}>).map((chip) => chip.color)).to.deep.eq([BLUE, RED]);
    expect(ledger.props('subject')).to.eq(BLUE);
    // This vote's consequences — tiles, one per fact.
    const facts = w.findAllComponents(FactStub);
    expect(facts.length).to.be.greaterThan(0);
    expect(facts.every((fact) => fact.props('variant') === 'tile' && fact.props('fact') !== undefined)).to.eq(true);

    // THE FOOT: where the delegate leaves from (the lobby's is free), the viewer's own figure, the confirm's words.
    const source = w.find('[data-parl-vote-source]');
    expect(source.attributes('aria-label')).to.eq($t(VOTE_KICKER));
    expect(source.find('[data-parl-vote-count]').attributes('data-parl-vote-count')).to.eq('1');
    expect(source.find('[data-parl-vote-count]').text()).to.eq($t('from the lobby · free'));
    expect(source.findComponent(DelegateStub).props('color')).to.eq(BLUE);
    const cta = w.find('[data-parl-cta]');
    expect(cta.find('.con-parl__cta-label').text()).to.eq(translateText('Send the delegate'));
    expect(cta.classes(), '«ready» is the standing mode\'s, never the hidden layer\'s').to.not.include('con-parl__cta--ready');
    expect(cta.find('.glyph-stub').exists()).to.eq(false);

    // The cursor walks to the other bill: the same surface reads it in place.
    parliamentFlow.slotIndex = 1;
    await nextTick();
    expect(name()).to.eq($t(shipped(GRID).text.name));
    expect(accent()).to.eq(partyAccent(PartyName.INDUSTRIALISTS));

    // THE MODE STANDS: the layer is up, the door is the vote's, the confirm is ready with the pad's A and its price.
    parliamentFlow.stage = 'vote';
    await nextTick();
    expect(w.classes()).to.include('con-parl__vote--up');
    expect(w.classes()).to.not.include('con-parl__vote--committed');
    expect(w.attributes('aria-hidden')).to.eq(undefined);
    expect(w.attributes('data-parl-vote-door')).to.eq('vote');
    expect(cta.classes()).to.include('con-parl__cta--ready');
    expect(w.findComponent(GlyphStub).props('control')).to.eq('confirm');
    expect(cta.find('[data-parl-cta-cost]').attributes('data-cost-kind')).to.eq('free');

    // A delegate from the RESERVE costs the server's own M€ — on the source line and on the confirm's plate.
    const paid = {...(w.props('voteTile' as never) as Record<string, unknown>), source: 'reserve', cost: 4};
    await w.setProps({benchSource: 'reserve', voteTile: paid});
    expect(w.attributes('data-parl-vote-source-kind')).to.eq('reserve');
    expect(w.find('[data-parl-vote-source] .con-parl__info-src-num').text()).to.eq('4');
    expect(cta.find('[data-parl-cta-cost]').attributes('data-cost-kind')).to.eq('cost');
    expect(cta.find('[data-parl-cta-cost]').attributes('data-cost-amount')).to.eq('4');

    // A vote the server refuses: the confirm is blocked and carries the ONE reason.
    await w.setProps({canVoteNow: false, voteTile: {...paid, available: false, reason: REFUSED}});
    expect(cta.classes()).to.include('con-parl__cta--blocked');
    expect(cta.classes()).to.not.include('con-parl__cta--ready');
    expect(cta.find('.con-parl__cta-label').text()).to.eq(translateText(REFUSED));
    expect(cta.find('.glyph-stub').exists()).to.eq(false);

    // IN THE HALL the panel is the chamber's whole rect: the reading takes the panel's own scale, and the fit reads the
    // mode's ROOT ELEMENT (its template ref) for the reading it seats.
    consoleParliamentUi.hall = true;
    parliamentFlow.slotIndex = 0;
    await nextTick();
    expect(reading().props('size')).to.eq('normal');
    expect(w.find('.con-parl__info-readings').attributes('data-reading-fit'), 'the reading was fitted in its frame').to.not.eq(undefined);
  });

  it('a PARENT\'s ref sees the six doors the section opens and nothing else — the pad\'s verbs and the commit go through it', async () => {
    parliamentFlow.stage = 'vote';
    const paid = {source: 'reserve', cost: 4, available: false, reason: REFUSED};
    const {held, heard, hand} = underParent({canVoteNow: false});
    await hand({voteTile: {...(modeProps().voteTile as Record<string, unknown>), ...paid}});
    expect(held.value, 'the parent\'s ref is set').to.not.eq(null);
    expect(Object.keys(held.value!), 'exactly what the mode exposes').to.have.members(
      ['closeVote', 'enterArmedVote', 'openVote', 'answerWhilePaying', 'answerAfterSubmit', 'handleIntent']);
    const leaked = ['view', 'bridge', 'flow', 'root', 'voteInfo', 'voteSlot', 'submitVote', 'landVote', 'clearLanding', 'inspect', 'cubesInAir', 'confirmOwed']
      .filter((key) => (held.value as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
    const pad = held.value!.handleIntent;

    // ◀ ▶ select among the proposals — the row has edges.
    pad({kind: 'nav', dir: 'right', repeat: false});
    expect(parliamentFlow.slotIndex).to.eq(1);
    pad({kind: 'nav', dir: 'right', repeat: false});
    expect(parliamentFlow.slotIndex, 'clamped at the last bill').to.eq(1);
    pad({kind: 'nav', dir: 'left', repeat: false});
    expect(parliamentFlow.slotIndex).to.eq(0);

    // LB / RB move the SUBJECT of the reading along the row of seats — a ring: the viewer's own chip is one step away.
    pad({kind: 'press', button: 'bumperR'});
    expect(parliamentFlow.voteSubject).to.eq(RED);
    pad({kind: 'press', button: 'bumperR'});
    expect(parliamentFlow.voteSubject, 'the viewer\'s own seat is «no subject»').to.eq(undefined);
    pad({kind: 'press', button: 'bumperL'});
    expect(parliamentFlow.voteSubject).to.eq(RED);

    // X — the inspector over ALL the proposals, opened on the bill under the cursor; its paging moves the selection.
    pad({kind: 'press', button: 'secondary'});
    expect(heard.map(([event]) => event)).to.deep.eq(['inspect']);
    const request = heard[0][1] as {kind: string, ids: Array<string>, index: number, onBrowse(index: number): void, vote: {execute(index: number): void}};
    expect(request).to.deep.include({kind: 'resolution', ids: [AQUIFER, GRID], index: 0});
    request.onBrowse(1);
    expect(parliamentFlow.slotIndex).to.eq(1);
    request.onBrowse(0);

    // A on a vote the server refuses: the ONE reason, nothing sent, nothing remembered.
    pad({kind: 'press', button: 'confirm'});
    expect(heard[1]).to.deep.eq(['notice', translateText(REFUSED)]);
    expect(parliamentFlow.voteSnapshot).to.eq(undefined);
    expect(parliamentFitFrozen()).to.eq(false);

    // A on a vote on offer: the commit boundary is the VIEWER's own — the reading comes home, the numbers of the press
    // are remembered, the fit freezes, and the answer is the action menu's vote branch for the bill's party.
    await hand({canVoteNow: true, voteTile: modeProps().voteTile});
    pad({kind: 'press', button: 'confirm'});
    expect(heard[2]).to.deep.eq(['send', {response: {type: 'or', index: 3, response: {type: 'party', partyName: PartyName.GREENS}}, from: 'vote'}]);
    expect(parliamentFlow.voteSubject).to.eq(undefined);
    expect(parliamentFlow.voteSnapshot).to.deep.include({votes: 0, mine: 0, winning: false, source: 'lobby', count: 1});
    expect(parliamentFitFrozen()).to.eq(true);

    // The answer placed NOTHING (no delegate on the bill, no bill to pay): the mode folds back and the flow ends.
    parliamentFlow.stageBeforeSubmit = 'vote';
    parliamentFlow.stage = 'submitting';
    held.value!.answerAfterSubmit();
    expect(heard[3]).to.deep.eq(['flow-complete', 'vote']);
    expect(parliamentFlow.stage).to.eq('browse');
    expect(parliamentFlow.voteSnapshot).to.eq(undefined);
    expect(parliamentFitFrozen(), 'the fit is thawed with the fold').to.eq(false);

    // …and so does a bill that left unpaid.
    parliamentFlow.stage = 'paying';
    held.value!.answerWhilePaying();
    expect(heard[4]).to.deep.eq(['flow-complete', 'vote']);
    expect(parliamentFlow.stage).to.eq('browse');

    // `openVote` with no Parliament on screen says so and opens nothing.
    held.value!.openVote({index: 1});
    expect(heard[5]).to.deep.eq(['notice', translateText('Not in this game')]);
    expect([parliamentFlow.stage, parliamentFlow.slotIndex]).to.deep.eq(['browse', 0]);

    // `enterArmedVote` plays the fresh entrance of a vote armed over a mounted mode (nothing to play it on — it ends at once);
    // `closeVote` folds a standing mode, and only a standing one.
    armGrantVoteFlow(1);
    held.value!.enterArmedVote();
    expect(parliamentFlow.voteEntering).to.eq(true);
    await nextTick();
    expect(parliamentFlow.voteEntering).to.eq(false);
    expect(parliamentFlow.stage).to.eq('vote');
    held.value!.closeVote();
    expect(parliamentFlow.stage).to.eq('browse');
    held.value!.closeVote();
    expect(heard.length, 'a fold is not an end of the flow, and a second one is nothing').to.eq(6);
  });

  it('the answer that LANDED the delegate plays on this stage under its hold — and the hold\'s ceiling ends the flow by the mode\'s own hand, once', async () => {
    parliamentFlow.stage = 'vote';
    const {wrapper, held, heard, hand} = underParent();
    const root = () => wrapper.find('[data-parl-vote]');
    const cta = () => wrapper.find('[data-parl-cta]');
    const ended = () => heard.filter(([event]) => event === 'flow-complete');
    held.value!.handleIntent({kind: 'press', button: 'confirm'});
    expect(heard.map(([event]) => event)).to.deep.eq(['send']);
    parliamentFlow.stageBeforeSubmit = 'vote';
    parliamentFlow.stage = 'submitting';
    await nextTick();
    expect(cta().classes()).to.include('con-parl__cta--busy');
    expect(cta().find('.con-parl__cta-label').text()).to.eq(translateText('Performing…'));

    // The server's answer: the viewer's delegate stands on the bill.
    await hand(modeProps({}, true));
    held.value!.answerAfterSubmit();
    expect(parliamentFlow.stage).to.eq('landed');
    expect(holding()).to.eq(true);
    expect(parliamentFlow.sourceHold, 'the bench keeps the cube until it lifts').to.eq('lobby');
    expect(ended()).to.deep.eq([]);

    // Nothing measurable to fly over (no Parliament root): the cube is simply there, and the landed READ begins.
    await nextTick();
    await nextTick();
    expect(parliamentFlow.landedSeq).to.eq(LANDED_SEQ);
    expect(parliamentFlow.landedSeqs).to.deep.eq([LANDED_SEQ]);
    expect(parliamentFlow.sourceHold).to.eq(undefined);
    expect(root().classes()).to.include.members(['con-parl__vote--up', 'con-parl__vote--committed', 'con-parl__vote--landed']);
    expect(cta().classes()).to.include('con-parl__cta--done');
    expect(cta().find('.con-parl__cta-label').text()).to.eq(translateText('Delegate placed'));
    expect(holding(), 'the read stands under the landing\'s hold').to.eq(true);
    expect(ended()).to.deep.eq([]);

    // THE CEILING ENDS THE LANDING: the hold's recovery is the mode's own — the read cut, the flow ended, the hold let go.
    const warnings = collectingWarnings(() => {
      expect(expireAnimationHoldNow(HOLD)).to.eq(true);
    });
    expect(warnings.some((line) => line.includes('vote landing: outlived its ceiling'))).to.eq(true);
    expect(ended()).to.deep.eq([['flow-complete', 'vote']]);
    expect(holding()).to.eq(false);
    expect(parliamentFlow.landedSeq, 'the landed reading stands until the surface leaves').to.eq(LANDED_SEQ);

    // The surface leaves: the landing's marks go with it, the fit thaws — and the end was said once.
    wrapper.unmount();
    expect(held.value, 'the parent\'s ref is cleared').to.eq(null);
    expect(parliamentFlow.landedSeq).to.eq(undefined);
    expect(parliamentFitFrozen()).to.eq(false);
    expect(ended().length).to.eq(1);
  });
});
