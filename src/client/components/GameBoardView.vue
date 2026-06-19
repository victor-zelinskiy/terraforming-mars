<!-- Common widgets between player and spectator views -->
<template>
  <a name="board" class="player_home_anchor hotkey-target"></a>
  <board
    :spaces="game.spaces"
    :expansions="game.gameOptions.expansions"
    :venusScaleLevel="game.venusScaleLevel"
    :boardName ="game.gameOptions.boardName"
    :oceans_count="game.oceans"
    :oxygen_level="game.oxygenLevel"
    :temperature="game.temperature"
    :altVenusBoard="game.gameOptions.altVenusBoard"
    :scaleBonusClaims="game.scaleBonusClaims"
    :players="players"
    :aresData="game.aresData"
    :tileView="tileView"
    @toggleTileView="$emit('toggleTileView')"
    id="shortkey-board"
  />

  <template v-if="game.turmoil">
    <a class="hotkey-target"></a>
    <turmoil :turmoil="game.turmoil"/>
  </template>

  <template v-if="game.moon">
    <a class="hotkey-target"></a>
    <MoonBoard :model="game.moon" :tileView="tileView" id="shortkey-moonBoard"/>
  </template>

  <template v-if="game.gameOptions.expansions.pathfinders">
    <a class="hotkey-target"></a>
    <PlanetaryTracks :tracks="game.pathfinders" :gameOptions="game.gameOptions"/>
  </template>

  <!--
    vize1215 fork: legacy inline `<Milestones>` + `<Awards>` strip
    removed entirely. The fork ships dedicated bottom-bar overlays
    (MilestonesOverlay / AwardsOverlay mounted from PlayerHome.vue)
    that replace this list with the new sci-fi presentation, and the
    legacy strip was leaking into the legacy-UI dev overlay where
    we don't want it either. The Vue components Milestones.vue /
    Awards.vue are kept in the repo for the upstream-merge surface
    but are no longer mounted anywhere on the game screen.
  -->
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import {GameModel} from '@/common/models/GameModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import Board from '@/client/components/Board.vue';
import Turmoil from '@/client/components/turmoil/Turmoil.vue';
import MoonBoard from '@/client/components/moon/MoonBoard.vue';
import PlanetaryTracks from '@/client/components/pathfinders/PlanetaryTracks.vue';
import {TileView} from './board/TileView';

export default defineComponent({
  name: 'GameBoardView',
  props: {
    game: {
      type: Object as () => GameModel,
      required: true,
    },
    tileView: {
      type: String as () => TileView,
      required: true,
    },
    players: {
      type: Array as PropType<ReadonlyArray<PublicPlayerModel>>,
      required: true,
    },
  },
  emits: ['toggleTileView'],
  components: {
    'board': Board,
    'turmoil': Turmoil,
    MoonBoard,
    PlanetaryTracks,
  },
});
</script>
