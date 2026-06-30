<template>
  <div class="card-container filterDiv hover-hide-res" :class="cardClasses" @click="onClick">
      <span class="card-corner card-corner--tl" aria-hidden="true"></span>
      <span class="card-corner card-corner--tr" aria-hidden="true"></span>
      <span class="card-corner card-corner--bl" aria-hidden="true"></span>
      <span class="card-corner card-corner--br" aria-hidden="true"></span>
      <div class="card-content-wrapper" v-i18n @mouseover="hovering = true" @mouseleave="hovering = false">
          <div v-if="!isStandardProject" class="card-cost-and-tags">
              <CardCost :amount="cost" :newCost="reducedCost" />
              <player-cube v-if="showPlayerCube" :color="cubeColor" :size="30"></player-cube>
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
      <CardExtraContent :card="card" />
      <slot/>
      <!--
        v40-p: Teleport the fullscreen modal to <body> so it escapes
        any ancestor that creates a containing block for
        `position: fixed` descendants. Repro that hit this: clicking
        a card inside the "ОТОБРАННЫЕ КАРТЫ" pile rendered the
        fullscreen modal small and offset to the top-left because
        the pile has `backdrop-filter: blur()`, and the card itself
        (.card-container.filterDiv) has `transform: translateY(-3px)`
        on hover — both create containing blocks. The dialog's
        `position: fixed` then anchored to the pile / card instead of
        the viewport, and the ancestor `zoom: 0.65` (pile cards are
        downscaled) compounded with the dialog's own `zoom: 2.5` to
        give a tiny final card.

        Teleporting to body sidesteps all three issues (transform,
        backdrop-filter, zoom). The `<dialog>` showModal() still
        works because `ref="zoomModal"` resolves to the actual
        component instance regardless of teleport position. Same
        for the @close emit.
      -->
      <Teleport to="body">
        <CardZoomModal v-if="showZoom" ref="zoomModal" :card="card" :actionUsed="actionUsed" @close="showZoom = false" />
      </Teleport>
  </div>
</template>

<script lang="ts">

import {defineComponent, nextTick} from 'vue';

import {CardModel} from '@/common/models/CardModel';
import {CARD_HELP_TEXT} from '@/client/cards/CardHelpText';
import CardTitle from './CardTitle.vue';
import CardResourceCounter from './CardResourceCounter.vue';
import CardCost from './CardCost.vue';
import CardExtraContent from './CardExtraContent.vue';
import CardExpansion from './CardExpansion.vue';
import CardTags from './CardTags.vue';
import CardVictoryPoints from './CardVictoryPoints.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import CardContent from './CardContent.vue';
import CardRequirementsComponent from './CardRequirementsComponent.vue';
import CardHelp from './CardHelp.vue';
import CardZoomModal from './CardZoomModal.vue';
import {CardType} from '@/common/cards/CardType';
import {CardMetadata} from '@/common/cards/CardMetadata';
import {Tag} from '@/common/cards/Tag';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {CardResource} from '@/common/CardResource';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {Color} from '@/common/Color';
import {CardRequirementDescriptor} from '@/common/cards/CardRequirementDescriptor';
import {GameModule} from '@/common/cards/GameModule';


