<template>
  <div v-if="space !== undefined" :class="mainClass" :data_space_id="space.id">
    <board-space-tile
      :space="space"
      :aresExtension="aresExtension"
      :tileView="tileView"
      :placementCleared="placementCleared"
    ></board-space-tile>
    <div class="board-space-text" v-if="text" v-i18n>{{ text }}</div>
    <bonus :bonus="space.bonus" v-if="showBonus"></bonus>
    <template v-if="tileView === 'coords'">
      <div class="board-space-coords">{{ getSpaceName(space.id) }}</div>
    </template>
    <template v-if="tileView === 'show'">
      <player-cube
        v-if="space.color !== undefined && cubePhase !== 'hidden'"
        class="board-owner-cube"
        :color="space.color"
        :size="12"
        :animate-in="cubePhase === 'dropping'"></player-cube>
      <template v-if="space.gagarin !== undefined">
        <div v-if="space.gagarin === 0" class='gagarin'></div>
        <div v-else class='gagarin visited'></div>
      </template>
      <template v-if="space.cathedral === true">
        <div class='board-cube--cathedral'></div>
      </template>
      <template v-if="space.nomads === true">
        <div class='board-cube--nomad'></div>
      </template>
      <underground-token v-if="claimedToken !== undefined" :token="claimedToken" location="board"></underground-token>
      <div v-if="space.excavator !== undefined" class="underground-excavator" :class="'underground-excavator--' + space.excavator"></div>
      <div v-if="space.spaceType === SpaceType.DEFLECTION_ZONE" class="board-space-type-deflection-zone"></div>
    </template>
    <div class="board-log-highlight" :data_log_highlight_id="space.id"></div>
    </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import Bonus from '@/client/components/Bonus.vue';
import BoardSpaceTile from '@/client/components/board/BoardSpaceTile.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import UndergroundToken from '@/client/components/underworld/UndergroundToken.vue';
import {TileView} from '@/client/components/board/TileView';
import {SpaceModel} from '@/common/models/SpaceModel';
import {ClaimedToken} from '@/common/underworld/UnderworldPlayerData';
import {getSpaceName} from '@/common/boards/spaces';
import {SpaceType} from '@/common/boards/SpaceType';
import {placementRenderState} from '@/client/components/board/placementRenderState';
import {observeCube, cubePhase as cubePhaseForSpace, CubePhase} from '@/client/components/board/cubeDropState';
export default defineComponent({
  name: 'board-space',
  props: {
    space: {
      type: Object as () => SpaceModel,
      required: true,
    },
    text: {
      type: String,
      default: '',
    },
    aresExtension: {
      type: Boolean,
    },
    tileView: {
      type: String as () => TileView,
      required: true,
    },
  },
  data() {
    return {};
  },
  components: {
    'bonus': Bonus,
    'board-space-tile': BoardSpaceTile,
    'player-cube': PlayerCube,
    'underground-token': UndergroundToken,
  },
  watch: {
    // Drive the cube-drop state machine: on mount (immediate) and whenever this
    // space gains/loses an owner. The cube is held hidden during the tile
    // placement animation and dropped in only after it finishes.
    'space.color': {
      immediate: true,
      handler(): void {
        observeCube(this.space);
      },
    },
  },
  computed: {
    mainClass(): string {
      let css = 'board-space board-space-' + this.space?.id.toString();
      css += ' board-space-selectable';
      return css;
    },
    // True while this occupied cell is a remove-and-replace placement target:
    // its tile graphic is suppressed and its placement bonus is shown instead.
    placementCleared(): boolean {
      return placementRenderState.hiddenTiles.has(this.space.id);
    },
    showBonus(): boolean {
      return this.space.tileType === undefined || this.tileView === 'hide' || this.placementCleared;
    },
    // Cube reveal phase for this space (`hidden` during the tile placement
    // animation, `dropping` while the cube lands, `rest` otherwise). PlayerCube
    // reads the `symbol_overlay` preference itself for the colour-blind glyph.
    cubePhase(): CubePhase {
      return cubePhaseForSpace(this.space.id);
    },
    claimedToken(): ClaimedToken | undefined {
      if (this.space.undergroundResource === undefined) {
        return undefined;
      }
      return {token: this.space.undergroundResource, shelter: false, active: false};
    },

    getSpaceName(): typeof getSpaceName {
      return getSpaceName;
    },
    SpaceType(): typeof SpaceType {
      return SpaceType;
    },
  },
});

</script>

