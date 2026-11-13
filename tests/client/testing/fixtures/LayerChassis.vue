<template>
  <div class="chassis"><slot /></div>
</template>

<script setup vapor lang="ts">
/* A Vapor component that only RECEIVES a slot (vaporTestLayer.spec.ts stubs it with a virtual-DOM one). */
defineOptions({name: 'LayerChassis'});
</script>
