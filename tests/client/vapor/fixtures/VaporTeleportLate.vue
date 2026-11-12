<template>
  <div class="vp-late">
    <Teleport v-if="armed" :to="to" :disabled="disabled">
      <b class="vp-late__content">{{ n }}</b>
    </Teleport>
  </div>
</template>

<script setup vapor lang="ts">
// A Vapor `<Teleport>` whose TARGET IS NOT THERE YET (RECIPES.md § R18): the facts `ConsoleTeleport`'s rewrite stands
// on. The virtual-DOM teleport mounted nothing into an absent target and threw on the next patch — the whole reason
// `console/foundation/ConsoleTeleport.vue` exists; this probe says what the Vapor one does.
defineProps<{to: string, disabled: boolean, n: number, armed: boolean}>();
</script>
