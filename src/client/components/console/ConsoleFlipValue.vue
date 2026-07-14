<template>
  <span class="con-flipval"
        :class="[`con-flipval--${accent}`, {'con-flipval--flip': flipping}]">
    <span class="con-flipval__viewport">
      <span v-if="flipping"
            :key="'out:' + flipNonce"
            class="con-flipval__card con-flipval__card--out"
            aria-hidden="true">{{ prevText }}</span>
      <span :key="'in:' + flipNonce"
            class="con-flipval__card"
            :class="{'con-flipval__card--in': flipping}">{{ shownText }}</span>
    </span>
    <span v-if="flipping" :key="'flash:' + flipNonce" class="con-flipval__flash" aria-hidden="true"></span>
  </span>
</template>

<script lang="ts">
/**
 * ConsoleFlipValue — the premium value SWAP for the console top HUD
 * (ConsoleStatusStrip). A calm mechanical flip-counter beat: the old value
 * folds away, the new one unrolls in, a thin scanline flashes. Used by
 * every global readout — the game-end trio, Venus, the total percent and
 * the generation.
 *
 * `value` is the numeric TRUTH (drives detection); `text` is what renders
 * (the formatted readout — `-6°C` / `7/9` / `78%`), so the flip works for
 * any unit without the component knowing the format.
 *
 * ⚠️ LAYERING (load-bearing): this component must be nested INSIDE the
 * `.con-status__value` cell, never BE it. The delta-chip hooks in
 * `console.less` (`.con-status__param:has(.metric-feedback-host--…)
 * .con-status__value`) put an `animation` shorthand on that cell — a
 * flip animation on the same element would be clobbered by that
 * higher-specificity rule. Nested, the two compose: the cell plays the
 * chip's colour/scale transition while the cards fold inside it.
 *
 * Behaviour contract:
 *  - mounts SILENTLY (a reload / reconnect never replays the flip);
 *  - an INCREASE plays the one-shot flip (all timings ride motionMs /
 *    --motion-scale; prefers-reduced-motion collapses it to a plain swap
 *    in CSS);
 *  - a DECREASE (undo / a different game opened in-session) snaps
 *    silently — never a celebration for a rollback;
 *  - `accent` tints only the ONE-SHOT beat (shine + scanline); the
 *    persistent colour of the readout stays the host's own (e.g. the gold
 *    `con-status__gen--final`), which the cards inherit.
 */
import {defineComponent, PropType} from 'vue';
import {motionMs} from '@/client/components/motion/motionTokens';

/** The one-shot beat's tint — matches the readout it belongs to. */
export type FlipAccent = 'cyan' | 'mint' | 'gold';

/** Full swap choreography length (out-fold + delayed in-unroll + flash). */
const FLIP_TOTAL_MS = 940;

export default defineComponent({
  name: 'ConsoleFlipValue',
  props: {
    /** The numeric truth — drives increase / decrease detection. */
    value: {type: Number, required: true},
    /** The formatted readout; defaults to the bare number. */
    text: {type: String, default: undefined},
    accent: {type: String as PropType<FlipAccent>, default: 'cyan'},
  },
  data() {
    return {
      shown: this.value,
      shownText: this.display(this.value, this.text),
      prevText: this.display(this.value, this.text),
      flipping: false,
      flipNonce: 0,
      clearTimer: undefined as number | undefined,
    };
  },
  watch: {
    // The formatted text can change WITHOUT the value (a re-render / a
    // locale swap) — keep the face in sync without ever flipping for it.
    text(): void {
      if (!this.flipping) {
        this.shownText = this.display(this.shown, this.text);
      }
    },
    value(next: number): void {
      if (next === this.shown) {
        return;
      }
      const nextText = this.display(next, this.text);
      if (next < this.shown) {
        this.stopFlip();
        this.shown = next;
        this.shownText = nextText;
        return;
      }
      this.prevText = this.shownText;
      this.shown = next;
      this.shownText = nextText;
      this.flipNonce++; // re-keys the cards so a rapid re-flip restarts cleanly
      this.flipping = true;
      if (this.clearTimer !== undefined) {
        window.clearTimeout(this.clearTimer);
      }
      this.clearTimer = window.setTimeout(() => {
        this.flipping = false;
        this.clearTimer = undefined;
      }, motionMs(FLIP_TOTAL_MS));
    },
  },
  beforeUnmount() {
    this.stopFlip();
  },
  methods: {
    display(value: number, text: string | undefined): string {
      return text ?? String(value);
    },
    stopFlip(): void {
      if (this.clearTimer !== undefined) {
        window.clearTimeout(this.clearTimer);
        this.clearTimer = undefined;
      }
      this.flipping = false;
    },
  },
});
</script>
