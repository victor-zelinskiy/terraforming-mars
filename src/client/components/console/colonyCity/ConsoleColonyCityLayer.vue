<template>
  <!--
    A CITY IS LAID ON A COLONY TILE — the fixed, shell-level stage of the scene
    (consoleColonyCity / colonyCityDirector; Turmoil Redux TR22 Nova City).
    Mounted by the SHELL, never inside a teleported surface (a `position: fixed`
    stage inside a host zone resolves against that zone's containing block).

    ONE piece and ONE cube, both the board's own:
      · the tile is the shared proxy anatomy (ConsoleTileProxy — edge · art ·
        touch), sized to its measured seat, born INVISIBLE and materialized by
        the director above the seat;
      · the SHADOW is the layer's — it lies on the seat for the whole scene
        (wide and faint under the hanging piece, tight and dark in contact);
      · the owner's cube is the real PlayerCube inside a wrapper at the cube's
        own resting box, flown by the colony build's director (the same
        anatomy: scene · shadow · glow + the layer's impact ring).

    Pointer-inert; empty and free when nothing is landing.
  -->
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

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {colonyCityState, registerColonyCityStage} from '@/client/console/colonyCity/consoleColonyCity';
import {ColonyCityStageEls} from '@/client/console/colonyCity/colonyCityDirector';
import {ColonyBuildStageEls} from '@/client/console/colonyBuild/colonyBuildDirector';
import ConsoleTileProxy, {tileProxyEls} from '@/client/components/console/tilePlacement/ConsoleTileProxy.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';

export default defineComponent({
  name: 'ConsoleColonyCityLayer',
  components: {ConsoleTileProxy, PlayerCube},
  data() {
    return {
      colonyCityState,
      unregister: undefined as (() => void) | undefined,
    };
  },
  computed: {
    cubeColor(): Color | undefined {
      return colonyCityState.landing?.tile.color;
    },
    /** The cube's footprint in real screen px: the measured box IS the token's box (born at its landing size). */
    cubeSize(): number {
      return colonyCityState.cubeRect?.h ?? 0;
    },
    cubeWrapStyle(): Record<string, string> {
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
    },
    /** The impact ring: an ellipse seated at the cube's BASE line, sized off the cube — the build layer's own recipe. */
    ringStyle(): Record<string, string> {
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
    this.unregister = registerColonyCityStage({
      els: (): ColonyCityStageEls | undefined => {
        const proxy = tileProxyEls((this.$refs.tile as {$el?: HTMLElement} | null | undefined)?.$el);
        const shadow = this.$refs.shadow as HTMLElement | null | undefined;
        if (proxy === undefined || !shadow || !shadow.isConnected) {
          return undefined;
        }
        return {tile: proxy.tile, edge: proxy.edge, art: proxy.art, touch: proxy.touch, shadow};
      },
      cube: (): ColonyBuildStageEls | undefined => {
        const root = this.$refs.cubeRoot as HTMLElement | null | undefined;
        const ring = this.$refs.ring as HTMLElement | null | undefined;
        const cubeEl = (this.$refs.cube as {$el?: HTMLElement} | null | undefined)?.$el;
        if (!root || !root.isConnected || !ring || !cubeEl) {
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
