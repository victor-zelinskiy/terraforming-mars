<template>
  <div :class="wrapper">
    <div class="underground-token-background" :class="style + ' ' + border"></div>
    <div :class="style + ' ' + tokenClass"></div>
    <div :class="shelter"></div>
  </div>
</template>

<script setup vapor lang="ts">

import {computed} from 'vue';
import {ClaimedToken} from '@/common/underworld/UnderworldPlayerData';

defineOptions({name: 'UndergroundToken'});
const props = defineProps({
  token: {
    type: Object as () => ClaimedToken,
    required: true,
  },
  location: {
    type: String as () => 'board' | 'player-home' | 'tag-count',
    required: true,
  },
});

const wrapper = computed((): string => {
  return 'underground-token-wrapper--' + props.location;
});
const border = computed((): string => {
  return props.token.active ? 'underground-token-border' : '';
});
const style = computed((): string => {
  return 'underground-token-style--' + props.location;
});
const tokenClass = computed((): string => {
  return 'underground-token--' + props.token.token;
});
const shelter = computed((): string => {
  return props.token.shelter ? 'underground-token-shelter' : '';
});
</script>
