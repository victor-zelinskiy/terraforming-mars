<template>
  <div class="vp-order">
    <i v-show="!open" class="vp-order__early"></i>
    <Transition :css="false" @leave="onLeave">
      <b v-if="open" class="vp-order__late"></b>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/*
 * THE VIRTUAL-DOM TWIN of `VaporShowOrderProbe.vue` (vaporCapability.spec.ts): the same template, not Vapor.
 */
defineOptions({name: 'SetupShowOrderProbe'});
defineProps<{open: boolean}>();
const emit = defineEmits<{left: [earlyDisplay: string]}>();

function onLeave(el: Element, done: () => void): void {
  emit('left', el.parentElement?.querySelector<HTMLElement>('.vp-order__early')?.style.display ?? '?');
  done();
}
</script>
