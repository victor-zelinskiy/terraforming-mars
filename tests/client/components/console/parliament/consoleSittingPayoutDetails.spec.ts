/*
 * ConsoleSittingPayoutDetails — «ПОДРОБНОСТИ ВЫПЛАТ»: WHY every seat got exactly what it got. ONE strip of the law
 * over a column per seat (the head, the influence the law read, a line per source, ИТОГО). A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): `ConsoleParliamentSitting` reaches it through `ref="details"`
 * for `scrollBy` alone — so that is ALL a parent's ref of it carries (§ R11).
 *
 * (Render functions, not template strings: the runtime compiler is not in this build.)
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {InfluenceScaledEffect, InfluenceYield, referenceYield} from '@/common/parliament/influenceScaling';
import {PayoutDetails, PayoutDetailsSeat} from '@/client/console/parliament/payoutDetailsModel';
import {ResultsPayoutPart, ResultsTotal} from '@/client/console/parliament/parliamentResultsModel';
import ConsoleSittingPayoutDetails from '@/client/components/console/parliament/ConsoleSittingPayoutDetails.vue';

// The formula, the record chip and the totals are their own specs' subjects; this one reads what the step HANDS them.
const YieldStub = defineComponent({
  name: 'ConsoleInfluenceYield',
  props: {yields: Array, formula: {type: Boolean, default: true}, captions: {type: Boolean, default: true}, person: String, size: String, levy: Object},
  render: () => h('i', {class: 'yield-stub'}),
});
const PartStub = defineComponent({name: 'ConsoleSitPayoutPart', props: {part: Object}, render: () => h('i', {class: 'part-stub'})});
const TotalsStub = defineComponent({name: 'ConsoleSitTotals', props: {totals: Array}, render: () => h('i', {class: 'totals-stub'})});

/** The ONE scroll primitive, reduced to what the step CALLS on it — it draws its slot and records every scroll. */
const scrolled: Array<number> = [];
const ScrollStub = defineComponent({
  name: 'ConsoleScrollArea',
  props: {contentClass: String},
  methods: {
    scrollByPx(dy: number): void {
      scrolled.push(dy);
    },
  },
  render() {
    return h('div', {class: 'scroll-stub'}, this.$slots.default?.());
  },
});

const stubs = {ConsoleInfluenceYield: YieldStub, ConsoleSitPayoutPart: PartStub, ConsoleSitTotals: TotalsStub, ConsoleScrollArea: ScrollStub};

const total = (over: Partial<ResultsTotal> = {}): ResultsTotal =>
  ({id: 't', kind: 'unit', unit: 'megacredits', family: 'stock', production: false, sources: [], records: 1, ...over});
const part = (over: Partial<ResultsPayoutPart> = {}): ResultsPayoutPart => ({id: 'p', kind: 'colony', unit: '', production: false, ...over});

// The step reads an effect's `id` and hands the rest to the formula (stubbed here) — the id is all this fixture needs.
const EFFECT = {id: 'rate', perInfluence: 2} as unknown as InfluenceScaledEffect;
const MEANING: InfluenceYield = {effect: EFFECT, context: 'applied', influence: 3, amount: 6};

const PLUTO_TOTALS = [total({id: 'pluto-cards', unit: 'cards', family: 'cards', amount: 3})];
const WINNER_PARTS = [part({id: 'w1'}), part({id: 'w2'})];
const OTHER_PARTS = [part({id: 'o1'})];
const BLUE_TOTALS = [total({id: 'sum', amount: 9})];

const BLUE: PayoutDetailsSeat = {
  player: 'blue',
  winner: true,
  influence: {
    total: 3,
    composition: {agendaStep: 4, track: 2, sources: [{amount: 1, source: 'Colonial Representation'}, {amount: -1}]},
    meanings: [MEANING],
    grant: {eligibility: 'influence', influence: 3, line: 2},
  },
  lines: [
    {id: 'colony:Pluto', kind: 'colony', colony: 'Pluto', times: 2, cubes: 3, parts: [], totals: PLUTO_TOTALS},
    {id: 'winner', kind: 'winner', parts: WINNER_PARTS, totals: []},
  ],
  totals: BLUE_TOTALS,
};
const RED: PayoutDetailsSeat = {
  player: 'red',
  winner: false,
  lines: [{id: 'other:tail', kind: 'other', parts: OTHER_PARTS, totals: []}],
  totals: [],
};

