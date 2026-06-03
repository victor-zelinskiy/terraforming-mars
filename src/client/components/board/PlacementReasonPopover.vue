<template>
  <teleport to="body">
    <transition name="placement-reason-fade">
      <div
        v-if="reasons.length > 0 && anchor !== undefined"
        class="placement-reason-host"
        :style="hostStyle">
        <HandCardReasonPopover :reasons="reasons" heading="Cannot place here" />
      </div>
    </transition>
  </teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import HandCardReasonPopover from '@/client/components/handCards/HandCardReasonPopover.vue';

/**
 * Floating host that shows the SHARED reason popover next to a hovered
 * illegal board cell during a tile-placement prompt — the board-side twin of
 * `HandCardItem`'s reason popover. The cell lives deep in a scaled/translated
 * board, so we position by its screen-space `getBoundingClientRect()` with a
 * fixed-position, pointer-events:none host (teleported to body). It flips
 * above/below the cell when near the viewport top and clamps horizontally so
 * it never spills off-screen. The inner `HandCardReasonPopover` is the exact
 * same component the hand overlay uses → identical look + behaviour.
 */
export default defineComponent({
  name: 'PlacementReasonPopover',
  components: {HandCardReasonPopover},
  props: {
    reasons: {
      type: Array as PropType<ReadonlyArray<UnplayableReason>>,
      required: true,
    },
    anchor: {
      type: Object as PropType<DOMRect | undefined>,
      default: undefined,
    },
  },
  computed: {
    hostStyle(): Record<string, string> {
      const a = this.anchor;
      if (a === undefined) {
        return {display: 'none'};
      }
      const maxW = 272; // matches .hand-reason max-width
      const margin = 8;
      const cx = a.left + a.width / 2;
      const left = Math.min(
        Math.max(cx, maxW / 2 + margin),
        window.innerWidth - maxW / 2 - margin);
      // Above the cell by default; flip below when there's no room up top.
      const above = a.top > 170;
      const top = above ? a.top - 8 : a.bottom + 8;
      return {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        transform: `translate(-50%, ${above ? '-100%' : '0'})`,
      };
    },
  },
});
</script>
