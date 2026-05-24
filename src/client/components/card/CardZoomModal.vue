<template>
  <dialog ref="dialog" class="card-zoom-dialog" @click="onBackdropClick">
    <div class="card-zoom-container" @click.stop>
      <button class="card-zoom-close" @click="close()">&times;</button>
      <div class="card-zoom-card">
        <div class="card-container filterDiv card-auto-tall" v-i18n>
          <div class="card-content-wrapper">
            <div v-if="!isStandardProject" class="card-cost-and-tags">
              <CardCost :amount="cost" :newCost="reducedCost" />
              <CardTags :tags="tags" />
            </div>
            <CardTitle :title="card.name" :type="cardType"/>
            <CardContent
                :metadata="cardMetadata"
                :requirements="cardRequirements"
                :isCorporation="isCorporationCard"
                :bottomPadding="bottomPadding" />
          </div>
          <CardExpansion :expansion="cardExpansion" :isCorporation="isCorporationCard" :isResourceCard="isResourceCard" :compatibility="cardCompatibility" />
          <CardResourceCounter v-if="hasResourceType" :amount="resourceAmount" :type="resourceType" />
          <CardVictoryPoints v-if="cardMetadata.victoryPoints" :victoryPoints="cardMetadata.victoryPoints" />
        </div>
      </div>
    </div>
  </dialog>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {showModal, windowHasHTMLDialogElement} from '@/client/components/HTMLDialogElementCompatibility';
import {CardModel} from '@/common/models/CardModel';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
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
  data() {
    return {
      cardInstance: getCardOrThrow(this.card.name),
    };
  },
  computed: {
    typedRefs(): Refs {
      return this.$refs as unknown as Refs;
    },
    cardType(): CardType {
      return this.cardInstance.type;
    },
    cardMetadata(): CardMetadata {
      return this.cardInstance.metadata;
    },
    cardRequirements(): ReadonlyArray<CardRequirementDescriptor> | undefined {
      return this.cardInstance.requirements;
    },
    cardExpansion(): GameModule {
      return this.cardInstance.module;
    },
    cardCompatibility(): Array<GameModule> {
      return this.cardInstance.compatibility;
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
      return this.cardInstance.resourceType !== undefined;
    },
    hasResourceType(): boolean {
      return this.card.isSelfReplicatingRobotsCard === true || this.cardInstance.resourceType !== undefined;
    },
    resourceType(): CardResource {
      if (this.card.isSelfReplicatingRobotsCard === true) {
        return CardResource.RESOURCE_CUBE;
      }
      return this.cardInstance.resourceType ?? CardResource.RESOURCE_CUBE;
    },
    resourceAmount(): number {
      return this.card.resources || 0;
    },
    tags(): Array<Tag> {
      const tags = [...this.cardInstance.tags || []];
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
      return this.isProjectCard ? this.cardInstance.cost : undefined;
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
