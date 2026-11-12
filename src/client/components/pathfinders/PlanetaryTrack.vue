<template>
    <tr>
      <td><div :class="iconClass"></div></td>
      <td v-for="idx in range" :key="idx" :class="getClass(idx)">
        <planetary-track-rewards :type="type" v-if="idx <= rewards.spaces.length && rewards.spaces[idx] !== undefined" :rewards="rewards.spaces[idx]" :gameOptions="gameOptions" />
      </td>
    </tr>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue';
// The template's `range` is the ref below — the helper comes in under a name of its own.
import {range as rangeOf} from '@/common/utils/utils';
import {PlanetaryTrack as Track} from '@/common/pathfinders/PlanetaryTrack';
import {GameOptionsModel} from '@/common/models/GameOptionsModel';
import PlanetaryTrackRewards from './PlanetaryTrackRewards.vue';

defineOptions({name: 'PlanetaryTrack'});
const props = defineProps({
  val: {
    type: Number,
    required: true,
  },
  type: {
    type: String as () => 'risingPlayer' | 'everyone' | 'mostTags',
    required: true,
  },
  rewards: {
    type: Object as () => Track,
    required: true,
  },
  gameOptions: {
    type: Object as () => GameOptionsModel,
    required: true,
  },
});

const range = ref(rangeOf(23));
const iconClass = computed((): string => {
  switch (props.type) {
  case 'risingPlayer': return 'track-icon track-icon--rising-player';
  case 'everyone': return 'track-icon track-icon--everyone';
  default: return '';
  }
});
function getClass(idx: number): String {
  return (idx === props.val) ? 'highlight' : '';
}
</script>
