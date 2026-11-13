<template>
  <i class="frag__a">a</i>
  <b class="frag__b">{{ tail }}</b>
</template>

<script setup vapor lang="ts">
/* A Vapor component of TWO roots (vaporTestLayer.spec.ts: a fragment's element, text and finders). */
defineOptions({name: 'LayerFragment'});
withDefaults(defineProps<{tail?: string}>(), {tail: 'b'});
</script>
