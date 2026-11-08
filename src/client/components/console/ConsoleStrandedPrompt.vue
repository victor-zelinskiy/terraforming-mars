<template>
  <div class="con-stranded" role="alertdialog" :aria-label="$t('Awaiting decision')">
    <div class="con-stranded__backdrop" aria-hidden="true"></div>
    <div class="con-stranded__card">
      <div class="con-stranded__kicker">
        <span class="con-stranded__mark" aria-hidden="true">!</span>
        <span>{{ $t('Awaiting decision') }}</span>
      </div>
      <div v-if="stranded.title !== ''" class="con-stranded__title">{{ stranded.title }}</div>
      <div class="con-stranded__body">{{ $t('This prompt is not available in console mode yet.') }}</div>
      <div class="con-stranded__hint">
        <GamepadGlyph control="menu" />
        <span>{{ $t('System menu → «To main menu»: the game is saved — open it again to continue') }}</span>
      </div>
      <div v-if="debug" class="con-stranded__debug">waitingFor: {{ stranded.inputType }} → task: {{ stranded.taskKind }}</div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The honest STRANDED-PROMPT guard panel — CTS T0 (§CTS-7.3). Shown when
 * the leak detector finds a server prompt with NO serving surface in
 * console mode (the class behind the "only a pill" field bugs). The
 * player is told WHAT is pending and HOW to proceed (the system menu →
 * «В главное меню»: the game is saved, and opening it again re-primes the
 * prompt — the desktop shell this hint once pointed to is deleted), instead
 * of staring at a dead notification.
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {StrandedPrompt} from '@/client/console/consoleLeakDetector';
import {gamepadDebug} from '@/client/gamepad/gamepadSettings';

export default defineComponent({
  name: 'ConsoleStrandedPrompt',
  components: {GamepadGlyph},
  props: {
    stranded: {type: Object as PropType<StrandedPrompt>, required: true},
  },
  computed: {
    debug(): boolean {
      return gamepadDebug();
    },
  },
});
</script>
