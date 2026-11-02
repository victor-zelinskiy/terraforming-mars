<template>
  <!-- THE VENUS BONUS — the composer's ONE row (P89 · ledger EM — the owner, 2026-11-02: «pre-select надо доработать
       внутренним шагом, иначе он слишком много забирает места»). The whole bonus — the 30 % wild, its card, the standard
       spread — is answered INSIDE (`ConsoleVenusBonusStep`, A opens it); the row only READS: the label and the raise that
       earned it («Шкала Венеры 16 % → 20 %»), then either what is still owed («Ресурсов: 2 · бонус 30 %») or the answer
       in chips («[сталь] +1 [титан] +1 · [флоатер] +1 Дирижабли»). The two values share ONE grid cell and change by
       opacity — answering moves nothing below the row; the row is one line tall at every state. -->
  <div class="con-venusrow" data-venus-bonus-row :data-venus-answered="answered ? '' : undefined">
    <div class="con-composer__row-label con-venusrow__label">
      <span>{{ $t('Venus bonus') }}</span>
      <span v-if="stepReading !== ''" class="con-venusrow__step" data-venus-step>{{ stepReading }}</span>
    </div>
    <div class="con-venusrow__value">
      <span class="con-venusrow__cell">
        <span class="con-venusrow__ask" :class="{'con-venusrow__face--off': answered}" :aria-hidden="answered ? 'true' : undefined">
          <span class="con-venusrow__budget">{{ budgetText }}</span>
          <template v-if="finalStep">
            <span class="con-venusrow__sep" aria-hidden="true">·</span>
            <span class="con-venusrow__final">{{ $t('Final step · 30 %') }}</span>
          </template>
        </span>
        <span class="con-venusrow__answer" :class="{'con-venusrow__face--off': !answered}" :aria-hidden="answered ? undefined : 'true'"
              data-venus-summary>
          <span v-for="u in summary.units" :key="u.key" class="con-venusrow__chip" :data-venus-summary-unit="u.key">
            <i class="con-venusrow__icon" :class="iconClass(u.key)" aria-hidden="true"></i><b>+{{ u.n }}</b>
          </span>
          <template v-if="summary.card !== undefined">
            <span class="con-venusrow__sep" aria-hidden="true">·</span>
            <span class="con-venusrow__chip con-venusrow__chip--card" :data-venus-summary-card="summary.card">
              <i v-if="cardIcon !== ''" class="con-venusrow__icon" :class="cardIcon" aria-hidden="true"></i><b>+1</b>
              <span class="con-venusrow__card">{{ $t(summary.card) }}</span>
            </span>
          </template>
        </span>
      </span>
      <span class="con-venusrow__door" aria-hidden="true">›</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateTextWithParams} from '@/client/directives/i18n';
import {getCard} from '@/client/cards/ClientCardManifest';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  VenusBonusParts, VenusBonusSummary, venusBonusMetaOf, venusBonusSummary, venusPreselectResponse, venusSpreadAmount, venusStepReading,
} from '@/client/console/venusBonus/venusBonusPreselect';

export default defineComponent({
  name: 'ConsoleVenusBonusRow',
  props: {
    /** The step's own prompt model (`ActionPreviewStep` `venusBonus`). */
    input: {type: Object as PropType<PlayerInputModel>, required: true},
    parts: {type: Object as PropType<VenusBonusParts>, required: true},
  },
  computed: {
    answered(): boolean {
      const meta = venusBonusMetaOf(this.input);
      return meta !== undefined && venusPreselectResponse(meta, this.parts) !== undefined;
    },
    finalStep(): boolean {
      return venusBonusMetaOf(this.input)?.kind === 'final';
    },
    /** The standard units the bonus lays out before the wild is decided (the base; the 30 % finish is named beside). */
    standardCount(): number {
      const meta = venusBonusMetaOf(this.input);
      return meta === undefined ? 0 : (meta.kind === 'final' ? meta.baseCount : venusSpreadAmount(meta, {}));
    },
    budgetText(): string {
      return translateTextWithParams('Resources to lay out: ${0}', [String(this.standardCount)]);
    },
    stepReading(): string {
      return venusStepReading(venusBonusMetaOf(this.input));
    },
    summary(): VenusBonusSummary {
      return venusBonusSummary(this.parts);
    },
    cardIcon(): string {
      const card = this.summary.card;
      const resource = card === undefined ? undefined : getCard(card)?.resourceType;
      return resource === undefined ? '' : iconClassFor(cardResourceKey(String(resource)));
    },
  },
  methods: {
    iconClass(key: string): string {
      return iconClassFor(key);
    },
  },
});
</script>
