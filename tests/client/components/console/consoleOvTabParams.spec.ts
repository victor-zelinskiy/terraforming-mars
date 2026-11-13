/*
 * ConsoleOvTabParams — «ПАРАМЕТРЫ», a tab of the endgame overview. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its `vm` over the overview's module state (the parameter rail,
 * the chart's series, who pushed the focused track, the honest empty state) — and the PANE API its parent reaches
 * through `ref="pane"`: `ConsoleEndgameOverview.handleIntent` calls `nav(dir)` on a d-pad step and `primary()` on A,
 * so a parent's ref must carry exactly those two. The chart is stubbed by name (its drawing is `ConsoleOvChart`'s
 * subject). The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {Color} from '@/common/Color';
import {GlobalParameter} from '@/common/GlobalParameter';
import {ConsoleOverviewVm, OvChartSeries, OvParameter, OvPlayerCard} from '@/client/console/endgame/consoleOverviewModel';
import {consoleOverviewUi, resetConsoleOverview} from '@/client/console/endgame/consoleOverviewState';
import ConsoleOvTabParams from '@/client/components/console/ConsoleOvTabParams.vue';

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

const global = {...globalConfig.global, stubs: {ConsoleOvChart: ChartStub}};

function seat(color: Color, name: string): OvPlayerCard {
  return {
    color, name, corporation: '', face: undefined, maMedals: [], place: 1, total: 0, isBot: false, isWinner: false,
    production: [], stock: [], stats: [], tags: [], milestones: [], awards: [], categories: [], groups: [],
  };
}

function parameter(key: GlobalParameter, over: Partial<OvParameter>): OvParameter {
  return {
    key, label: 'Temperature', accent: 'temperature', unit: '°C', min: -30, max: 8,
    series: [], pct: [], finalValue: 0, finalPct: 0, completed: false, contributions: undefined, ...over,
  };
}

/** Three generations, three tracks: the temperature (pushed by both seats), the oxygen (maxed, nobody on record), the oceans. */
function overviewVm(gens = 3): ConsoleOverviewVm {
  return {
    generation: gens,
    winner: undefined,
    sharedWin: false,
    digest: {verdict: undefined, lead: [], headline: [], observations: [], ranking: []},
    score: {ranking: [], categories: [], maxCategoryValue: 1, decisive: undefined, tieBreak: undefined},
    timeline: {
      gens: 0, series: [], episodes: [], maxVp: 0,
      stats: {generations: 0, leadChanges: undefined, tookLeadGen: undefined, wireToWire: false, finalSurge: undefined},
    },
    cards: {rows: [], byPlayer: []},
    parameters: {
      gens,
      parameters: [
        parameter(GlobalParameter.TEMPERATURE, {
          series: [-30, -20, -10], pct: [0, 26, 53], finalValue: -10, finalPct: 53,
          contributions: {values: {red: 4, blue: 6, green: 0}, leaders: ['blue'], max: 6},
        }),
        parameter(GlobalParameter.OXYGEN, {
          label: 'Oxygen', accent: 'oxygen', unit: '%', min: 0, max: 14,
          series: [0, 5, 14], pct: [0, 36, 100], finalValue: 14, finalPct: 100, completed: true,
        }),
        parameter(GlobalParameter.OCEANS, {
          label: 'Oceans', accent: 'oceans', unit: '', min: 0, max: 9,
          series: [0, 3, 9], pct: [0, 33, 100], finalValue: 9, finalPct: 100, completed: true,
        }),
      ],
    },
    players: {players: [seat('red', 'Ada'), seat('blue', 'Bo')], maxima: {}, comparable: {}, displayNames: {}},
  };
}

function tab(vm: ConsoleOverviewVm, reveal = false) {
  return mount(ConsoleOvTabParams, {global, props: {vm, reveal}});
}

