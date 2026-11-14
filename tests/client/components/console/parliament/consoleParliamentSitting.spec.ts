/*
 * ConsoleParliamentSitting — «ПАРЛАМЕНТ › ЗАСЕДАНИЕ»: the political phase's ONE surface, its stages as POSES of one
 * always-mounted root (a stage change swaps a modifier, never a subtree): the reward chassis with its zone's layers
 * and the results card, read off the SERVER's records. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md), so a parent's template ref of it is ONLY what it `defineExpose`s —
 * `ConsoleParliamentSection` reaches it for `scrollDetails()` alone. Its e2e specs walk the sitting; this one is what
 * the surface owns by itself: the zone it publishes, the poses, the results card's reading and its MEASURE (one
 * observer per card node, per instance), the one step deeper, and that contract.
 *
 * (Render functions, not template strings: the runtime compiler is not in this build.)
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel, ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {PARLIAMENT_MAX_POPULAR_SUPPORT} from '@/common/parliament/ParliamentTypes';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {allResolutions} from '@/client/parliament/ClientParliamentManifest';
import {consoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
import {SittingPosition} from '@/client/console/parliament/consoleSittingFlow';
import {sittingPayoutDetailsOf} from '@/client/console/parliament/payoutDetailsModel';
import {resetSittingPayoutDetails, sittingPayoutDetails} from '@/client/console/parliament/sittingPayoutDetailsState';
import {sittingMotion} from '@/client/console/parliament/sittingDirector';
import {ColonyLedgerReading} from '@/client/console/parliament/colonyLedgerModel';
import {emptyParliamentView, ParliamentPartyVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import ConsoleParliamentSitting from '@/client/components/console/parliament/ConsoleParliamentSitting.vue';

// The ledger, the receipt, the answer / draw stages, the totals and the face are their own specs' subjects; this one
// reads what the sitting HANDS them.
const LedgerStub = defineComponent({
  name: 'ConsoleColonyLedger',
  props: {reading: Object, size: String, activeColony: String, landedColonies: Object},
  render: () => h('i', {class: 'ledger-stub'}),
});
const TotalsStub = defineComponent({name: 'ConsoleSitTotals', props: {totals: Array, marks: Array, fold: Number}, render: () => h('i', {class: 'totals-stub'})});
const DelegateStub = defineComponent({name: 'PlayerDelegate', props: {color: String, steel: Boolean, glow: {type: Boolean, default: true}}, render: () => h('i', {class: 'delegate-stub'})});
/** The premium face is one of the three ASYNC bindings — it answers to the wrapper's name (RECIPES § 3). */
const FaceStub = defineComponent({
  name: 'VaporAsyncComponentWrapper',
  props: {vmOverride: Object, lightweight: Boolean, inert: Boolean},
  render: () => h('i', {class: 'face-stub'}),
});
/** «ПОДРОБНОСТИ ВЫПЛАТ», reduced to what the sitting CALLS on it — it records every scroll it is handed. */
const scrolled: Array<number> = [];
const DetailsStub = defineComponent({
  name: 'ConsoleSittingPayoutDetails',
  props: {details: Object, players: Array, viewerColor: String},
  methods: {
    scrollBy(dy: number): void {
      scrolled.push(dy);
    },
  },
  render: () => h('i', {class: 'details-stub'}),
});

const stubs = {
  ConsoleColonyLedger: LedgerStub, ConsoleSitTotals: TotalsStub, PlayerDelegate: DelegateStub, VaporAsyncComponentWrapper: FaceStub,
  ConsoleSittingPayoutDetails: DetailsStub, ConsoleTableReceipt: true, ConsoleParliamentTableAnswer: true, ConsoleParliamentDrawStage: true,
};

const BLUE: Color = 'blue';
const RED: Color = 'red';
const GREEN: Color = 'green';

// Two REAL laws of the catalog (the enacted one and a fresh one dealt after it) and two parties that are not the
// enacted one's — the spec never assumes which laws the catalog leads with.
const [LAW, FRESH] = allResolutions();
const [OPPOSITION, BENCH] = Array.from(new Set(allResolutions().map((r) => r.party))).filter((party) => party !== LAW.party);

const POSITION = {generation: 3, final: false, step: 'results', pages: ['verdict', 'enact', 'reward', 'results'], gateStanding: true, rewardStep: 'reading'} as unknown as SittingPosition;

