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
      <div v-if="cardInstance"
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
      <!--
        Fullscreen action zone (v40-o redesign).

        Inner `__panel` wraps the buttons in a glassmorphic sci-fi
        strip so the controls read as the card's built-in lower
        chrome — not floating HTML buttons. L-corner accents on the
        panel match the bigger modal corners; the panel itself has
        a top/bottom cyan-tinted border and a soft underglow so it
        anchors visually to the card above.

        Layout:
          [ ЗАКРЫТЬ (secondary) ] ←gap→ [ ВЫБРАТЬ (primary slot) ]

        Order (left → right): secondary first, primary second. This
        matches modal/dialog convention (Cancel left, Confirm right)
        and means the player's "exit" affordance never sits where the
        cursor lands when they intend to commit. The 56-px gap keeps
        them visually separate even on touch devices.

        The slot is empty when fullscreen is opened from Card.vue's
        built-in path (no parent provided actions). In that case
        only the close button shows — sensible default for a pure
        preview view.
      -->
      <div class="card-zoom-actions">
        <div class="card-zoom-actions__panel">
          <span class="card-zoom-actions__corner card-zoom-actions__corner--tl" aria-hidden="true"></span>
          <span class="card-zoom-actions__corner card-zoom-actions__corner--tr" aria-hidden="true"></span>
          <span class="card-zoom-actions__corner card-zoom-actions__corner--bl" aria-hidden="true"></span>
          <span class="card-zoom-actions__corner card-zoom-actions__corner--br" aria-hidden="true"></span>
          <button class="card-zoom-actions__btn card-zoom-actions__btn--secondary"
                  @click="close"
                  data-test="card-zoom-close">
            <span v-i18n>Close</span>
          </button>
          <slot name="actions" />
        </div>
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
    /*
     * When true, the fullscreen card gets the strong "selected"
     * presentation — multi-ring cyan halo on the frame, slow
     * pulsing aura, and a "ВЫБРАНО" / "SELECTED" ribbon above
     * the card. Used by BUY-mode card selection: the player
     * toggles the card from inside the fullscreen and the
     * selected affordance has to be visible on the very card
     * they're inspecting, not just on the grid behind. DRAFT
     * mode never sets this (the modal closes before the state
     * changes).
     */
    selected: {
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
      // Fit card after the dialog is open so its natural size can be
      // measured against the actual viewport. nextTick ensures the
      // card's content has flowed before we read offsetHeight.
      this.$nextTick(() => this.fitCardToViewport());
    },
    close() {
      if (this.typedRefs.dialog.open) {
        this.typedRefs.dialog.close();
      }
    },
    onBackdropClick() {
      this.close();
    },
    /*
     * Dynamic fit-to-viewport zoom calculator. The static media-query
     * ladder in preferences.less worked for short cards but blew past
     * the viewport on tall ones (long Russian Venus translations,
     * corp cards with big logos + flavor text — user-flagged
     * "Биокуполы Фрейя" overflowing the top of the screen).
     *
     * Algorithm:
     *   1. Reset card's `zoom` to 1 so we can measure its natural,
     *      content-driven dimensions.
     *   2. Force a synchronous reflow (read offsetHeight) so the
     *      browser actually re-computes layout at zoom 1.
     *   3. Read natural width / height.
     *   4. Compute available viewport space (subtract container
     *      padding, gap, and the actions-slot reservation — ~140 px
     *      vertically, ~64 px horizontally).
     *   5. Compute the largest zoom that satisfies BOTH axes
     *      (min of width-fit and height-fit zoom).
     *   6. Clamp to [1.0, 2.8] so cards never shrink below readable
     *      or balloon past the previous ceiling.
     *   7. Apply via inline `zoom`. Inline beats the media-query CSS
     *      so the ladder becomes a graceful fallback only if JS
     *      never runs (e.g., scripting disabled).
     *
     * Runs on every show() and on window resize so a player who
     * resizes mid-game gets a re-fit.
     */
    fitCardToViewport(): void {
      const dialog = this.typedRefs.dialog;
      const cardEl = dialog.querySelector('.card-zoom-card .card-container.filterDiv') as HTMLElement | null;
      if (cardEl === null) return;

      // Step 1+2: reset to zoom 1 and force reflow for natural size.
      const previousZoom = cardEl.style.zoom;
      cardEl.style.zoom = '1';
      // Reading offsetHeight forces a synchronous layout pass.
      void cardEl.offsetHeight;

      const naturalWidth = cardEl.offsetWidth;
      const naturalHeight = cardEl.offsetHeight;
      if (naturalWidth === 0 || naturalHeight === 0) {
        // Card not rendered yet (e.g., display:none mid-transition).
        // Restore whatever was there and bail; next show / resize
        // will try again.
        cardEl.style.zoom = previousZoom;
        return;
      }

      // Step 4: available space. Numbers mirror .card-zoom-container's
      // padding (24+24=48) + gap (20) + actions-panel reservation (96
      // — v40-o panel is taller than the bare actions row to fit the
      // 52-px primary button + 18-px top/bottom padding + 1-px borders)
      // plus a small safety buffer (8).
      const chromeVertical = 48 + 20 + 96 + 8;
      const chromeHorizontal = 32 + 8;
      const availHeight = window.innerHeight - chromeVertical;
      const availWidth = window.innerWidth - chromeHorizontal;

      // Step 5: per-axis fit zoom.
      const zoomByHeight = availHeight / naturalHeight;
      const zoomByWidth = availWidth / naturalWidth;
      const fitZoom = Math.min(zoomByHeight, zoomByWidth);

      // Step 6: clamp to readable / aesthetic range.
      const MIN_ZOOM = 1.0;
      const MAX_ZOOM = 2.8;
      const finalZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));

      cardEl.style.zoom = String(finalZoom);
    },
  },
  mounted() {
    if (!windowHasHTMLDialogElement()) {
      dialogPolyfill.registerDialog(this.typedRefs.dialog);
    }
    this.typedRefs.dialog.addEventListener('close', () => {
      this.$emit('close');
    });
    // Re-fit on viewport resize so cards stay within bounds when the
    // player resizes the window with the modal open.
    window.addEventListener('resize', this.fitCardToViewport);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.fitCardToViewport);
  },
});
</script>
