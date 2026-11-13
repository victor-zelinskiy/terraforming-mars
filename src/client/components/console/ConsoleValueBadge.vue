<template>
  <span class="con-valbadge"
        :class="['con-valbadge--' + variant, {
          'con-valbadge--wide': wide,
          'con-valbadge--pulse': pulsing,
        }]"
        role="img"
        :aria-label="label">
    <svg v-if="variant === 'vp'" class="con-valbadge__shield" viewBox="0 0 40 44"
         aria-hidden="true" focusable="false">
      <!-- ConsoleVpBadge's shield silhouette in flat fills (no <defs> — a
           badge renders many times over; same-id gradients collide and
           per-instance ids are pure overhead at this size). -->
      <path d="M4 3 H36 V24 L20 41 L4 24 Z" fill="#c99d4a"/>
      <path d="M4 3 H36 V24 L20 41 L4 24 Z" fill="none" stroke="rgba(58, 38, 8, 0.85)" stroke-width="1.6"/>
      <path d="M7.2 6.2 H32.8 V22.6 L20 36.6 L7.2 22.6 Z" fill="#131c29"/>
      <path d="M7.2 6.2 H32.8 V22.6 L20 36.6 L7.2 22.6 Z" fill="none" stroke="rgba(255, 255, 255, 0.10)" stroke-width="1"/>
    </svg>
    <span class="con-valbadge__text">{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
/*
 * A VALUE BADGE physically pinned to a rail icon's corner — the passive
 * information layer of the left rail. TWO variants, deliberately different
 * in SHAPE and MATERIAL (never colour alone):
 *
 *  · mc — the game's own megacredit tile (gold coin, dark engraved figure):
 *    «one unit of this resource replaces N M€». A dual-rate text («3/2»,
 *    Luna Trade Federation) swaps the square tile for a gold pill so the
 *    figures stay legible instead of shrinking inside the square.
 *  · vp — the console's own award shield (ConsoleVpBadge's silhouette, gold
 *    rim over graphite): «this tag currently earns N VP each» (or a vulgar
 *    fraction — ½ · ⅓ · 2⁄2 — for ratio scoring).
 *
 * Purely presentational + one micro-behaviour: when the VALUE changes for
 * the SAME displayed seat, a short scale pulse acknowledges the change
 * (transform/opacity only — console paint baseline). Switching the
 * inspected player swaps the whole context, so a scope change never pulses.
 * No focus, no input, no layout: position comes from the host's wrapper.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType, ref, watch} from 'vue';
import {FlowScope} from '@/client/console/kernel/flowScope';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

// jsdom (the unit runner) exposes no requestAnimationFrame by design — the
// re-arm frame is an optimization, not a contract, so fall through directly.
const nextFrame: (owner: FlowScope, cb: () => void) => void =
  typeof requestAnimationFrame === 'function' ? (owner, cb) => owner.afterFrame('the badge\'s pulse re-arms', cb) : (_owner, cb) => cb();

defineOptions({name: 'ConsoleValueBadge'});
const props = defineProps({
  /** mc — megacredit rate coin · vp — tag scoring shield. */
  variant: {type: String as PropType<'mc' | 'vp'>, required: true},
  /** The figure(s): '3', '3/2', '½', '2⁄2', … */
  text: {type: String, required: true},
  /** Full accessible sentence (the visible text is only the figure). */
  label: {type: String, required: true},
  /** 2+ characters → the compact/pill form (host model decides). */
  wide: {type: Boolean, default: false},
  /**
   * The displayed seat's identity (player color). A text change within ONE
   * scope is a real value change and pulses; a scope change (inspecting
   * another player) swaps context and must stay silent.
   */
  scopeKey: {type: String, default: ''},
});

const flow = useFlowScope('console-value-badge');
const pulsing = ref(false);
let cancelPulse = (() => {}) as () => void;
/** One watched identity so scope+text move atomically (no watcher races). */
const identity = computed((): {scope: string, text: string} => {
  return {scope: props.scopeKey, text: props.text};
});
function firePulse(): void {
  if (consoleReducedMotionActive()) {
    return; // reduced motion — the new figure is the whole story
  }
  const duration = consoleMotionMs(420);
  // Re-arm cleanly: drop the class for a frame so a rapid second change
  // restarts the animation instead of being swallowed mid-run.
  pulsing.value = false;
  cancelPulse();
  nextFrame(flow, () => {
    pulsing.value = true;
    cancelPulse = flow.after(duration, 'the badge\'s pulse ends', () => {
      pulsing.value = false;
    });
  });
}

watch(() => identity.value, (next: {scope: string, text: string}, prev: {scope: string, text: string}) => {
  if (next.scope === prev.scope && next.text !== prev.text) {
    firePulse();
  }
});
</script>
