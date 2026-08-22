<template>
  <!--
    The fullscreen card silhouette, extracted from CardZoomModal so it can be
    reused for BOTH the visible (navigable) card AND the off-screen preload
    neighbours without duplicating the markup or the per-card computeds.

    Renders nothing for an unknown card name (custom / unregistered cards).
    Since desktop-removal wave 4 EVERY real card type renders the premium
    face — the legacy silhouette branch is gone with legacy Card.vue.
  -->
  <!-- Automa BONUS card entry — the same stage, rendered as its own card face. -->
  <div v-if="bonusEntry !== undefined" class="card-zoom-card card-zoom-card--bonus">
    <BonusCardFace :id="bonusEntry.bonus" :ctx="bonusEntry.ctx" large />
  </div>

  <!-- MarsBot CORPORATION entry — the ordinary premium corporation face
       (bot rules in the mechanics zone, the 'automa' medallion); identity,
       art and lore ride the original. Same stage wrapper as any .pcard. -->
  <div v-else-if="corpEntry !== undefined" class="card-zoom-card card-zoom-card--premium">
    <MarsBotCorpFace :id="corpEntry.marsBotCorp" :resources="corpEntry.resources"
                     :resource="corpEntry.resource" large />
  </div>

  <!-- PREMIUM face — every real card type (tier `full`, inert: the modal
       owns interaction). `premium-card-face` is registered GLOBALLY in
       main.ts — a static import here would close the PremiumCard ->
       CardZoomModal -> CardZoomCard type cycle and collapse vue-tsc
       inference to `{}`. -->
  <div v-else-if="premiumFace"
       class="card-zoom-card card-zoom-card--premium"
       :class="{ 'card-zoom-card--selected': selected }">
    <premium-card-face :card="premiumModel" tier="full" :inert="true" :selected="selected" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {ClientCard} from '@/common/cards/ClientCard';
import {ZoomCard, BonusZoomEntry, MarsBotCorpZoomEntry, isBonusZoom, isMarsBotCorpZoom} from './cardZoomTypes';
import BonusCardFace from '@/client/components/marsbot/BonusCardFace.vue';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';
import {isPremiumFaceType} from '@/client/components/premiumCard/premiumCardTheme';
import {getCard} from '@/client/cards/ClientCardManifest';
import {liveCardResources} from '@/client/components/card/liveCardResources';

export default defineComponent({
  name: 'CardZoomCard',
  components: {
    BonusCardFace,
    MarsBotCorpFace,
  },
  props: {
    card: {
      type: Object as () => ZoomCard,
      required: true,
    },
    /*
     * When true, the card gets the strong "selected" presentation — multi-ring
     * cyan halo on the frame, slow pulsing aura, and a "ВЫБРАНО" / "SELECTED"
     * ribbon above the card. Used by BUY-mode card selection.
     */
    selected: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    /** An Automa bonus entry, or undefined for a normal project card. */
    bonusEntry(): BonusZoomEntry | undefined {
      return isBonusZoom(this.card) ? this.card : undefined;
    },
    /** A MarsBot corporation entry, or undefined otherwise. */
    corpEntry(): MarsBotCorpZoomEntry | undefined {
      return isMarsBotCorpZoom(this.card) ? this.card : undefined;
    },
    /** The project card (only the premium branch of the template reads this). */
    cardModel(): CardModel {
      return this.card as CardModel;
    },
    // `cardInstance` returns undefined for unknown card names (e.g. custom cards
    // not registered in the manifest) AND for a bonus entry (its `name` is a
    // BonusCardId, absent from the project manifest) — so the premium branch
    // never renders for a bonus or an unknown name.
    cardInstance(): ClientCard | undefined {
      return getCard(this.cardModel.name);
    },
    /** True when this card renders via the premium face (scope gate:
     *  isPremiumFaceType — every real card type since wave 4). */
    premiumFace(): boolean {
      const instance = this.cardInstance;
      return instance !== undefined && isPremiumFaceType(instance.type);
    },
    /** The model handed to the premium face, with the live-resource fallback baked in. */
    premiumModel(): CardModel {
      return {...this.cardModel, resources: this.resourceAmount};
    },
    resourceAmount(): number {
      // For a played card shown by name only (e.g. journal fullscreen), fall
      // back to the global live count so the counter isn't a stale 0. A card
      // that carries its own value (incl. a real 0) keeps it.
      return this.cardModel.resources ?? liveCardResources(this.cardModel.name) ?? 0;
    },
  },
});
</script>