/** The tab the way the overview mounts it: under an Options host with the string ref `pane`. */
function underOverview(vm: ConsoleOverviewVm) {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleOvTabParams, {ref: 'pane', vm})]),
  });
  const wrapper = mount(Host, {global});
  return {
    wrapper,
    /** Exactly the overview's read: `(this.$refs.pane ?? undefined) as Pane | undefined`. */
    pane: () => (wrapper.vm.$refs.pane ?? undefined) as Pane | undefined,
  };
}

describe('ConsoleOvTabParams — the planet\'s own story', () => {
  // The overview's state is a MODULE (it outlives the scene): every test starts from — and leaves — a fresh one.
  beforeEach(resetConsoleOverview);
  afterEach(resetConsoleOverview);

  it('the rail: a row per track with its final value — the focused one marked, the oceans as N / max, a maxed track says so', () => {
    const w = tab(overviewVm());
    // The template starts with its root: the wrapper IS the tab.
    expect(w.classes()).to.include('con-ovp');
    const rows = w.findAll('.con-ovp__rail > .con-ovp__prow');
    expect(rows.map((r) => r.find('.con-ovp__pname').text())).to.deep.eq(['Temperature', 'Oxygen', 'Oceans']);
    expect(rows.map((r) => r.find('.con-ovp__pfinal > b').text())).to.deep.eq(['-10°C', '14%', '9/9']);
    expect(rows.map((r) => r.classes().includes('con-ovp__prow--focused'))).to.deep.eq([true, false, false]);
    expect(rows.map((r) => r.classes().find((c) => c.startsWith('con-ovp-acc--'))))
      .to.deep.eq(['con-ovp-acc--temperature', 'con-ovp-acc--oxygen', 'con-ovp-acc--oceans']);
    expect(rows.map((r) => r.find('.con-ovp__picon').classes().find((c) => c.startsWith('wgt-icon--'))))
      .to.deep.eq(['wgt-icon--temperature', 'wgt-icon--oxygen', 'wgt-icon--ocean']);
    expect(rows.map((r) => r.find('.con-ovp__pdone').exists())).to.deep.eq([false, true, true]);
    expect(w.find('.con-egov-empty--rail').exists()).to.eq(false);
  });

  it('ONE chart: every track indexed to % completion, the focused one in full ink — and the readout names the cursor generation', async () => {
    const w = tab(overviewVm(), true);
    const chart = w.findComponent(ChartStub);
    expect(chart.classes()).to.include('con-ovp__chart');
    expect(chart.props('series').map((s) => [s.key, s.data, s.emphasis, s.dim])).to.deep.eq([
      [GlobalParameter.TEMPERATURE, [0, 26, 53], true, false],
      [GlobalParameter.OXYGEN, [0, 36, 100], false, true],
      [GlobalParameter.OCEANS, [0, 33, 100], false, true],
    ]);
    expect([chart.props('points'), chart.props('maxY'), chart.props('unit'), chart.props('fill'), chart.props('reveal')])
      .to.deep.eq([3, 100, '%', true, true]);
    expect(chart.props('cursor'), 'a tab not visited yet stands on the LAST generation').to.eq(2);
    /** The readout of the focused track at the cursor: its name, the exact value, the completion. */
    const readout = () => {
      const value = w.find('.con-ovp__ro-val');
      const exact = value.find('b').text();
      const pct = value.find('.con-ovp__ro-pct').text();
      return [value.text().replace(exact + pct, '').trim(), exact, pct];
    };
    expect(w.find('.con-ovp__ro-gen > b').text()).to.eq('3');
    expect(readout()).to.deep.eq(['Temperature', '-10°C', '53%']);
    expect(w.findAll('.con-egov-legend__item').map((l) => l.classes().includes('con-egov-legend__item--dim'))).to.deep.eq([false, true, true]);

    // The module's focus moves — the tab follows it (the state is not the component's).
    consoleOverviewUi.paramIdx = 2;
    consoleOverviewUi.paramGen = 1;
    await nextTick();
    expect(chart.props('series').map((s) => s.emphasis)).to.deep.eq([false, false, true]);
    expect(chart.props('cursor')).to.eq(1);
    expect(readout()).to.deep.eq(['Oceans', '3/9', '33%']);
    expect(w.findAll('.con-ovp__prow').map((r) => r.classes().includes('con-ovp__prow--focused'))).to.deep.eq([false, false, true]);
  });

  it('who pushed the focused track — biggest first, by the seat\'s name, never a zero; a track with nobody on record says so', async () => {
    const w = tab(overviewVm());
    const push = w.findAll('.con-ovp__push > .con-ovp__push-row');
    expect(push.map((r) => [r.find('.con-ovp__push-name').text(), r.find('.con-ovp__push-val').text()])).to.deep.eq([['Bo', '6'], ['Ada', '4']]);
    expect(push.map((r) => r.find('.con-egov-legend__dot').classes().find((c) => c.startsWith('player_bg_color_'))))
      .to.deep.eq(['player_bg_color_blue', 'player_bg_color_red']);
    expect(w.find('.con-ovp__push-quiet').exists()).to.eq(false);

    consoleOverviewUi.paramIdx = 1;
    await nextTick();
    expect(w.findAll('.con-ovp__push-row')).to.have.length(0);
    expect(w.find('.con-ovp__push-quiet').text()).to.eq('No steps recorded for this track');
  });

  it('too short for a line: no chart, and the empty state names the honest cause', () => {
    const oneGeneration = tab(overviewVm(1));
    expect(oneGeneration.findComponent(ChartStub).exists()).to.eq(false);
    expect(oneGeneration.find('.con-ovp__readout').exists()).to.eq(false);
    expect(oneGeneration.find('.con-ovp__main > .con-egov-empty .con-egov-empty__title').text()).to.eq('No parameter history for this game');
    expect(oneGeneration.find('.con-egov-empty__note').text()).to.eq('The game ended within a single generation.');
    expect(tab(overviewVm(0)).find('.con-egov-empty__note').text()).to.eq('Older saves carry only the final contribution totals.');

    const noTracks = tab({...overviewVm(), parameters: {gens: 3, parameters: []}});
    expect(noTracks.find('.con-egov-empty--rail .con-egov-empty__title').text()).to.eq('No parameter data');
    expect(noTracks.findComponent(ChartStub).exists()).to.eq(false);
  });

  it('the overview\'s ref sees the pane API — `nav` and `primary` — and nothing else', () => {
    const {pane} = underOverview(overviewVm());
    expect(pane(), 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(pane()!).sort(), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['nav', 'primary']);
    const leaked = ['vm', 'reveal', 'ui', 'cursor', 'paramIdx', 'drawable', 'fmtValue', 'accentHex']
      .filter((key) => (pane() as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('`nav` walks the tracks on ↑/↓ (a ring) and the generations on ←/→ (clamped); `primary` opens nothing here', async () => {
    const {wrapper, pane} = underOverview(overviewVm());
    const focused = () => wrapper.findAll('.con-ovp__prow').findIndex((r) => r.classes().includes('con-ovp__prow--focused'));
    pane()!.nav('down');
    expect(consoleOverviewUi.paramIdx).to.eq(1);
    pane()!.nav('up');
    pane()!.nav('up');
    expect(consoleOverviewUi.paramIdx, '↑ from the first track wraps to the last').to.eq(2);
    await nextTick();
    expect(focused()).to.eq(2);

    pane()!.nav('left');
    expect(consoleOverviewUi.paramGen, 'from the last generation, one back').to.eq(1);
    pane()!.nav('right');
    pane()!.nav('right');
    expect(consoleOverviewUi.paramGen, '→ stops at the last generation').to.eq(2);
    await nextTick();
    expect(wrapper.find('.con-ovp__ro-gen > b').text()).to.eq('3');

    pane()!.primary();
    expect(consoleOverviewUi.detail, 'the readout already states the exact value — no deeper layer').to.eq(undefined);
  });

  it('with no chart to walk, ←/→ moves nothing', () => {
    const {pane} = underOverview(overviewVm(1));
    pane()!.nav('left');
    pane()!.nav('right');
    expect(consoleOverviewUi.paramGen).to.eq(-1);
  });
});
