/*
 * VictoryPointChart's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level
 * statement runs once per INSTANCE, so the loader's cache the charts share lives here — one per page, as it was (left
 * in the component, every chart would import chart.js for itself and register it again).
 */

// BND-1 (docs/PERFORMANCE_AUDIT.md): chart.js is used ONLY by this endgame chart, so
// load it lazily (its own async chunk — see the `chartjs` splitChunks cacheGroup)
// instead of parsing it eagerly in vendors.js on the login / menu / board. The
// one-time register + defaults run inside the cached loader.
type ChartCtor = (typeof import('chart.js'))['Chart'];
let chartCtorPromise: Promise<ChartCtor> | undefined;
export function loadChart(): Promise<ChartCtor> {
  if (chartCtorPromise === undefined) {
    chartCtorPromise = import(/* webpackChunkName: "chartjs" */ 'chart.js').then(({Chart, registerables}) => {
      Chart.register(...registerables);
      Chart.defaults.font.size = 20;
      Chart.defaults.font.family = 'Ubuntu, Sans';
      Chart.defaults.color = 'rgb(240, 240, 240)';
      return Chart;
    });
  }
  return chartCtorPromise;
}
