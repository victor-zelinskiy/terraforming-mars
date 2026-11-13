import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import VictoryPointChart from '@/client/components/gameend/VictoryPointChart.vue';
import {Color} from '@/common/Color';

/** A line of the chart (`DataSet` of `VictoryPointChart.vue`: a type a spec cannot import from a `.vue`). */
type ChartSet = {label: string, data: ReadonlyArray<number>, color: Color};

/*
 * The end-of-game line chart. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): five props in,
 * nothing out, nothing exposed. Its own markup is the canvas chart.js draws on, found by the `id` it was given; the
 * drawing itself needs a 2D context and a `ResizeObserver` the unit runner's jsdom has not got, so the spec is the
 * element the component stands for its props (the loader's cache the charts share is `victoryPointChartState.ts`).
 */
describe('VictoryPointChart', () => {
  // VictoryPointChart uses canvas/Chart.js which JSDOM can't fully handle
  it('mounts without errors', async () => {
    const wrapper = shallowMount(VictoryPointChart, {
      ...globalConfig,
      props: {
        datasets: [],
        generation: 5,
        animation: false,
        id: 'test-chart',
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('stands ONE canvas in its container, under the id it was given — and the same canvas follows the id', async () => {
    const datasets: ReadonlyArray<ChartSet> = [{label: 'Ann', data: [20, 24, 31], color: 'blue'}];
    const wrapper = shallowMount(VictoryPointChart, {
      ...globalConfig,
      props: {
        datasets,
        generation: 3,
        animation: true,
        id: 'victory-points',
      },
    });
    expect(wrapper.classes()).to.deep.eq(['victory-point-chart-container']);
    expect(Array.from((wrapper.element as Element).children).map((child) => child.tagName)).to.deep.eq(['CANVAS']);
    const canvas = wrapper.find('canvas');
    expect(canvas.attributes('id')).to.eq('victory-points');

    await wrapper.setProps({id: 'global-parameters'});
    expect(wrapper.find('canvas').attributes('id')).to.eq('global-parameters');
    expect(wrapper.find('canvas').element, 'the canvas is re-labelled, not replaced').to.eq(canvas.element);
  });

  it('its optional props: the y axis reads «Victory Points» and the chart does not animate unless told to', () => {
    const wrapper = shallowMount(VictoryPointChart, {
      ...globalConfig,
      props: {
        datasets: [],
        generation: 5,
        id: 'test-chart',
      },
    });
    expect(wrapper.props('yAxisLabel')).to.eq('Victory Points');
    expect(wrapper.props('animation')).to.eq(false);
    expect(wrapper.find('canvas').attributes('id')).to.eq('test-chart');
  });
});
