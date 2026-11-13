/*
 * ConsoleOvTabScore — «СЧЁТ», a tab of the endgame overview. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its `vm` over the overview's module state (the seats, the
 * category rows on one scale, the focused category's breakdown, the nested detail) — and the PANE API its parent
 * reaches through `ref="pane"`: `ConsoleEndgameOverview.handleIntent` calls `nav(dir)` on a d-pad step and `primary()`
 * on A, so a parent's ref must carry exactly those two. The faces, the disc and the VP shield are stubbed by name
 * (each is its own component's subject). The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {ConsoleOverviewVm, OvRankRow, OvScoreCategory} from '@/client/console/endgame/consoleOverviewModel';
import {ConsoleEndgameCategoryKey, ConsoleEndgameFace} from '@/client/console/endgame/consoleEndgameModel';
import {consoleOverviewUi, resetConsoleOverview} from '@/client/console/endgame/consoleOverviewState';
import {DossierGlyph, scoreCategoryGlyph} from '@/client/console/infoDossierModel';
import ConsoleOvTabScore from '@/client/components/console/ConsoleOvTabScore.vue';

/** What the overview reads through its ref — the pane's whole contract with its parent. */
type Pane = {nav(dir: 'up' | 'down' | 'left' | 'right'): void, primary(): void};

const DiscStub = defineComponent({
  name: 'ConsoleScoreDisc',
  props: {glyph: {type: Object as PropType<DossierGlyph>, required: true}},
  render() {
    return h('i', {class: 'disc-stub'});
  },
});
const BadgeStub = defineComponent({
  name: 'ConsoleVpBadge',
  props: {label: {type: String, required: true}},
  render() {
    return h('i', {'class': 'badge-stub', 'data-label': this.label});
  },
});
const CardFaceStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: String},
  render() {
    return h('i', {'class': 'card-face-stub', 'data-name': this.name});
  },
});
const BotFaceStub = defineComponent({
  name: 'MarsBotCorpFace',
  props: {id: String, resources: Number},
  render() {
    return h('i', {'class': 'bot-face-stub', 'data-id': this.id, 'data-resources': String(this.resources)});
  },
});

const global = {
  ...globalConfig.global,
  stubs: {ConsoleScoreDisc: DiscStub, ConsoleVpBadge: BadgeStub, ConsoleCardFaceLite: CardFaceStub, MarsBotCorpFace: BotFaceStub},
};

function rank(color: Color, name: string, place: number, total: number, face: ConsoleEndgameFace | undefined): OvRankRow {
  return {color, name, corporation: '', face, place, total, gapToWinner: 0, megacredits: 0, isBot: false, isWinner: place === 1};
}

function category(key: ConsoleEndgameCategoryKey, label: string, values: Record<string, number>, over: Partial<OvScoreCategory> = {}): OvScoreCategory {
  return {key, label, accent: key, penalty: false, values, leaders: [], subs: [], ...over};
}

/** Three seats (a card face, a bot's face, no face) and three categories: a two-level one, a shared lead, a penalty. */
function overviewVm(): ConsoleOverviewVm {
  return {
    generation: 9,
    winner: undefined,
    sharedWin: false,
    digest: {verdict: undefined, lead: [], headline: [], observations: [], ranking: []},
    score: {
      ranking: [
        rank('red', 'Ada', 1, 50, {kind: 'card', name: CardName.CREDICOR}),
        rank('blue', 'Bot', 2, 40, {kind: 'bot', id: MarsBotCorpId.C01_CREDICOR}),
        rank('green', 'Cy', 3, 20, undefined),
      ],
      categories: [
        category('tr', 'Terraform Rating', {red: 30, blue: 25, green: 20}, {
          leaders: ['red'],
          subs: [
            {key: 'base', label: 'Base rating', values: {red: 20, blue: 20, green: 20}},
            {key: 'raised', label: 'Raised', values: {red: 10, blue: 5}},
          ],
        }),
        category('cards', 'Cards', {red: 20, blue: 20}, {leaders: ['red', 'blue']}),
        category('penalty', 'Penalties', {blue: -5}, {penalty: true}),
      ],
      maxCategoryValue: 30,
      decisive: {key: 'tr', label: 'Terraform Rating', accent: 'tr', delta: 5},
      tieBreak: undefined,
    },
    timeline: {
      gens: 0, series: [], episodes: [], maxVp: 0,
      stats: {generations: 0, leadChanges: undefined, tookLeadGen: undefined, wireToWire: false, finalSurge: undefined},
    },
    cards: {rows: [], byPlayer: []},
    parameters: {parameters: [], gens: 0},
    players: {players: [], maxima: {}, comparable: {}, displayNames: {}},
  };
}

function tab(vm: ConsoleOverviewVm) {
  return mount(ConsoleOvTabScore, {global, props: {vm}});
}

