<template>
  <div class="payment-v2">
    <!-- Sci-fi glass frame with corner L-ticks. Title comes straight from
         the server (`SelectPaymentModel.title`) so it can carry context
         like "Select how to pay for City" without any extra translation. -->
    <div class="payment-v2__frame">
      <div class="payment-v2__corner payment-v2__corner--tl"></div>
      <div class="payment-v2__corner payment-v2__corner--tr"></div>
      <div class="payment-v2__corner payment-v2__corner--bl"></div>
      <div class="payment-v2__corner payment-v2__corner--br"></div>

      <header class="payment-v2__header" v-if="showtitle !== false">
        <div class="payment-v2__header-tab"></div>
        <h3 class="payment-v2__title">{{ $t(playerinput.title) }}</h3>
        <div class="payment-v2__cost-chip">
          <span class="payment-v2__cost-label" v-i18n>COST</span>
          <span class="payment-v2__cost-value">{{ cost }}</span>
          <i class="resource_icon payment-v2__cost-icon resource_icon--megacredits"></i>
        </div>
      </header>

      <PaymentFormV2
        ref="paymentForm"
        :cost="cost"
        :order="order"
        :ledger="ledger"
        :showsave="showsave"
        :buttonLabel="playerinput.buttonLabel"
        @change="(p) => payment = p"
        @save="doSave" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Payment} from '@/common/inputs/Payment';
import {SpendableResource} from '@/common/inputs/Spendable';
import {PaymentWidgetMixin} from '@/client/mixins/PaymentWidgetMixin';
import {SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectPaymentResponse} from '@/common/inputs/InputResponse';
import {Ledger} from '@/client/components/PaymentLedger';
import {Units} from '@/common/Units';
import PaymentFormV2 from '@/client/components/payment/PaymentFormV2.vue';
import {GENERIC_PAYMENT_ORDER, paymentOptionsAllowResource} from '@/client/components/payment/paymentModelUtils';

export default defineComponent({
  name: 'SelectPaymentV2',
  mixins: [PaymentWidgetMixin],
  components: {PaymentFormV2},
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectPaymentModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectPaymentResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
    },
    showtitle: {
      type: Boolean,
    },
  },
  computed: {
    // Same display order as V1: alternate resources first, MC last.
    // Filtered by `canUse` so only legal payment kinds are rendered.
    order(): ReadonlyArray<keyof Payment> {
      return GENERIC_PAYMENT_ORDER.filter(this.canUse);
    },
    ledger(): Ledger {
      return this.buildLedger(this.order, this.playerinput.reserveUnits ?? Units.EMPTY);
    },
  },
  created() {
    // PaymentWidgetMixin owns `cost` + `payment`. V1 sets cost on created();
    // mirror that here so PaymentFormV2 receives the right cost on mount.
    this.cost = this.playerinput.amount;
  },
  methods: {
    canUse(unit: SpendableResource): boolean {
      return paymentOptionsAllowResource(this.playerinput.paymentOptions, unit);
    },
    // Public — called by PlayerInputFactory when the host's submit button
    // is clicked (legacy radio-UI integration path).
    saveData(): void {
      const paymentForm = this.$refs.paymentForm as {handleSave: () => void} | undefined;
      if (paymentForm !== undefined) {
        paymentForm.handleSave();
      } else {
        this.doSave();
      }
    },
    // Public — used by hosts that gate their own submit button on a valid
    // payment (overlay flows, future "ИСПОЛЬЗОВАТЬ" / "РАЗЫГРАТЬ" buttons).
    canSave(): boolean {
      const paymentForm = this.$refs.paymentForm as {canSave: () => boolean} | undefined;
      return paymentForm?.canSave() ?? false;
    },
    doSave(): void {
      this.onsave({type: 'payment', payment: this.payment});
    },
  },
});
</script>
