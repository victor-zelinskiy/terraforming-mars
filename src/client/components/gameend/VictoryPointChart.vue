<template>
  <div class="victory-point-chart-container">
    <canvas :id="id"></canvas>
  </div>
</template>
<script setup lang="ts">
import {onMounted} from 'vue';
import {Color} from '@/common/Color';
import {translateText} from '@/client/directives/i18n';
import {loadChart} from '@/client/components/gameend/victoryPointChartState';

// (An exported type stands with the imports, above the script's first statement: the body of a Vapor script-setup block
// is a function body to the type checker, and an `export` below a statement is not at a module's top level there.)
export type DataSet = {
  label: string;
  data: ReadonlyArray<number>,
  color: Color,
};

const COLOR_CODES: Record<Color, string> = {
  ['red']: 'rgb(153, 17, 0)',
  ['yellow']: 'rgb(170, 170, 0)',
  ['green']: 'rgb(0, 153, 0)',
  ['black']: 'rgb(170, 170, 170)',
  ['blue']: 'rgb(0, 102, 255)',
  ['purple']: 'rgb(140, 0, 255)',
  ['orange']: 'rgb(236, 113, 12)',
  ['pink']: 'rgb(245, 116, 187)',

  // Not actual player colors
  ['neutral']: '',
  ['bronze']: '',
};

interface ChartDataSet {
  label: string,
  data: ReadonlyArray<number>,
  fill: boolean,
  backgroundColor: string,
  borderColor: string,
  tension: number,
  pointRadius: number,
}

defineOptions({name: 'VictoryPointChart'});
const props = defineProps({
  datasets: {
    type: Array as () => ReadonlyArray<DataSet>,
    required: true,
  },
  generation: {
    type: Number,
    required: true,
  },
  animation: {
    type: Boolean,
  },
  id: {
    type: String,
    required: true,
  },
  yAxisLabel: {
    type: String,
    required: false,
    default: 'Victory Points',
  },
});

function getLabels(): Array<number> {
  return Array.from({length: props.generation}, (_, index) => index + 1);
}
function getAllPlayerDataSet(): Array<ChartDataSet> {
  return props.datasets.map((dataset) => {
    return {
      label: dataset.label,
      data: dataset.data,
      fill: false,
      backgroundColor: COLOR_CODES[dataset.color],
      borderColor: COLOR_CODES[dataset.color],
      tension: 0.1,
      pointRadius: 6,
    };
  });
}
async function renderChart(): Promise<void> {
  const ctx = document.getElementById(props.id) as HTMLCanvasElement;
  if (ctx !== null) {
    const Chart = await loadChart();
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: getLabels(),
        datasets: getAllPlayerDataSet(),
      },
      options: {
        animation: {
          duration: props.animation ? 1000 : 0,
          easing: 'linear',
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            title: {text: translateText(props.yAxisLabel), display: true},
            grid: {
              color: (ctx) => {
                return ctx.tick.value % 10 === 0 ? 'lightgray' : 'rgb(90, 90, 90)';
              },
            },
            beginAtZero: true,
            ticks: {
              autoSkip: false,
              stepSize: 5,
              callback: (value: string | number) => {
                // I don't know what to do when it's of string type yet, so this just ensures it's displayed.
                if (typeof(value) === 'string') {
                  return value;
                }
                return value % 10 === 0 ? value : '';
              },
            },
          },
          x: {
            title: {text: translateText('Generation'), display: true},
            offset: true,
          },
        },
      },
    });
  }
}

onMounted(() => {
  void renderChart();
});
</script>
