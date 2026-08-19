<template>
  <!--
    CONSOLE LINE CHART — the one chart engine of the endgame overview.

    Built for a 4K TV read from a couch and a D-PAD, not a pointer:
     · 0.14rem lines, ≥0.4rem markers, 3 clean y-ticks, thinned x-ticks —
       nothing desktop-tick sized anywhere;
     · identity is never colour alone (the game's player palette is fixed and
       CVD-tight in places): every series also lives in the host's legend, and
       the CURSOR readout names series by text — this SVG carries geometry;
     · the cursor is a PROP (the host moves it with the d-pad) — a vertical
       guide + a ringed marker per series; no hover, no tooltip, no pointer;
     · reveal (line draw) plays ONCE per page load (host-gated `reveal`), a
       calm 600 ms dash release; reduced motion lands settled;
     · perf: no rAF loops, no filters; a ResizeObserver re-measures only
       while mounted; a hidden tab unmounts the whole chart.
  -->
  <div ref="root" class="con-ovchart" :class="{'con-ovchart--drawn': drawn}">
    <svg v-if="width > 0" :width="width" :height="height" :viewBox="'0 0 ' + width + ' ' + height"
         class="con-ovchart__svg" role="img" aria-hidden="true">
      <!-- grid: solid hairlines, one shade off the surface -->
      <g>
        <template v-for="t in yTicks" :key="'y' + t.value">
          <line class="con-ovchart__grid" :class="{'con-ovchart__grid--axis': t.value === 0}"
                :x1="padL" :x2="width - padR" :y1="t.y" :y2="t.y" />
          <text class="con-ovchart__ytick" :x="padL - gapPx" :y="t.y + tickNudge">{{ t.value }}{{ unit }}</text>
        </template>
      </g>
      <g>
        <text v-for="t in xTicks" :key="'x' + t.idx"
              class="con-ovchart__xtick" :class="{'con-ovchart__xtick--hot': cursor === t.idx}"
              :x="t.x" :y="height - xBaseline">{{ t.idx + 1 }}</text>
      </g>

      <!-- series: dim context first, emphasised on top -->
      <g v-for="s in plotted" :key="s.key"
         class="con-ovchart__series" :class="{'con-ovchart__series--dim': s.dim, 'con-ovchart__series--emph': s.emphasis}">
        <path v-if="s.area !== ''" class="con-ovchart__area" :d="s.area" :style="{fill: s.hex}" />
        <path class="con-ovchart__line" :d="s.line" :style="lineStyle(s)" />
        <circle v-if="s.points.length > 0 && !s.dim" class="con-ovchart__end"
                :cx="s.points[s.points.length - 1].x" :cy="s.points[s.points.length - 1].y"
                :r="markerR" :style="{fill: s.hex}" />
      </g>

      <!-- the d-pad cursor: guide + ringed markers -->
      <g v-if="cursorX !== undefined">
        <line class="con-ovchart__guide" :x1="cursorX" :x2="cursorX" :y1="padT" :y2="height - padB" />
        <template v-for="s in plotted" :key="'c' + s.key">
          <circle v-if="cursor !== undefined && cursor < s.points.length && !s.dim"
                  class="con-ovchart__dot"
                  :cx="s.points[cursor].x" :cy="s.points[cursor].y" :r="markerR + ringPx"
                  :style="{fill: s.hex}" />
        </template>
      </g>
    </svg>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {useConsoleReducedMotion} from '@/client/console/composables/useConsoleReducedMotion';
// The series shape lives in the pure model module — a type export from a
// .vue breaks the mochapack test bundle of every spec that imports it.
import type {OvChartSeries} from '@/client/console/endgame/consoleOverviewModel';

type Plotted = {
  key: string;
  hex: string;
  dim: boolean;
  emphasis: boolean;
  points: Array<{x: number; y: number}>;
  line: string;
  area: string;
  length: number;
};

