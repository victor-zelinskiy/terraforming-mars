<template>
  <!--
    LITE CARD FACE — the honest lightweight twin of <Card> used by the
    console motion cinematics (deal flyers, exit/transfer proxies).

    "The same card in lite mode → the same card in full mode": it renders
    the REAL face — frame, cost, tags, title, the full render-data content
    (icons, effect rows, description text), requirements plate, VP badge,
    expansion mark — via the same presentational components <Card> uses,
    so the player RECOGNISES the card mid-flight; nothing reads as an
    empty placeholder that "becomes" the real card on landing.

    What makes it LITE is not missing information but missing COST:
     - zero interactivity: no click/hover/zoom handlers, no Teleported
       CardZoomModal, no tooltips, pointer-events: none (the flight layers
       are inert by construction);
     - zero live state: no resource counter, no action-used cube, no
       disabled/hide preference logic — flight proxies always show the
       pristine printed face;
     - one flat manifest lookup instead of Card.vue's preference-aware
       computed web; render-once, never patched mid-flight (GSAP moves the
       composited layer, the DOM inside stays static).

    The `.card-container.filterDiv` + `.card-content-wrapper > .card-title`
    structure lights up the SAME sci-fi chassis frame, type-colour band and
    L-corner ticks (cards_scifi.less keys its `:has(...)` selectors off
    exactly this DOM shape). When card ART lands, `cardArtUrl` stays the
    ONE shared source for proxy and full face alike.
  -->
  <div class="card-container filterDiv con-card-lite" :class="rootClass" :style="artStyle" aria-hidden="true">
    <span class="card-corner card-corner--tl"></span>
    <span class="card-corner card-corner--tr"></span>
    <span class="card-corner card-corner--bl"></span>
    <span class="card-corner card-corner--br"></span>
    <div class="card-content-wrapper" v-i18n>
      <div v-if="isProjectCard" class="card-cost-and-tags">
        <CardCost :amount="cost" />
        <CardTags :tags="tags" />
      </div>
      <CardTitle :title="name" :type="cardType" />
      <CardContent v-if="cardMetadata !== undefined"
                   :metadata="cardMetadata"
                   :isCorporation="isCorporationCard"
                   :bottomPadding="bottomPadding" />
    </div>
    <CardRequirementsComponent v-if="cardRequirements !== undefined && cardRequirements.length > 0" :requirements="cardRequirements" />
    <CardExpansion v-if="cardInstance !== undefined" :expansion="cardInstance.module" :isCorporation="isCorporationCard" :isResourceCard="isResourceCard" :compatibility="cardInstance.compatibility" />
    <CardVictoryPoints v-if="cardMetadata !== undefined && cardMetadata.victoryPoints" :victoryPoints="cardMetadata.victoryPoints" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardMetadata} from '@/common/cards/CardMetadata';
import {CardRequirementDescriptor} from '@/common/cards/CardRequirementDescriptor';
import {Tag} from '@/common/cards/Tag';
import {ClientCard} from '@/common/cards/ClientCard';
import {getCard} from '@/client/cards/ClientCardManifest';
import {cardArtUrl} from '@/client/cards/cardArt';
import CardCost from '@/client/components/card/CardCost.vue';
import CardTags from '@/client/components/card/CardTags.vue';
import CardTitle from '@/client/components/card/CardTitle.vue';
import CardContent from '@/client/components/card/CardContent.vue';
import CardRequirementsComponent from '@/client/components/card/CardRequirementsComponent.vue';
import CardExpansion from '@/client/components/card/CardExpansion.vue';
import CardVictoryPoints from '@/client/components/card/CardVictoryPoints.vue';

export default defineComponent({
  name: 'ConsoleCardFaceLite',
  components: {CardCost, CardTags, CardTitle, CardContent, CardRequirementsComponent, CardExpansion, CardVictoryPoints},
  props: {
    name: {
      type: String as () => CardName,
      required: true,
    },
  },
  computed: {
    cardInstance(): ClientCard | undefined {
      return getCard(this.name);
    },
    cardType(): CardType {
      return this.cardInstance?.type ?? CardType.AUTOMATED;
    },
    isProjectCard(): boolean {
      const t = this.cardType;
      return t === CardType.AUTOMATED || t === CardType.ACTIVE || t === CardType.EVENT;
    },
    isCorporationCard(): boolean {
      return this.cardType === CardType.CORPORATION;
    },
    isResourceCard(): boolean {
      return this.cardInstance?.resourceType !== undefined;
    },
    cost(): number | undefined {
      return this.isProjectCard ? this.cardInstance?.cost : undefined;
    },
    tags(): Array<Tag> {
      const tags = [...(this.cardInstance?.tags ?? [])];
      if (this.cardType === CardType.EVENT) {
        tags.push(Tag.EVENT);
      }
      return tags;
    },
    cardMetadata(): CardMetadata | undefined {
      return this.cardInstance?.metadata;
    },
    cardRequirements(): ReadonlyArray<CardRequirementDescriptor> | undefined {
      return this.cardInstance?.requirements;
    },
    bottomPadding(): string {
      if (this.cardMetadata?.victoryPoints !== undefined) {
        return 'long';
      }
      return '';
    },
    rootClass(): string {
      // The same per-card class the full card carries (future art hooks
      // key off it).
      return 'card-' + this.name.toLowerCase().replaceAll(' ', '-');
    },
    artStyle(): Record<string, string> {
      const url = cardArtUrl(this.name);
      // Same art, same crop as the full card will use; no art → the real
      // printed face above (never a blur-up placeholder).
      return url !== undefined ? {backgroundImage: `url(${url})`} : {};
    },
  },
});
</script>
