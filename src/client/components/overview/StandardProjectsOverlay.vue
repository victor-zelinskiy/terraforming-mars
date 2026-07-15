<!--
@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
here cannot affect console. Fix only what breaks the shared layer or play.
See DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
-->
<template>
  <div class="std-projects-overlay">
    <div class="std-projects-overlay-header">
      <div class="std-projects-overlay-title-group">
        <div class="std-projects-overlay-title" v-i18n>Standard Projects</div>
        <!-- When the overlay is opened by a CARD (a top-level
             SelectStandardProjectToPlay, e.g. EstablishedMethods), show that
             card's prompt title so the player knows the context — not just the
             generic "Standard Projects" header. -->
        <div v-if="cardPromptTitle !== ''" class="std-projects-overlay-subtitle">{{ cardPromptTitle }}</div>
      </div>
      <div class="std-projects-overlay-close" @click="$emit('close')">✕</div>
    </div>

    <div class="std-projects-overlay-list">
      <div v-for="p in projects"
           :key="p.name"
           class="std-project-row"
           :class="rowClasses(p)"
           :data-hint="$t(useTooltip(p))">
        <!-- Project effect icon — pictogram representing what the project
             does (temperature gauge / energy bolt / ocean drop / greenery
             tile / etc). Uses the existing global-parameter / tile / resource
             assets the rest of the HUD uses; full sci-fi consistency. -->
        <div class="std-project-row-icon" :class="iconClassFor(p)"></div>

        <!-- Center column: name + short effect description. -->
        <div class="std-project-row-text">
          <div class="std-project-row-name" v-i18n>{{ nameFor(p) }}</div>
          <div class="std-project-row-desc" v-i18n>{{ descriptionFor(p) }}</div>
          <!-- Air Scrapping (Alternative Venus Board): name the per-Venus-tag
               discount the final price already reflects — "−3 за метки Венеры" —
               WITHOUT repeating the base 15 M€ (the right-side CTA already shows
               the resulting price). Hidden when there's no discount. -->
          <div v-if="discountFor(p) > 0"
               class="std-project-row-discount"
               :data-hint="$t('Discount for Venus tags')">
            <span class="std-project-row-discount-op">−</span>
            <span class="std-project-row-discount-amount">{{ discountFor(p) }}</span>
            <i class="std-project-row-discount-icon"></i>
            <span class="std-project-row-discount-label" v-i18n>per Venus tags</span>
          </div>
        </div>

        <!-- Right column: USE button with cost + M€ icon. Disabled state
             greyed out; a PREMIUM hover tooltip (data-hint, no native browser
             title) explains why. `aria-disabled` (not the real `disabled`
             attribute) so the button still receives :hover for the tooltip;
             the click is guarded in onUseClick. -->
        <button class="std-project-use-btn"
                :class="{
                  'std-project-use-btn--disabled': !canUse(p),
                }"
                :aria-disabled="!canUse(p)"
                @click.stop="onUseClick(p)"
                data-test="std-project-use">
          <span class="std-project-use-btn-label" v-i18n>Use</span>
          <span class="std-project-use-btn-cost">{{ displayedCost(p) }}</span>
          <i class="resource_icon std-project-use-btn-cost-icon resource_icon--megacredits"></i>
        </button>
      </div>

      <!-- Sell patents — a free standard project the server excludes from the
           project card list (`getStandardProjects` filters it out), so it gets
           a dedicated row. It does NOT submit here: clicking opens the КАРТЫ В
           РУКЕ overlay in sale mode, where the player picks cards and confirms. -->
      <div class="std-project-row std-project-row--sell"
           :class="{
             'std-project-row--actionable': sellPatentsAvailable,
             'std-project-row--disabled': !sellPatentsAvailable,
           }"
           :data-hint="$t(sellPatentsTooltip)">
        <div class="std-project-row-icon std-icon std-icon--sell-patents"></div>
        <div class="std-project-row-text">
          <div class="std-project-row-name" v-i18n>Patent sale</div>
          <div class="std-project-row-desc" v-i18n>Gain 1 M€ per card sold</div>
        </div>
        <button class="std-project-use-btn std-project-use-btn--gain"
                :class="{'std-project-use-btn--disabled': !sellPatentsAvailable}"
                :aria-disabled="!sellPatentsAvailable"
                @click.stop="onSellPatentsClick"
                data-test="std-project-sell-patents">
          <span class="std-project-use-btn-label" v-i18n>Use</span>
          <span class="std-project-use-btn-gain">+{{ SELL_PATENTS_RATE }}</span>
          <i class="resource_icon std-project-use-btn-cost-icon resource_icon--megacredits"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {GameModel, StandardProjectModel} from '@/common/models/GameModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {PROJECT_VISUAL} from '@/client/components/overview/standardProjectVisuals';
import {SELL_PATENTS_RATE} from '@/client/components/handCards/sellPatentsState';
import {translateText, translateMessage} from '@/client/directives/i18n';

