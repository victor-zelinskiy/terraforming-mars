<template>
  <!--
    COLONY-BUILD HERO STAGE — the fixed, app-level layer of the "my cube drops
    into the colony slot and the one-time build bonus is lifted out of the
    cell" scene (consoleColonyBuild / colonyBuildDirector). Mounted for the
    WHOLE transaction, so the drop survives any surface shuffling beneath it.

    Anatomy:
     - the CUBE proxy is a twin of the real filled-cell owner cube (the same
       player-hue plate + relief), placed at the captured slot rect; the
       director drops it in and settles it, then crossfades onto the real cube;
     - the GLYPH proxy (a resource build bonus only) is the resource sprite the
       chip wave will carry, placed at the captured glyph rect; the director
       rises it off the slot (displaced by the arriving cube), hovers it, then
       hands it off to its chip on the shared ConsoleResourceTransferLayer.

    Pointer-inert, empty & free when nothing is building. All motion lives in
    the director.
  -->
  <div v-if="colonyBuildState.active" class="con-colonybuild" aria-hidden="true">
    <div v-if="colonyBuildState.slotRect !== undefined"
         ref="cube"
         class="con-colonybuild__cube"
         :class="cubeColorClass"
         :style="rectStyle(colonyBuildState.slotRect)"></div>
    <div v-if="colonyBuildState.hasGlyph && colonyBuildState.glyphRect !== undefined && glyphIconClass !== ''"
         ref="glyph"
         class="con-colonybuild__glyph"
         :class="{'con-colonybuild__glyph--production': isProduction}"
         :style="rectStyle(colonyBuildState.glyphRect)">
      <i class="con-colonybuild__glyph-icon" :class="glyphIconClass"></i>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {colonyBuildState, registerColonyBuildStage} from '@/client/console/colonyBuild/consoleColonyBuild';
import {ColonyBuildStageEls} from '@/client/console/colonyBuild/colonyBuildDirector';
import {BuildRect} from '@/client/console/colonyBuild/colonyBuildModel';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {Resource} from '@/common/Resource';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';

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
    /** The build bonus's resource (from the colony manifest) — the sprite the
     *  pre-lift glyph shows + the chip carries. */
    buildResourceKey(): string {
      const name = colonyBuildState.colonyName;
      if (name === '') {
        return '';
      }
      try {
        const r = getColony(name as ColonyName).build.resource;
        const value = Array.isArray(r) ? r[0] : r;
        return value !== undefined ? (value as Resource).toString() : '';
      } catch {
        return '';
      }
    },
    isProduction(): boolean {
      const name = colonyBuildState.colonyName;
      if (name === '') {
        return false;
      }
      try {
        return getColony(name as ColonyName).build.type === ColonyBenefit.GAIN_PRODUCTION;
      } catch {
        return false;
      }
    },
    glyphIconClass(): string {
      return iconClassFor(this.buildResourceKey);
    },
  },
  methods: {
    /** The captured live rect IS the resting pose (the director only transforms). */
    rectStyle(rect: BuildRect): Record<string, string> {
      return {
        left: `${Math.round(rect.x)}px`,
        top: `${Math.round(rect.y)}px`,
        width: `${Math.round(rect.w)}px`,
        height: `${Math.round(rect.h)}px`,
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
        const glyph = this.$refs.glyph as HTMLElement | undefined;
        return {
          cube,
          glyph: glyph !== undefined && glyph.isConnected ? glyph : undefined,
        };
      },
    });
  },
  beforeUnmount() {
    this.unregister?.();
  },
});
</script>
