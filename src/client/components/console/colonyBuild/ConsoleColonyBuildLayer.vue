<template>
  <!--
    COLONY-BUILD HERO STAGE — the fixed, app-level layer of the "the build
    bonus frees the slot, then my cube takes it" scene (consoleColonyBuild /
    colonyBuildDirector). Mounted for the WHOLE transaction, so the cube
    survives any surface shuffling beneath it.

    The stage hosts the REAL premium 3D PlayerCube — the SAME token component
    the main board uses for tile ownership — inside a wrapper positioned at the
    captured slot rect and centred exactly like the static in-cell cube, at the
    SAME footprint fraction (CUBE_SLOT_F of the slot height, in real screen px,
    so it matches the ui-scale-zoomed static cube at any TV zoom). The director
    animates the cube's own flat internals per the component's animation
    contract (scene flies/squashes, shadow stays on the ground, glow ignites on
    contact) — the 3D cube itself is never transformed, and the one-frame
    handoff onto the identical committed cube is invisible. The impact ring is
    the layer's own one-shot contact FX at the cube's base. Pointer-inert,
    empty & free when nothing is building.
  -->
  <div v-if="colonyBuildState.active" class="con-colonybuild" aria-hidden="true">
    <div v-if="colonyBuildState.slotRect !== undefined && cubeColor !== undefined"
         ref="root"
         class="con-colonybuild__cube"
         :style="wrapStyle">
      <PlayerCube ref="cube"
                  :color="cubeColor"
                  :size="cubeSize"
                  :glow="true"
                  :shadow="true" />
      <span ref="ring" class="con-colonybuild__ring" :style="ringStyle"></span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {colonyBuildState, registerColonyBuildStage} from '@/client/console/colonyBuild/consoleColonyBuild';
import {ColonyBuildStageEls} from '@/client/console/colonyBuild/colonyBuildDirector';
import {CUBE_SLOT_F} from '@/client/console/colonyBuild/colonyBuildModel';
import PlayerCube from '@/client/components/PlayerCube.vue';

export default defineComponent({
  name: 'ConsoleColonyBuildLayer',
  components: {PlayerCube},
  data() {
    return {
      colonyBuildState,
      unregister: undefined as (() => void) | undefined,
    };
  },
  computed: {
    /** The builder's colour ('' while idle → nothing mounts). */
    cubeColor(): Color | undefined {
      return colonyBuildState.color === '' ? undefined : colonyBuildState.color;
    },
    /** The cube footprint in real screen px — the slot rect is already
     *  TV-scaled + tile-fit-zoomed, so slot.h × CUBE_SLOT_F lands exactly on
     *  the static in-cell cube's rendered size (32 logical px in the 46
     *  logical-px cell). Fractional px on purpose: rounding would drift off
     *  the zoomed static cube and shear the one-frame handoff. */
    cubeSize(): number {
      const r = colonyBuildState.slotRect;
      return r === undefined ? 0 : r.h * CUBE_SLOT_F;
    },
    /** The captured slot rect IS the stage: the cube centres in it exactly
     *  like the static cube flex-centres in the real cell. */
    wrapStyle(): Record<string, string> {
      const r = colonyBuildState.slotRect;
      if (r === undefined) {
        return {};
      }
      return {
        left: `${Math.round(r.x)}px`,
        top: `${Math.round(r.y)}px`,
        width: `${Math.round(r.w)}px`,
        height: `${Math.round(r.h)}px`,
      };
    },
    /** The impact ring: an ellipse seated at the cube's BASE line (the ground
     *  contact), sized off the cube footprint. The director scales/fades it. */
    ringStyle(): Record<string, string> {
      const r = colonyBuildState.slotRect;
      if (r === undefined) {
        return {};
      }
      const size = this.cubeSize;
      return {
        left: '50%',
        top: `calc(50% + ${(size * 0.34).toFixed(2)}px)`,
        width: `${(size * 1.5).toFixed(2)}px`,
        height: `${(size * 0.56).toFixed(2)}px`,
      };
    },
  },
  mounted() {
    this.unregister = registerColonyBuildStage({
      els: (): ColonyBuildStageEls | undefined => {
        const root = this.$refs.root as HTMLElement | undefined;
        const ring = this.$refs.ring as HTMLElement | undefined;
        const cube = this.$refs.cube as {$el?: HTMLElement} | undefined;
        const cubeEl = cube?.$el;
        // `!root` also catches Vue's `null` for a removed-then-queried ref.
        if (!root || !root.isConnected || ring === undefined || cubeEl === undefined) {
          return undefined;
        }
        const scene = cubeEl.querySelector<HTMLElement>('.player-cube__scene');
        const shadow = cubeEl.querySelector<HTMLElement>('.player-cube__shadow');
        const glow = cubeEl.querySelector<HTMLElement>('.player-cube__glow');
        if (scene === null || shadow === null || glow === null) {
          return undefined;
        }
        return {root, scene, shadow, glow, ring};
      },
    });
  },
  beforeUnmount() {
    this.unregister?.();
  },
});
</script>
