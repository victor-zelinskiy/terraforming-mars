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

<script setup vapor lang="ts">
import {computed, PropType} from 'vue';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceModel} from '@/common/models/SpaceModel';
import {getSpecialCellInfo, SpecialCellInfo} from '@/client/components/board/specialCellInfo';
import {hoverBoardCell, clearBoardCellHover, boardInfoState} from '@/client/components/board/boardInfoState';

/**
 * Compact sci-fi info marker mounted as a SIBLING of the actual
 * board-space (so it escapes the hex's `clip-path`). The component
 * reuses the parent's `.board-space-XX` position class to land on the
 * same x/y as the hex; its own CSS then insets it to the upper "metadata
 * sector" inside the cell.
 *
 * Visibility: marker renders only when
 *   - `getSpecialCellInfo(space.id, boardName)` returns an entry, AND
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
defineOptions({name: 'SpecialCellMarker'});
const props = defineProps({
  space: {
    type: Object as PropType<SpaceModel>,
    required: true,
  },
  boardName: {
    type: String as PropType<BoardName>,
    required: true,
  },
});

const info = computed((): SpecialCellInfo | undefined => {
  return getSpecialCellInfo(props.space.id, props.boardName);
});
const isEmpty = computed((): boolean => {
  return props.space.tileType === undefined;
});
const positionClass = computed((): string => {
  return `board-space-${props.space.id}`;
});
const isActive = computed((): boolean => {
  // The badge pops in sync with the unified BoardInformation popover — and only for a cursor the player SEES (a
  // mouse hover, a console inspection / placement), never for the console's idle selection warming the facts.
  return boardInfoState.spaceId === props.space.id && !boardInfoState.quiet;
});
// The badge is an extra affordance for the SAME general inspector the
// hex-wide hover drives — so hovering it shows the unified popover (lore +
// tile bonuses / owner / scoring), not a separate lore-only overlay.
function onActivate(): void {
  hoverBoardCell(props.space.id);
}
function onDeactivate(): void {
  clearBoardCellHover(props.space.id);
}
</script>