const DETAILS: PayoutDetails = {
  law: {effects: [EFFECT], recipients: {kind: 'threshold', winner: true, influenceAtLeast: 2}, notOwed: ['red']},
  winner: {player: 'blue', votes: 3},
  seats: [BLUE, RED],
};

const PLAYERS = [{color: 'blue', name: 'Alice'}, {color: 'red', name: 'Bob'}] as unknown as ReadonlyArray<PublicPlayerModel>;
const BLUE_SEAT: Color = 'blue';
const RED_SEAT: Color = 'red';

function step(props: Record<string, unknown> = {}) {
  return mount(ConsoleSittingPayoutDetails, {
    ...globalConfig,
    props: {details: DETAILS, players: PLAYERS, viewerColor: BLUE_SEAT, ...props},
    global: {...globalConfig.global, stubs},
  });
}

const votesText = (votes: number): string => translateTextWithParams('Winner of the vote · ${0} votes', [String(votes)]);

type DetailsReach = {scrollBy?: (dy: number) => void};

describe('ConsoleSittingPayoutDetails — «ПОДРОБНОСТИ ВЫПЛАТ»: a breakdown per seat', () => {
  beforeEach(() => {
    scrolled.length = 0;
  });

  it('THE LAW\'s strip: the card\'s own formula of every scaled part, the rule of WHO, the not-owed seats named once', () => {
    const w = step();
    // The template STARTS WITH ITS ROOT (its opening comment lives in the script now).
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.include('con-sitpd');
    expect(w.attributes('data-sit-payout-details')).to.not.eq(undefined);

    const rules = w.findAllComponents(YieldStub).filter((y) => y.attributes('data-sitpd-rule') !== undefined);
    expect(rules.map((y) => y.attributes('data-sitpd-rule-effect'))).to.deep.eq(['rate']);
    expect(rules[0].props('yields'), 'the reference reading — no seat, no number').to.deep.eq([referenceYield(EFFECT)]);
    expect(rules[0].props('size')).to.eq('compact');
    expect(rules[0].props('captions')).to.eq(false);
    expect(rules[0].props('formula'), 'the formula IS the rule').to.eq(true);

    expect(w.find('.con-sitpd__rule-text').text()).to.eq(translateTextWithParams('The winner and every seat with influence ${0}+', ['2']));

    const notOwed = w.find('[data-sitpd-not-owed]');
    expect(notOwed.find('.con-sitpd__notowed-why').text()).to.eq($t('Not owed — for the winner of the vote only') + ':');
    const seats = notOwed.findAll('.con-sitpd__notowed-seat');
    expect(seats.map((s) => s.text())).to.deep.eq(['Bob']);
    expect(seats[0].find('i').classes()).to.include.members(['con-parl__seat-dot', 'player_bg_color_red']);
  });

  it('a law with no scaled part and no rule of WHO reads the winner\'s votes — and owes no «not owed» line', () => {
    const w = step({details: {...DETAILS, law: {effects: [], notOwed: []}}});
    expect(w.findAllComponents(YieldStub).filter((y) => y.attributes('data-sitpd-rule') !== undefined).length).to.eq(0);
    expect(w.find('.con-sitpd__rule-text').text()).to.eq(votesText(3));
    expect(w.find('[data-sitpd-not-owed]').exists()).to.eq(false);
  });

  it('a COLUMN per seat: the head, the influence with what it was made of and what it meant, a line per source, ИТОГО', async () => {
    const w = step();
    expect(w.find('.con-sitpd__seats').attributes('style')).to.include('--sitpd-seats: 2');
    const columns = w.findAll('[data-sitpd-seat]');
    expect(columns.map((c) => c.attributes('data-sitpd-seat'))).to.deep.eq(['blue', 'red']);
    const [blue, red] = columns;
    expect(blue.classes()).to.include.members(['con-sitpd__seat--me', 'con-sitpd__seat--winner']);
    expect(red.classes()).to.not.include('con-sitpd__seat--me');
    expect(red.classes()).to.not.include('con-sitpd__seat--winner');

    // 1. the head
    expect(blue.find('.con-sitpd__name').text()).to.eq('Alice');
    expect(blue.find('[data-sitpd-winner]').text()).to.eq(votesText(3));
    expect(red.find('.con-sitpd__name').text()).to.eq('Bob');
    expect(red.find('[data-sitpd-winner]').exists()).to.eq(false);

    // 2. the influence — only where the law read it
    expect(blue.find('[data-sitpd-influence]').attributes('data-sitpd-influence-total')).to.eq('3');
    const career = blue.find('[data-sitpd-influence-source="career"]');
    expect(career.attributes('data-sitpd-influence-amount')).to.eq('2');
    expect(career.text()).to.include($t('Agenda track'));
    expect(career.find('.con-sitpd__term-step').text()).to.eq('· ' + translateTextWithParams('step ${0}', ['4']));
    const givers = blue.findAll('[data-sitpd-influence-source="giver"]');
    expect(givers.map((g) => g.attributes('data-sitpd-influence-giver'))).to.deep.eq(['Colonial Representation', undefined]);
    expect(givers.map((g) => g.find('b').text()), 'signed: a plus, a true minus').to.deep.eq(['+1', '−1']);
    expect(givers[1].text(), 'a giver with no name').to.include($t('Other influence'));
    const meanings = w.findAllComponents(YieldStub).filter((y) => y.attributes('data-sitpd-meaning') !== undefined);
    expect(meanings.map((y) => y.attributes('data-sitpd-meaning-effect'))).to.deep.eq(['rate']);
    expect(meanings[0].props('yields')).to.deep.eq([MEANING]);
    expect(meanings[0].props('formula')).to.eq(false);
    expect(meanings[0].props('person'), 'the viewer\'s own column').to.eq('you');
    const grant = blue.find('[data-sitpd-grant="influence"]');
    expect(grant.classes()).to.include('con-sitpd__grant--influence');
    expect(grant.text()).to.eq(translateTextWithParams('Influence ${0} — at or over the line ${1}', ['3', '2']));
    expect(red.find('[data-sitpd-influence]').exists(), 'the law read no influence of this seat').to.eq(false);

    // 3. a line per source
    expect(blue.findAll('[data-sitpd-line]').map((l) => l.attributes('data-sitpd-line-id'))).to.deep.eq(['colony:Pluto', 'winner']);
    const pluto = blue.find('[data-sitpd-line-kind="colony"]');
    expect(pluto.find('.con-sit__part-planet').classes()).to.include('Pluto-background');
    expect(pluto.find('[data-sitpd-line-times]').text()).to.eq('×2');
    expect(pluto.find('.con-sitpd__cubes').text()).to.eq(translateTextWithParams('cubes: ${0}', ['3']));
    expect(blue.find('[data-sitpd-line-kind="winner"]').text()).to.include($t('Reward for the winner of the vote'));
    expect(red.find('[data-sitpd-line-kind="other"] .con-sitpd__line-label').text()).to.eq($t('Resolution effect'));
    // A tile's records merge into its totals; every other line draws its records, each by the one record renderer.
    const got = w.findAllComponents(TotalsStub).filter((t) => t.classes().includes('con-sitpd__got'));
    expect(got.map((t) => t.props('totals'))).to.deep.eq([PLUTO_TOTALS]);
    expect(w.findAllComponents(PartStub).map((p) => p.props('part'))).to.deep.eq([...WINNER_PARTS, ...OTHER_PARTS]);

    // 4. ИТОГО — the card's own totals
    const sums = w.findAllComponents(TotalsStub).filter((t) => !t.classes().includes('con-sitpd__got'));
    expect(sums.map((t) => t.props('totals'))).to.deep.eq([BLUE_TOTALS, []]);
    expect(blue.find('[data-sitpd-total] .con-sitpd__kicker').text()).to.eq($t('Seat total'));

    // It FOLLOWS the viewer: another seat's column becomes «mine», the readings speak of «them».
    await w.setProps({viewerColor: RED_SEAT});
    expect(w.find('[data-sitpd-seat="blue"]').classes()).to.not.include('con-sitpd__seat--me');
    expect(w.find('[data-sitpd-seat="red"]').classes()).to.include('con-sitpd__seat--me');
    expect(meanings[0].props('person')).to.eq('they');
  });

  it('a PARENT\'s ref sees exactly `scrollBy` — it drives the step\'s one scroll area', () => {
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleSittingPayoutDetails, {ref: 'details', details: DETAILS, players: PLAYERS})]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs}});
    /** The sitting's own reach, `useTemplateRef<{scrollBy?: …}>('details')` → `details.value?.scrollBy?.(dy)` — the same optional member, read here off a host's ref. */
    const details = (host.vm.$refs.details ?? undefined) as DetailsReach | undefined;
    expect(details, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(details ?? {}), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['scrollBy']);
    for (const inner of ['scroll', 'winnerVotesText', 'nameOf', 'grantRowText', 'props']) {
      expect((details as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }
    details?.scrollBy?.(48);
    details?.scrollBy?.(-24);
    expect(scrolled).to.deep.eq([48, -24]);
    host.unmount();
  });
});
