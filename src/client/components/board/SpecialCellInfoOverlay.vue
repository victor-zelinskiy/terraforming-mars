<template>
  <teleport to="body">
    <div v-if="active && markerRect" class="special-cell-info-overlay" :class="`special-cell-info-overlay--${placement}`">
      <!-- Connector polyline drawn in viewport coords. Single SVG covers
           the whole viewport so we can draw freely from marker to panel
           without coordinate translation. -->
      <svg class="special-cell-info-overlay__connector" :width="vw" :height="vh">
        <polyline
          class="special-cell-info-overlay__connector-line"
          :points="connectorPoints"
          fill="none"
        />
        <circle
          class="special-cell-info-overlay__connector-dot"
          :cx="markerCenter.x"
          :cy="markerCenter.y"
          r="2.6"
        />
        <!-- Port terminator at the panel side — small open chevron that
             reads as the line "docking" into the panel edge. -->
        <polyline
          class="special-cell-info-overlay__connector-end"
          :points="endPortPoints"
        />
      </svg>

      <div
        ref="panel"
        class="special-cell-info-overlay__panel"
        :style="{ left: panelPos.left + 'px', top: panelPos.top + 'px', width: PANEL_WIDTH + 'px' }"
      >
        <span class="special-cell-info-overlay__corner special-cell-info-overlay__corner--tl" />
        <span class="special-cell-info-overlay__corner special-cell-info-overlay__corner--tr" />
        <span class="special-cell-info-overlay__corner special-cell-info-overlay__corner--bl" />
        <span class="special-cell-info-overlay__corner special-cell-info-overlay__corner--br" />
        <div class="special-cell-info-overlay__header">
          <span class="special-cell-info-overlay__title-mark" />
          <span class="special-cell-info-overlay__title">{{ translatedTitle }}</span>
        </div>
        <div class="special-cell-info-overlay__body">{{ translatedDescription }}</div>
      </div>
    </div>
  </teleport>
</template>

<script setup vapor lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue';
import {specialCellHoverState} from '@/client/components/board/specialCellHoverState';
import {getSpecialCellInfoById, SpecialCellInfo, PanelPlacement} from '@/client/components/board/specialCellInfo';
import {translateText} from '@/client/directives/i18n';
import {useFlowScope} from '@/client/console/session/useFlowScope';

const PANEL_WIDTH = 320;
/** Initial estimate; refined to the panel's real height after mount. */
const PANEL_HEIGHT_ESTIMATE = 140;
/** Gap between the marker's edge and the panel's near edge. */
const PANEL_OFFSET = 32;
const VIEWPORT_MARGIN = 16;

type Vec2 = {x: number; y: number};
type Box = {left: number; top: number; width: number; height: number};

defineOptions({name: 'SpecialCellInfoOverlay'});

const flow = useFlowScope('special-cell-info-overlay');
const panel = useTemplateRef<HTMLElement>('panel');
const vw = ref(typeof window !== 'undefined' ? window.innerWidth : 1920);
const vh = ref(typeof window !== 'undefined' ? window.innerHeight : 1080);
const markerRect = ref<DOMRect | undefined>(undefined);
const panelHeight = ref(PANEL_HEIGHT_ESTIMATE);
/** The coalesced refresh frame's cancel — `undefined` while none is pending (an owned frame of this overlay). */
let cancelRefresh: (() => void) | undefined;
const active = computed((): SpecialCellInfo | undefined => {
  const id = specialCellHoverState.activeId;
  if (id === undefined) {
    return undefined;
  }
  return getSpecialCellInfoById(id);
});
const translatedTitle = computed((): string => {
  return active.value ? translateText(active.value.title) : '';
});
const translatedDescription = computed((): string => {
  return active.value ? translateText(active.value.description) : '';
});
const markerCenter = computed((): Vec2 => {
  const r = markerRect.value;
  if (r === undefined) {
    return {x: 0, y: 0};
  }
  return {x: r.left + r.width / 2, y: r.top + r.height / 2};
});
const placement = computed((): PanelPlacement => {
  const a = active.value;
  const r = markerRect.value;
  if (a === undefined || r === undefined) {
    return 'right';
  }
  return resolvePlacement(a.placement, r, panelHeight.value);
});
const panelPos = computed((): Box => {
  const r = markerRect.value;
  const h = panelHeight.value;
  const w = PANEL_WIDTH;
  if (r === undefined) {
    return {left: 0, top: 0, width: w, height: h};
  }
  let left = 0;
  let top = 0;
  switch (placement.value) {
  case 'right':
    left = r.right + PANEL_OFFSET;
    top = r.top + r.height / 2 - h / 2;
    break;
  case 'left':
    left = r.left - PANEL_OFFSET - w;
    top = r.top + r.height / 2 - h / 2;
    break;
  case 'top':
    left = r.left + r.width / 2 - w / 2;
    top = r.top - PANEL_OFFSET - h;
    break;
  case 'bottom':
    left = r.left + r.width / 2 - w / 2;
    top = r.bottom + PANEL_OFFSET;
    break;
  }
  // Keep the panel fully on-screen with a small viewport margin.
  left = Math.max(VIEWPORT_MARGIN, Math.min(vw.value - w - VIEWPORT_MARGIN, left));
  top = Math.max(VIEWPORT_MARGIN, Math.min(vh.value - h - VIEWPORT_MARGIN, top));
  return {left, top, width: w, height: h};
});
/**
 * Polyline points string for the leader connector. We give the line a
 * small elbow toward the placement side so it reads as deliberate
 * (vs. running diagonally across half the screen).
 */
