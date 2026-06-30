<template>
  <div class="tr-gauge" @mouseenter="focusInfo" @focusin="focusInfo">
    <button type="button" class="tr-gauge__step" :aria-label="$t('Decrease')" @click="dec">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12 H19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
    </button>

    <div
      class="tr-gauge__track"
      role="slider"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="value"
      :aria-label="$t('TR Boost')"
      tabindex="0"
      @keydown="onKey"
    >
      <button
        v-for="n in nodes"
        :key="n"
        type="button"
        class="tr-gauge__node"
        :class="{'tr-gauge__node--active': n <= value, 'tr-gauge__node--current': n === value}"
        tabindex="-1"
        :aria-hidden="true"
        @click="set(n)"
      >
        <span class="tr-gauge__node-dot"></span>
      </button>
    </div>

    <button type="button" class="tr-gauge__step" :aria-label="$t('Increase')" @click="inc">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5 V19 M5 12 H19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
    </button>

    <div class="tr-gauge__value"><span class="tr-gauge__value-num">{{ value }}</span></div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {TR_BOOST_MIN, TR_BOOST_MAX, setInfoFocus} from './createGameState';

export default defineComponent({
  name: 'TrBoostGauge',
  props: {
    modelValue: {type: Number, required: true},
  },
  emits: ['update:modelValue'],
  data() {
    return {min: TR_BOOST_MIN, max: TR_BOOST_MAX};
  },
  computed: {
    value(): number {
      return Math.max(this.min, Math.min(this.max, this.modelValue));
    },
    nodes(): Array<number> {
      const out: Array<number> = [];
      for (let n = this.min; n <= this.max; n++) {
        out.push(n);
      }
      return out;
    },
  },
  methods: {
    focusInfo(): void {
      setInfoFocus({kind: 'trBoost'});
    },
    set(n: number): void {
      const clamped = Math.max(this.min, Math.min(this.max, n));
      if (clamped !== this.value) {
        this.$emit('update:modelValue', clamped);
      }
    },
    inc(): void {
      this.set(this.value + 1);
    },
    dec(): void {
      this.set(this.value - 1);
    },
    onKey(e: KeyboardEvent): void {
      switch (e.key) {
      case 'ArrowRight': case 'ArrowUp': this.inc(); break;
      case 'ArrowLeft': case 'ArrowDown': this.dec(); break;
      case 'Home': this.set(this.min); break;
      case 'End': this.set(this.max); break;
      default: return;
      }
      e.preventDefault();
    },
  },
});
</script>
