<template>
  <section class="vp-ctx" :data-theme="theme">
    <header v-bind="attrs" class="vp-ctx__inner" @click="$emit('picked', theme)">
      <span v-if="$slots.extra" class="vp-ctx__has">has extra</span>
      <slot name="extra"></slot>
    </header>
    <i class="vp-ctx__updates" :data-n="n">{{ updates.join(',') }}</i>
    <OptionsThrows v-if="armed" class="vp-ctx__thrower"/>
    <em class="vp-ctx__caught">{{ caught }}</em>
  </section>
</template>

<script setup vapor lang="ts">
// CONTEXT in a Vapor component (RECIPES.md § R9 · R13 · R16): `inject` of what a virtual-DOM ancestor provided,
// `inheritAttrs: false` + `useAttrs()` bound by hand, `$slots` / `$emit` in the template, the update hooks, a `post`
// watcher that reads the DOM its own change wrote, `onErrorCaptured` over a virtual-DOM child.
import {inject, nextTick, onBeforeUpdate, onErrorCaptured, onUpdated, ref, useAttrs, watch} from 'vue';
import OptionsThrows from './OptionsThrows.vue';

defineOptions({inheritAttrs: false});
const props = defineProps<{n: number, armed: boolean, seen: {hooks: Array<string>, post?: string, captured?: string}}>();
defineEmits<{picked: [theme: string]}>();

const theme = inject<string>('probe-theme', 'none');
const attrs = useAttrs();
const updates = ref<Array<number>>([]);
const caught = ref('');

onBeforeUpdate(() => props.seen.hooks.push('beforeUpdate'));
onUpdated(() => props.seen.hooks.push('updated'));
watch(() => props.n, (n) => {
  updates.value = [...updates.value, n];
});
watch(() => props.n, () => {
  props.seen.post = document.querySelector('.vp-ctx__updates')?.getAttribute('data-n') ?? undefined;
}, {flush: 'post'});
onErrorCaptured((error) => {
  props.seen.captured = (error as Error).message;
  void nextTick(() => {
    caught.value = (error as Error).message;
  });
  return false;
});
</script>
