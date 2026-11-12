<template>
  <span v-if="shown" class="vp-ifroot" data-own @click="emit('open')">door</span>
</template>

<script setup vapor lang="ts">
// The shape of `console/ConsoleForecastDoor.vue`: the ROOT is a `v-if`, and the parent lets attributes fall through
// onto it (`data-unfold-late`, a class) — every time the root comes back.
defineProps<{shown: boolean}>();
const emit = defineEmits<{(e: 'open'): void}>();
</script>
