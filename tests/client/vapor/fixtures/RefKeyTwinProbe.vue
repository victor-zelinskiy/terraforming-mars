<template>
  <section class="twin" :data-side="panel" :data-count="count">
    <b ref="panel" class="twin__panel">panel</b>
    <i ref="count" class="twin__count">count</i>
  </section>
</template>

<script setup lang="ts">
// A TEMPLATE REF NAMED LIKE A REF-TYPED MEMBER THE TEMPLATE READS (RECIPES § 1 — the name collisions; R11). The Options
// API kept `$refs.panel` and the computed `panel` in two namespaces; `<script setup>` has one. The member keeps its
// name (the template reads it), the ref's const is `<key>El` — and the runtime must never write the element into the
// member: a computed would refuse it, a data field would silently BECOME the element.
import {computed, ref, useTemplateRef} from 'vue';

const props = defineProps<{side: string}>();
const panel = computed(() => props.side);
const count = ref(1);
const panelEl = useTemplateRef<HTMLElement>('panel');
const countEl = useTemplateRef<HTMLElement>('count');

function bump(): void {
  count.value++;
}

defineExpose({panel, count, panelEl, countEl, bump});
</script>
