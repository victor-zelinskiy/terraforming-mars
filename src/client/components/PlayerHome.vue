<template>
  <div id="player-home" :class="[(game.turmoil ? 'with-turmoil': ''), playerTintClass]">
    <div class="top-bar-buttons" v-i18n>
      <!-- Each top-bar button gets its own anchor wrapper so its dropdown
           overlay can position absolutely under it. The wrapper takes the
           place of the button in the flex layout (matching its negative
           margin) so the buttons still overlap. -->
      <div class="top-bar-btn-anchor">
        <div class="bottom-bar-btn" :class="{'bottom-bar-btn--active': activeOverlay === 'milestones'}" v-on:click="toggleOverlay('milestones')">Milestones</div>
        <!--
          Claimed-milestone badge strip. Hangs below the Milestones button and
          shows up to 3 slots that fill in as players claim milestones. Visible
          to every player in real time so it's an at-a-glance "who's already
          taken what" indicator without needing to open the overlay. Hidden
          while the overlay is open (the overlay header carries the same info).
        -->
        <div v-if="activeOverlay !== 'milestones'" class="milestone-badges-strip">
          <MilestoneClaimedBadge
            v-for="(slot, i) in claimedMilestoneSlots"
            :key="i"
            :milestone="slot"
            :claimedCount="claimedMilestonesCount" />
        </div>
        <MilestonesOverlay
          v-if="activeOverlay === 'milestones'"
          class="top-bar-dropdown"
          :milestones="game.milestones"
          :players="playerView.players"
          :thisPlayerColor="thisPlayer.color"
          :thisPlayerMegacredits="thisPlayer.megacredits"
          :viewerActing="playerView.waitingFor !== undefined"
          :claimableNow="claimableMilestones"
          @claim="claimMilestone($event)"
          @close="activeOverlay = null" />
      </div>
      <div class="top-bar-btn-anchor top-bar-btn-anchor--center">
        <div class="bottom-bar-btn bottom-bar-btn--center" :class="{'bottom-bar-btn--active': activeOverlay === 'standardProjects'}" v-on:click="toggleOverlay('standardProjects')">Standard Projects</div>
        <StandardProjectsOverlay
          v-if="activeOverlay === 'standardProjects'"
          class="top-bar-dropdown top-bar-dropdown--standard-projects"
          :game="game"
          :thisPlayer="thisPlayer"
          :actionableProjects="standardProjectsActionInput"
          :viewerActing="playerView.waitingFor !== undefined"
          @close="activeOverlay = null"
          @use-project="onUseStandardProject($event)" />
      </div>
      <div class="top-bar-btn-anchor">
        <div class="bottom-bar-btn" :class="{'bottom-bar-btn--active': activeOverlay === 'awards'}" v-on:click="toggleOverlay('awards')">Awards</div>
        <!--
          Funded-award badge strip. Same UX contract as the milestones strip:
          3 slots fill in as awards are funded, hidden while the overlay is
          open. Awards don't "lock in" a winner — even after funding, the
          per-player scoring race continues until game end.
        -->
        <div v-if="activeOverlay !== 'awards'" class="milestone-badges-strip">
          <AwardFundedBadge
            v-for="(slot, i) in fundedAwardSlots"
            :key="i"
            :award="slot"
            :fundedCount="fundedAwardsCount"
            :players="playerView.players" />
        </div>
        <AwardsOverlay
          v-if="activeOverlay === 'awards'"
          class="top-bar-dropdown"
          :awards="game.awards"
          :players="playerView.players"
          :thisPlayerColor="thisPlayer.color"
          :thisPlayerMegacredits="thisPlayer.megacredits"
          :viewerActing="playerView.waitingFor !== undefined"
          :fundableNow="fundableAwards"
          :fundedCount="fundedAwardsCount"
          @fund="fundAward($event)"
          @close="activeOverlay = null" />
      </div>
    </div>

    <div class="bottom-bar-buttons">
      <div class="bottom-bar-btn" :class="{'bottom-bar-btn--active': activeOverlay === 'colonies'}" v-on:click="toggleOverlay('colonies')"><span v-i18n>Colonies</span></div>
      <div class="bottom-bar-btn bottom-bar-btn--center bottom-bar-btn--cards" :class="{'bottom-bar-btn--active': activeOverlay === 'cards'}" v-on:click="toggleOverlay('cards')">
        <div class="bottom-bar-btn-cards-glyph"></div>
        <span v-i18n>Cards</span>: {{ displayedCardsInHandCount }}
      </div>
      <div class="bottom-bar-btn bottom-bar-btn--actions">
        <div class="bottom-bar-btn-actions-glyph">
          <div class="blue-stripe"></div>
          <div class="red-arrow"></div>
        </div>
        <span v-i18n>Actions</span>: {{ availableActionsCount }}
      </div>
      <div class="bottom-bar-btn" :class="{'bottom-bar-btn--active': activeOverlay === 'played'}" v-on:click="toggleOverlay('played')"><span v-i18n>Played</span></div>
      <div class="bottom-bar-btn" :class="{'bottom-bar-btn--active': activeOverlay === 'victoryPoints'}" v-on:click="toggleOverlay('victoryPoints')"><span v-i18n>Victory Points</span>: {{ displayedVictoryPoints }}</div>
      <div class="bottom-bar-btn" :class="{'bottom-bar-btn--active': activeOverlay === 'log'}" v-on:click="toggleOverlay('log')"><span v-i18n>Log</span></div>
    </div>

    <LeftPlayerPanel
      :playerView="playerView"
      :displayedPlayer="displayedPlayer"
      :selectedColor="selectedPlayerColor"
      :livePlayersWaitingFor="livePlayersWaitingFor"
      :convertHeatAvailable="convertHeatAvailable && displayedPlayer.color === thisPlayer.color"
      :convertPlantsAvailable="convertPlantsAvailable && displayedPlayer.color === thisPlayer.color"
      :convertPlantsPickerActive="convertPlantsPickerActive"
      :isViewer="displayedPlayer.color === thisPlayer.color"
      @selectPlayer="selectedPlayerColor = $event"
      @convert-heat="convertHeat"
      @convert-plants="toggleConvertPlantsPicker" />

    <!--
      Active controller for the Convert-Plants space picker. Renders the
      legacy `SelectSpace.vue` with the inner prompt extracted from the
      action menu — it activates board-tile interaction and calls our
      onsave when a space is clicked, where we wrap the response in the
      outer OR-payload before submitting.
    -->
    <select-space
      v-if="convertPlantsPickerActive && convertPlantsPrompt !== undefined"
      :playerView="playerView"
      :playerinput="convertPlantsPrompt"
      :onsave="onConvertPlantsSpacePicked"
      :showsave="false"
      :showtitle="false" />

    <!--
      Client-side payment preview modal for Standard Projects. Mounts when
      the player picks a project that requires choosing between M€ and
      alternative resources (heat / steel / titanium / etc.). The modal
      is purely client-side — Confirm wraps the chosen Payment into a
      `SelectProjectCardToPlayResponse` and submits through `WaitingFor.onsave`;
      Cancel just unmounts the modal without sending anything. Re-uses
      MandatoryInputModal chrome (minimize + sci-fi frame + pill).
    -->
    <MandatoryInputModal v-if="pendingStdProjectPayment !== undefined"
                         :title="pendingStdProjectPayment.title">
      <StandardProjectPaymentContent
        :playerView="playerView"
        :playerinput="pendingStdProjectPayment.input"
        @confirm="onStdProjectPaymentConfirm($event)"
        @cancel="onStdProjectPaymentCancel" />
    </MandatoryInputModal>

    <div v-if="activeOverlay === 'log'" class="bar-overlay bar-overlay--log">
      <div class="bar-overlay-close" v-on:click="activeOverlay = null">✕</div>
      <log-panel :viewModel="playerView" :color="thisPlayer.color" :step="game.step"></log-panel>
    </div>

    <div v-if="activeOverlay === 'victoryPoints'" class="bar-overlay bar-overlay--victory-points">
      <div class="bar-overlay-close" v-on:click="activeOverlay = null">✕</div>
      <VictoryPointsOverlay
        :displayedPlayer="displayedPlayer"
        :game="game"
        :thisPlayerColor="thisPlayer.color" />
    </div>

    <div v-if="activeOverlay === 'played'" class="bar-overlay bar-overlay--played">
      <div class="bar-overlay-close" v-on:click="activeOverlay = null">✕</div>
      <div class="hiding-card-button-row">
        <div :class="playedCardsTitleClass">{{ displayedPlayer.name }} <span v-i18n>played cards</span></div>
        <div class="played-cards-filters">
          <div :class="getHideButtonClass('ACTIVE')" v-on:click.prevent="toggle('ACTIVE')">
            <div class="played-cards-count">{{getCardsByType(displayedPlayer.tableau, [CardType.ACTIVE]).length.toString()}}</div>
            <div class="played-cards-selection" v-i18n>{{ getToggleLabel('ACTIVE')}}</div>
          </div>
          <div :class="getHideButtonClass('AUTOMATED')" v-on:click.prevent="toggle('AUTOMATED')">
            <div class="played-cards-count">{{getCardsByType(displayedPlayer.tableau, [CardType.AUTOMATED, CardType.PRELUDE]).length.toString()}}</div>
            <div class="played-cards-selection" v-i18n>{{ getToggleLabel('AUTOMATED')}}</div>
          </div>
          <div :class="getHideButtonClass('EVENT')" v-on:click.prevent="toggle('EVENT')">
            <div class="played-cards-count">{{getCardsByType(displayedPlayer.tableau, [CardType.EVENT]).length.toString()}}</div>
            <div class="played-cards-selection" v-i18n>{{ getToggleLabel('EVENT')}}</div>
          </div>
        </div>
        <div class="text-overview" v-i18n>[ toggle cards filters ]</div>
      </div>
      <div class="bar-overlay--played-cards">
        <div v-for="card in getCardsByType(displayedPlayer.tableau, [CardType.CORPORATION])" :key="card.name" class="cardbox">
          <Card :card="card" :actionUsed="isCardActivated(card, displayedPlayer)" :cubeColor="displayedPlayer.color"/>
        </div>
        <div v-for="card in getCardsByType(displayedPlayer.tableau, [CardType.CEO])" :key="card.name" class="cardbox">
          <Card :card="card" :actionUsed="isCardActivated(card, displayedPlayer)" :cubeColor="displayedPlayer.color"/>
        </div>
        <div v-show="isVisible('ACTIVE')" v-for="card in sortActiveCards(getCardsByType(displayedPlayer.tableau, [CardType.ACTIVE, CardType.PRELUDE]).filter(isActive))" :key="card.name" class="cardbox">
          <Card :card="card" :actionUsed="isCardActivated(card, displayedPlayer)" :cubeColor="displayedPlayer.color"/>
        </div>
        <stacked-cards v-show="isVisible('AUTOMATED')" :cards="getCardsByType(displayedPlayer.tableau, [CardType.AUTOMATED, CardType.PRELUDE]).filter(isNotActive)"></stacked-cards>
        <stacked-cards v-show="isVisible('EVENT')" :cards="getCardsByType(displayedPlayer.tableau, [CardType.EVENT])"></stacked-cards>
      </div>
    </div>

    <div v-if="game.phase === 'end'">
      <div class="player_home_block">
        <DynamicTitle title="This game is over!" :color="thisPlayer.color"/>
        <a :href="'the-end?id='+ playerView.id" v-i18n>Go to game results</a>
      </div>
    </div>

    <sidebar v-trim-whitespace
      :acting_player="isPlayerActing(playerView)"
      :player_color="thisPlayer.color"
      :players="playerView.players"
      :generation="game.generation"
      :coloniesCount="game.colonies.length"
      :temperature = "game.temperature"
      :oxygen = "game.oxygenLevel"
      :oceans = "game.oceans"
      :venus = "game.venusScaleLevel"
      :turmoil = "game.turmoil"
      :moonData="game.moon"
      :gameOptions = "game.gameOptions"
      :playerNumber = "playerView.players.length"
      :isTerraformed="playerView.game.isTerraformed"
      :lastSoloGeneration = "game.lastSoloGeneration"
      :deckSize = "game.deckSize"
      :discardPileSize = "game.discardPileSize">
    </sidebar>

    <div v-if="thisPlayer.tableau.length > 0">
      <div class="player_home_block player_home_block--board">
        <GameBoardView
          :game="game"
          :tileView="tileView"
          :players="playerView.players"
          @toggleTileView="cycleTileView()"
        />
      </div>

    <a class="hotkey-target"></a>

      <a class="hotkey-target"></a>
      <div class="player_home_block player_home_block--actions nofloat">
        <a name="actions" class="player_home_anchor"></a>
        <dynamic-title title="Actions" :color="thisPlayer.color"/>
        <waiting-for v-if="game.phase !== 'end'" ref="waitingFor" :playerView="playerView" :waitingfor="playerView.waitingFor"></waiting-for>
      </div>

      <div class="player_home_block player_home_block--hand" v-if="playerView.draftedCards.length > 0">
        <dynamic-title title="Drafted cards" :color="thisPlayer.color" />
        <div v-for="card in playerView.draftedCards" :key="card.name" class="cardbox">
          <Card :card="card"/>
        </div>
      </div>

      <a name="cards" class="player_home_anchor"></a>
      <div class="player_home_block player_home_block--hand" v-if="cardsInHandCount > 0" id="shortkey-hand">
        <div class="hiding-card-button-row">
          <dynamic-title title="Cards In Hand" :color="thisPlayer.color"/>
          <div :class="getHideButtonClass('HAND')" v-on:click.prevent="toggle('HAND')">
            <div class="played-cards-count">{{cardsInHandCount.toString()}}</div>
            <div class="played-cards-selection" v-i18n>{{ getToggleLabel('HAND')}}</div>
          </div>
          <div class="text-overview" v-i18n>[ toggle cards in hand ]</div>
        </div>
        <sortable-cards v-show="isVisible('HAND')" :playerId="playerView.id"
                        :cards="playerView.preludeCardsInHand
                                .concat(playerView.ceoCardsInHand)
                                .concat(playerView.cardsInHand)"/>
      </div>

      <div v-if="thisPlayer.selfReplicatingRobotsCards.length > 0" class="player_home_block">
        <dynamic-title title="Self-replicating Robots cards" :color="thisPlayer.color"/>
        <div>
          <div v-for="card in thisPlayer.selfReplicatingRobotsCards" :key="card.name" class="cardbox">
            <Card :card="card"/>
          </div>
        </div>
      </div>
    </div>

    <div v-if="thisPlayer.underworldData.tokens.length > 0">
      <dynamic-title title="Claimed Underground Resource Tokens" :color="thisPlayer.color"/>
      <underground-tokens :underworldData="thisPlayer.underworldData"></underground-tokens>
    </div>

    <template v-if="thisPlayer.tableau.length === 0">
      <PlayerSetupView :playerView="playerView" :tileView="tileView"/>
    </template>

    <div v-if="game.colonies.length > 0" class="player_home_block" ref="colonies" id="shortkey-colonies">
      <a name="colonies" class="player_home_anchor hotkey-target"></a>
      <dynamic-title title="Colonies" :color="thisPlayer.color"/>
      <div class="colonies-fleets-cont">
        <div class="colonies-player-fleets" v-for="colonyPlayer in playerView.players" :key="colonyPlayer.color">
          <div :class="'colonies-fleet colonies-fleet-'+ colonyPlayer.color" v-for="idx in getFleetsCountRange(colonyPlayer)" :key="idx"></div>
        </div>
      </div>
      <div class="player_home_colony_cont">
        <div class="player_home_colony" v-for="colony in game.colonies" :key="colony.name">
          <colony :colony="colony" :active="colony.isActive"></colony>
        </div>
      </div>
    </div>

    <!--
      Spectator link and game-purge warning intentionally removed: this fork
      is a private/self-hosted 2-player setup, so the spectator endpoint is
      never used and purge-after-N-hours doesn't apply.
    -->
    <KeyboardShortcuts v-show="keyboardShortcutOpened" @close="keyboardShortcutOpened = false"></KeyboardShortcuts>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