const connectorPoints = computed((): string => {
  const e = connectorEnd.value;
  return `${e.start.x},${e.start.y} ${e.knee.x},${e.knee.y} ${e.end.x},${e.end.y}`;
});
/**
 * Three salient points of the leader: marker side (start), the elbow
 * (knee), and the panel side (end). Extracted as a single computed
 * so the port-terminator and the polyline can stay in sync.
 */
const connectorEnd = computed((): { start: Vec2; knee: Vec2; end: Vec2 } => {
  const m = markerCenter.value;
  const p = panelPos.value;
  let endX = p.left;
  let endY = p.top + p.height / 2;
  let kneeX = m.x;
  let kneeY = m.y;
  switch (placement.value) {
  case 'right':
    endX = p.left;
    endY = p.top + p.height / 2;
    kneeX = (m.x + endX) / 2;
    kneeY = m.y;
    break;
  case 'left':
    endX = p.left + p.width;
    endY = p.top + p.height / 2;
    kneeX = (m.x + endX) / 2;
    kneeY = m.y;
    break;
  case 'top':
    endX = p.left + p.width / 2;
    endY = p.top + p.height;
    kneeX = m.x;
    kneeY = (m.y + endY) / 2;
    break;
  case 'bottom':
    endX = p.left + p.width / 2;
    endY = p.top;
    kneeX = m.x;
    kneeY = (m.y + endY) / 2;
    break;
  }
  return {start: m, knee: {x: kneeX, y: kneeY}, end: {x: endX, y: endY}};
});
/**
 * Small open-chevron at the panel side of the connector — reads as
 * the line "docking" into a HUD port. Orientation tracks placement.
 */
const endPortPoints = computed((): string => {
  const e = connectorEnd.value.end;
  const L = 5; // chevron arm length
  switch (placement.value) {
  case 'right':  return `${e.x - L},${e.y - L} ${e.x},${e.y} ${e.x - L},${e.y + L}`;
  case 'left':   return `${e.x + L},${e.y - L} ${e.x},${e.y} ${e.x + L},${e.y + L}`;
  case 'top':    return `${e.x - L},${e.y - L} ${e.x},${e.y} ${e.x + L},${e.y - L}`;
  case 'bottom': return `${e.x - L},${e.y + L} ${e.x},${e.y} ${e.x + L},${e.y + L}`;
  }
});

function onViewportResize(): void {
  vw.value = window.innerWidth;
  vh.value = window.innerHeight;
  scheduleRefresh();
}
function scheduleRefresh(): void {
  if (cancelRefresh !== undefined) {
    return;
  }
  cancelRefresh = flow.afterFrame('the special-cell overlay re-measures', () => {
    cancelRefresh = undefined;
    refreshFromState();
  });
}
function refreshFromState(): void {
  const el = specialCellHoverState.markerEl;
  markerRect.value = el ? el.getBoundingClientRect() : undefined;
  // Re-measure the panel after Vue paints the updated content.
  // The template ref is `null` whenever `v-if` has just removed the
  // panel, e.g. the popup was just closed by hover-leave.
  void nextTick(() => {
    const p = panel.value;
    if (p) {
      panelHeight.value = p.offsetHeight;
    }
  });
}
function resolvePlacement(pref: PanelPlacement, r: DOMRect, h: number): PanelPlacement {
  const w = PANEL_WIDTH;
  const fits = (p: PanelPlacement): boolean => {
    switch (p) {
    case 'right':
      return r.right + PANEL_OFFSET + w + VIEWPORT_MARGIN <= vw.value;
    case 'left':
      return r.left - PANEL_OFFSET - w - VIEWPORT_MARGIN >= 0;
    case 'top':
      return r.top - PANEL_OFFSET - h - VIEWPORT_MARGIN >= 0;
    case 'bottom':
      return r.bottom + PANEL_OFFSET + h + VIEWPORT_MARGIN <= vh.value;
    }
  };
  const opposite: Record<PanelPlacement, PanelPlacement> = {
    right: 'left', left: 'right', top: 'bottom', bottom: 'top',
  };
  if (fits(pref)) {
    return pref;
  }
  if (fits(opposite[pref])) {
    return opposite[pref];
  }
  for (const p of ['right', 'left', 'bottom', 'top'] as const) {
    if (fits(p)) {
      return p;
    }
  }
  return pref;
}

watch(() => active.value, () => {
  refreshFromState();
});
onMounted(() => {
  window.addEventListener('scroll', scheduleRefresh, true);
  window.addEventListener('resize', onViewportResize);
});
onBeforeUnmount(() => {
  window.removeEventListener('scroll', scheduleRefresh, true);
  window.removeEventListener('resize', onViewportResize);
});
</script>
