<template>
  <button class="leaf" :data-label="label" @click="pick">{{ label }}:{{ count }}</button>
</template>

<script setup vapor lang="ts">
/* A Vapor LEAF for vaporTestLayer.spec.ts: a prop, an event, a binding, one exposed member. */
import {ref} from 'vue';

defineOptions({name: 'LayerLeaf'});
const props = defineProps<{label: string}>();
const emit = defineEmits<{(e: 'pick', label: string): void}>();

const count = ref(0);
function pick(): void {
  emit('pick', props.label);
}
function bump(): void {
  count.value++;
}
defineExpose({bump});
</script>
