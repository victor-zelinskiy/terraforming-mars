<template>
  <u>{{ boom }}</u>
</template>

<script lang="ts">
// A virtual-DOM child whose `mounted` hook throws — what an ancestor's `errorCaptured` exists for.
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'OptionsThrows',
  data() {
    return {boom: 'armed'};
  },
  mounted() {
    throw new Error('the child threw');
  },
});
</script>
