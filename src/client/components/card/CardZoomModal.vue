<template>
  <dialog ref="dialog" class="card-zoom-dialog" @click="onBackdropClick">
    <!--
      v40 fullscreen presentation rework:
        - Close × button removed; dismissal is backdrop click + Esc only
          (Esc is handled natively by <dialog> via the 'cancel' → 'close'
          event chain).
        - Container is flex-column: card on top, action slot below.
        - @click.stop on the container (NOT just inner pieces) keeps the
          backdrop dismiss working only when the click is genuinely
          outside the presentation area.
        - card-zoom-actions slot is always rendered (it reserves the
          space) but only fills with content when a parent supplies the
          'actions' slot — keeps a future action button addable without
          a relayout, while empty state shows nothing visible to the
          player.
    -->
    <div class="card-zoom-container" @click.stop>
      <div v-if="cardInstance" class="card-zoom-card">
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
            <CardTitle :title="card.name" :type="cardType"/>
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
      <div class="card-zoom-actions">
        <slot name="actions" />
      </div>
    </div>
  </dialog>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {showModal, windowHasHTMLDialogElement} from '@/client/components/HTMLDialogElementCompatibility';
import {CardModel} from '@/common/models/CardModel';
import {ClientCard} from '@/common/cards/ClientCard';
import {getCard, getCardOrThrow} from '@/client/cards/ClientCardManifest';
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

import dialogPolyfill from 'dialog-polyfill';

type Refs = {
  dialog: HTMLDialogElement;
};

export default defineComponent({
  name: 'CardZoomModal',
  components: {
    CardTitle,
    CardCost,
    CardTags,
    CardContent,
    CardRequirementsComponent,
    CardExpansion,
    CardResourceCounter,
    CardVictoryPoints,
  },
  props: {
    card: {
      type: Object as () => CardModel,
      required: true,
    },
    actionUsed: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    typedRefs(): Refs {
      return this.$refs as unknown as Refs;
    },
    // `cardInstance` returns undefined for unknown card names (e.g. custom cards
    // not registered in the manifest). The template guards every dependent
    // accessor with `v-if="cardInstance"`, so `card` (which throws on undefined)
    // is only ever evaluated when the card is known.
    cardInstance(): ClientCard | undefined {
      return getCard(this.card.name);
    },
    cardOrThrow(): ClientCard {
      return getCardOrThrow(this.card.name);
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
      return this.card.isSelfReplicatingRobotsCard === true || this.cardOrThrow.resourceType !== undefined;
    },
    resourceType(): CardResource {
      if (this.card.isSelfReplicatingRobotsCard === true) {
        return CardResource.RESOURCE_CUBE;
      }
      return this.cardOrThrow.resourceType ?? CardResource.RESOURCE_CUBE;
    },
    resourceAmount(): number {
      return this.card.resources || 0;
    },
    tags(): Array<Tag> {
      const tags = [...this.cardOrThrow.tags || []];
      tags.forEach((tag, idx) => {
        if (tag === Tag.CLONE && this.card.cloneTag !== undefined) {
          tags[idx] = this.card.cloneTag;
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
      return this.isProjectCard ? this.card.calculatedCost : undefined;
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
  methods: {
    show() {
      showModal(this.typedRefs.dialog);
    },
    close() {
      if (this.typedRefs.dialog.open) {
        this.typedRefs.dialog.close();
      }
    },
    onBackdropClick() {
      this.close();
    },
  },
  mounted() {
    if (!windowHasHTMLDialogElement()) {
      dialogPolyfill.registerDialog(this.typedRefs.dialog);
    }
    this.typedRefs.dialog.addEventListener('close', () => {
      this.$emit('close');
    });
  },
});
</script>
