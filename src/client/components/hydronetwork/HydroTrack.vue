<template>
  <!--
    Composed layout — no horizontal/vertical scroll, premium finish-zone:
      row 1:  0 → 1 → 2 → 3 → 4 → 5
                ╮ (rounded serpentine return drawn as a measured SVG conduit)
      row 2:  6 → 7 → 8 → 9   ▸  [ FINISH: 10 · 11 ]
    The two VP finish slots live in a dedicated, status-styled zone at the END of
    the route (bottom-right), not under the start. A measured SVG draws the two
    NON-straight conduits: the rounded elbow that wraps row 1 → row 2 (exits the
    right of stage 5, sweeps left, drops into stage 6) and the entry conduit
    9 → finish-zone. ROUTE LANGUAGE: a conduit reads as SOLID when established
    (already travelled), DASHED + glow when it is the previewed path to the
    selected target, and quiet when idle. A turn-NODE marks each bend so the
    "down then continue" of the serpentine is unmistakable; arrowheads show the
    direction of travel. The straight in-row links use the same solid/dashed CSS.
  -->
  <div ref="root" class="hydro-track hydro-track--composed" role="list">
    <svg v-if="svgW > 0" class="hydro-track__snake" :viewBox="`0 0 ${svgW} ${svgH}`"
         :width="svgW" :height="svgH" preserveAspectRatio="none" aria-hidden="true">
      <path v-if="returnPathD" class="hydro-track__snake-base" :d="returnPathD" />
      <path v-if="enterPathD" class="hydro-track__snake-base" :d="enterPathD" />
      <path v-if="returnPathD && returnState !== 'base'" class="hydro-track__snake-flow"
            :class="'hydro-track__snake-flow--' + returnState" :d="returnPathD" />
      <path v-if="enterPathD && enterState !== 'base'" class="hydro-track__snake-flow"
            :class="'hydro-track__snake-flow--' + enterState" :d="enterPathD" />
      <!-- Bend nodes: emphasize the "turn down" of the serpentine return. -->
      <circle v-for="(n, i) in returnNodes" :key="'rn' + i" class="hydro-track__snake-node"
              :class="'hydro-track__snake-node--' + returnState" :cx="n.x" :cy="n.y" r="3.5" />
      <polygon v-if="returnArrow" class="hydro-track__snake-arrow"
               :class="'hydro-track__snake-arrow--' + returnState" :points="returnArrow" />
      <polygon v-if="enterArrow" class="hydro-track__snake-arrow"
               :class="'hydro-track__snake-arrow--' + enterState" :points="enterArrow" />
    </svg>

    <div class="hydro-track__row hydro-track__row--top">
      <template v-for="(vm, i) in topStages" :key="vm.position">
        <div v-if="i > 0" class="hydro-track__link" :class="linkClass(vm)" aria-hidden="true"></div>
        <HydroStageCell class="hydro-track__cell" :vm="vm" @select="$emit('select', $event)" />
      </template>
    </div>

    <!-- Vertical breathing room for the serpentine elbow; the SVG draws over it. -->
    <div class="hydro-track__return-gap" aria-hidden="true"></div>

    <div class="hydro-track__row hydro-track__row--bottom">
      <template v-for="(vm, i) in midStages" :key="vm.position">
        <div v-if="i > 0" class="hydro-track__link" :class="linkClass(vm)" aria-hidden="true"></div>
        <HydroStageCell class="hydro-track__cell" :vm="vm" @select="$emit('select', $event)" />
      </template>

      <!-- Transparent spacer reserving width for the 9 → finish conduit (drawn by the SVG). -->
      <div class="hydro-track__enter-gap" aria-hidden="true"></div>

      <div class="hydro-track__finish">
        <div class="hydro-track__finish-head" v-i18n>Finish</div>
        <div class="hydro-track__finish-cells">
          <HydroStageCell v-for="vm in finishStages" :key="vm.position"
                          class="hydro-track__cell hydro-track__cell--finish" :vm="vm"
                          @select="$emit('select', $event)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, markRaw} from 'vue';
import {HydroStageVM} from './hydroNetworkModel';
import HydroStageCell from './HydroStageCell.vue';

type Pt = [number, number];

