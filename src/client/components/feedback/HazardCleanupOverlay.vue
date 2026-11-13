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

<script setup vapor lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {hazardCleanupState} from '@/client/components/feedback/hazardCleanupTransition';
import {HazardCleanupEvent, HazardCleanupFx, hazardFxAt} from '@/client/components/feedback/hazardCleanupModel';
import {CLAIM_COLOR_HEX} from '@/client/components/board/scaleBonusZones';

type Rect = {top: number, left: number, width: number, height: number};
type EventView = {event: HazardCleanupEvent, rect: Rect};

defineOptions({name: 'HazardCleanupOverlay'});

const flow = useFlowScope('hazard-cleanup-overlay');
const rects = ref<Record<string, Rect>>({});
const scheduled = ref(false);
let onReposition: (() => void) | undefined;
const state = hazardCleanupState;
// Frame-accurate per-element intensities (reactive on progress).
const fx = computed((): HazardCleanupFx => {
  return hazardFxAt(state.progress);
});
const eventViews = computed((): ReadonlyArray<EventView> => {
  return state.events
    .map((event) => ({event, rect: rects.value[event.spaceId]}))
    .filter((v): v is EventView => v.rect !== undefined);
});

function fxStyle(ev: EventView): Record<string, string> {
  const f = fx.value;
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
}
function scheduleMeasure(): void {
  if (scheduled.value) {
    return;
  }
  scheduled.value = true;
  const run = () => {
    scheduled.value = false;
    measure();
  };
  if (typeof requestAnimationFrame === 'function') {
    flow.afterFrame('the cleanup overlay measures', run);
  } else {
    void nextTick(run);
  }
}
function measure(): void {
  if (typeof document === 'undefined') {
    return;
  }
  const next: Record<string, Rect> = {};
  for (const ev of state.events) {
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
  rects.value = next;
}
function attachListeners(): void {
  if (onReposition !== undefined || typeof window === 'undefined') {
    return;
  }
  onReposition = () => scheduleMeasure();
  window.addEventListener('scroll', onReposition, true);
  window.addEventListener('resize', onReposition);
}
function detachListeners(): void {
  if (onReposition === undefined || typeof window === 'undefined') {
    return;
  }
  window.removeEventListener('scroll', onReposition, true);
  window.removeEventListener('resize', onReposition);
  onReposition = undefined;
}

watch(() => state.nonce, (): void => {
  scheduleMeasure();
});
watch(() => state.active, (active: boolean): void => {
  if (active) {
    attachListeners();
    scheduleMeasure();
  } else {
    detachListeners();
  }
});
onMounted(() => {
  if (state.active) {
    attachListeners();
    scheduleMeasure();
  }
});
onBeforeUnmount(() => {
  detachListeners();
});
</script>
