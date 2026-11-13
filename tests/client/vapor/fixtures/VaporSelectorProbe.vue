<template>
  <div class="vp-sel">
    <div v-if="tip !== null" class="vp-sel__tip">
      <template v-if="safe">
        <p v-for="row in rows" :key="row" class="vp-sel__row" :class="{'vp-sel__row--hot': row === tip?.color}">{{ row }}</p>
      </template>
      <template v-else>
        <p v-for="row in rows" :key="row" class="vp-sel__row" :class="{'vp-sel__row--hot': row === tip.color}">{{ row }}</p>
      </template>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * A `v-for` row compared with an OUTER value under a `v-if` that guards that value — the shape the Vapor compiler
 * lifts into a synchronous SELECTOR (vaporCapability.spec.ts § the selector; scripts/vapor/selector-audit.mjs).
 * `safe` picks the null-safe spelling of the same comparison.
 */
import {ref} from 'vue';

defineOptions({name: 'VaporSelectorProbe'});
defineProps<{safe: boolean}>();

const rows = ['a', 'b'];
const tip = ref<{color: string} | null>({color: 'a'});
function close(): void {
  tip.value = null;
}
function open(color: string): void {
  tip.value = {color};
}
defineExpose({close, open});
</script>
