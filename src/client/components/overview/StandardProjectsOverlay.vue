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
           :class="rowClasses(p)">
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
             greyed out, tooltip explains why (not your turn / can't
             afford / no valid placement). -->
        <button class="std-project-use-btn"
                :class="{
                  'std-project-use-btn--disabled': !canUse(p),
                }"
                :disabled="!canUse(p)"
                :title="$t(useTooltip(p))"
                @click.stop="onUseClick(p)"
                data-test="std-project-use">
          <span class="std-project-use-btn-label" v-i18n>Use</span>
          <span class="std-project-use-btn-cost">{{ displayedCost(p) }}</span>
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
  },
  emits: ['close', 'use-project'],
  computed: {
    projects(): ReadonlyArray<StandardProjectModel> {
      return this.game.standardProjects;
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
  },
});
</script>
