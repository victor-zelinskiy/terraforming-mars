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
      right edge. Rendered ONLY when the server is currently offering the
      action (or the player is mid-picker, so they can cancel by clicking
      again). Keeping the button visible while NOT actionable was the old
      "permanent indicator" UX — but it conflicts with the rest of the
      fork's contract (action buttons appear when actionable, otherwise
      hide). The arrow follows the same visibility so it doesn't dangle
      next to the plants count between turns.
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
              :class="{'convert-action-btn--picking': convertPlantsPickerActive}"
              :title="$t(plantsTooltip)"
              v-on:click.stop="$emit('convert-plants')">
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
    // Button is rendered when the server currently offers the matching
    // convert action — which the server only does when it's the viewer's
    // turn AND the resource amount is sufficient (see ServerModel.ts's
    // `inActionSelection && ConvertX.canAct(player)` gate). The viewer
    // check is upstream: PlayerHome only passes `convertXAvailable` for
    // the viewer's own panel, and `isViewer` guards against panels
    // displaying other players. For convert-plants we also keep the
    // button visible while the picker is active so the player can cancel
    // it with a second click — the picker is a client-side mode where
    // the server-side action flag may flip false transiently as nothing
    // else.
    plantsButtonVisible(): boolean {
      return this.isViewer &&
        (this.convertPlantsAvailable || this.convertPlantsPickerActive);
    },
    heatButtonVisible(): boolean {
      return this.isViewer && this.convertHeatAvailable;
    },
    // Tooltip only needs to disambiguate the picker-mode case for plants;
    // the "not available" tooltip is gone because the button no longer
    // renders in that state.
    plantsTooltip(): string {
      if (this.convertPlantsPickerActive) return 'Click a greenery space on the board';
      return 'Convert plants into a greenery tile';
    },
    heatTooltip(): string {
      return 'Spend heat to raise temperature by 1 step';
    },
  },
  components: {
    'player-resource': PlayerResource,
  },
});
</script>
