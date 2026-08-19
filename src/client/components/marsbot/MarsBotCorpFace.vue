<template>
  <!-- `premium-card-face` is registered GLOBALLY in main.ts — a static
       PremiumCard.vue import here would close the type cycle
       PremiumCard → CardZoomModal → CardZoomCard → MarsBotCorpFace and
       collapse vue-tsc inference to `{}` (see premium-card.md § Routing). -->
  <premium-card-face :vmOverride="vm"
                     :card="model"
                     :inert="true"
                     :lightweight="compact"
                     :artTier="large ? 'full' : 'thumb'" />
</template>

<script lang="ts">
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
import {defineComponent, PropType} from 'vue';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {CardModel} from '@/common/models/CardModel';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {buildMarsBotCorpPremiumVm, marsBotCorpCardModel} from './marsBotCorpPremiumVm';

export default defineComponent({
  name: 'MarsBotCorpFace',
  props: {
    id: {type: String as PropType<MarsBotCorpId>, required: true},
    /** Live resources ON the corporation card (Ecoline plant / Spire science). */
    resources: {type: Number, default: 0},
    /** Fullscreen tier (full-resolution art). */
    large: {type: Boolean, default: false},
    /** Dense hosts (tableau slot / dashboard) — the thumb quality tier. */
    compact: {type: Boolean, default: false},
  },
  computed: {
    vm(): PremiumCardVM {
      return buildMarsBotCorpPremiumVm(this.id, this.resources ?? 0);
    },
    model(): CardModel {
      return marsBotCorpCardModel(this.id, this.resources ?? 0);
    },
  },
});
</script>
