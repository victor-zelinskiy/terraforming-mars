<template>
  <div class="card-party">
  <span :class="classes"></span>
  </div>
</template>

<script setup vapor lang="ts">

import {computed} from 'vue';

defineOptions({name: 'CardParty'});
const props = defineProps({
  party: {
    required: true,
    type: String,
  },
  size: {
    required: false,
    default: 'card',
    type: String as () => 'card' | 'req',
  },
});

const classes = computed((): string => {
  const p = props.party.toLowerCase().replace(' ', '-');
  const suffix = props.size === 'req' ? '-req' : '';
  return `card-party--${p}${suffix}`;
});

</script>

