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
        :turnOwner="isTurnOwnerFor(p)"
        :isViewer="isViewerFor(p)"
        :passAvailable="isViewerFor(p) && passAvailable"
        :endTurnAvailable="isViewerFor(p) && endTurnAvailable"
        :turnIndex="turnIndexFor(p)"
        :epoch="playerView.runId"
        @select="$emit('selectPlayer', $event)"
        @pass="$emit('pass')"
        @end-turn="$emit('end-turn')" />
    </div>

    <!--
      Section micro-labels (v42 HUD pass): each below-player-card
      section gets a small uppercase HUD label at the top-left. This
      is the kind of "premium information panel" cue the player
      flagged as missing — establishes hierarchy and tells the
      reader what cluster of data they're looking at without
      crowding it. Sci-fi-style: 9 px, letter-spacing 2 px, muted
      cyan. Styling lives on `.left-panel-section__label` in
      player_home.less.

      The label is anchored to the section frame, not its content,
      so changing the inner component (PlayerResources, PlayerTags)
      doesn't shift the label. Section corner ticks still flank the
      whole frame.
    -->
    <!-- MarsBot seat: the bot has no production / resource stocks besides its
         M€ supply, so the ordinary resources/tags tables would read as
         misleading zeros. Its participant panel (economy, decks, compact
         tracks, «MarsBot board» entry) takes the whole cluster instead. -->
    <div v-if="displayedIsMarsBot && botAutoma !== undefined" class="left-panel-section left-panel-section--marsbot">
      <div class="left-panel-section__label">MarsBot</div>
      <MarsBotPanel
        :player="displayedPlayer"
        :automa="botAutoma"
        :epoch="playerView.runId"
        @open-board="$emit('openMarsBotBoard')" />
    </div>

    <div v-if="!displayedIsMarsBot" class="left-panel-section left-panel-section--resources">
      <div class="left-panel-section__label" v-i18n>Resources</div>
      <!--
        Resource column headers — tiny shared captions above the
        resource table. Lets the table show only data (icon | count
        | prod) without per-row labels. Aligned to the table's grid
        columns (icon column has no header; count and prod columns
        share "ЗАПАС" / "ПРИРОСТ").

        The label cells are intentionally placed as a manual row
        ABOVE PlayerResources rather than inside the cont's grid,
        because PlayerResources is a reusable component used in
        other contexts (spectator view, etc.) where these headers
        would not make sense.
      -->
      <div class="left-panel-section__col-headers">
        <span class="col-header col-header--stock" v-i18n>Stock</span>
        <span class="col-header col-header--prod" v-i18n>Production</span>
      </div>
      <PlayerResources
        :player="displayedPlayer"
        :convertHeatAvailable="convertHeatAvailable"
        :convertPlantsAvailable="convertPlantsAvailable"
        :convertPlantsPickerActive="convertPlantsPickerActive"
        :isViewer="isViewer"
        :epoch="playerView.runId"
        @convert-heat="$emit('convertHeat')"
        @convert-plants="$emit('convertPlants')"
        v-trim-whitespace />
      <!--
        "ДОП. РЕСУРСЫ" auxiliary side-module. Mounted INSIDE the resources
        section (which is position:relative) so it anchors to the real
        РЕСУРСЫ block and stays aligned across resize / player-count changes
        without magic offsets. Self-hides until the displayed player has
        unlocked a card resource. See AdditionalResourcesPanel.vue.
      -->
      <AdditionalResourcesPanel
        :player="displayedPlayer"
        :epoch="playerView.runId" />
    </div>

    <!-- `:conciseTagsViewDefaultValue="false"` shows every tag in the game
         (Building, Space, …) even when the displayed player's count is 0 —
         zero-count tags get a muted style. This keeps every tag at the same
         grid position regardless of who's selected, so switching players
         doesn't make icons "jump" to new cells. -->
    <div v-if="!displayedIsMarsBot" class="left-panel-tags-secondary left-panel-section">
      <div class="left-panel-section__label" v-i18n>Tags</div>
      <PlayerTags
        section="cardTags"
        :player="displayedPlayer"
        :playerView="playerView"
        :conciseTagsViewDefaultValue="false" />
    </div>

    <div v-if="!displayedIsMarsBot" class="left-panel-tags-secondary left-panel-tags-extras left-panel-section">
      <div class="left-panel-section__label" v-i18n>Extra</div>
      <PlayerTags
        section="extras"
        :player="displayedPlayer"
        :playerView="playerView"
        :conciseTagsViewDefaultValue="false" />
    </div>

    <PlayerAlliedParty v-if="!displayedIsMarsBot" :player="displayedPlayer"/>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import PlayerResources from '@/client/components/overview/PlayerResources.vue';
import PlayerAlliedParty from '@/client/components/overview/PlayerAlliedParty.vue';
import PlayerTags from '@/client/components/overview/PlayerTags.vue';
import LeftPlayerCard from '@/client/components/overview/LeftPlayerCard.vue';
import MarsBotPanel from '@/client/components/marsbot/MarsBotPanel.vue';
import AdditionalResourcesPanel from '@/client/components/additionalResources/AdditionalResourcesPanel.vue';
import {actionLabelForPlayer} from '@/client/components/overview/playerLabels';
import {marsBotTheaterState} from '@/client/components/marsbot/marsBotTheaterState';
import {ActionLabel} from './ActionLabel';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';

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
  emits: ['selectPlayer', 'convertHeat', 'convertPlants', 'pass', 'end-turn', 'openMarsBotBoard'],
  components: {
    PlayerResources,
    PlayerAlliedParty,
    PlayerTags,
    LeftPlayerCard,
    MarsBotPanel,
    AdditionalResourcesPanel,
  },
  computed: {
    displayedIsMarsBot(): boolean {
      return this.displayedPlayer.isMarsBot === true;
    },
    botAutoma(): MarsBotModel | undefined {
      return this.playerView.game.automa;
    },
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
    // The ACTION-phase turn owner = the single active player (server's
    // `game.activePlayer`, projected onto `isActive`). Derived from the model,
    // NOT the TurnHandoff controller, so the PERSISTENT "this card owns the
    // turn" look (player-colour accent) never depends on animation timing.
    // Outside the ACTION phase nobody "owns a turn" (research / draft / etc.
    // keep their own simultaneous-pick statuses), so no card is the turn owner.
    //
    // MarsBot exception: its turn resolves synchronously on the server, so the
    // model never marks it active — the theater replay window IS its turn for
    // everyone at the table. While it plays, the bot's card owns the turn with
    // the same player-colour accent a human turn owner gets.
    isTurnOwnerFor(p: PublicPlayerModel): boolean {
      if (p.isMarsBot === true && marsBotTheaterState.active && marsBotTheaterState.botColor === p.color) {
        return true;
      }
      return this.playerView.game.phase === Phase.ACTION && p.isActive;
    },
    // 0-indexed позиция игрока в seating-order — это и есть порядок
    // хода в текущем поколении. playerView.players прибывает уже в
    // generation order (server строит из game.playersInGenerationOrder).
    turnIndexFor(p: PublicPlayerModel): number {
      return this.playerView.players.findIndex((pp) => pp.color === p.color);
    },
  },
});
</script>
