<template>
  <premium-card-face :vmOverride="vm"
                     :card="model"
                     :inert="true"
                     :lightweight="compact"
                     :artTier="large ? 'full' : 'thumb'" />
</template>

<script setup lang="ts">
/*
 * `<premium-card-face>` is the LAZY binding `PremiumCardFace` this script
 * imports from `components/asyncComponents.ts` (typed as a plain `Component`)
 * — a static PremiumCard.vue import here would close the type cycle
 * PremiumCard → CardZoomModal → CardZoomCard → MarsBotCorpFace and
 * collapse vue-tsc inference to `{}` (see premium-card.md § Routing).
 *
 * (This comment opened the template; the template starts with its root now.)
 */
/**
 * The MarsBot CORPORATION card — rendered ONE-TO-ONE through the ordinary
 * premium `.pcard` corporation template (title plate, tag rail, art or the
 * wordmark identity zone, the symbolic mechanics below the art, the resource
 * capsule, the expansion medallion). What differs from a human corporation is
 * exactly the printed difference: the mechanics rows are the BOT's boxes and
 * the medallion is the 'automa' stamp — all built by
 * `marsBotCorpPremiumVm.ts` from the official bot cards (C01/C02/C45), never
 * from the human manifest card, so no human rule or tag can leak. The FULL
 * rule text lives in the fullscreen viewer's right «§ ПРАВИЛА» panel
 * (`marsBotCorpRules.ts`), like every card's structured rules.
 */
import {computed, PropType} from 'vue';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {MarsBotCorpResource} from '@/common/automa/MarsBotCorpData';
import {CardModel} from '@/common/models/CardModel';
import {PremiumCardFace} from '@/client/components/asyncComponents';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {buildMarsBotCorpPremiumVm, marsBotCorpCardModel} from './marsBotCorpPremiumVm';

defineOptions({name: 'MarsBotCorpFace'});
const props = defineProps({
  id: {type: String as PropType<MarsBotCorpId>, required: true},
  /** Live resources ON the corporation card (Ecoline plant / Spire science). */
  resources: {type: Number, default: 0},
  /**
   * The KIND of that pile, when the card's slot takes more than one (C43
   * holds white OR black cubes). Absent ⇒ the card's own declared resource,
   * which is every other corporation.
   */
  resource: {type: String as PropType<MarsBotCorpResource>, default: undefined},
  /** Fullscreen tier (full-resolution art). */
  large: {type: Boolean, default: false},
  /** Dense hosts (tableau slot / dashboard) — the thumb quality tier. */
  compact: {type: Boolean, default: false},
});

const vm = computed((): PremiumCardVM => {
  return buildMarsBotCorpPremiumVm(props.id, props.resources ?? 0, props.resource);
});
const model = computed((): CardModel => {
  return marsBotCorpCardModel(props.id, props.resources ?? 0);
});
</script>
