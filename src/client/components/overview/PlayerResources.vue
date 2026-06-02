<template>
  <div class="resource_items_cont">
    <player-resource
      :type="Resource.MEGACREDITS"
      :count="player.megacredits"
      :production="player.megacreditProduction"
      :resourceProtection="player.protectedResources.megacredits"
      :productionProtection="player.protectedProduction.megacredits"
      :scopeKey="player.color"
      :epoch="epoch"/>
    <player-resource
      :type="Resource.STEEL"
      :count="player.steel"
      :production="player.steelProduction"
      :value="player.steelValue"
      :resourceProtection="player.protectedResources.steel"
      :productionProtection="player.protectedProduction.steel"
      :scopeKey="player.color"
      :epoch="epoch"/>
    <!-- TODO LUNA TRADE FEDERATION -->
    <player-resource
      :type="Resource.TITANIUM"
      :count="player.titanium"
      :production="player.titaniumProduction"
      :value="player.titaniumValue"
      :resourceProtection="player.protectedResources.titanium"
      :productionProtection="player.protectedProduction.titanium"
      :scopeKey="player.color"
      :epoch="epoch"/>
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
    <!--
      Plants row — convert-to-greenery action is native to the icon.
      When the server is offering the action AND we're not already
      in picker mode, the wrapper gains `--with-convert` +
      `--convert-plants` modifiers. CSS turns the wrapper into a
      keyboard-accessible button (role="button", tabindex 0), gives
      the resource icon a premium cyan glow + subtle pulse, and
      anchors a thin sci-fi arrow + cost chip outside the panel
      pointing INTO the icon as an attention cue. The chip itself
      is `pointer-events: none` — only the wrapper is clickable so
      "click the icon to spend" reads as the canonical interaction.
    -->
    <div class="resource_item_wrapper"
         :class="{
           'resource_item_wrapper--with-convert': plantsButtonVisible,
           'resource_item_wrapper--convert-plants': plantsButtonVisible,
         }"
         :tabindex="plantsButtonVisible ? 0 : -1"
         :role="plantsButtonVisible ? 'button' : undefined"
         :aria-label="plantsButtonVisible ? plantsTooltipText : undefined"
         @click.stop="onPlantsClick"
         @keydown.enter.prevent="onPlantsClick"
         @keydown.space.prevent="onPlantsClick"
         @mouseenter="onConvertHover('plants', $event)"
         @mouseleave="onConvertLeave"
         @focus="onConvertHover('plants', $event)"
         @blur="onConvertLeave">
      <player-resource
        :type="Resource.PLANTS"
        :count="player.plants"
        :production="player.plantProduction"
        :resourceProtection="player.protectedResources.plants"
        :productionProtection="player.protectedProduction.plants"
        :scopeKey="player.color"
        :epoch="epoch"/>
      <!--
        Shimmer overlay sits as a sibling of the icon, not as
        ::before/::after on the icon itself — the icon's pseudo
        elements are already owned by Spectre.css's tooltip system
        and a high-specificity override in player_home.less. See
        the comment above .convert-action-shimmer in resources.less.
      -->
      <span v-if="plantsButtonVisible"
            class="convert-action-shimmer"
            aria-hidden="true"></span>
      <span v-if="plantsButtonVisible"
            class="convert-action-arrow"
            aria-hidden="true"></span>
      <span v-if="plantsButtonVisible"
            class="convert-action-cost-badge convert-action-cost-badge--plants"
            aria-hidden="true">−{{ player.plantsNeededForGreenery }}</span>
    </div>
    <player-resource
      :type="Resource.ENERGY"
      :count="player.energy"
      :production="player.energyProduction"
      :resourceProtection="player.protectedResources.energy"
      :productionProtection="player.protectedProduction.energy"
      :scopeKey="player.color"
      :epoch="epoch"/>
    <!--
      Heat row — same native-icon convert pattern as plants above.
      See plants wrapper for the design rationale. The icon glows
      via CSS when --convert-heat is set; arrow + cost chip outside
      the panel serves as the attention cue.
    -->
    <div class="resource_item_wrapper"
         :class="{
           'resource_item_wrapper--with-convert': heatButtonVisible,
           'resource_item_wrapper--convert-heat': heatButtonVisible,
         }"
         :tabindex="heatButtonVisible ? 0 : -1"
         :role="heatButtonVisible ? 'button' : undefined"
         :aria-label="heatButtonVisible ? heatTooltipText : undefined"
         @click.stop="onHeatClick"
         @keydown.enter.prevent="onHeatClick"
         @keydown.space.prevent="onHeatClick"
         @mouseenter="onConvertHover('heat', $event)"
         @mouseleave="onConvertLeave"
         @focus="onConvertHover('heat', $event)"
         @blur="onConvertLeave">
      <player-resource
        :type="Resource.HEAT"
        :count="player.heat"
        :production="player.heatProduction"
        :value="canUseHeatAsMegaCredits ? 1 : 0"
        :resourceProtection="player.protectedResources.heat"
        :productionProtection="player.protectedProduction.heat"
        :scopeKey="player.color"
        :epoch="epoch"/>
      <span v-if="heatButtonVisible"
            class="convert-action-shimmer"
            aria-hidden="true"></span>
      <span v-if="heatButtonVisible"
            class="convert-action-arrow"
            aria-hidden="true"></span>
      <span v-if="heatButtonVisible"
            class="convert-action-cost-badge convert-action-cost-badge--heat"
            aria-hidden="true">−{{ player.heatNeededForTemperature }}</span>
    </div>

    <!--
      Premium hover/focus preview for the convert actions — the same
      compact card the journal uses for standard actions (pictogram +
      name + effect), replacing the old CSS text tooltip. `prefer="right"`
      so it opens toward the board (these buttons sit on the LEFT panel).
      Teleported to body, so its position in this tree is irrelevant.
    -->
    <StandardProjectPreviewPopover
      :name="CardName.CONVERT_PLANTS"
      :visible="convertHover === 'plants'"
      :anchor="convertAnchor"
      prefer="right" />
    <StandardProjectPreviewPopover
      :name="CardName.CONVERT_HEAT"
      :visible="convertHover === 'heat'"
      :anchor="convertAnchor"
      prefer="right" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import PlayerResource from '@/client/components/overview/PlayerResource.vue';
