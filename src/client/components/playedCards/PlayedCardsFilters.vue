<template>
  <div class="played-filters" role="group" :aria-label="$t('Filter played cards by type')">
    <button
      v-for="chip in chips"
      :key="chip.key"
      type="button"
      class="played-filter-chip"
      :class="['played-filter-chip--' + chip.accent, {'played-filter-chip--off': !chip.enabled}]"
      :aria-pressed="chip.enabled"
      @click="$emit('toggle', chip.key)">
      <span class="played-filter-chip__dot" aria-hidden="true"></span>
      <span class="played-filter-chip__label" v-i18n>{{ chip.label }}</span>
      <span class="played-filter-chip__count">{{ chip.count }}</span>
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PlayedGroupKey} from '@/client/components/playedCards/playedCardGroups';

export type PlayedFilterChip = {
  key: PlayedGroupKey;
  label: string;
  accent: PlayedGroupKey;
  count: number;
  enabled: boolean;
};

/**
 * Premium filter chips (one per non-empty card group). NOT native
 * checkboxes — compact toggle chips with the group's colour dot, label
 * and a live count. Active = filled accent; off = dimmed. Clicking
 * toggles the group's visibility in the board.
 */
export default defineComponent({
  name: 'PlayedCardsFilters',
  props: {
    chips: {
      type: Array as PropType<ReadonlyArray<PlayedFilterChip>>,
      required: true,
    },
  },
  emits: ['toggle'],
});
</script>
