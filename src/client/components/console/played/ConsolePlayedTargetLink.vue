<template>
  <div class="con-ptlink" ref="frame" aria-hidden="true">
    <div v-if="wire !== undefined"
         class="con-ptlink__wire"
         :class="{
           'con-ptlink__wire--focused': link.focused,
           'con-ptlink__wire--locked': link.locked,
         }"
         :style="wireStyle">
      <!-- The BRACKET sits on the source card's right edge — a terminal anchor,
           never an arrowhead: a chevron pointing back at the card is the one
           shape that would read as «назад» on a screen whose B already means
           that. Direction is carried by the light that runs down the wire. -->
      <span class="con-ptlink__anchor"></span>
      <!-- ONE SHOT, on the rising edge of focus (the `pulse` nonce remounts it,
           which is what restarts the animation). Never a loop: a permanent
           pulse turns a physical connection into decoration.
           Reduced motion is answered in CSS ONLY (`display: none` under the
           media query). A JS mirror of the same policy was a SNAPSHOT of a live
           query — flip the OS setting mid-prompt and the two disagreed.
           The key is CONSUMED on `animationend`, so a wire that merely
           re-resolves (a band resize, the stacked-fallback test flipping back)
           cannot replay a light the player has already been shown. -->
      <span v-if="pulseKey > 0" :key="pulseKey" class="con-ptlink__pulse"
            @animationend="pulseKey = 0"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * THE FRAME never moves: it is the coordinate space the wire is solved in,
 *       so it exists for as long as this component does (the HOST decides that —
 *       it mounts this only while a self-target is on offer). Out of flow
 *       (`position: absolute`) and `pointer-events: none`, so a grid/flex host
 *       neither gains an item nor loses a hit target.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

/**
 * THE SELF-TARGET CONNECTOR — the physical wire between the «ИСТОЧНИК · ЭТА
 * КАРТА» proxy in the target selector and the REAL source card standing in the
 * workspace's hero column.
 *
 * WHY IT EXISTS. The proxy is a navigation stop, not a card: the physical
 * target is the card on the left, and the player has to be able to SEE that
 * without being told. An arrow glyph inside the chip said it in the wrong
 * grammar (it read as «назад», the one thing B already means on this screen);
 * a line drawn between the two real boxes says it in the surface's own.
 *
 * WHY A COMPONENT AND NOT A PSEUDO-ELEMENT. The two anchors live in different
 * columns and in different components — the proxy belongs to the embedded step,
 * the card to the composer around it. Only their COMMON ancestor (the band) can
 * hold something that spans both, so the hosts mount this there and it finds
 * both ends by marker attribute. It therefore names neither host, neither card
 * and no coordinate: two `data-` markers are its whole contract.
 *
 *   [data-ptsel-source] — the hero card's box (the composer publishes it)
 *   [data-ptsel-self]   — the proxy's box (the step publishes it)
 *
 * GEOMETRY IS MEASURED, NEVER ASSUMED. Every number comes from a live
 * `getBoundingClientRect`, divided back into the frame's own layout space by
 * the shared `effectiveZoom` ratio — this whole subtree sits under CSS `zoom:`
 * ladders (`--con-ui-scale`, the composer's own hero zoom), so client px and
 * local px differ by a factor that is only knowable by measuring.
 *
 * IT DEGRADES BY DISAPPEARING. A wire is only honest while the proxy is
 * genuinely to the RIGHT of the card and vertically inside it. When the row
 * falls back to a stacked layout (a band too narrow to hold it), those tests
 * fail and the connector renders nothing — no rotated line, no elbow, no
 * special case. The fallback is a property of the geometry, exactly like the
 * layout decision it follows.
 */
