<template>
  <div class="vp-order">
    <i v-show="!open" class="vp-order__early"></i>
    <Transition :css="false" @leave="onLeave">
      <b v-if="open" class="vp-order__late"></b>
    </Transition>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * `v-show` AND A LATER SIBLING'S LEAVE HOOK, ONE MUTATION (vaporCapability.spec.ts): `open` going false shows the
 * early sibling and removes the late one. The hook reports what the early sibling's `display` is at its turn.
 * (`SetupShowOrderProbe.vue` is the same template on the virtual DOM.)
 */
defineOptions({name: 'VaporShowOrderProbe'});
defineProps<{open: boolean}>();
const emit = defineEmits<{left: [earlyDisplay: string]}>();

function onLeave(el: Element, done: () => void): void {
  emit('left', el.parentElement?.querySelector<HTMLElement>('.vp-order__early')?.style.display ?? '?');
  done();
}
</script>
