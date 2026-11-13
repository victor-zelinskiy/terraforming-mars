<template>
  <div class="rewards_cont">
    <span v-if="mostTags" class="track-icon track-icon--most-tags"></span>
    <planetary-track-reward v-for="(reward, idx) in myReward" :reward="reward" :key="idx" :gameOptions="gameOptions"/>
  </div>
</template>

<script setup vapor lang="ts">

import {computed} from 'vue';
import {GameOptionsModel} from '@/common/models/GameOptionsModel';
import {PlanetaryTrackSpace} from '@/common/pathfinders/PlanetaryTrack';
import PlanetaryTrackReward from './PlanetaryTrackReward.vue';
import {Reward} from '@/common/pathfinders/Reward';

defineOptions({name: 'PlanetaryTrackRewards'});
const props = defineProps({
  rewards: {
    type: Object as () => PlanetaryTrackSpace,
    required: true,
  },
  type: {
    type: String as () => 'risingPlayer' | 'everyone' | 'mostTags',
  },
  gameOptions: {
    type: Object as () => GameOptionsModel,
    required: true,
  },
});

const myReward = computed((): ReadonlyArray<Reward> => {
  switch (props.type) {
  case 'risingPlayer':
    return props.rewards.risingPlayer;
  case 'everyone':
    return props.rewards.everyone.concat(props.rewards.mostTags);
  // case 'mostTags': There is no most tags track in this view.
  //   return props.rewards.mostTags;
  default:
    return [];
  }
});
const mostTags = computed((): boolean => {
  return props.type === 'everyone' && props.rewards.mostTags.length > 0;
});

</script>

