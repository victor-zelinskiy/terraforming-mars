<template>
  <!-- THE FRAME never moves: it is the coordinate space the wire is solved in,
       so it exists for as long as this component does (the HOST decides that —
       it mounts this only while a self-target is on offer). Out of flow
       (`position: absolute`) and `pointer-events: none`, so a grid/flex host
       neither gains an item nor loses a hit target. -->
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

<script lang="ts">
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
import {defineComponent} from 'vue';
import {useResizeObserver} from '@vueuse/core';
import {playedTargetSelfState} from '@/client/console/played/consolePlayedTargetSelf';
import {effectiveZoom} from '@/client/console/cssUnits';

/** The solved wire, in the frame's own layout px. */
type Wire = {left: number, top: number, width: number};

/** Below this the gap between the columns is not a wire, it is a seam. */
const MIN_SPAN_PX = 8;

export default defineComponent({
  name: 'ConsolePlayedTargetLink',
  data() {
    return {
      link: playedTargetSelfState,
      wire: undefined as Wire | undefined,
      /**
       * The arrival light's own key. SEEDED from the live nonce, because the
       * host mounts this in the SAME patch that publishes the first focus —
       * the watcher never fires for that one, and the first arrival of every
       * step would go unannounced. Safe to seed only because the nonce is reset
       * with the step (`resetPlayedTargetSelf`), so it can never carry an
       * arrival from a workspace the player has already left.
       */
      pulseKey: playedTargetSelfState.pulse,
      stopResizeObs: undefined as (() => void) | undefined,
      rafId: 0,
    };
  },
  computed: {
    wireStyle(): Record<string, string> {
      const w = this.wire;
      if (w === undefined) {
        return {};
      }
      return {
        left: `${w.left.toFixed(2)}px`,
        top: `${w.top.toFixed(2)}px`,
        width: `${w.width.toFixed(2)}px`,
      };
    },
  },
  watch: {
    'link.present'(present: boolean) {
      // GOING AWAY IS SYNCHRONOUS. The proxy is unmounted the instant the step
      // is, and the re-measure is a frame later — long enough to paint a wire
      // to an element that is no longer there.
      if (!present) {
        this.wire = undefined;
      }
      this.scheduleMeasure();
    },
    'link.geometry'() {
      this.scheduleMeasure();
    },
    /**
     * A CURSOR MOVE CAN SCROLL THE PROXY.
     *
     * Focus changes no box by itself — but the step keeps the cursored
     * candidate inside its own scrolling viewport, and with a long candidate
     * list that scroll moves the proxy while nothing resizes. The wire would
     * then be drawn at the height the proxy used to have. It is a rect read,
     * coalesced to one per frame, on the only input that can move the anchor.
     */
    'link.focused'() {
      this.scheduleMeasure();
    },
    'link.pulse'(v: number) {
      this.pulseKey = v;
    },
  },
  mounted() {
    this.scheduleMeasure();
    // The RESPONSIVE path. The frame is `inset: 0` of the band, so its own box
    // changes with every layout change that could move either anchor — which
    // makes it the one honest thing to observe.
    const frame = this.$refs.frame as HTMLElement | undefined;
    if (frame !== undefined) {
      this.stopResizeObs = useResizeObserver(frame, () => this.scheduleMeasure()).stop;
    }
  },
  beforeUnmount() {
    this.stopResizeObs?.();
    this.stopResizeObs = undefined;
    if (this.rafId !== 0 && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = 0;
  },
  methods: {
    /**
     * Measure AFTER the frame the invalidation belongs to has actually been
     * laid out. `$nextTick` gets Vue's patch in; the rAF gets the browser's
     * layout of it — the step publishes a re-solved card size as a custom
     * property, and the row it re-flows is one style recalculation later.
     */
    scheduleMeasure(): void {
      if (this.rafId !== 0) {
        return;
      }
      // A HEADLESS MOUNT has no rAF (the composer unit specs mount the whole
      // host in jsdom). There is no layout to wait for there either — every box
      // is zero — so the fallback is the tick, never a polyfill that would
      // pretend a frame happened.
      if (typeof requestAnimationFrame !== 'function') {
        void this.$nextTick(() => this.measure());
        return;
      }
      this.rafId = requestAnimationFrame(() => {
        this.rafId = 0;
        void this.$nextTick(() => this.measure());
      });
    },
    measure(): void {
      const frame = this.$refs.frame as HTMLElement | undefined;
      if (frame === undefined || !this.link.present) {
        this.wire = undefined;
        return;
      }
      const band = frame.parentElement;
      const source = band?.querySelector<HTMLElement>('[data-ptsel-source]') ?? null;
      const proxy = band?.querySelector<HTMLElement>('[data-ptsel-self]') ?? null;
      if (source === null || proxy === null) {
        this.wire = undefined;
        return;
      }
      const f = frame.getBoundingClientRect();
      // CLIENT px → LOCAL px, through the ONE shared ratio (`effectiveZoom`):
      // this subtree sits under at least one CSS `zoom` ladder on every profile.
      const eff = effectiveZoom(frame);
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
        this.wire = undefined;
        return;
      }
      this.wire = {
        left: (s.right - f.left) / eff,
        top: (midY - f.top) / eff,
        width: span,
      };
    },
  },
});
</script>
