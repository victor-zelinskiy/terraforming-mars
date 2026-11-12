<template>
  <span class="con-flipval"
        :class="[`con-flipval--${accent}`, {'con-flipval--flip': flipping, 'con-flipval--down': flipping && falling}]">
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

<script setup lang="ts">
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
 *    silently — never a celebration for a rollback. Readouts whose NORMAL
 *    event IS a decrease (the project-deck count shrinks on every draw; a
 *    global parameter a card LOWERS — TR47 «ОБРАТНЫЙ ХОД») opt in via
 *    `flipOnDecrease` — the same calm one-shot beat, rolled the OTHER way
 *    (`--down`: the old value drops away below, the new one comes in from
 *    above — the direction the number went);
 *  - `accent` tints only the ONE-SHOT beat (shine + scanline); the
 *    persistent colour of the readout stays the host's own (e.g. the gold
 *    `con-status__gen--final`), which the cards inherit.
 */
import {PropType, ref, watch} from 'vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {useFlowScope} from '@/client/console/session/useFlowScope';

/** The one-shot beat's tint — matches the readout it belongs to. */
export type FlipAccent = 'cyan' | 'mint' | 'gold';

/** Full swap choreography length (out-fold + delayed in-unroll + flash). */
const FLIP_TOTAL_MS = 940;

defineOptions({name: 'ConsoleFlipValue'});
const props = defineProps({
  /** The numeric truth — drives increase / decrease detection. */
  value: {type: Number, required: true},
  /** The formatted readout; defaults to the bare number. */
  text: {type: String, default: undefined},
  accent: {type: String as PropType<FlipAccent>, default: 'cyan'},
  /** Opt-in: play the flip on a DECREASE too (deck-style readouts where
   *  shrinking is the ordinary announced event, not a rollback). */
  flipOnDecrease: {type: Boolean, default: false},
});
/** `flip-end` (the value shown): the one-shot swap finished — a scene that waits for the flip waits for THIS,
 *  never for a timer of its own (the generation scene, TR61). A snap (a decrease, a silent mount) emits nothing. */
const emit = defineEmits(['flip-end']);

const flow = useFlowScope('flip-value');
const shown = ref(props.value);
const shownText = ref(display(props.value, props.text));
const prevText = ref(display(props.value, props.text));
const flipping = ref(false);
/** The running flip is a DECREASE (rolls the other way). */
const falling = ref(false);
const flipNonce = ref(0);
/**
 * The running flip's end — the DISARM of a guaranteed release: `flip-end` is what a scene waits for, so it is
 * said at the flip's length OR when this readout leaves first (never dropped with the instance); a snap disarms it.
 */
let clearTimer: (() => void) | undefined;

function display(value: number, text: string | undefined): string {
  return text ?? String(value);
}
function stopFlip(): void {
  if (clearTimer !== undefined) {
    clearTimer();
    clearTimer = undefined;
  }
  flipping.value = false;
}

// The formatted text can change WITHOUT the value (a re-render / a
// locale swap) — keep the face in sync without ever flipping for it.
watch(() => props.text, (): void => {
  if (!flipping.value) {
    shownText.value = display(shown.value, props.text);
  }
});
watch(() => props.value, (next: number): void => {
  if (next === shown.value) {
    return;
  }
  const nextText = display(next, props.text);
  if (next < shown.value && !props.flipOnDecrease) {
    stopFlip();
    shown.value = next;
    shownText.value = nextText;
    return;
  }
  falling.value = next < shown.value;
  prevText.value = shownText.value;
  shown.value = next;
  shownText.value = nextText;
  flipNonce.value++; // re-keys the cards so a rapid re-flip restarts cleanly
  flipping.value = true;
  if (clearTimer !== undefined) {
    clearTimer();
  }
  clearTimer = flow.guarantee(motionMs(FLIP_TOTAL_MS), 'the readout\'s flip ends', () => {
    flipping.value = false;
    clearTimer = undefined;
    emit('flip-end', shown.value);
  });
});
</script>
