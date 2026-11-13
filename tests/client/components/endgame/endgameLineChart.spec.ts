/*
 * EndgameLineChart — the custom-drawn SVG line chart of the endgame timeline (VP by generation, the global parameters'
 * progress). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): nine props, no emits, nothing
 * exposed — so the spec is what it draws for them and how it answers the pointer. Mounted WITHOUT the i18n plugin on
 * purpose: the component imports `v-i18n` itself, and a Vue warning (an unresolved directive) fails the test.
 *
 * The geometry is the component's own arithmetic on its measured width — 640 in this environment (jsdom lays nothing
 * out, so the measure keeps the default): the plot runs from x = 42 to x = 622 and, at the default height of 300, from
 * y = 26 (the scale's top) to y = 274 (zero).
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import EndgameLineChart from '@/client/components/endgame/EndgameLineChart.vue';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';

type Series = {label: string, color: string, data: ReadonlyArray<number>};

function chart(props: Record<string, unknown>) {
  return mount(EndgameLineChart, {props, global: {config: globalConfig.global.config}});
}

/** The n-th chart's gradient ids carry its own number: `egc-grad-<uid>-<series>`. */
function gradientIds(w: ReturnType<typeof chart>): Array<string> {
  return w.findAll('[id^="egc-grad-"]').map((g) => g.attributes('id') ?? '');
}