import Card from '@/client/components/card/Card.vue';
import LeftPlayerPanel from '@/client/components/overview/LeftPlayerPanel.vue';
import WaitingFor from '@/client/components/WaitingFor.vue';
import Sidebar from '@/client/components/Sidebar.vue';
import Colony from '@/client/components/colonies/Colony.vue';
import LogPanel from '@/client/components/logpanel/LogPanel.vue';
import GameBoardView from '@/client/components/GameBoardView.vue';
import PlayerSetupView from '@/client/components/PlayerSetupView.vue';
import DynamicTitle from '@/client/components/common/DynamicTitle.vue';
import SortableCards from '@/client/components/SortableCards.vue';
import StackedCards from '@/client/components/StackedCards.vue';
import UndergroundTokens from '@/client/components/underworld/UndergroundTokens.vue';
import KeyboardShortcuts from '@/client/components/KeyboardShortcuts.vue';
import VictoryPointsOverlay from '@/client/components/overview/VictoryPointsOverlay.vue';
import MilestonesOverlay from '@/client/components/overview/MilestonesOverlay.vue';
import MilestoneClaimedBadge from '@/client/components/overview/MilestoneClaimedBadge.vue';
import AwardsOverlay from '@/client/components/overview/AwardsOverlay.vue';
import AwardFundedBadge from '@/client/components/overview/AwardFundedBadge.vue';
import SelectSpace from '@/client/components/SelectSpace.vue';
import StandardProjectsOverlay from '@/client/components/overview/StandardProjectsOverlay.vue';
import MandatoryInputModal from '@/client/components/MandatoryInputModal.vue';
import StandardProjectPaymentContent from '@/client/components/payment/StandardProjectPaymentContent.vue';
import {Payment} from '@/common/inputs/Payment';
import {CardName} from '@/common/cards/CardName';
import {Units} from '@/common/Units';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';
import {AwardName} from '@/common/ma/AwardName';
import {MAX_MILESTONES, MAX_AWARDS} from '@/common/constants';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {PlayerInputModel, OrOptionsModel, SelectOptionModel, SelectPaymentModel, SelectProjectCardToPlayModel, SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {Message} from '@/common/logs/Message';
import {vueRoot} from '@/client/components/vueRoot';

// PlayerInput titles are `string | Message`. Returns the plain English text
// regardless of shape — used for string-matching prompt titles like
// "Claim a milestone".
function inputTitleText(title: string | Message | undefined): string | undefined {
  if (title === undefined) return undefined;
  if (typeof title === 'string') return title;
  return title.message;
}
import {getPreferences, Preferences, PreferencesManager} from '@/client/utils/PreferencesManager';
import {GameModel} from '@/common/models/GameModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {CardType} from '@/common/cards/CardType';
import {getCardsByType, isCardActivated} from '@/client/utils/CardUtils';
import {sortActiveCards} from '@/client/utils/ActiveCardsSortingOrder';
import {CardModel} from '@/common/models/CardModel';
import {getCardOrThrow} from '../cards/ClientCardManifest';
import {HomeMixin} from '@/client/mixins/HomeMixin';
import {playerColorClass} from '@/common/utils/utils';

type ToggleableState = {
  showHand: boolean;
  showActiveCards: boolean;
  showAutomatedCards: boolean;
  showEventCards: boolean;
}

// Overlays opened by the top/bottom bar buttons. Only one can be visible at a time —
// pressing a different button closes the previous overlay. Pressing the same button
// again closes the active overlay.
type OverlayId = 'milestones' | 'standardProjects' | 'awards' | 'colonies' | 'cards' | 'played' | 'victoryPoints' | 'log';

// Set while the player has chosen a Standard Project from the overlay
// AND the choice requires picking between M€ and alternative resources.
// Drives a client-side payment-preview modal; if undefined no modal is
// shown. When the player Confirms we wrap the chosen payment into the
// nested `SelectProjectCardToPlayResponse` and submit; Cancel just
// clears this field (no server round-trip).
type PendingStdProjectPayment = {
  cardName: CardName;
  title: string | Message;
  input: SelectPaymentModel;
};

type PlayerHomeModel = ToggleableState & {
  selectedPlayerColor: Color | undefined;
  activeOverlay: OverlayId | null;
  // True while the Convert-Plants flow is in "click a greenery space"
  // mode. Renders SelectSpace.vue with the inner SelectSpace prompt so
  // it can drive board interaction; on space pick we wrap the response in
  // the outer OR-payload and submit.
  convertPlantsPickerActive: boolean;
  pendingStdProjectPayment: PendingStdProjectPayment | undefined;
}

type ToggleableCardType = 'HAND' | 'ACTIVE' | 'AUTOMATED' | 'EVENT';

const typeToDataModel: Record<ToggleableCardType, {key: keyof ToggleableState, preference: keyof Preferences}> = {
  HAND: {key: 'showHand', preference: 'hide_hand'},
  ACTIVE: {key: 'showActiveCards', preference: 'hide_active_cards'},
  AUTOMATED: {key: 'showAutomatedCards', preference: 'hide_automated_cards'},
  EVENT: {key: 'showEventCards', preference: 'hide_event_cards'},
} as const;

export default defineComponent({
  name: 'player-home',
  mixins: [HomeMixin],
  data(): PlayerHomeModel {
    const preferences = getPreferences();
    return {
      showHand: !preferences.hide_hand,
      showActiveCards: !preferences.hide_active_cards,
      showAutomatedCards: !preferences.hide_automated_cards,
      showEventCards: !preferences.hide_event_cards,
      selectedPlayerColor: undefined,
      activeOverlay: null,
      convertPlantsPickerActive: false,
      pendingStdProjectPayment: undefined,
    };
  },
  watch: {
    showHand: function hide_hand() {
      PreferencesManager.INSTANCE.set('hide_hand', !this.showHand);
    },
    showActiveCards: function toggle_active_cards() {
      PreferencesManager.INSTANCE.set('hide_active_cards', !this.showActiveCards);
    },
    showAutomatedCards: function toggle_automated_cards() {
      PreferencesManager.INSTANCE.set('hide_automated_cards', !this.showAutomatedCards);
    },
    showEventCards: function toggle_event_cards() {
      PreferencesManager.INSTANCE.set('hide_event_cards', !this.showEventCards);
    },
    /*
     * When ANY overlay opens we install a global click listener that closes
     * the overlay on outside clicks (so it behaves like a real dropdown / popup).
     * Bar buttons, overlays themselves, and the left player panel are exempted
     * — clicks there should run their own handlers / not dismiss the overlay.
     * The listener is attached on $nextTick so the click that opened the
     * overlay doesn't immediately close it.
     */
    activeOverlay(newVal: OverlayId | null, oldVal: OverlayId | null) {
      if (newVal !== null && oldVal === null) {
        this.$nextTick(() => {
          document.addEventListener('click', this.handleOutsideOverlayClick);
        });
      } else if (newVal === null && oldVal !== null) {
        document.removeEventListener('click', this.handleOutsideOverlayClick);
      }
    },
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleOutsideOverlayClick);
  },
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
  },
  computed: {
    thisPlayer(): PublicPlayerModel {
      return this.playerView.thisPlayer;
    },
    game(): GameModel {
      return this.playerView.game;
    },
    CardType(): typeof CardType {
      return CardType;
    },
    cardsInHandCount(): number {
      const playerView = this.playerView;
      return playerView.cardsInHand.length + playerView.preludeCardsInHand.length + playerView.ceoCardsInHand.length;
    },
    getCardsByType(): typeof getCardsByType {
      return getCardsByType;
    },
    isCardActivated(): typeof isCardActivated {
      return isCardActivated;
    },
    sortActiveCards(): typeof sortActiveCards {
      return sortActiveCards;
    },
    // The player whose info is currently shown in the bottom panel — drives
    // which tableau the "Played" overlay renders. Mirrors PlayersOverview's
    // own `displayedPlayer` computed, so the overlay always matches what the
    // sidebar cube selection points at.
    displayedPlayer(): PublicPlayerModel {
      if (this.selectedPlayerColor !== undefined) {
        const p = this.playerView.players.find((p) => p.color === this.selectedPlayerColor);
        if (p !== undefined) {
          return p;
        }
      }
      return this.thisPlayer;
    },
    playedCardsTitleClass(): string {
      return `dynamic-title ${playerColorClass(this.displayedPlayer.color, 'shadow')}`;
    },
    availableActionsCount(): number {
      return this.displayedPlayer.availableBlueCardActionCount;
    },
    displayedCardsInHandCount(): number {
      // For the current user we know the exact cards in hand (preludes + ceos
      // + projects). For other players the server only sends the count.
      if (this.displayedPlayer.color === this.thisPlayer.color) {
        return this.cardsInHandCount;
      }
      return this.displayedPlayer.cardsInHandNbr ?? 0;
    },
    displayedVictoryPoints(): number | string {
      const hide = !this.game.gameOptions.showOtherPlayersVP &&
        this.displayedPlayer.color !== this.thisPlayer.color;
      return hide ? '?' : this.displayedPlayer.victoryPointsBreakdown.total;
    },
    // Tints the entire chrome (top bar buttons + bottom bar buttons) with
    // the selected player's colour so it's instantly obvious whose state
    // the UI is showing. Class is applied to #player-home so a single
    // selector colours every bar at once.
    playerTintClass(): string {
      return `player-tint-${this.displayedPlayer.color}`;
    },
    // Live "who's currently being waited on by the server" list — sourced
    // from `WaitingFor.vue`'s continuous poll and stored on the root App
    // component. We expose it as a computed so child panels can drive
    // per-player cube animation + status label off real-time state
    // (otherwise these would lag until the viewer themselves acted).
    livePlayersWaitingFor(): ReadonlyArray<Color> {
      return vueRoot(this).playersWaitingFor;
    },
    // Fixed-length array of 3 milestone slots (left → right in claim order).
    // Each slot is either a claimed `ClaimedMilestoneModel` or `undefined`
    // (empty). Used by the badge strip below the "Milestones" bar button so
    // every player sees claims appear in real time without opening the overlay.
    claimedMilestoneSlots(): Array<ClaimedMilestoneModel | undefined> {
      const claimed = this.game.milestones.filter((m) => m.playerName !== undefined);
      return Array.from({length: MAX_MILESTONES}, (_, i) => claimed[i]);
    },
    claimedMilestonesCount(): number {
      return this.claimedMilestoneSlots.filter((s) => s !== undefined).length;
    },
    // Set of milestone names the current player can claim THIS instant.
    // Read straight from the `waitingFor` model the server already sends —
    // each SelectOption inside the "Claim a milestone" sub-OrOptions has
    // its title set to `milestone.name` (a `MilestoneName` enum literal),
    // so there's no string parsing here: we're reading typed data the
    // server placed into the input tree. The walk recurses through OR/AND
    // containers so the action menu still resolves when wrapped (initial-
    // action prompts, etc.).
    claimableMilestones(): Set<MilestoneName> {
      const set = new Set<MilestoneName>();
      const found = this.findMilestoneOptionPath(this.playerView.waitingFor);
      if (!found) return set;
      for (const opt of found.options) {
        const t = inputTitleText(opt.title);
        if (opt.type === 'option' && t !== undefined) {
          set.add(t as MilestoneName);
        }
      }
      return set;
    },
    // Same pattern for awards: each inner SelectOption's title is the
    // `AwardName` enum literal.
    fundableAwards(): Set<AwardName> {
      const set = new Set<AwardName>();
      const found = this.findAwardOptionPath(this.playerView.waitingFor);
      if (!found) return set;
      for (const opt of found.options) {
        const t = inputTitleText(opt.title);
        if (opt.type === 'option' && t !== undefined) {
          set.add(t as AwardName);
        }
      }
      return set;
    },
    fundedAwardSlots(): Array<FundedAwardModel | undefined> {
      const funded = this.game.awards.filter((a) => a.playerName !== undefined);
      return Array.from({length: MAX_AWARDS}, (_, i) => funded[i]);
    },
    fundedAwardsCount(): number {
      return this.fundedAwardSlots.filter((s) => s !== undefined).length;
    },
    // Server-authoritative availability flags. The server already runs the
    // canonical `canAct()` check (the same one that controls whether the
    // legacy radio-button option goes into the menu), so the client just
    // mirrors that field instead of re-deriving from the waitingFor tree.
    // Tree-walking is kept ONLY for submission (to know the index path to
    // wrap the response in), not for the enabled/disabled gate.
    convertHeatAvailable(): boolean {
      return this.thisPlayer.canConvertHeat === true;
    },
    convertPlantsAvailable(): boolean {
      return this.thisPlayer.canConvertPlants === true;
    },
    convertPlantsPrompt(): SelectSpaceModel | undefined {
      return this.findConvertPlantsOption(this.playerView.waitingFor)?.spacePrompt as SelectSpaceModel | undefined;
    },
    // The current SelectStandardProjectToPlay model in the action menu, or
    // undefined if the player isn't currently being offered standard
    // projects. Exposed to the overlay so each project's "USE" button can
    // tell whether THIS project is actionable right now (and what its
    // adjusted cost / canPayWith flags are).
    standardProjectsActionInput(): SelectProjectCardToPlayModel | undefined {
      return this.findStandardProjectsAction(this.playerView.waitingFor)?.input;
    },
  },

  components: {
    DynamicTitle,
    Card,
    LeftPlayerPanel,
    'waiting-for': WaitingFor,
    'sidebar': Sidebar,
    'colony': Colony,
    'log-panel': LogPanel,
    'sortable-cards': SortableCards,
    GameBoardView,
    PlayerSetupView,
    'stacked-cards': StackedCards,
    UndergroundTokens,
    KeyboardShortcuts,
    VictoryPointsOverlay,
    MilestonesOverlay,
    MilestoneClaimedBadge,
    AwardsOverlay,
    AwardFundedBadge,
    'select-space': SelectSpace,
    StandardProjectsOverlay,
    MandatoryInputModal,
    StandardProjectPaymentContent,
  },
  methods: {
    isPlayerActing(playerView: PlayerViewModel) : boolean {
      return playerView.players.length > 1 && playerView.waitingFor !== undefined;
    },
    toggleOverlay(id: OverlayId): void {
      this.activeOverlay = this.activeOverlay === id ? null : id;
    },
    // Closes the active overlay when the click happens outside it. Clicks
    // inside the overlay itself, on a bar button (which has its own toggle),
    // or on the left player panel (so the user can switch displayed player
    // without dismissing the VP overlay) are all exempt.
    handleOutsideOverlayClick(e: MouseEvent): void {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest('.top-bar-dropdown') ||
          target.closest('.bar-overlay') ||
          target.closest('.bottom-bar-btn') ||
          target.closest('.left-panel')) {
        return;
      }
      this.activeOverlay = null;
    },
    // Recursively walks the waitingFor tree looking for an OrOptions whose
    // title matches `titlePredicate`. Returns the matched OrOptions's option
    // list plus the index PATH from the root needed to build a nested response
    // payload. Descends through both `or` and `and` containers so wrapped
    // action menus (initial-actions prompt, etc.) are still found.
    //
    // Used by both the milestone-claim flow (`title === 'Claim a milestone'`)
    // and the award-fund flow (`title startsWith 'Fund an award'` — the
    // server bakes the current cost into the title via `message(...)`).
    findInnerActionPath(
      wf: PlayerInputModel | undefined,
      titlePredicate: (title: string | undefined) => boolean,
      pathSoFar: ReadonlyArray<number> = [],
    ): {options: Array<PlayerInputModel>; path: ReadonlyArray<number>} | undefined {
      if (!wf) return undefined;
      if (wf.type === 'or' && titlePredicate(inputTitleText(wf.title))) {
        return {options: (wf as OrOptionsModel).options, path: pathSoFar};
      }
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const found = this.findInnerActionPath(options[i], titlePredicate, [...pathSoFar, i]);
          if (found) return found;
        }
      }
      return undefined;
    },
    findMilestoneOptionPath(wf: PlayerInputModel | undefined) {
      return this.findInnerActionPath(wf, (t) => t === 'Claim a milestone');
    },
    // Convert Heat / Convert Plants live as TOP-LEVEL options of the main
    // action OrOptions (sibling to "Claim a milestone" / "Fund an award"),
    // not inside their own sub-OrOptions. Helpers below scan that top-level
    // list for the matching option and return its outer index so we can
    // build a single-level OR-response payload (`{type:'or', index, response:...}`).
    // Recursively walks the waitingFor tree looking for a Convert Heat
    // SelectOption (title matches "Convert N heat into temperature" — both
    // the standard 8-heat variant and the Kelvinists kp03 6-heat one).
    // Returns the full index PATH so we can build the wrapped response.
    // Recursive search handles cases where the action OR is wrapped (e.g.
    // initial-action menus, mid-card prompts that nest the standard menu).
    findConvertHeatPath(
      wf: PlayerInputModel | undefined,
      pathSoFar: ReadonlyArray<number> = [],
    ): ReadonlyArray<number> | undefined {
      if (!wf) return undefined;
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          const t = inputTitleText(opt.title);
          if (opt.type === 'option' && typeof t === 'string' &&
              t.includes('heat into temperature')) {
            return [...pathSoFar, i];
          }
          const deeper = this.findConvertHeatPath(opt, [...pathSoFar, i]);
          if (deeper) return deeper;
        }
      }
      return undefined;
    },
    // Same idea for Convert Plants — its option in the OR is a SelectSpace
    // (title template "Convert ${0} plants into greenery", with the number
    // in `messageArgs` so the template string itself stays substring-stable).
    // Returns both the index path and the SelectSpace prompt so PlayerHome
    // can mount a local SelectSpace controller that drives board interaction.
    //
    // Two-pass match: first try title-substring (precise), then fall back to
    // "any 'space'-type option in the action menu" — the server-side
    // `canConvertPlants` flag is the source of truth for availability, so
    // when it's true the SelectSpace IS in the menu somewhere; this fallback
    // protects us against title text shifting (server-side message refactor,
    // unusual wrapping) while still being safe because the action OR usually
    // doesn't carry other top-level SelectSpace options.
    findConvertPlantsPathAndPrompt(
      wf: PlayerInputModel | undefined,
      pathSoFar: ReadonlyArray<number> = [],
      allowAnySpace = false,
    ): {path: ReadonlyArray<number>; spacePrompt: PlayerInputModel} | undefined {
      if (!wf) return undefined;
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          const t = inputTitleText(opt.title);
          if (opt.type === 'space') {
            if (typeof t === 'string' && t.includes('plants into greenery')) {
              return {path: [...pathSoFar, i], spacePrompt: opt};
            }
            if (allowAnySpace) {
              return {path: [...pathSoFar, i], spacePrompt: opt};
            }
          }
          const deeper = this.findConvertPlantsPathAndPrompt(opt, [...pathSoFar, i], allowAnySpace);
          if (deeper) return deeper;
        }
      }
      return undefined;
    },
    findConvertHeatOption(wf: PlayerInputModel | undefined): {path: ReadonlyArray<number>} | undefined {
      const path = this.findConvertHeatPath(wf);
      return path ? {path} : undefined;
    },
    findConvertPlantsOption(wf: PlayerInputModel | undefined): {path: ReadonlyArray<number>; spacePrompt: PlayerInputModel} | undefined {
      // First pass: title match. Second pass (only if the server says the
      // action is available): accept any SelectSpace prompt in the action
      // menu — guards against title text drift.
      const byTitle = this.findConvertPlantsPathAndPrompt(wf);
      if (byTitle) return byTitle;
      if (this.thisPlayer.canConvertPlants === true) {
        return this.findConvertPlantsPathAndPrompt(wf, [], true);
      }
      return undefined;
    },
    // Recursively walks the waitingFor tree looking for the standard-
    // projects SelectStandardProjectToPlay (type 'projectCard') option.
    // Returns the option model + the index PATH from the root needed to
    // wrap a `SelectProjectCardToPlayResponse` in nested OR responses
    // (matching exactly what the legacy radio UI would send).
    findStandardProjectsAction(
      wf: PlayerInputModel | undefined,
      pathSoFar: ReadonlyArray<number> = [],
    ): {path: ReadonlyArray<number>; input: SelectProjectCardToPlayModel} | undefined {
      if (!wf) return undefined;
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          if (opt.type === 'projectCard' && inputTitleText(opt.title) === 'Standard projects') {
            return {path: [...pathSoFar, i], input: opt as SelectProjectCardToPlayModel};
          }
          const deeper = this.findStandardProjectsAction(opt, [...pathSoFar, i]);
          if (deeper) return deeper;
        }
      }
      return undefined;
    },
    findAwardOptionPath(wf: PlayerInputModel | undefined) {
      // Primary: title-prefix match. The server sets the title to
      // `'Fund an award (${0} M€)'` with the current cost baked in.
      const byTitle = this.findInnerActionPath(wf, (t) =>
        t !== undefined && t.toLowerCase().startsWith('fund an award'));
      if (byTitle) return byTitle;
      // Fallback: structure-based — find an OrOptions whose options are all
      // SelectOptions whose titles are valid award names. Catches cases
      // where the title shape differs from what we expected (server-side
      // refactor, expansion-specific wrapper, etc.).
      const awardNames = new Set<string>(this.game.awards.map((a) => a.name));
      return this.findAwardOptionPathByStructure(wf, awardNames);
    },
    findAwardOptionPathByStructure(
      wf: PlayerInputModel | undefined,
      awardNames: Set<string>,
      pathSoFar: ReadonlyArray<number> = [],
    ): {options: Array<PlayerInputModel>; path: ReadonlyArray<number>} | undefined {
      if (!wf) return undefined;
      if (wf.type === 'or') {
        const opts = (wf as OrOptionsModel).options;
        if (opts.length > 0 && opts.every((o) => {
          if (o.type !== 'option') return false;
          const t = inputTitleText((o as SelectOptionModel).title);
          return typeof t === 'string' && awardNames.has(t);
        })) {
          return {options: opts, path: pathSoFar};
        }
      }
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const found = this.findAwardOptionPathByStructure(options[i], awardNames, [...pathSoFar, i]);
          if (found) return found;
        }
      }
      return undefined;
    },
    // Generic helper: given a found sub-OrOptions (`{options, path}`) and the
    // title of a specific inner SelectOption, build + submit the nested
    // response payload through `WaitingFor.onsave()`. Used by both the
    // milestone-claim and award-fund flows since they share the structure
    // (outer action OR → inner action OR → per-target SelectOption).
    submitInnerActionResponse(
      found: {options: Array<PlayerInputModel>; path: ReadonlyArray<number>},
      targetTitle: string,
    ): boolean {
      const innerIdx = found.options.findIndex(
        (o) => o.type === 'option' && inputTitleText((o as SelectOptionModel).title) === targetTitle);
      if (innerIdx === -1) return false;
      let response: unknown = {
        type: 'or' as const,
        index: innerIdx,
        response: {type: 'option' as const},
      };
      for (let i = found.path.length - 1; i >= 0; i--) {
        response = {type: 'or' as const, index: found.path[i], response};
      }
      const wfRef = this.$refs.waitingFor as {onsave?: (out: unknown) => void} | undefined;
      if (wfRef?.onsave) {
        wfRef.onsave(response);
        return true;
      }
      return false;
    },
    // Submit a milestone claim through the same channel the radio + submit
    // form uses (WaitingFor.onsave → POST /api/player-input). Bypasses the
    // wf-action radio UI but the server can't tell the difference.
    claimMilestone(name: MilestoneName): void {
      const found = this.findMilestoneOptionPath(this.playerView.waitingFor);
      if (!found) return;
      if (this.submitInnerActionResponse(found, name)) {
        this.activeOverlay = null;
      }
    },
    fundAward(name: AwardName): void {
      const found = this.findAwardOptionPath(this.playerView.waitingFor);
      if (!found) return;
      if (this.submitInnerActionResponse(found, name)) {
        this.activeOverlay = null;
      }
    },
    // One-click conversion of 8 heat (or 6 for Kelvinists kp03) into +1
    // temperature step. Builds a nested OR-response that mirrors the depth
    // of the path returned by the recursive finder.
    convertHeat(): void {
      const found = this.findConvertHeatOption(this.playerView.waitingFor);
      if (!found || found.path.length === 0) {
        if (this.thisPlayer.canConvertHeat) {
          console.warn('Convert Heat: server flag says available but path not found in waitingFor tree');
        }
        return;
      }
      let response: unknown = {type: 'option' as const};
      // Wrap one OR layer per index in the path, innermost first.
      for (let i = found.path.length - 1; i >= 0; i--) {
        response = {type: 'or' as const, index: found.path[i], response};
      }
      const wfRef = this.$refs.waitingFor as {onsave?: (out: unknown) => void} | undefined;
      wfRef?.onsave?.(response);
    },
    // Convert Plants needs a SPACE choice — the option in the OR is a
    // SelectSpace, not a SelectOption. Clicking the button toggles a
    // "picker" mode that renders the legacy SelectSpace.vue with the inner
    // prompt, which takes over board interaction. When the user clicks a
    // valid greenery space, `onConvertPlantsSpacePicked` wraps the space
    // response in the outer OR-payload and submits.
    toggleConvertPlantsPicker(): void {
      this.convertPlantsPickerActive = !this.convertPlantsPickerActive;
    },
    onConvertPlantsSpacePicked(spaceResponse: {type: 'space'; spaceId: string}): void {
      const found = this.findConvertPlantsOption(this.playerView.waitingFor);
      if (!found || found.path.length === 0) {
        if (this.thisPlayer.canConvertPlants) {
          console.warn('Convert Plants: server flag says available but path not found in waitingFor tree');
        }
        return;
      }
      // Innermost response is the actual space pick; wrap with one OR layer
      // per index in the path (innermost first).
      let response: unknown = spaceResponse;
      for (let i = found.path.length - 1; i >= 0; i--) {
        response = {type: 'or' as const, index: found.path[i], response};
      }
      const wfRef = this.$refs.waitingFor as {onsave?: (out: unknown) => void} | undefined;
      wfRef?.onsave?.(response);
      this.convertPlantsPickerActive = false;
    },
    // ─── Standard Projects flow ─────────────────────────────────────
    // Click on a project's USE button. If the project can ONLY be paid
    // for in M€ (no alt resources usable), submit the full M€ payment
    // directly. If the player has at least one alt resource the project
    // accepts AND owns any of it, open the client-side payment-preview
    // modal so they can dial in the mix before submitting.
    onUseStandardProject(cardName: CardName): void {
      const action = this.findStandardProjectsAction(this.playerView.waitingFor);
      if (!action) return;
      const card = action.input.cards.find((c) => c.name === cardName);
      if (card === undefined || card.isDisabled === true) return;
      const cost = card.calculatedCost ?? 0;
      const paymentOptions = action.input.paymentOptions ?? {};

      if (this.standardProjectHasAlternativeResources(card, paymentOptions)) {
        // Title is a Message object (NOT a string concatenation) so the
        // i18n directive translates BOTH the template "Pay for ${0}" AND
        // the typed CARD placeholder lookup ("Power Plant:SP" →
        // "Электростанция"). Concatenating "Pay for " + cardName as a
        // raw string produces an untranslated literal like
        // "Pay for Power Plant:SP" which lands in the header without a
        // matching locale key.
        const title: Message = {
          message: 'Pay for ${0}',
          data: [{type: LogMessageDataType.CARD as const, value: cardName}],
        };
        this.pendingStdProjectPayment = {
          cardName,
          // Same Message object on both fields — the modal uses `title`
          // for the minimize-pill text and the hosted payment content
          // reads `input.title` for the modal header. Sharing the same
          // typed Message keeps translations consistent.
          title: title,
          input: {
            type: 'payment',
            title: title,
            // "Pay" reads as the action being committed in the modal —
            // matches the action-step semantics. The Standard Projects
            // overlay's button reads "Use" (project selection); this is
            // the payment step, hence "Pay".
            buttonLabel: 'Pay',
            amount: cost,
            paymentOptions: paymentOptions,
            seeds: 0,
            auroraiData: 0,
            kuiperAsteroids: 0,
            spireScience: 0,
            reserveUnits: card.reserveUnits ?? Units.EMPTY,
            floaters: 0,
            microbes: 0,
            graphene: 0,
          },
        };
        this.activeOverlay = null; // close the standard-projects overlay
        return;
      }

      // No alt resources usable — pay full M€ directly. Close the
      // overlay too; the action has been committed.
      this.submitStandardProjectPayment(cardName, Payment.of({megacredits: cost}));
      this.activeOverlay = null;
    },
    // Returns true iff the project accepts at least one alternative
    // resource that the player actually owns. Mirrors the per-card
    // `canPayWith` flags (steel for City+Prefab, titanium / kuiperAsteroids,
    // seeds for Greenery+Soylent) plus the global player flags (Helion
    // heat-as-M€, Luna Trade Federation titanium-as-M€) and the always-on
    // Aurorai / Spire card resources.
    standardProjectHasAlternativeResources(
      card: CardModel,
      opts: SelectProjectCardToPlayModel['paymentOptions'],
    ): boolean {
      const player = this.thisPlayer;
      // Helion: heat usable as M€ for any standard project.
      if (player.tableau.some((c) => c.name === CardName.HELION) && player.heat > 0) return true;
      // Steel — per-card opt-in (City + Prefab, Excavate, Moon Road).
      if (opts.steel === true && player.steel > 0) return true;
      // Titanium — per-card opt-in OR Luna Trade Federation.
      if ((opts.titanium === true || opts.lunaTradeFederationTitanium === true) && player.titanium > 0) return true;
      // Per-card alt-resource flags from `card.standardProjectCanPayWith`.
      const canPayWith = card.standardProjectCanPayWith;
      if (canPayWith?.seeds === true && player.tableau.some((c) => c.name === CardName.SOYLENT_SEEDLING_SYSTEMS)) {
        const soylent = player.tableau.find((c) => c.name === CardName.SOYLENT_SEEDLING_SYSTEMS);
        if ((soylent?.resources ?? 0) > 0) return true;
      }
      if (canPayWith?.kuiperAsteroids === true && player.tableau.some((c) => c.name === CardName.KUIPER_COOPERATIVE)) {
        const kuiper = player.tableau.find((c) => c.name === CardName.KUIPER_COOPERATIVE);
        if ((kuiper?.resources ?? 0) > 0) return true;
      }
      // Aurorai data / Spire science — always allowed for standard projects
      // when the player owns the corp/card.
      const aurorai = player.tableau.find((c) => c.name === CardName.AURORAI);
      if (aurorai !== undefined && (aurorai.resources ?? 0) > 0) return true;
      const spire = player.tableau.find((c) => c.name === CardName.SPIRE);
      if (spire !== undefined && (spire.resources ?? 0) > 0) return true;
      return false;
    },
    onStdProjectPaymentConfirm(payment: Payment): void {
      if (this.pendingStdProjectPayment === undefined) return;
      this.submitStandardProjectPayment(this.pendingStdProjectPayment.cardName, payment);
      this.pendingStdProjectPayment = undefined;
    },
    onStdProjectPaymentCancel(): void {
      this.pendingStdProjectPayment = undefined;
      // Restore the Standard Projects overlay so the player can pick a
      // different project (or close it themselves). The overlay was
      // dismissed when the payment modal opened — no point making the
      // player click "Standard Projects" again after cancel.
      this.activeOverlay = 'standardProjects';
    },
    // Wraps the chosen card + payment into a nested OR response that
    // matches what the legacy radio UI submits when the player picks
    // Standard Projects → <card> → Confirm. Routes through WaitingFor.onsave.
    submitStandardProjectPayment(cardName: CardName, payment: Payment): void {
      const action = this.findStandardProjectsAction(this.playerView.waitingFor);
      if (!action || action.path.length === 0) {
        console.warn('Standard project: action not found in waitingFor tree');
        return;
      }
      let response: unknown = {
        type: 'projectCard' as const,
        card: cardName,
        payment: payment,
      };
      for (let i = action.path.length - 1; i >= 0; i--) {
        response = {type: 'or' as const, index: action.path[i], response};
      }
      const wfRef = this.$refs.waitingFor as {onsave?: (out: unknown) => void} | undefined;
      wfRef?.onsave?.(response);
    },
    getFleetsCountRange(player: PublicPlayerModel): Array<number> {
      const fleetsRange = [];
      for (let i = 0; i < player.fleetSize - player.tradesThisGeneration; i++) {
        fleetsRange.push(i);
      }
      return fleetsRange;
    },
    toggle(type: ToggleableCardType): void {
      this[typeToDataModel[type].key] = !this[typeToDataModel[type].key];
    },
    isVisible(type: ToggleableCardType): boolean {
      return this[typeToDataModel[type].key];
    },
    getToggleLabel(hideType: ToggleableCardType): string {
      const val = this[typeToDataModel[hideType].key];
      return val ? '✔' : '';
    },
    getHideButtonClass(hideType: ToggleableCardType): string {
      const prefix = 'hiding-card-button ';
      switch (hideType) {
      case 'HAND':
        return prefix + (this.showHand ? 'hand-toggle' : 'hand-toggle-transparent');
      case 'ACTIVE':
        return prefix + (this.showActiveCards ? 'active' : 'active-transparent');
      case 'AUTOMATED':
        return prefix + (this.showAutomatedCards ? 'automated' : 'automated-transparent');
      case 'EVENT':
        return prefix + (this.showEventCards ? 'event' : 'event-transparent');
      }
    },
    isActive(cardModel: CardModel): boolean {
      const card = getCardOrThrow(cardModel.name);
      return card.type === CardType.ACTIVE || card.hasAction;
    },
    isNotActive(cardModel: CardModel): boolean {
      return !getCardOrThrow(cardModel.name).hasAction;
    },
  },
});

</script>
