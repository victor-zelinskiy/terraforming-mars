/*
 * ConsoleParliamentDelegateMode — «ИЗГНАНИЕ» (Turmoil Redux TR72 Banned Delegate:redux; TR74's exchange is the same
 * mode): the reading of the FIGURE under the cursor, the pad's verbs over the ring, the commit and its answer on the
 * same stage. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md), so a parent's template ref of it is
 * ONLY what it `defineExpose`s — and `ConsoleParliamentSection` reaches it exactly so: `answerAfterSubmit()` and
 * `handleIntent()` by name, `closeFinished()` through the keyed read of its `foldFinishedStage`. This spec is what it
 * renders for the server's rows, what it emits, and that contract.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef} from 'vue';
import {gsap} from 'gsap';
import {globalConfig} from '../../getLocalVue';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentDelegateRemovalModel} from '@/common/models/ParliamentModel';
import {DelegatePromptMeta, DelegateTargetProjection, SelectPartyModel} from '@/common/models/PlayerInputModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {activeAnimationHoldLabels, expireAnimationHoldNow} from '@/client/components/presentation/animationHold';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {armDelegatePickFlow, parliamentFlow, resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {freezeParliamentFit, parliamentFitFrozen} from '@/client/console/parliament/parliamentCardFit';
import {delegateRemovalFlow, settleDelegateRemoval} from '@/client/console/parliament/delegateRemoval';
import {CARD_DOOR_RECEIPT, VoteFactVm} from '@/client/console/parliament/voteInfoModel';
import {
  emptyParliamentView, ParliamentPartyVm, ParliamentPromptBridge, ParliamentSlotVm, ParliamentViewVm,
} from '@/client/console/parliament/consoleParliamentModel';
import ConsoleParliamentDelegateMode from '@/client/components/console/parliament/ConsoleParliamentDelegateMode.vue';

// The figure, the fact row and the pad's badge are their own specs' subjects; this one reads what the mode HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const DelegateStub = defineComponent({
  name: 'PlayerDelegate',
  props: {color: String, size: Number, steel: Boolean, glow: {type: Boolean, default: true}},
  render: () => h('i', {class: 'delegate-stub'}),
});
const FactStub = defineComponent({name: 'ConsoleVoteFactRow', props: {fact: Object, figurePx: Number}, render: () => h('i', {class: 'fact-stub'})});
const GlyphStub = defineComponent({name: 'GamepadGlyph', props: {control: String}, render: () => h('i', {class: 'glyph-stub'})});

const global = {...globalConfig.global, stubs: {PlayerDelegate: DelegateStub, ConsoleVoteFactRow: FactStub, GamepadGlyph: GlyphStub}};

const BLUE: Color = 'blue';
/** The blocking hold the outcome plays under (the registry prints a hold as `label[scope]`). */
const HOLD = 'parliament-delegate-removal';
const holding = (): boolean => activeAnimationHoldLabels().some((label) => label.startsWith(HOLD));

/** The server's rows: Bob's figure on Mars First's bill (it leads there), a neutral one on the Scientists', a neutral one in the Greens' support. */
const RED_ON_MARS: DelegateTargetProjection = {
  place: 'resolution', owner: 'red', party: PartyName.MARS, count: 2, returnsTo: 'reserve',
  total: {current: 3, resulting: 2}, leader: {current: 'red', resulting: 'blue'},
};
const NEUTRAL_ON_SCIENTISTS: DelegateTargetProjection = {
  place: 'resolution', owner: 'neutral', party: PartyName.SCIENTISTS, count: 1, returnsTo: 'supply', total: {current: 1, resulting: 0},
};
const NEUTRAL_IN_GREENS: DelegateTargetProjection = {
  place: 'support', owner: 'neutral', party: PartyName.GREENS, count: 2, returnsTo: 'supply', total: {current: 2, resulting: 1},
};
const META: DelegatePromptMeta = {source: 'remove', targets: [RED_ON_MARS, NEUTRAL_ON_SCIENTISTS, NEUTRAL_IN_GREENS]};
/** TR74's exchange: the neutral figure on the Scientists' bill leaves, the viewer's own takes its place. */
const EXCHANGE: DelegatePromptMeta = {
  source: 'exchange',
  targets: [{...NEUTRAL_ON_SCIENTISTS, total: {current: 1, resulting: 1}, arrives: {owner: BLUE, count: {current: 0, resulting: 1}}}],
};

