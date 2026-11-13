<template>
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
  <ConsoleColonyBuildWitness />
</template>

<script setup vapor lang="ts">
/*
 * COLONY-BUILD HERO STAGE — the fixed, app-level layer of the "the build
 * bonus frees the slot, then my cube takes it" scene (consoleColonyBuild /
 * colonyBuildDirector). Mounted for the WHOLE transaction, so the cube
 * survives any surface shuffling beneath it.
 *
 * The stage hosts the REAL premium 3D PlayerCube — the SAME token component
 * the main board uses for tile ownership — inside a wrapper positioned at the
 * captured slot rect and centred exactly like the static in-cell cube, at the
 * SAME footprint fraction (CUBE_SLOT_F of the slot height, in real screen px,
 * so it matches the ui-scale-zoomed static cube at any TV zoom). The director
 * animates the cube's own flat internals per the component's animation
 * contract (scene flies/squashes, shadow stays on the ground, glow ignites on
 * contact) — the 3D cube itself is never transformed, and the one-frame
 * handoff onto the identical committed cube is invisible. The impact ring is
 * the layer's own one-shot contact FX at the cube's base. Pointer-inert,
 * empty & free when nothing is building.
 *
 * (This comment opened the template; the template starts with its root now.)
 *
 * — before the root `<ConsoleColonyBuildWitness />`:
 * The transaction's witness (phase · «the flight could not be played») — its own component, its own render.
 *
 * (These comments stood between the template's roots; each names the root it stood before.)
 */
import {computed, onBeforeUnmount, onMounted, useTemplateRef} from 'vue';
import {RootElHolder} from '@/client/components/rootEl';
import {Color} from '@/common/Color';
import {colonyBuildState, registerColonyBuildStage} from '@/client/console/colonyBuild/consoleColonyBuild';
import {ColonyBuildStageEls} from '@/client/console/colonyBuild/colonyBuildDirector';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ConsoleColonyBuildWitness from '@/client/components/console/colonyBuild/ConsoleColonyBuildWitness.vue';

defineOptions({name: 'ConsoleColonyBuildLayer'});

const root = useTemplateRef<HTMLElement>('root');
const cube = useTemplateRef<RootElHolder>('cube');
const ring = useTemplateRef<HTMLElement>('ring');
let unregister: (() => void) | undefined;
/** The builder's colour ('' while idle → nothing mounts). */
const cubeColor = computed((): Color | undefined => {
  return colonyBuildState.color === '' ? undefined : colonyBuildState.color;
});
/**
 * The cube footprint in real screen px. The captured rect is already
 * TV-scaled + host-zoomed; `cubeFactor` says how much of it the token
 * occupies — `1` when the host published a CUBE SEAT (the rect IS the
 * token's box, so the proxy is born at its landing size), the legacy
 * cell fraction otherwise. Fractional px on purpose: rounding would
 * drift off the zoomed static cube and shear the one-frame handoff.
 */
const cubeSize = computed((): number => {
  const r = colonyBuildState.slotRect;
  return r === undefined ? 0 : r.h * colonyBuildState.cubeFactor;
});
/** The captured slot rect IS the stage: the cube centres in it exactly
 *  like the static cube flex-centres in the real cell. */
const wrapStyle = computed((): Record<string, string> => {
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
});
/** The impact ring: an ellipse seated at the cube's BASE line (the ground
 *  contact), sized off the cube footprint. The director scales/fades it. */
const ringStyle = computed((): Record<string, string> => {
  const r = colonyBuildState.slotRect;
  if (r === undefined) {
    return {};
  }
  const size = cubeSize.value;
  return {
    left: '50%',
    top: `calc(50% + ${(size * 0.34).toFixed(2)}px)`,
    width: `${(size * 1.5).toFixed(2)}px`,
    height: `${(size * 0.56).toFixed(2)}px`,
  };
});

onMounted(() => {
  unregister = registerColonyBuildStage({
    els: (): ColonyBuildStageEls | undefined => {
      const rootNow = root.value;
      const ringNow = ring.value;
      const cubeNow = cube.value;
      const cubeEl = cubeNow?.rootEl ?? undefined;
      // `!rootNow` also catches the template ref's `null` (a ref the `v-if` took away).
      if (!rootNow || !rootNow.isConnected || ringNow === null || cubeEl === undefined) {
        return undefined;
      }
      const scene = cubeEl.querySelector<HTMLElement>('.player-cube__scene');
      const shadow = cubeEl.querySelector<HTMLElement>('.player-cube__shadow');
      const glow = cubeEl.querySelector<HTMLElement>('.player-cube__glow');
      if (scene === null || shadow === null || glow === null) {
        return undefined;
      }
      return {root: rootNow, scene, shadow, glow, ring: ringNow};
    },
  });
});
onBeforeUnmount(() => {
  unregister?.();
});
</script>
