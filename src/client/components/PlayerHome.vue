<template>
  <div id="player-home" :class="[(game.turmoil ? 'with-turmoil': ''), playerTintClass]">
    <div class="top-bar-buttons" v-i18n>
      <div class="bottom-bar-btn" :class="{'bottom-bar-btn--active': activeOverlay === 'milestones'}" v-on:click="toggleOverlay('milestones')">Milestones</div>
      <div class="bottom-bar-btn bottom-bar-btn--center" :class="{'bottom-bar-btn--active': activeOverlay === 'standardProjects'}" v-on:click="toggleOverlay('standardProjects')">Standard Projects</div>
      <div class="bottom-bar-btn" :class="{'bottom-bar-btn--active': activeOverlay === 'awards'}" v-on:click="toggleOverlay('awards')">Awards</div>
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
      @selectPlayer="selectedPlayerColor = $event" />

    <div v-if="activeOverlay === 'log'" class="bar-overlay bar-overlay--log">
      <div class="bar-overlay-close" v-on:click="activeOverlay = null">✕</div>
      <log-panel :viewModel="playerView" :color="thisPlayer.color" :step="game.step"></log-panel>
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
        <waiting-for v-if="game.phase !== 'end'" :playerView="playerView" :waitingfor="playerView.waitingFor"></waiting-for>
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

    <div v-if="game.spectatorId">
      <a :href="'/spectator?id=' +game.spectatorId" target="_blank" rel="noopener noreferrer" v-i18n>Spectator link</a>
    </div>
    <purge-warning :expectedPurgeTimeMs="game.expectedPurgeTimeMs"></purge-warning>
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
import PurgeWarning from '@/client/components/common/PurgeWarning.vue';
import UndergroundTokens from '@/client/components/underworld/UndergroundTokens.vue';
import KeyboardShortcuts from '@/client/components/KeyboardShortcuts.vue';
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

type PlayerHomeModel = ToggleableState & {
  selectedPlayerColor: Color | undefined;
  activeOverlay: OverlayId | null;
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
    PurgeWarning,
    UndergroundTokens,
    KeyboardShortcuts,
  },
  methods: {
    isPlayerActing(playerView: PlayerViewModel) : boolean {
      return playerView.players.length > 1 && playerView.waitingFor !== undefined;
    },
    toggleOverlay(id: OverlayId): void {
      this.activeOverlay = this.activeOverlay === id ? null : id;
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