/** The table: two bills with their ribbons (the mode reads a bill's party, its votes and its printed name), the plaques in their order. */
const slot = (party: PartyName, name: string, votes: ParliamentSlotVm['votes']): ParliamentSlotVm =>
  ({instance: `i-${party}`, resolutionId: `id-${party}`, party, votes, resolution: {text: {name}}} as unknown as ParliamentSlotVm);
const VIEW: ParliamentViewVm = {
  ...emptyParliamentView(),
  rulingParty: PartyName.GREENS,
  slots: [
    slot(PartyName.MARS, 'Law of Mars', [{owner: 'red', seq: 1}, {owner: 'blue', seq: 2}, {owner: 'red', seq: 3}]),
    slot(PartyName.SCIENTISTS, 'Law of Science', [{owner: 'neutral', seq: 4}]),
  ],
  parties: [{party: PartyName.MARS, support: 0}, {party: PartyName.SCIENTISTS, support: 0}, {party: PartyName.GREENS, support: 2}] as unknown as ReadonlyArray<ParliamentPartyVm>,
};

function bridge(over: {meta?: DelegatePromptMeta, card?: CardName, staged?: boolean} = {}): ParliamentPromptBridge {
  const meta = over.meta ?? META;
  return {
    vote: undefined, actions: {}, resolutionAction: undefined, seat: undefined, grant: undefined, supportPick: undefined, bannerPick: undefined,
    delegatePick: {
      model: {type: 'party', parties: meta.targets.map((t) => t.party)} as unknown as SelectPartyModel, meta,
      ...(over.card === undefined ? {} : {card: over.card}), ...(over.staged === undefined ? {} : {staged: over.staged}),
    },
  };
}

/** The seats the mode names, and the viewer's own table (what a staged door's commit is read off). */
function table(over: {tableau?: ReadonlyArray<CardName>, actions?: ReadonlyArray<CardName>} = {}): PlayerViewModel {
  return {
    players: [{color: 'red', name: 'Bob'}, {color: 'blue', name: 'Alice'}],
    thisPlayer: {tableau: (over.tableau ?? []).map((name) => ({name})), actionsThisGeneration: over.actions ?? []},
  } as unknown as PlayerViewModel;
}

function modeProps(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {view: VIEW, playerView: table(), viewerColor: BLUE, bridge: bridge(), ...over};
}

function mode(over: Record<string, unknown> = {}) {
  return mount(ConsoleParliamentDelegateMode as any, {...globalConfig, props: modeProps(over), global});
}

type ModeRef = {answerAfterSubmit(): void, handleIntent(intent: GamepadIntent): void, closeFinished(): void};

/** The mode under a PARENT that holds a ref to it and hears its events — what that ref carries is what the section's `delegateMode` ref does. */
function underParent(over: Record<string, unknown> = {}) {
  const held = shallowRef<ModeRef | null>(null);
  const heard: Array<[string, unknown]> = [];
  const handed = shallowRef(modeProps(over));
  /** The section hands the mode new props (the answer's view: the prompt is gone from the bridge). */
  const hand = async (next: Record<string, unknown>): Promise<void> => {
    handed.value = {...handed.value, ...next};
    await nextTick();
  };
  const Parent = defineComponent({
    name: 'DelegateModeParent',
    setup: () => () => h('div', {'data-parent': ''}, [h(ConsoleParliamentDelegateMode as never, {
      ...handed.value,
      ref: held,
      onNotice: (text: string) => heard.push(['notice', text]),
      onInspect: (request: unknown) => heard.push(['inspect', request]),
      onInspectSource: (card: CardName) => heard.push(['inspect-source', card]),
      onSend: (payload: unknown) => heard.push(['send', payload]),
      onFlowComplete: (stage: string) => heard.push(['flow-complete', stage]),
    })]),
  });
  return {wrapper: mount(Parent, {...globalConfig, global}), held, heard, hand};
}

