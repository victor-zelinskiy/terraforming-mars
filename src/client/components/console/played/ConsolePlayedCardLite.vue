<template>
  <!--
    THE tableau card face of the «Разыграно» overlay — the cheapest honest
    printed face available:
     - premium-face types (project / prelude / corporation) render the REAL
       PremiumCard in name-only static mode at the THUMB quality tier
       (`lightweight` — no texture/glow/hover work), inert by construction;
     - out-of-scope types (CEO …) keep the legacy lite face via
       ConsoleCardFaceLite's own fallback branch.
    Zero live state, zero interactivity — one flat manifest lookup, rendered
    once; live extras (resource counters) are the SLOT's chips, never the
    card's (so a count change patches one chip, not a card subtree).
  -->
  <PremiumCard v-if="premium" :name="name" :inert="true" :lightweight="true" aria-hidden="true" />
  <ConsoleCardFaceLite v-else :name="name" />
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {isPremiumFaceType} from '@/client/components/premiumCard/premiumCardTheme';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

export default defineComponent({
  name: 'ConsolePlayedCardLite',
  components: {PremiumCard, ConsoleCardFaceLite},
  props: {
    name: {
      type: String as () => CardName,
      required: true,
    },
  },
  computed: {
    premium(): boolean {
      const type = getCard(this.name)?.type;
      return type !== undefined && isPremiumFaceType(type);
    },
  },
});
</script>
