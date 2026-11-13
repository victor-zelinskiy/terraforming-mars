/*
 * ConsoleOvTabCards — «КАРТЫ», a tab of the endgame overview. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its `vm` and `playerView` over the overview's module state (the
 * player filter, ONE strict page of the ranked impact list, the focused row's context — a card face, a bot source's
 * mechanic or a holding — and the nested detail) — and the PANE API its parent reaches through `ref="pane"`:
 * `ConsoleEndgameOverview.handleIntent` calls `nav(dir)` on a d-pad step and `primary()` on A, so a parent's ref must
 * carry exactly those two. The card face and the dividend ledger are stubbed by name (each is its own component's
 * subject). The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {ViewModel} from '@/common/models/PlayerModel';
import {CardVictoryPointsKind} from '@/common/game/VictoryPointsBreakdown';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {ConsoleOverviewVm, OvCardRow} from '@/client/console/endgame/consoleOverviewModel';
import {consoleOverviewUi, resetConsoleOverview} from '@/client/console/endgame/consoleOverviewState';
import {consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import ConsoleOvTabCards from '@/client/components/console/ConsoleOvTabCards.vue';

/** What the overview reads through its ref — the pane's whole contract with its parent. */
type Pane = {nav(dir: 'up' | 'down' | 'left' | 'right'): void, primary(): void};

const CardStub = defineComponent({
  name: 'Card',
  props: {
    card: {type: Object as PropType<CardModel>, required: true},
    lightweight: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'card-stub', 'data-name': this.card.name});
  },
});
const LedgerStub = defineComponent({
  name: 'ConsoleBotDividendLedger',
  props: {reading: {type: Object, required: true}, concise: Boolean, final: Boolean},
  render() {
    return h('i', {class: 'ledger-stub'});
  },
});

const global = {...globalConfig.global, stubs: {Card: CardStub, ConsoleBotDividendLedger: LedgerStub}};

const OWNER_NAME: Partial<Record<Color, string>> = {red: 'Ada', blue: 'Bot'};

function row(id: string, owner: Color, cardName: string, vp: number, kind: CardVictoryPointsKind, over: Partial<OvCardRow> = {}): OvCardRow {
  return {id, owner, ownerName: OWNER_NAME[owner] ?? owner, cardName, vp, kind, ...over};
}

/**
 * The party's card story, ranked: a card on its owner's table (the live model carries its stored resources), a card
 * the view does not hold, a HOLDING of the bot (two families — a save whose dividend row carries no goal terms), the
 * bot's M€ conversion (an aggregated source, never a card) and a penalty.
 */
const ROWS: ReadonlyArray<OvCardRow> = [
  row('birds', 'red', CardName.BIRDS, 5, 'resource'),
  row('capital', 'red', CardName.CAPITAL, 3, 'conditional'),
  row('holding', 'blue', 'Ecoline', 3, 'conditional', {
    bot: {kind: 'holding', corporation: 'Ecoline', formulaVp: 2, goalsVp: 1, detail: {corporation: MarsBotCorpId.C01_CREDICOR, vp: 3, terms: []}},
    parts: [{kind: 'conditional', vp: 2}, {kind: 'fixed', vp: 1}],
  }),
  row('mc', 'blue', 'MarsBot M€', 2, 'fixed', {bot: {kind: 'mc', stock: 14, rate: 5}}),
  row('zone', 'red', CardName.NUCLEAR_ZONE, -2, 'penalty'),
];

function overviewVm(rows: ReadonlyArray<OvCardRow> = ROWS): ConsoleOverviewVm {
  const kinds = {resource: 0, conditional: 0, fixed: 0, penalty: 0};
  return {
    generation: 9,
    winner: undefined,
    sharedWin: false,
    digest: {verdict: undefined, lead: [], headline: [], observations: [], ranking: []},
    score: {ranking: [], categories: [], maxCategoryValue: 1, decisive: undefined, tieBreak: undefined},
    timeline: {
      gens: 0, series: [], episodes: [], maxVp: 0,
      stats: {generations: 0, leadChanges: undefined, tookLeadGen: undefined, wireToWire: false, finalSurge: undefined},
    },
    cards: {
      rows,
      byPlayer: [
        {color: 'red', name: 'Ada', isBot: false, cardsVp: 6, count: 3, kinds},
        {color: 'blue', name: 'Bot', isBot: true, cardsVp: 5, count: 2, kinds},
      ],
    },
    parameters: {parameters: [], gens: 0},
    players: {players: [], maxima: {}, comparable: {}, displayNames: {}},
  };
}

/** The live view: Ada holds «Birds» with five animals on it; nobody holds «Capital». */
const BIRDS_ON_TABLE: CardModel = {name: CardName.BIRDS, resources: 5};
const VIEW = {
  players: [{color: 'red', tableau: [BIRDS_ON_TABLE]}, {color: 'blue', tableau: []}],
} as unknown as ViewModel;