/** The sitting's record: Bob won the vote on LAW, the opposition's support grew by one, one fresh law was dealt. */
const SUMMARY = {
  generation: 3, final: false, seq: 1,
  winner: {instance: 'i-law', resolution: LAW.id, party: LAW.party, votes: 3, player: RED},
  enacted: {instance: 'i-law', resolution: LAW.id, party: LAW.party},
  outcomes: [],
  support: [{party: OPPOSITION, gained: 1, total: 2, reason: 'absent'}],
  refreshed: [{instance: 'i-fresh', resolution: FRESH.id, party: FRESH.party, neutralVotes: 0}],
  lobbyRefilled: [],
} as unknown as ParliamentPhaseSummaryModel;

/** The live table after the lobby step: three seats (the model's own order), green with nothing to vote with; red still in the sitting. */
const MODEL = {
  players: [
    {color: BLUE, participates: true, lobby: true, reserve: 5},
    {color: RED, participates: true, lobby: true, reserve: 4},
    {color: GREEN, participates: true, lobby: false, reserve: 0},
  ],
  phase: {step: 'results', outcomes: [], summary: SUMMARY},
  sitting: {pending: [BLUE, RED]},
} as unknown as ParliamentModel;

const VIEW: ParliamentViewVm = {
  ...emptyParliamentView(),
  rulingParty: LAW.party,
  parties: [{party: LAW.party, support: 0}, {party: OPPOSITION, support: 2}, {party: BENCH, support: 0}] as unknown as ReadonlyArray<ParliamentPartyVm>,
};

const TABLE = {players: [{color: BLUE, name: 'Alice'}, {color: RED, name: 'Bob'}, {color: GREEN, name: 'Carol'}]} as unknown as PlayerViewModel;

function sittingProps(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {position: POSITION, stage: 'results', view: VIEW, model: MODEL, playerView: TABLE, viewerColor: BLUE, ...over};
}

function sitting(over: Record<string, unknown> = {}) {
  return mount(ConsoleParliamentSitting as any, {...globalConfig, props: sittingProps(over), global: {...globalConfig.global, stubs}});
}

