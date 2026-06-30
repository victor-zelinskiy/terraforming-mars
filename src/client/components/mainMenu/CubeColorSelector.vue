<template>
  <div
    class="cube-color-selector"
    role="radiogroup"
    :aria-label="$t('Cube color')"
  >
    <button
      v-for="(c, i) in colors"
      :key="c"
      type="button"
      role="radio"
      class="cube-color-option"
      :class="{'cube-color-option--selected': c === modelValue}"
      :aria-checked="c === modelValue ? 'true' : 'false'"
      :aria-label="c"
      :tabindex="tabindexFor(c, i)"
      :ref="(el) => setOptionRef(el, i)"
      @click="select(c)"
      @keydown="onKeydown($event, i)"
    >
      <span class="cube-color-option__stage" aria-hidden="true">
        <player-cube
          :color="c"
          :size="cubeSize"
          :glow="c === modelValue"
          :shadow="true"
          :overlay-symbol="false" />
      </span>
      <span class="cube-color-option__check" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 12.5 L10 17.5 L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color, PLAYER_COLORS} from '@/common/Color';
import PlayerCube from '@/client/components/PlayerCube.vue';

const COLUMNS = 4;

export default defineComponent({
  name: 'CubeColorSelector',
  components: {PlayerCube},
  props: {
    modelValue: {type: String as PropType<Color>, required: true},
    cubeSize: {type: Number, default: 38},
  },
  emits: ['update:modelValue'],
  data() {
    return {
      optionEls: [] as Array<HTMLButtonElement>,
    };
  },
  computed: {
    colors(): ReadonlyArray<Color> {
      return PLAYER_COLORS;
    },
  },
  methods: {
    setOptionRef(el: unknown, i: number): void {
      if (el instanceof HTMLButtonElement) {
        this.optionEls[i] = el;
      }
    },
    // Roving tabindex: only the selected option (or the first, if the current
    // value isn't in the list) is tabbable; the rest are reached via arrows.
    tabindexFor(c: Color, i: number): number {
      if (c === this.modelValue) {
        return 0;
      }
      const selectedExists = this.colors.includes(this.modelValue);
      return (!selectedExists && i === 0) ? 0 : -1;
    },
    select(c: Color): void {
      if (c !== this.modelValue) {
        this.$emit('update:modelValue', c);
      }
    },
    focusOption(i: number): void {
      this.optionEls[i]?.focus();
    },
    onKeydown(e: KeyboardEvent, i: number): void {
      const last = this.colors.length - 1;
      let next = i;
      switch (e.key) {
      case 'ArrowRight': next = Math.min(i + 1, last); break;
      case 'ArrowLeft': next = Math.max(i - 1, 0); break;
      case 'ArrowDown': next = Math.min(i + COLUMNS, last); break;
      case 'ArrowUp': next = Math.max(i - COLUMNS, 0); break;
      case 'Home': next = 0; break;
      case 'End': next = last; break;
      default: return;
      }
      e.preventDefault();
      this.select(this.colors[next]);
      this.$nextTick(() => this.focusOption(next));
    },
  },
});
</script>
