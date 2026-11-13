<template>
  <section class="sel" :data-open="open">
    <p class="sel__label">{{ label }}</p>
  </section>
</template>

<script setup lang="ts">
// A `<script setup>` component on the virtual DOM whose PARENT reads two things through its ref (RECIPES.md § R11 ·
// R12): a member it exposes (`toggle`), and its root ELEMENT through `$el` — which the ref still answers at step A
// although nothing exposes it. `label` and `open` are NOT exposed: the parent's ref must not see them.
import {ref} from 'vue';

defineProps<{label: string}>();

const open = ref(false);
function toggle(): boolean {
  open.value = !open.value;
  return open.value;
}

defineExpose({toggle});
</script>
