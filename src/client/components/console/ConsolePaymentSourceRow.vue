<template>
  <!-- ONE payment SOURCE row — the atom shared by the compact summary and the
       expanded editor. Both densities render THIS markup: same icon, same
       name, same `available → remaining`, same «used», same M€ contribution,
       same order — INCLUDING the micro captions that name each number, which
       are what stop a column of bare numbers from being a puzzle in the quick
       summary. `mode` only changes how loud they read and whether the row can
       take the cursor — the geometry is identical in both, which is what makes
       LT read as "the same block opening up" instead of a jump to another
       screen. -->
  <div class="con-payrow"
       :class="{
         'con-payrow--auto': row.auto,
         'con-payrow--focused': focused,
         'con-payrow--idle': row.used === 0 && !focused,
         'con-payrow--live': row.used > 0,
         'con-payrow--dial': showPills,
         'con-payrow--reserved': row.reserved,
       }"
       :data-pay-unit="row.unit"
       role="group"
       :aria-label="ariaLabel">
    <i class="con-payrow__icon" :class="iconClass" aria-hidden="true"></i>

    <span class="con-payrow__ident">
      <span class="con-payrow__name">{{ $t(row.labelKey) }}</span>
      <!-- The payment VALUE of one unit — why 2 steel can pay 4 M€. Only ever
           shown when it is not 1 (M€ never carries a rate badge). -->
      <span v-if="row.rate > 1" class="con-payrow__rate">×{{ row.rate }}</span>
      <span v-if="row.reserved" class="con-payrow__reserved">{{ $t('reserved') }}</span>
    </span>

    <!-- USED — the primary number: how many units actually leave the player. -->
    <span class="con-payrow__cell con-payrow__cell--used">
      <span class="con-payrow__cap">{{ $t(usedCapKey) }}</span>
      <span class="con-payrow__used">{{ row.used }}</span>
    </span>

    <!-- STOCK — `before → after`, the SAME semantic in both densities. -->
    <span class="con-payrow__cell con-payrow__cell--stock">
      <span class="con-payrow__cap">{{ $t('Remaining') }}</span>
      <span class="con-payrow__stock">
        <span class="con-payrow__before">{{ row.available }}</span>
        <span class="con-payrow__arrow" aria-hidden="true">→</span>
        <span class="con-payrow__after">{{ row.remaining }}</span>
      </span>
    </span>

    <!-- CONTRIBUTION — what this source is worth against the price, in the
         price's own denomination (M€ for a card, energy for the trade fee). -->
    <span class="con-payrow__cell con-payrow__cell--worth">
      <span class="con-payrow__cap">{{ $t('Contribution') }}</span>
      <span class="con-payrow__worth">
        <span class="con-payrow__worth-num">{{ row.contribution }}</span>
        <i class="resource_icon con-payrow__worth-icon" :class="'resource_icon--' + costUnit" aria-hidden="true"></i>
      </span>
    </span>

    <!-- TAIL — a FIXED-width column so a badge/pill swap never nudges the
         numeric columns: the «авто» badge for the self-balancing M€ lane, or
         the LB/RB dial pills of the row the bumpers currently drive. -->
    <span class="con-payrow__tail">
      <span v-if="row.auto" class="con-payrow__auto">{{ $t('auto') }}</span>
      <span v-else-if="showPills" class="con-payrow__pills">
        <span class="con-payrow__pill" :class="{'con-payrow__pill--off': !row.canDecrease}">
          <GamepadGlyph control="bumperL" /><span>−1</span>
        </span>
        <span class="con-payrow__pill" :class="{'con-payrow__pill--off': !row.canIncrease}">
          <GamepadGlyph control="bumperR" /><span>+1</span>
        </span>
      </span>
    </span>

    <!-- One-shot pulse when the bumpers move THIS row (re-keyed nonce). -->
    <span v-if="showPills" :key="'flash' + flashNonce" class="con-payrow__flash" aria-hidden="true"></span>
  </div>
</template>

<script lang="ts">
/**
 * ConsolePaymentSourceRow — one row of the console-native payment panel.
 *
 * Purely presentational: every number comes from the pure `PaymentSourceRow`
 * (buildPaymentView), so the compact summary and the expanded editor can never
 * disagree about a resource — there is exactly one place the math lives. The
 * component never mutates and never emits; the host owns LB/RB/←→ input.
 *
 * Accessibility: the row is icon-led, so it carries a composed `aria-label`
 * naming the resource, what is spent, what remains and what it is worth.
 */
import {defineComponent, PropType} from 'vue';
import {PaymentSourceRow, paymentUnitIcon, paymentUnitLabel} from '@/client/console/paymentPlan';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsolePaymentSourceRow',
  components: {GamepadGlyph},
  props: {
    row: {type: Object as PropType<PaymentSourceRow>, required: true},
    /** Density — `compact` mutes the micro captions, `expanded` lifts them. */
    mode: {type: String as PropType<'compact' | 'expanded'>, default: 'compact'},
    /** The price's denomination — the contribution column's icon/aria unit. */
    costUnit: {type: String, default: 'megacredits'},
    /** The expanded editor's cursor is on this row (LB/RB drive it). */
    focused: {type: Boolean, default: false},
    /** Bumped by the host on each adjust to re-key the one-shot pulse. */
    flashNonce: {type: Number, default: 0},
  },
  computed: {
    iconClass(): string {
      // The LEDGER key is not the SPRITE key (`microbes` → `microbe`,
      // `auroraiData` → `data`, …) — one translation, in the pure model.
      return iconClassFor(paymentUnitIcon(this.row.unit));
    },
    /** The dial pills belong to the row the bumpers actually drive: the single
     *  quick-adjust lane on the compact screen, the focused lane when expanded. */
    showPills(): boolean {
      if (this.row.auto || !this.row.editable) {
        return false;
      }
      return this.mode === 'expanded' ? this.focused : this.row.quickAdjust;
    },
    /** The auto M€ lane does not "use" a chosen amount — it TOPS UP the rest. */
    usedCapKey(): string {
      return this.row.auto ? 'Tops up' : 'Used';
    },
    ariaLabel(): string {
      const r = this.row;
      const unit = this.costUnit === 'megacredits' ? 'M€' : translateText(paymentUnitLabel(this.costUnit));
      const parts = [
        translateText(r.labelKey),
        `${translateText(this.usedCapKey)}: ${r.used}`,
        `${translateText('Remaining')}: ${r.remaining} ${translateText('of')} ${r.available}`,
        `${translateText('Contribution')}: ${r.contribution} ${unit}`,
      ];
      if (r.auto) {
        parts.push(translateText('Paid automatically'));
      }
      return parts.join(', ');
    },
  },
});
</script>
