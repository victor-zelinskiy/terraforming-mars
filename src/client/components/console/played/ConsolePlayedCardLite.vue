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
    once. Nothing live is pinned over it either: stored card resources are
    read in «Информация» → «Доп. ресурсы» and on the card's own face in the
    fullscreen inspector, so a resource change never patches the table.
  -->
  <PremiumCard v-if="premium" :name="name" :inert="true" :lightweight="true" :peek="peek && !keepArt" aria-hidden="true" />
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
    /** COVERED in a pile: only the header band can show — the premium face
     *  renders its peek crop (no art <img>, no mechanics subtree). The legacy
     *  fallback face (CEO …) has no peek mode and stays full. */
    peek: {
      type: Boolean,
      required: false,
      default: false,
    },
    /**
     * KEEP THE ART — opt out of the peek crop while keeping every other
     * peek behaviour of the host (the strip still CLIPS the face to its
     * band; only the art/lower subtree stays mounted).
     *
     * The crop is an optimization for the FULL tableau, where a pile can be
     * dozens of covered cards and their arts would be pure cost. A surface
     * that holds a handful of them (the Game Start deployment shelf — one
     * corporation, a couple of preludes) pays nothing for the arts and pays
     * a real price for the crop: a covered card reads as a blank sliver
     * instead of itself, and every peek ↔ full swap re-mounts the art
     * subtree, so the picture flashes in late. Opt in ONLY there.
     */
    keepArt: {
      type: Boolean,
      required: false,
      default: false,
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
