<template>
  <i class="vp-flow" :data-fired="fired" ref="root">flow</i>
</template>

<script setup vapor lang="ts">
// What every converted console component does: its waits live in a scope that ends with it (`useFlowScope`), and it
// reaches its own element through a template ref.
import {getCurrentInstance, getCurrentScope, onMounted, onUnmounted, ref, useTemplateRef} from 'vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {FlowScope} from '@/client/console/kernel/flowScope';

const props = defineProps<{seen: {flow?: FlowScope, instance?: unknown, scope?: unknown, rootTag?: string, hooks: Array<string>}}>();
const fired = ref(0);
const root = useTemplateRef<HTMLElement>('root');

const flow = useFlowScope('a-vapor-leaf');
props.seen.flow = flow;
props.seen.instance = getCurrentInstance();
props.seen.scope = getCurrentScope();
flow.after(60_000, 'a beat that must not outlive the component', () => fired.value++);

onMounted(() => {
  props.seen.hooks.push('mounted');
  props.seen.rootTag = root.value?.tagName;
});
onUnmounted(() => props.seen.hooks.push('unmounted'));
</script>