function tab(vm: ConsoleOverviewVm) {
  return mount(ConsoleOvTabCards, {global, props: {vm, playerView: VIEW}});
}

/** The tab the way the overview mounts it: under an Options host with the string ref `pane`. */
function underOverview(vm: ConsoleOverviewVm) {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleOvTabCards, {ref: 'pane', vm, playerView: VIEW})]),
  });
  const wrapper = mount(Host, {global});
  return {
    wrapper,
    /** Exactly the overview's read of its pane. */
    pane: () => (wrapper.vm.$refs.pane ?? undefined) as Pane | undefined,
  };
}

describe('ConsoleOvTabCards — the card story of the party', () => {
  // The overview's state is a MODULE (it outlives the scene): every test starts from — and leaves — a fresh one.
  beforeEach(resetConsoleOverview);
  afterEach(resetConsoleOverview);

  it('the filter strip with each seat\'s card VP, ONE page of the ranked list — and the focused card\'s face from the owner\'s live table', () => {
    const w = tab(overviewVm());
    // The template starts with its root: the wrapper IS the tab.
    expect(w.classes()).to.include('con-ovc');
    const chips = w.findAll('.con-ovc__filters > .con-ovc__filter');
    expect(chips.map((c) => c.classes().includes('con-ovc__filter--on')), '«all players» until the ring is walked').to.deep.eq([true, false, false]);
    expect(chips[0].text()).to.eq('All players');
    expect(chips.slice(1).map((c) => [c.find('.con-ovc__filter-name').text(), c.find('.con-ovc__filter-vp').text(), c.find('.con-ovc__filter-unit').text()]))
      .to.deep.eq([['Ada', '6', 'VP'], ['Bot', '5', 'VP']]);
    expect(w.find('.con-ovc__pager').exists(), 'one page — no pager').to.eq(false);

    const rows = w.findAll('.con-ovc__list > .con-ovc__row');
    expect(rows.map((r) => [r.find('.con-ovc__rank').text(), r.find('.con-ovc__name').text(), r.find('.con-ovc__vp').text()])).to.deep.eq([
      ['1', 'Birds', '+5'], ['2', 'Capital', '+3'], ['3', 'Ecoline', '+3'], ['4', 'MarsBot M€', '+2'], ['5', 'Nuclear Zone', '−2'],
    ]);
    expect(rows.map((r) => r.classes().includes('con-ovc__row--focused'))).to.deep.eq([true, false, false, false, false]);
    expect(rows.map((r) => r.classes().includes('con-ovc__row--penalty'))).to.deep.eq([false, false, false, false, true]);
    expect(rows.map((r) => (r.element as HTMLElement).style.getPropertyValue('--ov-pc')), 'a row wears its owner\'s colour')
      .to.deep.eq(['red', 'red', 'blue', 'blue', 'red'].map((color) => endgamePlayerHex(color as Color)));
    // The family mark: one accent — or one per family for a row that scores in two.
    expect(rows[0].find('.con-ovc__kind').classes()).to.include('con-eg-cat--greenery');
    expect(rows[2].findAll('.con-ovc__kind--split > i').map((i) => i.classes()[0])).to.deep.eq(['con-eg-cat--cards', 'con-eg-cat--city']);

    // The context column: the LIVE tableau model (its stored resources are honest), a lightweight face.
    const face = w.findComponent(CardStub);
    expect(face.props('card')).to.deep.eq(BIRDS_ON_TABLE);
    expect(face.props('lightweight')).to.eq(true);
    expect(w.find('.con-ovc__impact-owner').text()).to.eq('Ada');
    expect(w.find('.con-ovc__impact-kind').text()).to.eq('Resource cards');
    expect(w.find('.con-ovc__impact-vp').text()).to.eq('+5 VP');
  });

  it('follows the module\'s focus: a name-only face off the table, a holding with its two families, a bot source\'s MECHANIC (never a fake card), a penalty', async () => {
    const w = tab(overviewVm());

    consoleOverviewUi.cardsIdx = 1;
    await nextTick();
    expect(w.findAll('.con-ovc__row').map((r) => r.classes().includes('con-ovc__row--focused'))).to.deep.eq([false, true, false, false, false]);
    expect(w.findComponent(CardStub).props('card'), 'a card the view does not hold is a name-only face').to.deep.eq({name: CardName.CAPITAL});

    consoleOverviewUi.cardsIdx = 2;
    await nextTick();
    expect(w.findComponent(CardStub).exists(), 'a holding is not a project card').to.eq(false);
    expect(w.find('[data-ov-holding] .con-ovc__botsrc-name').text()).to.eq('Ecoline');
    expect(w.findComponent(LedgerStub).exists(), 'no goal terms on the row — the parts line stands instead of the ledger').to.eq(false);
    const parts = w.findAll('[data-ov-parts] > [data-ov-part]');
    expect(parts.map((p) => [p.attributes('data-ov-part'), p.find('.con-ovc__impact-kind').text(), p.find('.con-ovc__impact-part-vp').text()]))
      .to.deep.eq([['conditional', 'Conditional cards', '+2'], ['fixed', 'Fixed VP cards', '+1']]);

    consoleOverviewUi.cardsIdx = 3;
    await nextTick();
    expect(w.findComponent(CardStub).exists()).to.eq(false);
    const source = w.find('.con-ovc__context > .con-ovc__botsrc');
    expect([source.find('.con-ovc__botsrc-name').text(), source.find('.con-ovc__botsrc-kind').text()]).to.deep.eq(['MarsBot M€', 'Fixed VP cards']);
    expect(source.findAll('.con-ovc__botsrc-row').map((r) => [r.find('.con-ovc__botsrc-lbl').text(), r.find('.con-ovc__botsrc-val').text()]))
      .to.deep.eq([['M€ left at scoring', '14'], ['Conversion rate', '5 M€ → 1 VP'], ['Result', '2 VP']]);
    expect(source.find('.con-ovc__botsrc-note').text()).to.eq('An aggregated MarsBot scoring source — not a physical project card.');

    consoleOverviewUi.cardsIdx = 4;
    await nextTick();
    expect(w.find('.con-ovc__impact-vp').text()).to.eq('−2 VP');
    expect(w.find('.con-ovc__impact-vp').classes()).to.include('con-ovc__vp--neg');
    expect(w.find('.con-ovc__impact-kind').text()).to.eq('Penalties');
  });

  it('strict PAGES (nine rows — six on the handheld), the player filter, and the honest empty state', async () => {
    const eleven = [
      ...Array.from({length: 10}, (_, i) => row('r' + i, 'red', 'Card ' + (i + 1), 20 - i, 'fixed')),
      row('b', 'blue', 'Blue card', 1, 'fixed'),
    ];
    const w = tab(overviewVm(eleven));
    const page = () => w.findAll('.con-ovc__row').map((r) => r.find('.con-ovc__rank').text());
    expect(page()).to.deep.eq(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(w.find('.con-ovc__pager').text().replace(/\s+/g, '')).to.eq('Page1/2');

    // The focus crosses the page edge — the page follows it (the page is derived, never kept).
    consoleOverviewUi.cardsIdx = 9;
    await nextTick();
    expect(page()).to.deep.eq(['10', '11']);
    expect(w.findAll('.con-ovc__row').map((r) => r.classes().includes('con-ovc__row--focused'))).to.deep.eq([true, false]);
    expect(w.find('.con-ovc__pager').text().replace(/\s+/g, '')).to.eq('Page2/2');

    const profile = consoleLayoutState.profile;
    try {
      consoleLayoutState.profile = 'handheld';
      await nextTick();
      expect(page(), 'six rows a page on the handheld — the same focus stands on the second one').to.deep.eq(['7', '8', '9', '10', '11']);
    } finally {
      consoleLayoutState.profile = profile;
    }

    // The filter ring: one seat's cards, re-ranked from 1.
    consoleOverviewUi.cardsFilter = 1;
    consoleOverviewUi.cardsIdx = 0;
    await nextTick();
    expect(w.findAll('.con-ovc__filter').map((c) => c.classes().includes('con-ovc__filter--on'))).to.deep.eq([false, false, true]);
    expect(w.findAll('.con-ovc__row').map((r) => [r.find('.con-ovc__rank').text(), r.find('.con-ovc__name').text()])).to.deep.eq([['1', 'Blue card']]);
    expect(w.find('.con-ovc__pager').exists()).to.eq(false);

    const nobody = tab(overviewVm([]));
    expect(nobody.find('.con-ovc__body').exists()).to.eq(false);
    expect(nobody.find('.con-egov-empty__title').text()).to.eq('No victory points from cards.');
    expect(nobody.find('.con-egov-empty__note').text()).to.eq('This game was decided on the board and the rating track.');
  });

  it('the nested detail opens from the module\'s `detail`: the enlarged card — or the bot source\'s full mechanic — beside its impact', async () => {
    const w = tab(overviewVm());
    expect(w.find('.con-egov-detail').exists()).to.eq(false);

    consoleOverviewUi.detail = {kind: 'card', rowId: 'birds'};
    await nextTick();
    expect(w.find('.con-egov-detail').classes()).to.include('con-ovc__detail');
    const enlarged = w.findAllComponents(CardStub).filter((face) => face.props('lightweight') === false);
    expect(enlarged.map((face) => face.props('card')), 'the full face, on the live model').to.deep.eq([BIRDS_ON_TABLE]);
    expect(w.find('.con-ovc__detail-card').exists()).to.eq(true);
    const side = w.find('.con-ovc__detail-side');
    expect([side.find('.con-egov-detail__title').text(), side.find('.con-ovc__impact-owner').text(), side.find('.con-ovc__impact-kind').text(), side.find('.con-ovc__impact-vp--big').text()])
      .to.deep.eq(['Birds', 'Ada', 'Resource cards', '+5 VP']);

    consoleOverviewUi.detail = {kind: 'card', rowId: 'mc'};
    await nextTick();
    expect(w.find('.con-ovc__detail-card').exists()).to.eq(false);
    expect(w.findAll('.con-ovc__botsrc--big .con-ovc__botsrc-val').map((v) => v.text())).to.deep.eq(['14', '5 M€ → 1 VP', '2 VP']);
    expect(w.find('.con-ovc__detail-side .con-egov-detail__title').text()).to.eq('MarsBot M€');

    consoleOverviewUi.detail = {kind: 'card', rowId: 'holding'};
    await nextTick();
    expect(w.findAll('.con-ovc__detail-side .con-ovc__impact-part-vp').map((v) => v.text())).to.deep.eq(['+2', '+1']);
    expect(w.findAll('.con-ovc__botsrc--big .con-ovc__botsrc-lbl').map((l) => l.text()), 'no goal terms: the two parts, as numbers')
      .to.deep.eq(['Dividend formula', 'Dividend goals']);

    // Another tab's detail — or a row that is gone — is not this tab's.
    consoleOverviewUi.detail = {kind: 'generation', gen: 2};
    await nextTick();
    expect(w.find('.con-egov-detail').exists()).to.eq(false);
    consoleOverviewUi.detail = {kind: 'card', rowId: 'nowhere'};
    await nextTick();
    expect(w.find('.con-egov-detail').exists()).to.eq(false);
  });

  it('the overview\'s ref sees the pane API — `nav` and `primary` — and nothing else', () => {
    const {pane} = underOverview(overviewVm());
    expect(pane(), 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(pane()!).sort(), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['nav', 'primary']);
    const leaked = ['vm', 'playerView', 'ui', 'isHandheld', 'pageSize', 'filteredRows', 'focusIdx', 'focusedRow', 'detailRow', 'hex', 'rankOf', 'botFormula', 'modelFor']
      .filter((key) => (pane() as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('`nav` walks the list on ↑/↓ (clamped) and the player filter on ←/→ (a ring, the focus back on top); `primary` opens the focused card — under which both rest', async () => {
    const {wrapper, pane} = underOverview(overviewVm());
    pane()!.nav('down');
    expect(consoleOverviewUi.cardsIdx).to.eq(1);
    pane()!.nav('up');
    pane()!.nav('up');
    expect(consoleOverviewUi.cardsIdx, '↑ stops at the first row').to.eq(0);
    for (let i = 0; i < 9; i++) {
      pane()!.nav('down');
    }
    expect(consoleOverviewUi.cardsIdx, '↓ stops at the last row').to.eq(4);

    pane()!.nav('right');
    expect([consoleOverviewUi.cardsFilter, consoleOverviewUi.cardsIdx], 'all → the first seat, the focus back on top').to.deep.eq([0, 0]);
    await nextTick();
    expect(wrapper.findAll('.con-ovc__row').map((r) => r.find('.con-ovc__name').text())).to.deep.eq(['Birds', 'Capital', 'Nuclear Zone']);
    pane()!.nav('down');
    pane()!.nav('down');
    pane()!.nav('down');
    expect(consoleOverviewUi.cardsIdx, 'the walk is over the FILTERED list').to.eq(2);
    pane()!.nav('right');
    pane()!.nav('right');
    expect(consoleOverviewUi.cardsFilter, '→ past the last seat wraps to «all»').to.eq(-1);
    pane()!.nav('left');
    expect(consoleOverviewUi.cardsFilter, '← from «all» wraps to the last seat').to.eq(1);

    pane()!.nav('down');
    pane()!.primary();
    expect(consoleOverviewUi.detail, 'the focused row of the filtered list').to.deep.eq({kind: 'card', rowId: 'mc'});
    await nextTick();
    expect(wrapper.find('.con-ovc__detail-side .con-egov-detail__title').text()).to.eq('MarsBot M€');

    // The detail is a static read: the d-pad moves nothing under it, A opens nothing over it.
    pane()!.nav('up');
    pane()!.nav('right');
    expect([consoleOverviewUi.cardsFilter, consoleOverviewUi.cardsIdx]).to.deep.eq([1, 1]);
    pane()!.primary();
    expect(consoleOverviewUi.detail).to.deep.eq({kind: 'card', rowId: 'mc'});
  });
});
