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

    <!--
      Soft reminder (NOT an error — neutral amber) that the player still has
      activatable card / corporation actions they haven't used this turn. Only
      shown when there really are some. Easy to ignore, but prevents an
      accidental pass while a blue-card action sits unused.
    -->
    <div v-if="availableActions > 0" class="pass-confirm__warn" data-test="pass-confirm-warn">
      <span class="pass-confirm__warn-icon" aria-hidden="true">!</span>
      <span class="pass-confirm__warn-text">
        <span v-i18n>You still have unused available actions</span>:
        <span class="pass-confirm__warn-count">{{ availableActions }}</span>
      </span>
    </div>
    <div v-if="canTradeWithColony" class="pass-confirm__warn" data-test="pass-confirm-trade-warn">
      <span class="pass-confirm__warn-icon" aria-hidden="true">!</span>
      <span class="pass-confirm__warn-text" v-i18n>You still have a free trade fleet and can afford a colony trade</span>
    </div>
    <div v-if="canConvertPlants" class="pass-confirm__warn" data-test="pass-confirm-convert-plants-warn">
      <span class="pass-confirm__warn-icon" aria-hidden="true">!</span>
      <span class="pass-confirm__warn-text" v-i18n>You can still convert plants into greenery</span>
    </div>
    <div v-if="canConvertHeat" class="pass-confirm__warn" data-test="pass-confirm-convert-heat-warn">
      <span class="pass-confirm__warn-icon" aria-hidden="true">!</span>
      <span class="pass-confirm__warn-text" v-i18n>You can still convert heat into temperature</span>
    </div>

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
  props: {
    // Number of card / corporation actions the player can still activate this
    // turn. > 0 → a soft reminder is shown before they pass.
    availableActions: {
      type: Number,
      default: 0,
    },
    // Server-offered trade action. Means the player has a free fleet, can pay
    // one of the trade costs, and has at least one legal colony target.
    canTradeWithColony: {
      type: Boolean,
      default: false,
    },
    canConvertPlants: {
      type: Boolean,
      default: false,
    },
    canConvertHeat: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['confirm', 'cancel'],
});
</script>