export default defineComponent({
  name: 'ConsoleOvChart',
  props: {
    series: {type: Array as PropType<ReadonlyArray<OvChartSeries>>, required: true},
    /** Number of generation columns (x positions 0..points-1). */
    points: {type: Number, required: true},
    maxY: {type: Number, required: true},
    unit: {type: String, default: ''},
    /** 0-based cursor column (host-driven d-pad); undefined = no cursor. */
    cursor: {type: Number as PropType<number | undefined>, default: undefined},
    /** Area wash under the emphasised series. */
    fill: {type: Boolean, default: false},
    /** Play the one-shot line draw on mount (host gates «once per load»). */
    reveal: {type: Boolean, default: false},
  },
  setup() {
    const {reduced} = useConsoleReducedMotion();
    return {reduced};
  },
  data() {
    return {
      width: 0,
      height: 0,
      /** 1rem in px, read from the cascade — all geometry rides it. */
      remPx: 20,
      /** `reveal` LATCHED at mount — the host's once-per-load memory flips
       *  the prop right after, and a mid-draw flip would snap the line. */
      revealArmed: this.reveal,
      drawn: false,
      ro: undefined as ResizeObserver | undefined,
    };
  },
  computed: {
    padL(): number {
      return this.remPx * 2.4;
    },
    padR(): number {
      return this.remPx * 0.9;
    },
    padT(): number {
      return this.remPx * 0.5;
    },
    padB(): number {
      return this.remPx * 1.35;
    },
    gapPx(): number {
      return this.remPx * 0.4;
    },
    tickNudge(): number {
      return this.remPx * 0.22;
    },
    xBaseline(): number {
      return this.remPx * 0.25;
    },
    markerR(): number {
      return this.remPx * 0.2;
    },
    ringPx(): number {
      return this.remPx * 0.06;
    },
    yMax(): number {
      // Clean headroom: round up to a tidy step so ticks are honest integers.
      const raw = Math.max(1, this.maxY);
      const step = raw <= 12 ? 3 : raw <= 30 ? 5 : raw <= 60 ? 10 : 20;
      return Math.ceil(raw / step) * step;
    },
    yTicks(): Array<{value: number; y: number}> {
      // THREE ticks (0 · mid · max) — a couch chart wants a calm grid, and
      // halves stay clean numbers far more often than thirds.
      const out: Array<{value: number; y: number}> = [];
      for (let i = 0; i <= 2; i++) {
        const value = Math.round((this.yMax / 2) * i);
        out.push({value, y: this.yAt(value)});
      }
      return out;
    },
    xTicks(): Array<{idx: number; x: number}> {
      const n = this.points;
      if (n <= 0) {
        return [];
      }
      const stride = n <= 12 ? 1 : Math.ceil(n / 10);
      const out: Array<{idx: number; x: number}> = [];
      for (let i = 0; i < n; i += stride) {
        out.push({idx: i, x: this.xAt(i)});
      }
      if (out.length === 0 || out[out.length - 1].idx !== n - 1) {
        out.push({idx: n - 1, x: this.xAt(n - 1)});
      }
      return out;
    },
    plotted(): Array<Plotted> {
      const n = this.points;
      const list = this.series.map((s) => {
        const pts: Array<{x: number; y: number}> = [];
        for (let i = 0; i < Math.min(n, s.data.length); i++) {
          pts.push({x: this.xAt(i), y: this.yAt(s.data[i])});
        }
        const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
        let area = '';
        if (this.fill && s.emphasis === true && pts.length > 1) {
          const baseY = this.yAt(0);
          area = 'M' + pts[0].x.toFixed(1) + ' ' + baseY.toFixed(1) + ' ' +
            pts.map((p) => 'L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ') +
            ' L' + pts[pts.length - 1].x.toFixed(1) + ' ' + baseY.toFixed(1) + ' Z';
        }
        let length = 0;
        for (let i = 1; i < pts.length; i++) {
          length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        return {
          key: s.key,
          hex: s.hex,
          dim: s.dim === true,
          emphasis: s.emphasis === true,
          points: pts,
          line,
          area,
          length: Math.ceil(length) + 4,
        };
      });
      // Paint order: dim context under, emphasised on top.
      return [...list.filter((s) => s.dim), ...list.filter((s) => !s.dim)];
    },
    cursorX(): number | undefined {
      if (this.cursor === undefined || this.points <= 0 || this.cursor < 0 || this.cursor >= this.points) {
        return undefined;
      }
      return this.xAt(this.cursor);
    },
  },
  methods: {
    xAt(i: number): number {
      const n = this.points;
      const span = this.width - this.padL - this.padR;
      if (n <= 1) {
        return this.padL + span / 2;
      }
      return this.padL + (span * i) / (n - 1);
    },
    yAt(v: number): number {
      const span = this.height - this.padT - this.padB;
      const clamped = Math.max(0, Math.min(v, this.yMax));
      return this.padT + span * (1 - clamped / this.yMax);
    },
    lineStyle(s: Plotted): Record<string, string> {
      const style: Record<string, string> = {stroke: s.hex};
      if (this.revealArmed && !this.reduced) {
        style.strokeDasharray = `${s.length} ${s.length}`;
        style.strokeDashoffset = this.drawn ? '0' : String(s.length);
      }
      return style;
    },
    measure(): void {
      const el = this.$refs.root as HTMLElement | undefined;
      if (el === undefined) {
        return;
      }
      if (el.clientWidth > 0) {
        this.width = el.clientWidth;
      }
      if (el.clientHeight > 0) {
        this.height = el.clientHeight;
      }
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (Number.isFinite(fs) && fs > 0) {
        this.remPx = fs;
      }
    },
  },
  mounted(): void {
    this.measure();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.measure());
      this.ro.observe(this.$refs.root as HTMLElement);
    }
    if (this.revealArmed && !this.reduced && typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.drawn = true;
      }));
    } else {
      this.drawn = true;
    }
  },
  beforeUnmount(): void {
    this.ro?.disconnect();
  },
});
</script>