import {computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue';
import {useResizeObserver} from '@vueuse/core';
import {playedTargetSelfState} from '@/client/console/played/consolePlayedTargetSelf';
import {effectiveZoom} from '@/client/console/cssUnits';
import {useFlowScope} from '@/client/console/session/useFlowScope';

/** The solved wire, in the frame's own layout px. */
type Wire = {left: number, top: number, width: number};

/** Below this the gap between the columns is not a wire, it is a seam. */
const MIN_SPAN_PX = 8;

defineOptions({name: 'ConsolePlayedTargetLink'});

const flow = useFlowScope('played-target-link');
const frame = useTemplateRef<HTMLElement>('frame');
const link = playedTargetSelfState;
const wire = ref<Wire | undefined>(undefined);
/**
 * The arrival light's own key. SEEDED from the live nonce, because the
 * host mounts this in the SAME patch that publishes the first focus —
 * the watcher never fires for that one, and the first arrival of every
 * step would go unannounced. Safe to seed only because the nonce is reset
 * with the step (`resetPlayedTargetSelf`), so it can never carry an
 * arrival from a workspace the player has already left.
 */
const pulseKey = ref(playedTargetSelfState.pulse);
let stopResizeObs: (() => void) | undefined;
/** A measure is scheduled for the next frame (its cancel) — `undefined` when none stands. */
let cancelMeasure: (() => void) | undefined;

const wireStyle = computed((): Record<string, string> => {
  const w = wire.value;
  if (w === undefined) {
    return {};
  }
  return {
    left: `${w.left.toFixed(2)}px`,
    top: `${w.top.toFixed(2)}px`,
    width: `${w.width.toFixed(2)}px`,
  };
});

/**
 * Measure AFTER the frame the invalidation belongs to has actually been
 * laid out. `nextTick` gets Vue's patch in; the rAF gets the browser's
 * layout of it — the step publishes a re-solved card size as a custom
 * property, and the row it re-flows is one style recalculation later.
 */
function scheduleMeasure(): void {
  if (cancelMeasure !== undefined) {
    return;
  }
  // A HEADLESS MOUNT has no rAF (the composer unit specs mount the whole
  // host in jsdom). There is no layout to wait for there either — every box
  // is zero — so the fallback is the tick, never a polyfill that would
  // pretend a frame happened.
  if (typeof requestAnimationFrame !== 'function') {
    void nextTick(() => measure());
    return;
  }
  cancelMeasure = flow.afterFrame('the wire is re-measured', () => {
    cancelMeasure = undefined;
    void nextTick(() => measure());
  });
}
function measure(): void {
  const frameNow = frame.value ?? undefined;
  if (frameNow === undefined || !link.present) {
    wire.value = undefined;
    return;
  }
  const band = frameNow.parentElement;
  const source = band?.querySelector<HTMLElement>('[data-ptsel-source]') ?? null;
  const proxy = band?.querySelector<HTMLElement>('[data-ptsel-self]') ?? null;
  if (source === null || proxy === null) {
    wire.value = undefined;
    return;
  }
  const f = frameNow.getBoundingClientRect();
  // CLIENT px → LOCAL px, through the ONE shared ratio (`effectiveZoom`):
  // this subtree sits under at least one CSS `zoom` ladder on every profile.
  const eff = effectiveZoom(frameNow);
  const s = source.getBoundingClientRect();
  const p = proxy.getBoundingClientRect();
  const midY = p.top + p.height / 2;
  // In LOCAL px: a threshold compared against client px silently changes
  // meaning with `--con-ui-scale`.
  const span = (p.left - s.right) / eff;
  // The wire is only drawn where it is TRUE: the proxy standing to the
  // right of the card, at a height the card actually occupies. Anything
  // else is the stacked fallback, and a wire there would be a decoration
  // describing a relationship the layout no longer shows.
  if (span < MIN_SPAN_PX || midY < s.top || midY > s.bottom) {
    wire.value = undefined;
    return;
  }
  wire.value = {
    left: (s.right - f.left) / eff,
    top: (midY - f.top) / eff,
    width: span,
  };
}

watch(() => link.present, (present: boolean) => {
  // GOING AWAY IS SYNCHRONOUS. The proxy is unmounted the instant the step
  // is, and the re-measure is a frame later — long enough to paint a wire
  // to an element that is no longer there.
  if (!present) {
    wire.value = undefined;
  }
  scheduleMeasure();
});
watch(() => link.geometry, () => {
  scheduleMeasure();
});
/**
 * A CURSOR MOVE CAN SCROLL THE PROXY.
 *
 * Focus changes no box by itself — but the step keeps the cursored
 * candidate inside its own scrolling viewport, and with a long candidate
 * list that scroll moves the proxy while nothing resizes. The wire would
 * then be drawn at the height the proxy used to have. It is a rect read,
 * coalesced to one per frame, on the only input that can move the anchor.
 */
watch(() => link.focused, () => {
  scheduleMeasure();
});
watch(() => link.pulse, (v: number) => {
  pulseKey.value = v;
});

onMounted(() => {
  scheduleMeasure();
  // The RESPONSIVE path. The frame is `inset: 0` of the band, so its own box
  // changes with every layout change that could move either anchor — which
  // makes it the one honest thing to observe.
  const frameNow = frame.value ?? undefined;
  if (frameNow !== undefined) {
    stopResizeObs = useResizeObserver(frameNow, () => scheduleMeasure()).stop;
  }
});
onBeforeUnmount(() => {
  stopResizeObs?.();
  stopResizeObs = undefined;
});
</script>
