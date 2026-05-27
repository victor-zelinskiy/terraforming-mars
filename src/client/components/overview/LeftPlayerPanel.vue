<template>
  <div class="left-panel">
    <!-- One card per player. Each card combines cube + name + corporation + VP
         + TR + action status. Click selects that player. The viewer's own
         player is always first in the list, then the rest in seating order. -->
    <div class="left-panel-cards">
      <LeftPlayerCard
        v-for="p in orderedPlayers"
        :key="p.color"
        :player="p"
        :selected="isSelected(p)"
        :hideVp="hideVpFor(p)"
        :actionLabel="actionLabelFor(p)"
        :isViewer="isViewerFor(p)"
        :passAvailable="isViewerFor(p) && passAvailable"
        :endTurnAvailable="isViewerFor(p) && endTurnAvailable"
        @select="$emit('selectPlayer', $event)"
        @pass="$emit('pass')"
        @end-turn="$emit('end-turn')" />
    </div>

    <div class="left-panel-section">
      <PlayerResources
        :player="displayedPlayer"
        :convertHeatAvailable="convertHeatAvailable"
        :convertPlantsAvailable="convertPlantsAvailable"
        :convertPlantsPickerActive="convertPlantsPickerActive"
        :isViewer="isViewer"
        @convert-heat="$emit('convertHeat')"
        @convert-plants="$emit('convertPlants')"
        v-trim-whitespace />
    </div>

    <!-- `:conciseTagsViewDefaultValue="false"` shows every tag in the game
         (Building, Space, …) even when the displayed player's count is 0 —
         zero-count tags get a muted style. This keeps every tag at the same
         grid position regardless of who's selected, so switching players
         doesn't make icons "jump" to new cells. -->
    <div class="left-panel-tags-secondary left-panel-section">
      <PlayerTags
        section="cardTags"
        :player="displayedPlayer"
        :playerView="playerView"
        :conciseTagsViewDefaultValue="false" />
    </div>

    <div class="left-panel-tags-secondary left-panel-tags-extras left-panel-section">
      <PlayerTags
        section="extras"
        :player="displayedPlayer"
        :playerView="playerView"
        :conciseTagsViewDefaultValue="false" />
    </div>

    <PlayerAlliedParty :player="displayedPlayer"/>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import PlayerResources from '@/client/components/overview/PlayerResources.vue';
import PlayerAlliedParty from '@/client/components/overview/PlayerAlliedParty.vue';
import PlayerTags from '@/client/components/overview/PlayerTags.vue';
import LeftPlayerCard from '@/client/components/overview/LeftPlayerCard.vue';
import {actionLabelForPlayer} from '@/client/components/overview/playerLabels';
import {ActionLabel} from './ActionLabel';
import {Color} from '@/common/Color';

export default defineComponent({
  name: 'LeftPlayerPanel',
  props: {
    playerView: {
      type: Object as () => ViewModel,
      required: true,
    },
    displayedPlayer: {
      type: Object as () => PublicPlayerModel,
      required: true,
    },
    selectedColor: {
      type: String,
      default: undefined,
    },
    // Live "who's currently being waited on by the server" list, sourced
    // from the WaitingFor poll (see App.vue.playersWaitingFor). Drives
    // per-player status label + cube animation in real time, even during
    // simultaneous-action phases where the viewer's own playerView isn't
    // being refreshed.
    livePlayersWaitingFor: {
      type: Array as () => ReadonlyArray<Color>,
      default: () => [],
    },
    // Whether the corresponding convert-action is currently offered by the
    // server (computed in PlayerHome by scanning `waitingFor`). The buttons
    // render only when true, AND only on the viewer's own resource cells
    // (filtered upstream in PlayerHome).
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
    // True iff the displayedPlayer is the viewer themselves. Forwarded to
    // PlayerResources so it can hide the convert-action buttons (and their
    // arrow) when the panel is showing someone else's resources for review.
    isViewer: {
      type: Boolean,
      default: false,
    },
    // Pass / End-Turn availability — computed by PlayerHome from waitingFor.
    // Forwarded to LeftPlayerCard but only enabled on the viewer's own card
    // (the only player who can submit through this client). Other players'
    // cards still render the slot space so their card heights match the
    // viewer's, but the buttons stay disabled regardless.
    passAvailable: {
      type: Boolean,
      default: false,
    },
    endTurnAvailable: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['selectPlayer', 'convertHeat', 'convertPlants', 'pass', 'end-turn'],
  components: {
    PlayerResources,
    PlayerAlliedParty,
    PlayerTags,
    LeftPlayerCard,
  },
  computed: {
    // The viewer's own player (if any) is pulled to the top of the list so it
    // always appears first in the panel — players intuitively expect "their"
    // card to be the first one.
    orderedPlayers(): Array<PublicPlayerModel> {
      const me = this.playerView.thisPlayer;
      const players = this.playerView.players;
      if (me === undefined) {
        return players;
      }
      const others = players.filter((p) => p.color !== me.color);
      return [me, ...others];
    },
  },
  methods: {
    isSelected(p: PublicPlayerModel): boolean {
      const selected = this.selectedColor ?? this.playerView.thisPlayer?.color;
      return p.color === selected;
    },
    hideVpFor(p: PublicPlayerModel): boolean {
      const isThisPlayer = p.color === this.playerView.thisPlayer?.color;
      return !this.playerView.game.gameOptions.showOtherPlayersVP && !isThisPlayer;
    },
    actionLabelFor(p: PublicPlayerModel): ActionLabel {
      return actionLabelForPlayer(this.playerView, p, this.livePlayersWaitingFor);
    },
    isViewerFor(p: PublicPlayerModel): boolean {
      return p.color === this.playerView.thisPlayer?.color;
    },
  },
});
</script>
