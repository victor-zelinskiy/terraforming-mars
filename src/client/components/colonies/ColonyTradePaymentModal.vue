<template>
  <!--
    Pay-the-trade-fee picker. Mounted by PlayerHome AFTER the player has
    chosen WHICH colony to trade with — at that point the only thing
    server still needs is which payment option (M€ / titanium / energy /
    Floating Launch Pad / Darkside Smugglers / Collegium / Hecate /
    etc.) to use, encoded as a SelectOption inside the inner OrOptions
    "Pay trade fee" of the trade AndOptions.

    Hosted inside the existing MandatoryInputModal chrome (dark glass +
    L-corner ticks) — minimisable disabled because the player has already
    made the colony decision and is now committed to spending; deferring
    via "Minimise" would let the rest of the UI re-engage in a way that
    would risk submitting a second action on top of a still-open prompt.
  -->
  <div class="colony-trade-pay">
    <h3 class="colony-trade-pay__title" v-i18n>Pay trade fee</h3>
    <p class="colony-trade-pay__subtitle">
      <span v-i18n>Pick how to pay for trading with</span>
      <span class="colony-trade-pay__colony-name" v-i18n>{{ colonyName }}</span>
    </p>

    <div class="colony-trade-pay__options">
      <button v-for="(opt, idx) in options"
              :key="idx"
              class="colony-trade-pay__option"
              @click="$emit('select', idx)"
              :data-test="'colony-trade-pay-opt-' + idx">
        <span class="colony-trade-pay__option-label">{{ $t(opt.title) }}</span>
      </button>
    </div>

    <div class="colony-trade-pay__actions">
      <button class="colony-trade-pay__cancel"
              @click="$emit('cancel')"
              data-test="colony-trade-pay-cancel">
        <span v-i18n>Cancel</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {SelectOptionModel} from '@/common/models/PlayerInputModel';
import {Message} from '@/common/logs/Message';

export default defineComponent({
  name: 'ColonyTradePaymentModal',
  props: {
    colonyName: {
      type: String as () => ColonyName,
      required: true,
    },
    // The list of SelectOption children from the inner "Pay trade fee"
    // OrOptions. Their `.title` is already in human-friendly form
    // (`message('Pay ${0} energy', ...)` etc.) so we just translate +
    // render. The index of the clicked option is emitted back to the
    // host, which wraps it into the nested OrOptionsResponse.
    options: {
      type: Array as () => ReadonlyArray<SelectOptionModel>,
      required: true,
    },
  },
  emits: ['select', 'cancel'],
  methods: {
    titleText(t: string | Message): string {
      // No-op helper retained for symmetry with other modal content
      // components — the i18n template handles `string | Message` shapes
      // through `$t`, so we don't need to pre-process here.
      return typeof t === 'string' ? t : t.message;
    },
  },
});
</script>
