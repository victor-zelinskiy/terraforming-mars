<template>
  <!--
    Client-side confirmation for the Pass action. Hosted inside
    MandatoryInputModal — the modal supplies the dark backdrop, glass card,
    L-corner ticks, and minimize affordance; this component fills it with the
    warning message + Cancel/Confirm buttons. Cancel is safe because no
    server round-trip has happened yet (mirrors the cancel pattern used by
    StandardProjectPaymentContent).
  -->
  <div class="pass-confirm">
    <h3 class="pass-confirm__title" v-i18n>Pass for this generation</h3>
    <p class="pass-confirm__body" v-i18n>You will not be able to take any more actions this generation. Are you sure?</p>

    <div class="pass-confirm__actions">
      <button class="pass-confirm__cancel-btn"
              @click="$emit('cancel')"
              data-test="pass-confirm-cancel">
        <span class="pass-confirm__cancel-btn-label" v-i18n>Cancel</span>
      </button>
      <button class="pass-confirm__confirm-btn"
              @click="$emit('confirm')"
              data-test="pass-confirm-confirm">
        <span class="pass-confirm__confirm-btn-label" v-i18n>Confirm pass</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'PassConfirmContent',
  emits: ['confirm', 'cancel'],
});
</script>
