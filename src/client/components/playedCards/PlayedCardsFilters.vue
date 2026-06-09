<template>
  <div class="played-filters" role="group" :aria-label="$t('Filter played cards by type')">
    <!-- Card-type chips (toggle-to-hide — every group shown by default, click
         to hide it). Counts are faceted by the tag filter. -->
    <div class="played-filters__types">
      <button
        v-for="chip in typeChips"
        :key="chip.key"
        type="button"
        class="played-filter-chip"
        :class="['played-filter-chip--' + chip.accent, {'played-filter-chip--off': !chip.enabled}]"
        :aria-pressed="chip.enabled"
        @click="$emit('toggle-type', chip.key)">
        <span class="played-filter-chip__dot" aria-hidden="true"></span>
        <span class="played-filter-chip__label" v-i18n>{{ chip.label }}</span>
        <span class="played-filter-chip__count">{{ chip.count }}</span>
      </button>
    </div>

    <template v-if="tagChips.length > 0">
      <span class="played-filters__divider" aria-hidden="true"></span>
      <!-- Tag chips (positive narrowing — select to keep only matching cards,
           like the hand overlay). Faceted counts; an unselected tag absent
           from the current slice goes muted. Selected tags stay clickable at 0
           so they can always be cleared. -->
      <div class="played-filters__tags" role="group" :aria-label="$t('Filter played cards by tag')">
        <button
          v-for="chip in tagChips"
          :key="chip.tag"
          type="button"
          class="played-tag-chip"
          :class="{'played-tag-chip--active': chip.active, 'played-tag-chip--muted': chip.muted}"
          :aria-pressed="chip.active"
          :aria-disabled="chip.muted ? 'true' : undefined"
          :aria-label="chip.muted ? chip.tag + ' — ' + mutedHint : chip.tag"
          :data-hint="chip.muted ? mutedHint : null"
          @click="onTag(chip)">
          <span class="played-tag-chip__icon card-tag" :class="'tag-' + chip.tag" aria-hidden="true"></span>
          <span class="played-tag-chip__count">{{ chip.count }}</span>
        </button>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PlayedTagChip, PlayedTypeChip} from '@/client/components/playedCards/playedCardGroups';
import {translateText} from '@/client/directives/i18n';

/**
 * Premium filter bar for the played-cards board. Type chips (one per card-type
 * group, toggle-to-hide, with a faceted count) on the left; tag chips
 * (positive narrowing with a tag icon + faceted count) on the right. NOT
 * native checkboxes. The parent owns the filter state (module-level, so it
 * persists across close/reopen) and mutates it from the emitted events.
 */
export default defineComponent({
  name: 'PlayedCardsFilters',
  props: {
    typeChips: {
      type: Array as PropType<ReadonlyArray<PlayedTypeChip>>,
      required: true,
    },
    tagChips: {
      type: Array as PropType<ReadonlyArray<PlayedTagChip>>,
      required: true,
    },
  },
  emits: ['toggle-type', 'toggle-tag'],
  computed: {
    // Short hint shown (hover/aria) on a tag chip with no cards in the current
    // slice — explains why it looks disabled without a native title.
    mutedHint(): string {
      return translateText('No cards in this filter');
    },
  },
  methods: {
    // A muted chip (0 cards in the current slice) is visually disabled but
    // kept hover-able for its hint, so we guard the toggle here rather than
    // with a real `disabled` attribute (disabled buttons swallow :hover).
    onTag(chip: PlayedTagChip): void {
      if (!chip.muted) {
        this.$emit('toggle-tag', chip.tag);
      }
    },
  },
});
</script>
