<template>
  <div class="pass-confirm">
    <h3 class="pass-confirm__title" v-i18n>Convert heat</h3>
    <p class="pass-confirm__body" v-i18n>
      Converting heat now will spend heat without raising temperature.
    </p>

    <div class="pass-confirm__warn" data-test="convert-heat-max-temp-warn">
      <span class="pass-confirm__warn-icon" aria-hidden="true">!</span>
      <span class="pass-confirm__warn-text" v-i18n>
        Note: the temperature is already at its goal.
      </span>
    </div>

    <div class="pass-confirm__actions">
      <button class="pass-confirm__cancel-btn"
              @click="$emit('cancel')"
              data-test="convert-heat-cancel">
        <span class="pass-confirm__cancel-btn-label" v-i18n>Cancel</span>
      </button>
      <button class="pass-confirm__confirm-btn"
              @click="$emit('confirm')"
              data-test="convert-heat-confirm">
        <span class="pass-confirm__confirm-btn-label" v-i18n>Confirm</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'ConvertHeatConfirmContent',
  emits: ['confirm', 'cancel'],
});
</script>
