<template>
  <div class="vp-hosts">
    <OptionsChild :label="label" @picked="onPicked">
      <template #default="{value}"><b class="vp-hosts__slot">slot {{ value }}</b></template>
    </OptionsChild>
    <span class="vp-hosts__picked">{{ picked }}</span>
  </div>
</template>

<script setup vapor lang="ts">
// A Vapor PARENT over a virtual-DOM (Options API) CHILD — every wave of the rework has this shape at its edge.
import {ref} from 'vue';
import OptionsChild from './OptionsChild.vue';

defineProps<{label: string}>();
const picked = ref('');

function onPicked(value: string): void {
  picked.value = value;
}
</script>
