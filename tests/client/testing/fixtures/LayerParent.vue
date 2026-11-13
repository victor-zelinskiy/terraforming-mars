<template>
  <section class="parent">
    <Leaf v-for="item in items" :key="item" :label="item" @pick="onPick" />
    <transition name="layer-fade">
      <p v-if="open" class="parent__note">note</p>
    </transition>
    <teleport to="body">
      <div class="parent__far"><Leaf label="far" /></div>
    </teleport>
    <component :is="dynamic" label="dyn" />
    <Chassis><slot /></Chassis>
    <span class="parent__picked">{{ picked }}</span>
  </section>
</template>

<script setup vapor lang="ts">
/*
 * A Vapor PARENT for vaporTestLayer.spec.ts — every way a Vapor render creates a component: a list of children under
 * a LOCAL binding name that is not the child's own (`Leaf` for `LayerLeaf`), a transition, a teleport with a child
 * inside, `<component :is>`, and the host's slot FORWARDED into another child.
 */
import {ref, shallowRef} from 'vue';
import Leaf from './LayerLeaf.vue';
import Chassis from './LayerChassis.vue';

defineOptions({name: 'LayerParent'});
withDefaults(defineProps<{items?: ReadonlyArray<string>, open?: boolean}>(), {items: () => [], open: false});

const picked = ref('');
const dynamic = shallowRef(Leaf);
function onPick(label: string): void {
  picked.value = label;
}
</script>
