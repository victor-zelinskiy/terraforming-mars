<template>
  <div v-if="tracks" class="pathfinders_cont">
    <div class="track track-background-venus" v-if="tracks.venus >= 0">
      <div class="track-tag track-tag-venus"></div>
      <table class="track-venus">
        <PlanetaryTrack type='risingPlayer' :val="tracks.venus" :rewards="PLANETARY_TRACKS.venus" :gameOptions="gameOptions" />
        <PlanetaryTrack type='everyone' :val="tracks.venus" :rewards="PLANETARY_TRACKS.venus" :gameOptions="gameOptions" />
      </table>
    </div>

    <div class="track track-background-earth">
      <div class="track-tag track-tag-earth"></div>
      <table class="track-earth">
        <PlanetaryTrack type='risingPlayer' :val="tracks.earth" :rewards="PLANETARY_TRACKS.earth" :gameOptions="gameOptions" />
        <PlanetaryTrack type='everyone' :val="tracks.earth" :rewards="PLANETARY_TRACKS.earth" :gameOptions="gameOptions" />
      </table>
    </div>

    <div class="track track-background-mars">
      <div class="track-tag track-tag-mars"></div>
      <table class="track-mars">
        <PlanetaryTrack type='risingPlayer' :val="tracks.mars" :rewards="PLANETARY_TRACKS.mars" :gameOptions="gameOptions" />
        <PlanetaryTrack type='everyone' :val="tracks.mars" :rewards="PLANETARY_TRACKS.mars" :gameOptions="gameOptions" />
      </table>
    </div>

    <div class="track track-background-jovian">
      <div class="track-tag track-tag-jovian"></div>
      <table class="track-jovian">
        <PlanetaryTrack type='risingPlayer' :val="tracks.jovian" :rewards="PLANETARY_TRACKS.jovian" :gameOptions="gameOptions" />
        <PlanetaryTrack type='everyone' :val="tracks.jovian" :rewards="PLANETARY_TRACKS.jovian" :gameOptions="gameOptions" />
      </table>
    </div>

    <div class="track track-background-moon" v-if="tracks.moon >= 0">
      <div class="track-tag track-tag-moon"></div>
      <table class="track-moon">
        <PlanetaryTrack type='risingPlayer' :val="tracks.moon" :rewards="PLANETARY_TRACKS.moon" :gameOptions="gameOptions" />
        <PlanetaryTrack type='everyone' :val="tracks.moon" :rewards="PLANETARY_TRACKS.moon" :gameOptions="gameOptions" />
      </table>
    </div>

  </div>
</template>

<script setup vapor lang="ts">

import {GameOptionsModel} from '@/common/models/GameOptionsModel';
import {PathfindersModel} from '@/common/models/PathfindersModel';
import PlanetaryTrack from '@/client/components/pathfinders/PlanetaryTrack.vue';
// The template reads the tracks' table straight off this import, by its own name.
import {PLANETARY_TRACKS} from '@/common/pathfinders/PlanetaryTracks';

defineOptions({name: 'PlanetaryTracks'});
defineProps({
  tracks: {
    type: Object as () => PathfindersModel,
  },
  gameOptions: {
    type: Object as () => GameOptionsModel,
    required: true,
  },
});

</script>

