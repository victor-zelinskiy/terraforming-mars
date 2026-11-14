<template>
  <div class="vp-mark">
    <component :is="startMark" />
    <b v-if="on" class="vp-mark__leaf">x</b>
    <component :is="endMark" />
  </div>
</template>

<script setup vapor lang="ts">
/*
 * `<component :is>` GIVEN A DOM NODE (vaporCapability.spec.ts): the node itself is mounted where the tag stands. Two
 * COMMENT nodes the component created bracket a `v-if` — a handle on a place in the DOM that is not an element (what
 * `ConsoleTeleport` keeps around its teleport: a `ref` on a Vapor `<Teleport>` is `null`).
 */
import type {Component} from 'vue';

defineOptions({name: 'VaporNodeMarkProbe'});
defineProps<{on: boolean}>();

const start = document.createComment('start');
const end = document.createComment('end');
const startMark = start as unknown as Component;
const endMark = end as unknown as Component;

defineExpose({start, end});
</script>
