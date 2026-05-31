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
 * Visual variants. Drives the chip's size + tone tier AND the
 * matching number-transition strength (see resource_change_feedback.less).
 *
 *   resource-stock      — M€/steel/titanium/plants/energy/heat stock.
 *                         Most prominent — slide-in + scale + glow.
 *   resource-production — production chips above. Subtle — scale +
 *                         glow on the number, cell glow.
 *   tag                 — card tag count (Building/Space/...).
 *                         Compact — scale + glow.
 *   misc                — Cities, Colonies, Influence, Cards, Corruption,
 *                         Underground tokens, Negative-VP. Compact-medium.
 *   score               — Victory Points + Terraforming Rating.
 *                         Game-defining — strong + glow + slight slide.
 *
 * Each variant has its own LESS rule that tunes font-size, padding,
 * glow strength, and a matching `*-transition-*` keyframe pair for
 * the number itself.
 */
export type DeltaChipVariant =
  | 'resource-stock'
  | 'resource-production'
  | 'tag'
  | 'misc'
  | 'score';

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
