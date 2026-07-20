<template>
  <!--
    COLONY-BUILD HERO STAGE — the fixed, app-level layer of the "the build
    bonus frees the slot, then my cube takes it" scene (consoleColonyBuild /
    colonyBuildDirector). Mounted for the WHOLE transaction, so the cube
    survives any surface shuffling beneath it.

    The ONLY element is the cube proxy — a PIXEL-TWIN of the real filled-cell
    owner cube: sized to the captured slot rect, with its border-radius +
    inset relief computed in PX from the slot height using the SAME fractions
    the static `.con-coltile__cube--filled` uses in rem, so the two render
    byte-identical at any TV zoom and the one-frame handoff is invisible. The
    director only translates it in Y (never scales it). Pointer-inert, empty &
    free when nothing is building.
  -->
  <div v-if="colonyBuildState.active" class="con-colonybuild" aria-hidden="true">
    <div v-if="colonyBuildState.slotRect !== undefined"
         ref="cube"
         class="con-colonybuild__cube"
         :class="cubeColorClass"
         :style="cubeStyle"></div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {colonyBuildState, registerColonyBuildStage} from '@/client/console/colonyBuild/consoleColonyBuild';
import {ColonyBuildStageEls} from '@/client/console/colonyBuild/colonyBuildDirector';
import {
  CUBE_RADIUS_F, CUBE_RIM_F, CUBE_INSET_OFFSET_F, CUBE_INSET_BLUR_F,
} from '@/client/console/colonyBuild/colonyBuildModel';

export default defineComponent({
  name: 'ConsoleColonyBuildLayer',
  data() {
    return {
      colonyBuildState,
      unregister: undefined as (() => void) | undefined,
    };
  },
  computed: {
    cubeColorClass(): string {
      return colonyBuildState.color !== '' ? 'player_bg_color_' + colonyBuildState.color : '';
    },
    /** The captured slot rect IS the resting pose + the material style, sized
     *  to match the static cube on-screen (radius/relief ∝ slot height). */
    cubeStyle(): Record<string, string> {
      const r = colonyBuildState.slotRect;
      if (r === undefined) {
        return {};
      }
      const h = r.h;
      const rim = (h * CUBE_RIM_F).toFixed(2);
      const off = (h * CUBE_INSET_OFFSET_F).toFixed(2);
      const blur = (h * CUBE_INSET_BLUR_F).toFixed(2);
      return {
        left: `${Math.round(r.x)}px`,
        top: `${Math.round(r.y)}px`,
        width: `${Math.round(r.w)}px`,
        height: `${Math.round(r.h)}px`,
        borderRadius: `${(h * CUBE_RADIUS_F).toFixed(2)}px`,
        boxShadow: `inset 0 0 0 ${rim}px rgba(0, 0, 0, 0.55), ` +
          `inset 0 ${off}px ${blur}px rgba(255, 255, 255, 0.24), ` +
          `inset 0 -${off}px ${blur}px rgba(0, 0, 0, 0.4)`,
      };
    },
  },
  mounted() {
    this.unregister = registerColonyBuildStage({
      els: (): ColonyBuildStageEls | undefined => {
        const cube = this.$refs.cube as HTMLElement | undefined;
        if (cube === undefined || !cube.isConnected) {
          return undefined;
        }
        return {cube};
      },
    });
  },
  beforeUnmount() {
    this.unregister?.();
  },
});
</script>
