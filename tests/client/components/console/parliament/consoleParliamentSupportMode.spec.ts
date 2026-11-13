/*
 * ConsoleParliamentSupportMode — «САНКЦИИ» (Turmoil Redux TR12 Party Sanctions): the reading of the party plaque under
 * the cursor, the pad's verbs over the ring, the commit and its answer on the same stage. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md), so a parent's template ref of it is ONLY what it `defineExpose`s — and
 * `ConsoleParliamentSection` reaches it exactly so: `answerAfterSubmit()` and `handleIntent()` by name, `closeFinished()`
 * through the keyed read of its `foldFinishedStage`. This spec is what it renders for the server's rows, what it
 * emits, and that contract.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef} from 'vue';
import {gsap} from 'gsap';
import {globalConfig} from '../../getLocalVue';
import {$t, translateText} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectPartyModel, SupportPromptMeta} from '@/common/models/PlayerInputModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {activeAnimationHoldLabels, expireAnimationHoldNow} from '@/client/components/presentation/animationHold';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {armSupportPickFlow, parliamentFlow, resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {freezeParliamentFit, parliamentFitFrozen} from '@/client/console/parliament/parliamentCardFit';
import {stagedDoorVerb} from '@/client/console/parliament/parliamentCommands';
import {CARD_DOOR_RECEIPT} from '@/client/console/parliament/voteInfoModel';
import {agendaWalkFlow, OwedAgendaWalk, resetAgendaWalkFlow} from '@/client/console/parliament/agendaWalk';
import {clearSupportDiscard, supportDiscardFlow} from '@/client/console/parliament/supportDiscard';
import {emptyParliamentView, ParliamentPartyVm, ParliamentPromptBridge, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {SUPPORT_DISCARD_RULE_KEY} from '@/client/components/console/parliament/consoleParliamentSupportModeModel';
import ConsoleParliamentSupportMode from '@/client/components/console/parliament/ConsoleParliamentSupportMode.vue';

// The plaque's places and the pad's badge are their own specs' subjects; this one reads what the mode HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const PlacesStub = defineComponent({name: 'ConsoleSupportPlaces', props: {filled: Number, outgoing: Number}, render: () => h('i', {class: 'places-stub'})});
const GlyphStub = defineComponent({name: 'GamepadGlyph', props: {control: String}, render: () => h('i', {class: 'glyph-stub'})});

const global = {...globalConfig.global, stubs: {ConsoleSupportPlaces: PlacesStub, GamepadGlyph: GlyphStub}};

const BLUE: Color = 'blue';
const PROTECTED = 'This support area is protected';
/** The blocking hold the outcome plays under (the registry prints a hold as `label[scope]`). */
const HOLD = 'parliament-support-discard';
const holding = (): boolean => activeAnimationHoldLabels().some((label) => label.startsWith(HOLD));

/** The server's rows: Mars First's three cubes on offer, the Scientists' area refused by name, Unity's empty one refused with no reason, the ruling Greens' two on offer. */
const META: SupportPromptMeta = {
  source: 'discard',
  areas: [
    {party: PartyName.MARS, current: 3, resulting: 0, available: true},
    {party: PartyName.SCIENTISTS, current: 1, resulting: 1, available: false, reason: PROTECTED},
    {party: PartyName.UNITY, current: 0, resulting: 0, available: false},
    {party: PartyName.GREENS, current: 2, resulting: 0, available: true},
  ],
};

const party = (name: PartyName, support: number): ParliamentPartyVm => ({party: name, support}) as unknown as ParliamentPartyVm;

/** The hall: three benches of the opposition and the ruler on the dais — the mode reads the parties' ORDER and their support. */
function hall(marsSupport = 3): ParliamentViewVm {
  return {
    ...emptyParliamentView(),
    rulingParty: PartyName.GREENS,
    parties: [party(PartyName.MARS, marsSupport), party(PartyName.SCIENTISTS, 1), party(PartyName.UNITY, 0), party(PartyName.GREENS, 2)],
  };
}