import StandardProjectPreviewPopover from '@/client/components/journal/StandardProjectPreviewPopover.vue';
import {Resource} from '@/common/Resource';
import {translateTextWithParams, translateText} from '@/client/directives/i18n';

type ConvertResourcesModel = {
  // Which convert button is currently hovered / focused (drives the
  // premium preview popover), or null when none.
  convertHover: 'plants' | 'heat' | null;
  // Viewport rect of the hovered convert button, for popover positioning.
  convertAnchor: DOMRect | undefined;
};

export default defineComponent({
  name: 'PlayerResources',
  data(): ConvertResourcesModel {
    return {
      convertHover: null,
      convertAnchor: undefined,
    };
  },
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
    /*
     * Game-session identifier (typically `playerView.runId`). Forwarded
     * to each PlayerResource → AnimatedMetricValue so that a new game
     * session re-baselines change-feedback values without manual
     * reset. Empty string is acceptable; the feedback manager treats
     * unspecified epoch as a stable scope.
     */
    epoch: {
      type: String,
      default: '',
    },
  },
  emits: ['convert-heat', 'convert-plants'],
  computed: {
    Resource(): typeof Resource {
      return Resource;
    },
    CardName(): typeof CardName {
      return CardName;
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
    // displaying other players.
    //
    // While the picker is active the button HIDES — the
    // PlacementBanner (top of viewport) is now the single source of
    // truth for "you have a pending placement", and the player cancels
    // through the banner's details modal rather than by hunting for the
    // toggled-on button on the resource panel. Removing the button
    // also prevents an awkward double-affordance (banner says "click
    // board / open details to cancel", button still sits there in a
    // toggled-on state).
    plantsButtonVisible(): boolean {
      return this.isViewer &&
        this.convertPlantsAvailable &&
        !this.convertPlantsPickerActive;
    },
    heatButtonVisible(): boolean {
      return this.isViewer && this.convertHeatAvailable;
    },
    /*
     * Hover / focus tooltip text for the convert-plants row + the
     * matching aria-label for screen readers. Both use the same
     * string so what the eye sees is what the screen reader hears.
     *
     * Format includes the DYNAMIC cost value (Ecoline corp → 7,
     * baseline → 8, future card effects could push higher). The
     * parameterised i18n key "Spend ${0} plants to place a greenery
     * tile" goes through `translateTextWithParams` so the
     * Russian translation also gets the cost number substituted.
     *
     * Picker-mode special-case: while the player is already in the
     * greenery-placement picker, the tooltip switches to "Click a
     * greenery space on the board" — that's the actionable next
     * step at that moment. (Note: in the same picker-mode the row
     * isn't visually treated as a convert button — plantsButtonVisible
     * is false when convertPlantsPickerActive is true — so the
     * tooltip wouldn't normally show. Kept for defensive consistency.)
     */
    plantsTooltipText(): string {
      if (this.convertPlantsPickerActive) {
        return translateText('Click a greenery space on the board');
      }
      if (!this.plantsButtonVisible) {
        return '';
      }
      return translateTextWithParams(
        'Spend ${0} plants to place a greenery tile',
        [String(this.player.plantsNeededForGreenery)]);
    },
    heatTooltipText(): string {
      if (!this.heatButtonVisible) {
        return '';
      }
      return translateTextWithParams(
        'Spend ${0} heat to raise temperature by 1 step',
        [String(this.player.heatNeededForTemperature)]);
    },
  },
  methods: {
    /*
     * Click handlers — the row wrapper is the canonical button when
     * the convert action is available. Guard against accidental fire
     * when the action isn't currently offered (e.g. clicking the row
     * area during an unrelated layout state).
     */
    onPlantsClick(): void {
      if (this.plantsButtonVisible) {
        this.$emit('convert-plants');
      }
    },
    onHeatClick(): void {
      if (this.heatButtonVisible) {
        this.$emit('convert-heat');
      }
    },
    // Show the premium convert preview only when the button is actually
    // active (the wrapper is a real button) — never on a plain resource
    // row. The anchor is the hovered wrapper's viewport rect.
    onConvertHover(which: 'plants' | 'heat', e: Event): void {
      if (which === 'plants' && !this.plantsButtonVisible) {
        return;
      }
      if (which === 'heat' && !this.heatButtonVisible) {
        return;
      }
      this.convertAnchor = (e.currentTarget as HTMLElement).getBoundingClientRect();
      this.convertHover = which;
    },
    onConvertLeave(): void {
      this.convertHover = null;
    },
  },
  components: {
    'player-resource': PlayerResource,
    StandardProjectPreviewPopover,
  },
});
</script>
