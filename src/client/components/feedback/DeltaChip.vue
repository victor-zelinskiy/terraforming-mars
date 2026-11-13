<template>
  <span class="delta-chip"
        :class="chipClasses"
        aria-hidden="true">
    <span class="delta-chip__sign">{{ sign }}</span><span class="delta-chip__value"
          :class="{'delta-chip__value--tick': ticks > 0}"
          :key="ticks">{{ magnitude }}</span>
  </span>
</template>

<script setup vapor lang="ts">
/*
 * The VALUE is keyed on a COUNTER of in-place changes, not on the number
 * itself. A coalesced change keeps this whole chip mounted
 * (AnimatedMetricValue holds the chip key steady) and re-keys only the
 * number, which replaces that one span and replays its
 * `delta-chip-accumulate` tick from zero — the accumulator is SEEN
 * counting up rather than silently swapping digits.
 *
 * The counter starts at 0 and the tick class is withheld there ON
 * PURPOSE: the chip's own enter transition already carries the arrival,
 * and stacking a second scale on top of it would put extra motion on
 * every chip in the game to serve a case that only happens on the
 * SECOND value. The sign is deliberately never keyed — coalescing
 * cannot cross polarity, so it cannot change under a mounted chip.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, PropType, ref, watch} from 'vue';

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
 *   global-parameter    — Planet-level shared values (temperature, oxygen,
 *                         oceans, Venus, generation). Right-sidebar HUD —
 *                         compact-to-medium chip, calm but unmistakable,
 *                         comparable in weight to `misc`.
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
  | 'score'
  | 'global-parameter';

defineOptions({name: 'DeltaChip'});
const props = defineProps({
  amount: {
    type: Number,
    required: true,
  },
  variant: {
    type: String as PropType<DeltaChipVariant>,
    required: true,
  },
});

/** In-place value changes since this chip mounted (0 = the arrival). */
const ticks = ref(0);
const polarity = computed((): 'positive' | 'negative' | 'neutral' => {
  if (props.amount > 0) {
    return 'positive';
  }
  if (props.amount < 0) {
    return 'negative';
  }
  return 'neutral';
});
const sign = computed((): string => {
  if (props.amount > 0) {
    return '+';
  }
  if (props.amount < 0) {
    return '−';
  }
  return '';
});
const magnitude = computed((): string => {
  return String(Math.abs(props.amount));
});
const chipClasses = computed((): Array<string> => {
  return [
    `delta-chip--${props.variant}`,
    `delta-chip--${polarity.value}`,
  ];
});

watch(() => props.amount, () => {
  ticks.value++;
});
</script>
