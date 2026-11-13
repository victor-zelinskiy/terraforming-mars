<template>
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

<script setup vapor lang="ts">
/*
 * THE VENUS BONUS — the composer's ONE row (P89 · ledger EM — the owner, 2026-11-02: «pre-select надо доработать
 * внутренним шагом, иначе он слишком много забирает места»). The whole bonus — the 30 % wild, its card, the standard
 * spread — is answered INSIDE (`ConsoleVenusBonusStep`, A opens it); the row only READS: the label and the raise that
 * earned it («Шкала Венеры 16 % → 20 %»), then either what is still owed («Ресурсов: 2 · бонус 30 %») or the answer
 * in chips («[сталь] +1 [титан] +1 · [флоатер] +1 Дирижабли»). The two values share ONE grid cell and change by
 * opacity — answering moves nothing below the row; the row is one line tall at every state.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {getCard} from '@/client/cards/ClientCardManifest';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  VenusBonusParts, VenusBonusSummary, venusBonusMetaOf, venusBonusSummary, venusPreselectResponse, venusSpreadAmount, venusStepReading,
} from '@/client/console/venusBonus/venusBonusPreselect';

defineOptions({name: 'ConsoleVenusBonusRow'});
const props = defineProps({
  /** The step's own prompt model (`ActionPreviewStep` `venusBonus`). */
  input: {type: Object as PropType<PlayerInputModel>, required: true},
  parts: {type: Object as PropType<VenusBonusParts>, required: true},
});

const answered = computed((): boolean => {
  const meta = venusBonusMetaOf(props.input);
  return meta !== undefined && venusPreselectResponse(meta, props.parts) !== undefined;
});
const finalStep = computed((): boolean => {
  return venusBonusMetaOf(props.input)?.kind === 'final';
});
/** The standard units the bonus lays out before the wild is decided (the base; the 30 % finish is named beside). */
const standardCount = computed((): number => {
  const meta = venusBonusMetaOf(props.input);
  return meta === undefined ? 0 : (meta.kind === 'final' ? meta.baseCount : venusSpreadAmount(meta, {}));
});
const budgetText = computed((): string => {
  return translateTextWithParams('Resources to lay out: ${0}', [String(standardCount.value)]);
});
const stepReading = computed((): string => {
  return venusStepReading(venusBonusMetaOf(props.input));
});
const summary = computed((): VenusBonusSummary => {
  return venusBonusSummary(props.parts);
});
const cardIcon = computed((): string => {
  const card = summary.value.card;
  const resource = card === undefined ? undefined : getCard(card)?.resourceType;
  return resource === undefined ? '' : iconClassFor(cardResourceKey(String(resource)));
});
function iconClass(key: string): string {
  return iconClassFor(key);
}
</script>
