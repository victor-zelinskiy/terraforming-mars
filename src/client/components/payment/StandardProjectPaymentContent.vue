<!--
@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
here cannot affect console. Fix only what breaks the shared layer or play.
See DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
-->
<template>
  <div class="payment-v2">
    <!--
      Sci-fi glass frame reused from SelectPaymentV2 — same look and feel,
      but the payment is CLIENT-SIDE (not yet submitted to the server).
      Confirm wraps the chosen payment into a `SelectProjectCardToPlayResponse`
      and POSTs; Cancel just closes the modal so the player stays on the
      Standard Projects overlay to pick differently.
    -->
    <div class="payment-v2__frame">
      <div class="payment-v2__corner payment-v2__corner--tl"></div>
      <div class="payment-v2__corner payment-v2__corner--tr"></div>
      <div class="payment-v2__corner payment-v2__corner--bl"></div>
      <div class="payment-v2__corner payment-v2__corner--br"></div>

      <header class="payment-v2__header">
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
        :showsave="false"
        :buttonLabel="playerinput.buttonLabel"
        @change="(p) => payment = p" />

      <!--
        Cancel + Confirm row. Cancel is UNIQUE to this client-side flow —
        the regular server-driven modals (Fund Award, WGT, etc.) cannot be
        cancelled because the server has already committed the prior step.
        Here we haven't sent anything yet, so the player can step back to
        the Standard Projects overlay without consequence.
      -->
      <div class="payment-v2__actions payment-v2__actions--with-cancel">
        <button class="payment-v2__cancel-btn"
                @click="$emit('cancel')"
                data-test="std-project-payment-cancel">
          <span class="payment-v2__cancel-btn-label" v-i18n>Cancel</span>
        </button>
        <button class="payment-v2__confirm-btn"
                :class="{'payment-v2__confirm-btn--disabled': !canConfirm()}"
                :disabled="!canConfirm()"
                @click="confirm"
                data-test="std-project-payment-confirm">
          <span class="payment-v2__confirm-btn-label">{{ $t(playerinput.buttonLabel) }}</span>
        </button>
      </div>
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
import {Ledger} from '@/client/components/PaymentLedger';
import {Units} from '@/common/Units';
import {sum} from '@/common/utils/utils';
import PaymentFormV2 from '@/client/components/payment/PaymentFormV2.vue';
import {STANDARD_PROJECT_PAYMENT_ORDER, paymentOptionsAllowResource} from '@/client/components/payment/paymentModelUtils';

export default defineComponent({
  name: 'StandardProjectPaymentContent',
  mixins: [PaymentWidgetMixin],
  components: {PaymentFormV2},
  // Same prop shape as SelectPaymentV2 — the host (PlayerHome) constructs
  // a `SelectPaymentModel` client-side from the picked project's data and
  // passes it down. We DON'T expose `onsave` here because this component
  // never POSTs directly; instead it emits `confirm` with the chosen
  // Payment so the host can wrap it as a `SelectProjectCardToPlayResponse`
  // (the right server-side shape) and submit through WaitingFor.onsave.
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectPaymentModel,
      required: true,
    },
  },
  emits: ['confirm', 'cancel'],
  computed: {
    order(): ReadonlyArray<keyof Payment> {
      return STANDARD_PROJECT_PAYMENT_ORDER.filter(this.canUse);
    },
    ledger(): Ledger {
      return this.buildLedger(this.order, this.playerinput.reserveUnits ?? Units.EMPTY);
    },
  },
  created() {
    this.cost = this.playerinput.amount;
  },
  methods: {
    canUse(unit: SpendableResource): boolean {
      return paymentOptionsAllowResource(this.playerinput.paymentOptions, unit);
    },
    // Mirrors PaymentFormV2.canSave() but reads `this.payment` (our local
    // reactive data — updated via the form's @change emitter) so Vue
    // properly re-evaluates when the player tweaks the resource mix.
    // Calling the form ref's `canSave()` directly DOESN'T trigger a
    // re-render because Vue can't track dependencies through a ref-method
    // call, so the disabled state would freeze at its initial value.
    //
    // Over-pay is allowed (matches PaymentFormV2 policy) — sometimes
    // unavoidable for rate > 1 resources. Wasteful 1:1 over-pay is
    // already prevented at the + button via rowMax in PaymentFormV2.
    canConfirm(): boolean {
      if (this.cost === 0) {
        return true;
      }
      const total = sum(this.order.map((unit) => this.payment[unit] * this.ledger[unit].rate));
      if (total < this.cost) {
        return false;
      }
      for (const unit of this.order) {
        if (this.payment[unit] > this.ledger[unit].available) {
          return false;
        }
      }
      return true;
    },
    confirm(): void {
      if (!this.canConfirm()) {
        return;
      }
      this.$emit('confirm', this.payment);
    },
  },
});
</script>
