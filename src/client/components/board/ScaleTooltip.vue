<template>
  <!--
    The single teleported renderer for the unified scale-HUD tooltip. Reads the
    module-level `scaleTooltipState` (written by every scale hover surface —
    rail / identity badge / current indicator / marker chip) and fixed-positions
    itself in SCREEN space (the scales live in a transformed/scaled board, so we
    anchor to the surface's `getBoundingClientRect()`). It viewport-clamps and
    honours SAFE ZONES — it never spills under the bottom toolbar or behind the
    sidebars (read from the live CSS vars). Mounted ONCE (Board.vue); teleports
    to body so it escapes the board's stacking + scale.
  -->
  <teleport to="body">
    <transition name="scale-tooltip-fade">
      <div
        v-if="state.visible && state.content"
        ref="tip"
        class="scale-tooltip"
        :class="`scale-tooltip--${state.content.accent}`"
        :style="posStyle"
        role="tooltip">
        <span class="scale-tooltip__kicker">{{ state.content.kicker }}</span>
        <div class="scale-tooltip__rows">
          <span
            v-for="(r, i) in state.content.rows"
            :key="i"
            class="scale-tooltip__row"
            :class="`scale-tooltip__row--${r.tone}`">
            <span v-if="r.dot" class="scale-tooltip__dot" :style="{background: r.dot}"></span>{{ r.text }}
          </span>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {scaleTooltipState, clampScaleTooltipPosition, TooltipSafeZones} from '@/client/components/board/scaleTooltipState';

export default defineComponent({
  name: 'ScaleTooltip',
  data() {
    return {
      state: scaleTooltipState,
      pos: {left: 0, top: 0},
    };
  },
  computed: {
    // A reactive tuple so the watcher fires on every show / reposition / swap.
    tick(): unknown {
      return [scaleTooltipState.visible, scaleTooltipState.anchor, scaleTooltipState.content];
    },
    posStyle(): Record<string, string> {
      return {left: `${this.pos.left}px`, top: `${this.pos.top}px`};
    },
  },
  watch: {
    tick(): void {
      // Wait a frame so the (v-if) element is in the DOM and measurable, then
      // clamp against its real size.
      this.$nextTick(() => this.recompute());
    },
  },
  methods: {
    safeZones(): TooltipSafeZones {
      const ph = typeof document !== 'undefined' ? document.querySelector('.player_home') : null;
      const cs = ph !== null ? getComputedStyle(ph) : null;
      const num = (name: string, fallback: number): number => {
        const raw = cs?.getPropertyValue(name) ?? '';
        const n = raw ? parseFloat(raw) : NaN;
        return Number.isFinite(n) ? n : fallback;
      };
      const bottomBar = num('--bottom-bar-button-height', 36);
      const rightBar = num('--right-sidebar-width', 62);
      const leftPanel = num('--left-panel-width', 0);
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      return {
        top: 12,
        bottom: vh - (bottomBar + 16),
        left: Math.max(8, leftPanel),
        right: vw - rightBar - 8,
      };
    },
    recompute(): void {
      const a = scaleTooltipState.anchor;
      const el = this.$refs.tip as HTMLElement | undefined;
      if (a === null || el === undefined) {
        return;
      }
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w === 0 && h === 0) {
        return; // not laid out yet (JSDOM / pre-paint)
      }
      this.pos = clampScaleTooltipPosition(a, w, h, this.safeZones());
    },
  },
});
</script>
