<template>
  <!-- Reuses the `journal-genselect` visual classes so it's pixel-identical
       to the generation dropdown (spec: "такой же premium dropdown"). -->
  <div class="journal-genselect journal-filterselect" :class="{'journal-genselect--open': open}">
    <button
      ref="trigger"
      type="button"
      class="journal-genselect__trigger journal-filterselect__trigger"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-label="$t('Filter journal by player')"
      @click="toggle"
      @keydown.down.prevent="openAndMove(1)"
      @keydown.up.prevent="openAndMove(-1)">
      <svg class="journal-filterselect__glyph" width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M0.5 1.5h11L7 6.6V11L5 9.6V6.6z" />
      </svg>
      <span v-if="selectedColor !== undefined"
            class="journal-filter-dot"
            :class="'player_bg_color_' + selectedColor"
            aria-hidden="true"></span>
      <span class="journal-genselect__trigger-label">{{ triggerLabel }}</span>
      <span class="journal-genselect__caret" aria-hidden="true">▾</span>
    </button>

    <Transition name="journal-dropdown">
      <ul
        v-if="open"
        ref="list"
        class="journal-genselect__menu journal-filterselect__menu"
        role="listbox"
        tabindex="-1"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="chooseActive"
        @keydown.esc.prevent.stop="close"
        @keydown.tab="close">
        <li
          v-for="(opt, i) in options"
          :key="opt.key"
          class="journal-genselect__option"
          :class="{
            'journal-genselect__option--selected': isSelected(opt),
            'journal-genselect__option--active': i === activeIndex,
          }"
          role="option"
          :aria-selected="isSelected(opt)"
          @mouseenter="activeIndex = i"
          @click="choose(opt)">
          <span v-if="opt.color !== undefined"
                class="journal-filter-dot"
                :class="'player_bg_color_' + opt.color"
                aria-hidden="true"></span>
          <span class="journal-genselect__option-label">{{ opt.label }}</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {JournalFilter, journalFilterEquals} from '@/client/components/journal/journalFilter';

/**
 * Premium player-filter dropdown for the journal header — visually a twin
 * of `JournalGenerationSelector` (shares its CSS classes). No native
 * <select>; keyboard operable; closes on outside click.
 *
 * Options: ВСЕ (all) · one entry per player (with their colour dot) ·
 * ТОЛЬКО СОПЕРНИКИ (opponents only). The parent only mounts this when
 * there are ≥ 2 players, so "opponents" is always meaningful.
 */
type FilterOption = {
  key: string;
  value: JournalFilter;
  label: string; // already display-ready (player names raw, others translated)
  color: Color | undefined;
};

type DataModel = {
  open: boolean;
  activeIndex: number;
};

export default defineComponent({
  name: 'JournalFilterSelector',
  props: {
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
    selected: {
      type: Object as PropType<JournalFilter>,
      required: true,
    },
  },
  emits: ['select'],
  data(): DataModel {
    return {
      open: false,
      activeIndex: 0,
    };
  },
  computed: {
    options(): ReadonlyArray<FilterOption> {
      const out: Array<FilterOption> = [
        {key: 'all', value: {kind: 'all'}, label: this.$t('All'), color: undefined},
      ];
      for (const p of this.players) {
        out.push({key: 'p:' + p.color, value: {kind: 'player', color: p.color}, label: p.name, color: p.color});
      }
      out.push({key: 'opponents', value: {kind: 'opponents'}, label: this.$t('Opponents only'), color: undefined});
      return out;
    },
    selectedOption(): FilterOption | undefined {
      return this.options.find((o) => journalFilterEquals(o.value, this.selected));
    },
    triggerLabel(): string {
      return this.selectedOption?.label ?? this.$t('All');
    },
    selectedColor(): Color | undefined {
      return this.selectedOption?.color;
    },
  },
  methods: {
    isSelected(opt: FilterOption): boolean {
      return journalFilterEquals(opt.value, this.selected);
    },
    toggle(): void {
      if (this.open) {
        this.close();
      } else {
        this.openMenu();
      }
    },
    openMenu(): void {
      this.open = true;
      const idx = this.options.findIndex((o) => this.isSelected(o));
      this.activeIndex = Math.max(0, idx);
      nextTick(() => (this.$refs.list as HTMLElement | undefined)?.focus());
    },
    close(): void {
      if (!this.open) {
        return;
      }
      this.open = false;
      nextTick(() => (this.$refs.trigger as HTMLElement | undefined)?.focus());
    },
    openAndMove(delta: number): void {
      if (!this.open) {
        this.openMenu();
        return;
      }
      this.move(delta);
    },
    move(delta: number): void {
      const n = this.options.length;
      if (n === 0) {
        return;
      }
      this.activeIndex = (this.activeIndex + delta + n) % n;
    },
    chooseActive(): void {
      const opt = this.options[this.activeIndex];
      if (opt !== undefined) {
        this.choose(opt);
      }
    },
    choose(opt: FilterOption): void {
      this.open = false;
      if (!journalFilterEquals(opt.value, this.selected)) {
        this.$emit('select', opt.value);
      }
      nextTick(() => (this.$refs.trigger as HTMLElement | undefined)?.focus());
    },
    onOutsidePointer(e: MouseEvent): void {
      if (!this.open) {
        return;
      }
      if (!(this.$el as HTMLElement).contains(e.target as Node)) {
        this.open = false;
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