function bridge(over: {card?: CardName, staged?: boolean, parties?: ReadonlyArray<PartyName>} = {}): ParliamentPromptBridge {
  return {
    vote: undefined, actions: {}, resolutionAction: undefined, seat: undefined, grant: undefined, delegatePick: undefined, bannerPick: undefined,
    supportPick: {
      model: {type: 'party', parties: over.parties ?? [PartyName.MARS, PartyName.GREENS]} as unknown as SelectPartyModel, meta: META,
      ...(over.card === undefined ? {} : {card: over.card}), ...(over.staged === undefined ? {} : {staged: over.staged}),
    },
  };
}

/** The bridge once the pick is ANSWERED: the server asks it no more. */
const ANSWERED: ParliamentPromptBridge = {...bridge(), supportPick: undefined};

/** The viewer's own table — what a staged door's commit is read off. */
function table(over: {tableau?: ReadonlyArray<CardName>, actions?: ReadonlyArray<CardName>} = {}): PlayerViewModel {
  return {thisPlayer: {tableau: (over.tableau ?? []).map((name) => ({name})), actionsThisGeneration: over.actions ?? []}} as unknown as PlayerViewModel;
}

function modeProps(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {view: hall(), playerView: table(), viewerColor: BLUE, bridge: bridge(), ...over};
}

function mode(over: Record<string, unknown> = {}) {
  return mount(ConsoleParliamentSupportMode as any, {...globalConfig, props: modeProps(over), global});
}

type ModeRef = {answerAfterSubmit(): void, handleIntent(intent: GamepadIntent): void, closeFinished(): void};

