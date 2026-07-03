<template>
  <!-- A REAL <dialog> (top layer): native focus trap + the generic
       `dialog[open]` gamepad scope drives it (B = dialog-close → cancel). -->
  <dialog ref="dlg" class="con-quit" @close="$emit('cancel')" @cancel.prevent="onNativeCancel">
    <div class="con-quit__card">
      <div class="con-task__kicker">
        <span class="con-task__kicker-mark" aria-hidden="true">◈</span>
        <span>{{ $t(title) }}</span>
      </div>
      <div class="con-quit__body">{{ $t(body) }}</div>
      <div class="con-quit__actions">
        <!-- Cancel FIRST in DOM: the pad focus lands here — an accidental
             double-press can never confirm the quit. -->
        <button type="button" class="con-quit__btn" @click="$emit('cancel')">
          <GamepadGlyph v-if="padVisible" control="confirm" class="con-quit__btn-glyph" />
          <span>{{ $t(cancelLabel) }}</span>
        </button>
        <button type="button" class="con-quit__btn con-quit__btn--danger" @click="$emit('confirm')">
          <span>{{ $t(confirmLabel) }}</span>
        </button>
      </div>
      <div class="con-quit__hint" aria-hidden="true">
        <span v-if="padVisible" class="con-quit__hint-item"><GamepadGlyph control="back" /><span>{{ $t('Cancel') }}</span></span>
      </div>
    </div>
  </dialog>
</template>

<script lang="ts">
/**
 * PREMIUM CONFIRM DIALOG — the console-native pre-game shell (P10).
 * A reusable, focus-trapped confirmation (the Electron ВЫЙТИ flow is the
 * first consumer). Built on a native `<dialog>` + `showModal()` so the
 * trap and the top layer are the PLATFORM's; the gamepad side rides the
 * existing generic `dialog[open]` scope (navigation + A = click, B =
 * dialog close → `cancel`). Cancel is FIRST in DOM — the initial pad
 * focus lands on the SAFE action, so a rapid double-press never confirms.
 */
import {defineComponent} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {inputModeState} from '@/client/gamepad/inputModeState';

export default defineComponent({
  name: 'ConsoleConfirmDialog',
  components: {GamepadGlyph},
  props: {
    title: {type: String, required: true},
    body: {type: String, required: true},
    confirmLabel: {type: String, default: 'Confirm'},
    cancelLabel: {type: String, default: 'Cancel'},
  },
  emits: ['confirm', 'cancel'],
  computed: {
    padVisible(): boolean {
      return inputModeState.mode === 'gamepad';
    },
  },
  methods: {
    /** Esc inside the dialog: route through our cancel (no bare close). */
    onNativeCancel(): void {
      this.$emit('cancel');
    },
  },
  mounted() {
    const dlg = this.$refs.dlg as HTMLDialogElement | undefined;
    if (dlg !== undefined && typeof dlg.showModal === 'function' && !dlg.open) {
      dlg.showModal();
    }
  },
});
</script>
