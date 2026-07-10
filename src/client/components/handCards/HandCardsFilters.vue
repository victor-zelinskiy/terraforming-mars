<template>
  <div class="hand-filters" role="group" :aria-label="$t('Filter cards in hand')">
    <!-- Availability segmented control (single-select) with faceted counts:
         each mode shows how many cards remain in it given the current
         type + tag filters. -->
    <div class="hand-filters__segment" role="tablist" :aria-label="$t('Availability')">
      <button
        v-for="chip in availabilityChips"
        :key="chip.value"
        type="button"
        class="hand-seg-btn"
        :class="{'hand-seg-btn--active': chip.active, 'hand-seg-btn--empty': chip.count === 0 && !chip.active}"
        :aria-pressed="chip.active"
        @click="$emit('availability', chip.value)">
        <span class="hand-seg-btn__label" v-i18n>{{ chip.label }}</span>
        <span class="hand-seg-btn__count">{{ chip.count }}</span>
      </button>
    </div>

    <span class="hand-filters__divider" aria-hidden="true"></span>

    <!-- Type chips (positive narrowing — select to keep only that type, same
         behaviour as the tag chips below). Faceted counts; an unselected type
         with no cards in the current slice goes muted instead of vanishing.
         An ACTIVE type whose result set has emptied stays visible + ghosted
         (--active-empty) so the player can clear it directly. Selected types
         stay clickable at 0 so they can always be cleared. The transition
         group plays a short dissolve when a chip finally leaves the panel. -->
    <transition-group tag="div" class="hand-filters__chips" name="hand-chip-pop">
      <button
        v-for="chip in typeChips"
        :key="chip.key"
        type="button"
        class="hand-filter-chip"
        :class="['hand-filter-chip--' + chip.key, {'hand-filter-chip--selected': chip.active, 'hand-filter-chip--muted': chip.muted, 'hand-filter-chip--active-empty': chip.activeEmpty}]"
        :aria-pressed="chip.active"
        :aria-disabled="chip.muted ? 'true' : undefined"
        :aria-label="chip.muted ? mutedHint : undefined"
        :data-hint="chip.muted ? mutedHint : null"
        @click="onType(chip)">
        <span class="hand-filter-chip__dot" aria-hidden="true"></span>
        <span class="hand-filter-chip__label" v-i18n>{{ chip.label }}</span>
        <span class="hand-filter-chip__count">{{ chip.count }}</span>
      </button>
    </transition-group>

    <span v-if="tagChips.length > 0" class="hand-filters__divider" aria-hidden="true"></span>
    <!-- Tag chips (positive narrowing — select to keep only matching).
         Faceted counts; an unselected tag absent from the current slice
         goes muted. An ACTIVE tag whose result set has emptied (the last
         matching card was played) stays visible + ghosted (--active-empty)
         so it can be cleared directly. Selected tags always stay clickable
         so they can be cleared even at a 0 count. The transition group is
         kept mounted (the divider toggles, not the group) so a leaving chip
         reliably plays its dissolve animation. -->
    <transition-group tag="div" class="hand-filters__tags" name="hand-chip-pop">
      <button
        v-for="chip in tagChips"
        :key="chip.tag"
        type="button"
        class="hand-tag-chip"
        :class="{'hand-tag-chip--active': chip.active, 'hand-tag-chip--muted': chip.muted, 'hand-tag-chip--active-empty': chip.activeEmpty}"
        :aria-pressed="chip.active"
        :aria-disabled="chip.muted ? 'true' : undefined"
        :aria-label="chip.muted ? chip.tag + ' — ' + mutedHint : chip.tag"
        :data-hint="chip.muted ? mutedHint : null"
        @click="onTag(chip)">
        <span class="hand-tag-chip__icon card-tag" :class="'tag-' + chip.tag" aria-hidden="true"></span>
        <span class="hand-tag-chip__count">{{ chip.count }}</span>
      </button>
    </transition-group>

    <!-- Sort dropdown (custom glass, no native select) + direction toggle. -->
    <div class="hand-filters__sort">
      <!-- Ascending / descending segmented toggle. Both states visible,
           the active one highlighted — clear at a glance, no guessing. -->
      <div class="hand-sortdir" role="group" :aria-label="$t('Sort direction')">
        <button
          type="button"
          class="hand-sortdir__btn"
          :class="{'hand-sortdir__btn--active': filter.sortDir === 'asc'}"
          :aria-pressed="filter.sortDir === 'asc'"
          :aria-label="$t('Sort ascending')"
          @click="$emit('sort-dir', 'asc')">
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2 L10.5 9.5 L1.5 9.5 Z"/></svg>
        </button>
        <button
          type="button"
          class="hand-sortdir__btn"
          :class="{'hand-sortdir__btn--active': filter.sortDir === 'desc'}"
          :aria-pressed="filter.sortDir === 'desc'"
          :aria-label="$t('Sort descending')"
          @click="$emit('sort-dir', 'desc')">
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10 L1.5 2.5 L10.5 2.5 Z"/></svg>
        </button>
      </div>
      <div ref="sort" class="hand-sort" :class="{'hand-sort--open': sortOpen}">
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
import {defineComponent, PropType, ref} from 'vue';
import {onClickOutside} from '@vueuse/core';
import {AvailabilityChip, HandFilterState, HandSortMode, HandTagChip, HandTypeChip} from '@/client/components/handCards/handCardModel';
import {translateText} from '@/client/directives/i18n';

const SORT_OPTIONS: ReadonlyArray<{value: HandSortMode; label: string}> = [
  // Acquisition order is the default — listed first.
  {value: 'received', label: 'By acquisition time'},
  {value: 'availability', label: 'By availability'},
  {value: 'cost', label: 'By cost'},
  {value: 'type', label: 'By type'},
  {value: 'tag', label: 'By tag'},
  {value: 'name', label: 'By name'},
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
    availabilityChips: {
      type: Array as PropType<ReadonlyArray<AvailabilityChip>>,
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
  emits: ['availability', 'toggle-type', 'toggle-tag', 'sort', 'sort-dir'],
  setup() {
    // VueUse outside-click on the SORT dropdown region (`.hand-sort`) — closes
    // when the pointer lands outside it, including on the other filter chips
    // (was a manual document mousedown listener querying `.hand-sort`).
    const sort = ref<HTMLElement>();
    const sortOpen = ref(false);
    onClickOutside(sort, () => {
      sortOpen.value = false;
    });
    return {sort, sortOpen};
  },
  data() {
    return {
      sortOptions: SORT_OPTIONS,
    };
  },
  computed: {
    currentSortLabel(): string {
      return SORT_OPTIONS.find((o) => o.value === this.filter.sort)?.label ?? 'By acquisition time';
    },
    // Short hint shown (hover/aria) on a chip that has no cards in the
    // current slice — explains why it looks disabled without a native title.
    mutedHint(): string {
      return translateText('No cards in this filter');
    },
  },
  methods: {
    // A muted chip (0 cards in the current slice) is visually disabled but
    // kept hover-able for its hint, so we guard the toggle here rather than
    // with a real `disabled` attribute (disabled buttons swallow :hover).
    onType(chip: HandTypeChip): void {
      if (!chip.muted) {
        this.$emit('toggle-type', chip.key);
      }
    },
    onTag(chip: HandTagChip): void {
      if (!chip.muted) {
        this.$emit('toggle-tag', chip.tag);
      }
    },
    choose(value: HandSortMode): void {
      this.sortOpen = false;
      this.$emit('sort', value);
    },
  },
});
</script>
