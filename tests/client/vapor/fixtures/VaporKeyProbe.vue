<template>
  <div ref="unread" class="vp-key" :data-live="live" :data-order="order.join('>')" :data-seated="seatedNow">
    <span :key="'in:' + nonce" class="vp-key__node">{{ nonce }}</span>
    <i v-for="(card, i) in cards" :key="card" :ref="(el) => seat(el, i)" class="vp-key__card">{{ card }}</i>
    <Transition name="vp-swap">
      <b :key="text" class="vp-key__swap">{{ text }}</b>
    </Transition>
  </div>
</template>

<script setup vapor lang="ts">
// THREE THINGS A CONVERSION MEETS THAT ARE NOT OPTION BLOCKS (RECIPES.md § R0 · R6 · R16):
//  · `:key` on a plain element as a FORCED RE-MOUNT (a flip restarts its animation by re-keying its node), and a keyed
//    child of a `<Transition>` with no `v-if` (the workspace header's subject swap — old and new coexist);
//  · `inject` of a REF a provider gave: the Composition API hands over the ref itself (the Options API unwrapped it);
//  · two watchers of two DIFFERENT props that one parent update moves — the order they run in;
//  · a function ref inside a keyed `v-for` whose every key changes at once, and a string ref nobody reads (`unread`).
import {computed, inject, ref, watch} from 'vue';
import type {Ref} from 'vue';

const props = defineProps<{nonce: number, text: string, a: number, b: number, cards: Array<string>}>();
const liveRef = inject<Ref<string>>('probe-live');
const live = liveRef;
const order = ref<Array<string>>([]);
watch(() => props.b, () => order.value.push('b'));
watch(() => props.a, () => order.value.push('a'));
// A FUNCTION ref inside a keyed `v-for` (the deal layer's proxies): the index-aligned registry a director reads.
const seats = ref<Array<Element | null>>([]);
function seat(el: unknown, index: number): void {
  seats.value[index] = el as Element | null;
}
const seatedNow = computed(() => seats.value.filter((el): el is Element => el !== null).map((el) => el.textContent ?? '').join(','));
</script>
