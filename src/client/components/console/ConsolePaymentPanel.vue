<template>
  <!-- THE console-native payment surface — ONE component, TWO densities.
       `compact` is the summary that lives inside a composer next to the CTA;
       `expanded` is the same block opened up by LT for manual editing. Same
       rows, same order, same icons, same numbers, same verdict, same reserved
       geometry — the ONLY differences are the micro captions, the cursor and
       which rows can be dialed. That is what makes LT read as "this block
       unfolding" rather than a jump into a separate technical form.

       Purely presentational: the host owns every input (LB/RB quick-adjust,
       LT/B mode switch, ←→ and RT inside the editor). This component NEVER
       mutates and NEVER emits — so no payment surface can drift from the
       pure `buildPaymentView` rules. -->
  <div class="con-pay"
       :class="['con-pay--' + mode, {'con-pay--configurable': view.configurable, 'con-pay--blocked': !view.status.ok}]"
       role="group"
       :aria-label="panelLabel">
    <div class="con-pay__head">
      <span class="con-pay__title">{{ $t(titleKey) }}</span>

      <!-- The PRICE leads the block — everything below explains how it is met. -->
      <span class="con-pay__price">
        <span class="con-pay__price-label">{{ $t('Cost') }}</span>
        <b class="con-pay__price-value">{{ view.cost }}</b>
        <i class="resource_icon resource_icon--megacredits con-pay__price-icon" aria-hidden="true"></i>
      </span>

      <!-- The mode switch as a SECONDARY action OF THIS BLOCK (never a
           free-floating command): LT opens the editor, B folds it back. -->
      <span v-if="hint !== undefined" class="con-pay__hint">
        <GamepadGlyph :control="hint.control" /><span>{{ $t(hint.label) }}</span>
      </span>
    </div>

    <div class="con-pay__rows">
      <ConsolePaymentSourceRow v-for="row in view.rows" :key="row.unit"
                               :row="row"
                               :mode="mode"
                               :focused="mode === 'expanded' && row.unit === focusUnit"
                               :flash-nonce="flashNonce" />
    </div>

    <ConsolePaymentStatus :status="view.status" :mode="mode" />
  </div>
</template>

<script lang="ts">
/**
 * ConsolePaymentPanel — the ONE premium payment panel for every console-native
 * payment prompt: playing a project card, activating a blue-card action, the
 * standalone `SelectPayment` task and the colony trade. Each host feeds it the
 * pure `PaymentView` from `buildPaymentView` and picks a density:
 *
 *   compact  — the summary inside a composer (LB/RB drive the single alt lane,
 *              LT opens the editor);
 *   expanded — the same block with the micro captions spelled out, a cursor,
 *              and every lane dialable by hand.
 *
 * `titleKey` / `hintMode` let a host relabel the block for its context (a card
 * play vs a blue action vs a standalone prompt) WITHOUT forking the rows, the
 * verdict or the geometry.
 */
import {defineComponent, PropType} from 'vue';
import {PaymentView} from '@/client/console/paymentPlan';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsolePaymentSourceRow from '@/client/components/console/ConsolePaymentSourceRow.vue';
import ConsolePaymentStatus from '@/client/components/console/ConsolePaymentStatus.vue';
import {translateText} from '@/client/directives/i18n';

type PanelHint = {control: GlyphControl, label: string};

export default defineComponent({
  name: 'ConsolePaymentPanel',
  components: {GamepadGlyph, ConsolePaymentSourceRow, ConsolePaymentStatus},
  props: {
    /** The pure payment view-model — rows + verdict + editability. */
    view: {type: Object as PropType<PaymentView>, required: true},
    /** Density: the composer summary, or the LT editor. */
    mode: {type: String as PropType<'compact' | 'expanded'>, default: 'compact'},
    /** Expanded only — the unit the cursor sits on (LB/RB drive it). */
    focusUnit: {type: String, default: undefined},
    /** Bumped by the host on each adjust to re-key the one-shot pulse. */
    flashNonce: {type: Number, default: 0},
    /** The block heading — a host may name its own context. */
    titleKey: {type: String, default: 'Payment'},
    /**
     * `auto` renders the LT/B mode-switch hint inside the head (a composer,
     * where payment is one block among several); `none` suppresses it for a
     * host whose whole screen IS the payment (the standalone task), where the
     * bottom command bar already carries the controls.
     */
    hintMode: {type: String as PropType<'auto' | 'none'>, default: 'auto'},
  },
  computed: {
    hint(): PanelHint | undefined {
      if (this.hintMode === 'none') {
        return undefined;
      }
      if (this.mode === 'expanded') {
        return {control: 'back', label: 'Back to quick payment'};
      }
      return this.view.configurable ? {control: 'triggerL', label: 'Configure payment'} : undefined;
    },
    panelLabel(): string {
      return `${translateText(this.titleKey)}: ${translateText('Cost')} ${this.view.cost} M€`;
    },
  },
});
</script>
