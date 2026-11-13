<template>
  <div class="eg-chart" ref="root">
    <div class="eg-chart__legend">
      <span v-for="s in series" :key="s.label" class="eg-chart__legend-item"
            :class="{'eg-chart__legend-item--dim': hoverSeries !== null && hoverSeries !== s.label}"
            @mouseenter="hoverSeries = s.label" @mouseleave="hoverSeries = null">
        <span class="eg-chart__legend-dot" :style="{background: hex(s.color)}"></span>
        <span class="eg-chart__legend-label">{{ s.label }}</span>
        <span class="eg-chart__legend-final">{{ finalValue(s) }}{{ unit }}</span>
      </span>
    </div>

    <div class="eg-chart__canvas" :style="{height: height + 'px'}">
      <svg :width="width" :height="height" :viewBox="'0 0 ' + width + ' ' + height"
           class="eg-chart__svg" @mousemove="onMove" @mouseleave="hoverIndex = null" role="img">
        <defs>
          <linearGradient v-for="(s, i) in plotted" :key="'g' + i" :id="gradId(i)" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="hex(s.color)" stop-opacity="0.22" />
            <stop offset="100%" :stop-color="hex(s.color)" stop-opacity="0.01" />
          </linearGradient>
        </defs>

        <!-- horizontal grid + y ticks -->
        <g class="eg-chart__grid">
          <template v-for="t in yTicks" :key="t.value">
            <line :x1="padL" :x2="width - padR" :y1="t.y" :y2="t.y"
                  class="eg-chart__gridline" :class="{'eg-chart__gridline--axis': t.value === 0}" />
            <text :x="padL - 8" :y="t.y + 4" class="eg-chart__ytick">{{ t.value }}{{ unit }}</text>
          </template>
        </g>

        <!-- x ticks (generations) -->
        <g class="eg-chart__xaxis">
          <text v-for="g in xTicks" :key="'x' + g.gen" :x="g.x" :y="height - padB + 18"
                class="eg-chart__xtick" :class="{'eg-chart__xtick--hot': hoverIndex === g.gen - 1}">{{ g.gen }}</text>
          <text :x="(padL + width - padR) / 2" :y="height - 2" class="eg-chart__axislabel" v-i18n>{{ xLabel }}</text>
        </g>

        <!-- annotations (decisive moments) -->
        <g v-for="(a, i) in plottedAnnotations" :key="'a' + i" class="eg-chart__anno">
          <line :x1="a.x" :x2="a.x" :y1="padT + 14" :y2="height - padB" class="eg-chart__anno-line" :style="{stroke: a.color}" />
          <circle :cx="a.x" :cy="padT + 10" r="2.4" class="eg-chart__anno-dot" :style="{fill: a.color}" />
          <text :x="a.x" :y="padT + 2" class="eg-chart__anno-label" :style="{fill: a.color}">{{ a.label }}</text>
        </g>

        <!-- area + line per series -->
        <g v-for="(s, i) in plotted" :key="s.label"
           class="eg-chart__series" :class="{'eg-chart__series--dim': hoverSeries !== null && hoverSeries !== s.label}">
          <path v-if="s.area" :d="s.area" class="eg-chart__area" :style="{fill: 'url(#' + gradId(i) + ')'}" />
          <path :d="s.line" class="eg-chart__line"
                :style="{stroke: hex(s.color), filter: lineGlow(s), strokeDasharray: animate ? s.length + ' ' + s.length : 'none', strokeDashoffset: (animate && !drawn) ? s.length : 0}" />
          <!-- endpoint marker (final value) + the hovered generation marker -->
          <circle v-if="s.points.length > 0" :cx="s.points[s.points.length - 1].x" :cy="s.points[s.points.length - 1].y"
                  r="3.4" class="eg-chart__endpoint" :style="{fill: hex(s.color)}" />
          <template v-if="hoverIndex !== null && hoverIndex < s.points.length">
            <circle :cx="s.points[hoverIndex].x" :cy="s.points[hoverIndex].y" r="7"
                    class="eg-chart__point-halo" :style="{stroke: hex(s.color)}" />
            <circle :cx="s.points[hoverIndex].x" :cy="s.points[hoverIndex].y" r="3.6"
                    class="eg-chart__point" :style="{fill: hex(s.color)}" />
          </template>
        </g>

        <!-- hover guide -->
        <line v-if="hoverIndex !== null" :x1="xAt(hoverIndex)" :x2="xAt(hoverIndex)" :y1="padT" :y2="height - padB" class="eg-chart__guide" />
      </svg>

      <div v-if="hoverIndex !== null" class="eg-chart__tip" :style="tipStyle">
        <div class="eg-chart__tip-head"><span v-i18n>{{ xLabel }}</span> {{ hoverIndex + 1 }}</div>
        <div v-for="(row, ri) in tipRows" :key="row.label" class="eg-chart__tip-row" :class="{'eg-chart__tip-row--lead': ri === 0 && tipRows.length > 1}">
          <span class="eg-chart__tip-dot" :style="{background: hex(row.color)}"></span>
          <span class="eg-chart__tip-name">{{ row.label }}</span>
          <span v-if="ri > 0 && showDeltas" class="eg-chart__tip-delta">−{{ tipRows[0].value - row.value }}</span>
          <span class="eg-chart__tip-val">{{ row.value }}{{ unit }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * Premium SVG line chart for the endgame timeline (VP-over-generations,
 * global-parameter progress). Custom-drawn (no Chart.js) for full control of
 * the sci-fi look: thin grid, glowing player-coloured lines over a soft
 * gradient wash, hover guide + a glass tooltip with the leader emphasised,
 * and optional ANNOTATIONS (e.g. the generation the winner took the lead —
 * fed by the insight engine). The legend is interactive: hovering an entry
 * spotlights that series and dims the rest. Responsive via a measured width
 * (ResizeObserver); height is fixed by the `height` prop. Motion is a
 * restrained line draw, disabled under prefers-reduced-motion.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, onBeforeUnmount, onMounted, ref, useTemplateRef} from 'vue';