/** The tab the way the overview mounts it: under an Options host with the string ref `pane`. */
function underOverview(vm: ConsoleOverviewVm) {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleOvTabScore, {ref: 'pane', vm})]),
  });
  const wrapper = mount(Host, {global});
  return {
    wrapper,
    /** Exactly the overview's read: `(this.$refs.pane ?? undefined) as Pane | undefined`. */
    pane: () => (wrapper.vm.$refs.pane ?? undefined) as Pane | undefined,
  };
}

describe('ConsoleOvTabScore — the score board', () => {
  // The overview's state is a MODULE (it outlives the scene): every test starts from — and leaves — a fresh one.
  beforeEach(resetConsoleOverview);
  afterEach(resetConsoleOverview);

  it('the head row: a seat per place — its face, the place, the name, the total; the winner marked; the corner names the biggest edge', () => {
    const w = tab(overviewVm());
    // The template starts with its root: the wrapper IS the tab.
    expect(w.classes()).to.include('con-ovs');
    const seats = w.findAll('.con-ovs__line--head > .con-ovs__seat');
    expect(seats.map((s) => s.attributes('data-ovs-seat'))).to.deep.eq(['red', 'blue', 'green']);
    expect(seats.map((s) => s.classes().includes('con-ovs__seat--winner'))).to.deep.eq([true, false, false]);
    expect(seats.map((s) => [s.find('.con-ovs__seat-place').text(), s.find('.con-ovs__seat-name').text(), s.find('.con-ovs__seat-vp').text()]))
      .to.deep.eq([['1', 'Ada', '50'], ['2', 'Bot', '40'], ['3', 'Cy', '20']]);
    expect(seats.map((s) => s.find('.badge-stub').attributes('data-label')), 'the shield is handed the translated «VP»').to.deep.eq(['VP', 'VP', 'VP']);
    // The face: a corporation card, the bot's own corporation, or the seat's colour when the save carries none.
    expect(seats[0].find('.con-ovs__face-zoom > .card-face-stub').attributes('data-name')).to.eq(CardName.CREDICOR);
    expect(seats[1].find('.con-ovs__face-zoom > .bot-face-stub').attributes('data-id')).to.eq(MarsBotCorpId.C01_CREDICOR);
    expect(seats[1].find('.bot-face-stub').attributes('data-resources')).to.eq('0');
    expect(seats[2].find('.con-ovs__face-zoom').exists()).to.eq(false);
    expect(seats[2].find('.con-ovs__face-empty').classes()).to.include('player_bg_color_green');

    expect(w.find('.con-ovs__corner .con-ovs__note-label').text()).to.eq('Biggest edge');
    expect(w.find('.con-ovs__corner .con-ovs__note-delta').text()).to.eq('+5 VP');
    expect(w.find('.con-ovs__note--tb').exists(), 'no tie — no tie-break note').to.eq(false);
  });

  it('the category rows on ONE scale: a value and a bar per seat, the leaders marked (never a zero), a penalty negative — and the focused row\'s breakdown under the board', async () => {
    const w = tab(overviewVm());
    const rows = w.findAll('.con-ovs__board > .con-ovs__cat');
    expect(rows.map((r) => r.attributes('data-ovs-cat'))).to.deep.eq(['tr', 'cards', 'penalty']);
    expect(rows.map((r) => r.find('.con-ovs__cat-name').text())).to.deep.eq(['Terraform Rating', 'Cards', 'Penalties']);
    expect(rows.map((r) => r.classes().includes('con-eg-cat--' + r.attributes('data-ovs-cat')))).to.deep.eq([true, true, true]);
    expect(rows.map((r) => r.classes().includes('con-ovs__cat--focused'))).to.deep.eq([true, false, false]);
    expect(rows.map((r) => r.findAll('.con-ovs__cell-val').map((v) => v.text())))
      .to.deep.eq([['30', '25', '20'], ['20', '20', '0'], ['0', '−5', '0']]);
    const cells = (flag: string) => rows.map((r) => r.findAll('.con-ovs__cell').map((c) => c.classes().includes('con-ovs__cell--' + flag)));
    expect(cells('lead'), 'every holder of a shared lead, never a zero').to.deep.eq([[true, false, false], [true, true, false], [false, false, false]]);
    expect(cells('zero')).to.deep.eq([[false, false, false], [false, false, true], [true, false, true]]);
    expect(rows[2].findAll('.con-ovs__cell-val').map((v) => v.classes().includes('con-ovs__cell-val--neg'))).to.deep.eq([false, true, false]);
    expect(rows[2].findAll('.con-ovs__pbar-fill').map((f) => f.classes().includes('con-ovs__pbar-fill--neg'))).to.deep.eq([false, true, false]);
    // The bar: the value against the ONE shared denominator (30) — a penalty by its magnitude.
    const widths = (row: number) => rows[row].findAll('.con-ovs__pbar-fill').map((f) => Math.round(parseFloat((f.element as HTMLElement).style.width)));
    expect(widths(0)).to.deep.eq([100, 83, 67]);
    expect(widths(2)).to.deep.eq([0, 17, 0]);
    // Each row's medallion is handed the category's own glyph.
    expect(w.findAllComponents(DiscStub).slice(0, 3).map((d) => d.props('glyph')))
      .to.deep.eq([scoreCategoryGlyph('tr'), scoreCategoryGlyph('cards'), scoreCategoryGlyph('penalty')]);

    // The breakdown of the FOCUSED category, in the same plate.
    expect(w.find('.con-ovs__context .con-ovs__ctx-title').text()).to.eq('Terraform Rating');
    expect(w.find('.con-ovs__ctx-hint').text()).to.eq('Breakdown');
    expect(w.findAll('.con-ovs__subs > .con-ovs__sub').map((s) => [s.find('.con-ovs__sub-name').text(), ...s.findAll('.con-ovs__sub-val').map((v) => v.text())]))
      .to.deep.eq([['Base rating', '20', '20', '20'], ['Raised', '10', '5', '0']]);

    // The module's focus moves — the tab follows it; a one-beat category says what it is instead of a breakdown.
    consoleOverviewUi.scoreCat = 2;
    await nextTick();
    expect(w.findAll('.con-ovs__cat').map((r) => r.classes().includes('con-ovs__cat--focused'))).to.deep.eq([false, false, true]);
    expect(w.find('.con-ovs__subs').exists()).to.eq(false);
    expect(w.find('.con-ovs__ctx-hint').exists()).to.eq(false);
    expect(w.find('.con-ovs__ctx-quiet').text()).to.eq('Points lost to penalties');
    consoleOverviewUi.scoreCat = 1;
    await nextTick();
    expect(w.find('.con-ovs__ctx-quiet').text()).to.eq('A single-source category');
  });

  it('the nested detail opens from the module\'s `detail`: the category\'s sources per seat — or the category itself as one row — and the total', async () => {
    const w = tab(overviewVm());
    expect(w.find('.con-egov-detail').exists()).to.eq(false);
    const grid = () => ({
      title: w.find('.con-egov-detail__title').text(),
      seats: w.findAll('.con-ovs__dcell--head .con-ovs__dname').map((n) => n.text()),
      labels: w.findAll('.con-ovs__dcell--label').map((l) => l.text()),
      totals: w.findAll('.con-ovs__dcell--total').map((t) => t.text()),
    });

    consoleOverviewUi.detail = {kind: 'score-category', catKey: 'tr'};
    await nextTick();
    expect(grid()).to.deep.eq({
      title: 'Terraform Rating', seats: ['Ada', 'Bot', 'Cy'], labels: ['Base rating', 'Raised', 'Total'], totals: ['Total', '30', '25', '20'],
    });
    expect((w.find('.con-ovs__dgrid').element as HTMLElement).style.getPropertyValue('--ov-cols'), 'a column per seat').to.eq('3');

    consoleOverviewUi.detail = {kind: 'score-category', catKey: 'penalty'};
    await nextTick();
    expect(grid()).to.deep.eq({
      title: 'Penalties', seats: ['Ada', 'Bot', 'Cy'], labels: ['Penalties', 'Total'], totals: ['Total', '0', '−5', '0'],
    });

    // Another tab's detail is not this tab's.
    consoleOverviewUi.detail = {kind: 'generation', gen: 2};
    await nextTick();
    expect(w.find('.con-egov-detail').exists()).to.eq(false);
  });

  it('the overview\'s ref sees the pane API — `nav` and `primary` — and nothing else', () => {
    const {pane} = underOverview(overviewVm());
    expect(pane(), 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(pane()!).sort(), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['nav', 'primary']);
    const leaked = ['vm', 'ui', 'focusedCat', 'detailCat', 'detailSubs', 'fmt', 'isLeader', 'glyphOf', 'barStyle', 'quietNote']
      .filter((key) => (pane() as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('`nav` walks the categories on ↑/↓ (a ring); `primary` opens the focused one\'s detail — under which both rest', async () => {
    const {wrapper, pane} = underOverview(overviewVm());
    pane()!.nav('down');
    expect(consoleOverviewUi.scoreCat).to.eq(1);
    pane()!.nav('left');
    pane()!.nav('right');
    expect(consoleOverviewUi.scoreCat, '←/→ walk nothing on this tab').to.eq(1);
    pane()!.nav('up');
    pane()!.nav('up');
    expect(consoleOverviewUi.scoreCat, '↑ from the first category wraps to the last').to.eq(2);

    pane()!.primary();
    expect(consoleOverviewUi.detail).to.deep.eq({kind: 'score-category', catKey: 'penalty'});
    await nextTick();
    expect(wrapper.find('.con-egov-detail__title').text()).to.eq('Penalties');

    // The detail is a static read: the d-pad moves nothing under it, A opens nothing over it.
    pane()!.nav('down');
    expect(consoleOverviewUi.scoreCat).to.eq(2);
    consoleOverviewUi.scoreCat = 0;
    pane()!.primary();
    expect(consoleOverviewUi.detail, 'the open detail stays the one that was opened').to.deep.eq({kind: 'score-category', catKey: 'penalty'});
  });
});
