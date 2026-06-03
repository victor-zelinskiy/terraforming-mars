<template>
  <div class="std-projects-overlay">
    <div class="std-projects-overlay-header">
      <div class="std-projects-overlay-title" v-i18n>Standard Projects</div>
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
        <div class="std-project-row-icon std-project-row-icon--sell"></div>
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
import {GameModel, StandardProjectModel} from '@/common/models/GameModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {PROJECT_VISUAL} from '@/client/components/overview/standardProjectVisuals';
import {SELL_PATENTS_RATE} from '@/client/components/handCards/sellPatentsState';

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
      return p.name;
    },
    findActionable(name: CardName) {
      const cards = this.actionableProjects?.cards;
      if (!cards) return undefined;
      return cards.find((c) => c.name === name && c.isDisabled !== true);
    },
    canUse(p: StandardProjectModel): boolean {
      return this.findActionable(p.name) !== undefined;
    },
    useTooltip(p: StandardProjectModel): string {
      if (!this.viewerActing) return 'Not your turn to take any actions';
      // viewerActing && !actionableProjects → the server has the viewer
      // on a non-action prompt right now (mid sub-action, e.g. picking
      // a colony after the Build Colony SP has fired, or picking a card
      // to discard, etc). The action OR is NOT in the wf tree, so we
      // can't drive ANY standard project — but lying with "not your
      // turn" misleads the player; they ARE acting, just on a different
      // step. Same message AwardsOverlay uses for this case.
      const cards = this.actionableProjects?.cards;
      if (!cards) return 'Finish your current action first';
      const entry = cards.find((c) => c.name === p.name);
      if (entry === undefined) return 'Action is not available right now';
      if (entry.isDisabled === true) return 'Not enough M€ or no valid placement';
      return 'Use this standard project';
    },
    displayedCost(p: StandardProjectModel): number {
      const actionable = this.findActionable(p.name);
      return actionable?.calculatedCost ?? p.cost;
    },
    rowClasses(p: StandardProjectModel): Record<string, boolean> {
      return {
        'std-project-row--actionable': this.canUse(p),
        'std-project-row--disabled': !this.canUse(p),
      };
    },
    onUseClick(p: StandardProjectModel): void {
      if (!this.canUse(p)) return;
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
