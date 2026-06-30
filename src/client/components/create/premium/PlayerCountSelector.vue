<template>
  <div class="pc-selector" role="radiogroup" :aria-label="$t('Number of players')" @mouseenter="focusInfo" @focusin="focusInfo">
    <button
      v-for="(n, i) in counts"
      :key="n"
      type="button"
      role="radio"
      class="pc-selector__chip"
      :class="{'pc-selector__chip--active': n === modelValue}"
      :aria-checked="n === modelValue ? 'true' : 'false'"
      :tabindex="tabindexFor(n, i)"
      :ref="(el) => setRef(el, i)"
      @click="select(n)"
      @keydown="onKey($event, i)"
    >{{ n }}</button>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PLAYER_COUNT_MIN, PLAYER_COUNT_MAX, setInfoFocus} from './createGameState';

export default defineComponent({
  name: 'PlayerCountSelector',
  props: {
    modelValue: {type: Number, required: true},
  },
  emits: ['update:modelValue'],
  data() {
    return {els: [] as Array<HTMLButtonElement>};
  },
  computed: {
    counts(): Array<number> {
      const out: Array<number> = [];
      for (let n = PLAYER_COUNT_MIN; n <= PLAYER_COUNT_MAX; n++) {
        out.push(n);
      }
      return out;
    },
  },
  methods: {
    focusInfo(): void {
      setInfoFocus({kind: 'players'});
    },
    setRef(el: unknown, i: number): void {
      if (el instanceof HTMLButtonElement) {
        this.els[i] = el;
      }
    },
    tabindexFor(n: number, i: number): number {
      if (n === this.modelValue) {
        return 0;
      }
      return (!this.counts.includes(this.modelValue) && i === 0) ? 0 : -1;
    },
    select(n: number): void {
      if (n !== this.modelValue) {
        this.$emit('update:modelValue', n);
      }
    },
    onKey(e: KeyboardEvent, i: number): void {
      const last = this.counts.length - 1;
      let next = i;
      switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': next = Math.min(i + 1, last); break;
      case 'ArrowLeft': case 'ArrowUp': next = Math.max(i - 1, 0); break;
      case 'Home': next = 0; break;
      case 'End': next = last; break;
      default: return;
      }
      e.preventDefault();
      this.select(this.counts[next]);
      this.$nextTick(() => this.els[next]?.focus());
    },
  },
});
</script>
