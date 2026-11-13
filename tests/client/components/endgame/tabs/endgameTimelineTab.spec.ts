/*
 * EndgameTimelineTab — how the game went: the timeline callouts, the VP chart with its decisive moment, the global
 * parameters' progress. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): it reads two props
 * (`model`, `view`; `viewerColor` is declared only so the overlay's shared props do not fall through), emits nothing
 * and exposes nothing — so the spec is what it renders for them and what it HANDS each chart. Mounted WITHOUT the
 * i18n plugin on purpose: the component imports `v-i18n` itself, and a Vue warning (an unresolved directive) fails
 * the test.
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {GlobalParameter} from '@/common/GlobalParameter';
import {ViewModel} from '@/common/models/PlayerModel';
import EndgameTimelineTab from '@/client/components/endgame/tabs/EndgameTimelineTab.vue';
import {EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';

// The chart draws itself (an SVG, a measured width) — its own subject; this spec reads what the tab HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const ChartStub = defineComponent({
  name: 'EndgameLineChart',
  props: {
    series: Array, generations: Number, height: Number, unit: String, xLabel: String,
    fixedMax: Number, fill: Boolean, annotations: Array, showDeltas: Boolean,
  },
  render: () => h('i', {class: 'chart-stub'}),
});

type Globals = Partial<Record<GlobalParameter, number>>;
type ModelFields = {winner: EndgamePlayerScore, winnerTookLeadGen: number, leadChanges: number, finalSurge: {color: Color, gain: number}};

/** One score row — only what the tab reads. */
function score(color: Color, name: string, vpByGeneration: Array<number>): EndgamePlayerScore {
  return {color, name, vpByGeneration} as unknown as EndgamePlayerScore;
}

function model(players: Array<EndgamePlayerScore>, generation: number, fields: Partial<ModelFields> = {}): EndgameModel {
  const {winner, winnerTookLeadGen, leadChanges, finalSurge} = fields;
  const timeline = leadChanges === undefined && finalSurge === undefined ? undefined : {leadChanges, finalSurge};
  return {players, generation, winner, winnerTookLeadGen, timeline} as unknown as EndgameModel;
}

function view(globalsPerGeneration: Array<Globals>, expansions: {venus?: boolean, moon?: boolean} = {}): ViewModel {
  return {game: {gameOptions: {expansions}, globalsPerGeneration}} as unknown as ViewModel;
}

function tab(props: Record<string, unknown>) {
  return mount(EndgameTimelineTab, {props, global: {config: globalConfig.global.config, stubs: {EndgameLineChart: ChartStub}}});
}

