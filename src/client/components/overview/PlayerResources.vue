<template>
  <div class="resource_items_cont">
    <player-resource
      :type="Resource.MEGACREDITS"
      :count="player.megacredits"
      :production="player.megacreditProduction"
      :resourceProtection="player.protectedResources.megacredits"
      :productionProtection="player.protectedProduction.megacredits"/>
    <player-resource
      :type="Resource.STEEL"
      :count="player.steel"
      :production="player.steelProduction"
      :value="player.steelValue"
      :resourceProtection="player.protectedResources.steel"
      :productionProtection="player.protectedProduction.steel"/>
    <!-- TODO LUNA TRADE FEDERATION -->
    <player-resource
      :type="Resource.TITANIUM"
      :count="player.titanium"
      :production="player.titaniumProduction"
      :value="player.titaniumValue"
      :resourceProtection="player.protectedResources.titanium"
      :productionProtection="player.protectedProduction.titanium"/>
    <!--
      Plants row carries the "Convert plants into a greenery" button on its
      right edge. The button is RENDERED whenever the viewer has at least
      `plantsNeededForGreenery` plants on hand — so it's a persistent visual
      cue that "you have enough to convert". Whether it's clickable is a
      separate state (`convertPlantsAvailable`) — server-side action gate.
      Picker mode (`--picking`) signals the user is currently choosing a
      space on the board.
    -->
    <div class="resource_item_wrapper" :class="{'resource_item_wrapper--with-convert': plantsButtonVisible}">
      <player-resource
        :type="Resource.PLANTS"
        :count="player.plants"
        :production="player.plantProduction"
        :resourceProtection="player.protectedResources.plants"
        :productionProtection="player.protectedProduction.plants"/>
      <span v-if="plantsButtonVisible" class="convert-action-arrow"></span>
      <button v-if="plantsButtonVisible"
              class="convert-action-btn convert-action-btn--plants"
              :class="{
                'convert-action-btn--disabled': !convertPlantsAvailable,
                'convert-action-btn--picking': convertPlantsPickerActive,
              }"
              :disabled="!convertPlantsAvailable && !convertPlantsPickerActive"
              :title="$t(plantsTooltip)"
              v-on:click.stop="onPlantsClick">
        <span class="convert-action-btn-icon convert-action-btn-icon--plant"></span>
        <span class="convert-action-btn-label" v-i18n>Spend</span>
        <span class="convert-action-btn-cost">{{ player.plantsNeededForGreenery }}</span>
      </button>
    </div>
    <player-resource
      :type="Resource.ENERGY"
      :count="player.energy"
      :production="player.energyProduction"
      :resourceProtection="player.protectedResources.energy"
      :productionProtection="player.protectedProduction.energy"/>
    <div class="resource_item_wrapper" :class="{'resource_item_wrapper--with-convert': heatButtonVisible}">
      <player-resource
        :type="Resource.HEAT"
        :count="player.heat"
        :production="player.heatProduction"
        :value="canUseHeatAsMegaCredits ? 1 : 0"
        :resourceProtection="player.protectedResources.heat"
        :productionProtection="player.protectedProduction.heat"/>
      <span v-if="heatButtonVisible" class="convert-action-arrow"></span>
      <button v-if="heatButtonVisible"
              class="convert-action-btn convert-action-btn--heat"
              :class="{'convert-action-btn--disabled': !convertHeatAvailable}"
              :disabled="!convertHeatAvailable"
              :title="$t(heatTooltip)"
              v-on:click.stop="$emit('convert-heat')">
        <span class="convert-action-btn-icon convert-action-btn-icon--temperature"></span>
        <span class="convert-action-btn-label" v-i18n>Spend</span>
        <span class="convert-action-btn-cost">{{ player.heatNeededForTemperature }}</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import PlayerResource from '@/client/components/overview/PlayerResource.vue';
import {Resource} from '@/common/Resource';

export default defineComponent({
  name: 'PlayerResources',
  props: {
    player: {
      type: Object as () => PublicPlayerModel,
      required: true,
    },
    // True iff the server currently offers the matching convert-action in
    // the player's action prompt. The button is RENDERED purely based on
    // resource amount; the action-available flag only controls the enabled
    // state (and click handler).
    convertHeatAvailable: {
      type: Boolean,
      default: false,
    },
    convertPlantsAvailable: {
      type: Boolean,
      default: false,
    },
    convertPlantsPickerActive: {
      type: Boolean,
      default: false,
    },
    // True when the player being displayed is the viewer themselves. The
    // convert-plants / convert-heat buttons are only meaningful for the
    // viewer — clicking on another player's resources should never give
    // you access to THEIR actions. When false the buttons (and the arrow
    // pointing to them) are not rendered at all; you still see the other
    // player's resource counts as before.
    isViewer: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['convert-heat', 'convert-plants'],
  computed: {
    Resource(): typeof Resource {
      return Resource;
    },
    // TODO LUNA TRADE FEDERATION
    canUseHeatAsMegaCredits(): boolean {
      return this.player.tableau.some((card) => card.name === CardName.HELION);
    },
    // Button is rendered when the resource amount is sufficient AND the
    // displayed player is the viewer — it serves as a permanent "you could
    // convert if it were your turn" indicator. Click-through is gated by
    // `convertXAvailable`. Never rendered when viewing another player —
    // their resources are visible for awareness only, not for actioning.
    plantsButtonVisible(): boolean {
      return this.isViewer && this.player.plants >= this.player.plantsNeededForGreenery;
    },
    heatButtonVisible(): boolean {
      return this.isViewer && this.player.heat >= this.player.heatNeededForTemperature;
    },
    plantsTooltip(): string {
      if (this.convertPlantsPickerActive) return 'Click a greenery space on the board';
      if (!this.convertPlantsAvailable) return 'Action is not available right now';
      return 'Convert plants into a greenery tile';
    },
    heatTooltip(): string {
      if (!this.convertHeatAvailable) return 'Action is not available right now';
      return 'Spend heat to raise temperature by 1 step';
    },
  },
  methods: {
    // Plants button click: only allow when the server is actually offering
    // the action (or the picker is already active, so the user can cancel
    // by clicking again).
    onPlantsClick(): void {
      if (!this.convertPlantsAvailable && !this.convertPlantsPickerActive) return;
      this.$emit('convert-plants');
    },
  },
  components: {
    'player-resource': PlayerResource,
  },
});
</script>
