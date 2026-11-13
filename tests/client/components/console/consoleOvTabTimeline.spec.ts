/*
 * ConsoleOvTabTimeline — «ХРОНОЛОГИЯ», a tab of the endgame overview. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its `vm` over the overview's module state (the match-shape
 * chips, the chart's series, the episode strip, the readout of the cursor generation, the generation dossier, the
 * empty state) — and the PANE API its parent reaches through `ref="pane"`: `ConsoleEndgameOverview.handleIntent`
 * calls `nav(dir)` on a d-pad step and `primary()` on A, so a parent's ref must carry exactly those two. The chart
 * and the rich sentence are stubbed by name (each is its own component's subject). The unit runner renders the
 * English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {DOMWrapper, mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {Color} from '@/common/Color';
import {GlobalParameter} from '@/common/GlobalParameter';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {ConsoleOverviewVm, OvChartSeries, OvEpisode, OvSentence, OvSeries} from '@/client/console/endgame/consoleOverviewModel';
import {consoleOverviewUi, resetConsoleOverview} from '@/client/console/endgame/consoleOverviewState';
import ConsoleOvTabTimeline from '@/client/components/console/ConsoleOvTabTimeline.vue';

/** What the overview reads through its ref — the pane's whole contract with its parent. */
type Pane = {nav(dir: 'up' | 'down' | 'left' | 'right'): void, primary(): void};

const ChartStub = defineComponent({
  name: 'ConsoleOvChart',
  props: {
    series: {type: Array as PropType<ReadonlyArray<OvChartSeries>>, required: true},
    points: {type: Number, required: true},
    maxY: {type: Number, required: true},
    unit: {type: String, default: ''},
    cursor: {type: Number, default: undefined},
    fill: {type: Boolean, default: false},
    reveal: {type: Boolean, default: false},
  },
  render() {
    return h('i', {class: 'chart-stub'});
  },
});
const RichStub = defineComponent({
  name: 'ConsoleOvRich',
  props: {sentence: {type: Object as PropType<OvSentence>, required: true}},
  render() {
    return h('i', {'class': 'rich-stub', 'data-key': this.sentence.key});
  },
});

const global = {...globalConfig.global, stubs: {ConsoleOvChart: ChartStub, ConsoleOvRich: RichStub}};

function series(color: Color, name: string, data: ReadonlyArray<number>): OvSeries {
  return {color, name, isBot: false, data, final: data[data.length - 1] ?? 0};
}

function episode(id: string, generation: number | undefined, over: Partial<OvEpisode> = {}): OvEpisode {
  return {
    id, role: 'signature_moment', badge: 'Signature moment', sentence: {key: 'Sentence ' + id, params: []},
    color: undefined, generation, phase: 'mid', major: false, chips: [], ...over,
  };
}

/**
 * Three generations, two seats (Bo leads the first, Ada the rest), four episodes: a major one pinned to generation 2,
 * one pinned to generation 3, one with no generation and one past the last column — the last two are never pinned.
 */
function overviewVm(gens = 3): ConsoleOverviewVm {
  return {
    generation: gens,
    winner: undefined,
    sharedWin: false,
    digest: {verdict: undefined, lead: [], headline: [], observations: [], ranking: []},
    score: {ranking: [], categories: [], maxCategoryValue: 1, decisive: undefined, tieBreak: undefined},
    timeline: {
      gens,
      series: [series('red', 'Ada', [10, 20, 35]), series('blue', 'Bo', [12, 18, 30])],
      episodes: [
        episode('turn', 2, {role: 'turning_point', badge: 'Turning point', color: 'red', major: true}),
        episode('late', 3),
        episode('loose', undefined),
        episode('beyond', 9),
      ],
      maxVp: 35,
      stats: {generations: 3, leadChanges: 2, tookLeadGen: 2, wireToWire: false, finalSurge: {color: 'red', name: 'Ada', gain: 15}},
    },
    cards: {rows: [], byPlayer: []},
    parameters: {
      gens,
      parameters: [{
        key: GlobalParameter.TEMPERATURE, label: 'Temperature', accent: 'temperature', unit: '°C', min: -30, max: 8,
        series: [-30, -20, -10], pct: [0, 26, 53], finalValue: -10, finalPct: 53, completed: false, contributions: undefined,
      }],
    },
    players: {players: [], maxima: {}, comparable: {}, displayNames: {}},
  };
}

function tab(vm: ConsoleOverviewVm, reveal = false) {
  return mount(ConsoleOvTabTimeline, {global, props: {vm, reveal}});
}

/** The tab the way the overview mounts it: under an Options host with the string ref `pane`. */
function underOverview(vm: ConsoleOverviewVm) {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleOvTabTimeline, {ref: 'pane', vm})]),
  });
  const wrapper = mount(Host, {global});
  return {
    wrapper,
    /** Exactly the overview's read: `(this.$refs.pane ?? undefined) as Pane | undefined`. */
    pane: () => (wrapper.vm.$refs.pane ?? undefined) as Pane | undefined,
  };
}

