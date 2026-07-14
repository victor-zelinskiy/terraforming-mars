<template>
  <span class="con-genflip"
        :class="{'con-genflip--flip': flipping, 'con-genflip--final': final}">
    <span class="con-genflip__viewport">
      <span v-if="flipping"
            :key="'out:' + flipNonce"
            class="con-status__value con-genflip__card con-genflip__card--out"
            aria-hidden="true">{{ prev }}</span>
      <span :key="'in:' + flipNonce"
            class="con-status__value con-genflip__card"
            :class="{'con-genflip__card--in': flipping}">{{ shown }}</span>
    </span>
    <span v-if="flipping" :key="'flash:' + flipNonce" class="con-genflip__flash" aria-hidden="true"></span>
  </span>
</template>

<script lang="ts">
/**
 * ConsoleGenerationFlip — the premium generation SWAP in the console top
 * HUD (ConsoleStatusStrip). A calm mechanical flip-counter beat: the old
 * value folds away, the new one unrolls in, a thin scanline flashes —
 * more noticeable than the old delta chip, never a toast. It REPLACES
 * both the AnimatedMetricValue chip on this number and (in console mode)
 * the desktop's "new generation" toast.
 *
 * Behaviour contract:
 *  - mounts SILENTLY (a reload / reconnect never replays the flip);
 *  - an INCREASE plays the one-shot flip (all timings ride motionMs /
 *    --motion-scale; prefers-reduced-motion collapses it to a plain swap
 *    in CSS);
 *  - a DECREASE (undo / a different game opened in-session) snaps
 *    silently — never a celebration for a rollback;
 *  - `final` = the arriving generation is authoritatively the last one →
 *    the flash ticks gold instead of cyan (the persistent gold state
 *    itself lives on the host's `con-status__gen--final`).
 */
import {defineComponent} from 'vue';
import {motionMs} from '@/client/components/motion/motionTokens';

/** Full swap choreography length (out-fold + delayed in-unroll + flash). */
const FLIP_TOTAL_MS = 940;

export default defineComponent({
  name: 'ConsoleGenerationFlip',
  props: {
    value: {type: Number, required: true},
    /** The arriving generation is the game's last — gold flash accent. */
    final: {type: Boolean, default: false},
  },
  data() {
    return {
      shown: this.value,
      prev: this.value,
      flipping: false,
      flipNonce: 0,
      clearTimer: undefined as number | undefined,
    };
  },
  watch: {
    value(next: number): void {
      if (next === this.shown) {
        return;
      }
      if (next < this.shown) {
        this.stopFlip();
        this.shown = next;
        return;
      }
      this.prev = this.shown;
      this.shown = next;
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
