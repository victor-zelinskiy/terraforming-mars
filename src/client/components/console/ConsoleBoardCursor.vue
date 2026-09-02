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
     - navigate/legal:  mint ring + a QUIET tile projection — a silhouette,
       not a second metal frame: the ring already owns «where», so the ghost
       only has to say «what», and the cell's printed bonuses stay the
       foreground (the ghost is masked down under the measured bonus
       cluster — `bonusZone`);
     - navigate/blocked: muted red ring, no projection (nothing can land);
     - travel: the ghost LIFTS and lightens while the reticle glides — one
       object leaving a hex, crossing, and settling into the next; a held
       d-pad keeps it airborne, so fast scrolling is automatically the
       compact form of the same motion;
     - locked:  the projection SETTLES into the hex and turns MATERIAL
       (opacity up, scale to 1, contact shadow), the ring tightens amber —
       the commit boundary's own colour grammar;
     - committing: the locked pose holds, breathing quietly, until the hero
       scene takes the cell (the shell unmounts this the moment the
       tile-placement transaction owns the visual).

    Paint budget: transform/opacity/box-shadow only (the console strips
    `filter`/`text-shadow` permanently); the one INFINITE loop (`__pulse`)
    is compositor-only and registered in the fx-lite / reduced-motion
    stop-lists like `con-cell-active`. The bonus mask is STATIC per cell
    (set at landing, never animated).
  -->
  <div class="con-bcur"
       :class="poseClasses"
       :style="rootStyle"
       aria-hidden="true">
    <div class="con-bcur__shadow"></div>
    <div v-if="tileArtClass !== ''" class="con-bcur__ghost" :class="{'con-bcur__ghost--masked': bonusZone !== undefined}">
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
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

/** The focused cell's bonus-cluster box in cell-local board px (keep-px) —
 *  measured by ConsoleBoardSection, drives the ghost's quiet-zone mask. */
export type BonusZone = {cx: number, cy: number, w: number, h: number};

/** The intrinsic hex cell box (board px — see board.less `.board-space`). */
const CELL_W = 46; /* keep-px: board px-space */
const CELL_H = 51; /* keep-px: board px-space */
/** The travel transition's base duration (mirrors the CSS declaration). */
const TRAVEL_MS = 120;
/** Settle slack past the glide — a held d-pad (repeat ≈130 ms) re-arms the
 *  timer before it fires, so the reticle stays in its airborne pose for the
 *  whole run and lands ONCE, on the final cell. */
const SETTLE_SLACK_MS = 45;

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
    /** The cell's printed-bonus cluster (cell-local board px) — the ghost's
     *  QUIET ZONE: the projection is masked down under it so the reward the
     *  player is weighing always reads above the incoming tile. */
    bonusZone: {type: Object as PropType<BonusZone | undefined>, default: undefined},
  },
  data() {
    return {
      /** The reticle is mid-glide (kept true through a held-direction run). */
      traveling: false,
      settleTimer: 0,
    };
  },
  computed: {
    rootStyle(): Record<string, string> {
      const style: Record<string, string> = {
        width: `${CELL_W}px`,
        height: `${CELL_H}px`,
        transform: `translate(${this.x}px, ${this.y}px)`,
      };
      const zone = this.bonusZone;
      if (zone !== undefined) {
        // The mask ellipse hugs the measured cluster with soft shoulders —
        // enough that no ghost line crosses an icon, small enough that the
        // tile still reads as one object. Cell-local px (keep-px).
        style['--bcur-mask-x'] = `${zone.cx.toFixed(1)}px`;
        style['--bcur-mask-y'] = `${zone.cy.toFixed(1)}px`;
        style['--bcur-mask-rx'] = `${(zone.w / 2 + 5).toFixed(1)}px`;
        style['--bcur-mask-ry'] = `${(zone.h / 2 + 4).toFixed(1)}px`;
      }
      return style;
    },
    poseClasses(): Record<string, boolean> {
      return {
        'con-bcur--legal': this.legal && this.phase === 'navigate',
        'con-bcur--blocked': !this.legal,
        'con-bcur--locked': this.legal && this.phase === 'locked',
        'con-bcur--committing': this.legal && this.phase === 'committing',
        // Travel is a NAVIGATE-only pose: a lock freezes the reticle on its
        // cell, so a phase change mid-glide must not keep it airborne.
        'con-bcur--travel': this.traveling && this.phase === 'navigate',
      };
    },
    /** One key so a diagonal step arms exactly one settle cycle. */
    travelKey(): string {
      return `${this.x}|${this.y}`;
    },
  },
  watch: {
    /**
     * The glide is a CSS transition (retargetable); this only tracks whether
     * one is in flight so the ghost can ride an airborne pose. A timer, not
     * `transitionend`: with nav-repeat (≈130 ms) each hop's end event fires
     * ~10 ms before the next press, which would flicker land/lift per step —
     * the re-armed timer instead keeps the pose up for the whole run.
     * Reduced motion snaps the travel, so it never enters the pose at all.
     */
    travelKey(): void {
      if (consoleReducedMotionActive()) {
        return;
      }
      this.traveling = true;
      if (this.settleTimer !== 0) {
        window.clearTimeout(this.settleTimer);
      }
      this.settleTimer = window.setTimeout(() => {
        this.settleTimer = 0;
        this.traveling = false;
      }, consoleMotionMs(TRAVEL_MS) + SETTLE_SLACK_MS);
    },
  },
  beforeUnmount() {
    if (this.settleTimer !== 0) {
      window.clearTimeout(this.settleTimer);
    }
  },
});
</script>
