<template>
  <div id="player-home" :class="[(game.turmoil ? 'with-turmoil': ''), playerTintClass, {'viewing-other': isViewingOther, 'journal-open': journalOpen, 'overlay-active': activeOverlay !== null}]">
    <div class="top-bar-buttons">
      <!-- Standalone top buttons — NO rail plate. Unlike the bottom rails
           (which extend the left panel / right sidebar), there's no bar up
           here for a rail to flow out of, so the buttons stand on their own
           as premium nameplates. Each keeps its anchor wrapper so its
           dropdown overlay can position absolutely under it. -->
      <div class="top-bar-btn-anchor">
        <div class="bottom-bar-btn bottom-bar-btn--counter"
             :class="{'bottom-bar-btn--active': activeOverlay === 'milestones', 'bottom-bar-btn--available-sweep': claimableMilestonesCount > 0}"
             v-on:click="toggleOverlay('milestones')">
          <span v-if="claimableMilestonesCount > 0" class="bar-btn__available-shimmer" aria-hidden="true"></span>
          <BarButtonIcon name="milestones" /><span class="bar-btn__label" v-i18n>Milestones</span>
          <span class="bar-btn__value">
            <span class="bar-btn__value-avail" :class="{'bar-btn__value-avail--zero': claimableMilestonesCount === 0}">{{ claimableMilestonesCount }}</span>
            <AnimatedMetricValue class="bar-btn__feedback" :value="claimableMilestonesCount" metricKey="bar.milestones.claimable" :scopeKey="thisPlayer.color" variant="misc" />
          </span>
        </div>
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
        <div class="bottom-bar-btn bottom-bar-btn--dominant" :class="{'bottom-bar-btn--active': activeOverlay === 'standardProjects'}" v-on:click="toggleOverlay('standardProjects')"><BarButtonIcon name="standard-projects" /><span class="bar-btn__label" v-i18n>Standard Projects</span></div>
        <StandardProjectsOverlay
          v-if="activeOverlay === 'standardProjects'"
          class="top-bar-dropdown top-bar-dropdown--standard-projects"
          :game="game"
          :thisPlayer="thisPlayer"
          :actionableProjects="standardProjectsActionInput"
          :viewerActing="playerView.waitingFor !== undefined"
          :sellPatentsAvailable="sellPatentsActionAvailable"
          @close="onStdProjectOverlayClose"
          @use-project="onUseStandardProject($event)"
          @sell-patents="onEnterSellPatents" />
      </div>
      <div class="top-bar-btn-anchor">
        <div class="bottom-bar-btn" :class="{'bottom-bar-btn--active': activeOverlay === 'awards'}" v-on:click="toggleOverlay('awards')"><BarButtonIcon name="awards" /><span class="bar-btn__label" v-i18n>Awards</span></div>
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
          :freeFunding="freeFundingActive"
          @fund="fundAward($event)"
          @close="onAwardsOverlayClose" />
      </div>
    </div>

    <div class="bottom-bar-buttons">
      <!--
        BOTTOM-LEFT RAIL — the player-scoped cluster. These buttons all show
        the currently-DISPLAYED player's data, so this rail (together with the
        left resources/tags panel) takes the viewed player's colour + the
        "Viewing: <name>" chip when spectating another seat. Reserved slot for
        a future "Card resources" button.
      -->
      <!--
        "Viewing: <name>" banner. Pulled OUT of the rail's flex flow (it was
        shifting the buttons) and pinned to the bottom-left CORNER, sitting
        just above the rail and bridging the left panel + rail so the whole
        player-scoped zone reads as one. position:fixed + out-of-flow ⇒ zero
        layout impact on the rail buttons.
      -->
      <div v-if="isViewingOther"
           class="bar-rail__viewing"
           v-on:click="selectedPlayerColor = undefined"
           :title="$t('Return to your view')">
        <span class="bar-rail__viewing-dot"></span>
        <span class="bar-rail__viewing-text"><span v-i18n>Viewing</span>: {{ displayedPlayer.name }}</span>
      </div>
      <div class="bar-rail bar-rail--bottom-left">
        <div class="bottom-bar-btn bottom-bar-btn--counter" :class="{'bottom-bar-btn--active': activeOverlay === 'cards'}" v-on:click="toggleOverlay('cards')">
          <BarButtonIcon name="cards" /><span class="bar-btn__label" v-i18n>Cards</span>
          <span class="bar-btn__value">{{ displayedCardsInHandCount }}<AnimatedMetricValue class="bar-btn__feedback" :value="displayedCardsInHandCount" metricKey="bar.cards" :scopeKey="displayedPlayer.color" variant="misc" /></span>
        </div>
        <!--
          ДЕЙСТВИЯ — dual count: AVAILABLE (can activate right now, server's
          availableBlueCardActionCount) "/" ALL (every activatable action source
          the player has, client-derived). The delta chip animates only the ALL
          total (a freshly-played active card / a corp gaining an action) — the
          available number fluctuates every turn (used → resets next gen) so a
          chip on it would be noisy. Ordered right next to ЭФФЕКТЫ: the two are a
          pair — passive (Effects) + activatable (Actions) abilities.
        -->
        <div class="bottom-bar-btn bottom-bar-btn--counter" :class="{'bottom-bar-btn--active': activeOverlay === 'actions'}" v-on:click="toggleOverlay('actions')">
          <BarButtonIcon name="actions" /><span class="bar-btn__label" v-i18n>Actions</span>
          <span class="bar-btn__value bar-btn__value--dual">
            <span class="bar-btn__value-avail" :class="{'bar-btn__value-avail--zero': availableActionsCount === 0}">{{ availableActionsCount }}</span>
            <span class="bar-btn__value-sep" aria-hidden="true">/</span>
            <span class="bar-btn__value-total">{{ displayedActionsTotalCount }}</span>
            <AnimatedMetricValue class="bar-btn__feedback" :value="displayedActionsTotalCount" metricKey="bar.actions" :scopeKey="displayedPlayer.color" variant="misc" />
          </span>
        </div>
        <div class="bottom-bar-btn bottom-bar-btn--counter" :class="{'bottom-bar-btn--active': activeOverlay === 'effects'}" v-on:click="toggleOverlay('effects')">
          <BarButtonIcon name="effects" /><span class="bar-btn__label" v-i18n>Effects</span>
          <span class="bar-btn__value">{{ displayedEffectsCount }}<AnimatedMetricValue class="bar-btn__feedback" :value="displayedEffectsCount" metricKey="bar.effects" :scopeKey="displayedPlayer.color" variant="misc" /></span>
        </div>
        <div class="bottom-bar-btn bottom-bar-btn--counter" :class="{'bottom-bar-btn--active': activeOverlay === 'played'}" v-on:click="toggleOverlay('played')">
          <BarButtonIcon name="played" /><span class="bar-btn__label" v-i18n>Played</span>
          <span class="bar-btn__value">{{ displayedPlayedCardsCount }}<AnimatedMetricValue class="bar-btn__feedback" :value="displayedPlayedCardsCount" metricKey="bar.played" :scopeKey="displayedPlayer.color" variant="misc" /></span>
        </div>
        <div class="bottom-bar-btn bottom-bar-btn--counter" :class="{'bottom-bar-btn--active': activeOverlay === 'victoryPoints'}" v-on:click="toggleOverlay('victoryPoints')">
          <BarButtonIcon name="victory-points" /><span class="bar-btn__label" v-i18n>Victory Points</span>
          <span class="bar-btn__value">{{ displayedVictoryPoints }}<AnimatedMetricValue v-if="typeof displayedVictoryPoints === 'number'" class="bar-btn__feedback" :value="displayedVictoryPoints" metricKey="bar.vp" :scopeKey="displayedPlayer.color" variant="score" /></span>
        </div>
      </div>
      <!--
        BOTTOM-RIGHT RAIL — global controls (Colonies / Log). Never tinted by
        the viewed player. Reserved slot for a future Turmoil button.
      -->
      <div class="bar-rail bar-rail--bottom-right">
        <div v-if="game.colonies.length > 0"
             class="bottom-bar-btn bottom-bar-btn--colonies"
             :class="{'bottom-bar-btn--active': coloniesOverlayOpen, 'bottom-bar-btn--hydro-ready': colonyTradeAvailable}"
             v-on:click="onOpenColoniesOverlay">
          <BarButtonIcon name="colonies" /><span class="bar-btn__label" v-i18n>Colonies</span>
          <span v-if="colonyTradeAvailable" class="bottom-bar-btn__hydro-dot" aria-hidden="true"></span>
        </div>
        <div v-if="game.gameOptions.expansions.deltaProject"
             class="bottom-bar-btn bottom-bar-btn--hydronetwork"
             :class="{'bottom-bar-btn--active': activeOverlay === 'hydronetwork', 'bottom-bar-btn--hydro-ready': hydroActionAvailable}"
             v-on:click="toggleOverlay('hydronetwork')">
          <BarButtonIcon name="hydronetwork" /><span class="bar-btn__label" v-i18n>Hydronetwork</span>
          <span v-if="hydroActionAvailable" class="bottom-bar-btn__hydro-dot" aria-hidden="true"></span>
        </div>
        <div class="bottom-bar-btn" :class="{'bottom-bar-btn--active': journalOpen}" v-on:click="toggleJournal()">
          <BarButtonIcon name="log" /><span class="bar-btn__label" v-i18n>Log</span>
        </div>
      </div>
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
      Initial draft status rail — компактная замена LeftPlayerPanel на
      стартовом экране. Монтируется только пока `initialDraftActive`,
      основная LeftPlayerPanel скрыта параллельным CSS-правилом в
      initial_draft.less (`.left-panel { display: none }`). Сам rail
      имеет z-index выше backdrop'a модала, чтобы информация по игрокам
      оставалась читаемой при открытом step-модале.
    -->
    <InitialDraftStatusRail v-if="initialDraftActive"
                            :playerView="playerView"
                            :livePlayersWaitingFor="livePlayersWaitingFor" />

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
      Client-side payment-preview modal for playing a hand card. Mounted
      when the player presses РАЗЫГРАТЬ in the hand overlay. Hosts the
      existing project-card payment widget (constrained to the chosen card)
      so all tag-based payment rules / Reds tax work unchanged. Confirm
      wraps the response in the action-menu OR path and submits through
      WaitingFor.onsave; Cancel restores the hand overlay (no round-trip).
    -->
    <MandatoryInputModal v-if="pendingPlayCard !== undefined"
                         :title="pendingPlayCard.title"
                         :suppressed="playedPickActive || actionCardPickActive || actionsPickActive">
      <HandCardPaymentContent
        :playerView="playerView"
        :input="pendingPlayCard.input"
        :cardName="pendingPlayCard.cardName"
        @confirm="onPlayCardConfirm($event)"
        @cancel="onPlayCardCancel"
        @pick-card="onActionPickCard"
        @pick-played-card="onPlayedCardActionPick"
        @pick-action="onActionsPick"
        @repeat-action="onRepeatActionFromPlay($event)" />
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
        :availableActions="availableCardActionNames.length"
        :canTradeWithColony="tradeColonyContext !== undefined"
        :canConvertPlants="convertPlantsAvailable"
        :canConvertHeat="convertHeatAvailable"
        :canAdvanceDelta="thisPlayer.canAdvanceDelta === true"
        @confirm="onPassConfirm"
        @cancel="onPassCancel" />
    </MandatoryInputModal>

    <!--
      Convert Heat remains one-click in the normal case. When the server marks
      the option with `maxtemp`, the action is only a legal stall action and
      will spend heat without changing the parameter, so we gate it with the
      same client-side confirmation style as Pass.
    -->
    <MandatoryInputModal v-if="convertHeatConfirmOpen"
                         :title="$t('Convert heat')"
                         :minimizable="false">
      <ConvertHeatConfirmContent
        @confirm="onConvertHeatConfirm"
        @cancel="onConvertHeatCancel" />
    </MandatoryInputModal>

    <!--
      Premium journal side-panel. Replaces the legacy `bar-overlay--log`
      that hosted the old `LogPanel`. NOT a board-covering overlay: it's
      a glass/HUD panel pinned to the right gutter that slides the board
      left (via `#player-home.journal-open`, see journal.less) and streams
      the same `/api/game/logs` data as a modern live feed.

      The panel itself is MOUNTED AT APP LEVEL (App.vue, next to
      DraftFlowOverlay) — NOT here — so the `:key="playerkey"` remount
      that fires on every server response can't destroy it (which would
      close the journal + reset its generation/scroll on every board
      update). PlayerHome only owns the open flag (module-level
      `journalState`, also remount-proof) and the board-slide class.
    -->

    <!--
      Victory-points "score report" overlay (premium rework). Self-contained
      glass frame + integrated close button (mirrors PlayedCardsOverlay /
      JournalPanel), so it's mounted directly with @close rather than wrapped
      in the legacy `.bar-overlay` chrome. Shows the CURRENTLY-VIEWED player's
      breakdown (`displayedPlayer`); scoring + data are unchanged.
    -->
    <VictoryPointsOverlay
      v-if="activeOverlay === 'victoryPoints'"
      :displayedPlayer="displayedPlayer"
      :game="game"
      :thisPlayerColor="thisPlayer.color"
      @close="activeOverlay = null" />

    <!--
      Played-cards board (premium rework). Replaces the legacy
      `bar-overlay--played` flat list with a grouped, adaptive project
      board (PlayedCardsOverlay). Shows the CURRENTLY-VIEWED player's
      tableau (`displayedPlayer`), so switching the viewed seat re-points
      the board at that player. Driven by the same `activeOverlay`
      bar-overlay machinery (toggle / outside-click close / journal yield).
    -->
    <PlayedCardsOverlay
      v-if="activeOverlay === 'played'"
      :displayedPlayer="displayedPlayer"
      :viewerColor="thisPlayer.color"
      @close="activeOverlay = null" />

    <!--
      Effects overlay — the displayed player's ongoing/passive rules (blue cards
      + corporations). Open info: switch the viewed seat the generic way (click a
      player's panel top-left → displayedPlayer re-points), like РАЗЫГРАНО.
    -->
    <EffectsOverlay
      v-if="activeOverlay === 'effects'"
      :displayedPlayer="displayedPlayer"
      :viewerColor="thisPlayer.color"
      :viewerId="playerView.id"
      :statsCacheKey="String(game.generation)"
      @close="activeOverlay = null" />

    <!--
      Cards-in-hand overlay (viewer). Own seat: real hand face-up via the
      same sortable-cards used in the legacy hand block. Another player's
      seat: face-down card backs × their hand count (the server never sends
      opponent hand contents) — mirrors the physical board game.
    -->
    <!--
      Premium "cards in hand" overlay (own seat). Shows the full hand with
      per-card playability + reasons, filters / sort, and a РАЗЫГРАТЬ
      button that starts the play flow. Only mounted for the viewer's own
      seat — the server never sends opponents' hand contents.
    -->
    <HandCardsOverlay
      v-if="activeOverlay === 'cards' && displayedPlayer.color === thisPlayer.color"
      :player="thisPlayer"
      :cards="handOverlayCards"
      :playableCardNames="playableProjectCardNames"
      :playActionAvailable="playProjectCardActionAvailable"
      :awaitingInput="playerView.waitingFor !== undefined"
      :sellPatentsAvailable="sellPatentsActionAvailable"
      @play="onPlayHandCard($event)"
      @sell="onSellPatents($event)"
      @hand-select="onHandSelect($event)"
      @close="onHandOverlayClose" />

    <!--
      Another player's seat: the server never sends opponents' hand
      contents, so we can only show the COUNT. OpponentHandOverlay presents
      it as a fanned hand of face-down cards + a prominent count badge in
      the SAME premium frame/header as the own-seat HandCardsOverlay, so it
      reads as "the same overlay, just someone else's hidden cards".
    -->
    <OpponentHandOverlay
      v-else-if="activeOverlay === 'cards'"
      :player="displayedPlayer"
      :count="displayedCardsInHandCount"
      @close="activeOverlay = null" />

    <!--
      Minimized mandatory hand-select pill. Shown when the player collapsed the
      КАРТЫ В РУКЕ overlay (mandatory-select mode) to inspect the board — the
      server prompt is still pending. Clicking re-opens the overlay in select
      mode. Teleported to body so it floats above the board chrome.
    -->
    <Teleport to="body">
      <div v-if="handPillVisible"
           class="hand-select-pill mandatory-input-modal-pill mandatory-input-modal-pill--visible"
           role="button"
           tabindex="0"
           @click="restoreHandPill"
           @keydown.enter="restoreHandPill"
           @keydown.space="restoreHandPill">
        <span class="mandatory-input-modal-pill__dot" aria-hidden="true"></span>
        <span class="mandatory-input-modal-pill__label">{{ handPillLabel }}</span>
        <span class="mandatory-input-modal-pill__sep" aria-hidden="true">/</span>
        <span class="mandatory-input-modal-pill__title">{{ handPillTitle }}</span>
        <span class="mandatory-input-modal-pill__restore" aria-hidden="true">⤢</span>
      </div>
    </Teleport>

    <!--
      Premium "Действия" overlay — the displayed player's activatable actions
      (blue cards + corporations) as a grid of action buttons with availability
      + activation filters. Replaces the legacy `bar-overlay--actions` Card list.
      `availableActionNames` is the authoritative "can act now" set (own seat,
      from the action SelectCard in waitingFor). Activating emits a card name; we
      open the confirmation modal before any server round-trip.
    -->
    <ActionsOverlay
      v-if="activeOverlay === 'actions' || actionsPickActive"
      :displayedPlayer="displayedPlayer"
      :viewerColor="thisPlayer.color"
      :viewerId="playerView.id"
      :availableActionNames="availableCardActionNames"
      :preview-cache-key="actionsPreviewCacheKey"
      :statsCacheKey="String(game.generation)"
      :awaitingInput="playerView.waitingFor !== undefined"
      :pickMode="actionsPickActive"
      @activate="onActivateCardAction($event)"
      @close="closeActionsOverlay" />

    <!--
      Premium "Гидросеть Марса" overlay — the Delta Project track as a global
      engineering subsystem. Horizontal track + embedded action-zone. The advance
      action rides the standard action menu (detected via findHydroActionPath);
      Confirm batch-submits [activate, amount, reward?] through WaitingFor.
    -->
    <HydroNetworkOverlay
      v-if="activeOverlay === 'hydronetwork'"
      :playerView="playerView"
      :viewerId="playerView.id"
      :actionAvailable="hydroActionAvailable"
      :cacheKey="String(game.generation)"
      @pick-action="onHydroPickAction"
      @pick-played-card="onHydroPickPlayedCard"
      @confirm="submitHydroAdvance($event)"
      @close="activeOverlay = null" />

    <!--
      Client-side confirmation gate before an action is performed. Hosts the
      source card + action summary; Confirm submits the nested action SelectCard
      response through WaitingFor.onsave, Cancel restores the overlay (no
      round-trip). Mirrors the Std-project / hand-card payment-preview flow.
    -->
    <MandatoryInputModal v-if="pendingCardAction !== undefined"
                         :title="$t('Activate action')"
                         :minimizable="false"
                         :suppressed="actionCardPickActive || playedPickActive || actionsPickActive">
      <CardActionConfirmContent
        :key="pendingCardAction.cardName"
        :cardName="pendingCardAction.cardName"
        :card="pendingCardAction.card"
        :nodeIndex="pendingCardAction.nodeIndex"
        :playerView="playerView"
        @confirm="onCardActionConfirm"
        @cancel="onCardActionCancel"
        @pick-card="onActionPickCard"
        @pick-played-card="onPlayedCardActionPick"
        @pick-action="onActionsPick"
        @repeat-action="onRepeatActionFromAction($event)" />
    </MandatoryInputModal>

    <!--
      Game-over board indicator. The premium EndgameExperience (App-level) shows
      the reveal + full results automatically, and exposes its OWN reopen pill
      (.eg-pill, bottom-center) when the results are minimized. So this is a pure
      premium STATUS chip — "Игра окончена!" at the top — with NO reopen button
      (the pill already owns that) and NO link to the legacy /the-end report.
      It's a slim fixed chip (pointer-events:none) so it barely covers the board,
      and it sits behind the reveal/results overlays (lower z) — only visible
      once the results are minimized.
    -->
    <div v-if="game.phase === 'end'" class="game-over-banner">
      <span class="game-over-banner__pulse" aria-hidden="true"></span>
      <span class="game-over-banner__label" v-i18n>This game is over!</span>
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
      :epoch="playerView.runId"
      @toggle-legacy-ui="activeOverlay = (activeOverlay === 'legacyUi' ? null : 'legacyUi')">
    </sidebar>

    <!--
      Карта Марса монтируется БЕЗУСЛОВНО, даже когда tableau ещё пустой
      (стартовый экран / initial draft). По UX-контракту фо́рка игрок
      должен иметь возможность свернуть любой модал выбора и осмотреть
      планету, на которой будет играть, — без отличия от обычной партии.
      Legacy-UI обёртка ниже остаётся условной (`tableau > 0`), т.к. её
      содержимое (Actions / hand / drafted-cards) имеет смысл только
      после старта партии.
    -->
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

      v40-r2: убран внешний `v-if="thisPlayer.tableau.length > 0"`.
      WaitingFor живёт внутри overlay'а и отвечает за общий polling
      (`/api/waitingfor`), который заполняет root.playersWaitingFor —
      от него зависят action-label кубики игроков и анимация spinning
      cube. Раньше overlay монтировался только после старта партии
      (`tableau > 0`), и на стартовом экране (initial draft) polling
      не работал: status-полоска была пустой, cube не крутился.
      Теперь overlay (и WaitingFor внутри) всегда mounted; внутренние
      блоки имеют свои индивидуальные v-if на условиях содержания.
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
                                  .concat(stagedCardsInHand)"/>
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

    <!--
      Initial draft screen overlay. Live-renders сценарий выбора стартовых
      корпораций / прологов / CEO / проектов через серию modern modal'ов.
      Внутри сам решает, когда активен — по `playerView.waitingFor.type ===
      'initialCards'`. Когда активен, ставит body.initial-draft-active,
      что прячет нерелевантный HUD (см. initial_draft.less).
      Заменил legacy `PlayerSetupView` — старый компонент остался в репо
      как историческая reference, но больше нигде не монтируется.
    -->
    <InitialDraftFlowOverlay :playerView="playerView" />

    <!--
      Legacy in-page colonies block deleted. The same info is presented
      via the new sci-fi `ColoniesOverlay` (opened from the bottom-bar
      "Trade with colonies" button OR auto-mounted when the server is
      waiting on a SelectColony prompt — e.g. after the Build Colony
      Standard Project resolves).
    -->

    <ColoniesOverlay v-if="coloniesOverlayOpen"
                     :colonies="coloniesOverlayColonies"
                     :players="playerView.players"
                     :mode="coloniesOverlayMode"
                     :buildButtonLabel="buildColonyContext?.buttonLabel ?? ''"
                     :selectableNames="coloniesOverlaySelectable"
                     :disabledReasons="coloniesOverlayDisabledReasons"
                     :dismissable="coloniesOverlayDismissable"
                     :viewerColor="thisPlayer.color"
                     :forceDisabledReason="initialDraftActive ? 'Not available during draft' : ''"
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
                         :minimizable="false">
      <ColonyTradePaymentModal :colony="pendingTradeColonyModel"
                               :colonyName="pendingTradeColony.colonyName"
                               :options="pendingTradeColony.paymentOptions"
                               :disabledOptions="pendingTradeColony.disabledPayments"
                               :players="playerView.players"
                               :tradeOffset="playerView.thisPlayer.colonyTradeOffset"
                               @select="onColonyTradePaymentSelected($event)"
                               @cancel="onColonyTradePaymentCancel" />
    </MandatoryInputModal>

    <!--
      Spectator link and game-purge warning intentionally removed: this fork
      is a private/self-hosted 2-player setup, so the spectator endpoint is
      never used and purge-after-N-hours doesn't apply.
    -->
    <Teleport to="body">
      <div v-if="actionLockTooltipText !== ''"
           class="action-lock-floating-tooltip"
           :style="actionLockTooltipStyle"
           role="tooltip">
        {{ actionLockTooltipText }}
      </div>
    </Teleport>
    <KeyboardShortcuts v-show="keyboardShortcutOpened" @close="keyboardShortcutOpened = false"></KeyboardShortcuts>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

import Card from '@/client/components/card/Card.vue';
import LeftPlayerPanel from '@/client/components/overview/LeftPlayerPanel.vue';
import InitialDraftStatusRail from '@/client/components/initialDraft/InitialDraftStatusRail.vue';
import WaitingFor from '@/client/components/WaitingFor.vue';
import Sidebar from '@/client/components/Sidebar.vue';
import Colony from '@/client/components/colonies/Colony.vue';
import {journalState} from '@/client/components/journal/journalState';
import {untakenNameMultiset} from '@/client/components/drawnCards/drawnCardsState';
import GameBoardView from '@/client/components/GameBoardView.vue';
import {useBoardAutoScale} from '@/client/utils/useBoardAutoScale';
import InitialDraftFlowOverlay from '@/client/components/initialDraft/InitialDraftFlowOverlay.vue';
import {initialDraftSharedState} from '@/client/components/initialDraft/initialDraftSharedState';
import DynamicTitle from '@/client/components/common/DynamicTitle.vue';
import SortableCards from '@/client/components/SortableCards.vue';
import StackedCards from '@/client/components/StackedCards.vue';
import UndergroundTokens from '@/client/components/underworld/UndergroundTokens.vue';
import KeyboardShortcuts from '@/client/components/KeyboardShortcuts.vue';
import VictoryPointsOverlay from '@/client/components/overview/VictoryPointsOverlay.vue';
import MilestonesOverlay from '@/client/components/overview/MilestonesOverlay.vue';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import MilestoneClaimedBadge from '@/client/components/overview/MilestoneClaimedBadge.vue';
import AwardsOverlay from '@/client/components/overview/AwardsOverlay.vue';
import AwardFundedBadge from '@/client/components/overview/AwardFundedBadge.vue';
import SelectSpace from '@/client/components/SelectSpace.vue';
import StandardProjectsOverlay from '@/client/components/overview/StandardProjectsOverlay.vue';
import PlayedCardsOverlay from '@/client/components/playedCards/PlayedCardsOverlay.vue';
import EffectsOverlay from '@/client/components/effects/EffectsOverlay.vue';
import ActionsOverlay from '@/client/components/actions/ActionsOverlay.vue';
import {actionsOverlayState} from '@/client/components/actions/actionsOverlayState';
import HydroNetworkOverlay from '@/client/components/hydronetwork/HydroNetworkOverlay.vue';
import {hydroNetworkState, resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import {playerViewState} from '@/client/components/playerViewState';
import {actionsPickState, enterActionsPick, cancelActionsPick} from '@/client/components/actions/actionsPickState';
import {deliverActionRepeatPick} from '@/client/components/actions/actionRepeatPick';
import CardActionConfirmContent from '@/client/components/actions/CardActionConfirmContent.vue';
import {beginReveal} from '@/client/components/actions/revealResultState';
import {ActionRevealDescriptor} from '@/common/models/ActionPreviewModel';
import {playerEffectCount} from '@/client/components/effects/effectExtraction';
import {playerActionSourceCount} from '@/client/components/actions/actionExtraction';
import {totalPlayedCards} from '@/client/components/playedCards/playedCardGroups';
import HandCardsOverlay from '@/client/components/handCards/HandCardsOverlay.vue';
import {enterSellPatents, exitSellPatents} from '@/client/components/handCards/sellPatentsState';
import {
  handSelectState,
  handCardSelectionPrompt,
  handSelectSignature,
  enterHandSelect,
  exitHandSelect,
  enterClientHandSelect,
  resolveClientHandSelect,
  cancelClientHandSelect,
  isClientHandPickActive,
} from '@/client/components/handCards/handSelectState';
import {deliverActionPick, deliverActionPickMulti} from '@/client/components/handCards/handActionPick';
import {playedCardsPickState, enterPlayedCardsPick, cancelPlayedCardsPick} from '@/client/components/playedCards/playedCardsPickState';
import {deliverPlayedCardActionPick} from '@/client/components/playedCards/playedCardActionPick';
import {
  handPlayState,
  handPlayPrompt,
  handPlaySignature,
  enterHandPlay,
  exitHandPlay,
} from '@/client/components/handCards/handPlayState';
import {
  standardProjectPlayState,
  standardProjectPlayPrompt,
  standardProjectPlaySignature,
  enterStandardProjectPlay,
  exitStandardProjectPlay,
} from '@/client/components/handCards/standardProjectPlayState';
import {
  awardFundingState,
  freeAwardFundingPrompt,
  awardFundingSignature,
  enterAwardFunding,
  exitAwardFunding,
} from '@/client/components/awards/awardFundingState';
import OpponentHandOverlay from '@/client/components/handCards/OpponentHandOverlay.vue';
import HandCardPaymentContent, {PlayCardPayload} from '@/client/components/handCards/HandCardPaymentContent.vue';
import MandatoryInputModal from '@/client/components/MandatoryInputModal.vue';
import PlacementBanner from '@/client/components/PlacementBanner.vue';
import {placementLockState} from '@/client/components/placementLockState';
import {
  startGameFlowActive,
  startGameFlowAllDone,
  startFlowHasFocusedSubAction,
} from '@/client/components/startGameFlow/startGameFlowState';
import StandardProjectPaymentContent from '@/client/components/payment/StandardProjectPaymentContent.vue';
import PassConfirmContent from '@/client/components/overview/PassConfirmContent.vue';
import ConvertHeatConfirmContent from '@/client/components/overview/ConvertHeatConfirmContent.vue';
import ColoniesOverlay from '@/client/components/colonies/ColoniesOverlay.vue';
import ColonyTradePaymentModal from '@/client/components/colonies/ColonyTradePaymentModal.vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardResource} from '@/common/CardResource';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {translateText, translateTextWithParams, translateMessage} from '@/client/directives/i18n';
import {Payment} from '@/common/inputs/Payment';
import {CardName} from '@/common/cards/CardName';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';
import {AwardName} from '@/common/ma/AwardName';
import {MAX_MILESTONES, MAX_AWARDS} from '@/common/constants';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {PlayerInputModel, OrOptionsModel, AndOptionsModel, SelectOptionModel, DisabledOptionModel, SelectPaymentModel, SelectColonyModel, SelectProjectCardToPlayModel, SelectSpaceModel, SelectCardModel} from '@/common/models/PlayerInputModel';
import {ColonyModel} from '@/common/models/ColonyModel';
import {Message} from '@/common/logs/Message';
import {vueRoot} from '@/client/components/vueRoot';
import {
  buildStandardProjectPaymentModel,
  hasUsableStandardProjectAlternativeResources,
  standardProjectPaymentTitle,
} from '@/client/components/payment/paymentModelUtils';

// PlayerInput titles are `string | Message`. Returns the plain English text
// regardless of shape — used for string-matching prompt titles like
// "Claim a milestone".
function inputTitleText(title: string | Message | undefined): string | undefined {
  if (title === undefined) {
    return undefined;
  }
  if (typeof title === 'string') {
    return title;
  }
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
type OverlayId = 'milestones' | 'standardProjects' | 'awards' | 'colonies' | 'cards' | 'actions' | 'played' | 'effects' | 'victoryPoints' | 'hydronetwork' | 'legacyUi';

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

// Set while the player has chosen a card to play from the hand overlay.
// Drives the client-side payment-preview modal that hosts the existing
// project-card payment widget (constrained to the single chosen card).
// On Confirm we wrap the emitted `SelectProjectCardToPlayResponse` in the
// action-menu OR path and submit; Cancel just clears this field (no server
// round-trip) and restores the hand overlay.
type PendingPlayCard = {
  cardName: CardName;
  title: string | Message;
  input: SelectProjectCardToPlayModel;
};

// Pending "activate a blue-card / corporation action" confirmation. Set when the
// player presses ВЫПОЛНИТЬ in the Actions overlay; the confirm modal hosts the
// source card + action summary. Confirm submits the nested action SelectCard
// response; Cancel restores the overlay (no server round-trip).
type PendingCardAction = {
  cardName: CardName;
  card: CardModel | undefined;
  // The selected RENDER NODE ordinal (the row the player focused). The modal
  // resolves the matching preview branch from this + its own preview (so a
  // multi-action card never opens on the wrong branch).
  nodeIndex: number;
  // PREFIX-THREADING for "repeat an action" (ProjectInspection / Viron): when set,
  // this confirm is for the action X being REPEATED, opened after the player chose
  // X in the outer play/activate modal. The prefix is the outer response array
  // ([play/activate, {card:[X]}]) — on confirm the batch is [...prefix, ...X's
  // responses] (NOT the action-menu-rooted batch). Undefined for a normal activate.
  repeatPrefix?: ReadonlyArray<unknown>;
};

// The OUTER modal a "repeat an action" handoff came from — saved so cancelling X's
// confirm restores it (no round-trip). Play → re-open the ProjectInspection play
// modal at its picker; action → re-open Viron's confirm.
type RepeatOuter =
  | {kind: 'play', play: PendingPlayCard}
  | {kind: 'action', action: PendingCardAction};

// Pending Trade-with-Colony state. Set after the player picks a colony in
// the overlay (trade mode), cleared on Cancel or after submission. Carries
// the inputs the second-step payment modal needs to render the chooser AND
// the index path required to wrap the final AndOptions response back into
// the outer action OR.
type PendingTradeColony = {
  colonyName: ColonyName;
  tradeActionPath: ReadonlyArray<number>;
  paymentOptions: ReadonlyArray<SelectOptionModel>;
  disabledPayments: ReadonlyArray<DisabledOptionModel>;
};

type PlayerHomeModel = ToggleableState & {
  activeOverlay: OverlayId | null;
  // True while the Convert-Plants flow is in "click a greenery space"
  // mode. Renders SelectSpace.vue with the inner SelectSpace prompt so
  // it can drive board interaction; on space pick we wrap the response in
  // the outer OR-payload and submit.
  convertPlantsPickerActive: boolean;
  pendingStdProjectPayment: PendingStdProjectPayment | undefined;
  // See PendingPlayCard — the in-flight "play a hand card" payment modal.
  pendingPlayCard: PendingPlayCard | undefined;
  // See PendingCardAction — the in-flight "activate an action" confirmation.
  pendingCardAction: PendingCardAction | undefined;
  // The outer modal a "repeat an action" handoff came from (ProjectInspection /
  // Viron) — saved so cancelling the repeated action's confirm restores it.
  repeatOuter: RepeatOuter | undefined;
  // True while the Pass confirmation modal is open. The pass action is
  // irreversible (no more turns this generation), so we gate it through
  // a client-side confirmation modal before POSTing to the server.
  passConfirmOpen: boolean;
  // True while Convert Heat is waiting for confirmation because temperature
  // is already maxed. Normal heat conversion still submits immediately.
  convertHeatConfirmOpen: boolean;
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
  actionLockMouseOutHandler: ((e: MouseEvent) => void) | null;
  actionLockTooltipText: string;
  actionLockTooltipStyle: Record<string, string>;
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
  // v46: convert-plants / convert-heat moved from a dedicated button
  // to a click handler on the resource row itself (the icon IS the
  // button). The new wrapper-level modifier classes get locked here
  // so clicks during placement are blocked.
  '.resource_item_wrapper--convert-heat',
  '.resource_item_wrapper--convert-plants',
  '.colony-tile__select-btn',
  '.colony-detail__select-btn',
  // v47: dedicated РАЗЫГРАТЬ buttons under hand cards (premium hand overlay).
  '.hand-card-play-btn',
  // v48: the details-panel CTA that opens the activate confirmation (premium
  // Действия overlay master-detail rework).
  '.action-detail__cta',
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
      activeOverlay: null,
      convertPlantsPickerActive: false,
      pendingStdProjectPayment: undefined,
      pendingPlayCard: undefined,
      pendingCardAction: undefined,
      repeatOuter: undefined,
      passConfirmOpen: false,
      convertHeatConfirmOpen: false,
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
      actionLockMouseOutHandler: null as ((e: MouseEvent) => void) | null,
      actionLockTooltipText: '',
      actionLockTooltipStyle: {},
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
      // Keep the ДЕЙСТВИЯ overlay's persisted open-flag in LOCK-STEP with whether
      // it is the live overlay. This is the single source of truth for the flag,
      // so EVERY close path clears it: the ✕, an outside click, switching to
      // another overlay, AND activating an action into the confirm modal (which
      // sets activeOverlay = null). Without this a stale `open = true` made the
      // post-remount mounted() re-arm RE-OPEN the overlay after the player had
      // already left it (picked an action, or closed it some other way). Re-arm is
      // only meant for "the overlay was genuinely still open across a forced
      // remount" — which is exactly `activeOverlay === 'actions'`.
      actionsOverlayState.open = newVal === 'actions';
      // The Гидросеть overlay survives the playerkey remount the same way: keep
      // its persisted open-flag in lock-step so the mounted() re-arm only re-opens
      // it when it was genuinely still open across a forced remount.
      hydroNetworkState.open = newVal === 'hydronetwork';
      // Genuinely closing the Гидросеть overlay (not a polling remount, which
      // re-arms it) resets the plan so it snaps back to the max-legal default
      // next time it opens. EXCEPTION: when `awaitingPick` is set the player is
      // only DELEGATING to a pick-overlay (ДЕЙСТВИЯ / РАЗЫГРАНО) and will return —
      // resetting here would wipe `awaitingPick` (so the restore branch below could
      // never fire) AND the in-progress plan (selectedPosition/selectedCard). The
      // plan is reset only on a TRUE close (awaitingPick undefined).
      if (oldVal === 'hydronetwork' && newVal !== 'hydronetwork' && hydroNetworkState.awaitingPick === undefined) {
        resetHydroPlan();
      }
      // Leaving the КАРТЫ В РУКЕ overlay (close, or switching to another
      // overlay) cancels any in-progress Sell-patents sale mode with NO
      // submit. A polling remount keeps activeOverlay === 'cards', so sale
      // mode (held in module state) survives it — only a real navigation away
      // clears it.
      if (oldVal === 'cards' && newVal !== 'cards') {
        exitSellPatents();
      }
      // SAFETY NET against a stranded client-pick. A client-driven "pick a card
      // from hand" (SRR "link a card", Mars University "discard") lives ONLY while
      // the КАРТЫ В РУКЕ overlay is the active surface — its initiating modal is
      // SUPPRESSED (hidden) behind it. The MOMENT that overlay stops being active
      // for ANY reason (✕, the bottom-bar КАРТЫ toggle, switching to another
      // overlay, the Pass flow, a direct close), the pick MUST be cancelled and the
      // suppressed modal restored — otherwise the modal stays hidden forever (stuck
      // in pick mode). Catching it on the activeOverlay change covers EVERY close
      // path in one place. Idempotent + exempt from the resolve path
      // (`resolveClientHandSelect` clears `clientPick` BEFORE it nulls activeOverlay,
      // so `isClientHandPickActive()` is already false here on a resolve).
      if (newVal !== 'cards' && isClientHandPickActive()) {
        cancelClientHandSelect();
      }
      // SAME safety net for the РАЗЫГРАНО pick (a >3-candidate card-target choice
      // hosted on the played board): leaving the 'played' overlay for ANY reason
      // while the pick is still active cancels it + restores the suppressed modal.
      // The resolve path sets `active=false` BEFORE nulling activeOverlay, so this
      // only fires on an ABANDONED pick.
      if (newVal !== 'played' && playedCardsPickState.active) {
        cancelPlayedCardsPick();
      }
      // SAME safety net for the ДЕЙСТВИЯ "repeat an action" pick: leaving the
      // 'actions' overlay while the pick is still active cancels it + restores the
      // suppressed modal. The resolve path exits the state BEFORE nulling
      // activeOverlay, so this only fires on an ABANDONED pick.
      if (newVal !== 'actions' && actionsPickState.active) {
        cancelActionsPick();
      }
      // A Гидросеть-initiated pick (pos 7 action / pos 9 animal card) just ended.
      // On RESOLVE its callback already cleared `awaitingPick` + reopened the
      // Гидросеть overlay; on an ABANDONED pick the flag is still set and the pick
      // state is now inactive — return the player to the Гидросеть overlay where
      // they left off (its plan state survives in hydroNetworkState).
      if (hydroNetworkState.awaitingPick !== undefined && !actionsPickState.active && !playedCardsPickState.active) {
        hydroNetworkState.awaitingPick = undefined;
        if (newVal !== 'hydronetwork') {
          this.activeOverlay = 'hydronetwork';
        }
      }
    },
    /*
     * Server-driven mandatory "select cards from your hand" prompt. When the
     * top-level waitingFor is a SelectCard whose candidates are all in the
     * player's hand (discard / reveal / keep / copy), drive it through the
     * КАРТЫ В РУКЕ overlay's mandatory-select mode rather than the modal card
     * grid. Enter the mode (reset picks) for a NEW prompt; auto-open the
     * overlay unless the player has minimized it to a pill to inspect the
     * board. When the prompt resolves, drop the mode.
     */
    // A CLIENT-driven hand pick became active (the action-confirm modal's SRR
    // "link a card", or a nested Mars University "discard a card" in a modal
    // OrOptions). Whatever surface initiated it can't open the overlay itself, so
    // open the КАРТЫ В РУКЕ overlay here (own seat) — the initiating modal
    // suppresses itself while it's up.
    actionCardPickActive(active: boolean): void {
      if (active) {
        this.selectedPlayerColor = undefined;
        this.activeOverlay = 'cards';
      }
    },
    handCardSelectionInput: {
      immediate: true,
      handler(input: SelectCardModel | undefined): void {
        if (input === undefined) {
          // A CLIENT-driven pick (Self-Replicating Robots "link a card") has no
          // server prompt backing it — leave it alone; only a SERVER-prompt
          // select mode is cleared when its prompt disappears.
          if (handSelectState.active && !handSelectState.clientPick) {
            exitHandSelect();
          }
          return;
        }
        const sig = handSelectSignature(input);
        if (!handSelectState.active || handSelectState.signature !== sig) {
          // Always select from YOUR OWN hand — snap back if spectating another
          // seat (the overlay only mounts for the own seat).
          this.selectedPlayerColor = undefined;
          enterHandSelect(input);
        }
        if (!handSelectState.minimized) {
          this.activeOverlay = 'cards';
        }
      },
    },
    /*
     * Server-driven mandatory "play a card from your hand" prompt (top-level
     * projectCard — EccentricSponsor / EcologyExperts). Hosted by the КАРТЫ В
     * РУКЕ overlay in its normal PLAY mode (РАЗЫГРАТЬ → payment → submit). Same
     * enter / auto-open / minimize lifecycle as the hand-select prompt.
     */
    handPlayInput: {
      immediate: true,
      handler(input: SelectProjectCardToPlayModel | undefined): void {
        if (input === undefined) {
          if (handPlayState.active) {
            exitHandPlay();
          }
          return;
        }
        const sig = handPlaySignature(input);
        if (!handPlayState.active || handPlayState.signature !== sig) {
          this.selectedPlayerColor = undefined;
          enterHandPlay(input);
        }
        if (!handPlayState.minimized) {
          this.activeOverlay = 'cards';
        }
      },
    },
    /*
     * Server-driven mandatory "play a standard project" prompt (top-level
     * SelectStandardProjectToPlay — EstablishedMethods). Hosted by the Standard
     * Projects overlay (pick a project → existing payment path → submit). Same
     * enter / auto-open / minimize lifecycle as the hand-play prompt.
     */
    standardProjectPlayInput: {
      immediate: true,
      handler(input: SelectProjectCardToPlayModel | undefined): void {
        if (input === undefined) {
          if (standardProjectPlayState.active) {
            exitStandardProjectPlay();
          }
          return;
        }
        const sig = standardProjectPlaySignature(input);
        if (!standardProjectPlayState.active || standardProjectPlayState.signature !== sig) {
          this.selectedPlayerColor = undefined;
          enterStandardProjectPlay(input);
        }
        if (!standardProjectPlayState.minimized) {
          this.activeOverlay = 'standardProjects';
        }
      },
    },
    /*
     * Server-driven FREE award-funding prompt (Vitor's start-of-game action).
     * Hosted by the modern AwardsOverlay in its free-sponsorship mode rather than
     * the generic option modal (WaitingFor suppresses the modal route). Enter the
     * mode (reset on a NEW prompt), auto-open the overlay unless minimized to its
     * pill, and drop the mode when the prompt resolves. The fundable set + submit
     * ride the existing fundableAwards / fundAward machinery.
     */
    awardFundingInput: {
      immediate: true,
      handler(input: OrOptionsModel | undefined): void {
        if (input === undefined) {
          if (awardFundingState.active) {
            exitAwardFunding();
          }
          return;
        }
        const sig = awardFundingSignature(input);
        if (!awardFundingState.active || awardFundingState.signature !== sig) {
          enterAwardFunding(sig);
        }
        if (!awardFundingState.minimized) {
          this.activeOverlay = 'awards';
        }
      },
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
        } else {
          document.body.classList.remove('placement-pending');
        }
        this.syncActionLockGuards();
      },
    },
    startGameFlowActionLocked: {
      immediate: true,
      handler() {
        this.syncStartGameActionLockBody();
        this.syncActionLockGuards();
      },
    },
    actionUiLocked: {
      immediate: true,
      handler() {
        this.syncStartGameActionLockBody();
        this.syncActionLockGuards();
      },
    },
  },
  mounted() {
    this.syncStartGameActionLockBody();
    this.syncActionLockGuards();
    // A client-driven hand pick (SRR / Mars University) is purely client-side and
    // resolves back to its in-memory initiating modal. That modal is component
    // data (gone on a `playerkey` remount), while the pick state is module-level.
    // So if we MOUNTED with a pick still flagged active, a server round-trip
    // happened mid-pick (e.g. the player hit Pass while the overlay was open and
    // the confirm modal suppressed) → the initiating modal is gone and the pick
    // can never resolve. Cancel it so the player isn't left with a stale,
    // unresolvable pick mode (overlay auto-reopening with nowhere to deliver to).
    if (isClientHandPickActive()) {
      cancelClientHandSelect();
    }
    // SAME safety net for the РАЗЫГРАНО board pick: if we MOUNTED with a played
    // pick still flagged active, a server round-trip happened mid-pick → its
    // initiating modal (component data: pendingPlayCard / pendingCardAction) is
    // gone, so the pick can never deliver. Cancel it so the player isn't left with
    // a stale board pick mode (overlay re-opening with nowhere to deliver to).
    if (playedCardsPickState.active) {
      cancelPlayedCardsPick();
    }
    // SAME safety net for the ДЕЙСТВИЯ "repeat an action" pick — its initiating
    // modal is gone after a remount, so a still-active pick can never deliver.
    if (actionsPickState.active) {
      cancelActionsPick();
    }
    // Re-arm the actions overlay across the playerkey remount (its selection +
    // filters + preview cache persisted in module state). Only when it was left
    // open and nothing else (a server-driven / mandatory overlay) claimed the slot.
    // NOT while a repeat-action pick is active (that mount net just cancelled it).
    if (actionsOverlayState.open && this.activeOverlay === null && !actionsPickState.active) {
      this.activeOverlay = 'actions';
    }
    // Re-arm the Гидросеть overlay across the playerkey remount (same pattern).
    if (hydroNetworkState.open && this.activeOverlay === null) {
      this.activeOverlay = 'hydronetwork';
    }
    // The premium notification system's "Go to action" CTA: if a mandatory
    // hand / award / standard-project prompt is minimized to its pill, restore
    // it so the player can act. (A minimized generic modal restores itself via
    // its own listener; this covers the dedicated-overlay pills.)
    window.addEventListener('tm-notification-go-to-action', this.onNotificationGoToAction);
  },
  beforeUnmount() {
    window.removeEventListener('tm-notification-go-to-action', this.onNotificationGoToAction);
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
    document.body.classList.remove('start-game-flow-action-locked');
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
    // Mirrors module-level `journalState.open` (remount-proof). Read-only:
    // toggled via `toggleJournal()` / the App-level panel's close. Drives
    // the bottom-bar Log button active state + the `journal-open`
    // board-slide class on the root.
    journalOpen(): boolean {
      return journalState.open;
    },
    CardType(): typeof CardType {
      return CardType;
    },
    // The viewer's project hand with cards still awaiting a "take" in the draw
    // reveal modal subtracted out (by CardName multiset). Visual staging only:
    // the server already added them to cardsInHand, but they must not appear in
    // the КАРТЫ overlay (or its count) until the player presses ВЗЯТЬ. Reveals
    // always belong to thisPlayer (own seat).
    stagedCardsInHand(): ReadonlyArray<CardModel> {
      const hand = this.playerView.cardsInHand;
      const remove = untakenNameMultiset();
      if (remove.size === 0) {
        return hand;
      }
      const result: Array<CardModel> = [];
      for (const card of hand) {
        const pending = remove.get(card.name) ?? 0;
        if (pending > 0) {
          remove.set(card.name, pending - 1);
          continue;
        }
        result.push(card);
      }
      return result;
    },
    // The card list the КАРТЫ В РУКЕ overlay renders: the real hand PLUS the
    // cards hosted on Self-replicating Robots. Hosted cards are not literally
    // "in hand", but the game lets the player play them from there (the server's
    // getPlayableCards() includes them, with the SRR cost discount), so they
    // MUST be playable from the same overlay — otherwise there's no way to play
    // them in the modern UI. They carry `isSelfReplicatingRobotsCard` so the
    // overlay marks them; their discounted `calculatedCost` + `unplayableReasons`
    // come from the server. Kept OUT of `cardsInHandCount` so the hand-count
    // badge stays the true hand size.
    handOverlayCards(): ReadonlyArray<CardModel> {
      const hosted = this.thisPlayer.selfReplicatingRobotsCards;
      if (hosted.length === 0) {
        return this.stagedCardsInHand;
      }
      return this.stagedCardsInHand.concat(hosted);
    },
    cardsInHandCount(): number {
      const playerView = this.playerView;
      return this.stagedCardsInHand.length + playerView.preludeCardsInHand.length + playerView.ceoCardsInHand.length;
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
    // The seat the HUD is VIEWING. Backed by module-level `playerViewState` (NOT
    // component data) so the choice survives the `playerkey` remount that fires on
    // every server response — otherwise a routine poll (another player's turn)
    // reset it to undefined and snapped the view back to the viewer's own seat
    // while they were inspecting an opponent. A get/set computed keeps every
    // existing `this.selectedPlayerColor = …` read/write working unchanged.
    selectedPlayerColor: {
      get(): Color | undefined {
        return playerViewState.selectedPlayerColor;
      },
      set(value: Color | undefined): void {
        playerViewState.selectedPlayerColor = value;
      },
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
    // True when the HUD is showing ANOTHER player's data (spectating their
    // seat) rather than the viewer's own. Drives the `viewing-other` root
    // class that lights up the player-scoped zone (left panel + bottom-left
    // rail) in that player's colour and reveals the "Viewing: <name>" chip.
    isViewingOther(): boolean {
      return this.displayedPlayer.color !== this.thisPlayer.color;
    },
    playedCardsTitleClass(): string {
      return `dynamic-title ${playerColorClass(this.displayedPlayer.color, 'shadow')}`;
    },
    availableActionsCount(): number {
      return this.displayedPlayer.availableBlueCardActionCount;
    },
    // Total activatable-action SOURCES the displayed player has (every action
    // card / corporation in their tableau, regardless of availability or
    // this-generation usage). Drives the ДЕЙСТВИЯ button's "all" badge + its
    // delta chip. Card-based (one per source) so it lines up with the
    // card-based server availableBlueCardActionCount.
    displayedActionsTotalCount(): number {
      return playerActionSourceCount(this.displayedPlayer.tableau);
    },
    // The card names the server says are activatable RIGHT NOW (the
    // 'Perform an action from a played card' SelectCard in waitingFor). Empty
    // when it's not the viewer's action window. The Actions overlay uses this
    // as the authoritative "available" gate for the ВЫПОЛНИТЬ button.
    availableCardActionNames(): ReadonlyArray<CardName> {
      const found = this.findPerformActionCard(this.playerView.waitingFor);
      return found === undefined ? [] : found.model.cards.map((c) => c.name);
    },
    // The global Гидросеть advance action is in the action menu right now (it's
    // the viewer's window to act). Drives the bottom-bar "ready" cue + the
    // overlay action-zone's confirm gate.
    hydroActionAvailable(): boolean {
      return this.findHydroActionPath(this.playerView.waitingFor) !== undefined;
    },
    // Colony trade is available right now — drives the Colonies bottom-bar ready
    // cue (mirrors the Гидросеть dot). Reuses the existing trade-context finder.
    colonyTradeAvailable(): boolean {
      return this.tradeColonyContext !== undefined;
    },
    actionsPreviewCacheKey(): string {
      const p = this.displayedPlayer;
      const tagState = Object.entries(p.tags)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([tag, count]) => `${tag}:${count}`)
        .join(',');
      const tableauState = p.tableau
        .map((c) => {
          const reasons = (c.actionReasons ?? [])
            .map((r) => `${r.message}:${(r.params ?? []).join('/')}`)
            .join('~');
          return `${c.name}:${c.resources ?? ''}:${c.isDisabled === true ? 1 : 0}:${reasons}`;
        })
        .join(',');
      const privateHandState = p.color === this.thisPlayer.color ?
        this.playerView.cardsInHand.map((c) => c.name).join(',') :
        '';
      return [
        p.color,
        this.game.deckSize,
        this.game.discardPileSize,
        this.game.temperature,
        this.game.oxygenLevel,
        this.game.venusScaleLevel,
        this.game.oceans,
        p.megacredits,
        p.steel,
        p.titanium,
        p.plants,
        p.energy,
        p.heat,
        p.megacreditProduction,
        p.steelProduction,
        p.titaniumProduction,
        p.plantProduction,
        p.energyProduction,
        p.heatProduction,
        p.terraformRating,
        tagState,
        p.actionsThisGeneration.join(','),
        this.availableCardActionNames.join(','),
        privateHandState,
        tableauState,
      ].join('|');
    },
    // Sorted ACTIVE/PRELUDE cards for the blue-card actions overlay. Cached as
    // a computed (was an inline `sortActiveCards(getCardsByType(...).filter(...))`
    // evaluated TWICE in the template — once for the v-for and once for the
    // empty-state `.length === 0` check) so the getCardsByType→filter→sort
    // chain runs at most once per relevant change instead of twice per render. (perf B11)
    displayedActionCards(): ReadonlyArray<CardModel> {
      return sortActiveCards(
        getCardsByType(this.displayedPlayer.tableau, [CardType.ACTIVE, CardType.PRELUDE]).filter(this.isActive));
    },
    displayedCardsInHandCount(): number {
      // For the current user we know the exact cards in hand (preludes + ceos
      // + projects). For other players the server only sends the count.
      if (this.displayedPlayer.color === this.thisPlayer.color) {
        return this.cardsInHandCount;
      }
      return this.displayedPlayer.cardsInHandNbr ?? 0;
    },
    displayedPlayedCardsCount(): number {
      // Mirror the РАЗЫГРАНО overlay's own totalCount so the badge never
      // disagrees with the board it opens: count only cards the overlay
      // actually groups (known types via the client manifest), not the raw
      // tableau length.
      return totalPlayedCards(this.displayedPlayer);
    },
    // Number of active passive effects for the displayed player — drives the
    // ЭФФЕКТЫ button badge + delta-chip.
    displayedEffectsCount(): number {
      return playerEffectCount(this.displayedPlayer.tableau);
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
    // Count milestones whose requirements the viewer already satisfies,
    // independent of whose turn it is. The overlay's claim buttons still use
    // `claimableMilestones` below for the stricter "can click right now" gate.
    claimableMilestonesCount(): number {
      if (this.claimedMilestonesCount >= MAX_MILESTONES) {
        return 0;
      }
      return this.game.milestones.filter((m) =>
        m.playerName === undefined &&
        m.scores.some((s) => s.color === this.thisPlayer.color && s.claimable)).length;
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
      if (!found) {
        return set;
      }
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
      if (!found) {
        return set;
      }
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
      disabledPayments: ReadonlyArray<DisabledOptionModel>;
      colonies: ReadonlyArray<ColonyName>;
    } | undefined {
      return this.findTradeColonyContext(this.playerView.waitingFor);
    },
    // The full ColonyModel for the colony the player is about to trade with —
    // lets the trade-payment modal show a colony summary (planet + name + the
    // reward at the current track position).
    pendingTradeColonyModel(): ColonyModel | undefined {
      const pending = this.pendingTradeColony;
      if (pending === undefined) {
        return undefined;
      }
      return this.game.colonies.find((c) => c.name === pending.colonyName);
    },
    buildColonyContext(): {
      path: ReadonlyArray<number>;
      colonies: ReadonlyArray<ColonyName>;
      // Полный `coloniesModel` из серверного SelectColony — источник истины
      // того, ИЗ ЧЕГО игроку предлагают выбирать. У большинства карт это
      // подмножество in-play колоний (`game.colonies`), у Aridor — это
      // `game.discardedColonies`. Без этого поля шаблон рисует
      // `game.colonies`, и список Aridor'a (discarded) в DOM не попадает
      // — все кнопки гаснут, потому что selectableSet никого не находит.
      coloniesModel: ReadonlyArray<ColonyModel>;
      // Серверный `buttonLabel` у SelectColony — отличает «строим колонию
      // на in-play тайле» (`'Build'`, BuildColony.ts) от «добавляем тайл
      // колонии в игру» (`'Add colony tile'`, ColoniesHandler.addColonyTile).
      // Overlay использует это для контекстно-правильного prompt-текста
      // («... для строительства» vs «... для добавления в игру»), без
      // частного if по имени корпорации.
      buttonLabel: string;
      purpose: 'selectExistingColony' | 'addNewColonyToGame';
      disabledReasons: Partial<Record<ColonyName, string>>;
    } | undefined {
      return this.findBuildColonyContext(this.playerView.waitingFor);
    },
    /*
     * Список колоний, которые рендерит overlay. Универсальное правило:
     * в build-режиме показываем РОВНО то, что сервер положил в
     * SelectColony.coloniesModel — это единственный источник истины
     * «что игрок сейчас может выбрать». В trade / view-режимах
     * показываем актуальный список in-play колоний (game.colonies) —
     * там селекшн идёт по другому пути, плюс отображение фона/статуса
     * привязано к текущему состоянию стола.
     *
     * Это вылавливает кейс Aridor (initial action добавляет колонию
     * из discarded в игру) без частного if по имени корпорации:
     * сервер прислал coloniesModel из discardedColonies — клиент их
     * и показывает, кнопки enabled. Любой будущий «добавь колонию из
     * нестандартного источника» эффект (карта прелюдии, событие и т.п.)
     * автоматически работает тем же путём.
     */
    coloniesOverlayColonies(): ReadonlyArray<ColonyModel> {
      // ADD-NEW-TILE (Aridor): the offered tiles are NOT in play (discarded
      // pool), so show EXACTLY the server's coloniesModel and never the
      // existing colonies. SELECT-EXISTING build (and trade / view) shows every
      // in-play colony, disabling the unbuildable ones with a reason.
      if (this.coloniesOverlayMode === 'build' &&
          this.buildColonyContext?.purpose === 'addNewColonyToGame') {
        return this.buildColonyContext.coloniesModel;
      }
      return this.game.colonies;
    },
    coloniesOverlayMode(): 'trade' | 'build' | 'view' {
      // build wins over trade — a top-level SelectColony from the server
      // means the server is BLOCKING on a colony pick (mandatory), so the
      // build prompt always takes precedence over the optional trade
      // action even if the latter is also offered somehow.
      if (this.buildColonyContext) {
        return 'build';
      }
      if (this.tradeColonyContext) {
        return 'trade';
      }
      return 'view';
    },
    // True пока сервер ждёт initial-draft ответа. Используется как
    // блокирующий флаг для тех немногих оверлеев, которые остаются
    // доступными во время стартового экрана (Колонии — игрок может
    // открыть для осмотра, но Select-кнопки везде disabled). HUD-уровень
    // прячется через body.initial-draft-active (см. InitialDraftFlowOverlay).
    initialDraftActive(): boolean {
      // Берём ИЛИ из shared reactive state — он остаётся true в
      // awaiting-window после submit'a (когда waitingFor уже undefined,
      // но overlay всё ещё показывает «ожидаем других игроков»).
      // Без этого status rail снимался бы сразу после submit, и игрок
      // не видел бы, кого ждём — нарушение исходного контракта rail'a.
      if (initialDraftSharedState.active) {
        return true;
      }
      return this.playerView.waitingFor?.type === 'initialCards';
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
      // Итерируем по тому же списку, что рисует overlay — иначе для
      // Aridor (рендер из `coloniesModel` discarded-набора) tooltip'ы
      // вычислялись бы для in-play колоний, которых на экране нет, а
      // у разрешённых сервером — отсутствовали бы вовсе (без записи в
      // `out` overlay падает на дефолтный «Unavailable»).
      for (const c of this.coloniesOverlayColonies) {
        if (selectableSet.has(c.name)) {
          continue;
        } // skip: tile shows positive tooltip
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
          // Prefer the server-derived reason when present — it names the
          // rule failures the client can't compute (Venus / Europa / Leavitt
          // TR affordability) instead of the generic fallback below.
          const serverReason = this.buildColonyContext?.disabledReasons[c.name];
          if (serverReason !== undefined) {
            out[c.name] = serverReason;
            continue;
          }
          if (c.colonies.length >= 3) {
            out[c.name] = 'Colony is full';
            continue;
          }
          if (c.colonies.indexOf(myColor) !== -1) {
            out[c.name] = 'You already have a colony here';
            continue;
          }
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
      if (noFleets) {
        return 'You have no free trade fleets';
      }
      const anyTradeable = this.game.colonies.some(
        (c) => c.isActive && c.visitor === undefined);
      if (!anyTradeable) {
        return 'No colonies are open for trade right now';
      }
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
    /*
     * Gate regular voluntary actions after the startup sequence is visually
     * complete, until the player presses the final "Begin the game" CTA.
     * Focused server prompts spawned by preludes/corporations stay allowed:
     * play-a-card with discount, payment, placement, colony, etc.
     */
    startGameFlowActionLocked(): boolean {
      return startGameFlowActive(this.playerView) &&
        startGameFlowAllDone(this.playerView) &&
        !startFlowHasFocusedSubAction(this.playerView);
    },
    actionUiLocked(): boolean {
      return this.placementPending || this.startGameFlowActionLocked;
    },
    // The current SelectStandardProjectToPlay model in the action menu, or
    // undefined if the player isn't currently being offered standard
    // projects. Exposed to the overlay so each project's "USE" button can
    // tell whether THIS project is actionable right now (and what its
    // adjusted cost / canPayWith flags are).
    // The standard-projects play action: the action-menu's 'Standard projects'
    // option OR a top-level "play a standard project" prompt (EstablishedMethods
    // via SelectStandardProjectToPlay), which has an EMPTY response path.
    standardProjectsAction(): {path: ReadonlyArray<number>; input: SelectProjectCardToPlayModel} | undefined {
      const menu = this.findStandardProjectsAction(this.playerView.waitingFor);
      if (menu !== undefined) {
        return menu;
      }
      const top = standardProjectPlayPrompt(this.playerView);
      if (top !== undefined) {
        return {path: [], input: top};
      }
      return undefined;
    },
    standardProjectsActionInput(): SelectProjectCardToPlayModel | undefined {
      return this.standardProjectsAction?.input;
    },
    // The top-level "play a standard project" prompt, or undefined. Drives the
    // Standard Projects overlay's mandatory auto-open + minimize.
    standardProjectPlayInput(): SelectProjectCardToPlayModel | undefined {
      return standardProjectPlayPrompt(this.playerView);
    },
    // The current "Play project card" action in the action menu, or
    // undefined if the player isn't being offered card plays right now.
    playProjectCardAction(): {path: ReadonlyArray<number>; input: SelectProjectCardToPlayModel} | undefined {
      const menu = this.findPlayProjectCardAction(this.playerView.waitingFor);
      if (menu !== undefined) {
        return menu;
      }
      // A top-level "play a card from hand" projectCard prompt (EccentricSponsor
      // / EcologyExperts via PlayProjectCard) acts as a play action with an
      // EMPTY response path — the hand overlay's РАЗЫГРАТЬ → payment → submit
      // flow then drives it exactly like the action-menu play.
      const top = handPlayPrompt(this.playerView);
      if (top !== undefined) {
        return {path: [], input: top};
      }
      return undefined;
    },
    // True when the action menu currently offers playing a project card —
    // i.e. it's the viewer's action window. Drives the hand overlay's
    // turn-availability (РАЗЫГРАТЬ enabled state + reason wording).
    playProjectCardActionAvailable(): boolean {
      return this.playProjectCardAction !== undefined;
    },
    // The authoritative set of hand-card names the server says are playable
    // RIGHT NOW (the action's `cards` list). The hand overlay's РАЗЫГРАТЬ
    // button is enabled iff a card is in this set — it never re-derives
    // playability from raw state, so it can't offer an illegal play.
    playableProjectCardNames(): Set<CardName> {
      const action = this.playProjectCardAction;
      if (action === undefined) {
        return new Set();
      }
      return new Set(action.input.cards
        .filter((c) => c.isDisabled !== true)
        .map((c) => c.name));
    },
    // True when the "Sell patents" standard project is offered in the action
    // menu RIGHT NOW (server's `SellPatentsStandardProject.canAct` = the player
    // holds cards + it's their action window). `playerView.waitingFor` is the
    // VIEWER's own tree, so this is inherently own-seat — a spectator / other
    // seat never sees it. Drives the SP-overlay row + the hand-overlay toggle.
    sellPatentsActionAvailable(): boolean {
      return this.findSellPatentsAction(this.playerView.waitingFor) !== undefined;
    },
    // The top-level SelectCard prompt IF it's a selection FROM the player's own
    // hand (discard / reveal / keep / copy). Such prompts are hosted by the
    // КАРТЫ В РУКЕ overlay in its mandatory-select mode rather than the modal
    // card grid (DraftFlowOverlay suppresses itself for these). undefined for
    // draft / research / non-hand card prompts.
    handCardSelectionInput(): SelectCardModel | undefined {
      return handCardSelectionPrompt(this.playerView);
    },
    // The top-level "play a card from hand" projectCard prompt (EccentricSponsor
    // / EcologyExperts), or undefined. Drives the hand overlay's mandatory PLAY
    // mode.
    handPlayInput(): SelectProjectCardToPlayModel | undefined {
      return handPlayPrompt(this.playerView);
    },
    // The top-level FREE award-funding prompt (Vitor's start action), or
    // undefined. Drives the AwardsOverlay's free-sponsorship mode.
    awardFundingInput(): OrOptionsModel | undefined {
      return freeAwardFundingPrompt(this.playerView);
    },
    // Template flag: the AwardsOverlay should render in free-sponsorship mode.
    freeFundingActive(): boolean {
      return awardFundingState.active;
    },
    // True while the card-action confirm modal has handed off to the КАРТЫ В РУКЕ
    // overlay for a "pick a card from hand" step — the modal SUPPRESSES itself
    // (stays mounted, hidden) so the overlay below its z-index is interactable.
    actionCardPickActive(): boolean {
      return handSelectState.active && handSelectState.clientPick;
    },
    // True while a play / action-confirm modal has handed off to the РАЗЫГРАНО
    // board for a >3-candidate card-target pick — the modal SUPPRESSES itself
    // (stays mounted, hidden) so the board below it is interactable.
    playedPickActive(): boolean {
      return playedCardsPickState.active;
    },
    // True while a play / action-confirm modal has handed off to the ДЕЙСТВИЯ
    // overlay pick-mode for a >=4-candidate "repeat an action" pick (ProjectInspection
    // / Viron) — the modal SUPPRESSES itself so the overlay is interactable.
    actionsPickActive(): boolean {
      return actionsPickState.active;
    },
    // Unified mandatory pill. Select-from-hand, play-from-hand and play-a-
    // standard-project are mutually exclusive (the top-level waitingFor is one
    // prompt), so one pill serves all three minimized states; restore re-opens
    // whichever overlay owns the active prompt.
    handPillVisible(): boolean {
      return (handSelectState.active && handSelectState.minimized) ||
             (handPlayState.active && handPlayState.minimized) ||
             (standardProjectPlayState.active && standardProjectPlayState.minimized) ||
             (awardFundingState.active && awardFundingState.minimized);
    },
    handPillLabel(): string {
      // Unified with the mandatory-modal pill ("ОЖИДАЕТ РЕШЕНИЯ") so every
      // awaiting-prompt pill reads the same — the "ожидает" wording underlines
      // that the action is mandatory and can't be skipped. The specific kind
      // (play / select / standard project) is conveyed by the title below.
      return translateText('AWAITING DECISION');
    },
    handPillTitle(): string {
      if (awardFundingState.active) {
        return translateText('Free sponsorship');
      }
      let title: string | Message = handSelectState.title;
      if (standardProjectPlayState.active) {
        title = standardProjectPlayState.title;
      } else if (handPlayState.active) {
        title = handPlayState.title;
      }
      return translateText(inputTitleText(title) ?? '');
    },
  },

  components: {
    DynamicTitle,
    Card,
    LeftPlayerPanel,
    InitialDraftStatusRail,
    'waiting-for': WaitingFor,
    'sidebar': Sidebar,
    'colony': Colony,
    'sortable-cards': SortableCards,
    GameBoardView,
    InitialDraftFlowOverlay,
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
    PlayedCardsOverlay,
    EffectsOverlay,
    ActionsOverlay,
    HydroNetworkOverlay,
    CardActionConfirmContent,
    HandCardsOverlay,
    OpponentHandOverlay,
    HandCardPaymentContent,
    MandatoryInputModal,
    PlacementBanner,
    StandardProjectPaymentContent,
    PassConfirmContent,
    ConvertHeatConfirmContent,
    ColoniesOverlay,
    ColonyTradePaymentModal,
    BarButtonIcon,
    AnimatedMetricValue,
  },
  methods: {
    isPlayerActing(playerView: PlayerViewModel) : boolean {
      // An optional prompt (draft re-pick) is not an active turn.
      return playerView.players.length > 1 && playerView.waitingFor !== undefined && playerView.waitingFor.optional !== true;
    },
    toggleOverlay(id: OverlayId): void {
      // Leaving an overlay that hosts a MANDATORY prompt via the bottom bar
      // (toggle it off, or switch to another overlay) must minimize the pending
      // prompt to its pill — otherwise the overlay vanishes and the player loses
      // track of an action they MUST complete. (The ✕ and outside-click paths
      // already minimize; this was the missing button / overlay-switch path.)
      // From a prompt overlay, ANY toggle leaves it (toggle-off → null, or
      // switch → another overlay), so minimize unconditionally when on one.
      if (this.activeOverlay === 'cards' || this.activeOverlay === 'standardProjects' || this.activeOverlay === 'awards') {
        this.minimizeMandatoryHandPrompts();
      }
      // The actions overlay's persisted open-flag is kept in sync centrally by the
      // `activeOverlay` watcher, so this assignment alone clears / sets it.
      this.activeOverlay = this.activeOverlay === id ? null : id;
    },
    // The actions overlay ✕ — the `activeOverlay` watcher clears the persisted
    // open-flag (so a server poll doesn't re-arm it after an explicit close).
    closeActionsOverlay(): void {
      this.activeOverlay = null;
    },
    // Minimize whichever mandatory hand/standard-project/award prompt is
    // currently active to its shared pill (no-op when none is active). Shared by
    // every "close the hosting overlay while the prompt is still pending" path.
    minimizeMandatoryHandPrompts(): void {
      // A CLIENT-driven pick (SRR / Mars University) is NEVER minimized: its
      // initiating modal is suppressed behind it, so a pill would hide BOTH and
      // strand the player (the pill can't restore the suppressed modal). It stays
      // a focused overlay — completed via ВЫБРАТЬ or abandoned via ✕ (cancel).
      if (handSelectState.active && !handSelectState.clientPick) {
        handSelectState.minimized = true;
      }
      if (handPlayState.active) {
        handPlayState.minimized = true;
      }
      if (standardProjectPlayState.active) {
        standardProjectPlayState.minimized = true;
      }
      if (awardFundingState.active) {
        awardFundingState.minimized = true;
      }
    },
    // The journal is a side panel, not a board-covering bar-overlay, so
    // it has its own toggle. An already-open overlay is NOT closed when
    // the journal opens — the journal has priority on space and non-modal
    // overlays shrink to the free area left of it (CSS rule
    // `#player-home.journal-open .bar-overlay/...` in journal.less). The
    // Log button is a `.bottom-bar-btn`, which `handleOutsideOverlayClick`
    // exempts, so opening the journal never dismisses the overlay either.
    // The open flag lives in module-level `journalState` so it survives
    // the `playerkey` remount (see journalState.ts).
    toggleJournal(): void {
      journalState.open = !journalState.open;
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
      if (!target) {
        return;
      }
      // The clicked element was already DETACHED from the document by the time
      // this bubble-phase listener runs — i.e. an in-overlay control handled the
      // click and re-rendered (removed) the clicked node in the same dispatch
      // (e.g. the Гидросеть reward-choice button, whose `v-if` collapses the
      // choices once a reward is picked). A detached target means the click was
      // handled INSIDE the app, never an outside click, so `target.closest(...)`
      // below would wrongly return null and close the overlay. Treat it as inside.
      if (!target.isConnected) {
        return;
      }
      // An open fullscreen card (native <dialog>, e.g. the played-cards
      // board's CardZoomModal) sits OVER the overlay; a click on its
      // backdrop must close the dialog, not the overlay underneath.
      if (document.querySelector('dialog[open]') !== null) {
        return;
      }
      // Defensive: a click on a fullscreen card dialog (incl. the backdrop)
      // can reach here AFTER the dialog has already closed itself — so the
      // `dialog[open]` guard above misses it. The click target is still the
      // dialog element, so exempt it explicitly. (CardZoomModal also stops
      // the backdrop click at source; this is belt-and-braces.)
      if (target.closest('.card-zoom-dialog')) {
        return;
      }
      if (target.closest('.top-bar-dropdown') ||
          target.closest('.bar-overlay') ||
          target.closest('.played-board-overlay') ||
          target.closest('.effects-board-overlay') ||
          target.closest('.actions-board-overlay') ||
          target.closest('.hand-board-overlay') ||
          target.closest('.vp-board-overlay') ||
          target.closest('.hydronetwork-overlay') ||
          target.closest('.legacy-ui-overlay') ||
          target.closest('.sidebar_cont') ||
          target.closest('.bottom-bar-btn') ||
          target.closest('.bar-rail') ||
          target.closest('.left-panel') ||
          target.closest('.hand-select-pill')) {
        return;
      }
      // A CLIENT-driven card pick (SRR / Mars University) is a focused sub-step
      // of an action — an outside click must NOT dismiss it (its initiating modal
      // is suppressed behind it). Keep the overlay open; the player completes it
      // or abandons it via the ✕ (which cancels). Without this the overlay would
      // minimize to a dead-end pill.
      if (isClientHandPickActive()) {
        return;
      }
      // SAME for the РАЗЫГРАНО board pick (a >3-candidate card-target choice hosted
      // on the played board): its initiating play / action-confirm modal is
      // SUPPRESSED behind it, so an outside click must NOT dismiss it — that would
      // strand the suppressed modal and the pick (the КАРТЫ pick above already has
      // this exemption; the played pick was missing it, which let a stray click
      // close the board and flash the modal back). Abandon it via the board's
      // ОТМЕНА / ✕ instead.
      if (playedCardsPickState.active) {
        return;
      }
      // SAME for the ДЕЙСТВИЯ "repeat an action" pick (ProjectInspection / Viron,
      // >=4 candidates): its initiating play / action-confirm modal is SUPPRESSED
      // behind the overlay, so an outside click must NOT dismiss it (that would
      // strand the suppressed modal + cancel the pick). Abandon it via the overlay's
      // ОТМЕНА / ✕ instead.
      if (actionsPickState.active) {
        return;
      }
      // A mandatory prompt (hand select / hand play / standard project) can't be
      // dismissed by clicking away — minimize it to its pill instead of
      // dropping the overlay.
      this.minimizeMandatoryHandPrompts();
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
      if (!wf) {
        return undefined;
      }
      if (wf.type === 'or' && titlePredicate(inputTitleText(wf.title))) {
        return {options: (wf as OrOptionsModel).options, path: pathSoFar};
      }
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const found = this.findInnerActionPath(options[i], titlePredicate, [...pathSoFar, i]);
          if (found) {
            return found;
          }
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
      if (!wf) {
        return undefined;
      }
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
          if (deeper) {
            return deeper;
          }
        }
      }
      return undefined;
    },
    findConvertHeatOption(
      wf: PlayerInputModel | undefined,
      pathSoFar: ReadonlyArray<number> = [],
    ): {path: ReadonlyArray<number>; option: SelectOptionModel} | undefined {
      if (!wf) {
        return undefined;
      }
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          const t = inputTitleText(opt.title);
          if (opt.type === 'option' && typeof t === 'string' &&
              t.includes('heat into temperature')) {
            return {path: [...pathSoFar, i], option: opt};
          }
          const deeper = this.findConvertHeatOption(opt, [...pathSoFar, i]);
          if (deeper) {
            return deeper;
          }
        }
      }
      return undefined;
    },
    findConvertPlantsOption(wf: PlayerInputModel | undefined): {path: ReadonlyArray<number>; spacePrompt: PlayerInputModel} | undefined {
      // First pass: title match. Second pass (only if the server says the
      // action is available): accept any SelectSpace prompt in the action
      // menu — guards against title text drift.
      const byTitle = this.findConvertPlantsPathAndPrompt(wf);
      if (byTitle) {
        return byTitle;
      }
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
      if (!wf) {
        return undefined;
      }
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          if (opt.type === 'projectCard' && inputTitleText(opt.title) === 'Standard projects') {
            return {path: [...pathSoFar, i], input: opt as SelectProjectCardToPlayModel};
          }
          const deeper = this.findStandardProjectsAction(opt, [...pathSoFar, i]);
          if (deeper) {
            return deeper;
          }
        }
      }
      return undefined;
    },
    // Recursively walks the waitingFor tree for the "Play project card"
    // SelectProjectCardToPlay option (type 'projectCard', title 'Play
    // project card' — see server SelectCardToPlay.ts). Mirrors
    // findStandardProjectsAction; its `cards` array is the server's
    // authoritative list of cards playable RIGHT NOW. Returns the option
    // model + the index PATH so we can wrap the response in nested OR
    // layers exactly like the legacy radio UI would.
    findPlayProjectCardAction(
      wf: PlayerInputModel | undefined,
      pathSoFar: ReadonlyArray<number> = [],
    ): {path: ReadonlyArray<number>; input: SelectProjectCardToPlayModel} | undefined {
      if (!wf) {
        return undefined;
      }
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          if (opt.type === 'projectCard' && inputTitleText(opt.title) === 'Play project card') {
            return {path: [...pathSoFar, i], input: opt as SelectProjectCardToPlayModel};
          }
          const deeper = this.findPlayProjectCardAction(opt, [...pathSoFar, i]);
          if (deeper) {
            return deeper;
          }
        }
      }
      return undefined;
    },
    // Recursively walks the waitingFor tree for the "Sell patents" action — a
    // bare SelectCard (type 'card', title 'Sell patents', see server
    // SellPatentsStandardProject.action). Returns its index PATH so the chosen
    // cards can be wrapped in the nested OR response, byte-identical to the
    // radio UI. (Sell patents is offered DIRECTLY in the action OR, not via
    // the Standard projects sub-menu.)
    findSellPatentsAction(
      wf: PlayerInputModel | undefined,
      pathSoFar: ReadonlyArray<number> = [],
    ): {path: ReadonlyArray<number>} | undefined {
      if (!wf) {
        return undefined;
      }
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          if (opt.type === 'card' && inputTitleText(opt.title) === 'Sell patents') {
            return {path: [...pathSoFar, i]};
          }
          const deeper = this.findSellPatentsAction(opt, [...pathSoFar, i]);
          if (deeper) {
            return deeper;
          }
        }
      }
      return undefined;
    },
    // Walks the action tree for the 'Perform an action from a played card'
    // SelectCard (Player.playActionCard — covers blue-card AND corporation
    // actions, since corp cards live in the tableau too). Its `cards` list is
    // the server-filtered set of actions activatable RIGHT NOW (canAct && not
    // used this gen) — the authoritative "available now" source. Returns the
    // model + the index path so we can wrap the response back into nested ORs.
    findPerformActionCard(
      wf: PlayerInputModel | undefined,
      pathSoFar: ReadonlyArray<number> = [],
    ): {path: ReadonlyArray<number>; model: SelectCardModel} | undefined {
      if (!wf) {
        return undefined;
      }
      if (wf.type === 'card' && inputTitleText(wf.title) === 'Perform an action from a played card') {
        return {path: pathSoFar, model: wf as SelectCardModel};
      }
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const found = this.findPerformActionCard(options[i], [...pathSoFar, i]);
          if (found) {
            return found;
          }
        }
      }
      return undefined;
    },
    // ВЫПОЛНИТЬ in the Actions overlay → open the confirmation gate. Nothing is
    // submitted yet; the source card + action summary are shown first. The
    // overlay passes the chosen branch (when it split a multi-branch action),
    // so the modal opens straight on that branch.
    onActivateCardAction(payload: {cardName: CardName, nodeIndex?: number}): void {
      // Block both the details CTA AND the overlay double-click quick-activate while
      // a tile placement is pending or the start-game flow is locked — the double-
      // click is a separate path the placement-lock CSS/selector guard can't catch.
      if (this.startGameFlowActionLocked || this.placementPending) {
        return;
      }
      const card = this.thisPlayer.tableau.find((c) => c.name === payload.cardName);
      this.repeatOuter = undefined; // a fresh activation is never a repeat handoff
      this.pendingCardAction = {cardName: payload.cardName, card, nodeIndex: payload.nodeIndex ?? 0};
      this.activeOverlay = null; // close the overlay behind the modal
    },
    onCardActionConfirm(payload: {branchIndex: number, optionResponse?: unknown, stepResponses: ReadonlyArray<unknown>, reveal?: ActionRevealDescriptor}): void {
      if (this.pendingCardAction === undefined) {
        return;
      }
      const cardName = this.pendingCardAction.cardName;
      // A REVEAL / deck-check action: arm the App-level reveal-result overlay
      // BEFORE the confirm modal closes, so it bridges the server round-trip
      // (pending → result) and reads as a continuation of the same modal.
      if (payload.reveal !== undefined) {
        beginReveal(cardName, payload.reveal);
      }
      // A REPEATED action (ProjectInspection / Viron): submit the outer prefix
      // ([play/activate, {card:[X]}]) + X's own responses as ONE batch, instead of
      // the action-menu-rooted batch. Strictly gated on `repeatPrefix`.
      const repeatPrefix = this.pendingCardAction.repeatPrefix;
      if (repeatPrefix !== undefined) {
        this.submitRepeatActionBatch(repeatPrefix, payload.branchIndex, payload.optionResponse, payload.stepResponses);
      } else {
        this.submitCardActionBatch(cardName, payload.branchIndex, payload.optionResponse, payload.stepResponses);
      }
      this.pendingCardAction = undefined;
      this.repeatOuter = undefined;
      // After CONFIRMING, the player lands back on the board to SEE the action's
      // effect (the delta-chips animating on resources / parameters), NOT bounced
      // back into the ДЕЙСТВИЯ overlay. The overlay's persisted open-flag was
      // already cleared when onActivateCardAction set activeOverlay = null (the
      // `activeOverlay` watcher), so the post-submit remount re-arm won't re-open
      // it. (Cancel re-opens via onCardActionCancel.) A REVEAL action still shows
      // its drawn card via the App-level RevealResultOverlay, armed above.
    },
    onCardActionCancel(): void {
      // A REPEATED action's confirm cancelled — restore the OUTER modal it came
      // from (nothing was submitted), NOT the actions overlay.
      const outer = this.repeatOuter;
      this.pendingCardAction = undefined;
      if (outer !== undefined) {
        this.repeatOuter = undefined;
        if (outer.kind === 'play') {
          this.pendingPlayCard = outer.play; // re-open the ProjectInspection play modal at its picker
        } else {
          this.pendingCardAction = outer.action; // re-open Viron's confirm
        }
        return;
      }
      this.activeOverlay = 'actions'; // restore the overlay (nothing submitted)
    },
    // The play / action-confirm modal asked the player to pick an ACTION to repeat
    // (ProjectInspection / Viron) and there are >=4 candidates — open the ДЕЙСТВИЯ
    // overlay in pick-mode; the modal SUPPRESSES itself, the chosen action returns
    // via the bridge → the modal emits `repeat-action`. Cancelling restores the modal.
    onActionsPick(req: {title: string | Message, selectable: ReadonlyArray<CardName>}): void {
      this.selectedPlayerColor = undefined; // own seat — the actions are your own
      enterActionsPick({
        title: req.title,
        selectable: req.selectable,
        onResolve: (card, nodeIndex) => deliverActionRepeatPick(card, nodeIndex),
      });
      this.activeOverlay = 'actions';
    },
    // The Гидросеть overlay's pos-7 reward (reuse a used blue-card action) — open
    // the ДЕЙСТВИЯ overlay in pick-mode (the SAME surface as Viron), then return
    // to the Гидросеть overlay with the chosen action card stored in state. The
    // overlay restores on resolve here, and on an abandoned pick via the
    // activeOverlay watcher's `awaitingPick` branch.
    onHydroPickAction(req: {title: string | Message, selectable: ReadonlyArray<CardName>}): void {
      this.selectedPlayerColor = undefined; // own seat — the actions are your own
      hydroNetworkState.awaitingPick = 'reuse-action';
      // The callback ONLY records the chosen card. The overlay then emits `close`
      // (→ activeOverlay=null), and the activeOverlay watcher's `awaitingPick`
      // branch restores the Гидросеть overlay — for BOTH resolve and cancel,
      // uniformly. (Restoring activeOverlay HERE would be clobbered by that close.)
      enterActionsPick({
        title: req.title,
        selectable: req.selectable,
        onResolve: (card) => {
          hydroNetworkState.selectedCard = card;
        },
      });
      this.activeOverlay = 'actions';
    },
    // The Гидросеть overlay's pos-9 reward (add 2 animals to a card) — open the
    // РАЗЫГРАНО overlay in pick-mode, then return to the Гидросеть overlay.
    onHydroPickPlayedCard(req: {title: string | Message, selectable: ReadonlyArray<CardName>}): void {
      this.selectedPlayerColor = undefined; // own seat — the cards are your own
      hydroNetworkState.awaitingPick = 'animal-target';
      // ONLY record the chosen card here; the overlay's `close` + the activeOverlay
      // watcher's `awaitingPick` branch restore the Гидросеть overlay (resolve AND
      // cancel) — see onHydroPickAction.
      enterPlayedCardsPick({
        title: req.title,
        selectable: req.selectable,
        reasonMode: 'resource',
        onResolve: (card) => {
          hydroNetworkState.selectedCard = card;
        },
      });
      this.activeOverlay = 'played';
    },
    // The player chose an action X to repeat from the PLAY modal (ProjectInspection):
    // build the outer prefix [play ProjectInspection wrapped, {card:[X]}] and open
    // X's premium confirm (which collects X's choices + submits the combined batch).
    onRepeatActionFromPlay(payload: {chosenCard: CardName, nodeIndex: number, playResponse: unknown}): void {
      const action = this.playProjectCardAction;
      const outerPlay = this.pendingPlayCard;
      if (!action || outerPlay === undefined) {
        return;
      }
      let play: unknown = payload.playResponse;
      for (let i = action.path.length - 1; i >= 0; i--) {
        play = {type: 'or' as const, index: action.path[i], response: play};
      }
      const prefix: ReadonlyArray<unknown> = [play, {type: 'card' as const, cards: [payload.chosenCard]}];
      this.pendingPlayCard = undefined;
      this.openRepeatActionConfirm(payload.chosenCard, payload.nodeIndex, prefix, {kind: 'play', play: outerPlay});
    },
    // The player chose an action X to repeat from the ACTION-confirm modal (Viron):
    // build the outer prefix [activate Viron wrapped, {card:[X]}] and open X's confirm.
    onRepeatActionFromAction(payload: {chosenCard: CardName, nodeIndex: number}): void {
      const outerAction = this.pendingCardAction;
      if (outerAction === undefined) {
        return;
      }
      const activatePick = this.wrapActivatePick(outerAction.cardName);
      if (activatePick === undefined) {
        return;
      }
      const prefix: ReadonlyArray<unknown> = [activatePick, {type: 'card' as const, cards: [payload.chosenCard]}];
      this.openRepeatActionConfirm(payload.chosenCard, payload.nodeIndex, prefix, {kind: 'action', action: outerAction});
    },
    // Wrap an activate pick ({card:[cardName]}) in the action-menu OR path — the
    // SAME wrapping submitCardActionBatch uses, so the prefix's outer activate is
    // byte-identical to a normal activation submit.
    wrapActivatePick(cardName: CardName): unknown {
      const action = this.findPerformActionCard(this.playerView.waitingFor);
      if (!action) {
        return undefined;
      }
      let pick: unknown = {type: 'card' as const, cards: [cardName]};
      for (let i = action.path.length - 1; i >= 0; i--) {
        pick = {type: 'or' as const, index: action.path[i], response: pick};
      }
      return pick;
    },
    // Open the repeated action X's premium confirm (a fresh CardActionConfirmContent,
    // keyed on the card name so it remounts + re-fetches X's preview), opened on the
    // chosen branch NODE, carrying the outer prefix + the outer modal to restore on cancel.
    openRepeatActionConfirm(chosenCard: CardName, nodeIndex: number, prefix: ReadonlyArray<unknown>, outer: RepeatOuter): void {
      const card = this.thisPlayer.tableau.find((c) => c.name === chosenCard);
      this.repeatOuter = outer;
      this.pendingCardAction = {cardName: chosenCard, card, nodeIndex, repeatPrefix: prefix};
    },
    // Submit a REPEATED action: the outer prefix + X's own responses, in one batch.
    submitRepeatActionBatch(prefix: ReadonlyArray<unknown>, branchIndex: number, optionResponse: unknown, stepResponses: ReadonlyArray<unknown>): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      const responses: Array<unknown> = [...prefix];
      if (branchIndex >= 0) {
        responses.push({type: 'or' as const, index: branchIndex, response: optionResponse ?? {type: 'option' as const}});
      } else if (optionResponse !== undefined) {
        responses.push(optionResponse);
      }
      for (const r of stepResponses) {
        responses.push(r);
      }
      const wfRef = this.$refs.waitingFor as {onsaveBatch?: (out: ReadonlyArray<unknown>) => void} | undefined;
      wfRef?.onsaveBatch?.(responses);
    },
    // The confirm modal asked the player to pick a card FROM HAND (a hand-card
    // optionInput — Self-Replicating Robots "link a card"). Open the КАРТЫ В РУКЕ
    // overlay in client-pick mode (eligible cards selectable, the rest disabled
    // with a premium-tooltip reason); the confirm modal SUPPRESSES itself while
    // the overlay is up, then re-appears with the picked card (via the bridge).
    onActionPickCard(req: {title: string | Message, buttonLabel: string, selectable: ReadonlyArray<CardName>, reasons: Record<string, string>, multi?: boolean, min?: number, max?: number, selected?: ReadonlyArray<CardName>}): void {
      this.selectedPlayerColor = undefined; // ensure own seat — the overlay only mounts there
      // A MULTI-select pick (Public Plans "reveal any number") delivers the WHOLE
      // set back (even empty); a single pick delivers one card.
      const multi = req.multi === true;
      enterClientHandSelect({
        title: req.title,
        buttonLabel: req.buttonLabel,
        selectable: req.selectable,
        reasons: req.reasons,
        min: req.min,
        max: req.max,
        selected: req.selected,
        onResolve: (cards) => {
          if (multi) {
            deliverActionPickMulti(cards);
          } else if (cards.length > 0) {
            deliverActionPick(cards[0]);
          }
        },
      });
      this.activeOverlay = 'cards';
    },
    // The play / action-confirm modal asked the player to pick a PLAYED card as a
    // target, and there are MORE THAN 3 candidates — too many for the cramped
    // in-modal tile grid. Open the РАЗЫГРАНО board in pick mode (candidates
    // highlighted, the rest dimmed); the modal SUPPRESSES itself while the board
    // is up, then re-appears with the picked card (via the bridge). Cancelling
    // (closing the board) restores the modal with no selection.
    onPlayedCardActionPick(req: {title: string | Message, selectable: ReadonlyArray<CardName>, reasonMode?: 'resource' | 'generic', alreadyPicked?: ReadonlyArray<CardName>}): void {
      this.selectedPlayerColor = undefined; // own seat — the board pick targets your tableau
      enterPlayedCardsPick({
        title: req.title,
        selectable: req.selectable,
        reasonMode: req.reasonMode,
        alreadyPicked: req.alreadyPicked,
        onResolve: (card) => deliverPlayedCardActionPick(card),
      });
      this.activeOverlay = 'played';
    },
    // The action-preview rework's SINGLE FINAL SUBMIT: assemble the ordered
    // response array the action needs and POST it in one batch request, so the
    // player sees no follow-up modal spam.
    //   [0] pick the action card (wrapped in the action-menu OR path — the same
    //       nested-OR wrapping the legacy radio UI sends for "Perform an action
    //       from a played card" → <card>; byte-identical),
    //   [1] pick the OR branch (omitted when branchIndex < 0 — a single-action
    //       card or an autoSelect-collapsed lone branch). When the branch's
    //       OrOptions option is a DIRECT input (SelectAmount/SelectCard), the
    //       option's response is NESTED here (`optionResponse`); otherwise the
    //       option is a SelectOption → `{type:'option'}`.
    //   [2..] each branch step's response (target/card/amount/…) that arrives as
    //       a SEPARATE follow-up prompt, collected in the confirmation modal.
    submitCardActionBatch(cardName: CardName, branchIndex: number, optionResponse: unknown, stepResponses: ReadonlyArray<unknown>): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      const action = this.findPerformActionCard(this.playerView.waitingFor);
      if (!action) {
        console.warn('Activate action: SelectCard not found in waitingFor tree');
        return;
      }
      let pick: unknown = {type: 'card' as const, cards: [cardName]};
      for (let i = action.path.length - 1; i >= 0; i--) {
        pick = {type: 'or' as const, index: action.path[i], response: pick};
      }
      const responses: Array<unknown> = [pick];
      if (branchIndex >= 0) {
        const branchResponse = optionResponse ?? {type: 'option' as const};
        responses.push({type: 'or' as const, index: branchIndex, response: branchResponse});
      } else if (optionResponse !== undefined) {
        // The lone available branch auto-resolved WITHOUT an OrOptions wrapper —
        // the action returned its DIRECT input (a bare SelectCard / SelectAmount,
        // e.g. AsteroidRights "add asteroid" with no spend branch available).
        // Submit that input's response at the top level (no branch pick).
        responses.push(optionResponse);
      }
      for (const r of stepResponses) {
        responses.push(r);
      }
      const wfRef = this.$refs.waitingFor as {onsaveBatch?: (out: ReadonlyArray<unknown>) => void} | undefined;
      wfRef?.onsaveBatch?.(responses);
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
      if (!wf) {
        return undefined;
      }
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          if (opt.type === 'option' && inputTitleText(opt.title) === title) {
            return [...pathSoFar, i];
          }
          const deeper = this.findOptionPathByTitle(opt, title, [...pathSoFar, i]);
          if (deeper) {
            return deeper;
          }
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
    // The global "Гидросеть" advance action in the action menu (stable English
    // title, never mutated by i18n — same contract as the milestone / pass paths).
    findHydroActionPath(wf: PlayerInputModel | undefined): ReadonlyArray<number> | undefined {
      return this.findOptionPathByTitle(wf, 'Advance on the Delta Project track');
    },
    // Confirm from the Гидросеть overlay → ONE batch, byte-identical to the radio
    // UI: [select the advance action, the energy amount, the optional reward
    // choice]. The reward OrOptions (pos 1/2) is a deferred top-level prompt the
    // batch endpoint answers after the amount; pos 5/7/9 follow-ups arrive as
    // their own prompts and ride the existing premium surfaces.
    submitHydroAdvance(payload: {spend: number; rewardChoice: number | undefined; selectedCard?: CardName}): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      const path = this.findHydroActionPath(this.playerView.waitingFor);
      if (path === undefined) {
        return;
      }
      let activate: unknown = {type: 'option' as const};
      for (let i = path.length - 1; i >= 0; i--) {
        activate = {type: 'or' as const, index: path[i], response: activate};
      }
      const responses: Array<unknown> = [activate, {type: 'deltaProject' as const, amount: payload.spend}];
      // Pos 1/2 reward CHOICE — the deferred OrOptions becomes the next prompt.
      if (payload.rewardChoice !== undefined) {
        responses.push({type: 'or' as const, index: payload.rewardChoice, response: {type: 'option' as const}});
      }
      // Pos 7/9 pre-collected card pick — the deferred SelectCard becomes the
      // next prompt (reuse-action card / animal target), answered byte-identically.
      if (payload.selectedCard !== undefined) {
        responses.push({type: 'card' as const, cards: [payload.selectedCard]});
      }
      const wfRef = this.$refs.waitingFor as {onsaveBatch?: (out: ReadonlyArray<unknown>) => void} | undefined;
      wfRef?.onsaveBatch?.(responses);
      resetHydroPlan();
      this.activeOverlay = null;
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
      disabledPayments: ReadonlyArray<DisabledOptionModel>;
      colonies: ReadonlyArray<ColonyName>;
    } | undefined {
      if (!wf) {
        return undefined;
      }
      if (wf.type === 'and' && inputTitleText(wf.title) === 'Trade with a colony tile') {
        const children = (wf as AndOptionsModel).options;
        // Expected shape from server: [OrOptions("Pay trade fee"), SelectColony]
        const payOr = children.find((c) => c.type === 'or') as OrOptionsModel | undefined;
        const selectColony = children.find((c) => c.type === 'colony') as
          SelectColonyModel | undefined;
        if (payOr === undefined || selectColony === undefined) {
          return undefined;
        }
        const paymentOptions = payOr.options.filter(
          (o) => o.type === 'option') as ReadonlyArray<SelectOptionModel>;
        const disabledPayments = payOr.disabledOptions ?? [];
        const colonies = selectColony.coloniesModel.map((c) => c.name);
        return {path: pathSoFar, paymentOptions, disabledPayments, colonies};
      }
      if (wf.type === 'or' || wf.type === 'and') {
        const options = (wf as OrOptionsModel).options;
        for (let i = 0; i < options.length; i++) {
          const deeper = this.findTradeColonyContext(options[i], [...pathSoFar, i]);
          if (deeper) {
            return deeper;
          }
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
      coloniesModel: ReadonlyArray<ColonyModel>;
      buttonLabel: string;
      // 'addNewColonyToGame' (Aridor) → show ONLY the offered tiles; otherwise
      // show every in-play colony, disabling the unbuildable ones.
      purpose: 'selectExistingColony' | 'addNewColonyToGame';
      // Server-derived per-colony reasons (rule failures the client can't
      // compute, e.g. TR affordability). Keyed by colony name.
      disabledReasons: Partial<Record<ColonyName, string>>;
    } | undefined {
      if (!wf) {
        return undefined;
      }
      if (wf.type === 'colony' && !insideTradeAnd) {
        const select = wf as SelectColonyModel;
        const disabledReasons: Partial<Record<ColonyName, string>> = {};
        for (const d of select.disabledColonies ?? []) {
          disabledReasons[d.name] = typeof d.reason === 'string' ? d.reason : translateMessage(d.reason);
        }
        return {
          path: pathSoFar,
          colonies: select.coloniesModel.map((c) => c.name),
          coloniesModel: select.coloniesModel,
          buttonLabel: select.buttonLabel,
          purpose: select.purpose ?? 'selectExistingColony',
          disabledReasons,
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
          if (deeper) {
            return deeper;
          }
        }
      }
      return undefined;
    },
    findAwardOptionPath(wf: PlayerInputModel | undefined) {
      // Primary: title-prefix match. The server sets the title to
      // `'Fund an award (${0} M€)'` with the current cost baked in.
      const byTitle = this.findInnerActionPath(wf, (t) =>
        t !== undefined && t.toLowerCase().startsWith('fund an award'));
      if (byTitle) {
        return byTitle;
      }
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
      if (!wf) {
        return undefined;
      }
      if (wf.type === 'or') {
        const opts = (wf as OrOptionsModel).options;
        if (opts.length > 0 && opts.every((o) => {
          if (o.type !== 'option') {
            return false;
          }
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
          if (found) {
            return found;
          }
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
      if (this.startGameFlowActionLocked) {
        return false;
      }
      const innerIdx = found.options.findIndex(
        (o) => o.type === 'option' && inputTitleText((o as SelectOptionModel).title) === targetTitle);
      if (innerIdx === -1) {
        return false;
      }
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
      if (this.startGameFlowActionLocked) {
        return;
      }
      const found = this.findMilestoneOptionPath(this.playerView.waitingFor);
      if (!found) {
        return;
      }
      if (this.submitInnerActionResponse(found, name)) {
        this.activeOverlay = null;
      }
    },
    fundAward(name: AwardName): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      const found = this.findAwardOptionPath(this.playerView.waitingFor);
      if (!found) {
        return;
      }
      if (this.submitInnerActionResponse(found, name)) {
        this.activeOverlay = null;
        // Free-sponsorship flow: exit the mode on submit so no pill flashes
        // while the server resolves the prompt (no-op for the paid flow).
        exitAwardFunding();
      }
    },
    // Submits a top-level SelectOption picked from the action menu via its
    // index PATH. Wraps a `{type: 'option'}` response in one OR layer per
    // index (innermost first) — same shape the legacy radio UI would POST
    // when the player picks the option and hits Submit. Returns true on
    // successful submission, false if the path is empty or the WaitingFor
    // ref is missing.
    submitActionOptionPath(path: ReadonlyArray<number>): boolean {
      if (this.startGameFlowActionLocked) {
        return false;
      }
      if (path.length === 0) {
        return false;
      }
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
      if (this.startGameFlowActionLocked) {
        return;
      }
      const path = this.findEndTurnPath(this.playerView.waitingFor);
      if (path === undefined) {
        return;
      }
      this.submitActionOptionPath(path);
    },
    // Pass: irreversible for the rest of the generation. Click opens the
    // client-side confirmation modal; only Confirm fires the network call.
    onPassClick(): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      if (!this.passAvailable) {
        return;
      }
      this.passConfirmOpen = true;
    },
    onPassConfirm(): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      const path = this.findPassPath(this.playerView.waitingFor);
      this.passConfirmOpen = false;
      if (path === undefined) {
        return;
      }
      this.submitActionOptionPath(path);
    },
    onPassCancel(): void {
      this.passConfirmOpen = false;
    },
    submitConvertHeatPath(path: ReadonlyArray<number>): void {
      let response: unknown = {type: 'option' as const};
      // Wrap one OR layer per index in the path, innermost first.
      for (let i = path.length - 1; i >= 0; i--) {
        response = {type: 'or' as const, index: path[i], response};
      }
      const wfRef = this.$refs.waitingFor as {onsave?: (out: unknown) => void} | undefined;
      wfRef?.onsave?.(response);
    },
    // One-click conversion of 8 heat (or 6 for Kelvinists kp03) into +1
    // temperature step. Builds a nested OR-response that mirrors the depth
    // of the path returned by the recursive finder.
    convertHeat(): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      const found = this.findConvertHeatOption(this.playerView.waitingFor);
      if (!found || found.path.length === 0) {
        if (this.thisPlayer.canConvertHeat) {
          console.warn('Convert Heat: server flag says available but path not found in waitingFor tree');
        }
        return;
      }
      if ((found.option.warnings ?? []).includes('maxtemp')) {
        this.convertHeatConfirmOpen = true;
        return;
      }
      this.submitConvertHeatPath(found.path);
    },
    onConvertHeatConfirm(): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      const found = this.findConvertHeatOption(this.playerView.waitingFor);
      this.convertHeatConfirmOpen = false;
      if (!found || found.path.length === 0) {
        return;
      }
      this.submitConvertHeatPath(found.path);
    },
    onConvertHeatCancel(): void {
      this.convertHeatConfirmOpen = false;
    },
    // Convert Plants needs a SPACE choice — the option in the OR is a
    // SelectSpace, not a SelectOption. Clicking the button toggles a
    // "picker" mode that renders the legacy SelectSpace.vue with the inner
    // prompt, which takes over board interaction. When the user clicks a
    // valid greenery space, `onConvertPlantsSpacePicked` wraps the space
    // response in the outer OR-payload and submits.
    toggleConvertPlantsPicker(): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
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
      if (this.placementClickGuard !== null) {
        return;
      }
      const tooltipText = translateText('Finish your current action first');

      const guard = (e: MouseEvent) => {
        const target = e.target as Element | null;
        if (target === null) {
          return;
        }
        if (target.closest(PLACEMENT_LOCKED_SELECTORS) !== null) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      };
      document.addEventListener('click', guard, true);
      this.placementClickGuard = guard;

      const mouseover = (e: MouseEvent) => {
        const target = e.target as Element | null;
        if (target === null) {
          return;
        }
        const locked = target.closest(PLACEMENT_LOCKED_SELECTORS);
        if (locked === null) {
          return;
        }
        this.applyActionLockTooltip(locked, tooltipText);
        this.showActionLockTooltip(locked, tooltipText);
      };
      document.addEventListener('mouseover', mouseover, true);
      this.placementMouseOverHandler = mouseover;

      const mouseout = (e: MouseEvent) => {
        const target = e.target as Element | null;
        if (target === null) {
          return;
        }
        const locked = target.closest(PLACEMENT_LOCKED_SELECTORS);
        if (locked === null) {
          return;
        }
        const related = e.relatedTarget as Element | null;
        if (related !== null && locked.contains(related)) {
          return;
        }
        this.hideActionLockTooltip();
      };
      document.addEventListener('mouseout', mouseout, true);
      this.actionLockMouseOutHandler = mouseout;

      /* Eager pass — set titles on every match currently in the DOM
       * so the first hover doesn't race with the OS tooltip delay. */
      document.querySelectorAll(PLACEMENT_LOCKED_SELECTORS).forEach((el) => {
        this.applyActionLockTooltip(el, tooltipText);
      });
    },
    applyActionLockTooltip(el: Element, tooltipText: string): void {
      if (!el.hasAttribute(PLACEMENT_ORIG_TITLE_ATTR)) {
        const orig = el.getAttribute('title') ?? '';
        el.setAttribute(PLACEMENT_ORIG_TITLE_ATTR, orig);
        el.setAttribute('title', tooltipText);
      }
    },
    showActionLockTooltip(el: Element, tooltipText: string): void {
      const rect = el.getBoundingClientRect();
      const margin = 10;
      const tooltipWidth = 260;
      const tooltipHeight = 42;

      let left = rect.right + margin;
      if (left + tooltipWidth > window.innerWidth - margin) {
        left = rect.left - margin - tooltipWidth;
      }
      left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));

      const centeredTop = rect.top + (rect.height / 2) - (tooltipHeight / 2);
      const top = Math.max(margin, Math.min(centeredTop, window.innerHeight - tooltipHeight - margin));

      this.actionLockTooltipText = tooltipText;
      this.actionLockTooltipStyle = {
        left: `${left}px`,
        top: `${top}px`,
      };
    },
    hideActionLockTooltip(): void {
      this.actionLockTooltipText = '';
      this.actionLockTooltipStyle = {};
    },
    syncStartGameActionLockBody(): void {
      if (this.startGameFlowActionLocked) {
        document.body.classList.add('start-game-flow-action-locked');
      } else {
        document.body.classList.remove('start-game-flow-action-locked');
      }
    },
    syncActionLockGuards(): void {
      if (this.actionUiLocked) {
        this.installPlacementGuards();
      } else {
        this.uninstallPlacementGuards();
      }
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
      if (this.actionLockMouseOutHandler !== null) {
        document.removeEventListener('mouseout', this.actionLockMouseOutHandler, true);
        this.actionLockMouseOutHandler = null;
      }
      this.hideActionLockTooltip();
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
      if (this.startGameFlowActionLocked) {
        return;
      }
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
      if (this.startGameFlowActionLocked) {
        return;
      }
      const action = this.standardProjectsAction;
      if (!action) {
        return;
      }
      const card = action.input.cards.find((c) => c.name === cardName);
      if (card === undefined || card.isDisabled === true) {
        return;
      }
      const cost = card.calculatedCost ?? 0;
      if (this.standardProjectHasAlternativeResources(card, action.input.paymentOptions ?? {})) {
        // Title is a Message object (NOT a string concatenation) so the
        // i18n directive translates BOTH the template "Pay for ${0}" AND
        // the typed CARD placeholder lookup ("Power Plant:SP" →
        // "Электростанция"). Concatenating "Pay for " + cardName as a
        // raw string produces an untranslated literal like
        // "Pay for Power Plant:SP" which lands in the header without a
        // matching locale key.
        const title = standardProjectPaymentTitle(cardName);
        this.pendingStdProjectPayment = {
          cardName,
          // Same Message object on both fields — the modal uses `title`
          // for the minimize-pill text and the hosted payment content
          // reads `input.title` for the modal header. Sharing the same
          // typed Message keeps translations consistent.
          title: title,
          input: buildStandardProjectPaymentModel(this.playerView, action.input, card, title, cost),
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
      return hasUsableStandardProjectAlternativeResources(this.thisPlayer, card, opts);
    },
    onStdProjectPaymentConfirm(payment: Payment): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      if (this.pendingStdProjectPayment === undefined) {
        return;
      }
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
      // Action-menu standard project (non-empty path → nested OR) OR a top-level
      // SelectStandardProjectToPlay (EMPTY path → bare projectCard response).
      if (this.startGameFlowActionLocked) {
        return;
      }
      const action = this.standardProjectsAction;
      if (!action) {
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
    // ─── Sell patents (standard project) ───────────────────────────────
    // Entry from the Standard Projects overlay: don't submit — open the hand
    // overlay in sale mode and let the player pick cards there. The action is
    // re-validated; nothing is sent until they press ПРОДАТЬ.
    onEnterSellPatents(): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      if (!this.sellPatentsActionAvailable) {
        return;
      }
      // Always sell from YOUR OWN hand — snap back to your own view if you're
      // currently spectating another player, so the sale UI shows your cards
      // (the hand overlay only mounts for the own seat).
      this.selectedPlayerColor = undefined;
      enterSellPatents();
      this.activeOverlay = 'cards';
    },
    // Final confirm from the hand overlay (ПРОДАТЬ). Wraps the chosen card
    // names in the nested OR response and submits through WaitingFor.onsave —
    // byte-identical to the legacy radio UI's SelectCard submit. The hand
    // overlay already flagged `sellPatentsState.submitting`, so the post-
    // response remount drops sale mode automatically.
    onSellPatents(cards: ReadonlyArray<CardName>): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      const action = this.findSellPatentsAction(this.playerView.waitingFor);
      if (!action || action.path.length === 0) {
        // Action vanished (turn ended between select and submit) — abort the
        // sale cleanly rather than leave the overlay stuck mid-submit.
        exitSellPatents();
        return;
      }
      let response: unknown = {type: 'card' as const, cards: [...cards]};
      for (let i = action.path.length - 1; i >= 0; i--) {
        response = {type: 'or' as const, index: action.path[i], response};
      }
      const wfRef = this.$refs.waitingFor as {onsave?: (out: unknown) => void} | undefined;
      wfRef?.onsave?.(response);
    },
    // ─── Mandatory "select cards from hand" (discard / reveal / keep) ───────
    // Final ПОДТВЕРДИТЬ from the hand overlay's mandatory-select mode. The
    // prompt is the TOP-LEVEL waitingFor, so the response is the bare
    // {type:'card', cards} (no nested-OR wrapping, unlike sell-patents which is
    // an action-menu option). Submitted through WaitingFor.onsave; the server
    // resolves the prompt and the post-response remount drops the mode via the
    // handCardSelectionInput watcher.
    onHandSelect(cards: ReadonlyArray<CardName>): void {
      // CLIENT-driven pick (the card-action confirm modal asked for a card from
      // hand): resolve it back to that flow (no server POST) and close the
      // overlay so the suppressed confirm modal re-appears with the picked card.
      if (handSelectState.clientPick) {
        resolveClientHandSelect();
        this.activeOverlay = null;
        return;
      }
      const input = handCardSelectionPrompt(this.playerView);
      if (input === undefined) {
        exitHandSelect();
        return;
      }
      const wfRef = this.$refs.waitingFor as {onsave?: (out: unknown) => void} | undefined;
      wfRef?.onsave?.({type: 'card', cards: [...cards]});
    },
    // Close (✕ / Escape / outside click) of the hand overlay. While a mandatory
    // hand-select prompt is pending, "close" MINIMIZES to a pill (the prompt
    // can't be dismissed) instead of dropping the overlay.
    onHandOverlayClose(): void {
      // A CLIENT-driven pick (Self-Replicating Robots) can be ABANDONED: closing
      // cancels it and re-shows the (suppressed) confirm modal so the player can
      // pick a different branch — nothing was submitted.
      if (handSelectState.clientPick) {
        cancelClientHandSelect();
        this.activeOverlay = null;
        return;
      }
      this.minimizeMandatoryHandPrompts();
      this.activeOverlay = null;
    },
    // Restore the minimized mandatory overlay from the shared pill — re-opens
    // whichever overlay owns the active prompt (hand vs standard projects).
    onNotificationGoToAction(): void {
      if (this.handPillVisible) {
        this.restoreHandPill();
      }
    },
    restoreHandPill(): void {
      handSelectState.minimized = false;
      handPlayState.minimized = false;
      standardProjectPlayState.minimized = false;
      awardFundingState.minimized = false;
      this.selectedPlayerColor = undefined;
      if (awardFundingState.active) {
        this.activeOverlay = 'awards';
      } else {
        this.activeOverlay = standardProjectPlayState.active ? 'standardProjects' : 'cards';
      }
    },
    // Close (✕ / outside click) of the awards overlay. While a mandatory
    // free-sponsorship prompt is pending, "close" MINIMIZES to the shared pill
    // (the prompt can't be dismissed) instead of dropping the overlay; otherwise
    // (normal viewing) it just closes.
    onAwardsOverlayClose(): void {
      this.minimizeMandatoryHandPrompts();
      this.activeOverlay = null;
    },
    // Close (✕ / outside click) of the Standard Projects overlay. While the
    // mandatory "play a standard project" prompt is pending, "close" MINIMIZES
    // to the shared pill instead of dropping the prompt. (onUseStandardProject
    // sets activeOverlay=null directly to show the payment step — that path
    // doesn't go through here, so it doesn't minimize.)
    onStdProjectOverlayClose(): void {
      this.minimizeMandatoryHandPrompts();
      this.activeOverlay = null;
    },
    // ─── Play a card from the hand overlay ─────────────────────────────
    // РАЗЫГРАТЬ pressed on a hand card. Opens the client-side payment
    // modal constrained to that single card (the existing project-card
    // payment widget does the rest). No server round-trip yet — the modal
    // builds the payment locally; nothing is committed until Confirm.
    onPlayHandCard(cardName: CardName): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      // Generalized: matches the action-menu "Play project card" OR a top-level
      // "play a card from hand" projectCard prompt (empty path).
      const action = this.playProjectCardAction;
      if (!action) {
        return;
      }
      const card = action.input.cards.find((c) => c.name === cardName);
      if (card === undefined || card.isDisabled === true) {
        return;
      }
      // Message (NOT string concat) so the i18n directive translates both
      // the "Play ${0}" template AND the typed CARD placeholder lookup.
      const title: Message = {
        message: 'Play ${0}',
        data: [{type: LogMessageDataType.CARD as const, value: cardName}],
      };
      this.pendingPlayCard = {
        cardName,
        title,
        // Constrain the reused widget to just the chosen card; everything
        // else (paymentOptions, microbes/floaters, etc.) carries over.
        input: {...action.input, cards: [card]},
      };
      this.activeOverlay = null; // close the hand overlay behind the modal
    },
    onPlayCardConfirm(payload: PlayCardPayload): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      if (this.pendingPlayCard === undefined) {
        return;
      }
      this.submitPlayCardBatch(payload);
      this.pendingPlayCard = undefined;
    },
    onPlayCardCancel(): void {
      this.pendingPlayCard = undefined;
      // Restore the hand overlay so the player can pick a different card
      // (or close it themselves) — nothing was submitted.
      this.activeOverlay = 'cards';
    },
    // The play modal's SINGLE BATCH SUBMIT: assemble the ordered response array
    // (play pick + on-play branch + pre-collected step responses) and POST it in
    // ONE request, so the on-play target choices the player already made in the
    // modal are applied without follow-up modal spam. Mirrors submitCardActionBatch
    // (the action analog), but response[0] is the PLAY pick (projectCard+payment).
    //   [0] play the card (projectCard+payment), wrapped in the action-menu OR
    //       path — EMPTY path (a top-level "play from hand" prompt) → bare
    //       response, byte-identical to the legacy radio UI / old submitPlayCard.
    //   [1] optional on-play `behavior.or` branch pick (rare; the live path defers
    //       an OrOptions after play). Omitted when branchIndex < 0.
    //   [2..] each pre-collected step response (target/card/amount), in the SAME
    //       order the server defers the follow-up prompts (see stepsForBehavior).
    // A later-step failure is handled by the batch endpoint's graceful fallback
    // (it leaves the leftover prompt for PlacementBanner / the modal routing).
    submitPlayCardBatch(payload: PlayCardPayload): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      const action = this.playProjectCardAction;
      if (!action) {
        console.warn('Play card: action not found in waitingFor tree');
        return;
      }
      let play: unknown = payload.playResponse;
      for (let i = action.path.length - 1; i >= 0; i--) {
        play = {type: 'or' as const, index: action.path[i], response: play};
      }
      const responses: Array<unknown> = [play];
      if (payload.branchIndex >= 0) {
        responses.push({type: 'or' as const, index: payload.branchIndex, response: payload.optionResponse ?? {type: 'option' as const}});
      } else if (payload.optionResponse !== undefined) {
        responses.push(payload.optionResponse);
      }
      for (const r of payload.stepResponses) {
        responses.push(r);
      }
      const wfRef = this.$refs.waitingFor as {onsaveBatch?: (out: ReadonlyArray<unknown>) => void} | undefined;
      wfRef?.onsaveBatch?.(responses);
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
      if (this.startGameFlowActionLocked) {
        return;
      }
      if (this.coloniesOverlayMode === 'build') {
        this.submitBuildColony(colonyName);
        return;
      }
      if (this.coloniesOverlayMode === 'trade') {
        const ctx = this.tradeColonyContext;
        if (!ctx) {
          return;
        }
        // ALWAYS open the premium confirmation/payment modal — never trade
        // instantly, even with a single pay path. The player must explicitly
        // confirm (and see the cost + their resources) before the server
        // action fires. Predictable > "sometimes asks, sometimes doesn't".
        this.pendingTradeColony = {
          colonyName,
          tradeActionPath: ctx.path,
          paymentOptions: ctx.paymentOptions,
          disabledPayments: ctx.disabledPayments,
        };
      }
    },
    // Build flow — top-level SelectColony submission. The path returned
    // by findBuildColonyContext is wrapped into OR layers; the innermost
    // payload is the actual `{type: 'colony', colonyName}` response.
    submitBuildColony(colonyName: ColonyName): void {
      if (this.startGameFlowActionLocked) {
        return;
      }
      const ctx = this.buildColonyContext;
      if (!ctx) {
        return;
      }
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
      if (this.startGameFlowActionLocked) {
        return;
      }
      if (this.pendingTradeColony === undefined) {
        return;
      }
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
      if (this.startGameFlowActionLocked) {
        return;
      }
      const ctx = this.tradeColonyContext;
      if (!ctx) {
        return;
      }
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
