<template>
  <div
    v-if="info !== undefined && isEmpty"
    ref="root"
    class="special-cell-marker"
    :class="[positionClass, {'special-cell-marker--active': isActive}]"
    :aria-label="info.title"
    role="button"
    tabindex="0"
    @mouseenter="onActivate"
    @mouseleave="onDeactivate"
    @focus="onActivate"
    @blur="onDeactivate"
  >
    <!-- HUD-style hex info node. Outline-first sci-fi shape that reads as
         part of the hex grid rather than a tooltip bubble. -->
    <svg
      class="special-cell-marker__icon"
      viewBox="0 0 24 26"
      aria-hidden="true"
    >
      <polygon
        class="special-cell-marker__hex"
        points="12,1.5 22,7 22,19 12,24.5 2,19 2,7"
      />
      <circle
        class="special-cell-marker__dot"
        cx="12"
        cy="8.5"
        r="1.5"
      />
      <rect
        class="special-cell-marker__stem"
        x="10.9"
        y="11.5"
        width="2.2"
        height="7"
        rx="0.8"
      />
    </svg>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {SpaceModel} from '@/common/models/SpaceModel';
import {getSpecialCellInfo, SpecialCellInfo} from '@/client/components/board/specialCellInfo';
import {
  setActiveSpecialCell,
  clearActiveSpecialCell,
  registerSpecialCellMarker,
  unregisterSpecialCellMarker,
  specialCellHoverState,
} from '@/client/components/board/specialCellHoverState';

/**
 * Compact sci-fi info marker mounted as a SIBLING of the actual
 * board-space (so it escapes the hex's `clip-path`). The component
 * reuses the parent's `.board-space-XX` position class to land on the
 * same x/y as the hex; its own CSS then insets it to the upper "metadata
 * sector" inside the cell.
 *
 * Visibility: marker renders only when
 *   - `getSpecialCellInfo(space.id)` returns an entry, AND
 *   - the cell is empty (`space.tileType === undefined`).
 *
 * Two activation paths feed the popup:
 *   1. Direct hover/focus on the marker badge.
 *   2. Hex-wide hover (event-delegated in Board.vue). For that path,
 *      the marker self-registers with the shared store on mount so the
 *      delegate can find the right element by spaceId.
 *
 * The `--active` modifier on the root tracks the SHARED active state
 * (not just this marker's own hover), so when path (2) fires the marker
 * still pops visually in sync with the popup.
 */
export default defineComponent({
  name: 'SpecialCellMarker',
  props: {
    space: {
      type: Object as PropType<SpaceModel>,
      required: true,
    },
  },
  computed: {
    info(): SpecialCellInfo | undefined {
      return getSpecialCellInfo(this.space.id);
    },
    isEmpty(): boolean {
      return this.space.tileType === undefined;
    },
    positionClass(): string {
      return `board-space-${this.space.id}`;
    },
    isActive(): boolean {
      return this.info !== undefined && specialCellHoverState.activeId === this.info.id;
    },
  },
  watch: {
    // When this marker becomes the visible one (after mount or when
    // tileType clears), register so the hex-wide delegate can find it.
    isEmpty(empty: boolean) {
      if (empty) {
        this.registerIfPossible();
      } else if (this.info !== undefined) {
        unregisterSpecialCellMarker(this.space.id);
      }
    },
  },
  mounted() {
    this.registerIfPossible();
  },
  beforeUnmount() {
    if (this.info !== undefined) {
      unregisterSpecialCellMarker(this.space.id);
    }
  },
  methods: {
    registerIfPossible(): void {
      if (this.info === undefined) {
        return;
      }
      const el = this.$refs.root as HTMLElement | undefined;
      if (el === undefined) {
        return;
      }
      registerSpecialCellMarker({id: this.info.id, spaceId: this.space.id, el});
    },
    onActivate(): void {
      if (this.info === undefined) {
        return;
      }
      const el = this.$refs.root as HTMLElement | undefined;
      if (el === undefined) {
        return;
      }
      setActiveSpecialCell(this.info.id, this.space.id, el);
    },
    onDeactivate(): void {
      if (this.info === undefined) {
        return;
      }
      clearActiveSpecialCell(this.info.id);
    },
  },
});
</script>
