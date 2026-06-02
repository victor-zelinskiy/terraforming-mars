<template>
  <div class="journal-genselect" :class="{'journal-genselect--open': open}">
    <button
      ref="trigger"
      type="button"
      class="journal-genselect__trigger"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown.down.prevent="openAndMove(1)"
      @keydown.up.prevent="openAndMove(-1)">
      <span class="journal-genselect__trigger-label">
        <span v-i18n>Generation</span>&nbsp;{{ selected }}
      </span>
      <span v-if="selected === current" class="journal-genselect__live">
        <span class="journal-genselect__live-dot" aria-hidden="true"></span>
        <span v-i18n>Live</span>
      </span>
      <span class="journal-genselect__caret" aria-hidden="true">▾</span>
    </button>

    <Transition name="journal-dropdown">
      <ul
        v-if="open"
        ref="list"
        class="journal-genselect__menu"
        role="listbox"
        tabindex="-1"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="chooseActive"
        @keydown.esc.prevent.stop="close"
        @keydown.tab="close">
        <li
          v-for="(gen, i) in options"
          :key="gen"
          class="journal-genselect__option"
          :class="{
            'journal-genselect__option--selected': gen === selected,
            'journal-genselect__option--active': i === activeIndex,
          }"
          role="option"
          :aria-selected="gen === selected"
          @mouseenter="activeIndex = i"
          @click="choose(gen)">
          <span class="journal-genselect__option-label"><span v-i18n>Generation</span>&nbsp;{{ gen }}</span>
          <span v-if="gen === current" class="journal-genselect__option-tag" v-i18n>Current</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick} from 'vue';

/**
 * Modern, fully custom generation dropdown for the journal header.
 *
 * No native <select> (spec) — glass/HUD styling, keyboard operable
 * (Up/Down to move, Enter to choose, Esc to close, Tab closes), and
 * closes on outside click. Options are listed latest-first so the
 * current generation sits at the top.
 */
type DataModel = {
  open: boolean;
  activeIndex: number;
};

export default defineComponent({
  name: 'JournalGenerationSelector',
  props: {
    // Total number of generations played so far (== current generation).
    current: {
      type: Number,
      required: true,
    },
    selected: {
      type: Number,
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
    // Latest first: [current, current-1, …, 1].
    options(): ReadonlyArray<number> {
      const out: Array<number> = [];
      for (let g = this.current; g >= 1; g--) {
        out.push(g);
      }
      return out;
    },
  },
  methods: {
    toggle(): void {
      if (this.open) {
        this.close();
      } else {
        this.openMenu();
      }
    },
    openMenu(): void {
      this.open = true;
      this.activeIndex = Math.max(0, this.options.indexOf(this.selected));
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
      const gen = this.options[this.activeIndex];
      if (gen !== undefined) {
        this.choose(gen);
      }
    },
    choose(gen: number): void {
      this.open = false;
      if (gen !== this.selected) {
        this.$emit('select', gen);
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
