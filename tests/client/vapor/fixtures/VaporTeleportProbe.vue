<template>
  <div class="vp-tp">
    <Teleport :to="to" :disabled="disabled">
      <div class="vp-tp__content" :data-n="n">
        <slot>fallback</slot>
        <slot name="foot" :n="n"></slot>
      </div>
    </Teleport>
  </div>
</template>

<script setup vapor lang="ts">
// The embedded-step architecture stands on ONE instance teleported into its host's zone (`<Teleport :to :disabled>`).
defineProps<{to: string, disabled: boolean, n: number}>();
</script>
