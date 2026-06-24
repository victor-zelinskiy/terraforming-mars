<template>
  <transition name="energy-conversion-layer-fade">
    <div v-if="state.active"
         class="resource-conversion-layer"
         aria-hidden="true">
      <!--
        Premium directional arrow between the energy icon (source) and the heat
        icon (target). Positioned from the live cell rects so it tracks any
        board scale / fullscreen / narrow layout. Skipped gracefully when the
        cells aren't on screen (e.g. the viewer is inspecting an opponent) — the
        panel counter animation + the gate still run.
      -->
      <div v-if="anchored"
           class="energy-to-heat-arrow"
           :class="{'energy-to-heat-arrow--reduced': state.reducedMotion}"
           :style="arrowStyle">
        <span class="energy-to-heat-arrow__line"></span>
        <span class="energy-to-heat-arrow__chevron"></span>
        <span v-if="!state.reducedMotion" class="energy-to-heat-arrow__pulse"></span>
      </div>

      <!-- Paired delta chips — reuse the existing DeltaChip visual language. -->
      <transition name="energy-conversion-chip">
        <div v-if="anchored && state.showChips"
             class="energy-to-heat-chip energy-to-heat-chip--source"
             :style="sourceChipStyle">
          <DeltaChip :amount="-state.amount" variant="resource-stock" />
        </div>
      </transition>
      <transition name="energy-conversion-chip">
        <div v-if="anchored && state.showChips"
             class="energy-to-heat-chip energy-to-heat-chip--target"
             :style="targetChipStyle">
          <DeltaChip :amount="state.amount" variant="resource-stock" />
        </div>
      </transition>
    </div>
  </transition>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import DeltaChip from '@/client/components/feedback/DeltaChip.vue';
import {energyConversionState} from '@/client/components/feedback/energyConversionTransition';

type Rect = {top: number, left: number, right: number, bottom: number, width: number, height: number};

export default defineComponent({
  name: 'EnergyConversionOverlay',
  components: {DeltaChip},
  data() {
    return {
      state: energyConversionState,
      energyRect: undefined as Rect | undefined,
      heatRect: undefined as Rect | undefined,
      scheduled: false,
      onReposition: undefined as (() => void) | undefined,
    };
  },
  computed: {
    // Only draw the anchored visuals when BOTH cells were found and they're
    // stacked sensibly (energy above heat). Otherwise the panel counter
    // animation carries the story on its own.
    anchored(): boolean {
      if (this.energyRect === undefined || this.heatRect === undefined) {
        return false;
      }
      return this.heatRect.top + this.heatRect.height / 2 > this.energyRect.top + this.energyRect.height / 2;
    },
    arrowStyle(): Record<string, string> {
      const e = this.energyRect;
      const h = this.heatRect;
      if (e === undefined || h === undefined) {
        return {display: 'none'};
      }
      // Anchor over the icon column so the arrow visibly links the energy icon
      // to the heat icon. Run from energy icon centre to heat icon centre.
      const x = e.left + Math.min(18, e.width / 2);
      const y1 = e.top + e.height / 2;
      const y2 = h.top + h.height / 2;
      return {
        left: `${Math.round(x)}px`,
        top: `${Math.round(y1)}px`,
        height: `${Math.max(8, Math.round(y2 - y1))}px`,
      };
    },
    sourceChipStyle(): Record<string, string> {
      return this.chipStyle(this.energyRect);
    },
    targetChipStyle(): Record<string, string> {
      return this.chipStyle(this.heatRect);
    },
  },
  watch: {
    // Re-measure when a fresh conversion starts (nonce bumps) or becomes active.
    'state.nonce'() {
      this.scheduleMeasure();
    },
    'state.active'(active: boolean) {
      if (active) {
        this.attachListeners();
        this.scheduleMeasure();
      } else {
        this.detachListeners();
      }
    },
  },
  mounted() {
    if (this.state.active) {
      this.attachListeners();
      this.scheduleMeasure();
    }
  },
  beforeUnmount() {
    this.detachListeners();
  },
  methods: {
    chipStyle(rect: Rect | undefined): Record<string, string> {
      if (rect === undefined) {
        return {display: 'none'};
      }
      // Float just above the cell's top-right — the normal stock chip slot,
      // which is free during a conversion (the canonical value isn't changing).
      return {
        left: `${Math.round(rect.right - 6)}px`,
        top: `${Math.round(rect.top - 4)}px`,
      };
    },
    scheduleMeasure(): void {
      if (this.scheduled) {
        return;
      }
      this.scheduled = true;
      // Defer to next frame so the panel has laid out (esp. right after a fresh
      // activate / playerkey context).
      const run = () => {
        this.scheduled = false;
        this.measure();
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(run);
      } else {
        this.$nextTick(run);
      }
    },
    measure(): void {
      const energy = this.queryCell('energy');
      const heat = this.queryCell('heat');
      this.energyRect = energy;
      this.heatRect = heat;
    },
    queryCell(which: 'energy' | 'heat'): Rect | undefined {
      if (typeof document === 'undefined') {
        return undefined;
      }
      const el = document.querySelector(`[data-conversion-cell="${which}"]`);
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        return undefined;
      }
      return {top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height};
    },
    attachListeners(): void {
      if (this.onReposition !== undefined || typeof window === 'undefined') {
        return;
      }
      this.onReposition = () => this.scheduleMeasure();
      window.addEventListener('resize', this.onReposition, {passive: true});
      // Capture so a scroll on any ancestor container repositions too.
      window.addEventListener('scroll', this.onReposition, {passive: true, capture: true});
    },
    detachListeners(): void {
      if (this.onReposition === undefined || typeof window === 'undefined') {
        return;
      }
      window.removeEventListener('resize', this.onReposition);
      // Legacy boolean `useCapture` — matches the {capture: true} used on add,
      // and avoids referencing the DOM-lib EventListenerOptions type (not in the
      // .vue eslint globals).
      window.removeEventListener('scroll', this.onReposition, true);
      this.onReposition = undefined;
    },
  },
});
</script>