import {vI18n} from '@/client/directives/vDirectives';
import {Color} from '@/common/Color';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {useFlowScope} from '@/client/console/session/useFlowScope';
// The gradient-id namespace of the charts is MODULE state: it lives in the sibling module (inside `<script setup>` a
// top-level `let` would start again in every chart).
import {newEndgameLineChartUid} from '@/client/components/endgame/endgameLineChartState';

// `color` is either a player Color (mapped to a chart hex) or a literal hex
// string (e.g. '#e8743b' for a global-parameter line, which has no player).
export type ChartSeries = {label: string; color: string; data: ReadonlyArray<number>};

// A vertical "this is where it happened" marker: `index` is the 0-based
// generation column, `label` is already-translated display text.
export type ChartAnnotation = {index: number; label: string; color?: string};

type PlottedPoint = {x: number; y: number};
type Plotted = {label: string; color: string; points: Array<PlottedPoint>; line: string; area: string; length: number};

defineOptions({name: 'EndgameLineChart'});
const props = defineProps({
  series: {type: Array as () => ReadonlyArray<ChartSeries>, required: true},
  generations: {type: Number, required: true},
  height: {type: Number, default: 300},
  unit: {type: String, default: ''},
  xLabel: {type: String, default: 'Gen'},
  // Fixed upper bound (e.g. 100 for "% completed"); otherwise auto from data.
  fixedMax: {type: Number, required: false, default: undefined},
  fill: {type: Boolean, default: false},
  annotations: {type: Array as () => ReadonlyArray<ChartAnnotation>, required: false, default: () => []},
  // Show "−N to the leader" deltas in the tooltip (used by the VP chart).
  showDeltas: {type: Boolean, default: false},
});

