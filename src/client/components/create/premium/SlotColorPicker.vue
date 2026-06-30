<template>
  <div class="slot-cp" ref="root">
    <button
      ref="trigger"
      type="button"
      class="slot-cp__trigger"
      :class="{'slot-cp__trigger--open': open}"
      :aria-label="$t('Cube color')"
      :aria-expanded="open ? 'true' : 'false'"
      @click="toggle"
    >
      <player-cube :color="modelValue" :size="22" :glow="open" :shadow="false" :overlay-symbol="false" />
      <span class="slot-cp__caret" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 10 L12 15 L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    </button>

    <teleport to="body">
      <transition name="slot-cp-pop">
        <div v-if="open" ref="pop" class="slot-cp__pop" :style="popStyle" role="listbox" :aria-label="$t('Cube color')">
          <button
            v-for="(c, i) in colors"
            :key="c"
            type="button"
            role="option"
            class="slot-cp__opt"
            :class="{'slot-cp__opt--on': c === modelValue, 'slot-cp__opt--taken': isTaken(c)}"
            :aria-selected="c === modelValue ? 'true' : 'false'"
            :aria-label="c"
            :disabled="isTaken(c)"
            :ref="(el) => setRef(el, i)"
            @click="pick(c)"
            @keydown="onKey($event, i)"
          >
            <player-cube :color="c" :size="24" :glow="c === modelValue" :shadow="false" :overlay-symbol="false" />
          </button>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color, PLAYER_COLORS} from '@/common/Color';
import PlayerCube from '@/client/components/PlayerCube.vue';

export default defineComponent({
  name: 'SlotColorPicker',
  components: {PlayerCube},
  props: {
    modelValue: {type: String as PropType<Color>, required: true},
    taken: {type: Array as PropType<ReadonlyArray<Color>>, default: () => []},
  },
  emits: ['update:modelValue'],
  data() {
    return {
      open: false,
      popStyle: {} as Record<string, string>,
      els: [] as Array<HTMLButtonElement>,
    };
  },
  computed: {
    colors(): ReadonlyArray<Color> {
      return PLAYER_COLORS;
    },
  },
  beforeUnmount() {
    this.detach();
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
    toggle(): void {
      if (this.open) {
        this.close();
      } else {
        this.openPop();
      }
    },
    openPop(): void {
      const trigger = this.$refs.trigger as HTMLElement | undefined;
      if (trigger === undefined) {
        return;
      }
      const r = trigger.getBoundingClientRect();
      const POP_W = 156;
      const POP_H = 78;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - POP_W - 8));
      const below = r.bottom + 6;
      const top = (below + POP_H > window.innerHeight) ? Math.max(8, r.top - POP_H - 6) : below;
      this.popStyle = {left: `${left}px`, top: `${top}px`, width: `${POP_W}px`};
      this.open = true;
      document.addEventListener('mousedown', this.onOutside, true);
      window.addEventListener('scroll', this.close, true);
      window.addEventListener('resize', this.close);
      this.$nextTick(() => {
        const sel = this.colors.indexOf(this.modelValue);
        this.els[sel >= 0 ? sel : 0]?.focus();
      });
    },
    close(): void {
      if (!this.open) {
        return;
      }
      this.open = false;
      this.detach();
      (this.$refs.trigger as HTMLElement | undefined)?.focus();
    },
    detach(): void {
      document.removeEventListener('mousedown', this.onOutside, true);
      window.removeEventListener('scroll', this.close, true);
      window.removeEventListener('resize', this.close);
    },
    onOutside(e: MouseEvent): void {
      const root = this.$refs.root as HTMLElement | undefined;
      const pop = this.$refs.pop as HTMLElement | undefined;
      const t = e.target as Node;
      if (root?.contains(t) || pop?.contains(t)) {
        return;
      }
      this.close();
    },
    pick(c: Color): void {
      if (!this.isTaken(c)) {
        if (c !== this.modelValue) {
          this.$emit('update:modelValue', c);
        }
        this.close();
      }
    },
    onKey(e: KeyboardEvent, i: number): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }
      const last = this.colors.length - 1;
      let next = i;
      const step = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 :
        (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
      if (step === 0) {
        return;
      }
      e.preventDefault();
      do {
        next = Math.max(0, Math.min(last, next + step));
      } while (this.isTaken(this.colors[next]) && next > 0 && next < last);
      if (!this.isTaken(this.colors[next])) {
        this.els[next]?.focus();
      }
    },
  },
});
</script>
