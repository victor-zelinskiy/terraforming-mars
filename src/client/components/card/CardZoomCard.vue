<template>
  <!--
    The fullscreen card silhouette, extracted from CardZoomModal so it can be
    reused for BOTH the visible (navigable) card AND the off-screen preload
    neighbours without duplicating the markup or the per-card computeds.

    Renders nothing for an unknown card name (custom / unregistered cards) —
    `v-if="cardInstance"` guards every dependent accessor, exactly as the old
    inline markup did inside CardZoomModal.
  -->
  <!-- Automa BONUS card entry — the same stage, rendered as its own card face. -->
  <div v-if="bonusEntry !== undefined" class="card-zoom-card card-zoom-card--bonus">
    <BonusCardFace :id="bonusEntry.bonus" :ctx="bonusEntry.ctx" large />
  </div>

  <!-- PREMIUM face (project cards + preludes) — the same stage/halo wrapper,
       the fork's from-scratch renderer inside (tier `full`, inert: the modal
       owns interaction). Out-of-scope types keep the legacy silhouette below.
       `premium-card-face` is registered GLOBALLY in main.ts — a static import
       here would close the PremiumCard -> CardZoomModal -> CardZoomCard type
       cycle and collapse vue-tsc inference to `{}`. -->
  <div v-else-if="premiumFace"
       class="card-zoom-card card-zoom-card--premium"
       :class="{ 'card-zoom-card--selected': selected }">
    <premium-card-face :card="premiumModel" tier="full" :inert="true" :selected="selected" />
  </div>

  <div v-else-if="cardInstance"
       class="card-zoom-card"
       :class="{ 'card-zoom-card--selected': selected }">
    <div class="card-container filterDiv card-auto-tall" v-i18n>
      <span class="card-corner card-corner--tl" aria-hidden="true"></span>
      <span class="card-corner card-corner--tr" aria-hidden="true"></span>
      <span class="card-corner card-corner--bl" aria-hidden="true"></span>
      <span class="card-corner card-corner--br" aria-hidden="true"></span>
      <div class="card-content-wrapper">
        <div v-if="!isStandardProject" class="card-cost-and-tags">
          <CardCost :amount="cost" :newCost="reducedCost" />
          <CardTags :tags="tags" />
        </div>
        <CardTitle :title="cardModel.name" :type="cardType"/>
        <CardContent
            :metadata="cardMetadata"
            :isCorporation="isCorporationCard"
            :bottomPadding="bottomPadding" />
      </div>
      <CardRequirementsComponent v-if="cardRequirements !== undefined && cardRequirements.length > 0" :requirements="cardRequirements" />
      <CardExpansion :expansion="cardExpansion" :isCorporation="isCorporationCard" :isResourceCard="isResourceCard" :compatibility="cardCompatibility" />
      <CardResourceCounter v-if="hasResourceType" :amount="resourceAmount" :type="resourceType" />
      <CardVictoryPoints v-if="cardMetadata.victoryPoints" :victoryPoints="cardMetadata.victoryPoints" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {ClientCard} from '@/common/cards/ClientCard';