describe('EndgameLineChart — the timeline\'s line chart', () => {
  const victor: Series = {label: 'Victor', color: 'red', data: [0, 10, 20]};
  const nastya: Series = {label: 'Nastya', color: 'blue', data: [0, 14, 12]};

  it('the legend and the axes: one entry per series with its final value, tidy y ticks, one x tick per generation', () => {
    const w = chart({series: [victor, nastya], generations: 3, unit: '%', xLabel: 'Generation'});
    expect(w.classes()).to.deep.eq(['eg-chart']);
    const legend = w.findAll('.eg-chart__legend > .eg-chart__legend-item');
    expect(legend.map((item) => item.find('.eg-chart__legend-label').text())).to.deep.eq(['Victor', 'Nastya']);
    expect(legend.map((item) => item.find('.eg-chart__legend-final').text())).to.deep.eq(['20%', '12%']);

    const svg = w.find('svg.eg-chart__svg');
    expect(svg.attributes('viewBox')).to.eq('0 0 640 300');
    expect((w.find('.eg-chart__canvas').element as HTMLElement).style.height).to.eq('300px');
    // The data tops out at 20 — a step of 5, four intervals.
    expect(w.findAll('.eg-chart__ytick').map((t) => t.text())).to.deep.eq(['0%', '5%', '10%', '15%', '20%']);
    expect(w.findAll('.eg-chart__gridline').map((line) => line.attributes('y1'))).to.deep.eq(['274', '212', '150', '88', '26']);
    expect(w.findAll('.eg-chart__gridline').map((line) => line.classes('eg-chart__gridline--axis'))).to.deep.eq([true, false, false, false, false]);
    expect(w.findAll('.eg-chart__xtick').map((t) => t.text())).to.deep.eq(['1', '2', '3']);
    expect(w.findAll('.eg-chart__xtick').map((t) => t.attributes('x'))).to.deep.eq(['42', '332', '622']);
    expect(w.find('.eg-chart__axislabel').text()).to.eq('Generation');
  });

  it('one line per series in its colour — a player\'s colour through the palette, a literal hex as it is; the area only when filled; a fixed scale; the marked moments', async () => {
    const w = chart({series: [victor, {label: 'Oxygen', color: '#6fc46f', data: [5, 5, 5]}], generations: 3});
    const lines = () => w.findAll('.eg-chart__series > path.eg-chart__line').map((line) => line.attributes('d'));
    expect(lines()).to.deep.eq(['M42.0 274.0 L332.0 150.0 L622.0 26.0', 'M42.0 212.0 L332.0 212.0 L622.0 212.0']);
    expect(w.findAll('[id^="egc-grad-"]').map((g) => g.findAll('stop').map((stop) => stop.attributes('stop-color'))))
      .to.deep.eq([[endgamePlayerHex('red'), endgamePlayerHex('red')], ['#6fc46f', '#6fc46f']]);
    expect(w.findAll('.eg-chart__endpoint').map((dot) => [dot.attributes('cx'), dot.attributes('cy')])).to.deep.eq([['622', '26'], ['622', '212']]);
    expect(w.find('.eg-chart__area').exists(), 'no wash unless asked').to.eq(false);
    expect(w.find('.eg-chart__anno').exists()).to.eq(false);

    await w.setProps({fill: true});
    expect(w.findAll('.eg-chart__area').map((area) => area.attributes('d')))
      .to.deep.eq(['M42.0 274.0 L42.0 274.0 L332.0 150.0 L622.0 26.0 L622.0 274.0 Z', 'M42.0 274.0 L42.0 212.0 L332.0 212.0 L622.0 212.0 L622.0 274.0 Z']);

    // A fixed upper bound replaces the data's own: 20 of 100 is a fifth of the way up.
    await w.setProps({fixedMax: 100});
    expect(w.findAll('.eg-chart__ytick').map((t) => t.text())).to.deep.eq(['0', '25', '50', '75', '100']);
    expect(lines()[0]).to.eq('M42.0 274.0 L332.0 249.2 L622.0 224.4');

    // A moment outside the plotted generations is not drawn; a moment with no colour takes the gold.
    await w.setProps({annotations: [{index: 1, label: 'Turning point'}, {index: 2, label: 'Finish', color: '#ff0000'}, {index: 3, label: 'Never'}]});
    const moments = w.findAll('.eg-chart__anno');
    expect(moments.map((m) => m.find('.eg-chart__anno-label').text())).to.deep.eq(['Turning point', 'Finish']);
    expect(moments.map((m) => m.find('.eg-chart__anno-line').attributes('x1'))).to.deep.eq(['332', '622']);
    expect(moments.map((m) => (m.find('.eg-chart__anno-label').element as HTMLElement).style.fill), '#ffcc64 · #ff0000')
      .to.deep.eq(['rgb(255, 204, 100)', 'rgb(255, 0, 0)']);
  });

  it('the pointer: a column under it opens the tooltip — the leader first, the rest with their gap — and the legend spotlights a series', async () => {
    const w = chart({series: [victor, nastya], generations: 3, showDeltas: true});
    expect(w.find('.eg-chart__tip').exists()).to.eq(false);
    expect(w.find('.eg-chart__guide').exists()).to.eq(false);

    // The middle column of three stands at x = 332 (jsdom's svg rect starts at 0) — the pointer snaps to the nearest.
    await w.find('svg.eg-chart__svg').trigger('mousemove', {clientX: 330});
    const tip = w.find('.eg-chart__tip');
    expect(tip.find('.eg-chart__tip-head').text()).to.eq('Gen 2');
    const rows = tip.findAll('.eg-chart__tip-row');
    expect(rows.map((row) => row.find('.eg-chart__tip-name').text()), 'sorted by the value at that generation').to.deep.eq(['Nastya', 'Victor']);
    expect(rows.map((row) => row.find('.eg-chart__tip-val').text())).to.deep.eq(['14', '10']);
    expect(rows.map((row) => row.classes('eg-chart__tip-row--lead'))).to.deep.eq([true, false]);
    expect(rows.map((row) => row.find('.eg-chart__tip-delta').exists())).to.deep.eq([false, true]);
    expect(rows[1].find('.eg-chart__tip-delta').text()).to.eq('−4');
    expect((tip.element as HTMLElement).style.left, 'left of the guide once it stands past the middle (332 − 188)').to.eq('144px');
    expect((tip.element as HTMLElement).style.top).to.eq('26px');
    expect(w.find('.eg-chart__guide').attributes('x1')).to.eq('332');
    expect(w.findAll('.eg-chart__point').map((p) => p.attributes('cy'))).to.deep.eq(['150', '100.4']);
    expect(w.findAll('.eg-chart__xtick').map((t) => t.classes('eg-chart__xtick--hot'))).to.deep.eq([false, true, false]);

    // Past the plot's edges the pointer stays on the nearest column; in the left half the tooltip stands right of the guide.
    await w.find('svg.eg-chart__svg').trigger('mousemove', {clientX: 5000});
    expect(w.find('.eg-chart__tip-head').text()).to.eq('Gen 3');
    expect((w.find('.eg-chart__tip').element as HTMLElement).style.left).to.eq('434px');
    await w.find('svg.eg-chart__svg').trigger('mousemove', {clientX: -50});
    expect(w.find('.eg-chart__tip-head').text()).to.eq('Gen 1');
    expect((w.find('.eg-chart__tip').element as HTMLElement).style.left, '42 + 14').to.eq('56px');

    await w.find('svg.eg-chart__svg').trigger('mouseleave');
    expect(w.find('.eg-chart__tip').exists()).to.eq(false);
    expect(w.find('.eg-chart__guide').exists()).to.eq(false);

    const legend = w.findAll('.eg-chart__legend-item');
    await legend[1].trigger('mouseenter');
    expect(w.findAll('.eg-chart__legend-item').map((item) => item.classes('eg-chart__legend-item--dim'))).to.deep.eq([true, false]);
    expect(w.findAll('.eg-chart__series').map((s) => s.classes('eg-chart__series--dim'))).to.deep.eq([true, false]);
    await legend[1].trigger('mouseleave');
    expect(w.findAll('.eg-chart__series--dim')).to.have.length(0);
  });

  it('every chart on a page takes its OWN gradient ids — the number is the page\'s, one more per chart', () => {
    const first = chart({series: [victor, nastya], generations: 3});
    const second = chart({series: [victor], generations: 3});
    const idsOfFirst = gradientIds(first);
    const idsOfSecond = gradientIds(second);
    expect(idsOfFirst).to.have.length(2);
    expect(idsOfSecond).to.have.length(1);
    const uid = (id: string): number => Number(/^egc-grad-(\d+)-\d+$/.exec(id)?.[1]);
    expect(idsOfFirst.map(uid)[0]).to.eq(idsOfFirst.map(uid)[1]);
    expect(idsOfFirst[0].endsWith('-0') && idsOfFirst[1].endsWith('-1')).to.eq(true);
    expect(uid(idsOfSecond[0]), 'the counter is shared by the charts, never restarted in one').to.eq(uid(idsOfFirst[0]) + 1);
  });
});
