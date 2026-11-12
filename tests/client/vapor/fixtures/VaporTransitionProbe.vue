<template>
  <div class="vp-tr">
    <Transition name="vp-fade" @before-enter="note('before-enter')" @after-enter="note('after-enter')" @before-leave="note('before-leave')" @after-leave="note('after-leave')">
      <div v-if="state.edge !== ''" :key="state.nonce" class="vp-tr__notice" :class="'vp-tr__notice--' + state.edge">{{ state.edge }}</div>
    </Transition>
    <TransitionGroup name="vp-list" tag="ul" class="vp-tr__list">
      <li v-for="row in state.rows" :key="row" class="vp-tr__row">{{ row }}</li>
    </TransitionGroup>
  </div>
</template>

<script setup vapor lang="ts">
// The shape of `marsbot/BotReviewEdgeNotice.vue`: a module's reactive state, a keyed `v-if` under a `<Transition>`.
const props = defineProps<{state: {edge: string, nonce: number, rows: Array<string>}, log: Array<string>}>();

function note(hook: string): void {
  props.log.push(hook);
}
</script>
