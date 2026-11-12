<template>
  <div class="vp-refs" ref="root">
    <i v-for="n in count" :key="n" ref="rows" class="vp-refs__row">{{ n }}</i>
    <b :ref="remember" class="vp-refs__fn">fn</b>
    <OptionsContextChild ref="vdomChild"/>
    <VaporBasics ref="vaporChild" label="inner" :items="[]" :on="false" html="" tag="u"/>
  </div>
</template>

<script setup vapor lang="ts">
// TEMPLATE REFS in a Vapor component (RECIPES.md § R11 · R12): its own root, a ref inside `v-for` (an ARRAY), a function
// ref, a ref of a virtual-DOM (Options) child — its public instance, methods and all — and a ref of a Vapor child (what
// it `defineExpose`d, nothing else). `provide` from here reaches the Options child's `inject` (§ R16).
import {onMounted, provide, useTemplateRef} from 'vue';
import OptionsContextChild from './OptionsContextChild.vue';
import VaporBasics from './VaporBasics.vue';

type Seen = {rootTag?: string, rows?: () => Array<string>, fn?: Array<string>, pressVdom?: () => number, vaporKeys?: Array<string>, bumpVapor?: () => void};
const props = defineProps<{count: number, seen: Seen}>();

provide('probe-theme', 'from-vapor');
const root = useTemplateRef<HTMLElement>('root');
const rows = useTemplateRef<Array<HTMLElement>>('rows');
const vdomChild = useTemplateRef<{press(): number}>('vdomChild');
const vaporChild = useTemplateRef<{bump(): void}>('vaporChild');
const fnCalls: Array<string> = [];
function remember(el: unknown): void {
  fnCalls.push(el === null ? 'null' : (el as Element).tagName);
}

onMounted(() => {
  props.seen.rootTag = root.value?.tagName;
  props.seen.rows = () => (rows.value ?? []).map((el) => el.textContent ?? '');
  props.seen.fn = fnCalls;
  props.seen.pressVdom = () => vdomChild.value!.press();
  props.seen.vaporKeys = Object.keys(vaporChild.value ?? {}).sort();
  props.seen.bumpVapor = () => vaporChild.value!.bump();
});
</script>
