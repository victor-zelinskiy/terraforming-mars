<template>
  <transition name="energy-conversion-layer-fade">
    <div v-if="state.active && !state.leadIn"
         class="resource-conversion-layer"
         aria-hidden="true">
      <!--
        Premium sci-fi transfer glyph, anchored STRICTLY in the free space
        between the energy ICON and the heat ICON (their bounding rects, not the
        whole row), rotated to the energy→heat vector and scaled to the gap so it
        never overlaps the icons or the counters. Skipped gracefully when the
        icons aren't on screen (e.g. the viewer is inspecting an opponent) — the
        panel counter animation + the gate still run.
      -->
      <div v-if="arrow !== undefined"
           class="energy-to-heat-arrow"
           :class="[arrow.dirClass, {
             'energy-to-heat-arrow--compact': arrow.compact,
             'energy-to-heat-arrow--reduced': state.reducedMotion,
           }]"
           :style="arrow.style">
        <span class="energy-to-heat-arrow__glow"></span>
        <span class="energy-to-heat-arrow__body"></span>
        <span class="energy-to-heat-arrow__triangle"></span>
        <span v-if="!state.reducedMotion" class="energy-to-heat-arrow__inner-pulse"></span>
      </div>

      <!-- Paired delta chips — reuse the existing DeltaChip visual language. -->
      <transition name="energy-conversion-chip">
        <div v-if="chipsAnchored && state.showChips"
             class="energy-to-heat-chip energy-to-heat-chip--source"
             :style="sourceChipStyle">
          <DeltaChip :amount="-state.amount" variant="resource-stock" />
        </div>
      </transition>
      <transition name="energy-conversion-chip">
        <div v-if="chipsAnchored && state.showChips"
             class="energy-to-heat-chip energy-to-heat-chip--target"
             :style="targetChipStyle">
          <DeltaChip :amount="state.amount" variant="resource-stock" />
        </div>
      </transition>
    </div>
  </transition>
</template>

