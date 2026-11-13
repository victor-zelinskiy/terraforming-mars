<template>
  <dialog ref="dialog">
    <form method="dialog">
      <p v-i18n class="newlines">{{ message }}</p>
      <!-- Optional rich content (e.g. the placement preview) between the prompt
           and the buttons. Empty for plain confirms — unchanged for them. -->
      <div class="confirm-dialog__slot"><slot /></div>
      <menu class="dialog-menu centered-content">
        <button class="btn btn-lg btn-primary" v-on:click="accept()" v-i18n>Yes</button>
        <button class="btn btn-lg" v-on:click="dismiss()" v-i18n>No</button>
      </menu>
      <template v-if="enableDontShowAgainCheckbox">
        <input type="checkbox" v-model="hide" id="dialog-confirm-dismiss" />
        <label for="dialog-confirm-dismiss" v-i18n>Don't show this again</label>
      </template>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import {onMounted, ref, useTemplateRef, watch} from 'vue';
import {showModal, windowHasHTMLDialogElement} from '@/client/components/HTMLDialogElementCompatibility';
import {vI18n} from '@/client/directives/vDirectives';

import dialogPolyfill from 'dialog-polyfill';


defineOptions({name: 'ConfirmDialog'});
defineProps({
  message: {
    type: String,
    required: true,
  },
  enableDontShowAgainCheckbox: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(['hide', 'accept', 'dismiss']);

const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const hide = ref(false);
function accept() {
  emit('accept');
}
function dismiss() {
  emit('dismiss');
}
function show() {
  const el = dialog.value;
  if (el === null) {
    return;
  }
  showModal(el);
}

watch(() => hide.value, () => {
  emit('hide', hide.value);
});
onMounted(() => {
  if (!windowHasHTMLDialogElement()) {
    const el = dialog.value;
    if (el === null) {
      return;
    }
    dialogPolyfill.registerDialog(el);
  }
});
// What `ConsoleBoardInput` reaches through its `ref="confirmation"` — `show()` — and nothing else.
defineExpose({show});
</script>
