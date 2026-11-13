<template>
  <span class="con-maprice"
        :data-ma-price-printed="printed !== undefined ? printed : undefined"
        :data-ma-price-source="waivedBy"
        role="img" :aria-label="label">
    <template v-if="printed !== undefined">
      <s class="con-maprice__printed" aria-hidden="true">{{ printed }}</s>
      <span class="con-maprice__arrow" aria-hidden="true">→</span>
    </template>
    <b class="con-maprice__value" aria-hidden="true">0</b>
    <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
    <PremiumModifierMarks class="con-maprice__seal" :sources="seal" />
  </span>
</template>

<script setup vapor lang="ts">
/*
 * A WAIVED MILESTONE / AWARD PRICE (PC01 · GO): the table's price STRUCK, «0 M€», the source's SEAL — the card
 * silhouette of a standing corporation effect, the same language as the requirement cassette's «under a modifier».
 * Material only: a strike, weight, the seal — never light, never a special fill (VISUAL RESTRAINT). It takes the
 * type size of the line it stands in (the overview chip, the exchange cell, a ladder step, the ceremony). WHICH card
 * is named in words once, by the detail's source line — here the seal and the aria sentence say it.
 *
 * The reading's KIND is stated by the host's own element (`data-ma-price-kind` — every kind, one place).
 */
import {computed, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import PremiumModifierMarks from '@/client/components/premiumCard/PremiumModifierMarks.vue';
import {ModifierSourceVM} from '@/client/components/premiumCard/premiumModifierSources';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

defineOptions({name: 'ConsoleMaWaivedPrice'});
const props = defineProps({
  /** The table's price that was waived — absent for a funded slot (the past is the 0 it went for). */
  printed: {type: Number as PropType<number | undefined>, default: undefined},
  waivedBy: {type: String as PropType<CardName>, required: true},
});

const seal = computed((): ReadonlyArray<ModifierSourceVM> => {
  return [{key: `card:${props.waivedBy}`, symbol: 'card', card: props.waivedBy, kind: 'waive', oneShot: false}];
});
const label = computed((): string => {
  const source = translateText(props.waivedBy);
  return props.printed !== undefined ?
    translateTextWithParams('Free thanks to ${0}: the price was ${1} M€', [source, String(props.printed)]) :
    translateTextWithParams('Free thanks to ${0}', [source]);
});
</script>
