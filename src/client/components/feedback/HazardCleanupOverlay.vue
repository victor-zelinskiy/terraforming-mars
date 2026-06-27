<template>
  <teleport to="body">
    <div v-if="state.active" class="hazard-cleanup-layer" aria-hidden="true">
      <!--
        One premium cleanup FX per cleared cell, pinned over the board hex. The
        LESS renders the whole sequence from the CSS vars set here (warning ring,
        kind-specific dissolve, stabilization wave, materialise glow) + the kind /
        severity / reduced-motion classes — this component only feeds the
        frame-accurate intensities + hosts the reward chip cluster.
      -->
      <div
        v-for="ev in eventViews"
        :key="ev.event.spaceId"
        class="hazard-cleanup-fx"
        :class="[
          `hazard-cleanup-fx--kind-${ev.event.kind}`,
          `hazard-cleanup-fx--${ev.event.severity}`,
          {'hazard-cleanup-fx--reduced': state.reducedMotion},
        ]"
        :style="fxStyle(ev)">
        <div class="hazard-cleanup-fx__backshade"></div>
        <div class="hazard-cleanup-fx__warning"></div>
        <div class="hazard-cleanup-fx__dissolve"></div>
        <div class="hazard-cleanup-fx__wave"></div>
        <div class="hazard-cleanup-fx__materialize"></div>
        <!--
          No cost/TR chips here on purpose: the panel resource delta-chips (M€ /
          TR counters) + the journal already report the cleanup cost + reward.
          This overlay is purely the board transition.
        -->
      </div>
    </div>
  </teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {hazardCleanupState} from '@/client/components/feedback/hazardCleanupTransition';
import {HazardCleanupEvent, HazardCleanupFx, hazardFxAt} from '@/client/components/feedback/hazardCleanupModel';
import {CLAIM_COLOR_HEX} from '@/client/components/board/scaleBonusZones';

type Rect = {top: number, left: number, width: number, height: number};
type EventView = {event: HazardCleanupEvent, rect: Rect};

type Data = {
  rects: Record<string, Rect>;
  scheduled: boolean;
  onReposition: (() => void) | undefined;
};

export default defineComponent({
  name: 'HazardCleanupOverlay',
  data(): Data {
    return {rects: {}, scheduled: false, onReposition: undefined};
  },
  computed: {
    state() {
      return hazardCleanupState;
    },
    // Frame-accurate per-element intensities (reactive on progress).
    fx(): HazardCleanupFx {
      return hazardFxAt(this.state.progress);
    },
    eventViews(): ReadonlyArray<EventView> {
      return this.state.events
        .map((event) => ({event, rect: this.rects[event.spaceId]}))
        .filter((v): v is EventView => v.rect !== undefined);
    },
  },
  watch: {
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
    fxStyle(ev: EventView): Record<string, string> {
      const f = this.fx;
      const player = CLAIM_COLOR_HEX[ev.event.color] ?? 'rgba(120, 200, 255, 0.9)';
      // Pad the FX box a touch beyond the hex so the warning ring / glow can
      // bloom outside the tile without being clipped.
      const pad = 6;
      return {
        'left': `${Math.round(ev.rect.left - pad)}px`,
        'top': `${Math.round(ev.rect.top - pad)}px`,
        'width': `${Math.round(ev.rect.width + pad * 2)}px`,
        'height': `${Math.round(ev.rect.height + pad * 2)}px`,
        '--hc-warning': f.warning.toFixed(3),
        '--hc-dissolve': f.dissolve.toFixed(3),
        '--hc-hazard-opacity': f.hazardOpacity.toFixed(3),
        '--hc-materialize': f.materialize.toFixed(3),
        '--hc-player': player,
      };
    },
    scheduleMeasure(): void {
      if (this.scheduled) {
        return;
      }
      this.scheduled = true;
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
      if (typeof document === 'undefined') {
        return;
      }
      const next: Record<string, Rect> = {};
      for (const ev of this.state.events) {
        const el = document.querySelector(`[data_space_id="${ev.spaceId}"]`);
        if (el === null) {
          continue;
        }
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          continue;
        }
        next[ev.spaceId] = {top: r.top, left: r.left, width: r.width, height: r.height};
      }
      this.rects = next;
    },
    attachListeners(): void {
      if (this.onReposition !== undefined || typeof window === 'undefined') {
        return;
      }
      this.onReposition = () => this.scheduleMeasure();
      window.addEventListener('scroll', this.onReposition, true);
      window.addEventListener('resize', this.onReposition);
    },
    detachListeners(): void {
      if (this.onReposition === undefined || typeof window === 'undefined') {
        return;
      }
      window.removeEventListener('scroll', this.onReposition, true);
      window.removeEventListener('resize', this.onReposition);
      this.onReposition = undefined;
    },
  },
});
</script>
