<template>
  <div class="slot-colors" role="radiogroup" :aria-label="$t('Cube color')">
    <button
      v-for="(c, i) in colors"
      :key="c"
      type="button"
      role="radio"
      class="slot-colors__cube"
      :class="{'slot-colors__cube--on': c === modelValue, 'slot-colors__cube--taken': isTaken(c)}"
      :aria-checked="c === modelValue ? 'true' : 'false'"
      :aria-label="c"
      :disabled="isTaken(c)"
      :tabindex="tabindexFor(c, i)"
      :ref="(el) => setRef(el, i)"
      @click="pick(c)"
      @keydown="onKey($event, i)"
    >
      <player-cube :color="c" :size="18" :glow="c === modelValue" :shadow="false" :overlay-symbol="false" />
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color, PLAYER_COLORS} from '@/common/Color';
import PlayerCube from '@/client/components/PlayerCube.vue';

export default defineComponent({
  name: 'SlotColorStrip',
  components: {PlayerCube},
  props: {
    modelValue: {type: String as PropType<Color>, required: true},
    // Colours used by OTHER slots (disabled here to keep colours unique).
    taken: {type: Array as PropType<ReadonlyArray<Color>>, default: () => []},
  },
  emits: ['update:modelValue'],
  data() {
    return {els: [] as Array<HTMLButtonElement>};
  },
  computed: {
    colors(): ReadonlyArray<Color> {
      return PLAYER_COLORS;
    },
  },
  methods: {
    isTaken(c: Color): boolean {
      return c !== this.modelValue && this.taken.includes(c);
    },
    setRef(el: unknown, i: number): void {
      if (el instanceof HTMLButtonElement) {
        this.els[i] = el;
      }
    },
    tabindexFor(c: Color, i: number): number {
      if (c === this.modelValue) {
        return 0;
      }
      return (!this.colors.includes(this.modelValue) && i === 0) ? 0 : -1;
    },
    pick(c: Color): void {
      if (!this.isTaken(c) && c !== this.modelValue) {
        this.$emit('update:modelValue', c);
      }
    },
    onKey(e: KeyboardEvent, i: number): void {
      const last = this.colors.length - 1;
      let next = i;
      const step = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 :
        (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
      if (step === 0 && e.key !== 'Home' && e.key !== 'End') {
        return;
      }
      e.preventDefault();
      if (e.key === 'Home') {
        next = 0;
      } else if (e.key === 'End') {
        next = last;
      } else {
        // skip taken colours
        do {
          next = Math.max(0, Math.min(last, next + step));
        } while (this.isTaken(this.colors[next]) && next > 0 && next < last);
      }
      if (!this.isTaken(this.colors[next])) {
        this.pick(this.colors[next]);
        this.$nextTick(() => this.els[next]?.focus());
      }
    },
  },
});
</script>