export default defineComponent({
  name: 'Card',
  components: {
    'player-cube': PlayerCube,
    CardTitle,
    CardHelp,
    CardResourceCounter,
    CardCost,
    CardExtraContent,
    CardExpansion,
    CardTags,
    CardContent,
    CardRequirementsComponent,
    CardVictoryPoints,
    CardZoomModal,
  },
  props: {
    card: {
      type: Object as () => CardModel,
      required: true,
    },
    actionUsed: {
      type: Boolean,
      required: false,
      default: false,
    },
    robotCard: {
      type: Object as () => CardModel | undefined,
      required: false,
    },
    // Cube is only shown when actionUsed is true.
    cubeColor: {
      type: String as () => Color,
      required: false,
      default: 'neutral',
    },
    // When true, the card is automatically sized regardless of hover.
    autoTall: {
      type: Boolean,
      required: false,
      default: false,
    },
    /*
     * Lightweight render mode for DENSE, many-card surfaces (the played-cards
     * board). The card GRAPHIC is unchanged — this only drops cost: it skips
     * the hover-expand (`card-hover-tall`) behaviour and tags the card with
     * `card--lightweight` so the stylesheet can pare back the most expensive
     * non-essential effects (heavy shadows, hover filters) for this surface.
     * Off by default, so every other card surface (hand, draft, fullscreen,
     * selection modals) is byte-for-byte unchanged.
     */
    lightweight: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    const cardName = this.card.name;
    const card = getCardOrThrow(cardName);

    return {
      cardInstance: card,
      hovering: false,
      showZoom: false,
    };
  },
  computed: {
    cardExpansion(): GameModule {
      return this.cardInstance.module;
    },
    cardCompatibility(): Array<GameModule> {
      return this.cardInstance.compatibility;
    },
    isResourceCard(): boolean {
      if (this.cardInstance.resourceType !== undefined) {
        return true;
      } else {
        return false;
      }
    },
    tags(): Array<Tag> {
      const type = this.cardType;
      const tags = [...this.cardInstance.tags || []];
      tags.forEach((tag, idx) => {
        // Clone are changed on card implementations but that's not passed down directly through the
        // model, however, it sends down the `cloneTag` field. So this function does the substitution.
        if (tag === Tag.CLONE && this.card.cloneTag !== undefined) {
          tags[idx] = this.card.cloneTag;
        }
      });
      if (type === CardType.EVENT) {
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
    cardType(): CardType {
      return this.cardInstance.type;
    },
    cardClasses(): string {
      const classes = [];
      classes.push('card-' + this.card.name.toLowerCase().replaceAll(' ', '-'));

      if (this.card.isDisabled) {
        classes.push('card-unavailable');
      } else if (!getPreferences().experimental_ui && this.actionUsed) {
        classes.push('card-unavailable');
      }

      if (this.isStandardProject) {
        classes.push('card-standard-project');
      }
      if (this.lightweight) {
        classes.push('card--lightweight');
      }
      if (this.autoTall) {
        classes.push('card-auto-tall');
      } else if (getPreferences().experimental_ui && !this.lightweight) {
        // Lightweight surfaces (the dense played board) keep a fixed card
        // height — no hover-expand, so a crowded tableau never reflows on
        // hover and the peek-stack geometry stays stable.
        classes.push('card-hover-tall');
      }
      const learnerModeOff = !getPreferences().learner_mode;
      if (learnerModeOff && this.isStandardProject && this.card.isDisabled) {
        classes.push('card-hide');
      }
      return classes.join(' ');
    },
    cardMetadata(): CardMetadata {
      return this.cardInstance.metadata;
    },
    cardRequirements(): ReadonlyArray<CardRequirementDescriptor> | undefined {
      return this.cardInstance.requirements;
    },
    resourceAmount(): number {
      return this.card.resources || this.robotCard?.resources || 0;
    },
    isCorporationCard() : boolean {
      return this.cardType === CardType.CORPORATION;
    },
    isProjectCard(): boolean {
      const type = this.cardType;
      return type === CardType.AUTOMATED || type === CardType.ACTIVE || type === CardType.EVENT;
    },
    isStandardProject() : boolean {
      return this.cardType === CardType.STANDARD_PROJECT || this.cardType === CardType.STANDARD_ACTION;
    },
    hasResourceType(): boolean {
      return this.card.isSelfReplicatingRobotsCard === true || this.cardInstance.resourceType !== undefined || this.robotCard !== undefined;
    },
    resourceType(): CardResource {
      if (this.robotCard !== undefined || this.card.isSelfReplicatingRobotsCard === true) {
        return CardResource.RESOURCE_CUBE;
      }
      // This last RESOURCE_CUBE is functionally unnecessary and serves to satisfy the type contract.
      return this.cardInstance.resourceType ?? CardResource.RESOURCE_CUBE;
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
    hasHelpText(): boolean {
      return CARD_HELP_TEXT[this.card.name] !== undefined;
    },
    showPlayerCube(): boolean {
      return getPreferences().experimental_ui && this.actionUsed;
    },
  },
  methods: {
    /*
     * Steam-like UX: single click on ANY rendered card opens the
     * fullscreen zoom modal. Previously this fired on dblclick — kept
     * the preference key name (`fullscreen_cards_on_dblclick`) so saved
     * settings don't migrate, but the trigger and the dialog label both
     * read "single click" now.
     *
     * Parents that need to consume single clicks for their own purpose
     * (e.g. CardSelectionContent's per-card pick wrapper) intercept the
     * event via `@click.capture.stop` on a wrapping element before it
     * reaches this handler.
     */
    onClick() {
      if (!getPreferences().fullscreen_cards_on_dblclick) {
        return;
      }
      this.showZoom = true;
      nextTick(() => {
        (this.$refs as any).zoomModal?.show();
      });
    },
  },
});

</script>
