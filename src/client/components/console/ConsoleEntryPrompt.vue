<template>
  <Teleport to="body">
    <div class="con-entry" role="dialog" :aria-label="$t('Controller detected')">
      <div class="con-entry__card">
        <div class="con-entry__title">{{ $t('Controller detected') }}</div>
        <div class="con-entry__body">{{ $t('Switch to the console interface? Optimized for TV and gamepad.') }}</div>
        <div class="con-entry__actions">
          <span class="con-entry__action con-entry__action--yes">
            <GamepadGlyph control="confirm" /><span>{{ $t('Switch') }}</span>
          </span>
          <span class="con-entry__action">
            <GamepadGlyph control="back" /><span>{{ $t('Stay here') }}</span>
          </span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
/**
 * The CONSENTED console-mode entry prompt (CONSOLE_MODE_CONCEPT.md §13):
 * shown once per session on the first gamepad input while in desktop mode.
 * A full layout swap must never be silent. Input is handled by
 * GamepadLayer (A = switch, B = stay) — this component is presentation.
 */
import {defineComponent} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'ConsoleEntryPrompt',
  components: {GamepadGlyph},
});
</script>
