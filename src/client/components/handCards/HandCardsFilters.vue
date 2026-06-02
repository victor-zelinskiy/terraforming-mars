<template>
  <div class="hand-filters" role="group" :aria-label="$t('Filter cards in hand')">
    <!-- Availability segmented control (single-select). -->
    <div class="hand-filters__segment" role="tablist" :aria-label="$t('Availability')">
      <button
        v-for="opt in availabilityOptions"
        :key="opt.value"
        type="button"
        class="hand-seg-btn"
        :class="{'hand-seg-btn--active': filter.availability === opt.value}"
        :aria-pressed="filter.availability === opt.value"
        @click="$emit('availability', opt.value)">
        <span v-i18n>{{ opt.label }}</span>
      </button>
    </div>

    <span class="hand-filters__divider" aria-hidden="true"></span>

    <!-- Type chips (toggle to hide a type). -->
    <div class="hand-filters__chips">
      <button
        v-for="chip in typeChips"
        :key="chip.key"
        type="button"
        class="hand-filter-chip"
        :class="['hand-filter-chip--' + chip.key, {'hand-filter-chip--off': !chip.enabled}]"
        :aria-pressed="chip.enabled"
        @click="$emit('toggle-type', chip.key)">
        <span class="hand-filter-chip__dot" aria-hidden="true"></span>
        <span class="hand-filter-chip__label" v-i18n>{{ chip.label }}</span>
        <span class="hand-filter-chip__count">{{ chip.count }}</span>
      </button>
    </div>

    <template v-if="tagChips.length > 0">
      <span class="hand-filters__divider" aria-hidden="true"></span>
      <!-- Tag chips (positive narrowing — select to keep only matching). -->
      <div class="hand-filters__tags">
        <button
          v-for="chip in tagChips"
          :key="chip.tag"
          type="button"
          class="hand-tag-chip"
          :class="{'hand-tag-chip--active': chip.active}"
          :aria-pressed="chip.active"
          :aria-label="chip.tag"
          @click="$emit('toggle-tag', chip.tag)">
          <span class="hand-tag-chip__icon card-tag" :class="'tag-' + chip.tag" aria-hidden="true"></span>
          <span class="hand-tag-chip__count">{{ chip.count }}</span>
        </button>
      </div>
    </template>

    <!-- Sort dropdown (custom glass, no native select). -->
    <div class="hand-filters__sort">
      <div class="hand-sort" :class="{'hand-sort--open': sortOpen}">
        <button
          ref="sortTrigger"
          type="button"
          class="hand-sort__trigger"
          :aria-expanded="sortOpen"
          aria-haspopup="listbox"
          @click="sortOpen = !sortOpen">
          <span class="hand-sort__trigger-icon" aria-hidden="true">⇅</span>
          <span class="hand-sort__trigger-label" v-i18n>{{ currentSortLabel }}</span>
          <span class="hand-sort__caret" aria-hidden="true">▾</span>
        </button>
        <transition name="hand-sort-drop">
          <ul v-if="sortOpen" class="hand-sort__menu" role="listbox">
            <li
              v-for="opt in sortOptions"
              :key="opt.value"
              class="hand-sort__option"
              :class="{'hand-sort__option--selected': opt.value === filter.sort}"
              role="option"
              :aria-selected="opt.value === filter.sort"
              @click="choose(opt.value)">
              <span v-i18n>{{ opt.label }}</span>
            </li>
          </ul>
        </transition>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {AvailabilityFilter, HandFilterState, HandSortMode, HandTagChip, HandTypeChip} from '@/client/components/handCards/handCardModel';

const SORT_OPTIONS: ReadonlyArray<{value: HandSortMode; label: string}> = [
  {value: 'availability', label: 'By availability'},
  {value: 'cost', label: 'By cost'},
  {value: 'type', label: 'By type'},
  {value: 'tag', label: 'By tag'},
  {value: 'name', label: 'By name'},
];

const AVAILABILITY_OPTIONS: ReadonlyArray<{value: AvailabilityFilter; label: string}> = [
  {value: 'all', label: 'All'},
  {value: 'playable', label: 'Playable'},
  {value: 'unplayable', label: 'Unplayable'},
];

/**
 * Premium, compact filter bar for the hand overlay. Availability is a
 * single-select segmented control; type chips toggle a card type off; tag
 * chips narrow to selected tags (positive); sort is a custom glass
 * dropdown (no native <select>, per spec). The parent owns the filter
 * state and mutates it from the emitted events.
 */
export default defineComponent({
  name: 'HandCardsFilters',
  props: {
    filter: {
      type: Object as PropType<HandFilterState>,
      required: true,
    },
    typeChips: {
      type: Array as PropType<ReadonlyArray<HandTypeChip>>,
      required: true,
    },
    tagChips: {
      type: Array as PropType<ReadonlyArray<HandTagChip>>,
      required: true,
    },
  },
  emits: ['availability', 'toggle-type', 'toggle-tag', 'sort'],
  data() {
    return {
      sortOpen: false,
      sortOptions: SORT_OPTIONS,
      availabilityOptions: AVAILABILITY_OPTIONS,
    };
  },
  computed: {
    currentSortLabel(): string {
      return SORT_OPTIONS.find((o) => o.value === this.filter.sort)?.label ?? 'By availability';
    },
  },
  methods: {
    choose(value: HandSortMode): void {
      this.sortOpen = false;
      this.$emit('sort', value);
    },
    onOutsidePointer(e: MouseEvent): void {
      if (!this.sortOpen) {
        return;
      }
      const sort = this.$el?.querySelector?.('.hand-sort');
      if (sort && !sort.contains(e.target as Node)) {
        this.sortOpen = false;
      }
    },
  },
  mounted(): void {
    document.addEventListener('mousedown', this.onOutsidePointer, true);
  },
  beforeUnmount(): void {
    document.removeEventListener('mousedown', this.onOutsidePointer, true);
  },
});
</script>