<script setup lang="ts">
/*
 * state.leadIn = the HANDOFF beat: the surface that caused the conversion
 * is still playing its leave, so the visible motion (arrow + chips) waits;
 * the cells' highlight + held counters already run underneath.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import DeltaChip from '@/client/components/feedback/DeltaChip.vue';
import {energyConversionState} from '@/client/components/feedback/energyConversionTransition';

type Rect = {top: number, left: number, right: number, bottom: number, width: number, height: number};
type ArrowGeometry = {
  style: Record<string, string>,
  dirClass: string,
  compact: boolean,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// Distance from a box centre to its edge along the unit vector (ux, uy).
function rayBoxExit(halfW: number, halfH: number, ux: number, uy: number): number {
  const tx = Math.abs(ux) > 1e-4 ? halfW / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-4 ? halfH / Math.abs(uy) : Infinity;
  return Math.min(tx, ty);
}

defineOptions({name: 'EnergyConversionOverlay'});

const flow = useFlowScope('energy-conversion-overlay');
const state = energyConversionState;
const energyIconRect = ref<Rect | undefined>(undefined);
const heatIconRect = ref<Rect | undefined>(undefined);
const energyCellRect = ref<Rect | undefined>(undefined);
const heatCellRect = ref<Rect | undefined>(undefined);
const scheduled = ref(false);
let onReposition: (() => void) | undefined;
// The transfer-glyph geometry, derived from the two ICON rects. Undefined
// when the icons aren't measurable or are effectively touching (no room).
const arrow = computed((): ArrowGeometry | undefined => {
  const e = energyIconRect.value;
  const h = heatIconRect.value;
  if (e === undefined || h === undefined) {
    return undefined;
  }
  const ecx = e.left + e.width / 2;
  const ecy = e.top + e.height / 2;
  const hcx = h.left + h.width / 2;
  const hcy = h.top + h.height / 2;
  const dx = hcx - ecx;
  const dy = hcy - ecy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    return undefined;
  }
  const ux = dx / dist;
  const uy = dy / dist;
  // Edge-to-edge gap between the two icons along the transfer direction.
  const tE = rayBoxExit(e.width / 2, e.height / 2, ux, uy);
  const tH = rayBoxExit(h.width / 2, h.height / 2, ux, uy);
  const rawGap = dist - tE - tH;
  if (rawGap < 3) {
    // Icons all but touching — no honest room for a glyph between them.
    return undefined;
  }
  // Adaptive safe clearance: the spec wants ~4-6px from each icon, but the
  // single-screen panel packs the rows tight (~10px between icon edges), so
  // we take the largest clearance the gap affords and shrink toward 1.5px.
  const safe = clamp((rawGap - 5) / 2, 1.5, 5);
  const along = clamp(rawGap - safe * 2, 4, 16); // glyph depth along the direction
  const startD = tE + (rawGap - along) / 2;
  const midD = startD + along / 2;
  const cx = ecx + ux * midD;
  const cy = ecy + uy * midD;
  const vertical = Math.abs(uy) >= Math.abs(ux);
  // Generous cross-axis girth, but inside the icon's cross extent so the
  // glyph never reaches the counter to the side of the icon.
  const crossExtent = vertical ? Math.min(e.width, h.width) : Math.min(e.height, h.height);
  const scale = clamp(along / 11, 0.5, 1);
  const girth = clamp(crossExtent * 0.82, 16, 30) * (0.72 + 0.28 * scale);
  const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI; // energy→heat
  // Glyph is authored pointing DOWN in its local frame → rotate from down.
  const rot = angleDeg - 90;
  return {
    style: {
      'left': `${Math.round(cx)}px`,
      'top': `${Math.round(cy)}px`,
      'width': `${Math.round(girth)}px`,
      'height': `${Math.round(Math.max(along, 5))}px`,
      'transform': `translate(-50%, -50%) rotate(${rot.toFixed(2)}deg)`,
      '--ec-arrow-scale': scale.toFixed(3),
    },
    dirClass: vertical ? 'energy-to-heat-arrow--vertical' : 'energy-to-heat-arrow--horizontal',
    compact: along < 7,
  };
});
const chipsAnchored = computed((): boolean => {
  return energyCellRect.value !== undefined && heatCellRect.value !== undefined;
});
const sourceChipStyle = computed((): Record<string, string> => {
  return chipStyle(energyCellRect.value);
});
const targetChipStyle = computed((): Record<string, string> => {
  return chipStyle(heatCellRect.value);
});

function chipStyle(rect: Rect | undefined): Record<string, string> {
  if (rect === undefined) {
    return {display: 'none'};
  }
  // Float just above the cell's top-right — the normal stock chip slot,
  // which is free during a conversion (the canonical value isn't changing).
  return {
    left: `${Math.round(rect.right - 6)}px`,
    top: `${Math.round(rect.top - 4)}px`,
  };
}
function scheduleMeasure(): void {
  if (scheduled.value) {
    return;
  }
  scheduled.value = true;
  // Defer to next frame so the panel has laid out (esp. right after a fresh
  // activate / playerkey context).
  const run = () => {
    scheduled.value = false;
    measure();
  };
  if (typeof requestAnimationFrame === 'function') {
    flow.afterFrame('the conversion overlay measures', run);
  } else {
    void nextTick(run);
  }
}
function measure(): void {
  energyIconRect.value = queryRect('[data-conversion-icon="energy"]');
  heatIconRect.value = queryRect('[data-conversion-icon="heat"]');
  energyCellRect.value = queryRect('[data-conversion-cell="energy"]');
  heatCellRect.value = queryRect('[data-conversion-cell="heat"]');
}
function queryRect(selector: string): Rect | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const el = document.querySelector(selector);
  if (el === null) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) {
    return undefined;
  }
  return {top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height};
}
function attachListeners(): void {
  if (onReposition !== undefined || typeof window === 'undefined') {
    return;
  }
  onReposition = () => scheduleMeasure();
  window.addEventListener('resize', onReposition, {passive: true});
  // Capture so a scroll on any ancestor container repositions too.
  window.addEventListener('scroll', onReposition, {passive: true, capture: true});
}
function detachListeners(): void {
  if (onReposition === undefined || typeof window === 'undefined') {
    return;
  }
  window.removeEventListener('resize', onReposition);
  // Legacy boolean `useCapture` — matches the {capture: true} used on add,
  // and avoids referencing the DOM-lib EventListenerOptions type (not in the
  // .vue eslint globals).
  window.removeEventListener('scroll', onReposition, true);
  onReposition = undefined;
}

// Re-measure when a fresh conversion starts (nonce bumps) or becomes active.
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
