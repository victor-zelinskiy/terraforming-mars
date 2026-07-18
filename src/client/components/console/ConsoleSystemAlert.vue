<template>
  <div class="con-alert" role="alertdialog" :aria-label="$t('System error')">
    <div class="con-alert__backdrop" aria-hidden="true"></div>
    <div class="con-alert__card">
      <div class="con-alert__kicker">
        <span class="con-alert__mark" aria-hidden="true">!</span>
        <span>{{ $t('System error') }}</span>
      </div>
      <div v-if="titleText !== ''" class="con-alert__title">{{ $t(titleText) }}</div>
      <div class="con-alert__body">{{ $t(messageText) }}</div>
      <div class="con-alert__hint">
        <GamepadGlyph control="confirm" />
        <span>{{ $t('OK') }}</span>
        <span v-if="queued > 0" class="con-alert__queued">+{{ queued }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Console-native SYSTEM ALERT panel — the pad-navigable replacement for the
 * desktop native <dialog> alert (whose OK button the controller cannot
 * reach). Rendered whenever `consoleSystemAlertState.current` is set (server
 * outage, rejected input, unexpected response). ConsoleShell's intent chain
 * gives it top priority and dismisses it on A/B → `dismissConsoleAlert()`.
 *
 * Deliberately RED (@con-red) with an error kicker so the player reads it as
 * an ABNORMAL situation, not a routine prompt. The title/message are the
 * SAME English keys `App.showAlert()` passes, translated here (the Russian
 * values already live in ru/ui.json).
 */
import {defineComponent} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {consoleSystemAlertState} from '@/client/console/consoleSystemAlertState';

export default defineComponent({
  name: 'ConsoleSystemAlert',
  components: {GamepadGlyph},
  computed: {
    titleText(): string {
      return consoleSystemAlertState.current?.title ?? '';
    },
    messageText(): string {
      return consoleSystemAlertState.current?.message ?? '';
    },
    queued(): number {
      return consoleSystemAlertState.queue.length;
    },
  },
});
</script>