export default defineComponent({
  name: 'StandardProjectsOverlay',
  props: {
    game: {
      type: Object as () => GameModel,
      required: true,
    },
    thisPlayer: {
      type: Object as () => PublicPlayerModel,
      required: true,
    },
    actionableProjects: {
      type: Object as PropType<SelectProjectCardToPlayModel | undefined>,
      default: undefined,
    },
    viewerActing: {
      type: Boolean,
      default: false,
    },
    // True when the "Sell patents" standard project can be started right now
    // (own seat + the action is offered + the player holds cards).
    sellPatentsAvailable: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close', 'use-project', 'sell-patents'],
  data() {
    return {
      SELL_PATENTS_RATE,
    };
  },
  computed: {
    projects(): ReadonlyArray<StandardProjectModel> {
      return this.game.standardProjects;
    },
    // Card-driven prompt title (e.g. EstablishedMethods' "Select your first
    // standard project"). Empty for the regular action-menu standard-projects
    // flow (title 'Standard projects') so the generic header stands alone.
    cardPromptTitle(): string {
      const t = this.actionableProjects?.title;
      if (t === undefined) {
        return '';
      }
      const text = typeof t === 'string' ? t : (t.message ?? '');
      if (text === '' || text === 'Standard projects') {
        return '';
      }
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    sellPatentsTooltip(): string {
      if (this.sellPatentsAvailable) {
        return 'Sell cards from your hand for 1 M€ each';
      }
      if (!this.viewerActing) {
        return 'Not your turn to take any actions';
      }
      if (this.thisPlayer.cardsInHandNbr === 0) {
        return 'No cards to sell';
      }
      return 'Finish your current action first';
    },
  },
  methods: {
    iconClassFor(p: StandardProjectModel): string {
      return PROJECT_VISUAL[p.name]?.iconClass ?? 'std-icon std-icon--generic';
    },
    descriptionFor(p: StandardProjectModel): string {
      return PROJECT_VISUAL[p.name]?.description ?? '';
    },
    nameFor(p: StandardProjectModel): string {
      // The Alternative Venus Board swaps in a discounted "Air Scrapping (Var)"
      // — but it's the SAME project to the player. Show the canonical name so no
      // internal "(альт.)" / "(Var)" service marker ever leaks into the UI.
      if (p.name === CardName.AIR_SCRAPPING_STANDARD_PROJECT_VARIANT) {
        return CardName.AIR_SCRAPPING_STANDARD_PROJECT;
      }
      return p.name;
    },
    isAirScrappingVariant(p: StandardProjectModel): boolean {
      return p.name === CardName.AIR_SCRAPPING_STANDARD_PROJECT_VARIANT;
    },
    // The Air Scrapping variant costs 1 M€ less per played Venus tag (max 5).
    // When the player is acting we trust the server's exact `calculatedCost`
    // (it already accounts for wild tags); otherwise estimate from the played
    // Venus tag count so the discount is still visible off-turn.
    discountFor(p: StandardProjectModel): number {
      if (!this.isAirScrappingVariant(p)) {
        return 0;
      }
      const actionable = this.findActionable(p.name);
      if (actionable?.calculatedCost !== undefined) {
        return Math.max(0, p.cost - actionable.calculatedCost);
      }
      return Math.min(5, this.thisPlayer.tags[Tag.VENUS] ?? 0);
    },
    findActionable(name: CardName) {
      const cards = this.actionableProjects?.cards;
      if (!cards) {
        return undefined;
      }
      return cards.find((c) => c.name === name && c.isDisabled !== true);
    },
    canUse(p: StandardProjectModel): boolean {
      return this.findActionable(p.name) !== undefined;
    },
    useTooltip(p: StandardProjectModel): string {
      if (!this.viewerActing) {
        return 'Not your turn to take any actions';
      }
      // viewerActing && !actionableProjects → the server has the viewer
      // on a non-action prompt right now (mid sub-action, e.g. picking
      // a colony after the Build Colony SP has fired, or picking a card
      // to discard, etc). The action OR is NOT in the wf tree, so we
      // can't drive ANY standard project — but lying with "not your
      // turn" misleads the player; they ARE acting, just on a different
      // step. Same message AwardsOverlay uses for this case.
      const cards = this.actionableProjects?.cards;
      if (!cards) {
        return 'Finish your current action first';
      }
      const entry = cards.find((c) => c.name === p.name);
      if (entry === undefined) {
        return 'Action is not available right now';
      }
      if (entry.isDisabled === true) {
        return 'Not enough M€ or no valid placement';
      }
      return 'Use this standard project';
    },
    displayedCost(p: StandardProjectModel): number {
      const actionable = this.findActionable(p.name);
      if (actionable?.calculatedCost !== undefined) {
        return actionable.calculatedCost;
      }
      // Off-turn the server sends no per-player cost. For the Air Scrapping
      // variant reflect the Venus-tag discount so the button isn't misleadingly
      // showing the full 15 M€ (the estimate only ever rounds the cost UP — the
      // raw tag count omits wild tags — so we never under-quote the real price).
      if (this.isAirScrappingVariant(p)) {
        return Math.max(0, p.cost - this.discountFor(p));
      }
      return p.cost;
    },
    rowClasses(p: StandardProjectModel): Record<string, boolean> {
      return {
        'std-project-row--actionable': this.canUse(p),
        'std-project-row--disabled': !this.canUse(p),
      };
    },
    onUseClick(p: StandardProjectModel): void {
      if (!this.canUse(p)) {
        return;
      }
      this.$emit('use-project', p.name);
    },
    // Sell patents does NOT submit from here — it opens the hand overlay in
    // sale mode. PlayerHome handles the rest (and the actual submit on confirm).
    onSellPatentsClick(): void {
      if (!this.sellPatentsAvailable) {
        return;
      }
      this.$emit('sell-patents');
    },
  },
});
</script>
