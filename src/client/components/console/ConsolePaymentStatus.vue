<template>
  <!-- THE payment verdict — ONE element, ONE geometry, both densities.
       It is ALWAYS rendered and always occupies the SAME reserved height:
       exact / overpay / shortfall / free / auto differ only in colour and
       wording, never in size. That reservation is what keeps the «Разыграть»
       CTA from sliding up and down as the player dials LB/RB. -->
  <div class="con-paystatus" :class="['con-paystatus--' + status.kind, 'con-paystatus--' + mode]" role="status" :aria-label="ariaLabel">
    <span class="con-paystatus__glyph" aria-hidden="true">{{ glyph }}</span>

    <!-- The ledger: paid against the price, one tabular line. -->
    <span class="con-paystatus__ledger">
      <span class="con-paystatus__cap">{{ $t('Paid') }}</span>
      <b class="con-paystatus__paid">{{ status.paid }}</b>
      <span class="con-paystatus__sep" aria-hidden="true">/</span>
      <span class="con-paystatus__cost">{{ status.cost }}</span>
      <i class="resource_icon resource_icon--megacredits con-paystatus__icon" aria-hidden="true"></i>
    </span>

    <!-- The verdict phrase — «Точная оплата» / «Переплата +1» / «Не хватает 2». -->
    <span class="con-paystatus__verdict">
      <span class="con-paystatus__verdict-text">{{ $t(status.labelKey) }}</span>
      <template v-if="status.delta > 0">
        <b class="con-paystatus__delta">{{ deltaSign }}{{ status.delta }}</b>
        <i class="resource_icon resource_icon--megacredits con-paystatus__delta-icon" aria-hidden="true"></i>
      </template>
    </span>
  </div>
</template>

<script lang="ts">
/**
 * ConsolePaymentStatus — the shared «сколько уплачено / хватает ли» verdict of
 * the console-native payment panel. Purely presentational over the pure
 * `PaymentStatus` (buildPaymentView): the panel never re-derives a total, and
 * the compact summary and the expanded editor state the outcome IDENTICALLY.
 *
 * Layout-shift contract: the element is unconditional and its height is
 * reserved by `--con-pay-status-h` in every profile, so an appearing overpay
 * (or a vanishing shortfall) cannot resize the payment block — the exact bug
 * this component was introduced to kill.
 */
import {defineComponent, PropType} from 'vue';
import {PaymentStatus} from '@/client/console/paymentPlan';
import {translateText} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsolePaymentStatus',
  props: {
    status: {type: Object as PropType<PaymentStatus>, required: true},
    /** Density — expanded reads a notch larger; the reserved height is shared. */
    mode: {type: String as PropType<'compact' | 'expanded'>, default: 'compact'},
  },
  computed: {
    /** ✓ covered · ⚠ covered but wasteful · ✕ cannot be confirmed. */
    glyph(): string {
      switch (this.status.kind) {
      case 'overpay': return '⚠';
      case 'short':
      case 'impossible': return '✕';
      default: return '✓';
      }
    },
    deltaSign(): string {
      return this.status.kind === 'overpay' ? '+' : '';
    },
    ariaLabel(): string {
      const s = this.status;
      const head = `${translateText('Paid')}: ${s.paid} ${translateText('of')} ${s.cost} M€`;
      const verdict = s.delta > 0 ?
        `${translateText(s.labelKey)} ${this.deltaSign}${s.delta} M€` :
        translateText(s.labelKey);
      return `${head}. ${verdict}`;
    },
  },
});
</script>
