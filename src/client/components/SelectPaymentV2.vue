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
        :showsave="controlled ? false : showsave"
        :buttonLabel="playerinput.buttonLabel"
        @change="onPaymentChange"
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
    /*
     * CONTROLLED mode (mirrors ModernPlayerPicker's `controlled`): the widget
     * never self-submits via `onsave`/a Confirm button — instead it emits the
     * live payment as a ready-to-batch `{type:'payment', payment}` response on
     * `@change` (PaymentFormV2 fires `change` immediately on mount with the
     * default payment, so the host has a valid response right away). Used inside
     * the card-action confirmation modal so the payment is dialed in there and
     * committed by the single ВЫПОЛНИТЬ — not as a separate follow-up modal.
     */
    controlled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['change'],
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
    onPaymentChange(p: Payment): void {
      this.payment = p;
      // In controlled mode re-emit the live payment as a ready-to-batch response
      // so the host (the action confirm modal) captures it without a Confirm
      // click. Emit `undefined` while the mix doesn't cover the cost, so the host
      // treats the step as UNANSWERED and keeps its CTA disabled (the player can't
      // submit an under-payment). Validity is computed HERE from cost/ledger (not
      // via the child form's ref) because the FIRST change fires during the
      // child's setup — before `$refs.paymentForm` is populated — so a ref-based
      // check would wrongly report the valid default payment as insufficient and
      // leave the CTA disabled on open. In normal mode the host's onsave/Save
      // button path commits instead.
      if (this.controlled) {
        this.$emit('change', this.paymentCoversCost(p) ? {type: 'payment', payment: p} : undefined);
      }
    },
    // Self-contained validity check (mirrors PaymentFormV2.canSave): the mix
    // covers the cost AND no row exceeds what's available. Ref-free so it's
    // correct on the very first change emitted during mount.
    paymentCoversCost(p: Payment): boolean {
      if (this.cost <= 0) {
        return true;
      }
      let total = 0;
      for (const unit of this.order) {
        if (p[unit] > this.ledger[unit].available) {
          return false;
        }
        total += p[unit] * this.ledger[unit].rate;
      }
      return total >= this.cost;
    },
    doSave(): void {
      this.onsave({type: 'payment', payment: this.payment});
    },
  },
});
</script>
