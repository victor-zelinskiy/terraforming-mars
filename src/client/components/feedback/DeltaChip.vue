<template>
  <span class="delta-chip"
        :class="chipClasses"
        aria-hidden="true">
    <span class="delta-chip__sign">{{ sign }}</span><span class="delta-chip__value">{{ magnitude }}</span>
  </span>
</template>

<script lang="ts">

import {defineComponent, PropType} from 'vue';

/*
 * Visual variants. Drives the chip's size + tone tier.
 *
 *   resource-stock      — most prominent (M€/steel/...) — full size.
 *   resource-production — production chip — compact.
 *   tag                 — tag value      — small.
 *   misc                — misc counter   — small (same as tag).
 *
 * Each variant has its own LESS rule in resource_change_feedback.less
 * that tunes font-size, padding, glow strength.
 */
export type DeltaChipVariant = 'resource-stock' | 'resource-production' | 'tag' | 'misc';

export default defineComponent({
  name: 'DeltaChip',
  props: {
    amount: {
      type: Number,
      required: true,
    },
    variant: {
      type: String as PropType<DeltaChipVariant>,
      required: true,
    },
  },
  computed: {
    polarity(): 'positive' | 'negative' | 'neutral' {
      if (this.amount > 0) {
        return 'positive';
      }
      if (this.amount < 0) {
        return 'negative';
      }
      return 'neutral';
    },
    sign(): string {
      if (this.amount > 0) {
        return '+';
      }
      if (this.amount < 0) {
        return '−';
      }
      return '';
    },
    magnitude(): string {
      return String(Math.abs(this.amount));
    },
    chipClasses(): Array<string> {
      return [
        `delta-chip--${this.variant}`,
        `delta-chip--${this.polarity}`,
      ];
    },
  },
});
</script>