describe('EndgameTimelineTab — how the game went', () => {
  const victor = () => score('red', 'Victor', [20, 24, 31, 40]);
  const nastya = () => score('blue', 'Nastya', [20, 26, 30, 38]);

  it('the callouts: the game\'s length, when the winner took the lead, the lead changes, the fastest finish', () => {
    const w = tab({
      model: model([victor(), nastya()], 4, {winner: victor(), winnerTookLeadGen: 3, leadChanges: 2, finalSurge: {color: 'blue', gain: 12}}),
      view: view([]),
    });
    expect(w.classes()).to.deep.eq(['eg-tab', 'eg-timeline']);
    const chips = w.findAll('.eg-timeline__chips > .eg-stat-chip');
    expect(chips.map((chip) => chip.text().replace(/\s+/g, ' '))).to.deep.eq([
      '4' + $t('generations'),
      $t('Took the lead in gen') + ' 3',
      '2' + $t('Lead changes'),
      $t('Fastest finish') + ': Nastya +12 ' + $t('VP'),
    ]);
    expect(chips.map((chip) => (chip.element as HTMLElement).style.getPropertyValue('--eg-pc')), 'the winner\'s and the finisher\'s colours')
      .to.deep.eq(['', endgamePlayerHex('red'), '', endgamePlayerHex('blue')]);
    expect(chips[1].find('.eg-stat-chip__dot').classes()).to.deep.eq(['eg-stat-chip__dot', 'player_bg_color_red']);
    expect(chips[3].find('.eg-stat-chip__dot').classes()).to.deep.eq(['eg-stat-chip__dot', 'player_bg_color_blue']);
  });

  it('a quiet game says less — wire to wire, no chip for one lead change or a small finish, none for a game with no winner', async () => {
    const w = tab({
      model: model([victor(), nastya()], 4, {winner: victor(), leadChanges: 1, finalSurge: {color: 'blue', gain: 7}}),
      view: view([]),
    });
    const chips = () => w.findAll('.eg-stat-chip').map((chip) => chip.text().replace(/\s+/g, ' '));
    expect(chips()).to.deep.eq(['4' + $t('generations'), $t('Led wire to wire')]);

    // A finisher who is no seat of the model is nobody to name.
    await w.setProps({model: model([victor(), nastya()], 4, {winner: victor(), finalSurge: {color: 'green', gain: 20}})});
    expect(chips()).to.deep.eq(['4' + $t('generations'), $t('Led wire to wire')]);

    await w.setProps({model: model([victor()], 6)});
    expect(chips()).to.deep.eq(['6' + $t('generations')]);
  });

  it('the VP chart: one line per player over the generations — the turning point drawn on it', async () => {
    const w = tab({model: model([victor(), nastya()], 4, {winner: victor(), winnerTookLeadGen: 3}), view: view([])});
    expect(w.findAll('.eg-chart-card').map((card) => card.find('.eg-section-title').text()), 'no parameter history — one chart')
      .to.deep.eq([$t('Victory points by generation')]);
    const charts = w.findAllComponents(ChartStub);
    expect(charts).to.have.length(1);
    expect(charts[0].props()).to.deep.eq({
      series: [
        {label: 'Victor', color: 'red', data: [20, 24, 31, 40]},
        {label: 'Nastya', color: 'blue', data: [20, 26, 30, 38]},
      ],
      generations: 4,
      height: 320,
      unit: undefined,
      xLabel: $t('Generation'),
      fixedMax: undefined,
      fill: true,
      annotations: [{index: 2, label: $t('Turning point'), color: endgamePlayerHex('red')}],
      showDeltas: true,
    });

    // Led from the first generation: there is no moment to mark.
    await w.setProps({model: model([victor(), nastya()], 4, {winner: victor()})});
    expect(w.findAllComponents(ChartStub)[0].props('annotations')).to.deep.eq([]);
  });

  it('the parameter chart: each scale as a share of its own range, generation by generation — the expansions\' scales only in their games', async () => {
    const history: Array<Globals> = [
      {[GlobalParameter.TEMPERATURE]: -30, [GlobalParameter.OXYGEN]: 0, [GlobalParameter.OCEANS]: 0, [GlobalParameter.VENUS]: 0},
      {[GlobalParameter.TEMPERATURE]: -11, [GlobalParameter.OXYGEN]: 7, [GlobalParameter.VENUS]: 15},
      {[GlobalParameter.TEMPERATURE]: 8, [GlobalParameter.OXYGEN]: 14, [GlobalParameter.OCEANS]: 9, [GlobalParameter.VENUS]: 30},
    ];
    const w = tab({model: model([victor(), nastya()], 3), view: view(history)});
    expect(w.findAll('.eg-chart-card').map((card) => card.find('.eg-section-title').text()))
      .to.deep.eq([$t('Victory points by generation'), $t('Global parameter progress')]);
    const progress = () => w.findAllComponents(ChartStub)[1];
    expect(progress().props()).to.deep.eq({
      series: [
        {label: $t('Temperature'), color: '#e8743b', data: [0, 50, 100]},
        {label: $t('Oxygen'), color: '#6fc46f', data: [0, 50, 100]},
        // A generation with no reading of a scale stands at the scale's start.
        {label: $t('Oceans'), color: '#4f9be0', data: [0, 0, 100]},
      ],
      generations: 3,
      height: 300,
      unit: '%',
      xLabel: $t('Generation'),
      fixedMax: 100,
      fill: false,
      annotations: undefined,
      showDeltas: false,
    });

    await w.setProps({view: view(history, {venus: true, moon: true})});
    const series = progress().props('series') as Array<{label: string, data: Array<number>}>;
    expect(series.map((line) => line.label)).to.deep.eq([
      $t('Temperature'), $t('Oxygen'), $t('Oceans'), $t('Venus'), $t('L. Habitat'), $t('L. Mining'), $t('L. Logistic'),
    ]);
    expect(series[3].data).to.deep.eq([0, 50, 100]);
    expect(series[4].data, 'a scale nobody moved').to.deep.eq([0, 0, 0]);
  });
});