/** One readout line: the seat, its score, its gain over the generation before (none printed at zero). */
function readoutLine(line: DOMWrapper<Element>): Array<string | undefined> {
  const gain = line.find('.con-ovt__ro-delta');
  return [line.find('.con-ovt__ro-name').text(), line.find('b').text(), gain.exists() ? gain.text() : undefined];
}

describe('ConsoleOvTabTimeline — generations are the axis', () => {
  // The overview's state is a MODULE (it outlives the scene): every test starts from — and leaves — a fresh one.
  beforeEach(resetConsoleOverview);
  afterEach(resetConsoleOverview);

  it('the match-shape chips, the legend and ONE chart on a shared scale — the cursor on the LAST generation until the tab is walked', () => {
    const w = tab(overviewVm(), true);
    // The template starts with its root: the wrapper IS the tab.
    expect(w.classes()).to.include('con-ovt');
    expect(w.findAll('.con-ovt__chips > .con-ovt__stat').map((s) => s.text().replace(/\s+/g, ' ')))
      .to.deep.eq(['3 generations', 'Took the lead in gen 2', '2 Lead changes', 'Fastest finish: Ada +15 VP']);
    expect(w.findAll('.con-egov-legend__item').map((l) => [l.find('.con-egov-legend__name').text(), l.find('.con-egov-legend__val').text()]))
      .to.deep.eq([['Ada', '35'], ['Bo', '30']]);
    const chart = w.findComponent(ChartStub);
    expect(chart.classes()).to.include('con-ovt__chart');
    expect(chart.props('series').map((s) => [s.key, s.hex, s.data])).to.deep.eq([
      ['red', endgamePlayerHex('red'), [10, 20, 35]],
      ['blue', endgamePlayerHex('blue'), [12, 18, 30]],
    ]);
    expect([chart.props('points'), chart.props('maxY'), chart.props('cursor'), chart.props('reveal')]).to.deep.eq([3, 35, 2, true]);
    expect(w.find('.con-egov-empty').exists()).to.eq(false);
    expect(w.find('.con-egov-detail').exists()).to.eq(false);
  });

  it('the strip pins an episode to ITS generation; the readout names the cursor generation — the seats by score with their gain, its episodes or a quiet word', async () => {
    const w = tab(overviewVm());
    const marks = w.findAll('.con-ovt__strip > .con-ovt__mark');
    expect(marks, 'an episode with no generation, or one past the last column, is not pinned').to.have.length(2);
    expect(marks.map((m) => (m.element as HTMLElement).style.left)).to.deep.eq(['50%', '100%']);
    expect(marks.map((m) => m.classes().includes('con-ovt__mark--major'))).to.deep.eq([true, false]);
    expect(marks.map((m) => m.classes().includes('con-ovt__mark--hot')), 'the cursor generation\'s mark is hot').to.deep.eq([false, true]);

    const readout = () => ({
      gen: w.find('.con-ovt__ro-gen > b').text(),
      range: w.find('.con-ovt__ro-range').text(),
      lines: w.findAll('.con-ovt__readout .con-ovt__ro-vals > .con-ovt__ro-val').map(readoutLine),
      episodes: w.findAll('.con-ovt__readout .con-ovt__ro-eps > .con-ovt__ro-ep').map((e) => [e.find('.con-ovt__ro-badge').text(), e.find('.rich-stub').attributes('data-key')]),
      quiet: w.find('.con-ovt__readout .con-ovt__ro-quiet').exists(),
    });
    expect(readout()).to.deep.eq({
      gen: '3', range: '1–3', lines: [['Ada', '35', '+15'], ['Bo', '30', '+12']],
      episodes: [['Signature moment', 'Sentence late']], quiet: false,
    });

    // The module's cursor moves — the tab follows it: the first generation, Bo ahead, nobody's gain, nothing pinned.
    consoleOverviewUi.timelineGen = 0;
    await nextTick();
    expect(readout()).to.deep.eq({
      gen: '1', range: '1–3', lines: [['Bo', '12', undefined], ['Ada', '10', undefined]], episodes: [], quiet: true,
    });
    expect(w.findComponent(ChartStub).props('cursor')).to.eq(0);
    expect(w.findAll('.con-ovt__mark').map((m) => m.classes().includes('con-ovt__mark--hot'))).to.deep.eq([false, false]);
  });

  it('the generation dossier opens from the module\'s `detail`: the scores, the parameters and the key moments of THAT generation', async () => {
    const w = tab(overviewVm());
    consoleOverviewUi.detail = {kind: 'generation', gen: 2};
    await nextTick();
    const dossier = w.find('.con-egov-detail');
    expect(dossier.find('.con-egov-detail__title').text().replace(/\s+/g, ' ')).to.eq('Generation 2');
    const columns = dossier.findAll('.con-ovt__dossier > .con-ovt__dcol');
    expect(columns.map((c) => c.find('.con-ovt__dcap').text())).to.deep.eq(['Victory points', 'Global parameters', 'Key moments']);
    expect(columns[0].findAll('.con-ovt__ro-val').map(readoutLine)).to.deep.eq([['Ada', '20', '+10'], ['Bo', '18', '+6']]);
    expect(columns[1].findAll('.con-ovt__dparam').map((p) => [p.find('.con-ovt__dparam-name').text(), p.find('b').text(), p.classes().includes('con-ovp-acc--temperature')]))
      .to.deep.eq([['Temperature', '-20°C', true]]);
    const moments = columns[2].findAll('.con-ovt__ro-ep');
    expect(moments.map((e) => [e.find('.con-ovt__ro-badge').text(), e.find('.rich-stub').attributes('data-key')])).to.deep.eq([['Turning point', 'Sentence turn']]);
    expect(moments[0].find('.con-ovt__ro-badge').classes()).to.include('con-ovt__ro-badge--major');
    expect(columns[2].find('.con-ovt__ro-quiet').exists()).to.eq(false);

    // A generation with nothing pinned says so; another tab's detail is not this tab's.
    consoleOverviewUi.detail = {kind: 'generation', gen: 1};
    await nextTick();
    expect(w.findAll('.con-ovt__dossier > .con-ovt__dcol')[2].find('.con-ovt__ro-quiet').text()).to.eq('A quiet generation');
    consoleOverviewUi.detail = {kind: 'score-category', catKey: 'tr'};
    await nextTick();
    expect(w.find('.con-egov-detail').exists()).to.eq(false);
  });

  it('too short for a chart: the empty state, with at most three lone episodes', () => {
    const w = tab(overviewVm(1));
    expect(w.findComponent(ChartStub).exists()).to.eq(false);
    expect(w.find('.con-ovt__readout').exists()).to.eq(false);
    expect(w.find('.con-egov-empty__title').text()).to.eq('Too short for a timeline');
    expect(w.find('.con-egov-empty__note').text()).to.eq('The score chart needs at least two generations of data.');
    expect(w.findAll('.con-ovt__ro-eps--lone > .con-ovt__ro-ep').map((e) => e.find('.rich-stub').attributes('data-key')))
      .to.deep.eq(['Sentence turn', 'Sentence late', 'Sentence loose']);

    const nothing = overviewVm(1);
    const bare = tab({...nothing, timeline: {...nothing.timeline, episodes: []}});
    expect(bare.find('.con-ovt__ro-eps--lone').exists()).to.eq(false);
  });

  it('the overview\'s ref sees the pane API — `nav` and `primary` — and nothing else', () => {
    const {pane} = underOverview(overviewVm());
    expect(pane(), 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(pane()!).sort(), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['nav', 'primary']);
    const leaked = ['vm', 'reveal', 'ui', 'cursor', 'drawable', 'pinnedEpisodes', 'rowsAt', 'markStyle', 'hex']
      .filter((key) => (pane() as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('`nav` walks the generations on ←/→ (clamped) and jumps between pinned episodes on ↑/↓ (a ring); `primary` opens the cursor generation — under which both rest', async () => {
    const {wrapper, pane} = underOverview(overviewVm());
    pane()!.nav('left');
    expect(consoleOverviewUi.timelineGen, 'from the last generation, one back').to.eq(1);
    pane()!.nav('left');
    pane()!.nav('left');
    expect(consoleOverviewUi.timelineGen, '← stops at the first generation').to.eq(0);
    await nextTick();
    expect(wrapper.find('.con-ovt__ro-gen > b').text()).to.eq('1');

    // The pinned episodes stand in generations 2 and 3 (columns 1 and 2).
    pane()!.nav('down');
    expect(consoleOverviewUi.timelineGen).to.eq(1);
    pane()!.nav('down');
    expect(consoleOverviewUi.timelineGen).to.eq(2);
    pane()!.nav('down');
    expect(consoleOverviewUi.timelineGen, '↓ past the last pinned episode wraps to the first').to.eq(1);
    pane()!.nav('up');
    expect(consoleOverviewUi.timelineGen, '↑ before the first pinned episode wraps to the last').to.eq(2);

    pane()!.primary();
    expect(consoleOverviewUi.detail).to.deep.eq({kind: 'generation', gen: 3});
    await nextTick();
    expect(wrapper.find('.con-egov-detail__title').text().replace(/\s+/g, ' ')).to.eq('Generation 3');

    // The dossier is a static read: the d-pad moves nothing under it, A opens nothing over it.
    pane()!.nav('left');
    expect(consoleOverviewUi.timelineGen).to.eq(2);
    consoleOverviewUi.timelineGen = 0;
    pane()!.primary();
    expect(consoleOverviewUi.detail, 'the open dossier stays the one that was opened').to.deep.eq({kind: 'generation', gen: 3});
  });

  it('with no chart to walk, neither `nav` nor `primary` does anything', () => {
    const {pane} = underOverview(overviewVm(1));
    pane()!.nav('left');
    pane()!.nav('down');
    pane()!.primary();
    expect([consoleOverviewUi.timelineGen, consoleOverviewUi.detail]).to.deep.eq([-1, undefined]);
  });
});