// Orthogonal path with rounded corners through the given points.
function roundedPath(points: ReadonlyArray<Pt>, r: number): string {
  if (points.length < 2) {
    return '';
  }
  const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const rr = Math.min(r, dist(p0, p1) / 2, dist(p1, p2) / 2);
    const u1x = (p1[0] - p0[0]) / (dist(p0, p1) || 1);
    const u1y = (p1[1] - p0[1]) / (dist(p0, p1) || 1);
    const u2x = (p2[0] - p1[0]) / (dist(p1, p2) || 1);
    const u2y = (p2[1] - p1[1]) / (dist(p1, p2) || 1);
    d += ` L ${p1[0] - u1x * rr} ${p1[1] - u1y * rr}`;
    d += ` Q ${p1[0]} ${p1[1]} ${p1[0] + u2x * rr} ${p1[1] + u2y * rr}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

export default defineComponent({
  name: 'HydroTrack',
  components: {HydroStageCell},
  props: {
    stages: {
      type: Array as () => ReadonlyArray<HydroStageVM>,
      required: true,
    },
  },
  emits: ['select'],
  data() {
    return {
      svgW: 0,
      svgH: 0,
      returnPathD: '',
      returnArrow: '',
      returnNodes: [] as Array<{x: number; y: number}>,
      enterPathD: '',
      enterArrow: '',
      _ro: undefined as ResizeObserver | undefined,
      _raf: 0,
    };
  },
  computed: {
    topStages(): ReadonlyArray<HydroStageVM> {
      return this.stages.slice(0, 6); // 0..5
    },
    midStages(): ReadonlyArray<HydroStageVM> {
      return this.stages.slice(6, 10); // 6..9
    },
    finishStages(): ReadonlyArray<HydroStageVM> {
      return this.stages.slice(10, 12); // 10 (2 VP) · 11 (5 VP)
    },
    // Route language: a conduit is ESTABLISHED (solid) once travelled, PREVIEW
    // (dashed + glow) while it is on the planned path to the selected target,
    // else BASE (quiet). Derived purely from the stage states.
    returnState(): 'established' | 'preview' | 'base' {
      const s6 = this.stages[6];
      if (s6 !== undefined && (s6.state === 'completed' || s6.state === 'current')) {
        return 'established';
      }
      const previewIntoRow2 = this.stages.slice(6).some((s) => s.state === 'route' || s.state === 'target');
      return previewIntoRow2 ? 'preview' : 'base';
    },
    enterState(): 'established' | 'preview' | 'base' {
      const established = [10, 11].some((p) => {
        const s = this.stages[p];
        return s !== undefined && (s.state === 'completed' || s.state === 'current');
      });
      if (established) {
        return 'established';
      }
      const preview = [10, 11].some((p) => {
        const s = this.stages[p];
        return s !== undefined && (s.state === 'route' || s.state === 'target');
      });
      return preview ? 'preview' : 'base';
    },
  },
  watch: {
    stages() {
      this.scheduleMeasure();
    },
  },
  mounted() {
    this.scheduleMeasure();
    const root = this.$refs.root as HTMLElement | undefined;
    if (root !== undefined && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.scheduleMeasure());
      ro.observe(root);
      this._ro = markRaw(ro);
    }
    window.addEventListener('resize', this.scheduleMeasure);
  },
  beforeUnmount() {
    this._ro?.disconnect();
    window.removeEventListener('resize', this.scheduleMeasure);
    if (this._raf) {
      cancelAnimationFrame(this._raf);
    }
  },
  methods: {
    linkClass(vm: HydroStageVM | undefined): Record<string, boolean> {
      if (vm === undefined) {
        return {};
      }
      return {
        'hydro-track__link--done': vm.state === 'completed' || vm.state === 'current',
        'hydro-track__link--route': vm.state === 'route' || vm.state === 'target',
      };
    },
    scheduleMeasure() {
      if (this._raf) {
        return;
      }
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        this.$nextTick(() => this.measure());
      });
    },
    measure() {
      const root = this.$refs.root as HTMLElement | undefined;
      if (root === undefined) {
        return;
      }
      const rb = root.getBoundingClientRect();
      if (rb.width === 0) {
        return; // not laid out yet (JSDOM / first paint) — paths stay empty.
      }
      this.svgW = rb.width;
      this.svgH = rb.height;
      const cell = (pos: number): DOMRect | undefined => {
        const el = root.querySelector(`[data-hydro-pos="${pos}"]`);
        return el ? el.getBoundingClientRect() : undefined;
      };
      const finishEl = root.querySelector('.hydro-track__finish');
      const finish = finishEl ? finishEl.getBoundingClientRect() : undefined;
      const c5 = cell(5);
      const c6 = cell(6);
      const c9 = cell(9);

      // Serpentine return 5 → 6: exit right of stage 5, drop to the mid line,
      // sweep left, drop into the top-centre of stage 6.
      if (c5 !== undefined && c6 !== undefined) {
        const x5r = c5.right - rb.left;
        const y5c = (c5.top + c5.bottom) / 2 - rb.top;
        const x6c = (c6.left + c6.right) / 2 - rb.left;
        const y6t = c6.top - rb.top;
        const yMid = (c5.bottom + c6.top) / 2 - rb.top;
        const xR = x5r + 20;
        const pts: Array<Pt> = [[x5r, y5c], [xR, y5c], [xR, yMid], [x6c, yMid], [x6c, y6t]];
        this.returnPathD = roundedPath(pts, 13);
        // Arrow points DOWN into stage 6.
        this.returnArrow = `${x6c - 4.5},${y6t - 7} ${x6c + 4.5},${y6t - 7} ${x6c},${y6t}`;
        // Turn-nodes on the two mid-line bends so the "turn down then continue"
        // of the serpentine return reads instantly.
        this.returnNodes = [{x: xR, y: yMid}, {x: x6c, y: yMid}];
      } else {
        this.returnPathD = '';
        this.returnArrow = '';
        this.returnNodes = [];
      }

      // Entry conduit 9 → finish-zone (same row): straight, with a right arrow.
      if (c9 !== undefined && finish !== undefined) {
        const x9r = c9.right - rb.left;
        const yc = (c9.top + c9.bottom) / 2 - rb.top;
        const xf = finish.left - rb.left - 2;
        const pts: Array<Pt> = [[x9r, yc], [xf, yc]];
        this.enterPathD = roundedPath(pts, 4);
        this.enterArrow = `${xf - 7},${yc - 4.5} ${xf - 7},${yc + 4.5} ${xf},${yc}`;
      } else {
        this.enterPathD = '';
        this.enterArrow = '';
      }
    },
  },
});
</script>
