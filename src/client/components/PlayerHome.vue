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

          v40-u: also hidden when zero milestones have been claimed — an
          empty 3-slot strip carries no information, just visual noise
          under the bar button. Once the first claim lands the strip
          appears with the badge populated.
        -->
        <div v-if="activeOverlay !== 'milestones' && claimedMilestonesCount > 0" class="milestone-badges-strip">
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

          v40-u: also hidden when zero awards have been funded — mirrors the
          milestones strip behaviour. Empty 3-slot strip carried no info,
          just chrome under the bar button. First fund reveals the strip.
        -->
        <div v-if="activeOverlay !== 'awards' && fundedAwardsCount > 0" class="milestone-badges-strip">
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
      <!--
        Colonies bottom-bar button. Renamed from "Colonies" to "Trade with
        colonies" — it now opens the new sci-fi ColoniesOverlay in trade
        mode (or view-only mode when trade isn't currently offered by the
        server). Old behaviour of toggling an undefined inline overlay is
        gone; the button drives `coloniesOverlayOpen` directly.
        Hidden when the game has no colonies (vanilla / no-coloniesExtension
        setup).
      -->
      <div v-if="game.colonies.length > 0"
           class="bottom-bar-btn"
           :class="{'bottom-bar-btn--active': coloniesOverlayOpen}"
           v-on:click="onOpenColoniesOverlay">
        <span v-i18n>Trade with colonies</span>
      </div>
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
      :passAvailable="passAvailable"
      :endTurnAvailable="endTurnAvailable"
      @selectPlayer="selectedPlayerColor = $event"
      @convert-heat="convertHeat"
      @convert-plants="toggleConvertPlantsPicker"
      @pass="onPassClick"
      @end-turn="onEndTurnClick" />

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
      Cancellable placement banner — convert-plants picker mode.
      Mirrors the mandatory banner (rendered from WaitingFor.vue for
      server-driven SelectSpace) but the cancellable=true flag enables
      the "Cancel placement" button in the details modal. Cancel emits
      'cancel' → we toggle the picker flag off, which unmounts the
      <select-space> above. SelectSpace.beforeUnmount clears the
      board highlights and click handlers — same path the old second-
      click on the action button used to take. No server round-trip
      is required because the server is still in OrOptions state
      (the player just hadn't committed to the convert-plants option).
    -->
    <PlacementBanner v-if="convertPlantsPickerActive && convertPlantsPrompt !== undefined"
                     :title="convertPlantsPrompt.title"
                     :cancellable="true"
                     sourceMessage="This action was initiated by the convert-plants action."
                     @cancel="toggleConvertPlantsPicker" />

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

    <!--
      Client-side confirmation gate for the Pass action. Pass commits the
      player out of the rest of the generation, so we double-prompt before
      POSTing. Mounted on click of the in-card PASS button; Confirm submits,
      Cancel just unmounts the modal (no server round-trip).
    -->
    <MandatoryInputModal v-if="passConfirmOpen"
                         :title="$t('Pass for this generation')"
                         :minimizable="false">
      <PassConfirmContent
        @confirm="onPassConfirm"
        @cancel="onPassCancel" />
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
      :discardPileSize = "game.discardPileSize"
      :legacyUiActive="activeOverlay === 'legacyUi'"
      @toggle-legacy-ui="activeOverlay = (activeOverlay === 'legacyUi' ? null : 'legacyUi')">
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

    <!--
      Legacy-UI wrapper. Holds the old radio-form action stack, hand,
      drafted-cards legacy row, self-replicating-robots card pile. By
      default invisible + non-interactive (board fills the viewport).
      Opening the sidebar "Show legacy UI" button toggles
      `activeOverlay === 'legacyUi'` → this wrapper switches to a
      fixed-positioned bar-overlay (same chrome as the log/VP
      overlays). Content stays mounted across open/close so any
      in-flight WaitingFor state / hand sort / scroll position
      survives. Header row inside the overlay shows a close button.
    -->
      <div class="legacy-ui-overlay"
           :class="{'legacy-ui-overlay--open': activeOverlay === 'legacyUi'}"
           role="region"
           :aria-hidden="activeOverlay !== 'legacyUi'">
        <div class="legacy-ui-overlay__header" v-if="activeOverlay === 'legacyUi'">
          <span class="legacy-ui-overlay__title" v-i18n>Legacy UI</span>
          <div class="bar-overlay-close" v-on:click="activeOverlay = null" :title="$t('Close')">✕</div>
        </div>

        <a class="hotkey-target"></a>

        <a class="hotkey-target"></a>
        <div class="player_home_block player_home_block--actions nofloat">
          <a name="actions" class="player_home_anchor"></a>
          <dynamic-title title="Actions" :color="thisPlayer.color"/>
          <waiting-for v-if="game.phase !== 'end'" ref="waitingFor" :playerView="playerView" :waitingfor="playerView.waitingFor"></waiting-for>
        </div>

        <!--
          Legacy drafted-cards block. The new `DraftedCardsPile` inside
          `DraftFlowOverlay` (mounted at App level) now shows the same
          info as a compact sci-fi pile, so this row is redundant. Kept
          in the template (just hidden via `--drafted-legacy` CSS) so any
          technical consumers of the legacy DOM aren't disturbed.
        -->
        <div class="player_home_block player_home_block--hand player_home_block--drafted-legacy"
             v-if="playerView.draftedCards.length > 0">
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
    </div>

    <div v-if="thisPlayer.underworldData.tokens.length > 0">
      <dynamic-title title="Claimed Underground Resource Tokens" :color="thisPlayer.color"/>
      <underground-tokens :underworldData="thisPlayer.underworldData"></underground-tokens>
    </div>

    <template v-if="thisPlayer.tableau.length === 0">
      <PlayerSetupView :playerView="playerView" :tileView="tileView"/>
    </template>

    <!--
      Legacy in-page colonies block deleted. The same info is presented
      via the new sci-fi `ColoniesOverlay` (opened from the bottom-bar
      "Trade with colonies" button OR auto-mounted when the server is
      waiting on a SelectColony prompt — e.g. after the Build Colony
      Standard Project resolves).
    -->

    <ColoniesOverlay v-if="coloniesOverlayOpen"
                     :colonies="game.colonies"
                     :players="playerView.players"
                     :mode="coloniesOverlayMode"
                     :selectableNames="coloniesOverlaySelectable"
                     :disabledReasons="coloniesOverlayDisabledReasons"
                     :dismissable="coloniesOverlayDismissable"
                     :viewerColor="thisPlayer.color"
                     @select="onColonySelected($event)"
                     @close="onCloseColoniesOverlay" />

    <!--
      Pay-trade-fee chooser. Two-step trade flow: player picks a colony
      in ColoniesOverlay → we mount this modal listing the available
      payment options → on pick, we assemble the nested AndOptions
      response and POST. Cancel returns to the colonies grid (the
      overlay stays open) so the player can pick a different colony.
    -->
    <MandatoryInputModal v-if="pendingTradeColony !== undefined"
                         :title="$t('Pay trade fee')"
                         :minimizable="false">
      <ColonyTradePaymentModal :colonyName="pendingTradeColony.colonyName"
                               :options="pendingTradeColony.paymentOptions"
                               @select="onColonyTradePaymentSelected($event)"
                               @cancel="onColonyTradePaymentCancel" />
    </MandatoryInputModal>

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
import {useBoardAutoScale} from '@/client/utils/useBoardAutoScale';
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
import PlacementBanner from '@/client/components/PlacementBanner.vue';
import {placementLockState} from '@/client/components/placementLockState';
import StandardProjectPaymentContent from '@/client/components/payment/StandardProjectPaymentContent.vue';
import PassConfirmContent from '@/client/components/overview/PassConfirmContent.vue';
import ColoniesOverlay from '@/client/components/colonies/ColoniesOverlay.vue';
import ColonyTradePaymentModal from '@/client/components/colonies/ColonyTradePaymentModal.vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardResource} from '@/common/CardResource';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {Payment} from '@/common/inputs/Payment';
import {CardName} from '@/common/cards/CardName';
import {Units} from '@/common/Units';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';
import {AwardName} from '@/common/ma/AwardName';
import {MAX_MILESTONES, MAX_AWARDS} from '@/common/constants';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {PlayerInputModel, OrOptionsModel, AndOptionsModel, SelectOptionModel, SelectPaymentModel, SelectColonyModel, SelectProjectCardToPlayModel, SelectSpaceModel} from '@/common/models/PlayerInputModel';
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
type OverlayId = 'milestones' | 'standardProjects' | 'awards' | 'colonies' | 'cards' | 'played' | 'victoryPoints' | 'log' | 'legacyUi';

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

// Pending Trade-with-Colony state. Set after the player picks a colony in
// the overlay (trade mode), cleared on Cancel or after submission. Carries
// the inputs the second-step payment modal needs to render the chooser AND
// the index path required to wrap the final AndOptions response back into
// the outer action OR.
type PendingTradeColony = {
  colonyName: ColonyName;
  tradeActionPath: ReadonlyArray<number>;
  paymentOptions: ReadonlyArray<SelectOptionModel>;
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
  // True while the Pass confirmation modal is open. The pass action is
  // irreversible (no more turns this generation), so we gate it through
  // a client-side confirmation modal before POSTing to the server.
  passConfirmOpen: boolean;
  // ColoniesOverlay state. `coloniesOverlayOpen` is the gate; mode +
  // pending trade carry the per-flow context. We use distinct state
  // here (NOT activeOverlay) because the colonies overlay can be
  // auto-mounted by the server-driven build flow regardless of which
  // bar overlay the player has open.
  coloniesOverlayOpen: boolean;
  coloniesOverlayManualOpen: boolean;
  pendingTradeColony: PendingTradeColony | undefined;
  /*
   * Capture-phase event listeners installed during placement-pending
   * to block clicks on locked action buttons + apply native `title`
   * tooltips on hover. Held on the instance so install/uninstall can
   * remove the same reference. `null` when no placement is active.
   */
  placementClickGuard: ((e: MouseEvent) => void) | null;
  placementMouseOverHandler: ((e: MouseEvent) => void) | null;
}

type ToggleableCardType = 'HAND' | 'ACTIVE' | 'AUTOMATED' | 'EVENT';

const typeToDataModel: Record<ToggleableCardType, {key: keyof ToggleableState, preference: keyof Preferences}> = {
  HAND: {key: 'showHand', preference: 'hide_hand'},
  ACTIVE: {key: 'showActiveCards', preference: 'hide_active_cards'},
  AUTOMATED: {key: 'showAutomatedCards', preference: 'hide_automated_cards'},
  EVENT: {key: 'showEventCards', preference: 'hide_event_cards'},
} as const;

/*
 * CSS selectors for turn-ending action buttons that must be blocked
 * while a tile placement is pending. Kept in sync with the same list
 * in `src/styles/placement_banner.less` and CLAUDE.md (`Tile placement
 * banner + placement lock`). Adding a NEW dedicated action button
 * means adding its class HERE (so the JS click guard catches it) AND
 * in the LESS file (so it gets the dim visuals).
 */
const PLACEMENT_LOCKED_SELECTORS = [
  '.left-panel-card-action-btn',
  '.std-project-use-btn',
  '.milestone-claim-btn',
  '.award-fund-btn',
  '.convert-action-btn--heat',
  '.convert-action-btn--plants',
  '.colony-tile__select-btn',
  '.colony-detail__select-btn',
  '.wf-action',
].join(', ');

const PLACEMENT_ORIG_TITLE_ATTR = 'data-placement-orig-title';

export default defineComponent({
  name: 'player-home',
  mixins: [HomeMixin],
  // Composables that need the `onMounted` / `onBeforeUnmount` setup-only
  // API live here. `useBoardAutoScale` writes the runtime-computed
  // `--board-scale` CSS variable so the Mars board fills the available
  // central viewport area on any monitor / window size / F11 state.
  setup() {
    useBoardAutoScale();
  },
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
      passConfirmOpen: false,
      coloniesOverlayOpen: false,
      coloniesOverlayManualOpen: false,
      pendingTradeColony: undefined,
      /*
       * Capture-phase click guard installed during placement-pending
       * to intercept clicks on locked action buttons BEFORE Vue's
       * @click handlers fire. `null` when no placement is active.
       * Stored on the instance (not closed over in install/uninstall)
       * so the removeEventListener reference matches.
       */
      placementClickGuard: null as ((e: MouseEvent) => void) | null,
      placementMouseOverHandler: null as ((e: MouseEvent) => void) | null,
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
    /*
     * Server-driven auto-open of the colonies overlay. When the server's
     * waitingFor flips to a top-level SelectColony (e.g. the player just
     * picked Build Colony in the Standard Projects overlay and the SP
     * resolved into a deferred SelectColony), we mount the new overlay in
     * build mode immediately so the legacy radio UI never gets to render.
     * Conversely, when the SelectColony resolves (server moves on, the
     * waitingFor becomes something else), and the overlay wasn't manually
     * opened by the bar button, close it automatically — the user came
     * here to pick a colony, that's done, get out of their way.
     */
    buildColonyContext: {
      immediate: true,
      handler(newVal: {path: ReadonlyArray<number>} | undefined, oldVal: {path: ReadonlyArray<number>} | undefined) {
        if (newVal !== undefined && oldVal === undefined) {
          this.coloniesOverlayOpen = true;
        } else if (newVal === undefined && oldVal !== undefined && !this.coloniesOverlayManualOpen) {
          this.coloniesOverlayOpen = false;
        }
      },
    },
    /*
     * Global placement-lock body class. While the game is waiting on a
     * tile placement on the Mars board — either MANDATORY (server-driven
     * top-level SelectSpace from a standard project / card / global
     * event) or CANCELLABLE (client-driven convert-plants picker) — we
     * tag <body> with `.placement-pending`. The CSS in
     * placement_banner.less dims and blocks pointer-events on all
     * action UI (sidebars, overlays, bar buttons) except the board
     * itself and the placement banner / details modal (those are
     * teleported to body, outside #player-home).
     *
     * Why even cancellable mode locks: per UX contract, the player must
     * EXPLICITLY cancel via the banner's details modal before doing
     * anything else. Without this lock, a player mid-pick could click
     * "Claim a milestone" and the server would happily accept the
     * milestone claim (the convert-plants picker is just client-side
     * state — the server is still in OrOptions, so a milestone option
     * is a valid response). The picker would then become silently
     * stale. Locking the UI forces the explicit cancel decision.
     */
    placementPending: {
      immediate: true,
      handler(active: boolean) {
        if (active) {
          document.body.classList.add('placement-pending');
          this.installPlacementGuards();
        } else {
          document.body.classList.remove('placement-pending');
          this.uninstallPlacementGuards();
        }
      },
    },
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleOutsideOverlayClick);
    /* Defensive cleanup — if PlayerHome unmounts mid-placement (e.g.
     * navigation, game-over reroute), don't leave the lock state behind:
     *   - body class would keep dimming buttons on whatever screen
     *     the player ends up on;
     *   - the capture-phase click guard would keep intercepting clicks
     *     on the next page (until the listener got GC'd, which only
     *     happens if no references remain — risky).
     *   - any titles we overwrote would stay overwritten until the
     *     element next re-renders.
     */
    this.uninstallPlacementGuards();
    document.body.classList.remove('placement-pending');
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
    // Pass / End-Turn availability. Both options live as siblings inside the
    // top-level action OrOptions (Player.ts → getActions). The server has
    // already applied every rule that decides whether each option is offered
    // right now (Pass is unconditional while it's the player's turn; End Turn
    // requires actionsTakenThisRound > 0 and that not every other player has
    // passed). So the option's presence in `waitingFor` IS the source of
    // truth — we don't re-derive availability client-side.
    passAvailable(): boolean {
      return this.findPassPath(this.playerView.waitingFor) !== undefined;
    },
    endTurnAvailable(): boolean {
      return this.findEndTurnPath(this.playerView.waitingFor) !== undefined;
    },
    // ─── Colonies — trade & build context ──────────────────────────────
    //
    // Trade-with-colony lives inside the top-level action OrOptions as an
    // AndOptions(payOptions, selectColony) with title 'Trade with a colony
    // tile' (see server/player/Colonies.ts). Walking waitingFor returns the
    // index path to that AndOptions plus its inner two children — we need
    // both to assemble the eventual response payload.
    //
    // Build-colony / card-driven colony place lives as a TOP-LEVEL
    // SelectColony prompt (the standard project defers BuildColony which
    // pops a SelectColony as the next waitingFor). We detect it as a
    // recursive scan for `type === 'colony'` — that way mid-flow nested
    // prompts (e.g. some card asks to pick a colony INSIDE an OrOptions)
    // are also captured.
    tradeColonyContext(): {
      path: ReadonlyArray<number>;
      paymentOptions: ReadonlyArray<SelectOptionModel>;
      colonies: ReadonlyArray<ColonyName>;
    } | undefined {
      return this.findTradeColonyContext(this.playerView.waitingFor);
    },
    buildColonyContext(): {
      path: ReadonlyArray<number>;
      colonies: ReadonlyArray<ColonyName>;
    } | undefined {
      return this.findBuildColonyContext(this.playerView.waitingFor);
    },
    coloniesOverlayMode(): 'trade' | 'build' | 'view' {
      // build wins over trade — a top-level SelectColony from the server
      // means the server is BLOCKING on a colony pick (mandatory), so the
      // build prompt always takes precedence over the optional trade
      // action even if the latter is also offered somehow.
      if (this.buildColonyContext) return 'build';
      if (this.tradeColonyContext) return 'trade';
      return 'view';
    },
    // The set of colonies the server is currently offering as picks for
    // the active mode. View mode → empty. Tile-level enabled state and
    // the SELECT button read this directly.
    coloniesOverlaySelectable(): ReadonlyArray<ColonyName> {
      if (this.coloniesOverlayMode === 'build') {
        return this.buildColonyContext?.colonies ?? [];
      }
      if (this.coloniesOverlayMode === 'trade') {
        return this.tradeColonyContext?.colonies ?? [];
      }
      return [];
    },
    // In build mode the overlay is MANDATORY — the server is waiting on
    // the colony pick, dismissing via backdrop would leave the game in
    // limbo (or trigger the legacy radio UI to display). Trade and view
    // modes are dismissable.
    coloniesOverlayDismissable(): boolean {
      return this.coloniesOverlayMode !== 'build';
    },
    // Per-colony tooltip explaining WHY a colony can't be picked right
    // now. Computed once for every colony so the overlay tile tooltips
    // are specific ("Colony has no visitors slot left" vs the generic
    // "Unavailable") — matters most for accessibility and learnability.
    //
    // Reasons surface the underlying game-state signals:
    //   - colony not yet activated → "Colony is inactive (not yet built
    //     on this game)"
    //   - colony track filled (no build slots left) → "Colony is full"
    //   - viewer already has a colony there (and !allowDuplicate from
    //     server) → "You already have a colony here"
    //   - colony has a visitor this generation (trade locked) →
    //     "Another trade fleet is already here"
    //   - viewer is out of free fleets (trade mode) →
    //     "You have no free trade fleets"
    //   - trade embargo in effect → "Trade embargo is in effect"
    //   - not in trade mode at all (e.g. game phase) →
    //     "No colony action available right now"
    //
    // The English keys are wired through i18n so Russian readers get
    // the same precise message.
    coloniesOverlayDisabledReasons(): Partial<Record<ColonyName, string>> {
      const out: Partial<Record<ColonyName, string>> = {};
      const mode = this.coloniesOverlayMode;
      const myColor = this.thisPlayer.color;
      const noFreeFleets = (this.thisPlayer.fleetSize ?? 0) <=
        (this.thisPlayer.tradesThisGeneration ?? 0);
      // Trade embargo isn't surfaced to the client `GameModel` — when in
      // effect the server simply omits the trade action from waitingFor,
      // so the overlay opens in `view` mode and we'd fall through to
      // "No colony action available right now". No special-case needed.
      const selectableSet = new Set(this.coloniesOverlaySelectable);
      for (const c of this.game.colonies) {
        if (selectableSet.has(c.name)) continue; // skip: tile shows positive tooltip
        if (!c.isActive) {
          // Inactive-colony tooltips are SPECIFIC. Per the ColoniesHandler
          // activation rule (server/colonies/ColoniesHandler.ts), a colony
          // can be activated by:
          //   - any player playing a card whose card-resource matches the
          //     colony's `metadata.cardResource` (Enceladus → microbe,
          //     Miranda → animal, Titan → floater);
          //   - the Venus colony additionally activates on any Venus-tag
          //     card with a resource type.
          // Surfacing the specific trigger here turns an opaque
          // "unavailable" into an actionable explanation — the player
          // knows what to do (or wait for) to unlock the colony.
          out[c.name] = this.inactiveColonyReason(c.name);
          continue;
        }
        if (mode === 'build') {
          if (c.colonies.length >= 3) {
            out[c.name] = 'Colony is full';
            continue;
          }
          if (c.colonies.indexOf(myColor) !== -1) {
            out[c.name] = 'You already have a colony here';
            continue;
          }
          // Falls through to a generic reason — Venus / Europa / Leavitt
          // TR-affordability checks happen server-side and produce the
          // colony's absence from `coloniesModel`. We don't replicate the
          // canAfford math here.
          out[c.name] = 'Cannot build on this colony right now';
          continue;
        }
        if (mode === 'trade') {
          if (c.visitor !== undefined) {
            out[c.name] = this.visitorBlockReason(c.visitor);
            continue;
          }
          if (noFreeFleets) {
            out[c.name] = 'You have no free trade fleets';
            continue;
          }
          out[c.name] = 'Cannot trade with this colony right now';
          continue;
        }
        // view mode — no current trade/build action. The reason can be
        // specific to the colony (has visitor) OR a global "you can't
        // trade right now" reason (not your turn, no fleets, etc.).
        if (c.visitor !== undefined) {
          out[c.name] = this.visitorBlockReason(c.visitor);
          continue;
        }
        out[c.name] = this.viewModeReason;
      }
      return out;
    },
    // Global reason explaining why the player can't initiate a colony
    // trade right now. Surfaced as the disabled-reason tooltip on every
    // active+empty colony in view mode (e.g. when the player clicked
    // the bottom-bar "Trade with colonies" button on an opponent's
    // turn, or mid-flow during card resolution).
    //
    // The chain mirrors the server-side check in `Colonies.canTrade()`:
    //   it's the player's turn → top-level action prompt is up,
    //   AND they have free fleets,
    //   AND at least one colony is tradeable.
    // Whichever condition fails first wins the tooltip.
    viewModeReason(): string {
      const wf = this.playerView.waitingFor;
      // Not the viewer's turn at all — server has no prompt for them.
      if (wf === undefined) {
        return 'Not your turn right now';
      }
      // The viewer IS being waited on, but not on an action menu — a
      // card or sub-prompt is still resolving. Trade isn't an option
      // until the current prompt completes.
      const title = inputTitleText(wf.title);
      if (title !== 'Take your first action' && title !== 'Take your next action') {
        return 'Another action is in progress';
      }
      // Action menu is up but trade isn't on offer. Server-side gate is
      // `canTrade() = tradeableColonies > 0 && freeFleets > 0 && !embargo`.
      const me = this.thisPlayer;
      const noFleets = (me.fleetSize ?? 0) <= (me.tradesThisGeneration ?? 0);
      if (noFleets) return 'You have no free trade fleets';
      const anyTradeable = this.game.colonies.some(
        (c) => c.isActive && c.visitor === undefined);
      if (!anyTradeable) return 'No colonies are open for trade right now';
      // Defensive fallback — covers embargo (which we can't detect on
      // the client) and any edge case where the trade action is filtered
      // out by some server-only rule.
      return 'Trading is not available right now';
    },
    convertPlantsPrompt(): SelectSpaceModel | undefined {
      return this.findConvertPlantsOption(this.playerView.waitingFor)?.spacePrompt as SelectSpaceModel | undefined;
    },
    /*
     * True when the game is waiting on a tile placement on the Mars
     * board — covers three sources:
     *
     *   - MANDATORY (server-driven, top-level): `waitingFor.type ===
     *     'space'`. Standard projects, card behavior tiles, global
     *     events. PlacementBanner mounted from WaitingFor.vue.
     *
     *   - CANCELLABLE (client-driven, convert plants): the player
     *     toggled the picker on; server still in OrOptions. Banner
     *     mounted from PlayerHome.vue (this component, template).
     *
     *   - MANDATORY (modal-driven, nested in MandatoryInputModal):
     *     a SelectSpace option was picked inside the modal's
     *     OrOptions (currently the WGT "Add an ocean" prompt, but
     *     any future nested SelectSpace in a modal works through the
     *     same path). MandatoryInputModal raises the shared
     *     `placementLockState.modalPicker` flag via OrOptions' picker-
     *     mode setter; we read it here to fold that signal into the
     *     unified placement-pending state. Banner mounted from
     *     MandatoryInputModal.vue.
     *
     * Read by a watcher (above this block) that toggles
     * `body.placement-pending`, installs/uninstalls the JS click
     * guard, and applies native title tooltips on locked buttons.
     */
    placementPending(): boolean {
      const wf = this.playerView.waitingFor;
      if (wf !== undefined && wf.type === 'space') {
        return true;
      }
      if (this.convertPlantsPickerActive && this.convertPlantsPrompt !== undefined) {
        return true;
      }
      if (placementLockState.modalPicker) {
        return true;
      }
      return false;
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
    PlacementBanner,
    StandardProjectPaymentContent,
    PassConfirmContent,
    ColoniesOverlay,
    ColonyTradePaymentModal,
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
    //
    // Sidebar buttons (`.sidebar_cont`) are ALSO exempt — without this,
    // a click on the sidebar's "Show legacy UI" toggle would emit the
    // open event AND then this same click would fire here and close
    // the just-opened overlay (net: nothing visible). Same trap as a
    // bottom-bar-btn would have had if not exempted.
    //
    // `.legacy-ui-overlay` exempted so clicks INSIDE the legacy overlay
    // (action radio rows, hand cards, etc.) don't dismiss it.
    handleOutsideOverlayClick(e: MouseEvent): void {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest('.top-bar-dropdown') ||
          target.closest('.bar-overlay') ||
          target.closest('.legacy-ui-overlay') ||
          target.closest('.sidebar_cont') ||
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
    // Walks the action tree looking for a SelectOption with the given title
    // (e.g. "Pass for this generation" / "End Turn"). Returns the index PATH
    // from the root so we can wrap a `{type: 'option'}` response in the right
    // number of nested OR layers. Pass + End Turn are siblings at the top
    // level of the action OrOptions; recursion handles wrapping (initial-
    // action menus, etc.).
    findOptionPathByTitle(
      wf: PlayerInputModel | undefined,
      title: string,
      pathSoFar: ReadonlyArray<number> = [],
    ): ReadonlyArray<number> | undefined {
      if (!wf) return undefined;
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          if (opt.type === 'option' && inputTitleText(opt.title) === title) {
            return [...pathSoFar, i];
          }
          const deeper = this.findOptionPathByTitle(opt, title, [...pathSoFar, i]);
          if (deeper) return deeper;
        }
      }
      return undefined;
    },
    findPassPath(wf: PlayerInputModel | undefined): ReadonlyArray<number> | undefined {
      return this.findOptionPathByTitle(wf, 'Pass for this generation');
    },
    findEndTurnPath(wf: PlayerInputModel | undefined): ReadonlyArray<number> | undefined {
      return this.findOptionPathByTitle(wf, 'End Turn');
    },
    // Maps a colony name to the SPECIFIC tooltip explaining what activates
    // it. Driven by the colony's metadata: cardResource fields point to
    // the resource type a played card must carry; Venus is the special
    // case (matched by name because Venus's metadata has no
    // `cardResource`, it activates on the Venus TAG).
    //
    // All four "starts inactive" colonies in the codebase today are
    // covered explicitly (Enceladus / Miranda / Titan + Venus). For any
    // future "inactive at start" colony with a card-resource that isn't
    // one of those three, the cardResource branch returns a generic
    // "<resource> card resource" message; for unknown shapes we fall
    // back to the original generic string.
    // Tooltip when a colony has a visitor parked this generation —
    // differentiates "your own fleet (you already traded)" from "another
    // player's fleet" so the reason isn't a flat-out lie when the
    // viewer just finished their own trade. The "other player" branch
    // is pre-translated via `translateTextWithParams` because we need
    // to interpolate the player's display name; the overlay's
    // `translateText` will be a no-op on the resulting Russian string
    // (no matching key — returns input unchanged).
    visitorBlockReason(visitor: Color): string {
      if (visitor === this.thisPlayer.color) {
        return 'You already traded with this colony this generation';
      }
      const p = this.playerView.players.find((p) => p.color === visitor);
      const name = p?.name ?? String(visitor);
      return translateTextWithParams(
        'Trade fleet of ${0} is currently here',
        [name]);
    },
    inactiveColonyReason(name: ColonyName): string {
      if (name === ColonyName.VENUS) {
        return 'Activated when any player plays a Venus-tag card with a resource type';
      }
      const metadata = getColony(name);
      switch (metadata.cardResource) {
      case CardResource.MICROBE:
        return 'Activated when any player plays a card with a microbe resource';
      case CardResource.ANIMAL:
        return 'Activated when any player plays a card with an animal resource';
      case CardResource.FLOATER:
        return 'Activated when any player plays a card with a floater resource';
      default:
        return 'Colony is inactive (not yet built on this game)';
      }
    },
    // ─── Colonies path-finders ─────────────────────────────────────────
    // Walk the waitingFor tree for the trade AndOptions. Returns:
    //  - `path` — index sequence from root needed to wrap the eventual
    //    response in OR layers (same trick milestones / awards use);
    //  - `paymentOptions` — the SelectOption children of the inner
    //    "Pay trade fee" OrOptions, surfaced to the payment chooser modal;
    //  - `colonies` — the colony names from the inner SelectColony's
    //    coloniesModel (which the server has already filtered to ONLY
    //    those currently tradeable).
    findTradeColonyContext(
      wf: PlayerInputModel | undefined,
      pathSoFar: ReadonlyArray<number> = [],
    ): {
      path: ReadonlyArray<number>;
      paymentOptions: ReadonlyArray<SelectOptionModel>;
      colonies: ReadonlyArray<ColonyName>;
    } | undefined {
      if (!wf) return undefined;
      if (wf.type === 'and' && inputTitleText(wf.title) === 'Trade with a colony tile') {
        const children = (wf as AndOptionsModel).options;
        // Expected shape from server: [OrOptions("Pay trade fee"), SelectColony]
        const payOr = children.find((c) => c.type === 'or') as OrOptionsModel | undefined;
        const selectColony = children.find((c) => c.type === 'colony') as
          SelectColonyModel | undefined;
        if (payOr === undefined || selectColony === undefined) return undefined;
        const paymentOptions = payOr.options.filter(
          (o) => o.type === 'option') as ReadonlyArray<SelectOptionModel>;
        const colonies = selectColony.coloniesModel.map((c) => c.name);
        return {path: pathSoFar, paymentOptions, colonies};
      }
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const deeper = this.findTradeColonyContext(options[i], [...pathSoFar, i]);
          if (deeper) return deeper;
        }
      }
      return undefined;
    },
    // Walk the waitingFor tree for a SelectColony that's NOT the trade-
    // flow inner one. Build-colony / card-driven colony place prompts the
    // server as a stand-alone SelectColony at the root (or wrapped in
    // OrOptions when nested mid-flow). The `coloniesModel` is again
    // server-filtered: it contains only colonies the player can BUILD a
    // tile on right now (active, not full, not duplicate, can afford the
    // colony-fee TR if any).
    findBuildColonyContext(
      wf: PlayerInputModel | undefined,
      pathSoFar: ReadonlyArray<number> = [],
      insideTradeAnd: boolean = false,
    ): {
      path: ReadonlyArray<number>;
      colonies: ReadonlyArray<ColonyName>;
    } | undefined {
      if (!wf) return undefined;
      if (wf.type === 'colony' && !insideTradeAnd) {
        const select = wf as SelectColonyModel;
        return {
          path: pathSoFar,
          colonies: select.coloniesModel.map((c) => c.name),
        };
      }
      // Don't descend INTO the trade AndOptions — its child SelectColony
      // belongs to the trade flow, not the build flow.
      const tradeAndHere = wf.type === 'and' &&
        inputTitleText(wf.title) === 'Trade with a colony tile';
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const deeper = this.findBuildColonyContext(
            options[i], [...pathSoFar, i], insideTradeAnd || tradeAndHere);
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
    // Submits a top-level SelectOption picked from the action menu via its
    // index PATH. Wraps a `{type: 'option'}` response in one OR layer per
    // index (innermost first) — same shape the legacy radio UI would POST
    // when the player picks the option and hits Submit. Returns true on
    // successful submission, false if the path is empty or the WaitingFor
    // ref is missing.
    submitActionOptionPath(path: ReadonlyArray<number>): boolean {
      if (path.length === 0) return false;
      let response: unknown = {type: 'option' as const};
      for (let i = path.length - 1; i >= 0; i--) {
        response = {type: 'or' as const, index: path[i], response};
      }
      const wfRef = this.$refs.waitingFor as {onsave?: (out: unknown) => void} | undefined;
      if (wfRef?.onsave) {
        wfRef.onsave(response);
        return true;
      }
      return false;
    },
    // End-Turn: no confirmation modal (skipping the second action is a
    // mild commitment, easily recoverable next round). Submits the
    // server-offered "End Turn" SelectOption straight through.
    onEndTurnClick(): void {
      const path = this.findEndTurnPath(this.playerView.waitingFor);
      if (path === undefined) return;
      this.submitActionOptionPath(path);
    },
    // Pass: irreversible for the rest of the generation. Click opens the
    // client-side confirmation modal; only Confirm fires the network call.
    onPassClick(): void {
      if (!this.passAvailable) return;
      this.passConfirmOpen = true;
    },
    onPassConfirm(): void {
      const path = this.findPassPath(this.playerView.waitingFor);
      this.passConfirmOpen = false;
      if (path === undefined) return;
      this.submitActionOptionPath(path);
    },
    onPassCancel(): void {
      this.passConfirmOpen = false;
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
    /*
     * Install the placement lock — JS-level click block + native title
     * tooltip on hover. CSS does the visual dim (opacity + saturate +
     * not-allowed cursor) but doesn't touch click events: pseudo-
     * element overlays can't intercept clicks (events still target
     * the host), and `pointer-events: none` would suppress the native
     * browser tooltip too. So the actual block lives here in JS.
     *
     * Two listeners attached at document level on the CAPTURE phase:
     *
     *   1. Click guard — runs BEFORE any Vue @click handler. If the
     *      click target is inside a locked-selector match,
     *      preventDefault + stopImmediatePropagation kill the event.
     *      stopImmediatePropagation specifically prevents both
     *      further listeners AND the target's own handlers (Vue's
     *      @click compiles to a normal addEventListener, which lives
     *      on the bubble phase; the capture-phase + stopImmediate
     *      combination preempts it cleanly).
     *
     *   2. Mouseover handler — lazily sets the native `title`
     *      attribute on each locked button the player hovers,
     *      preserving any pre-existing `title` into
     *      `data-placement-orig-title` so we can restore it on
     *      unlock. Mouseover (not mouseenter) bubbles, so a single
     *      document-level listener catches all matches without
     *      per-element wiring. Also runs immediately on install for
     *      all currently-mounted locked buttons so the very first
     *      hover already has a title set (avoids the OS tooltip
     *      delay racing with the mouseover -> setAttribute write).
     */
    installPlacementGuards(): void {
      if (this.placementClickGuard !== null) return;
      const tooltipText = translateText('Finish your current action first');

      const guard = (e: MouseEvent) => {
        const target = e.target as Element | null;
        if (target === null) return;
        if (target.closest(PLACEMENT_LOCKED_SELECTORS) !== null) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      };
      document.addEventListener('click', guard, true);
      this.placementClickGuard = guard;

      const mouseover = (e: MouseEvent) => {
        const target = e.target as Element | null;
        if (target === null) return;
        const locked = target.closest(PLACEMENT_LOCKED_SELECTORS);
        if (locked === null) return;
        if (locked.hasAttribute(PLACEMENT_ORIG_TITLE_ATTR)) return;
        const orig = locked.getAttribute('title') ?? '';
        locked.setAttribute(PLACEMENT_ORIG_TITLE_ATTR, orig);
        locked.setAttribute('title', tooltipText);
      };
      document.addEventListener('mouseover', mouseover, true);
      this.placementMouseOverHandler = mouseover;

      /* Eager pass — set titles on every match currently in the DOM
       * so the first hover doesn't race with the OS tooltip delay. */
      document.querySelectorAll(PLACEMENT_LOCKED_SELECTORS).forEach((el) => {
        if (el.hasAttribute(PLACEMENT_ORIG_TITLE_ATTR)) return;
        const orig = el.getAttribute('title') ?? '';
        el.setAttribute(PLACEMENT_ORIG_TITLE_ATTR, orig);
        el.setAttribute('title', tooltipText);
      });
    },
    uninstallPlacementGuards(): void {
      if (this.placementClickGuard !== null) {
        document.removeEventListener('click', this.placementClickGuard, true);
        this.placementClickGuard = null;
      }
      if (this.placementMouseOverHandler !== null) {
        document.removeEventListener('mouseover', this.placementMouseOverHandler, true);
        this.placementMouseOverHandler = null;
      }
      /* Restore each tagged element's original title — empty string
       * means there wasn't a title attribute originally, in which
       * case we remove ours entirely instead of leaving a blank one. */
      document.querySelectorAll('[' + PLACEMENT_ORIG_TITLE_ATTR + ']').forEach((el) => {
        const orig = el.getAttribute(PLACEMENT_ORIG_TITLE_ATTR) ?? '';
        if (orig === '') {
          el.removeAttribute('title');
        } else {
          el.setAttribute('title', orig);
        }
        el.removeAttribute(PLACEMENT_ORIG_TITLE_ATTR);
      });
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
    // ─── Colonies overlay handlers ─────────────────────────────────────
    // User-initiated open (bottom-bar "Trade with colonies" button). Sets
    // the manual-open flag so the build-context watcher's auto-close
    // logic doesn't kick the overlay shut underneath us if the player
    // happens to be on someone else's turn (no server prompt to drive it).
    onOpenColoniesOverlay(): void {
      this.coloniesOverlayManualOpen = true;
      this.coloniesOverlayOpen = true;
    },
    onCloseColoniesOverlay(): void {
      this.coloniesOverlayOpen = false;
      this.coloniesOverlayManualOpen = false;
      this.pendingTradeColony = undefined;
    },
    // Single entry point for "player picked a colony in the overlay" — we
    // branch on mode to pick the right submission path. Build mode is a
    // one-shot top-level SelectColony submission; trade mode needs a
    // second step (pay-trade-fee chooser) before we can submit.
    onColonySelected(colonyName: ColonyName): void {
      if (this.coloniesOverlayMode === 'build') {
        this.submitBuildColony(colonyName);
        return;
      }
      if (this.coloniesOverlayMode === 'trade') {
        const ctx = this.tradeColonyContext;
        if (!ctx) return;
        // If there's exactly one payment option, skip the second-step
        // modal — auto-submit with that single option. This matches the
        // "single click trade" UX of the Steam version when only one
        // pay path is available.
        if (ctx.paymentOptions.length === 1) {
          this.submitTradeColony(colonyName, 0);
          return;
        }
        this.pendingTradeColony = {
          colonyName,
          tradeActionPath: ctx.path,
          paymentOptions: ctx.paymentOptions,
        };
      }
    },
    // Build flow — top-level SelectColony submission. The path returned
    // by findBuildColonyContext is wrapped into OR layers; the innermost
    // payload is the actual `{type: 'colony', colonyName}` response.
    submitBuildColony(colonyName: ColonyName): void {
      const ctx = this.buildColonyContext;
      if (!ctx) return;
      let response: unknown = {type: 'colony' as const, colonyName};
      for (let i = ctx.path.length - 1; i >= 0; i--) {
        response = {type: 'or' as const, index: ctx.path[i], response};
      }
      const wfRef = this.$refs.waitingFor as {onsave?: (out: unknown) => void} | undefined;
      wfRef?.onsave?.(response);
      // The buildColonyContext watcher will close the overlay once the
      // server's waitingFor flips to whatever comes next.
      this.coloniesOverlayManualOpen = false;
    },
    onColonyTradePaymentSelected(paymentIdx: number): void {
      if (this.pendingTradeColony === undefined) return;
      this.submitTradeColony(this.pendingTradeColony.colonyName, paymentIdx);
    },
    onColonyTradePaymentCancel(): void {
      this.pendingTradeColony = undefined;
    },
    // Trade flow submission — assembles the nested AndOptions response
    // exactly as the legacy radio UI would and POSTs it. Shape:
    //
    //   wrap(tradePath, {
    //     type: 'and',
    //     responses: [
    //       {type: 'or', index: paymentIdx, response: {type: 'option'}},
    //       {type: 'colony', colonyName},
    //     ],
    //   })
    //
    // where wrap() applies one OR layer per index in tradePath, innermost
    // first (matching every other findXPath → submit pattern in this file).
    submitTradeColony(colonyName: ColonyName, paymentIdx: number): void {
      const ctx = this.tradeColonyContext;
      if (!ctx) return;
      const andResponse = {
        type: 'and' as const,
        responses: [
          {type: 'or' as const, index: paymentIdx, response: {type: 'option' as const}},
          {type: 'colony' as const, colonyName},
        ],
      };
      let response: unknown = andResponse;
      for (let i = ctx.path.length - 1; i >= 0; i--) {
        response = {type: 'or' as const, index: ctx.path[i], response};
      }
      const wfRef = this.$refs.waitingFor as {onsave?: (out: unknown) => void} | undefined;
      wfRef?.onsave?.(response);
      this.pendingTradeColony = undefined;
      this.coloniesOverlayOpen = false;
      this.coloniesOverlayManualOpen = false;
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