const flow = useFlowScope('endgame-line-chart');
const root = useTemplateRef<HTMLElement>('root');
const width = ref(640);
const hoverIndex = ref<number | null>(null);
const hoverSeries = ref<string | null>(null);
let ro: ResizeObserver | undefined;
const uid = ref(newEndgameLineChartUid());
const padL = 42;
const padR = 18;
const padT = 26;
const padB = 26;
const animate = ref(!prefersReducedMotion());
const drawn = ref(false);
const pointCount = computed((): number => {
  // Number of generation columns to plot — the longest series, capped to
  // the game's generation count.
  const longest = props.series.reduce((m, s) => Math.max(m, s.data.length), 0);
  return Math.max(1, Math.min(longest, props.generations));
});
const yMax = computed((): number => {
  if (props.fixedMax !== undefined) {
    return props.fixedMax;
  }
  let max = 1;
  for (const s of props.series) {
    for (const v of s.data) {
      if (v > max) {
        max = v;
      }
    }
  }
  // Round up to a tidy step.
  const step = max <= 20 ? 5 : (max <= 60 ? 10 : 20);
  return Math.ceil(max / step) * step;
});
const yTicks = computed((): Array<{value: number; y: number}> => {
  const ticks: Array<{value: number; y: number}> = [];
  const count = 4;
  for (let i = 0; i <= count; i++) {
    const value = Math.round((yMax.value / count) * i);
    ticks.push({value, y: yAt(value)});
  }
  return ticks;
});
const xTicks = computed((): Array<{gen: number; x: number}> => {
  const n = pointCount.value;
  // Show every generation when few, else thin to ~8 labels.
  const stride = n <= 10 ? 1 : Math.ceil(n / 8);
  const ticks: Array<{gen: number; x: number}> = [];
  for (let i = 0; i < n; i += stride) {
    ticks.push({gen: i + 1, x: xAt(i)});
  }
  if ((n - 1) % stride !== 0) {
    ticks.push({gen: n, x: xAt(n - 1)});
  }
  return ticks;
});
const plotted = computed((): Array<Plotted> => {
  const n = pointCount.value;
  return props.series.map((s) => {
    const points: Array<PlottedPoint> = [];
    for (let i = 0; i < n; i++) {
      const v = i < s.data.length ? s.data[i] : (s.data.length > 0 ? s.data[s.data.length - 1] : 0);
      points.push({x: xAt(i), y: yAt(v)});
    }
    const line = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
    let area = '';
    if (props.fill && points.length > 0) {
      const baseY = yAt(0);
      area = 'M' + points[0].x.toFixed(1) + ' ' + baseY.toFixed(1) + ' ' +
        points.map((p) => 'L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ') +
        ' L' + points[points.length - 1].x.toFixed(1) + ' ' + baseY.toFixed(1) + ' Z';
    }
    // Approximate path length for the draw animation.
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return {label: s.label, color: s.color, points, line, area, length: Math.ceil(length) + 4};
  });
});
const plottedAnnotations = computed((): Array<{x: number; label: string; color: string}> => {
  const n = pointCount.value;
  return props.annotations
    .filter((a) => a.index >= 0 && a.index < n)
    .map((a) => ({x: xAt(a.index), label: a.label, color: a.color ?? '#ffcc64'}));
});
const tipRows = computed((): Array<{label: string; color: string; value: number}> => {
  if (hoverIndex.value === null) {
    return [];
  }
  const idx = hoverIndex.value;
  return props.series.map((s) => {
    const v = idx < s.data.length ? s.data[idx] : (s.data.length > 0 ? s.data[s.data.length - 1] : 0);
    return {label: s.label, color: s.color, value: Math.round(v)};
  }).sort((a, b) => b.value - a.value);
});
const tipStyle = computed((): Record<string, string> => {
  if (hoverIndex.value === null) {
    return {};
  }
  const x = xAt(hoverIndex.value);
  const left = x > width.value / 2 ? x - 188 : x + 14;
  return {left: Math.max(4, left) + 'px', top: padT + 'px'};
});
function hex(color: string): string {
  return color.charAt(0) === '#' ? color : endgamePlayerHex(color as Color);
}
function gradId(i: number): string {
  return `egc-grad-${uid.value}-${i}`;
}
function finalValue(s: ChartSeries): number {
  return s.data.length > 0 ? Math.round(s.data[Math.min(s.data.length, pointCount.value) - 1]) : 0;
}
// Soft neon glow under each line; stronger when the series is spotlighted
// from the legend. A static SVG drop-shadow — cheap, never animated.
function lineGlow(s: Plotted): string {
  const hot = hoverSeries.value === s.label;
  return `drop-shadow(0 0 ${hot ? 6 : 3}px ${hex(s.color)}${hot ? '99' : '59'})`;
}
function xAt(i: number): number {
  const n = pointCount.value;
  const span = width.value - padL - padR;
  if (n <= 1) {
    return padL + span / 2;
  }
  return padL + (span * i) / (n - 1);
}
function yAt(v: number): number {
  const span = props.height - padT - padB;
  const clamped = Math.max(0, Math.min(v, yMax.value));
  return padT + span * (1 - clamped / yMax.value);
}
function onMove(e: MouseEvent): void {
  const svg = e.currentTarget as SVGElement;
  const rect = svg.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const n = pointCount.value;
  const span = width.value - padL - padR;
  if (n <= 1) {
    hoverIndex.value = 0;
    return;
  }
  const rel = (x - padL) / span;
  const idx = Math.round(rel * (n - 1));
  hoverIndex.value = Math.max(0, Math.min(n - 1, idx));
}
function measure(): void {
  const el = root.value ?? undefined;
  if (el !== undefined && el.clientWidth > 0) {
    width.value = el.clientWidth;
  }
}

onMounted((): void => {
  measure();
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => measure());
    const el = root.value;
    if (el === null) {
      return;
    }
    ro.observe(el);
  }
  // Release the line-draw (dashoffset → 0) on the next frame so the CSS
  // transition animates the lines in. No-op visually under reduced motion.
  if (animate.value && typeof requestAnimationFrame !== 'undefined') {
    flow.afterFrame('the chart\'s line-draw is released', () => {
      drawn.value = true;
    }, 2);
  } else {
    drawn.value = true;
  }
});
onBeforeUnmount((): void => {
  ro?.disconnect();
});
</script>
