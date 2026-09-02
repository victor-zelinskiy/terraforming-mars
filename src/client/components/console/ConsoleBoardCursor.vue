<template>
  <!--
    THE PLACEMENT RETICLE — the console's physical board cursor
    (docs/claude/console/board-placement-flow.md).

    One persistent element that TRAVELS between hexes (a retargetable
    transform transition — never a per-cell class repaint), carrying the
    PROJECTION of the tile about to be placed. It lives INSIDE `.board-cont`
    (teleported there by ConsoleBoardSection), so it is positioned in
    intrinsic board px and rides the planet's own scale/pan transform for
    free — a re-fit can never strand it. All coordinates in this file are
    board px (keep-px: board px-space).

    Poses (driven by the placement flow phase + the focused cell's legality):
     - navigate/legal:  mint ring + translucent tile projection hovering
       slightly above the cell;
     - navigate/blocked: muted red ring, no projection (nothing can land);
     - locked:  the projection SETTLES into the hex (opacity up, scale to 1,
       contact shadow), the ring tightens amber — the commit boundary's own
       colour grammar;
     - committing: the locked pose holds, breathing quietly, until the hero
       scene takes the cell (the shell unmounts this the moment the
       tile-placement transaction owns the visual).

    Paint budget: transform/opacity/box-shadow only (the console strips
    `filter`/`text-shadow` permanently); the one INFINITE loop (`__pulse`)
    is compositor-only and registered in the fx-lite / reduced-motion
    stop-lists like `con-cell-active`.
  -->
  <div class="con-bcur"
       :class="poseClasses"
       :style="rootStyle"
       aria-hidden="true">
    <div class="con-bcur__shadow"></div>
    <div v-if="tileArtClass !== ''" class="con-bcur__ghost">
      <span class="con-bcur__art" :class="tileArtClass"></span>
      <span v-if="cubeColor !== undefined" class="con-bcur__cube" :class="'player_bg_color_' + cubeColor"></span>
    </div>
    <div class="con-bcur__ring"></div>
    <div class="con-bcur__lockring"></div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PlacementFlowPhase} from '@/client/console/tilePlacement/placementFlow';

/** The intrinsic hex cell box (board px — see board.less `.board-space`). */
const CELL_W = 46; /* keep-px: board px-space */
const CELL_H = 51; /* keep-px: board px-space */

export default defineComponent({
  name: 'ConsoleBoardCursor',
  props: {
    /** Focused cell's top-left in intrinsic board-cont px. */
    x: {type: Number, required: true},
    y: {type: Number, required: true},
    /** The focused cell is a legal landing spot right now. */
    legal: {type: Boolean, required: true},
    phase: {type: String as PropType<PlacementFlowPhase>, required: true},
    /** `board-space-tile--*` art class of the projected tile ('' = ring only). */
    tileArtClass: {type: String, default: ''},
    /** Owner cube colour for tiles that seat one (never for oceans). */
    cubeColor: {type: String as PropType<string | undefined>, default: undefined},
  },
  computed: {
    rootStyle(): Record<string, string> {
      return {
        width: `${CELL_W}px`,
        height: `${CELL_H}px`,
        transform: `translate(${this.x}px, ${this.y}px)`,
      };
    },
    poseClasses(): Record<string, boolean> {
      return {
        'con-bcur--legal': this.legal && this.phase === 'navigate',
        'con-bcur--blocked': !this.legal,
        'con-bcur--locked': this.legal && this.phase === 'locked',
        'con-bcur--committing': this.legal && this.phase === 'committing',
      };
    },
  },
});
</script>
