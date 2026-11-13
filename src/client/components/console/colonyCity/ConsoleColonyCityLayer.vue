<template>
  <div v-if="colonyCityState.live" class="con-colcityfx" aria-hidden="true"
       :data-colony-city-beat="colonyCityState.beat"
       :data-colony-city-scale="colonyCityState.scale">
    <template v-if="colonyCityState.seatRect !== undefined">
      <div ref="shadow" class="con-colcityfx__shadow"></div>
      <ConsoleTileProxy ref="tile" class="con-colcityfx__tile" artClass="board-space-tile--city" data-colony-city-proxy />
    </template>
    <div v-if="colonyCityState.cubeOn && colonyCityState.cubeRect !== undefined && cubeColor !== undefined"
         ref="cubeRoot"
         class="con-colcityfx__cube"
         :style="cubeWrapStyle"
         data-colony-city-cube-proxy>
      <PlayerCube ref="cube" :color="cubeColor" :size="cubeSize" :glow="true" :shadow="true" />
      <span ref="ring" class="con-colcityfx__ring" :style="ringStyle"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * A CITY IS LAID ON A COLONY TILE — the fixed, shell-level stage of the scene
 * (consoleColonyCity / colonyCityDirector; Turmoil Redux TR22 Nova City).
 * Mounted by the SHELL, never inside a teleported surface (a `position: fixed`
 * stage inside a host zone resolves against that zone's containing block).
 *
 * ONE piece and ONE cube, both the board's own:
 *   · the tile is the shared proxy anatomy (ConsoleTileProxy — edge · art ·
 *     touch), sized to its measured seat, born INVISIBLE and materialized by
 *     the director above the seat;
 *   · the SHADOW is the layer's — it lies on the seat for the whole scene
 *     (wide and faint under the hanging piece, tight and dark in contact);
 *   · the owner's cube is the real PlayerCube inside a wrapper at the cube's
 *     own resting box, flown by the colony build's director (the same
 *     anatomy: scene · shadow · glow + the layer's impact ring).
 *
 * Pointer-inert; empty and free when nothing is landing.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, onBeforeUnmount, onMounted, useTemplateRef} from 'vue';
import {Color} from '@/common/Color';
import {colonyCityState, registerColonyCityStage} from '@/client/console/colonyCity/consoleColonyCity';
import {ColonyCityStageEls} from '@/client/console/colonyCity/colonyCityDirector';
import {ColonyBuildStageEls} from '@/client/console/colonyBuild/colonyBuildDirector';
import ConsoleTileProxy from '@/client/components/console/tilePlacement/ConsoleTileProxy.vue';
import {tileProxyEls} from '@/client/components/console/tilePlacement/consoleTileProxyModel';
import PlayerCube from '@/client/components/PlayerCube.vue';

defineOptions({name: 'ConsoleColonyCityLayer'});

const shadow = useTemplateRef<HTMLElement>('shadow');
const tile = useTemplateRef<{$el?: HTMLElement}>('tile');
const cubeRoot = useTemplateRef<HTMLElement>('cubeRoot');
const cube = useTemplateRef<{$el?: HTMLElement}>('cube');
const ring = useTemplateRef<HTMLElement>('ring');
let unregister: (() => void) | undefined;
const cubeColor = computed((): Color | undefined => {
  return colonyCityState.landing?.tile.color;
});
/** The cube's footprint in real screen px: the measured box IS the token's box (born at its landing size). */
const cubeSize = computed((): number => {
  return colonyCityState.cubeRect?.h ?? 0;
});
const cubeWrapStyle = computed((): Record<string, string> => {
  const r = colonyCityState.cubeRect;
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
/** The impact ring: an ellipse seated at the cube's BASE line, sized off the cube — the build layer's own recipe. */
const ringStyle = computed((): Record<string, string> => {
  const size = cubeSize.value;
  return {
    left: '50%',
    top: `calc(50% + ${(size * 0.34).toFixed(2)}px)`,
    width: `${(size * 1.5).toFixed(2)}px`,
    height: `${(size * 0.56).toFixed(2)}px`,
  };
});

onMounted(() => {
  unregister = registerColonyCityStage({
    els: (): ColonyCityStageEls | undefined => {
      const proxy = tileProxyEls(tile.value?.$el);
      const shadowNow = shadow.value;
      if (proxy === undefined || !shadowNow || !shadowNow.isConnected) {
        return undefined;
      }
      return {tile: proxy.tile, edge: proxy.edge, art: proxy.art, touch: proxy.touch, shadow: shadowNow};
    },
    cube: (): ColonyBuildStageEls | undefined => {
      const root = cubeRoot.value;
      const ringNow = ring.value;
      const cubeEl = cube.value?.$el;
      if (!root || !root.isConnected || !ringNow || !cubeEl) {
        return undefined;
      }
      const scene = cubeEl.querySelector<HTMLElement>('.player-cube__scene');
      const shadow = cubeEl.querySelector<HTMLElement>('.player-cube__shadow');
      const glow = cubeEl.querySelector<HTMLElement>('.player-cube__glow');
      if (scene === null || shadow === null || glow === null) {
        return undefined;
      }
      return {root, scene, shadow, glow, ring: ringNow};
    },
  });
});
onBeforeUnmount(() => {
  unregister?.();
});
</script>