import {ZoomCard, BonusZoomEntry, isBonusZoom} from './cardZoomTypes';
import BonusCardFace from '@/client/components/marsbot/BonusCardFace.vue';
import {isPremiumFaceType} from '@/client/components/premiumCard/premiumCardTheme';
import {getCard, getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {liveCardResources} from '@/client/components/card/liveCardResources';
import {CardType} from '@/common/cards/CardType';
import {CardMetadata} from '@/common/cards/CardMetadata';
import {Tag} from '@/common/cards/Tag';
import {CardResource} from '@/common/CardResource';
import {CardRequirementDescriptor} from '@/common/cards/CardRequirementDescriptor';
import {GameModule} from '@/common/cards/GameModule';
import CardTitle from './CardTitle.vue';
import CardCost from './CardCost.vue';
import CardTags from './CardTags.vue';
import CardContent from './CardContent.vue';
import CardRequirementsComponent from './CardRequirementsComponent.vue';
import CardExpansion from './CardExpansion.vue';
import CardResourceCounter from './CardResourceCounter.vue';
import CardVictoryPoints from './CardVictoryPoints.vue';

export default defineComponent({
  name: 'CardZoomCard',
  components: {
    CardTitle,
    CardCost,
    CardTags,
    CardContent,
    CardRequirementsComponent,
    CardExpansion,
    CardResourceCounter,
    CardVictoryPoints,
    BonusCardFace,
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
    /** The project card (only the project branch of the template reads this). */
    cardModel(): CardModel {
      return this.card as CardModel;
    },
    // `cardInstance` returns undefined for unknown card names (e.g. custom cards
    // not registered in the manifest) AND for a bonus entry (its `name` is a
    // BonusCardId, absent from the project manifest) — so the project branch
    // (`v-else-if="cardInstance"`) never renders for a bonus. `getCard` tolerates
    // the bonus id (returns undefined); `cardOrThrow` is only ever read from
    // inside the project branch, so it never sees a bonus id.
    cardInstance(): ClientCard | undefined {
      return getCard(this.cardModel.name);
    },
    cardOrThrow(): ClientCard {
      return getCardOrThrow(this.cardModel.name);
    },
    /** True when this card renders via the premium face (project + prelude). */
    premiumFace(): boolean {
      const instance = this.cardInstance;
      return instance !== undefined && isPremiumFaceType(instance.type);
    },
    /** The model handed to the premium face, with the live-resource fallback baked in. */
    premiumModel(): CardModel {
      return {...this.cardModel, resources: this.resourceAmount};
    },
    cardType(): CardType {
      return this.cardOrThrow.type;
    },
    cardMetadata(): CardMetadata {
      return this.cardOrThrow.metadata;
    },
    cardRequirements(): ReadonlyArray<CardRequirementDescriptor> | undefined {
      return this.cardOrThrow.requirements;
    },
    cardExpansion(): GameModule {
      return this.cardOrThrow.module;
    },
    cardCompatibility(): Array<GameModule> {
      return this.cardOrThrow.compatibility;
    },
    isCorporationCard(): boolean {
      return this.cardType === CardType.CORPORATION;
    },
    isProjectCard(): boolean {
      const type = this.cardType;
      return type === CardType.AUTOMATED || type === CardType.ACTIVE || type === CardType.EVENT;
    },
    isStandardProject(): boolean {
      return this.cardType === CardType.STANDARD_PROJECT || this.cardType === CardType.STANDARD_ACTION;
    },
    isResourceCard(): boolean {
      return this.cardOrThrow.resourceType !== undefined;
    },
    hasResourceType(): boolean {
      return this.cardModel.isSelfReplicatingRobotsCard === true || this.cardOrThrow.resourceType !== undefined;
    },
    resourceType(): CardResource {
      if (this.cardModel.isSelfReplicatingRobotsCard === true) {
        return CardResource.RESOURCE_CUBE;
      }
      return this.cardOrThrow.resourceType ?? CardResource.RESOURCE_CUBE;
    },
    resourceAmount(): number {
      // For a played card shown by name only (e.g. journal fullscreen), fall
      // back to the global live count so the counter isn't a stale 0. A card
      // that carries its own value (incl. a real 0) keeps it.
      return this.cardModel.resources ?? liveCardResources(this.cardModel.name) ?? 0;
    },
    tags(): Array<Tag> {
      const tags = [...this.cardOrThrow.tags || []];
      tags.forEach((tag, idx) => {
        if (tag === Tag.CLONE && this.cardModel.cloneTag !== undefined) {
          tags[idx] = this.cardModel.cloneTag;
        }
      });
      if (this.cardType === CardType.EVENT) {
        tags.push(Tag.EVENT);
      }
      return tags;
    },
    cost(): number | undefined {
      return this.isProjectCard ? this.cardOrThrow.cost : undefined;
    },
    reducedCost(): number | undefined {
      return this.isProjectCard ? this.cardModel.calculatedCost : undefined;
    },
    bottomPadding(): string {
      if (this.cardMetadata.victoryPoints !== undefined) {
        return 'long';
      }
      if (this.hasResourceType) {
        return 'short';
      }
      return '';
    },
  },
});
</script>
