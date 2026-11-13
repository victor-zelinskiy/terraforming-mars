<template>
  <transition name="con-dpile" :duration="duration" @after-leave="onAfterLeave">
    <div v-if="state.visible" ref="root" class="con-dpile" :style="rootStyle" aria-hidden="true"
         data-discard-pile
         :data-discard-pile-count="state.count"
         :data-discard-pile-expected="state.expected"
         :data-discard-pile-holders="state.holders.join(' ')">
      <div class="con-dpile__plate" :class="{'con-dpile__plate--armed': armed}">
        <div ref="stack" class="con-dpile__stack"
             :class="{'con-dpile__stack--empty': state.count === 0, 'con-dpile__stack--pulse': pulsing}"
             @animationend.self="pulsing = false">
          <!-- Thickness caps at three backs; the count carries the rest (the played-events pile's rule). -->
          <span v-if="state.count > 2" class="con-card-back con-dpile__back con-dpile__back--3"></span>
          <span v-if="state.count > 1" class="con-card-back con-dpile__back con-dpile__back--2"></span>
          <span v-if="state.count > 0" class="con-card-back con-dpile__back con-dpile__back--1"></span>
          <!-- The landing box a flying card aims at — before the first card it is the only thing drawn: a berth. -->
          <span ref="slot" class="con-dpile__slot"></span>
        </div>
        <div class="con-dpile__meta">
          <span class="con-dpile__label">{{ $t('DISCARDED') }}</span>
          <span class="con-dpile__row">
            <span class="con-dpile__count" data-discard-pile-number>
              <ConsoleFlipValue :value="state.count" accent="gold" />
            </span>
            <!-- R3 opens the pile's viewer while a reveal presents the batch it came from (the bar names the verb;
                 the glyph says WHICH pile it opens — never X, which inspects the current card). -->
            <span v-if="inspectable" class="con-dpile__hint" data-discard-pile-hint>
              <GamepadGlyph control="stickR" />
            </span>
          </span>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
/*
 * «СБРОШЕННЫЕ» — THE DISCARD PILE, one object of the table (discardPile.ts). Mounted ONCE by the shell; out while
 * some owner holds a lease. Its home is UNDER the HUD project deck: the plate SLIDES OUT from under the status strip
 * (the root clips at the strip's bottom edge), past the strip's chip lane — where the deck's own «−N» pops — and
 * rests a lane lower, its stack under the deck's stack; the thrown-away cards land on it face down, the count flips
 * on each contact, and the last lease released slides it back under the strip. Pointer-inert; the stack is the R3
 * viewer's physical origin.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue';
import {$t} from '@/client/directives/i18n';
import ConsoleFlipValue from '@/client/components/console/ConsoleFlipValue.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {discardPileState, noteDiscardPileClosed, registerDiscardPileEls} from '@/client/console/discardPile/discardPile';
import {cardDiscardState} from '@/client/console/cardDiscard/cardDiscardState';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

/** The slide out from under the strip, and back (BASE ms — the reduced-motion cap applies). */
const ENTER_MS = 260;
const LEAVE_MS = 240;

defineOptions({name: 'ConsoleDiscardPile'});

const slot = useTemplateRef<HTMLElement>('slot');
const stack = useTemplateRef<HTMLElement>('stack');
const state = discardPileState;
const pulsing = ref(false);
const rootStyle = computed((): Record<string, string> => {
  const a = state.anchor;
  return a === undefined ? {} : {left: `${a.left}px`, top: `${a.top}px`};
});
const duration = computed((): {enter: number, leave: number} => {
  return {enter: consoleMotionMs(ENTER_MS), leave: consoleMotionMs(LEAVE_MS)};
});
/** The pile WAITS for a card the hand is about to throw (the receiver lights up before the carry). */
const armed = computed((): boolean => {
  return cardDiscardState.trayArmed;
});
/** A reveal presents the batch these cards were thrown out of — R3 opens them (ConsoleRevealOverlay.openDiscards). */
const inspectable = computed((): boolean => {
  return state.holders.some((h) => h.startsWith('reveal:'));
});
function register(): void {
  registerDiscardPileEls(slot.value ?? undefined, stack.value ?? undefined);
}
function onAfterLeave(): void {
  register();
  noteDiscardPileClosed();
}

watch(() => state.visible, (): void => {
  register();
}, {flush: 'post'});
watch(() => state.pulseNonce, (nonce: number): void => {
  if (nonce === 0) {
    return;
  }
  // A one-shot that ends on its own `animationend` (no timer); restarted by a frame with the class off.
  pulsing.value = false;
  void nextTick(() => {
    pulsing.value = !consoleReducedMotionActive();
  });
});
onMounted(() => {
  register();
});
onBeforeUnmount(() => {
  registerDiscardPileEls(undefined, undefined);
});
</script>