/** The measuring device the unit environment lacks, lent for the measure's tests: it records what it observes and can be fired. */
class FakeResizeObserver {
  static made: Array<FakeResizeObserver> = [];
  observed: Array<Element> = [];
  disconnected = false;
  constructor(readonly fire: () => void) {
    FakeResizeObserver.made.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
}

/** jsdom lays nothing out: give the card a box (px) the way the browser would have. */
function layOut(el: Element, width: number, height: number): void {
  Object.defineProperty(el, 'clientWidth', {configurable: true, get: () => width});
  Object.defineProperty(el, 'clientHeight', {configurable: true, get: () => height});
}

describe('ConsoleParliamentSitting — the sitting\'s one surface: its zone, its poses, the results card and its measure', () => {
  // The zone flag, the step's «open» and the director's marks are module state the whole bundle shares.
  beforeEach(() => {
    scrolled.length = 0;
    resetSittingPayoutDetails();
    consoleParliamentUi.stageZone = false;
    sittingMotion.colonyRow = '';
  });
  afterEach(() => {
    resetSittingPayoutDetails();
    consoleParliamentUi.stageZone = false;
    sittingMotion.colonyRow = '';
  });

  it('mounts as ONE root with both panels; the LIVE surface publishes its zone for its own life — a review copy owns none', () => {
    const w = sitting({stage: 'verdict', model: undefined});
    // The template STARTS WITH ITS ROOT (its opening comment lives in the script now).
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.deep.eq(['con-sit']);
    expect(w.attributes('data-parl-sitting')).to.not.eq(undefined);
    expect([w.attributes('data-sit-stage'), w.attributes('data-sit-step'), w.attributes('data-sit-mode')]).to.deep.eq(['verdict', 'reading', 'live']);
    expect(w.findAll('[data-sit-panel]').map((p) => [p.attributes('data-sit-panel'), p.classes().includes('con-sit__panel--on')]))
      .to.deep.eq([['reward', false], ['results', false]]);
    // The zone the shell teleports the law's own asks into, and the hero's landing place — always there.
    expect(w.find('[data-embed-slot="parliament-stage"]').exists()).to.eq(true);
    expect(w.find('[data-parl-sit-hero]').exists()).to.eq(true);
    // No summary — no results card (a state with nothing to say renders nothing).
    expect(w.find('[data-sit-results]').exists()).to.eq(false);

    expect(consoleParliamentUi.stageZone, 'published by its own host').to.eq(true);
    const review = sitting({mode: 'review', summary: SUMMARY, model: undefined});
    expect(review.attributes('data-sit-mode')).to.eq('review');
    review.unmount();
    expect(consoleParliamentUi.stageZone, 'a review copy never touches the zone').to.eq(true);
    w.unmount();
    expect(consoleParliamentUi.stageZone, 'retracted by the host that published it').to.eq(false);
  });

  it('THE REWARD POSE: the field, the zone\'s layers — the ledger yields to a hosted step and is never cut', async () => {
    const ledger = {rows: []} as unknown as ColonyLedgerReading;
    const w = sitting({stage: 'reward', field: true, ledger});
    const reward = w.find('[data-sit-panel="reward"]');
    expect(reward.classes()).to.include('con-sit__panel--on');
    expect(w.find('[data-sit-panel="results"]').classes()).to.not.include('con-sit__panel--on');
    expect(w.classes()).to.include('con-sit--field');
    expect(w.find('.con-sit__reward').classes()).to.include('con-sit__reward--field');
    expect(w.find('.con-sit__reward').attributes('data-sit-fullstep')).to.eq(undefined);
    const zone = w.find('.con-sit__zone');
    expect(zone.classes()).to.include.members(['con-sit__zone--on', 'con-sit__zone--ledger']);
    expect(zone.attributes('data-sit-zone-step')).to.eq(undefined);

    // The ledger reads in the zone; the director's marks reach it (the row now paying; nothing landed yet).
    const pane = w.find('[data-sit-ledger]');
    const shown = (): boolean => !(pane.attributes('style') ?? '').includes('display: none');
    expect(shown()).to.eq(true);
    const drawn = w.findComponent(LedgerStub);
    expect(drawn.props('reading')).to.deep.eq(ledger);
    expect([drawn.props('size'), drawn.props('activeColony')]).to.deep.eq(['hero', undefined]);
    expect((drawn.props('landedColonies') as ReadonlySet<string>).size).to.eq(0);
    sittingMotion.colonyRow = 'Luna';
    await nextTick();
    expect(drawn.props('activeColony')).to.eq('Luna');

    // A hosted step may teleport in: the slot opens, the ledger's layer steps aside — the SAME node, hidden, not removed.
    await w.setProps({stepOpen: true, fullStep: true});
    expect(w.find('.con-sit__embed').classes()).to.include('con-sit__embed--on');
    expect(zone.attributes('data-sit-zone-step')).to.eq('');
    expect(w.find('.con-sit__reward').attributes('data-sit-fullstep')).to.eq('');
    expect(w.find('[data-sit-ledger]').element, 'never a `v-if` cut').to.eq(pane.element);
    expect(shown()).to.eq(false);

    // «ОТВЕТ СТОЛА» and «ПРИЁМКА» stand as LAYERS of this chassis on any page — the panel is on for them.
    await w.setProps({stage: 'enact', answerUp: true});
    expect(reward.classes()).to.include('con-sit__panel--on');
    expect(reward.attributes('data-sit-answer')).to.eq('');
    expect(w.find('[data-sit-answer-layer]').exists()).to.eq(true);
    await w.setProps({answerUp: false, drawUp: true});
    expect(reward.attributes('data-sit-draw')).to.eq('');
    expect(w.find('[data-sit-answer-layer]').exists()).to.eq(false);
    expect(w.find('[data-sit-draw-layer]').exists()).to.eq(true);
  });

  it('THE RESULTS CARD reads the server\'s record: the enacted law, a row per seat in the model\'s order, the next vote, who is still in the sitting', async () => {
    const w = sitting();
    expect(w.find('[data-sit-panel="results"]').classes()).to.include('con-sit__panel--on');
    const card = w.find('[data-sit-results]');
    expect(card.classes()).to.not.include.members(['con-sit__results--hidden', 'con-sit__results--details', 'con-sit__results--nonext']);

    // ⓪ ПРИНЯТА — the law's own face (the catalog's view-model) and the party that rules by it.
    const enacted = w.find('[data-sit-section="enacted"]');
    expect(enacted.attributes('data-sit-enacted')).to.eq(LAW.id);
    expect(enacted.findComponent(FaceStub).props('vmOverride')).to.deep.eq(resolutionPremiumVmById(LAW.id));
    expect(enacted.find('img.con-sit__emblem').attributes('src')).to.eq(partyEmblemUrl(LAW.party));

    // ① ВЫПЛАТЫ — one row per participating seat; the winner wears its role, the viewer's row is marked; nobody was paid.
    const rows = w.findAll('[data-sit-payout]');
    expect(rows.map((row) => row.attributes('data-sit-payout-seat'))).to.deep.eq([BLUE, RED, GREEN]);
    expect(rows.map((row) => row.find('.con-sit__payout-name').text())).to.deep.eq(['Alice', 'Bob', 'Carol']);
    expect(rows.map((row) => row.classes().includes('con-sit__payout--me'))).to.deep.eq([true, false, false]);
    expect(rows.map((row) => row.find('[data-sit-payout-winner]').exists())).to.deep.eq([false, true, false]);
    expect(rows[1].find('[data-sit-payout-winner]').text()).to.eq($t('Winner of the vote'));
    expect(rows.map((row) => row.find('[data-sit-payout-none]').exists())).to.deep.eq([true, true, true]);
    expect(w.findAllComponents(TotalsStub).length, 'a seat with no part draws no totals').to.eq(0);
    expect(w.find('.con-sit__ledger').attributes('style')).to.contain('--sit-seats: 3');

    // ② СЛЕДУЮЩЕЕ ГОЛОСОВАНИЕ — the fresh law by its face; the support STOCK in places (this sitting's arrival marked),
    //    the ruling party left to the government's zone; the one seat that cannot vote next generation, by name.
    const fresh = w.findAll('[data-sit-fresh]');
    expect(fresh.map((f) => f.attributes('data-sit-fresh-party'))).to.deep.eq([FRESH.party]);
    expect(fresh[0].attributes('aria-label')).to.eq($t(FRESH.text.name));
    expect(fresh[0].findComponent(FaceStub).props('vmOverride')).to.deep.eq(resolutionPremiumVmById(FRESH.id));
    const support = w.findAll('[data-sit-support]');
    expect(support.map((s) => [s.attributes('data-sit-support-party'), s.attributes('data-sit-support-total'), s.attributes('data-sit-support-fresh')]))
      .to.deep.eq([[OPPOSITION, '2', '1'], [BENCH, '0', '0']]);
    const places = support[0].findAll('[data-support-place]');
    expect(places.length).to.eq(PARLIAMENT_MAX_POPULAR_SUPPORT);
    expect(places.map((p) => p.classes().includes('con-sit__support-place--on'))).to.deep.eq([true, true, false]);
    expect(places.map((p) => p.classes().includes('con-sit__support-place--fresh'))).to.deep.eq([false, true, false]);
    expect(support[0].findAllComponents(DelegateStub).map((d: {props: (key: string) => unknown}) => [d.props('color'), d.props('steel'), d.props('glow')])).to.deep.eq([['neutral', true, false], ['neutral', true, false]]);
    expect(w.findAll('[data-sit-nodelegate]').map((s) => [s.attributes('data-sit-nodelegate-seat'), s.find('.con-sit__seat-name').text()])).to.deep.eq([[GREEN, 'Carol']]);

    // ЕЩЁ В ЗАСЕДАНИИ — the OTHER seats that have not closed it (never the viewer); a review reads none.
    expect(w.findAll('[data-sit-in-sitting]').map((s) => s.attributes('data-sit-in-sitting-seat'))).to.deep.eq([RED]);
    await w.setProps({resultsHidden: true});
    expect(card.classes()).to.include('con-sit__results--hidden');
    expect(card.attributes('data-sit-results-hidden')).to.eq('');
    await w.setProps({mode: 'review', summary: SUMMARY});
    expect(w.find('[data-sit-row="results-in-sitting"]').exists()).to.eq(false);
  });

  describe('the card\'s MEASURE — one observer per card node, this sitting\'s own', () => {
    const globals = globalThis as unknown as {ResizeObserver?: unknown};
    let native: unknown;

    // The unit environment has no ResizeObserver (the sitting then measures nothing): lent for these tests, taken back.
    beforeEach(() => {
      native = globals.ResizeObserver;
      FakeResizeObserver.made = [];
      globals.ResizeObserver = FakeResizeObserver;
    });
    afterEach(() => {
      if (native === undefined) {
        delete globals.ResizeObserver;
      } else {
        globals.ResizeObserver = native;
      }
    });

    it('the card is SOLVED from its measured box: the tier and the solver\'s numbers appear once the box is known, and a re-render adds no observer', async () => {
      const w = sitting();
      const card = w.find('[data-sit-results]');
      expect(FakeResizeObserver.made.length).to.eq(1);
      const device = FakeResizeObserver.made[0];
      expect(device.observed).to.deep.eq([card.element]);
      // Not laid out yet (a zero box is no pose): nothing is solved, nothing is styled.
      expect(card.attributes('data-sit-tier')).to.eq(undefined);
      expect(card.attributes('style') ?? '').to.not.contain('--sit-total-size');

      layOut(card.element, 1600, 640);
      device.fire();
      await nextTick();
      expect(['hero', 'regular', 'compact']).to.include(card.attributes('data-sit-tier'));
      for (const variable of ['--sit-total-size', '--sit-row-pad', '--sit-enacted-zoom', '--sit-fresh-zoom', '--sit-enacted-w', '--sit-next-w']) {
        expect(card.attributes('style'), variable).to.contain(variable);
      }
      expect(w.find('.con-sit__fresh-row').attributes('style')).to.contain('--sit-fresh-per-row');

      // The component re-rendered (its `updated` asks again): the SAME node keeps its one observer.
      await w.setProps({resultsHidden: true});
      await w.setProps({resultsHidden: false});
      expect(FakeResizeObserver.made.length).to.eq(1);
      expect(device.disconnected).to.eq(false);
    });

    it('a NEW card node is observed afresh and the old device let go; each sitting holds its own; the unmount disconnects', async () => {
      const w = sitting({mode: 'review', summary: SUMMARY, model: undefined});
      const first = FakeResizeObserver.made[0];
      expect(first.observed).to.deep.eq([w.find('[data-sit-results]').element]);

      // The summary leaves — so does the card: its device is disconnected, none is made for nothing.
      await w.setProps({summary: undefined});
      expect(w.find('[data-sit-results]').exists()).to.eq(false);
      expect(first.disconnected).to.eq(true);
      expect(FakeResizeObserver.made.length).to.eq(1);

      // …and comes back as a NEW node: a new device on it.
      await w.setProps({summary: SUMMARY});
      expect(FakeResizeObserver.made.length).to.eq(2);
      const second = FakeResizeObserver.made[1];
      expect(second.observed).to.deep.eq([w.find('[data-sit-results]').element]);
      expect(second.disconnected).to.eq(false);

      // A second sitting on screen (a gallery copy) measures its OWN card with its OWN device.
      const other = sitting({mode: 'review', summary: SUMMARY, model: undefined});
      expect(FakeResizeObserver.made.length).to.eq(3);
      const third = FakeResizeObserver.made[2];
      expect(third.observed).to.deep.eq([other.find('[data-sit-results]').element]);
      other.unmount();
      expect([second.disconnected, third.disconnected], 'only its own').to.deep.eq([false, true]);
      w.unmount();
      expect(second.disconnected).to.eq(true);
    });
  });

  it('«ПОДРОБНОСТИ ВЫПЛАТ» is one level deeper on the same card — and a PARENT\'s ref sees exactly `scrollDetails`, which drives the step', async () => {
    const Host = defineComponent({render: () => h('div', [h(ConsoleParliamentSitting as never, {ref: 'sitting', ...sittingProps()})])});
    const host = mount(Host, {global: {...globalConfig.global, stubs}});
    /** The section's own read: `useTemplateRef<{scrollDetails?: (dy: number) => void}>('sitting')`. */
    const held = (host.vm.$refs.sitting ?? undefined) as {scrollDetails?: (dy: number) => void} | undefined;
    expect(held, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(held ?? {}), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['scrollDetails']);
    for (const inner of ['results', 'layout', 'observeResults', 'resultsBox', 'isWinner', 'props']) {
      expect((held as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    // The step is closed: nothing to scroll, and the call is no error.
    expect(host.find('.details-stub').exists()).to.eq(false);
    held?.scrollDetails?.(40);
    expect(scrolled).to.deep.eq([]);

    // X opens it (the section's flag): the card's columns release, the step stands with the ONE construction both readers ask.
    sittingPayoutDetails.open = true;
    await nextTick();
    expect(host.find('[data-sit-results]').classes()).to.include('con-sit__results--details');
    const step = host.findComponent(DetailsStub);
    expect(step.props('details')).to.deep.eq(sittingPayoutDetailsOf(MODEL, SUMMARY));
    expect(step.props('players')).to.deep.eq(TABLE.players);
    expect(step.props('viewerColor')).to.eq(BLUE);
    held?.scrollDetails?.(48);
    held?.scrollDetails?.(-24);
    expect(scrolled).to.deep.eq([48, -24]);

    // Folded back: the step is gone and the scroll falls silent again.
    sittingPayoutDetails.open = false;
    await nextTick();
    expect(host.find('.details-stub').exists()).to.eq(false);
    held?.scrollDetails?.(8);
    expect(scrolled).to.deep.eq([48, -24]);
    host.unmount();
  });
});
