<template>
  <!-- A REAL <dialog> (top layer): native focus trap + the generic
       `dialog[open]` gamepad scope drives it (B = dialog-close → cancel). -->
  <dialog ref="dlg" class="con-quit" :class="{'con-quit--pad': padVisible}" @close="$emit('cancel')" @cancel.prevent="onNativeCancel">
    <div class="con-quit__card">
      <div class="con-task__kicker">
        <span class="con-task__kicker-mark" aria-hidden="true">◈</span>
        <span>{{ $t(title) }}</span>
      </div>
      <div class="con-quit__body">{{ $t(body) }}</div>

      <!-- Mouse / keyboard: explicit on-screen buttons. -->
      <div v-if="!padVisible" class="con-quit__actions">
        <!-- Cancel FIRST in DOM so a mis-click never lands on the destructive
             action by default. -->
        <button type="button" class="con-quit__btn" @click="$emit('cancel')">
          <span>{{ $t(cancelLabel) }}</span>
        </button>
        <button type="button" class="con-quit__btn con-quit__btn--danger" @click="$emit('confirm')">
          <span>{{ $t(confirmLabel) }}</span>
        </button>
      </div>

      <!-- Gamepad / console-native: no duplicated on-screen buttons — the A/B
           legend IS the control (A = confirm, B = cancel), so the dialog reads
           like a native console prompt. The confirm item stays a real focusable
           <button> (the focus engine's A = click the focused element); B is
           handled by the dialog-close scope (→ @close → cancel) and shown here
           only as a hint. -->
      <div v-else class="con-quit__pad">
        <button type="button" class="con-quit__pad-item con-quit__pad-item--confirm" @click="$emit('confirm')">
          <GamepadGlyph control="confirm" />
          <span>{{ $t(confirmLabel) }}</span>
        </button>
        <span class="con-quit__pad-item con-quit__pad-item--cancel">
          <GamepadGlyph control="back" />
          <span>{{ $t(cancelLabel) }}</span>
        </span>
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
 * dialog close → `cancel`).
 *
 * In gamepad/console-native mode the two on-screen buttons are dropped for a
 * bare A/B legend (they duplicated the gamepad control) — A confirms, B cancels.
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
  data() {
    return {prevHtmlOverflow: '', prevBodyOverflow: ''};
  },
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
    // Lock document scroll BEFORE showModal() so the modal's entrance can never
    // flash a legacy scrollbar: the <dialog> lives in the browser top layer, so
    // the page's own `overflow: hidden` can't contain its animated card — the
    // overflow bubbles to the viewport scroller (which can be <body>, hence we
    // lock BOTH). Setting it here (synchronously, pre-paint) means the first
    // painted frame is already locked, so there is no scrollbar to flash.
    const de = document.documentElement;
    this.prevHtmlOverflow = de.style.overflow;
    this.prevBodyOverflow = document.body.style.overflow;
    de.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const dlg = this.$refs.dlg as HTMLDialogElement | undefined;
    if (dlg !== undefined && typeof dlg.showModal === 'function' && !dlg.open) {
      dlg.showModal();
    }
  },
  beforeUnmount() {
    document.documentElement.style.overflow = this.prevHtmlOverflow;
    document.body.style.overflow = this.prevBodyOverflow;
  },
});
</script>
