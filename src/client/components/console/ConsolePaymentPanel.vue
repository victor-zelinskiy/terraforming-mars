<template>
  <!-- PAYMENT — an INFO panel (resource chips + было → стало), NOT a button.
       ONE unified layout, shared by the play-card composer AND the blue-card
       action composer (одна премиум-раскладка): the SINGLE-alt case gets inline
       LB/RB pills on its chip; M€ is badged «авто»; LT opens the full editor
       when configurable. The panel only RENDERS the pure `PlayPaymentView`
       (buildPaymentView) — the host owns LB/RB/LT input, so it can never drift
       from the play flow. -->
  <div class="con-composer__pay">
    <div class="con-composer__pay-head">
      <span class="con-composer__pay-title">{{ $t('Payment') }}</span>
      <span class="con-composer__pay-cost">{{ $t('Cost') }}: <b>{{ cost }}</b></span>
      <span v-if="view.configurable" class="con-composer__pay-lt">
        <GamepadGlyph control="triggerL" /><span>{{ $t('Configure payment') }}</span>
      </span>
    </div>
    <div class="con-composer__pay-rows">
      <div v-for="(chip, k) in view.chips" :key="k"
           class="con-composer__pay-row" :class="{'con-composer__pay-row--adjustable': chip.isAdjustable}">
        <ActionEffectChip :effect="chip.effect" />
        <span v-if="chip.isAutoBalanced" class="con-composer__pay-badge">{{ $t('auto') }}</span>
        <span v-if="chip.isAdjustable" class="con-composer__pay-pills">
          <span class="con-composer__pay-pill" :class="{'con-composer__pay-pill--off': !chip.canDecrease}"><GamepadGlyph control="bumperL" /><span>−1</span></span>
          <span class="con-composer__pay-pill" :class="{'con-composer__pay-pill--off': !chip.canIncrease}"><GamepadGlyph control="bumperR" /><span>+1</span></span>
        </span>
        <span v-if="chip.isAdjustable" :key="'flash' + flashNonce" class="con-composer__pay-flash" aria-hidden="true"></span>
      </div>
      <span v-if="view.chips.length === 0" class="con-composer__pay-free">{{ cost === 0 ? $t('Free') : (cost + ' M€') }}</span>
    </div>
    <div v-if="!view.paymentValid" class="con-composer__pay-short">
      <span aria-hidden="true">⚠</span> {{ $t('Not enough resources') }}<template v-if="view.deficit > 0">:
        <i class="resource_icon resource_icon--megacredits con-composer__pay-short-icon" aria-hidden="true"></i> {{ view.deficit }}</template>
    </div>
    <!-- Overpay: a resource mix spends N M€ of value ABOVE the cost (unavoidable
         rate remainder). Flagged in orange so the wasted value is never silent. -->
    <div v-else-if="view.overpay > 0" class="con-composer__pay-over">
      <span class="con-composer__pay-over-glyph" aria-hidden="true">⚠</span>
      <span class="con-composer__pay-over-label">{{ $t('Overpaying') }}</span>
      <span class="con-composer__pay-over-amt">+{{ view.overpay }}</span>
      <i class="resource_icon resource_icon--megacredits con-composer__pay-over-icon" aria-hidden="true"></i>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * ConsolePaymentPanel — the ONE premium payment INFO panel for console-native
 * composers. Purely presentational: it renders a `PlayPaymentView` (icon chips
 * with «было → стало», the «авто» M€ lane, inline LB/RB quick-adjust pills, and
 * the LT «Configure payment» hint) in the SHARED `.con-composer__pay*` visual
 * language (styles live under `.con-composer` in console.less, so this panel
 * only ever mounts inside a `.con-composer` root). The host composer owns all
 * input (LB/RB quick-adjust, LT → the detailed lane editor); this component
 * NEVER mutates or emits — one premium payment language for both flows.
 */
import {defineComponent, PropType} from 'vue';
import {PlayPaymentView} from '@/client/console/paymentPlan';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';

export default defineComponent({
  name: 'ConsolePaymentPanel',
  components: {GamepadGlyph, ActionEffectChip},
  props: {
    /** The pure payment view-model (chips + quick-adjust eligibility). */
    view: {type: Object as PropType<PlayPaymentView>, required: true},
    /** The M€ cost being paid (shown as «Стоимость: N»). */
    cost: {type: Number, required: true},
    /** Bumped by the host on each quick-adjust to re-key the one-shot pulse. */
    flashNonce: {type: Number, default: 0},
  },
});
</script>