/** The mode under a PARENT that holds a ref to it and hears its events — what that ref carries is what the section's `supportMode` ref does. */
function underParent(over: Record<string, unknown> = {}) {
  const held = shallowRef<ModeRef | null>(null);
  const heard: Array<[string, unknown]> = [];
  const handed = shallowRef(modeProps(over));
  /** The section hands the mode new props (the answer's view: the area emptied, the prompt gone from the bridge). */
  const hand = async (next: Record<string, unknown>): Promise<void> => {
    handed.value = {...handed.value, ...next};
    await nextTick();
  };
  const Parent = defineComponent({
    name: 'SupportModeParent',
    setup: () => () => h('div', {'data-parent': ''}, [h(ConsoleParliamentSupportMode as never, {
      ...handed.value,
      ref: held,
      onNotice: (text: string) => heard.push(['notice', text]),
      onInspect: (request: unknown) => heard.push(['inspect', request]),
      onInspectSource: (card: CardName) => heard.push(['inspect-source', card]),
      onSend: (payload: unknown) => heard.push(['send', payload]),
      onFlowComplete: (stage: string) => heard.push(['flow-complete', stage]),
      onPlayWalk: (then: () => void) => heard.push(['play-walk', then]),
    })]),
  });
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

/** A long beat of the MOTION clock (GSAP's — a Parliament beat rides it). */
function passMotionBeat(seconds: number = 5): void {
  gsap.globalTimeline.time(gsap.globalTimeline.time() + seconds);
}

describe('ConsoleParliamentSupportMode — the support area under the cursor, its verbs, and what a parent reaches through its ref', () => {
  let clock: ManualFlowClock;

  // The flow, the holds, the fit's freeze, the discard record and the walk's are module state the whole bundle shares:
  // every test starts from, and leaves, the clean one. The probe's tick is a wait of the flow kernel — the spec drives
  // its clock.
  const clean = (): void => {
    resetParliamentFlow();
    resetParliamentHolds();
    clearSupportDiscard();
    supportDiscardFlow.degraded = '';
    resetAgendaWalkFlow();
    freezeParliamentFit(false);
  };
  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    clean();
    armSupportPickFlow({zone: 'parties', partyIndex: 0}, 'Sanctions', false, META);
  });
  afterEach(async () => {
    clock.advance(PROBE_TICK_FALLBACK_MS + 1);
    await flushPromises();
    setFlowClock(undefined);
    clean();
  });

  /** The answer that EMPTIED Mars First's area, as the apply block's seed leaves it: three cubes owed to the common supply. */
  async function landTheAnswer(hand: (next: Record<string, unknown>) => Promise<void>): Promise<void> {
    await hand({view: hall(0), bridge: ANSWERED});
    supportDiscardFlow.promised = undefined;
    supportDiscardFlow.owed = {party: PartyName.MARS, count: 3};
    supportDiscardFlow.standing = 3;
    supportDiscardFlow.toPool = 3;
  }

  it('reads the plaque under the cursor: the party, its area «N → 0» with the cubes that leave, the rule — and a refused area\'s one reason; follows the cursor', async () => {
    const w = mode();
    // The template STARTS WITH ITS ROOT (its opening comment lives in the script now).
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.deep.eq(['con-parl__support']);
    expect(w.attributes('data-parl-support-mode')).to.not.eq(undefined);
    expect(w.attributes('data-support-beat')).to.eq(undefined);
    expect(w.attributes('data-support-staged')).to.eq(undefined);
    expect(w.attributes('style')).to.contain('--parl-accent');
    expect(w.attributes('style')).to.contain(partyAccent(PartyName.MARS));

    const reading = () => w.find('[data-parl-support-reading]');
    expect([reading().attributes('data-support-party'), reading().attributes('data-support-current'), reading().attributes('data-support-resulting')])
      .to.deep.eq([PartyName.MARS, '3', '0']);
    expect(reading().attributes('data-support-available')).to.eq('');
    expect(reading().find('.con-parl__support-emblem').attributes('src')).to.eq(partyEmblemUrl(PartyName.MARS));
    expect(reading().find('.con-parl__support-name').text()).to.eq($t(partyNameKey(PartyName.MARS)));
    expect(reading().find('.con-parl__support-kicker').text()).to.eq($t('Popular support'));
    const places = () => w.findComponent(PlacesStub);
    expect([places().props('filled'), places().props('outgoing')], 'every cube of the area would leave').to.deep.eq([3, 3]);
    expect(w.find('[data-parl-support-num]').text().replace(/\s+/g, '')).to.eq('3→0');
    expect(w.find('[data-parl-support-rule]').text()).to.eq($t(SUPPORT_DISCARD_RULE_KEY));
    expect(w.find('[data-parl-support-reason]').exists()).to.eq(false);
    expect(w.find('[data-parl-support-receipt]').exists(), 'no staged door — no receipt').to.eq(false);

    // «Выбрать» while the pick is open and the area is on offer.
    const cta = w.find('[data-parl-support-cta]');
    expect(cta.classes()).to.include('con-parl__cta--ready');
    expect(w.findComponent(GlyphStub).props('control')).to.eq('confirm');
    expect(cta.find('.con-parl__cta-label').text()).to.eq(translateText('Select'));

    // The cursor walks to a REFUSED area: the server's one reason instead of the rule, no «N → 0», the confirm blocked and saying why.
    parliamentFlow.partyIndex = 1;
    await nextTick();
    expect(reading().attributes('data-support-party')).to.eq(PartyName.SCIENTISTS);
    expect(reading().attributes('data-support-available')).to.eq(undefined);
    expect([places().props('filled'), places().props('outgoing')], 'a refused area sends nothing').to.deep.eq([1, 0]);
    expect(w.find('[data-parl-support-num]').exists()).to.eq(false);
    expect(w.find('[data-parl-support-rule]').exists()).to.eq(false);
    expect(w.find('[data-parl-support-reason]').text()).to.eq($t(PROTECTED));
    expect(cta.classes()).to.include('con-parl__cta--blocked');
    expect(cta.classes()).to.not.include('con-parl__cta--ready');
    expect(cta.find('.glyph-stub').exists()).to.eq(false);
    expect(cta.find('.con-parl__cta-label').text()).to.eq(translateText(PROTECTED));

    // A refusal the server gave no reason for is the empty area's.
    parliamentFlow.partyIndex = 2;
    await nextTick();
    expect(w.find('[data-parl-support-reason]').text()).to.eq($t('The support area is empty'));
    expect(cta.find('.con-parl__cta-label').text()).to.eq(translateText('The support area is empty'));

    // …and onto the dais: the ruler's area.
    parliamentFlow.zone = 'ruler';
    await nextTick();
    expect(reading().attributes('data-support-party')).to.eq(PartyName.GREENS);
    expect([places().props('filled'), places().props('outgoing')]).to.deep.eq([2, 2]);
    expect(w.attributes('style')).to.contain(partyAccent(PartyName.GREENS));
  });

  it('a STAGED card door shows its locked receipt and confirms with the door\'s own verb — the play\'s, or the action\'s', async () => {
    const receipt = {amount: 7, icon: 'megacredits'};
    const w = mode({bridge: bridge({card: CardName.ANTS, staged: true}), cardReceipt: receipt});
    expect(w.attributes('data-support-staged')).to.eq('');
    const lock = w.find('[data-parl-support-receipt]');
    expect([lock.attributes('data-receipt-cost'), lock.attributes('data-receipt-icon')]).to.deep.eq(['7', 'megacredits']);
    expect(lock.find('.con-parl__info-receipt-key').text()).to.eq($t(CARD_DOOR_RECEIPT));
    expect(lock.find('.con-parl__info-src-num').text()).to.eq('7');
    expect(lock.find('.con-parl__info-src-mc').classes()).to.include.members(iconClassFor('megacredits').split(' ').filter((c) => c !== ''));
    const label = () => w.find('[data-parl-support-cta] .con-parl__cta-label').text();
    expect(label()).to.eq(translateText(stagedDoorVerb('play')));
    await w.setProps({stagedFlow: 'action'});
    expect(label()).to.eq(translateText(stagedDoorVerb('action')));

    // A LIVE door handed a receipt shows none while the pick is open: there is no composer behind it to have settled a price.
    const live = mode({cardReceipt: receipt});
    expect(live.find('[data-parl-support-receipt]').exists()).to.eq(false);
  });

  it('the confirm: a refused area names its reason and sends nothing; an area on offer sends the party answer, promises its discard, latches the pick and freezes the fit', async () => {
    parliamentFlow.partyIndex = 1;
    const w = mode({bridge: bridge({card: CardName.ANTS})});
    const cta = w.find('[data-parl-support-cta]');
    await cta.trigger('click');
    expect(w.emitted('notice')).to.deep.eq([[translateText(PROTECTED)]]);
    expect(w.emitted('send')).to.eq(undefined);
    expect(parliamentFlow.supportSnapshot).to.eq(undefined);
    expect(supportDiscardFlow.promised).to.eq(undefined);
    expect(parliamentFitFrozen()).to.eq(false);

    parliamentFlow.partyIndex = 0;
    await nextTick();
    await cta.trigger('click');
    expect(w.emitted('send')).to.deep.eq([[{response: {type: 'party', partyName: PartyName.MARS}, from: 'support'}]]);
    expect(w.emitted('notice')?.length).to.eq(1);
    expect(parliamentFlow.supportSnapshot).to.deep.eq({party: PartyName.MARS, current: 3});
    expect(parliamentFlow.supportMeta).to.deep.eq(META);
    expect(supportDiscardFlow.promised, 'a LIVE door\'s press promises its discard, addressed to its card').to.deep.eq({party: PartyName.MARS, card: CardName.ANTS});
    expect(parliamentFitFrozen()).to.eq(true);

    // A press that is already in is not a second press: the confirm is a status now, the reading is the CHOSEN area.
    parliamentFlow.supportCommitted = true;
    parliamentFlow.partyIndex = 1;
    await nextTick();
    await cta.trigger('click');
    expect(w.emitted('send')?.length).to.eq(1);
    expect(w.classes()).to.include('con-parl__support--committed');
    expect(cta.classes()).to.include('con-parl__cta--busy');
    expect(cta.find('.glyph-stub').exists()).to.eq(false);
    expect(cta.find('.con-parl__cta-label').text()).to.eq(translateText('Performing…'));
    expect(w.find('[data-parl-support-reading]').attributes('data-support-party'), 'not the cursor\'s area').to.eq(PartyName.MARS);
  });

  it('an area the prompt no longer offers names itself and sends nothing; a STAGED door addresses its answer to the card and leaves the promise to the shell\'s commit', async () => {
    const stale = mode({bridge: bridge({parties: [PartyName.GREENS]})});
    await stale.find('[data-parl-support-cta]').trigger('click');
    expect(stale.emitted('notice')).to.deep.eq([[translateText('This option is no longer offered')]]);
    expect(stale.emitted('send')).to.eq(undefined);
    expect(parliamentFitFrozen()).to.eq(false);
    stale.unmount();

    const staged = mode({bridge: bridge({card: CardName.ANTS, staged: true})});
    await staged.find('[data-parl-support-cta]').trigger('click');
    expect(staged.emitted('send')).to.deep.eq([[{response: {type: 'party', partyName: PartyName.MARS, stagedFor: CardName.ANTS}, from: 'support'}]]);
    expect(supportDiscardFlow.promised, 'a refused play can never leave a promise behind').to.eq(undefined);
    expect(parliamentFitFrozen()).to.eq(true);
  });

  it('a PARENT\'s ref sees `answerAfterSubmit` · `handleIntent` · `closeFinished` and nothing else — the pad\'s verbs go through it', () => {
    const {held, heard} = underParent({bridge: bridge({card: CardName.ANTS})});
    expect(held.value, 'the parent\'s ref is set').to.not.eq(null);
    expect(Object.keys(held.value!), 'exactly what the mode exposes').to.deep.eq(['answerAfterSubmit', 'handleIntent', 'closeFinished']);
    const leaked = ['view', 'bridge', 'submit', 'moveTo', 'stopOutcome', 'finish', 'playOutcome', 'flyDiscard', 'afterDiscard', 'reading', 'latchedCard', 'flights']
      .filter((key) => (held.value as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
    const pad = held.value!.handleIntent;

    // The d-pad walks the plaques as the hall lays them out: ▼ down the opposition's column, ▶ onto the dais, ◀ back
    // to the bench the cursor left.
    pad({kind: 'nav', dir: 'down', repeat: false});
    expect([parliamentFlow.zone, parliamentFlow.partyIndex]).to.deep.eq(['parties', 1]);
    pad({kind: 'nav', dir: 'right', repeat: false});
    expect(parliamentFlow.zone).to.eq('ruler');
    pad({kind: 'nav', dir: 'left', repeat: false});
    expect([parliamentFlow.zone, parliamentFlow.partyIndex]).to.deep.eq(['parties', 1]);

    // L3 — the card that asks; X — the plaque under the cursor; A — the commit (refused here, by name).
    pad({kind: 'press', button: 'stickL'});
    pad({kind: 'press', button: 'secondary'});
    pad({kind: 'press', button: 'confirm'});
    expect(heard.map(([name]) => name)).to.deep.eq(['inspect-source', 'inspect', 'notice']);
    expect(heard[0][1]).to.eq(CardName.ANTS);
    expect(heard[1][1]).to.deep.include({kind: 'party', party: PartyName.SCIENTISTS});
    expect(heard[2][1]).to.eq(translateText(PROTECTED));

    // A on an area on offer sends; a committed mode takes no verb.
    pad({kind: 'nav', dir: 'up', repeat: false});
    pad({kind: 'press', button: 'confirm'});
    expect(heard[3]).to.deep.eq(['send', {response: {type: 'party', partyName: PartyName.MARS}, from: 'support'}]);
    parliamentFlow.stage = 'submitting';
    parliamentFlow.supportCommitted = true;
    pad({kind: 'nav', dir: 'down', repeat: false});
    pad({kind: 'press', button: 'confirm'});
    expect(parliamentFlow.partyIndex).to.eq(0);
    expect(heard.length).to.eq(4);

    // The answer that RE-ASKED the card's own pick stands the mode again, in place and LIVE — the cursor kept.
    held.value!.answerAfterSubmit();
    expect(parliamentFlow.stage).to.eq('support');
    expect([parliamentFlow.supportCommitted, parliamentFlow.supportLive]).to.deep.eq([false, true]);
    expect(parliamentFlow.supportSnapshot).to.eq(undefined);
    expect(parliamentFitFrozen(), 'the fit is thawed with the re-ask').to.eq(false);
    expect(parliamentFlow.partyIndex).to.eq(0);
    expect(heard.some(([name]) => name === 'flow-complete')).to.eq(false);
  });

  it('a STAGED door: an answer that has not committed the card keeps waiting; the committed one — a play on the table, an action recorded as used — leaves whole, nothing flies', () => {
    const staged = {bridge: bridge({card: CardName.ANTS, staged: true})};
    const waiting = underParent(staged);
    waiting.held.value!.handleIntent({kind: 'press', button: 'confirm'});
    expect(waiting.heard.map(([name]) => name)).to.deep.eq(['send']);
    // A key that moved for somebody else's reason while the staged commit is still on the wire.
    waiting.held.value!.answerAfterSubmit();
    expect(parliamentFlow.supportCommitted).to.eq(false);
    expect(waiting.heard.length).to.eq(1);
    waiting.wrapper.unmount();

    // The card is on the table (PARKED behind another prompt — the area did not shrink): the step ends at once.
    const landed = underParent({...staged, playerView: table({tableau: [CardName.ANTS]})});
    landed.held.value!.handleIntent({kind: 'press', button: 'confirm'});
    landed.held.value!.answerAfterSubmit();
    expect([parliamentFlow.supportCommitted, parliamentFlow.supportBeat]).to.deep.eq([true, 'done']);
    expect(landed.heard.map(([name]) => name)).to.deep.eq(['send', 'flow-complete']);
    expect(landed.heard[1][1]).to.eq('support');
    expect(holding(), 'no flight — no hold').to.eq(false);
    landed.wrapper.unmount();

    // An ACTION's card is on the table the whole time: its commit is the action recorded as used, never the tableau.
    resetParliamentFlow();
    armSupportPickFlow({zone: 'parties', partyIndex: 0}, 'Sanctions', false, META);
    const action = underParent({...staged, stagedFlow: 'action', playerView: table({tableau: [CardName.ANTS]})});
    action.held.value!.handleIntent({kind: 'press', button: 'confirm'});
    action.held.value!.answerAfterSubmit();
    expect(parliamentFlow.supportCommitted, 'on the table is no witness of an action').to.eq(false);
    action.wrapper.unmount();
    const used = underParent({...staged, stagedFlow: 'action', playerView: table({tableau: [CardName.ANTS], actions: [CardName.ANTS]})});
    used.held.value!.handleIntent({kind: 'press', button: 'confirm'});
    used.held.value!.answerAfterSubmit();
    expect([parliamentFlow.supportCommitted, parliamentFlow.supportBeat]).to.deep.eq([true, 'done']);
    expect(used.heard.map(([name]) => name)).to.deep.eq(['send', 'flow-complete']);
  });

  it('the answer that EMPTIED the area plays on this stage — the cubes, the read — and ends by the mode\'s own hand; `closeFinished` folds only a finished mode', async () => {
    const {wrapper, held, heard, hand} = underParent();
    const root = () => wrapper.find('[data-parl-support-mode]');
    const cta = () => wrapper.find('[data-parl-support-cta]');
    const places = () => wrapper.findComponent(PlacesStub);
    held.value!.handleIntent({kind: 'press', button: 'confirm'});
    expect(heard.map(([name]) => name)).to.deep.eq(['send']);

    await landTheAnswer(hand);
    held.value!.answerAfterSubmit();
    expect([parliamentFlow.supportCommitted, parliamentFlow.supportBeat]).to.deep.eq([true, 'discard']);
    expect(holding()).to.eq(true);
    await nextTick();
    expect(root().classes()).to.include('con-parl__support--committed');
    expect(root().attributes('data-support-beat')).to.eq('discard');
    expect(cta().classes()).to.include('con-parl__cta--busy');
    expect(cta().find('.con-parl__cta-label').text()).to.eq(translateText('Performing…'));
    // The reading is the CHOSEN area as it stood at the press (off the latched meta), its cubes still standing on the plaque.
    const reading = wrapper.find('[data-parl-support-reading]');
    expect([reading.attributes('data-support-party'), reading.attributes('data-support-current')]).to.deep.eq([PartyName.MARS, '3']);
    expect([places().props('filled'), places().props('outgoing')]).to.deep.eq([3, 0]);

    // A mode still at work is never closed by the question door.
    held.value!.closeFinished();
    expect(parliamentFitFrozen()).to.eq(true);
    expect(holding()).to.eq(true);

    // No Parliament root stands in a unit mount, so nothing can be measured: the probe's tick settles the record — the
    // plaque reads the server again — and the hold lets go with the cubes.
    await flushPromises();
    clock.advance(PROBE_TICK_FALLBACK_MS + 1);
    await flushPromises();
    expect(supportDiscardFlow.owed, 'the area and the pool read the server again').to.eq(undefined);
    expect(holding()).to.eq(false);
    expect(places().props('filled')).to.eq(0);
    expect(parliamentFlow.supportBeat, 'a breath before the next beat').to.eq('discard');

    // The beats ride the motion clock: the gap, then — the track owed no walk — the READ of the empty area.
    passMotionBeat();
    expect(parliamentFlow.supportBeat).to.eq('read');
    expect(heard.some(([name]) => name === 'flow-complete' || name === 'play-walk')).to.eq(false);
    passMotionBeat();
    expect(parliamentFlow.supportBeat).to.eq('done');
    expect(heard.filter(([name]) => name === 'flow-complete')).to.deep.eq([['flow-complete', 'support']]);
    await nextTick();
    expect(cta().classes()).to.include('con-parl__cta--done');
    expect(cta().find('.con-parl__cta-label').text()).to.eq(translateText('Sanctions applied'));

    // …and now the door folds it: the fit thawed, the latch let go. A second end is not a second event.
    held.value!.closeFinished();
    expect(parliamentFitFrozen()).to.eq(false);
    wrapper.unmount();
    expect(held.value, 'the parent\'s ref is cleared').to.eq(null);
    expect(heard.filter(([name]) => name === 'flow-complete').length).to.eq(1);
  });

  it('a card that owes its AGENDA STEP hands the section the walk after the cubes — and ends when the walk calls back', async () => {
    const {held, heard, hand} = underParent();
    held.value!.handleIntent({kind: 'press', button: 'confirm'});
    await landTheAnswer(hand);
    agendaWalkFlow.owed = {} as OwedAgendaWalk;
    held.value!.answerAfterSubmit();
    await flushPromises();
    clock.advance(PROBE_TICK_FALLBACK_MS + 1);
    await flushPromises();
    passMotionBeat();
    expect(parliamentFlow.supportBeat).to.eq('walk');
    expect(heard.map(([name]) => name)).to.deep.eq(['send', 'play-walk']);
    // The read is the walk's now: no beat of this mode ends the flow under it.
    passMotionBeat();
    expect(parliamentFlow.supportBeat).to.eq('walk');

    (heard[1][1] as () => void)();
    expect(parliamentFlow.supportBeat).to.eq('done');
    expect(heard.filter(([name]) => name === 'flow-complete')).to.deep.eq([['flow-complete', 'support']]);
    // A continuation called twice ends nothing twice.
    (heard[1][1] as () => void)();
    expect(heard.filter(([name]) => name === 'flow-complete').length).to.eq(1);
  });

  it('THE CEILING ENDS THE DISCARD: the hold\'s recovery is the mode\'s own — the record settled, the flow going on; an unmount cuts every beat', async () => {
    const {wrapper, held, heard, hand} = underParent();
    held.value!.handleIntent({kind: 'press', button: 'confirm'});
    await landTheAnswer(hand);
    held.value!.answerAfterSubmit();
    expect(parliamentFlow.supportBeat).to.eq('discard');
    expect(holding()).to.eq(true);

    const warnings = collectingWarnings(() => {
      expect(expireAnimationHoldNow(HOLD)).to.eq(true);
    });
    expect(warnings.some((line) => line.includes('support discard: outlived its ceiling'))).to.eq(true);
    expect(supportDiscardFlow.owed).to.eq(undefined);
    expect(holding()).to.eq(false);
    // The probe's tick finds the record settled and changes nothing.
    await flushPromises();
    clock.advance(PROBE_TICK_FALLBACK_MS + 1);
    await flushPromises();
    expect(parliamentFlow.supportBeat).to.eq('discard');

    // The section unmounts before the next beat: the beat is cut — it never fires into a mode that is gone.
    wrapper.unmount();
    passMotionBeat();
    passMotionBeat();
    await flushPromises();
    expect(parliamentFlow.supportBeat).to.eq('discard');
    expect(heard.some(([name]) => name === 'flow-complete' || name === 'play-walk')).to.eq(false);
  });
});