/** The bridge once the pick is ANSWERED: the server asks it no more. */
const ANSWERED: ParliamentPromptBridge = {...bridge(), delegatePick: undefined};

/** The record the answer carries when the server took the figure off its place (the apply block's seed owes its flight). */
const REMOVAL: ParliamentDelegateRemovalModel = {
  seq: 7, player: BLUE, place: 'resolution', party: PartyName.MARS, instance: `i-${PartyName.MARS}`, vote: 3, owner: 'red', returnsTo: 'reserve', total: 2,
} as ParliamentDelegateRemovalModel;

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

describe('ConsoleParliamentDelegateMode — the figure under the cursor, its verbs, and what a parent reaches through its ref', () => {
  let clock: ManualFlowClock;

  // The flow, the holds, the fit's freeze and the removal record are module state the whole bundle shares: every test
  // starts from, and leaves, the clean one. The probe's tick is a wait of the flow kernel — the spec drives its clock.
  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    resetParliamentFlow();
    resetParliamentHolds();
    settleDelegateRemoval();
    delegateRemovalFlow.degraded = '';
    freezeParliamentFit(false);
    armDelegatePickFlow(0, 'Banishment', false, META);
  });
  afterEach(async () => {
    clock.advance(PROBE_TICK_FALLBACK_MS + 1);
    await flushPromises();
    setFlowClock(undefined);
    resetParliamentFlow();
    resetParliamentHolds();
    settleDelegateRemoval();
    delegateRemovalFlow.degraded = '';
    freezeParliamentFit(false);
  });

  it('reads the figure under the cursor: whose it is, where it stands, where it goes, the server\'s facts — and follows the cursor', async () => {
    const w = mode();
    // The template STARTS WITH ITS ROOT (its opening comment lives in the script now).
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.deep.eq(['con-parl__delegate']);
    expect(w.attributes('data-parl-delegate-mode')).to.not.eq(undefined);
    expect(w.attributes('data-delegate-beat')).to.eq(undefined);
    expect(w.attributes('data-delegate-staged')).to.eq(undefined);
    expect(w.attributes('data-delegate-source')).to.eq('remove');

    // The ring: the bills left to right (a bill's owners by the figure that would leave), then the plaques as they stand.
    const reading = () => w.find('[data-parl-delegate-reading]');
    expect([reading().attributes('data-delegate-place'), reading().attributes('data-delegate-party'), reading().attributes('data-delegate-owner')])
      .to.deep.eq(['resolution', PartyName.MARS, 'red']);
    expect(reading().attributes('data-delegate-returns')).to.eq('reserve');
    expect(reading().attributes('data-delegate-sole')).to.eq(undefined);
    expect(w.find('.con-parl__delegate-kicker').text()).to.eq($t('Delegate'));
    expect(w.find('[data-parl-delegate-name]').text()).to.eq('Bob');
    expect(w.find('.con-parl__delegate-emblem').attributes('src')).to.eq(partyEmblemUrl(PartyName.MARS));
    expect(w.find('[data-parl-delegate-from]').text()).to.eq(translateTextWithParams('From the resolution «${0}»', [translateText('Law of Mars')]));
    expect(w.find('[data-parl-delegate-dest]').text()).to.contain(translateTextWithParams('To the reserve of ${0}', ['Bob']));
    expect(w.find('[data-parl-delegate-arrives]').exists()).to.eq(false);
    expect(w.find('[data-parl-delegate-receipt]').exists(), 'no staged door — no receipt').to.eq(false);
    const figure = w.findComponent(DelegateStub);
    expect([figure.props('color'), figure.props('steel'), figure.props('glow')]).to.deep.eq(['red', false, false]);

    // The facts are the server's row, worded by the pure model and handed to the ONE fact row.
    const facts = () => w.findAllComponents(FactStub).map((f) => f.props('fact') as VoteFactVm);
    expect(facts().map((f) => [f.id, f.before.key, f.after.key])).to.deep.eq([['votes', '3', '2'], ['lead', 'Bob', 'Alice']]);

    // «Убрать делегата» while the pick is open.
    const cta = w.find('[data-parl-delegate-cta]');
    expect(cta.classes()).to.include('con-parl__cta--ready');
    expect(w.findComponent(GlyphStub).props('control')).to.eq('confirm');
    expect(cta.find('.con-parl__cta-label').text()).to.eq(translateText('Remove delegate'));

    // The cursor walks on: a NEUTRAL figure — the steel one, named, bound for the common supply.
    parliamentFlow.delegateCursor = 1;
    await nextTick();
    expect([reading().attributes('data-delegate-party'), reading().attributes('data-delegate-owner'), reading().attributes('data-delegate-returns')])
      .to.deep.eq([PartyName.SCIENTISTS, 'neutral', 'supply']);
    expect(w.find('[data-parl-delegate-name]').text()).to.eq(translateText('Neutral'));
    expect(w.find('[data-parl-delegate-dest]').text()).to.contain(translateText('To the common supply'));
    const steel = w.findComponent(DelegateStub);
    expect([steel.props('color'), steel.props('steel')]).to.deep.eq(['neutral', true]);

    // …and onto a plaque: a figure of the party's popular support.
    parliamentFlow.delegateCursor = 2;
    await nextTick();
    expect([reading().attributes('data-delegate-place'), reading().attributes('data-delegate-party')]).to.deep.eq(['support', PartyName.GREENS]);
    expect(w.find('[data-parl-delegate-from]').text())
      .to.eq(translateTextWithParams('From the Popular Support of «${0}»', [translateText(partyNameKey(PartyName.GREENS))]));
    expect(facts().map((f) => [f.label, f.before.key, f.after.key])).to.deep.eq([['Popular support', '2', '1']]);
  });

  it('an EXCHANGE reads both halves — the figure that leaves, the viewer\'s own that arrives — marks a sole target, and a staged door shows its locked receipt', () => {
    const receipt = {amount: 5, icon: 'megacredits'};
    const w = mode({bridge: bridge({meta: EXCHANGE, card: CardName.ANTS, staged: true}), cardReceipt: receipt, stagedFlow: 'action'});
    expect(w.attributes('data-delegate-source')).to.eq('exchange');
    expect(w.attributes('data-delegate-staged')).to.eq('');
    const reading = w.find('[data-parl-delegate-reading]');
    expect(reading.attributes('data-delegate-sole'), 'the only figure the card can take is SHOWN and marked').to.eq('');
    expect(w.find('[data-seeded-mark]').text()).to.eq($t('The only target'));
    const arrives = w.find('[data-parl-delegate-arrives]');
    expect(arrives.attributes('data-delegate-arrives')).to.eq(BLUE);
    expect(arrives.text()).to.eq(translateTextWithParams('Your delegate from the reserve → onto «${0}»', [translateText('Law of Science')]));
    expect(arrives.findComponent(DelegateStub).props('color')).to.eq(BLUE);
    expect((w.findComponent(FactStub).props('fact') as VoteFactVm).label).to.eq('Your delegates');

    const lock = w.find('[data-parl-delegate-receipt]');
    expect([lock.attributes('data-receipt-cost'), lock.attributes('data-receipt-icon')]).to.deep.eq(['5', 'megacredits']);
    expect(lock.find('.con-parl__info-receipt-key').text()).to.eq($t(CARD_DOOR_RECEIPT));
    expect(lock.find('.con-parl__info-src-num').text()).to.eq('5');
    // A staged door's confirm is the door's own verb, never the pick's.
    const label = w.find('[data-parl-delegate-cta] .con-parl__cta-label').text();
    expect(label).to.not.eq(translateText('Recruit delegate'));
    expect(label).to.not.eq('');
  });

  it('the confirm sends the figure\'s address, latches the pick and freezes the fit; a figure no longer offered names itself and sends nothing', async () => {
    const w = mode();
    const cta = w.find('[data-parl-delegate-cta]');
    await cta.trigger('click');
    expect(w.emitted('send')).to.deep.eq([[{response: {type: 'party', partyName: PartyName.MARS, delegate: {place: 'resolution', owner: 'red'}}, from: 'delegate'}]]);
    expect(w.emitted('notice')).to.eq(undefined);
    expect(parliamentFlow.delegateSnapshot).to.deep.eq(RED_ON_MARS);
    expect(parliamentFlow.delegateMeta).to.deep.eq(META);
    expect(parliamentFitFrozen()).to.eq(true);

    // A press that is already in is not a second press: the confirm is a status now, the reading is the CHOSEN figure.
    parliamentFlow.delegateCommitted = true;
    parliamentFlow.delegateCursor = 1;
    await nextTick();
    await cta.trigger('click');
    expect(w.emitted('send')?.length).to.eq(1);
    expect(w.classes()).to.include('con-parl__delegate--committed');
    expect(cta.classes()).to.include('con-parl__cta--busy');
    expect(cta.find('.glyph-stub').exists()).to.eq(false);
    expect(cta.find('.con-parl__cta-label').text()).to.eq(translateText('Performing…'));
    expect(w.find('.con-parl__delegate-kicker').text()).to.eq($t('Leaves the table'));
    expect(w.find('[data-parl-delegate-reading]').attributes('data-delegate-owner'), 'not the cursor\'s figure').to.eq('red');

    // The prompt moved under the cursor (the row is no longer offered): named, nothing sent.
    resetParliamentFlow();
    armDelegatePickFlow(0, 'Banishment', false, META);
    freezeParliamentFit(false);
    const stale = mode({bridge: {...bridge(), delegatePick: {...bridge().delegatePick!, meta: {source: 'remove', targets: []}}}});
    expect(stale.find('[data-parl-delegate-reading]').exists(), 'the reading falls back to the meta the flow was armed with').to.eq(false);
    parliamentFlow.delegateMeta = META;
    await stale.setProps({bridge: {...bridge(), delegatePick: undefined}});
    expect(stale.find('[data-parl-delegate-reading]').exists()).to.eq(true);
    await stale.find('[data-parl-delegate-cta]').trigger('click');
    expect(stale.emitted('notice')).to.deep.eq([[translateText('This option is no longer offered')]]);
    expect(stale.emitted('send')).to.eq(undefined);
    expect(parliamentFitFrozen()).to.eq(false);
  });

  it('a PARENT\'s ref sees `answerAfterSubmit` · `handleIntent` · `closeFinished` and nothing else — the pad\'s verbs go through it', () => {
    const {held, heard} = underParent({bridge: bridge({card: CardName.ANTS})});
    expect(held.value, 'the parent\'s ref is set').to.not.eq(null);
    expect(Object.keys(held.value!), 'exactly what the mode exposes').to.deep.eq(['answerAfterSubmit', 'handleIntent', 'closeFinished']);
    const leaked = ['view', 'bridge', 'submit', 'fly', 'stopOutcome', 'finish', 'reading', 'ring', 'latchedCard', 'flight']
      .filter((key) => (held.value as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
    const pad = held.value!.handleIntent;

    // The d-pad walks the figures where they stand: ▶ along the table's row (clamped at its end), ◀ past its first
    // figure into the plaques' column, ▶ back onto the table.
    pad({kind: 'nav', dir: 'right', repeat: false});
    expect(parliamentFlow.delegateCursor).to.eq(1);
    pad({kind: 'nav', dir: 'right', repeat: false});
    expect(parliamentFlow.delegateCursor, 'no wrap').to.eq(1);
    pad({kind: 'nav', dir: 'left', repeat: false});
    pad({kind: 'nav', dir: 'left', repeat: false});
    expect(parliamentFlow.delegateCursor).to.eq(2);
    pad({kind: 'nav', dir: 'right', repeat: false});
    expect(parliamentFlow.delegateCursor).to.eq(0);

    // L3 — the card that asks; X — what the figure stands on (its bill; a plaque for a support figure); A — the commit.
    pad({kind: 'press', button: 'stickL'});
    pad({kind: 'press', button: 'secondary'});
    expect(heard.map(([name]) => name)).to.deep.eq(['inspect-source', 'inspect']);
    expect(heard[0][1]).to.eq(CardName.ANTS);
    expect(heard[1][1]).to.deep.include({kind: 'resolution', ids: [`id-${PartyName.MARS}`, `id-${PartyName.SCIENTISTS}`], index: 0});
    parliamentFlow.delegateCursor = 2;
    pad({kind: 'press', button: 'secondary'});
    expect(heard[2][1]).to.deep.include({kind: 'party', party: PartyName.GREENS});
    pad({kind: 'press', button: 'confirm'});
    expect(heard[3]).to.deep.eq(['send', {response: {type: 'party', partyName: PartyName.GREENS, delegate: {place: 'support', owner: 'neutral'}}, from: 'delegate'}]);

    // A committed mode takes no verb; the answer that RE-ASKED the card's own pick stands the mode again, in place and LIVE.
    parliamentFlow.stage = 'submitting';
    parliamentFlow.delegateCommitted = true;
    pad({kind: 'nav', dir: 'up', repeat: false});
    pad({kind: 'press', button: 'confirm'});
    expect(parliamentFlow.delegateCursor).to.eq(2);
    expect(heard.length).to.eq(4);
    held.value!.answerAfterSubmit();
    expect(parliamentFlow.stage).to.eq('delegate');
    expect([parliamentFlow.delegateCommitted, parliamentFlow.delegateLive]).to.deep.eq([false, true]);
    expect(parliamentFlow.delegateSnapshot).to.eq(undefined);
    expect(parliamentFitFrozen(), 'the fit is thawed with the re-ask').to.eq(false);
    expect(heard.some(([name]) => name === 'flow-complete')).to.eq(false);
  });

  it('a STAGED door: an answer that has not committed the card keeps waiting; the committed one leaves whole — nothing flies', () => {
    const staged = {bridge: bridge({card: CardName.ANTS, staged: true})};
    const {wrapper, held, heard} = underParent(staged);
    held.value!.handleIntent({kind: 'press', button: 'confirm'});
    expect(heard[0]).to.deep.eq(['send', {
      response: {type: 'party', partyName: PartyName.MARS, delegate: {place: 'resolution', owner: 'red'}, stagedFor: CardName.ANTS}, from: 'delegate',
    }]);

    // A key that moved for somebody else's reason while the staged commit is still on the wire.
    held.value!.answerAfterSubmit();
    expect(parliamentFlow.delegateCommitted).to.eq(false);
    expect(heard.length).to.eq(1);
    wrapper.unmount();

    // The card is on the table (PARKED behind another prompt — no removal record): the step ends at once.
    const landed = underParent({...staged, playerView: table({tableau: [CardName.ANTS]})});
    landed.held.value!.handleIntent({kind: 'press', button: 'confirm'});
    landed.held.value!.answerAfterSubmit();
    expect([parliamentFlow.delegateCommitted, parliamentFlow.delegateBeat]).to.deep.eq([true, 'done']);
    expect(landed.heard.map(([name]) => name)).to.deep.eq(['send', 'flow-complete']);
    expect(landed.heard[1][1]).to.eq('delegate');
    expect(holding(), 'no flight — no hold').to.eq(false);
  });

  it('the answer that TOOK the figure plays on this stage and ends by the mode\'s own hand; `closeFinished` folds only a finished mode', async () => {
    const {wrapper, held, heard, hand} = underParent();
    const root = () => wrapper.find('[data-parl-delegate-mode]');
    const cta = () => wrapper.find('[data-parl-delegate-cta]');
    held.value!.handleIntent({kind: 'press', button: 'confirm'});
    expect(heard.map(([name]) => name)).to.deep.eq(['send']);

    // The answer's view: the pick is asked no more, and the apply block owed the flight (the server's removal record).
    await hand({bridge: ANSWERED});
    expect(wrapper.find('[data-parl-delegate-reading]').attributes('data-delegate-owner'), 'the chosen figure still reads — off the latched meta').to.eq('red');
    delegateRemovalFlow.owed = REMOVAL;
    delegateRemovalFlow.standing = true;
    delegateRemovalFlow.toDest = true;
    held.value!.answerAfterSubmit();
    expect([parliamentFlow.delegateCommitted, parliamentFlow.delegateBeat]).to.deep.eq([true, 'flight']);
    expect(holding()).to.eq(true);
    await nextTick();
    expect(root().classes()).to.include('con-parl__delegate--committed');
    expect(root().attributes('data-delegate-beat')).to.eq('flight');
    expect(cta().classes()).to.include('con-parl__cta--busy');

    // A mode still at work is never closed by the question door.
    held.value!.closeFinished();
    expect(parliamentFitFrozen()).to.eq(true);
    expect(holding()).to.eq(true);

    // No Parliament root stands in a unit mount, so nothing can be measured: the probe's tick settles the record and the
    // mode goes on to its read — the hold let go with the carry.
    await flushPromises();
    clock.advance(PROBE_TICK_FALLBACK_MS + 1);
    await flushPromises();
    expect(parliamentFlow.delegateBeat).to.eq('read');
    expect(delegateRemovalFlow.owed, 'the table reads the server again').to.eq(undefined);
    expect(holding()).to.eq(false);
    expect(heard.some(([name]) => name === 'flow-complete')).to.eq(false);

    // The read beat rides the motion clock; then the flow ends by its own hand — once.
    passMotionBeat();
    expect(parliamentFlow.delegateBeat).to.eq('done');
    expect(heard.filter(([name]) => name === 'flow-complete')).to.deep.eq([['flow-complete', 'delegate']]);
    await nextTick();
    expect(cta().classes()).to.include('con-parl__cta--done');
    expect(cta().find('.con-parl__cta-label').text()).to.eq(translateText('Delegate removed'));

    // …and now the door folds it: the fit thawed, the latch let go. A second end is not a second event.
    held.value!.closeFinished();
    expect(parliamentFitFrozen()).to.eq(false);
    wrapper.unmount();
    expect(held.value, 'the parent\'s ref is cleared').to.eq(null);
    expect(heard.filter(([name]) => name === 'flow-complete').length).to.eq(1);
  });

  it('THE CEILING ENDS THE CARRY: the hold\'s recovery is the mode\'s own — the record settled, the read begun; an unmount cuts every beat', async () => {
    const {wrapper, held, heard, hand} = underParent();
    held.value!.handleIntent({kind: 'press', button: 'confirm'});
    await hand({bridge: ANSWERED});
    delegateRemovalFlow.owed = REMOVAL;
    delegateRemovalFlow.standing = true;
    held.value!.answerAfterSubmit();
    expect(parliamentFlow.delegateBeat).to.eq('flight');

    const warnings = collectingWarnings(() => {
      expect(expireAnimationHoldNow(HOLD)).to.eq(true);
    });
    expect(warnings.some((line) => line.includes('delegate removal: outlived its ceiling'))).to.eq(true);
    expect(parliamentFlow.delegateBeat).to.eq('read');
    expect(delegateRemovalFlow.owed).to.eq(undefined);
    expect(holding()).to.eq(false);

    // The section unmounts mid-read: the beat is cut — it never fires into a mode that is gone.
    wrapper.unmount();
    passMotionBeat();
    await flushPromises();
    expect(parliamentFlow.delegateBeat).to.eq('read');
    expect(heard.some(([name]) => name === 'flow-complete')).to.eq(false);
  });
});
