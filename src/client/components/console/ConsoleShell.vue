<template>
  <div class="con-root">
    <!-- P27: the strip is player IDENTITY + live turn STATUS only — the
         cards/actions counters live in the right home panel now, and the
         viewer's "your turn" reads from their own chip (no central pill). -->
    <ConsoleStatusStrip :playerView="playerView" :waitingOnPlayers="waitingOnPlayers" :epoch="playerView.runId" />

    <!-- P27: the central banner is reserved for MANDATORY / critical states
         (placement, awaited decisions) — never a plain "your turn". -->
    <div v-if="bannerText !== ''" class="con-banner">
      <span class="con-banner__pulse" aria-hidden="true"></span>
      <span>{{ bannerText }}</span>
    </div>

    <!-- CTS: a DEFERRED task (B = inspect the board) docks as an amber chip.
         P15: the return verb is CONTEXT-AWARE (selection / draft / start
         setup / decision) — never a generic «return to game» while the
         player is already in the game. -->
    <div v-if="(hostTask !== undefined || shellTask !== undefined || startTask !== undefined) && consoleState.task.deferred" class="con-banner con-banner--deferred" :aria-label="deferKicker + ': ' + deferAsk">
      <span class="con-banner__pulse" aria-hidden="true"></span>
      <!-- WHAT KIND of decision (the classification chip) … -->
      <span class="con-banner__kicker">{{ deferKicker }}</span>
      <!-- … and the CONCRETE ask — never a bare «ожидает решения». -->
      <span class="con-banner__ask">{{ deferAsk }}</span>
      <!-- WHO asks, when the server named a source card. -->
      <span v-if="deferSourceCard !== undefined" class="con-banner__src">{{ $t(deferSourceCard) }}</span>
      <span class="con-banner__hint"><GamepadGlyph control="back" /><span>{{ $t(deferReturnLabel) }}</span></span>
    </div>

    <!-- PRESENTATION FLOW: the quiet pending-queue chip — events are waiting
         their FIFO turn behind the active foreground item. Informational
         (same banner-band placement as the deferred chip); the journal (View)
         is the event center. Gains the critical accent when the queue holds a
         gameplay-critical item. -->
    <div v-if="pendingEvents.count > 0" class="con-banner con-banner--events" :class="{'con-banner--events-critical': pendingEvents.critical}">
      <span class="con-banner__pulse" aria-hidden="true"></span>
      <span>{{ $t('Pending events') }}</span>
      <span class="con-banner__count">+{{ pendingEvents.count }}</span>
    </div>

    <!-- THE DRAFT TRAY — the ONE persistent "selected cards area" of the
         draft (top-centre, ON the table, under the task modal): picked
         cards fly hero-style into it, the calm draftWait banner lives on
         it (the fork does NOT surface the server's optional re-pick), and
         the draft→research rise scene launches from it. Non-blocking; the
         board stays inspectable underneath. -->
    <transition name="con-layer">
      <ConsoleDraftTray v-if="draftTrayMounted"
                        :playerView="playerView"
                        :waiting="draftWaitActive" />
    </transition>

    <!-- Terraforming complete — the one-shot console-native CEREMONY (the
         MA-coronation-grade centre stage: veil + procedural Mars hero +
         gsap burst; pointer-events: none, bounded lifetime; the persistent
         state lives in the top-HUD rail + generation marker). -->
    <ConsoleTerraformingCeremony />

    <!-- MarsBot «Разбор хода» — the console-native FULLSCREEN turn review.
         Renders the SAME botTurnReviewState as the desktop overlay (suppressed
         in console mode); B closes, X inspects the card, L3 shows on map —
         hinted only in the command bar. -->
    <ConsoleBotTurnReview :players="playerView.players" />

    <!-- Milestone coronation / award seal — the cinematic post-confirm beat
         (pointer-events: none, bounded lifetime; fired only when the fresh
         playerView proves the viewer's OWN claim/fund resolved). -->
    <ConsoleMaCeremony />

    <!-- P29: --journal keeps the context panel's LAYOUT slot (the board
         never reflows) but hides its paint — the journal REPLACES it, the
         panel can't bleed through the journal surface. -->
    <div class="con-main" :class="{'con-main--journal': journalPanelVisible}">
      <ConsoleResourcePanel :player="thisPlayer" :epoch="playerView.runId"
                            :convertPlants="convertPlantsReady" :convertHeat="convertHeatReady"
                            :boardVisible="consoleState.section === 'board'" />
      <!-- v-show (NOT v-if): the board must stay in the DOM — the headless
           SelectSpace attaches placement handlers to its cells. -->
      <ConsoleBoardSection v-show="consoleState.section === 'board'"
                           ref="boardSection"
                           :playerView="playerView"
                           :placementActive="placementActive"
                           :inspecting="consoleState.inspecting" />
      <!-- The right CONTEXT + INFO panel (board home / inspection / task). -->
      <ConsoleContextPanel v-show="consoleState.section === 'board'"
                           :mode="contextMode"
                           :info="selectedCellInfo"
                           :preview="selectedCellPreview"
                           :loading="cellInfoLoading"
                           :viewerColor="thisPlayer.color"
                           :players="playerView.players"
                           :placementTitle="placementTitle"
                           :selectedLegal="selectedCellLegal"
                           :illegalReason="selectedCellIllegalReason"
                           :inspectAll="consoleState.freeRoam"
                           :cancellable="placementCancellable"
                           :myTurn="myTurn"
                           :actionsAvailable="actionsAvailableCount"
                           :actionsTotal="actionsTotalCount"
                           :milestoneSummary="homeMilestoneSummary"
                           :awardSummary="homeAwardSummary"
                           :trackInfo="trackInfo"
                           :trackScale="trackScaleOverview"
                           :lore="selectedCellLore" />
      <!-- The console-NATIVE journal (View) — REPLACES the right info panel
           while open: an absolute overlay anchored to the right edge, wider
           than the panel and free to overlap the board. The board layout is
           NEVER reflowed or rescaled for it (the context panel stays in the
           flex flow underneath). Board home only; owns the pad while open. -->
      <transition name="con-journal">
        <ConsoleJournalPanel v-if="journalPanelVisible"
                             ref="journalPanel"
                             :playerView="playerView"
                             @close="closeJournal"
                             @notice="showNotice($event)"
                             @inspect-colony="openJournalColonyInspect($event)" />
      </transition>
      <ConsoleHandSection v-if="consoleState.section === 'hand'"
                          ref="handSection"
                          :entries="handEntries"
                          :index="consoleState.handIndex"
                          :saleActive="consoleState.sale.active"
                          :saleSelected="consoleState.sale.selected"
                          :saleMegacredits="thisPlayer.megacredits"
                          :select="handSelectProps"
                          :softReason="handSoftReason"
                          :tagFilters="handTagFilterOptions"
                          :activeTag="consoleState.handTagFilter"
                          :stagedCard="stagedHandCard"
                          :transitHold="handRevealState.holdSlots"
                          :filterBusy="handRevealState.filterActive"
                          :underScene="footerUnderScene || consoleRevealMode !== undefined" />
      <ConsoleColoniesSection v-if="consoleState.section === 'colonies'"
                              :colonies="coloniesForRail"
                              :index="consoleState.colonyIndex"
                              :tradeable="tradeableColonyNames"
                              :tradeBlockReason="colonyTradeBlockReason"
                              :pick="colonyPick"
                              :players="playerView.players"
                              :viewerColor="thisPlayer.color"
                              :dockedColony="tradeFleetState.dockedColonyName"
                              :tradeOffset="thisPlayer.colonyTradeOffset ?? 0" />
      <!-- The console-NATIVE Hydronetwork screen (the full rework — the
           desktop overlay is no longer re-hosted here). One shared brain:
           hydroNetworkState + buildHydroModel; the shell keeps the pick
           sheet + the byte-identical submit batch. -->
      <ConsoleHydroSection v-if="consoleState.section === 'hydro'"
                           ref="hydroSection"
                           :playerView="playerView"
                           :actionAvailable="hydroActionAvailable"
                           :cacheKey="hydroCacheKey"
                           @pick="openHydroPickSheet"
                           @notice="showNotice($event)"
                           @confirm="submitHydroAdvance($event)"
                           @close="consoleState.section = 'board'" />
    </div>

    <!-- LT INFORMATION MODE — read-only player dashboard over everything
         console (fallback surfaces still render above at z12000+). -->
    <ConsoleInfoMode v-if="infoModeState.open" :playerView="playerView" :myTurn="myTurn" />

    <!-- Colony trade — the console-native pre-select COMPOSER (payment path +
         M€ mix + track choice + card targets + the live «Итог торговли»);
         confirms as ONE PlayerInputBatch (colonyTradePlan.buildTradeBatch). -->
    <transition name="con-layer">
      <ConsoleColonyTradeConfirm v-if="pendingTradeColony !== undefined"
                                 ref="tradeConfirm"
                                 :colony="pendingTradeColonyModel"
                                 :colonyName="pendingTradeColony.colonyName"
                                 :options="pendingTradeColony.paymentOptions"
                                 :disabledOptions="pendingTradeColony.disabledPayments"
                                 :players="playerView.players"
                                 :preview="pendingTradeColony.preview"
                                 :thisPlayer="thisPlayer"
                                 :viewerColor="thisPlayer.color"
                                 @confirm="onColonyTradeComposerConfirm($event)"
                                 @cancel="pendingTradeColony = undefined" />
    </transition>

    <!-- Colony inspect (X = «Осмотреть») — the read-only full dossier for ANY
         colony; ←/→ page through the colonies while open. -->
    <transition name="con-layer">
      <ConsoleColonyInspect v-if="colonyInspectModel !== undefined"
                            :colony="colonyInspectModel"
                            :players="playerView.players"
                            :viewerColor="thisPlayer.color"
                            :playerId="playerView.id"
                            :tradeOffset="thisPlayer.colonyTradeOffset ?? 0"
                            :readonly="colonyInspectReadonly"
                            :tradeable="colonyInspectTradeable"
                            :blockReason="colonyInspectReadonly ? '' : colonyTradeBlockReason"
                            :paymentOptions="colonyInspectReadonly || tradeColonyContext === undefined ? [] : tradeColonyContext.paymentOptions"
                            :disabledPayments="colonyInspectReadonly || tradeColonyContext === undefined ? [] : tradeColonyContext.disabledPayments" />
    </transition>

    <!-- «Разыграно» (X from the board home) — the console-native played-cards
         TABLE overlay: view-only peek piles + the face-down events pile.
         Bottom-anchored, height follows the content; closed automatically
         when a mandatory surface arrives (the journal's hard-block rule). -->
    <transition name="con-layer">
      <ConsolePlayedOverlay v-if="playedTableVisible"
                            ref="playedOverlay"
                            :players="playerView.players"
                            :thisPlayerColor="thisPlayer.color"
                            :heroIncoming="playedHeroIncoming"
                            :heroRevealed="playedHeroState.revealed"
                            :heroActive="playedHeroHolds"
                            @close="closePlayedOverlay" />
    </transition>

    <!-- The played-card hero STAGE — the fixed proxy layer of the "card
         lands on my tableau" scene. Mounted for the whole transaction so
         the flight survives the composer unmounting beneath it, and the
         leak detector counts it as the serving surface for the beat. -->
    <ConsolePlayedHeroLayer />

    <!-- Milestones/Awards — the console-native premium CONFIRMATION (an A
         on an available dashboard item opens this; nothing is submitted
         until the modal's own A — accidental claim/fund is impossible). -->
    <transition name="con-layer">
      <ConsoleMaConfirm v-if="maConfirmView !== undefined"
                        ref="maConfirm"
                        :view="maConfirmView"
                        :available="maConfirmAvailable"
                        :blockReason="maConfirmBlockReason"
                        @confirm="submitMaConfirm"
                        @cancel="pendingMaConfirm = undefined" />
    </transition>

    <!-- Milestones/Awards — the X → «Осмотреть» full-text READER (the premium
         reader for the long descriptions the dashboard cards must clamp). -->
    <transition name="con-layer">
      <ConsoleMaInspect v-if="maInspectItem !== undefined" :item="maInspectItem" :players="playerView.players" />
    </transition>

    <!-- P27: the RT / LT QUICK SELECTORS — the direct-input command layers
         (RT = action categories, LT = basic actions). -->
    <ConsoleQuickSelector v-if="consoleState.quick !== undefined"
                          :entries="quickEntries"
                          :title="quickTitle"
                          :trigger="quickTrigger" />
    <!-- P26: milestones/awards render as the dedicated premium strategic
         panel; P27 adds the Standard-Projects premium screen (incl. Patent
         sale); every other bounded list keeps the generic bottom sheet. -->
    <ConsoleStdProjectsScreen v-if="consoleState.sheet === 'standardProjects'"
                              :items="stdProjectItems"
                              :index="consoleState.sheetIndex"
                              :myMegacredits="thisPlayer.megacredits"
                              :backLabel="stdBackLabel" />
    <ConsoleMaScreen v-else-if="maScreenKind !== undefined" :kind="maScreenKind" :items="maScreenItems" :index="consoleState.sheetIndex" :myMegacredits="thisPlayer.megacredits" :free="awardFundingActive && maScreenKind === 'awards'" />
    <!-- The console-native BLUE-CARD ACTION CENTER (master-detail + confirm) —
         replaces the old bottom-sheet list + bare confirm for card actions. -->
    <ConsoleCardActions v-else-if="consoleState.sheet === 'cardActions'"
                        ref="cardActions"
                        :playerView="playerView"
                        @submit-batch="onCardActionsSubmitBatch"
                        @close="onCardActionsClose" />
    <ConsoleSheet v-else-if="consoleState.sheet !== undefined" :title="sheetTitle" :rows="sheetRows" :index="consoleState.sheetIndex" />

    <!-- Console confirm panel (pass / risky conversions). -->
    <div v-if="consoleState.confirm !== undefined" class="con-confirm" role="dialog">
      <div class="con-confirm__backdrop" aria-hidden="true"></div>
      <div class="con-confirm__card">
        <div class="con-confirm__title">{{ $t(confirmTitle) }}</div>
        <div class="con-confirm__body">{{ $t(confirmBody) }}</div>
        <!-- T7 info parity: the desktop PassConfirmContent warnings (unused
             actions / free trade fleet / conversions / hydro) carry over. -->
        <div v-if="confirmWarnings.length > 0" class="con-confirm__warns">
          <div v-for="(w, i) in confirmWarnings" :key="i" class="con-confirm__warn">
            <span aria-hidden="true">!</span>
            <span>{{ w }}</span>
          </div>
        </div>
        <div class="con-confirm__actions">
          <span class="con-confirm__action con-confirm__action--yes"><GamepadGlyph control="confirm" /><span>{{ $t('Confirm') }}</span></span>
          <span class="con-confirm__action"><GamepadGlyph control="back" /><span>{{ $t('Cancel') }}</span></span>
        </div>
      </div>
    </div>

    <!-- Transient notice (unsupported verb, refusals). -->
    <transition name="con-notice">
      <div v-if="notice !== ''" class="con-notice">{{ $t(notice) }}</div>
    </transition>

    <!-- CTS T1–T3: the console-native task host (choice / player / amount /
         resource / distribute / card browser / payment lanes — plus the
         CLIENT-side standard-project payment via promptOverride). The
         desktop modal is SUPPRESSED while it serves; B defers a server
         task (inspect the board) and CANCELS a client payment. -->
    <transition name="con-layer">
      <ConsoleTaskHost v-if="hostTask !== undefined && !govSupportActive && !productionLossActive && !govScaleFocusState.holding && !consoleState.task.deferred && taskSpacePending === undefined"
                       ref="taskHost"
                       :playerView="playerView"
                       :task="hostTask"
                       :prompt-override="pendingClientPayment !== undefined ? pendingClientPayment.input : undefined"
                       :defer-label="pendingClientPayment !== undefined ? 'Cancel' : 'Minimize'"
                       @submit="onTaskSubmit"
                       @defer="onTaskDefer"
                       @space-pick="onTaskSpacePick" />
    </transition>

    <!-- Government Support (World Government Terraforming) — the dedicated
         premium 2×2 briefing panel (replaces the generic host for this ONE
         choice). Same submit / space-pick / defer contract as the host. -->
    <transition name="con-layer">
      <ConsoleGovernmentSupport v-if="govSupportActive && !govScaleFocusState.closing && !consoleState.task.deferred && taskSpacePending === undefined"
                                ref="govSupport"
                                :playerView="playerView"
                                @submit="onTaskSubmit"
                                @defer="onTaskDefer"
                                @space-pick="onTaskSpacePick"
                                @gov-confirm="onGovSupportLeafConfirm" />
    </transition>

    <!-- Production loss (Ares hazard-adjacency penalty) — the dedicated
         premium "reduce your production" surface (replaces the generic host
         distribute lanes for this ONE case). Same submit / defer contract. -->
    <transition name="con-layer">
      <ConsoleProductionLoss v-if="productionLossActive && !consoleState.task.deferred && taskSpacePending === undefined"
                             ref="prodLoss"
                             :playerView="playerView"
                             @submit="onTaskSubmit"
                             @defer="onTaskDefer" />
    </transition>

    <!-- CTS T5: the game-opening START SCENE (initialCards wizard /
         start-sequence ceremony) — the console-native replacement for
         both desktop start surfaces. B defers to the amber chip. -->
    <transition name="con-layer">
      <ConsoleStartScene v-if="startTask !== undefined && !govScaleFocusState.holding && !consoleState.task.deferred"
                         ref="startScene"
                         :playerView="playerView"
                         :waitingOnPlayers="waitingOnPlayers"
                         :task="startTask"
                         @submit="onTaskSubmit"
                         @defer="consoleState.task.deferred = true" />
    </transition>

    <!-- CTS T6: the reveal overlay (drawn cards ВЗЯТЬ / deck-check result /
         another player's public reveal) — the console-native replacement
         for the three desktop reveal modals (gated off in console). -->
    <transition name="con-layer">
      <ConsoleRevealOverlay v-if="consoleRevealMode !== undefined"
                            ref="revealOverlay"
                            :playerView="playerView"
                            :mode="consoleRevealMode"
                            @dismiss-result="onDismissRevealResult" />
    </transition>

    <!-- CTS T0: the honest guard for a prompt NO surface serves (the
         leak detector's stranded check) — never a silent pill again. -->
    <transition name="con-layer">
      <ConsoleStrandedPrompt v-if="leakDetectorState.stranded !== undefined && !infoModeState.open"
                             :stranded="leakDetectorState.stranded" />
    </transition>

    <!-- SYSTEM ALERT: the pad-navigable replacement for App's native <dialog>
         alert (a server outage / rejected input froze the shell before, its
         OK button unreachable). Top of the intent chain — A/B dismiss. -->
    <transition name="con-layer">
      <ConsoleSystemAlert v-if="consoleSystemAlertState.current !== undefined" />
    </transition>

    <!-- The zoom dim VEIL — the ONE dim of the console fullscreen viewer
         (dialog.con-zoom's ::backdrop paints NOTHING — see the LESS). It
         fades in from the very first frame of the open (Vue enter
         transition), persists for the whole fullscreen lifetime, and fades
         out UNDER the close flight (`--lifted` on zoomClosing) — so the dim
         is gradual both ways and can never STACK with a backdrop or pop off
         while visible (the two failure modes of earlier designs: the
         one-step backdrop dim read abrupt/late; a veil UNDER a dimming
         backdrop blinked when removed). -->
    <transition name="con-zoom-veil">
      <div v-if="consoleCardZoom.card !== undefined"
           class="con-zoom-veil"
           :class="{'con-zoom-veil--lifted': zoomClosing}"
           aria-hidden="true"></div>
    </transition>
    <!-- Zoom OPEN flight (consoleZoomMotion.playZoomOpenFlight): the dialog
         below opens VANILLA at the flight's touchdown — its first top-layer
         frame is the final, fully-visible content (the compositor-safe shape;
         see the consoleZoomMotion.ts header). The premium FLIP lift flies
         THIS proxy on a normal fixed layer, like every other console flight
         (deal / exit / board-bonus). -->
    <div v-if="zoomOpenProxy !== undefined" class="con-zoom-flight-layer" aria-hidden="true">
      <!-- The GSAP-transformed element stays zoom-FREE (CSS zoom on the same
           element would rescale the translate coordinates); the landing zoom
           lives on the inner wrapper, whose zoomed layout box sizes the proxy. -->
      <div ref="zoomFlightProxy" class="con-zoom-flight-proxy">
        <div class="con-zoom-flight-proxy__zoom" :style="{zoom: String(zoomOpenProxy.zoom)}">
          <CardZoomCard :card="zoomOpenProxy.card" :selected="zoomSelected" />
        </div>
      </div>
    </div>

    <!-- P13/P15: the global "X = fullscreen card" viewer - ONE reused
         CardZoomModal for every console card context (module state).
         P15 makes it CONTROLLER-NATIVE: the shell owns the pad while it is
         open (LB/RB browse, B/X close, A toggles the pick when the opener
         passed a select context), the desktop close button + touch arrows
         are replaced by the console command bar in the #actions slot, and
         the `con-zoom` class scopes that restyle to THIS instance only. -->
    <CardZoomModal v-if="consoleCardZoom.card !== undefined"
                   ref="cardZoom"
                   class="con-zoom"
                   :class="{'con-zoom--flight': zoomFlight, 'con-zoom--closing': zoomClosing}"
                   :card="consoleCardZoom.card"
                   :cards="consoleCardZoom.cards.length > 1 ? consoleCardZoom.cards : undefined"
                   :index="consoleCardZoom.index"
                   :selected="zoomSelected"
                   :dismissable="!consoleCardZoom.mandatory"
                   :closing="zoomClosing"
                   :consoleMotion="true"
                   :annotationsSuppressed="zoomHasRules"
                   @navigate="onCardZoomNavigate"
                   @close="onCardZoomClosed">
      <!-- TV rules panel (Этап 1-R2): the stable right-hand rules surface —
           the structured Card Information blocks beside the hero card. The
           floating callouts are suppressed while it shows (one place for
           details); cards with no structured rules render no panel and the
           fit reclaims the width. -->
      <template v-if="zoomHasRules" #side="side">
        <ConsoleCardRulesPanel v-if="zoomRulesCardName !== undefined"
                               :cardName="zoomRulesCardName"
                               :nonce="side.nonce"
                               :closing="side.closing" />
      </template>
      <template #actions>
        <!-- A read-only inspector (bot-turn / card-actions, opened from a chip)
             names itself, so the card never reads as an ordinary picked card. -->
        <div v-if="consoleCardZoom.contextLabel !== undefined" class="con-zoom__context">
          <span class="con-zoom__context-mark" aria-hidden="true">◈</span>
          <span>{{ $t(consoleCardZoom.contextLabel) }}</span>
        </div>
        <!-- P17: an UNPLAYABLE card is never mute — the same structured
             server reasons the hand verdict shows (desktop parity). -->
        <div v-if="zoomReasons.length > 0" class="con-zoom__reasons">
          <span class="con-zoom__reasons-head"><span aria-hidden="true">✕</span> {{ $t('Unplayable now') }}</span>
          <div class="con-zoom__reason-list">
            <span v-for="(r, i) in zoomReasons" :key="i" class="con-zoom__reason">{{ r }}</span>
          </div>
        </div>
        <div class="con-zoom__bar">
          <!-- The prominent ROLE status (single-card reveal): «ПОЛУЧЕННАЯ
               КАРТА» / «ИСТОЧНИК ДОБОРА» — the player always tells a received
               card from the draw source at a glance. -->
          <span v-if="zoomStatusLabel !== undefined"
                class="con-zoom__status"
                :class="zoomReceiveLabel !== undefined ? 'con-zoom__status--received' : 'con-zoom__status--source'">
            {{ $t(zoomStatusLabel) }}
          </span>
          <!-- «ПОЛУЧЕНО N» — parity with the multi-card modal's header count. -->
          <span v-if="zoomReceivedCount > 0" class="con-zoom__count">
            <span class="con-zoom__count-icon resource_icon resource_icon--cards" aria-hidden="true"></span>
            <span class="con-zoom__count-label">{{ $t('Received') }}</span>
            <b class="con-zoom__count-num">{{ zoomReceivedCount }}</b>
          </span>
          <span v-if="zoomSelected" class="con-zoom__state">✓ {{ $t('Card selected') }}</span>
          <!-- The RECEIVE bridge (drawn-cards reveal) — A takes the on-screen
               card. Single-card departs from fullscreen; multi-card closes to
               the strip first. Absent on the read-only source view. -->
          <button v-if="zoomReceiveLabel !== undefined" class="con-zoom__btn con-zoom__btn--play" @click="zoomTakeReceived">
            <GamepadGlyph control="confirm" />
            <span>{{ $t(zoomReceiveLabel) }}</span>
          </button>
          <button v-else-if="zoomSelectable" class="con-zoom__btn con-zoom__btn--select" @click="zoomToggleSelect">
            <GamepadGlyph control="confirm" />
            <span>{{ $t(zoomSelected ? zoomDeselectLabel : zoomSelectLabel) }}</span>
          </button>
          <!-- P17: the context ACTION (play-from-hand parity) — A hands the
               card to the existing play flow; hidden when not actionable. -->
          <button v-else-if="zoomActionLabel !== undefined" class="con-zoom__btn con-zoom__btn--play" @click="zoomExecuteAction">
            <GamepadGlyph control="confirm" />
            <span>{{ $t(zoomActionLabel) }}</span>
          </button>
          <span v-if="zoomTakeAllLabel !== undefined" class="con-zoom__cmd">
            <GamepadGlyph control="triggerR" />
            <span>{{ $t(zoomTakeAllLabel) }}</span>
          </span>
          <!-- The L3 role swap (single-card reveal: received ⇄ source) — a
               compact chip naming the OTHER card (interactive card source). -->
          <span v-if="zoomSwapLabel !== undefined && zoomSwapOtherName !== undefined" class="con-zoom__swap">
            <GamepadGlyph control="stickL" />
            <span class="con-zoom__swap-label">{{ $t(zoomSwapLabel) }}</span>
            <span class="con-zoom__swap-sep" aria-hidden="true">·</span>
            <span class="con-zoom__swap-name">{{ $t(zoomSwapOtherName) }}</span>
          </span>
          <!-- A STATIC source chip for a non-inspectable source (tile / colony
               bonus) — the received card always names where it came from. -->
          <span v-else-if="zoomSourceInfo !== undefined" class="con-zoom__swap con-zoom__swap--static">
            <span class="con-zoom__swap-mark" aria-hidden="true">◈</span>
            <span class="con-zoom__swap-label">{{ $t(zoomSourceInfo.label) }}</span>
            <span class="con-zoom__swap-sep" aria-hidden="true">·</span>
            <span class="con-zoom__swap-name">{{ zoomSourceInfo.name }}</span>
          </span>
          <span v-if="consoleCardZoom.cards.length > 1" class="con-zoom__cmd">
            <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
            <span>{{ $t('Browse') }}</span>
          </span>
          <!-- A MANDATORY viewer (single-card reveal) has NO close — the only
               completion is taking the received card. -->
          <button v-if="!consoleCardZoom.mandatory" class="con-zoom__btn" @click="closeZoomViewer">
            <GamepadGlyph control="back" />
            <span>{{ $t('Close') }}</span>
          </button>
        </div>
      </template>
    </CardZoomModal>

    <!-- The ONE exit/transfer flight stage (take / collect / hero-pick /
         hand→modal) — app-level so a flight survives its host surface
         closing mid-animation (cardExitDirector.ts). -->
    <ConsoleCardExitLayer />

    <!-- The dock ↔ hand-overlay REVEAL stage — the compact pack physically
         opens into the real hand grid and gathers back (one reversible
         timeline per episode; handRevealDirector.ts). UNDER the footer
         band: the dock/bar furniture occludes the flights per pixel, so a
         card slots in BEHIND the tray texture, never over it. -->
    <ConsoleHandRevealLayer />

    <!-- The STARTING-CARDS DELIVERY stage — the cards you paid for fly from
         the top-HUD project deck down into the hand dock bay
         (handDeliveryDirector.ts). Under the footer band, like the reveal
         stage: an arriving card dives BEHIND the tray plate/bar texture. -->
    <ConsoleHandDeliveryLayer />

    <!-- The colony-trade LAUNCH flight stage (send a trade fleet to the
         planet) — app-level so the ship survives the composer dissolving
         beneath it; docks on the target colony's berth, then the trade
         resolves (consoleTradeFleet.ts / tradeFleetDirector.ts). -->
    <ConsoleTradeFleetLayer />

    <!-- The hydronetwork MARKER-ADVANCE stage — a token glides along the rail
         to the new stop and locks in, then the advance resolves (calmer,
         engineering-flavoured; consoleHydroMarker.ts). -->
    <ConsoleHydroMarkerLayer />

    <!-- The board CARD-BONUS stage — the card-back bonus physically lifts
         off the placed cell, travels into the reveal space and flips into
         the real received cards (consoleBoardCardBonus.ts). -->
    <ConsoleBoardCardBonusLayer :player-view="playerView" />

    <!-- The DECK-DRAW stage — cards physically peel off the top-bar project
         deck, are judged one at a time against the server's own search
         record, and route to the discard tray or the hold zone; the reveal
         modal then assembles around the found cards
         (consoleDeckDraw.ts / deckDrawDirector.ts). -->
    <ConsoleDeckDrawLayer :player-view="playerView" />

    <!-- The PATENT-SALE trade-terminal stage — the sold cards flip to their
         backs, sink into the terminal's slit, and the dispensed M€ chip
         arcs onto the resource rail; the commit lands at its touchdown
         (consolePatentSale.ts / patentSaleDirector.ts). -->
    <ConsolePatentSaleLayer />

    <!-- The TILE-PLACEMENT HERO stage — the chosen tile physically flies
         from the table edge into the picked hex (thickness + tightening
         ground shadow + touchdown settle), then the cell's printed bonus
         icons rise through it and hand off to the resource chips
         (consoleTilePlacement.ts / tilePlacementDirector.ts). -->
    <ConsoleTilePlacementLayer />

    <!-- The SHARED RESOURCE-TRANSFER stage — every "receiving resources"
         chip (the sale's M€ payout, a played card's reward beat, a placed
         cell's printed bonuses) flies here: real resource art + the amount,
         source → exact panel zone → delta chip
         (consoleResourceTransfer.ts / resourceTransferDirector). -->
    <ConsoleResourceTransferLayer />

    <!-- The FOOTER — one composed band: the command bar with its centre BAY
         + the permanent HAND DOCK sitting in it. The dock is absolutely
         positioned at left:50% of this full-width wrapper (symmetric root
         padding) → mathematically the viewport centre, coaxial with the
         RT/LT quick cross (fixed inset:0 + flex centre). `--con-hd-bay`
         is written HERE from the model so the bar's grid track and the
         dock's plate can never disagree. -->
    <div class="con-footer" :class="{'con-footer--nodock': game.phase === 'end', 'con-footer--under-scene': footerUnderScene}" :style="footerVars">
      <!-- THE DOCK IS A PHYSICAL PART OF THE BOTTOM BAR — its CARDS are hidden
           in two lifecycle windows (the endgame; and the pre-game INITIAL
           SETUP where no actual hand exists yet — see `handDockVisible`, so
           the «КАРТЫ 0/0» readout never lies), but the command bar KEEPS its
           reserved bay track through the whole in-game lifecycle (see the bar
           below) — only the dock's own cards `v-show` off. The player must
           always see how many cards they hold; the bar carries the command
           hints LEFT + RIGHT of the permanent centre bay. Surfaces interact
           with it by Z ONLY: tall
           bottom-reaching panels (the «Разыграно» table, composers, sheets,
           inspectors — `footerUnderScene`) drop the footer BELOW themselves
           so they cover the PACK where they overlap while the plate +
           counter keep peeking below their edge; the card-flow surfaces
           (start ceremony / task-host buys / the reveal modal — which is
           RAISED above the dock zone in CSS) keep the footer on top so
           cards visibly fly into a bright dock. The dock's per-card slots
           therefore stay laid out + measurable at all times WHILE VISIBLE —
           the hand-intake director can always land a card, and the counter
           only ticks on the physical touchdown. -->
      <ConsoleHandDock v-show="handDockVisible"
                       ref="handDock"
                       :cards="handDockCards"
                       :playableCount="cardsPlayableCount"
                       :epoch="playerView.runId"
                       :interactive="handDockInteractive"
                       :raised="consoleState.quick === 'actions'"
                       :liftedNames="dockLiftedNames"
                       :deliveryHeld="dockHeld"
                       @open="onHandDockOpen" />
      <!-- The command bar keeps its BAY (centre track) for the whole in-game
           lifecycle — the bay-mode fit (planCommandRun drops/splits commands
           to the width) is what keeps the setup's 5-command run from clipping
           at TV 4K. Only the DOCK CARDS (the «КАРТЫ 0/0» readout) are hidden
           during the pre-game setup (handDockVisible); the reserved bay track
           stays, so the bar layout is identical to in-game. -->
      <ConsoleCommandBar :context="commandContext" :commands="commands" :bay="game.phase !== 'end'" />
    </div>

    <!-- HEADLESS transport: the WaitingFor brain (polling / holds / modal
         routing / SelectSpace placement handlers) runs unchanged; its INLINE
         rendering is hidden. Its teleported surfaces (MandatoryInputModal,
         PlacementBanner) render at body level = the iteration-1 FALLBACK. -->
    <div class="con-wf-host" aria-hidden="true">
      <waiting-for v-if="game.phase !== 'end'" ref="waitingFor"
                   :playerView="playerView"
                   :waitingfor="playerView.waitingFor"
                   :modal-suppressed="hostServesPrompt || tilePlacementHolds || presentationHeld || consoleRevealMode !== undefined || startTask !== undefined || draftWaitActive || govScaleFocusState.holding || govScaleFocusState.closing || playedHeroHolds"></waiting-for>
      <select-space v-if="convertPlantsPrompt !== undefined"
                    :playerView="playerView"
                    :playerinput="convertPlantsPrompt"
                    :onsave="onConvertPlantsSpacePicked"
                    :showsave="false"
                    :showtitle="false" />
      <!-- Nested board pick from a task's space-type option (WGT ocean):
           the same headless SelectSpace machinery as convert-plants. -->
      <select-space v-if="taskSpacePrompt !== undefined"
                    :playerView="playerView"
                    :playerinput="taskSpacePrompt"
                    :onsave="onTaskSpacePicked"
                    :showsave="false"
                    :showtitle="false" />
    </div>

    <!-- Play-a-card flow — the console-native confirm (CTS T8: the
         re-hosted HandCardPaymentContent modal is retired). Preview +
         payment here; the on-play choices arrive as NATIVE follow-up
         tasks after confirm (the legacy-supported sequential contract). -->
    <transition name="con-layer">
      <ConsolePlayCardConfirm v-if="pendingPlayCard !== undefined"
                              ref="playConfirm"
                              :playerView="playerView"
                              :cardName="pendingPlayCard.cardName"
                              :input="pendingPlayCard.input"
                              @confirm="onPlayCardConfirmNative($event)"
                              @cancel="onPlayCardCancel" />
    </transition>

    <!-- The corporation's MANDATORY FIRST ACTION — the dedicated confirm
         modal (the play-composer's mandatory sibling). Presence is DERIVED
         from the corporationInitialAction prompt (never opened imperatively);
         B DEFERS to the amber chip, A submits the corp's OrOptions option. -->
    <transition name="con-layer">
      <ConsoleCorpFirstActionConfirm v-if="corpFirstActionOpen"
                                     ref="corpFirstConfirm"
                                     :playerView="playerView"
                                     :corpNames="corpFirstActionNames"
                                     @confirm="onCorpFirstActionConfirm"
                                     @cancel="onCorpFirstActionDefer" />
    </transition>

  </div>
</template>

<script lang="ts">
/**
 * ConsoleShell — the console-first TV shell (CONSOLE_MODE_CONCEPT.md;
 * feedback iteration 2 = the console COMMAND MODEL):
 *
 *  MAIN BOARD = the console home screen. Stable semantics from it (P27 —
 *  the COMMAND MODEL rework):
 *   Y  → Information Mode (read-only dashboard; was LT)
 *   RT → the ACTION-CATEGORY quick selector (A=Cards, ↑ Card actions,
 *        → Trading, ↓ Voting [reserved for Turmoil], ← Hydronetwork)
 *   LT → the BASIC-ACTIONS quick selector (A=Standard projects [incl.
 *        Patent sale], ↑ Skip turn, ↓ Pass [always confirmed],
 *        ← Plant conversion, → Heat conversion)
 *   LB → Milestones panel (badge = claimable count; viewable any time)
 *   RB → Awards panel (badge = fundable count; viewable any time)
 *   L3 → BOARD INSPECTION MODE (cells + global-parameter track bonuses;
 *        the cells are NOT part of the normal command loop — placement
 *        mode keeps its own automatic cell navigation)
 *   View → journal; B → calm (exits inspection → home; never destructive)
 *  Inside menus LB/RB are NOT globally reserved. B always returns toward the
 *  board; a mandatory placement B = cancel when the server marker allows,
 *  else an honest «Требуется выбор».
 *
 * Input claiming/fallback and the submission contracts are unchanged from
 * P0: everything ends in WaitingFor.onsave()/onsaveBatch() with payloads
 * byte-identical to the desktop dedicated buttons (turnIntents walkers).
 */
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {GameModel} from '@/common/models/GameModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {Payment} from '@/common/inputs/Payment';
import {SelectCardModel, SelectColonyModel, SelectPaymentModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import ConsoleCardActions from '@/client/components/console/ConsoleCardActions.vue';
import {consoleCardActionsUi} from '@/client/console/consoleCardActions';
import {getMilestone, getAward} from '@/client/MilestoneAwardManifest';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';
import {playerActionSourceCount} from '@/client/components/actions/actionExtraction';
import {placementReasonToUnplayable} from '@/client/components/board/placementReason';
import {getSpecialCellInfo} from '@/client/components/board/specialCellInfo';
import {SpaceId} from '@/common/Types';

import WaitingFor from '@/client/components/WaitingFor.vue';
import SelectSpace from '@/client/components/SelectSpace.vue';
import {buildStandardProjectPaymentModel, hasUsableStandardProjectAlternativeResources, standardProjectPaymentTitle} from '@/client/components/payment/paymentModelUtils';

import ConsoleStatusStrip from '@/client/components/console/ConsoleStatusStrip.vue';
import ConsoleTerraformingCeremony from '@/client/components/console/ConsoleTerraformingCeremony.vue';
import ConsoleBotTurnReview from '@/client/components/console/ConsoleBotTurnReview.vue';
import {botTurnReviewState, closeBotTurnReview, setBotReviewPeek} from '@/client/components/marsbot/botTurnReviewState';
import {openBotTurnReviewByKey, stepBotTurnReview} from '@/client/components/marsbot/marsBotPresentation';
import {acquireForegroundLease, isMandatoryPromptsHeld} from '@/client/components/presentation/presentationFlow';
import {isAnimationHoldActive} from '@/client/components/presentation/animationHold';
import {PendingQueueSummary} from '@/client/components/presentation/presentationPolicy';
import {notificationState, pendingSummary, dismiss as dismissNotification} from '@/client/components/notifications/notificationState';
import {LiveNotification} from '@/client/components/notifications/notificationTypes';
import {displayNameForColor, participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';
import ConsoleHandDock from '@/client/components/console/ConsoleHandDock.vue';
import {handDockBayRem} from '@/client/console/consoleHandDock';
import ConsoleSheet, {ConsoleSheetRow} from '@/client/components/console/ConsoleSheet.vue';
import ConsoleMaScreen from '@/client/components/console/ConsoleMaScreen.vue';
import ConsoleMaConfirm from '@/client/components/console/ConsoleMaConfirm.vue';
import ConsoleMaInspect from '@/client/components/console/ConsoleMaInspect.vue';
import ConsoleMaCeremony from '@/client/components/console/ConsoleMaCeremony.vue';
import {buildConsoleMaItems, ConsoleMaItem, ConsoleMaKind, consoleMaPressNotice, stepGrid} from '@/client/components/console/consoleMaModel';
import {buildMaConfirm, MaConfirmView} from '@/client/components/ma/maConfirmModel';
import {armMaCeremony} from '@/client/components/ma/maCeremonyState';
import {MaKind} from '@/client/components/ma/maArt';
import ConsoleQuickSelector from '@/client/components/console/ConsoleQuickSelector.vue';
import ConsoleStdProjectsScreen from '@/client/components/console/ConsoleStdProjectsScreen.vue';
import {buildRtQuickEntries, buildLtQuickEntries, buildStdProjectItems, buildHomeMaSummary, HomeMaSummary, QuickEntry, QuickSlot, StdProjectItem} from '@/client/console/consoleQuickModel';
import ConsoleContextPanel from '@/client/components/console/ConsoleContextPanel.vue';
import {scaleTooltipState, ScaleTooltipContent, hideScaleTooltip} from '@/client/components/board/scaleTooltipState';
import {ARC_SCALE_THEMES} from '@/client/components/board/arcScaleTheme';
import ConsoleBoardSection from '@/client/components/console/ConsoleBoardSection.vue';
import ConsoleHandSection, {ConsoleHandEntry, ConsoleHandSelectMode} from '@/client/components/console/ConsoleHandSection.vue';
import {deriveHandSelect, handSelectPicksValid, HandSelectDerivation} from '@/client/components/console/consoleHandSelectModel';
import {unplayableReasonLine} from '@/client/components/handCards/unplayableReasonFormat';
import {buildConsoleTagFilters, filterHandByTag, cycleTagFilter, ConsoleTagFilterOption} from '@/client/components/console/consoleHandFilter';
import ConsoleResourcePanel from '@/client/components/console/ConsoleResourcePanel.vue';
import ConsoleColoniesSection, {ConsoleColonyPick} from '@/client/components/console/ConsoleColoniesSection.vue';
import ConsoleInfoMode from '@/client/components/console/ConsoleInfoMode.vue';
import ConsoleStrandedPrompt from '@/client/components/console/ConsoleStrandedPrompt.vue';
import ConsoleSystemAlert from '@/client/components/console/ConsoleSystemAlert.vue';
import {consoleSystemAlertState, dismissConsoleAlert, isConsoleAlertActive} from '@/client/console/consoleSystemAlertState';
import ConsoleTaskHost from '@/client/components/console/ConsoleTaskHost.vue';
import ConsoleGovernmentSupport from '@/client/components/console/ConsoleGovernmentSupport.vue';
import ConsoleProductionLoss from '@/client/components/console/ConsoleProductionLoss.vue';
import ConsoleStartScene from '@/client/components/console/ConsoleStartScene.vue';
import ConsoleRevealOverlay, {ConsoleRevealMode} from '@/client/components/console/ConsoleRevealOverlay.vue';
import ConsolePlayCardConfirm from '@/client/components/console/ConsolePlayCardConfirm.vue';
import ConsoleCorpFirstActionConfirm from '@/client/components/console/ConsoleCorpFirstActionConfirm.vue';
import ConsoleCardExitLayer from '@/client/components/console/cardDeal/ConsoleCardExitLayer.vue';
import ConsoleHandRevealLayer from '@/client/components/console/ConsoleHandRevealLayer.vue';
import ConsoleHandDeliveryLayer from '@/client/components/console/ConsoleHandDeliveryLayer.vue';
import {handRevealState} from '@/client/console/handDock/handRevealState';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {isHandDeliveryActive, resetHandDelivery} from '@/client/console/handDock/handDeliveryDirector';
import {
  finishInstant, isHandRevealEpisodeRunning, resetHandReveal, reverseHandReveal, runHandCloseEpisode,
  runHandFilterEpisode, runHandOpenEpisode, runningHandRevealKind, setHandRevealHooks, RevealPair, RevealRect,
} from '@/client/console/handDock/handRevealDirector';
import ConsoleDraftTray from '@/client/components/console/cardDeal/ConsoleDraftTray.vue';
import {runCardTransfer} from '@/client/console/cardDeal/cardExitDirector';
import {
  draftPickBeatActive, observeDraftTransition, riseSceneEngaged, skipDraftPickBeat,
} from '@/client/console/cardDeal/consoleDraftTray';
import {Phase} from '@/common/Phase';
import ConsoleColonyTradeConfirm from '@/client/components/console/ConsoleColonyTradeConfirm.vue';
import ConsoleTradeFleetLayer from '@/client/components/console/colonyFleet/ConsoleTradeFleetLayer.vue';
import {armTradeFleet, abortTradeFleet, isTradeFleetActive, tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import ConsoleColonyInspect from '@/client/components/console/ConsoleColonyInspect.vue';
import ConsolePlayedOverlay from '@/client/components/console/played/ConsolePlayedOverlay.vue';
import ConsolePlayedHeroLayer from '@/client/components/console/played/ConsolePlayedHeroLayer.vue';
import {consolePlayedUi, resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {
  abortPlayedHero, armPlayedHero, isPlayedHeroActive, playedHeroHolding, playedHeroState, skipPlayedHeroResult,
} from '@/client/console/played/consolePlayedHero';
import {CardType} from '@/common/cards/CardType';
import {colonyGridCols, colonyGridLayout, colonyNavStep, consoleColoniesUi, resetConsoleColoniesUi} from '@/client/console/consoleColoniesModel';
import {consolePlayCardUi} from '@/client/console/consolePlayCardUi';
import {consoleStartUi} from '@/client/console/consoleStartUi';
import {panelCommands} from '@/client/console/consolePanelUi';
import {buildTradeBatch, TradeStep} from '@/client/components/colonies/colonyTradePlan';
import {buildPlayCardBatch} from '@/client/console/consolePlayCardComposer';
import {fetchColonyTradePreview} from '@/client/components/colonies/colonyTradePreviewFetch';
import {ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import CardZoomCard from '@/client/components/card/CardZoomCard.vue';
import ConsoleCardRulesPanel, {cardHasRules} from '@/client/components/console/ConsoleCardRulesPanel.vue';
import Card from '@/client/components/card/CardFace.vue';
import {ZoomCard, bonusZoomEntry} from '@/client/components/card/cardZoomTypes';
import {consoleCardZoom, openConsoleCardZoom, navigateConsoleCardZoom, closeConsoleCardZoom, slotZoomOrigin, ZoomOrigin} from '@/client/console/consoleCardZoom';
import {beginZoomOpen, cancelZoomOpen, playZoomOpenFlight, zoomOpenSourceRect, playZoomClose, playZoomDepart, playZoomHandoff, playZoomSwap, retargetZoomHold, releaseZoomMotion} from '@/client/console/consoleZoomMotion';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {currentRevealEvent, untakenNameMultiset} from '@/client/components/drawnCards/drawnCardsState';
import {revealViewerState} from '@/client/components/notifications/revealViewerState';
import {ConsoleTask, taskFor, taskServedByHost, SCENE_KINDS, SHELL_SECTION_KINDS} from '@/client/console/consoleTaskRouter';
import {ConsoleTaskSummary, consoleTaskSummary} from '@/client/console/consoleTaskSummary';
import {setStartSetupRevealSuspended} from '@/client/components/startGameFlow/startSetupRevealState';
import {corpActionOptionIndexFor, corporationCardNames, corpStatusFor, startFlowCorpPrompt} from '@/client/components/startGameFlow/startGameFlowState';
import {cancelResponse, cardsResponse, colonyResponse, orWrappedResponse} from '@/client/console/taskResponses';
import {leakDetectorState, startConsoleLeakDetector, stopConsoleLeakDetector} from '@/client/console/consoleLeakDetector';
import {govScaleFocusState, beginGovScaleClose, commitGovScaleFocus, resetGovScaleFocus} from '@/client/console/consoleGovScaleFocus';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
import ConsoleHydroMarkerLayer from '@/client/components/console/hydroMarker/ConsoleHydroMarkerLayer.vue';
import {armHydroMarker, abortHydroMarker, isHydroMarkerActive, hydroMarkerState} from '@/client/console/hydroMarker/consoleHydroMarker';
import ConsoleBoardCardBonusLayer from '@/client/components/console/boardCardBonus/ConsoleBoardCardBonusLayer.vue';
import {armBoardCardBonus, abortBoardCardBonus, isBoardCardBonusActive} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import ConsoleDeckDrawLayer from '@/client/components/console/deckDraw/ConsoleDeckDrawLayer.vue';
import {abortDeckDraw, deckDrawHolds, isDeckDrawActive} from '@/client/console/deckDraw/consoleDeckDraw';
import ConsolePatentSaleLayer from '@/client/components/console/patentSale/ConsolePatentSaleLayer.vue';
import {armPatentSale, isPatentSaleActive, patentSaleState} from '@/client/console/patentSale/consolePatentSale';
import ConsoleResourceTransferLayer from '@/client/components/console/resourceTransfer/ConsoleResourceTransferLayer.vue';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import ConsoleTilePlacementLayer from '@/client/components/console/tilePlacement/ConsoleTilePlacementLayer.vue';
import {tilePlacementHolding, tilePlacementState} from '@/client/console/tilePlacement/consoleTilePlacement';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import ConsoleJournalPanel from '@/client/components/console/ConsoleJournalPanel.vue';
import {hydroNetworkState, resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import {consoleHydroUi} from '@/client/console/consoleHydroState';
import {consoleJournalUi} from '@/client/console/consoleJournalState';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {resolveScope} from '@/client/gamepad/focusScopes';
import {consoleState, closeConsoleLayers, stepIndex, stepSelectable, registerConsoleIntentHandler, ConsoleSheetId, ConsoleQuickId} from '@/client/console/consoleRouter';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {useConsoleNativeSurface} from '@/client/console/composables/consoleNativeSurface';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {notificationBus} from '@/client/components/notifications/notificationBus';
import {
  ConvertPlantsMatch,
  findAwardOptionPath,
  findConvertHeatOption,
  findConvertPlantsOption,
  findEndTurnPath,
  findHydroActionPath,
  findMilestoneOptionPath,
  findPassPath,
  findPlayProjectCardAction,
  findSellPatentsAction,
  findStandardProjectsAction,
  findTradeColonyContext,
  TradeColonyContext,
  hasTurn,
  inputTitleText,
  optionResponseForPath,
  wrapPath,
} from '@/client/console/turnIntents';
import {infoModeState, openInfoMode, closeInfoMode, restoreConsoleSnapshot, cyclePlayer, InfoDetail} from '@/client/console/infoModeState';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {boardInfoState, configureBoardInfo, fetchBoardCellPreview} from '@/client/components/board/boardInfoState';
import {BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {journalState} from '@/client/components/journal/journalState';
import {motionMs} from '@/client/components/motion/motionTokens';

type PendingPlayCard = {
  cardName: CardName;
  input: SelectProjectCardToPlayModel;
};

/** The CLIENT-built standard-project payment, hosted NATIVELY by the task
 * host via `promptOverride` (T3) — nothing committed until confirm; B = Cancel. */
type PendingClientPayment = {
  cardName: CardName;
  input: SelectPaymentModel;
};

/** The synthetic host task for a client-built payment prompt. */
const CLIENT_PAYMENT_TASK: ConsoleTask = {kind: 'payment'};

/** P17: px per full-deflection frame for the right-stick console scroll
 *  (mirrors the DOM engine's SCROLL_STEP_PX so the feel is identical). */
const CONSOLE_SCROLL_STEP_PX = 24;

export default defineComponent({
  name: 'ConsoleShell',
  components: {
    ConsoleStatusStrip,
    ConsoleTerraformingCeremony,
    ConsoleBotTurnReview,
    ConsoleCommandBar,
    ConsoleHandDock,
    ConsoleSheet,
    ConsoleMaScreen,
    ConsoleMaConfirm,
    ConsoleMaInspect,
    ConsoleMaCeremony,
    ConsoleQuickSelector,
    ConsoleStdProjectsScreen,
    ConsoleContextPanel,
    ConsoleSystemAlert,
    ConsoleBoardSection,
    ConsoleHandSection,
    ConsoleResourcePanel,
    ConsoleColoniesSection,
    ConsoleInfoMode,
    ConsoleCardRulesPanel,
    ConsoleStrandedPrompt,
    ConsoleTaskHost,
    ConsoleGovernmentSupport,
    ConsoleProductionLoss,
    ConsoleStartScene,
    ConsoleRevealOverlay,
    ConsolePlayCardConfirm,
    ConsoleCorpFirstActionConfirm,
    ConsoleCardExitLayer,
    ConsoleHandRevealLayer,
    ConsoleHandDeliveryLayer,
    ConsoleDraftTray,
    ConsoleHydroMarkerLayer,
    ConsoleBoardCardBonusLayer,
    ConsoleDeckDrawLayer,
    ConsoleColonyTradeConfirm,
    ConsoleTradeFleetLayer,
    ConsoleColonyInspect,
    ConsolePlayedOverlay,
    ConsolePlayedHeroLayer,
    ConsolePatentSaleLayer,
    ConsoleResourceTransferLayer,
    ConsoleTilePlacementLayer,
    CardZoomModal,
    CardZoomCard,
    Card,
    ConsoleCardActions,
    ConsoleHydroSection,
    ConsoleJournalPanel,
    GamepadGlyph,
    'waiting-for': WaitingFor,
    'select-space': SelectSpace,
  },
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /**
     * The LIVE list of players the server is waiting on (App-level, refreshed
     * by the headless WaitingFor's `/api/waitingFor` poll — mirrors what the
     * desktop DraftFlowOverlay / StartGameFlowOverlay receive). Load-bearing
     * while the viewer holds a prompt: the playerView is NOT refreshed then
     * (it would drop their partial input), so this is the only signal that
     * another player has since submitted.
     */
    waitingOnPlayers: {type: Array as PropType<ReadonlyArray<Color>>, default: () => []},
  },
  setup() {
    // Foundation (CONSOLE_FOUNDATION.md): the in-game shell is a
    // console-native SURFACE — page-level scroll is locked for its lifetime
    // (html.console-native + body scroll lock); anything that overflows must
    // live inside a ConsoleScrollArea, never scroll the page.
    useConsoleNativeSurface();
  },
  data() {
    return {
      consoleState,
      consoleCardZoom,
      playedHeroState,
      handRevealState,
      handDeliveryState,
      patentSaleState,
      tilePlacementState,
      /** Fullscreen open/close choreography: chrome held hidden mid-flight. */
      zoomFlight: false,
      /** Backdrop fade-out while the close flight plays. */
      zoomClosing: false,
      /** Re-entrancy guard for the single-card reveal L3 role swap. */
      zoomSwapping: false,
      /** The OPEN flight is in progress (dialog not shown yet) — input gated. */
      zoomOpening: false,
      /** The open-flight proxy (rendered on `.con-zoom-flight-layer`). */
      zoomOpenProxy: undefined as {card: ZoomCard, zoom: number} | undefined,
      /** Stale-callback fence for the async open sequence (measure/flight). */
      zoomOpenToken: 0,
      /** Deferred proxy removal after the top layer has covered it. */
      zoomOpenClearTimer: undefined as number | undefined,
      infoModeState,
      leakDetectorState,
      consoleSystemAlertState,
      govScaleFocusState,
      botTurnReviewState,
      /** The colony trade-launch controller (drives the docked-settle glow). */
      tradeFleetState,
      /** The hydronetwork marker-advance controller (the plan-reset watcher). */
      hydroMarkerState,
      pendingPlayCard: undefined as PendingPlayCard | undefined,
      /** The card mid-RETURN from a cancelled play composer (its hand slot
       *  stays held until the transfer proxy touches down). */
      returningPlayCard: undefined as CardName | undefined,
      /** The card just PLAYED (success) — its hand slot stays held until the
       *  server response removes it from the hand (never a fake return). */
      departingPlayCard: undefined as CardName | undefined,
      departingTimer: undefined as number | undefined,
      pendingClientPayment: undefined as PendingClientPayment | undefined,
      /** P24: the hydro pick-sheet candidates (name + live animal count). */
      hydroPickCards: [] as Array<{name: CardName, current?: number}>,
      pendingTradeColony: undefined as {colonyName: ColonyName, paymentOptions: TradeColonyContext['paymentOptions'], disabledPayments: TradeColonyContext['disabledPayments'], preview?: ColonyTradePreviewModel} | undefined,
      /** X = «Осмотреть» — the read-only colony dossier overlay. */
      colonyInspectOpen: false,
      /** X on the board home — the «Разыграно» tableau overlay (view-only). */
      playedOpen: false,
      /** A colony name opened READ-ONLY from the journal (X on a colony row). */
      journalColonyInspect: undefined as ColonyName | undefined,
      convertPlantsPending: undefined as ConvertPlantsMatch | undefined,
      /**
       * The focused cell's PLACEMENT preview (cost / gains / who else receives
       * / endgame VP). Fetched per focused cell while a placement is active —
       * `boardInfoState.info` (the hover facts) deliberately carries none of the
       * placement CONSEQUENCES, so the panel needs this second read.
       */
      cellPreview: undefined as BoardPlacementPreview | undefined,
      cellPreviewToken: 0,
      /** A task's nested space-type option being picked on the board. */
      taskSpacePending: undefined as {index: number, spacePrompt: PlayerInputModel} | undefined,
      /** Prompt identity — a change resets the task defer state. */
      lastTaskKey: '',
      /** The reveal-result the player already acknowledged (until the server clears). */
      dismissedRevealKey: '',
      /** The console-native card-action center's UI state (filter + confirm-open). */
      consoleCardActionsUi,
      /** Milestones/Awards premium confirm (nothing submitted until its A). */
      pendingMaConfirm: undefined as {kind: MaKind, name: string} | undefined,
      // X → «Осмотреть»: the NAME of the milestone/award shown in the premium
      // full-text reader (the live item is recomputed from maScreenItems).
      maInspect: undefined as string | undefined,
      notice: '',
      noticeTimer: undefined as number | undefined,
      offIntent: undefined as (() => void) | undefined,
      /** Release fn of the held 'mandatory-choice' presentation lease. */
      releasePresentationLease: undefined as (() => void) | undefined,
    };
  },
  computed: {
    game(): GameModel {
      return this.playerView.game;
    },
    thisPlayer() {
      return this.playerView.thisPlayer;
    },
    myTurn(): boolean {
      return hasTurn(this.playerView);
    },
    /** The server offers convert-plants RIGHT NOW — drives BOTH the resource-
     *  cell highlight and the LT quick menu. Server-authoritative (mirrors the
     *  desktop convert availability), so it's live only on the viewer's turn. */
    convertPlantsReady(): boolean {
      return findConvertPlantsOption(this.playerView.waitingFor, this.thisPlayer.canConvertPlants === true) !== undefined;
    },
    /** The server offers convert-heat RIGHT NOW (same contract as above). */
    convertHeatReady(): boolean {
      return findConvertHeatOption(this.playerView.waitingFor) !== undefined;
    },
    playAction() {
      return findPlayProjectCardAction(this.playerView.waitingFor);
    },
    // ── action intelligence (same sources as the desktop bar buttons) ──
    cardsPlayableCount(): number {
      const raw = (this.playAction?.input.cards ?? []).filter((c) => c.isDisabled !== true).length;
      // Never read ahead of the intake-aware total (a card still mid-flight
      // into the dock is not "in hand" on any HUD readout).
      return Math.min(raw, this.cardsTotalCount);
    },
    /** The hand total every HUD readout shows — the same intake-aware count
     *  the dock's «КАРТЫ» line uses (held / in-flight / untaken-reveal
     *  copies excluded), so no surface ever runs ahead of a physical take. */
    cardsTotalCount(): number {
      const totals = new Map<string, number>();
      for (const c of this.handDockCards) {
        totals.set(c.name, (totals.get(c.name) ?? 0) + 1);
      }
      const held = new Map<string, number>();
      for (const n of this.dockHeld) {
        held.set(n, (held.get(n) ?? 0) + 1);
      }
      let hidden = 0;
      held.forEach((k, name) => {
        hidden += Math.min(k, totals.get(name) ?? 0);
      });
      return this.handDockCards.length - hidden;
    },
    actionsAvailableCount(): number {
      return this.thisPlayer.availableBlueCardActionCount;
    },
    actionsTotalCount(): number {
      return playerActionSourceCount(this.thisPlayer.tableau);
    },
    // ── the permanent HAND DOCK (bottom-centre footer bay) ──────────────
    /** The dock's hand in SERVER order (append-stable — backs only, so the
     *  playable-first sort of the hand SECTION would just reshuffle the
     *  silhouettes on every playability change). SRR-hosted cards count:
     *  they are playable from the hand surface. */
    handDockCards(): ReadonlyArray<CardModel> {
      return [
        ...this.playerView.cardsInHand,
        ...(this.thisPlayer.selfReplicatingRobotsCards ?? []),
      ];
    },
    /**
     * Names the dock must WITHHOLD (hidden-with-layout + excluded from the
     * «КАРТЫ» count) — the union of every "on its way into the hand" ledger:
     *  - the episodic starting-cards hold (armDeliveryHold, pre-payment);
     *  - cards mid-flight into the dock (released per touchdown — the
     *    counter ticks only on a physical landing);
     *  - UNTAKEN reveal-batch cards: the server puts a drawn batch straight
     *    into `cardsInHand`, but until the player presses «взять» those
     *    cards are staged on the reveal surface — the hand count must not
     *    jump ahead of the take (the desktop's stagedCardsInHand twin).
     * A multiset (may repeat names) — the dock hides that many NEWEST copies.
     */
    dockHeld(): ReadonlyArray<string> {
      const out: Array<string> = [...handDeliveryState.held, ...handDeliveryState.inFlight];
      untakenNameMultiset().forEach((k, name) => {
        for (let i = 0; i < k; i++) {
          out.push(name);
        }
      });
      return out;
    },
    /**
     * Dock backs the hand OVERLAY owns right now (hidden in the tray) —
     * DERIVED, never stored, so it can't drift from the live hand:
     *  - the VISIBLE (filtered) entries while the overlay owns the cards —
     *    phase `open`/`closing`, or `opening` once its proxies stand (the
     *    old whole-pack `dockLifted` timing). A card OUTSIDE the tag filter
     *    is not in `handEntries`, so its back stays physically in the tray
     *    the whole time the hand is open;
     *  - plus `dockExtraLift`: tag-filter leavers still airborne on their
     *    way back to the pack (released at the episode's materialization).
     */
    dockLiftedNames(): ReadonlyArray<string> {
      const st = handRevealState;
      const overlayOwns = st.phase === 'open' || st.phase === 'closing' ||
        (st.phase === 'opening' && st.flights.length > 0);
      if (!overlayOwns) {
        return st.dockExtraLift;
      }
      return [...this.handEntries.map((e) => e.card.name), ...st.dockExtraLift];
    },
    /**
     * The dock renders IDENTICALLY in every shell state (welded into the
     * bar) — this only gates the CLICK affordance (hover lift + pointer),
     * derived from the SAME flags this template mounts surfaces by: the
     * calm board home / placement / draft-wait / quick wheels are
     * interactive; any owning overlay or a non-board section is not.
     */
    /**
     * THE DOCK IS NEVER HIDDEN — it is a physical part of the bottom bar
     * (the player must always see their hand count). This decides only the
     * footer's Z: TRUE = a tall bottom-reaching panel is up, so the footer
     * drops BELOW the overlay band (`--under-scene`, z 11390) and the panel
     * covers the PACK where they geometrically overlap — the plate +
     * «КАРТЫ» counter + command hints keep peeking below every panel's
     * bottom edge (panels end above the plate line).
     *
     * Deliberately NOT here (the footer stays ON TOP — a bright dock the
     * cards physically fly into): the start ceremony (`startTask`), the
     * task-host prompts incl. the research buy (`hostTask`), and the reveal
     * modal (`consoleRevealMode`) — its panel is RAISED above the dock zone
     * in CSS so per-card takes land in a fully visible hand.
     */
    footerUnderScene(): boolean {
      return (
        this.playedTableVisible ||
        this.pendingPlayCard !== undefined ||
        this.pendingTradeColony !== undefined ||
        this.corpFirstActionOpen ||
        this.govSupportActive ||
        this.productionLossActive ||
        this.maConfirmView !== undefined ||
        this.maInspectItem !== undefined ||
        this.colonyInspectModel !== undefined ||
        this.consoleState.sheet !== undefined ||
        this.consoleState.confirm !== undefined ||
        this.botTurnReviewState.open ||
        this.infoModeState.open ||
        this.leakDetectorState.stranded !== undefined
      );
    },
    /**
     * The pre-game INITIAL-SETUP window: the player has NO actual hand yet —
     * the `initialCards` wizard is live (incl. deferred / the submit in
     * flight), the initial draft is still dealing, or the viewer already
     * submitted and gen-1 research waits on the other players. The hand
     * dock's «КАРТЫ 0/0» would be a false readout for a hand that does not
     * exist, so the footer unmounts the dock AND its bay for the whole
     * window (see `handDockVisible`). The dock appears the moment the game
     * actually starts — the start ceremony's card delivery (post-launch) is
     * the first real hand content and needs the dock as its landing target.
     */
    setupHandPending(): boolean {
      if (this.playerView.waitingFor?.type === 'initialCards') {
        return true;
      }
      const phase = this.game.phase;
      if (phase === Phase.INITIALDRAFTING) {
        return true;
      }
      return this.game.generation === 1 && phase === Phase.RESEARCH &&
        this.playerView.waitingFor === undefined;
    },
    /** The dock (and the bar's centre bay) exists whenever a REAL hand can —
     *  everything but the endgame and the pre-game initial setup. */
    handDockVisible(): boolean {
      return this.game.phase !== 'end' && !this.setupHandPending;
    },
    handDockInteractive(): boolean {
      if (this.consoleState.section !== 'board' || this.consoleState.fallbackActive || this.game.phase === 'end') {
        return false;
      }
      return !(
        this.hostTask !== undefined ||
        this.startTask !== undefined ||
        this.govSupportActive ||
        this.productionLossActive ||
        this.consoleRevealMode !== undefined ||
        this.consoleState.sheet !== undefined ||
        this.consoleState.confirm !== undefined ||
        this.pendingPlayCard !== undefined ||
        this.pendingTradeColony !== undefined ||
        this.maConfirmView !== undefined ||
        this.maInspectItem !== undefined ||
        this.colonyInspectModel !== undefined ||
        this.corpFirstActionOpen ||
        this.playedTableVisible ||
        this.journalPanelVisible ||
        this.infoModeState.open ||
        this.botTurnReviewState.open ||
        this.govScaleFocusState.holding || this.govScaleFocusState.closing ||
        draftPickBeatActive() || riseSceneEngaged() ||
        this.leakDetectorState.stranded !== undefined
      );
    },
    /** The bay width flows from ONE source (consoleHandDock.ts) into both
     *  consumers: the bar's grid track and the dock's plate. */
    footerVars(): Record<string, string> {
      return {'--con-hd-bay': `${handDockBayRem(consoleLayoutState.profile)}rem`};
    },
    /** Award names for the translation-proof structure fallback (the fund
     *  OrOptions title is a Message that i18n mutates in place). */
    awardNames(): Array<string> {
      return this.game.awards.map((a) => a.name);
    },
    // ── placement ───────────────────────────────────────────────────────
    /** The convert-plants inner SelectSpace, narrowed for the headless picker. */
    convertPlantsPrompt() {
      const p = this.convertPlantsPending?.spacePrompt;
      return p !== undefined && p.type === 'space' ? p : undefined;
    },
    /**
     * PRESENTATION FLOW: while the player is being shown what just happened
     * (the compact AI-turn card / the opened «Разбор хода» review), the
     * console's mandatory task surfaces hold off mounting — bounded by the
     * card's TTL / the review close. The holding card / review is registered as
     * a serving surface in the leak detector, so the prompt is never "stranded".
     */
    presentationHeld(): boolean {
      return isMandatoryPromptsHeld();
    },
    /** A blocking foreground presentation is up: the console reveal overlay
     *  (drawn cards / result / viewer) OR a mandatory hold (bot-turn holding
     *  card / theater). While busy, a pending shell-section prompt is held
     *  BEHIND it and its section is NOT auto-opened; a watcher opens the
     *  serving surface the moment this clears (else it'd be a stranded prompt). */
    consoleForegroundBusy(): boolean {
      return this.consoleRevealMode !== undefined || this.presentationHeld || this.playedHeroHolds;
    },
    /** The visible flow-holding notification (the compact AI-turn card), if any. */
    foregroundHoldingCard(): LiveNotification | undefined {
      return notificationState.transient.find((n) => n.holdsFlow === true);
    },
    /** The currently VISIBLE transient notification — the topmost (the feed is
     *  serial, so at most one). GLOBAL rule: any console toast is dismissable
     *  with B; the flow-holding AI-turn card additionally claims X / swallows A. */
    topNotification(): LiveNotification | undefined {
      const feed = notificationState.transient;
      return feed.length > 0 ? feed[feed.length - 1] : undefined;
    },
    /** The pending-queue backlog (the banner-band chip). */
    pendingEvents(): PendingQueueSummary {
      return pendingSummary();
    },
    /** A console blocking foreground surface is actively presenting (drives
     *  the lease): task host / start scene / gov-support panel, plus the
     *  reveal overlays ('drawn' also derives from drawnCardsState — the lease
     *  covers the console-only 'result'/'viewer' modes too). */
    consoleMandatoryPresenting(): boolean {
      if (this.consoleRevealMode !== undefined) {
        return true;
      }
      if (this.consoleState.task.deferred) {
        return false;
      }
      return (this.hostTask !== undefined && this.taskSpacePending === undefined) ||
        this.startTask !== undefined ||
        this.govSupportActive;
    },
    /** The played-card hero scene owns the foreground (spec §13: a follow-up
     *  decision surfaces only after the landing + result beat complete). */
    playedHeroHolds(): boolean {
      return playedHeroHolding();
    },
    /**
     * The DEDICATED first-action confirm modal is the SERVING SURFACE of the
     * corporation's mandatory first action — its presence is DERIVED from the
     * prompt, never opened imperatively (the open/close-race lesson from the
     * old «Разыграно» action mode). Deferring (B) hides it via the deferred
     * flag; answering it clears `shellTask` and the modal unmounts itself.
     * NOTE `shellTask` is suppressed while the hero scene / a reveal holds the
     * foreground, so the modal simply appears when the beat completes.
     */
    corpFirstActionOpen(): boolean {
      return this.shellTask?.kind === 'corpFirstAction' && !this.consoleState.task.deferred;
    },
    /** The overlay is up — as a manual browse or the hero stage. (The corp
     *  first action no longer rides this table — it has its own modal.) */
    playedTableVisible(): boolean {
      return this.playedOpen || playedHeroState.tableOpen;
    },
    /**
     * The corporations whose mandatory first action is live RIGHT NOW (>1 =
     * Merger's second corp). Empty when the prompt isn't up / is deferred.
     */
    corpFirstActionNames(): ReadonlyArray<CardName> {
      if (!this.corpFirstActionOpen) {
        return [];
      }
      return corporationCardNames(this.playerView)
        .filter((name) => corpStatusFor(this.playerView, name) === 'ready');
    },
    /** The incoming card the «Разыграно» table reserves a slot for (hero). */
    playedHeroIncoming(): CardModel | undefined {
      if (!playedHeroState.active || playedHeroState.card === undefined) {
        return undefined;
      }
      const p = playedHeroState.phase;
      if (p === 'armed' || p === 'idle' || p === 'failed') {
        return undefined;
      }
      return {name: playedHeroState.card} as CardModel;
    },
    /** The tile-placement hero owns the foreground (reactive twin of
     *  `tilePlacementHolding()` — `tilePlacementState` is in data()). */
    tilePlacementHolds(): boolean {
      const p = this.tilePlacementState.phase;
      return this.tilePlacementState.active && p !== 'idle' && p !== 'armed' && p !== 'failed';
    },
    /** The task-host task (undefined = not served natively → fallback/other surfaces). */
    activeConsoleTask(): ConsoleTask | undefined {
      // A reveal overlay owns the foreground — the task host (and, cascading
      // off it, the gov-support panel) does not serve under it (see startTask).
      if (this.presentationHeld || this.playedHeroHolds || this.tilePlacementHolds ||
          this.consoleRevealMode !== undefined) {
        return undefined;
      }
      return taskServedByHost(this.playerView);
    },
    /**
     * Does the console TASK HOST serve the current prompt — HOLD-INDEPENDENTLY?
     * `activeConsoleTask` goes `undefined` during a transient hold (the
     * tile-placement hero, a reveal, presentation), which used to un-SUPPRESS
     * the desktop MandatoryInputModal fallback for the ~1s gap before the
     * console surface mounts — so the desktop `ModernProductionToLose` FLASHED
     * for a beat after placing next to a hazard, then swapped to the premium
     * console surface. This reads the classification directly (no hold gate), so
     * the desktop modal stays suppressed through the hold. It stays FALSE for a
     * genuine fallback (`composite` the host can't serve) → that modal still
     * shows when nothing native handles the prompt.
     */
    hostServesPrompt(): boolean {
      return taskServedByHost(this.playerView) !== undefined;
    },
    /** What the ConsoleTaskHost renders: a server task OR the client payment. */
    hostTask(): ConsoleTask | undefined {
      if (this.pendingClientPayment !== undefined) {
        return CLIENT_PAYMENT_TASK;
      }
      return this.activeConsoleTask;
    },
    /**
     * World Government Terraforming ("Government Support") — the ONE choice
     * prompt that gets the dedicated premium 2×2 briefing panel instead of
     * the generic ConsoleTaskHost list. Never during a client payment.
     */
    govSupportActive(): boolean {
      const task = this.hostTask;
      return this.pendingClientPayment === undefined &&
        task?.kind === 'choice' && task.flavor === 'wgt';
    },
    /**
     * "Reduce your production" (SelectProductionToLose) — the ONE distribute
     * prompt that gets the dedicated premium production-loss surface instead of
     * the generic ConsoleTaskHost lanes (the Ares hazard-adjacency penalty).
     * Only the TOP-LEVEL prompt (a nested productionToLose inside an OrOptions
     * stays in the host via `taskServedByHost`'s `choice` classification).
     */
    productionLossActive(): boolean {
      const task = this.hostTask;
      return this.pendingClientPayment === undefined &&
        task?.kind === 'distribute' && task.mode === 'production';
    },
    /** A SHELL-SECTION task (T3/T4): projectCard → hand / std sheet; colony → rail. */
    shellTask(): ConsoleTask | undefined {
      // A reveal overlay owns the foreground — no shell section activates
      // under it (see startTask). It re-opens once the reveal is finished.
      if (this.presentationHeld || this.playedHeroHolds || this.consoleRevealMode !== undefined) {
        return undefined;
      }
      const task = taskFor(this.playerView);
      if (task === undefined || !SHELL_SECTION_KINDS.has(task.kind)) {
        return undefined;
      }
      // The corporation's MANDATORY FIRST ACTION is a STANDALONE start-of-game
      // confirm modal that hosts NONE of the start-sequence cinematics — the
      // prelude tile / resource flights, the drawn-cards reveal AND the card
      // intake that lays the drawn cards into the dock. The guard above already
      // waits out the reveal / hero / BLOCKING holds, but the intake + card
      // deal register 'notification-only' holds (they legitimately play OVER
      // the other shell sections and the action menu, so they must not hold
      // those), which are invisible to it. Hold the corp confirm until the
      // WHOLE presentation has settled — otherwise it pops as "modal spam"
      // over the still-running prelude / intake animations (the exact overlap
      // the user reported). Safe from a self-deadlock: the confirm animates
      // nothing of its own, so nothing it hosts keeps the hold alive; the hold
      // is reactive, so the modal appears the instant the last flight lands.
      if (task.kind === 'corpFirstAction' && isAnimationHoldActive()) {
        return undefined;
      }
      return task;
    },
    /** The T5 START SCENE task (initialCards wizard / start-sequence ceremony). */
    startTask(): ConsoleTask | undefined {
      // A reveal overlay is a TOP-PRIORITY modal — it cannot be minimized and
      // must be finished (cards taken) before anything under it comes alive.
      // A draw earned by a prelude can arrive at the SAME time the server
      // raises the corporation's first mandatory action (a start-scene task):
      // the start scene must NOT mount / grab focus under the reveal. It
      // re-activates the instant the reveal closes (the consoleForegroundBusy
      // watcher opens the serving surface then).
      if (this.presentationHeld || this.consoleRevealMode !== undefined) {
        return undefined;
      }
      const task = taskFor(this.playerView);
      if (task !== undefined && SCENE_KINDS.has(task.kind)) {
        return task;
      }
      // (The old "keep the scene up for the client-staged corp-bonus reveal"
      // fallback is gone: the console retired the staged reveal — the
      // DEFERRED corporationPlay press + the hero landing carry that beat,
      // and the reveal never activates in console mode.)
      return undefined;
    },
    /** OPTIONAL draft re-pick — the fork shows a calm "waiting for the other
     *  players" banner instead of offering to change the pick (desktop parity). */
    draftWaitActive(): boolean {
      return taskFor(this.playerView)?.kind === 'draftWait';
    },
    /** The persistent draft tray lives through the WHOLE draft (picks +
     *  waits) and stays for the research-rise handoff; it renders empty-
     *  invisible before the first pick and leaves once the draft resolves. */
    draftTrayMounted(): boolean {
      const phase = this.playerView.game.phase;
      return phase === Phase.DRAFTING || phase === Phase.INITIALDRAFTING ||
        this.draftWaitActive || draftPickBeatActive() || riseSceneEngaged();
    },
    /** Cards already drafted this round (server-managed; cleared at endRound) —
     *  drawn as the desktop-style stack beside the draftWait banner. */
    draftedCards(): ReadonlyArray<CardModel> {
      return this.playerView.draftedCards ?? [];
    },
    /** The T6 REVEAL overlay mode (drawn > result > viewer), undefined = none. */
    consoleRevealMode(): ConsoleRevealMode | undefined {
      // The tile-placement hero owns the screen through its landing +
      // reward beat — a card-draw reveal earned by the SAME placement (a
      // cell with a resource AND a card) opens right after, never over the
      // still-flying bonuses (the computed re-evaluates on `done`).
      if (this.tilePlacementHolds) {
        return undefined;
      }
      // The cards are still physically coming off the top-bar deck: the
      // player watches the board, the deck and the hold zone. The modal must
      // not exist yet — it assembles AROUND the found cards once the search
      // is over (the scene releases this at its 'assemble' phase, where the
      // overlay mounts veiled so its slots can be measured).
      if (deckDrawHolds()) {
        return undefined;
      }
      if (currentRevealEvent() !== undefined) {
        return 'drawn';
      }
      const lr = this.playerView.lastReveal;
      if (lr !== undefined && `${lr.action}|${lr.revealed.name}` !== this.dismissedRevealKey) {
        return 'result';
      }
      if (revealViewerState.open) {
        return 'viewer';
      }
      return undefined;
    },
    shellTaskActive(): boolean {
      return this.shellTask !== undefined && !this.consoleState.task.deferred;
    },
    /** The std-projects source: the TOP-LEVEL prompt (EstablishedMethods) or the action menu. */
    standardProjectsAction(): {path: ReadonlyArray<number>, input: SelectProjectCardToPlayModel} | undefined {
      const task = this.shellTask;
      if (task?.kind === 'projectCard' && task.mode === 'standardProject' && this.playerView.waitingFor?.type === 'projectCard') {
        return {path: [], input: this.playerView.waitingFor as SelectProjectCardToPlayModel};
      }
      return findStandardProjectsAction(this.playerView.waitingFor);
    },
    // ── colony pick (T4 — a server SelectColony) ────────────────────────
    colonyModel(): SelectColonyModel | undefined {
      const wf = this.playerView.waitingFor;
      return wf?.type === 'colony' ? (wf as SelectColonyModel) : undefined;
    },
    colonyPick(): ConsoleColonyPick | undefined {
      const model = this.colonyModel;
      if (model === undefined || this.shellTask?.kind !== 'colony') {
        return undefined;
      }
      const reasons: Record<string, string> = {};
      for (const d of model.disabledColonies ?? []) {
        reasons[d.name] = typeof d.reason === 'string' ? translateText(d.reason) : translateMessage(d.reason);
      }
      const label = model.buttonLabel;
      return {
        selectable: model.coloniesModel.map((c) => c.name),
        reasons,
        buttonLabel: label !== undefined && label !== '' && !['Save', 'Confirm', 'Ok'].includes(label) ? label : 'Select',
      };
    },
    /**
     * The rail source: pick-a-NEW-tile prompts (Aridor) list ONLY the offered
     * tiles; everything else shows the in-game colonies (unpickable ones stay
     * visible with the server reason — information parity).
     */
    coloniesForRail(): ReadonlyArray<ColonyModel> {
      const model = this.colonyModel;
      if (model !== undefined && this.shellTask?.kind === 'colony' && model.purpose === 'addNewColonyToGame') {
        return model.coloniesModel;
      }
      return this.game.colonies;
    },
    /** SelectColony pay-on-commit cancel (Build Colony std project). */
    colonyCancellable(): boolean {
      return this.colonyModel?.placementContext?.cancellable === true;
    },
    /** A task's nested SelectSpace, narrowed for the headless picker. */
    taskSpacePrompt() {
      const p = this.taskSpacePending?.spacePrompt;
      return p !== undefined && p.type === 'space' ? p : undefined;
    },
    /** Server-driven placement (SelectSpace) or a client-side board picker. */
    placementActive(): boolean {
      return this.playerView.waitingFor?.type === 'space' ||
        this.convertPlantsPending !== undefined ||
        this.taskSpacePending !== undefined;
    },
    placementCancellable(): boolean {
      if (this.convertPlantsPending !== undefined || this.taskSpacePending !== undefined) {
        return true; // client-side — nothing committed yet
      }
      return this.playerView.waitingFor?.placementContext?.cancellable === true;
    },
    /**
     * The active space prompt, narrowed to the SelectSpace model — the ONE
     * resolver for every placement read (title / per-cell illegal reason /
     * preview). It covers all three console placement sources: the server's
     * top-level SelectSpace, the client-side convert-plants picker and a task's
     * nested space option (the WGT ocean). `placementActive` counts the same
     * three, so anything derived from it must resolve them all — an earlier
     * split resolver missed the nested one and left that placement with a blank
     * title and no illegal reason.
     */
    placementSpaceModel() {
      const wf = this.playerView.waitingFor;
      if (wf?.type === 'space') {
        return wf;
      }
      return this.convertPlantsPrompt ?? this.taskSpacePrompt;
    },
    /**
     * The (cell, tile) the preview is for — the refetch key. '' → no preview
     * (not placing, no cell focused, or a custom SelectSpace with no kind).
     */
    cellPreviewKey(): string {
      const prompt = this.placementSpaceModel;
      const id = this.consoleState.boardSpaceId;
      if (!this.placementActive || prompt === undefined || id === undefined || prompt.placementType === undefined) {
        return '';
      }
      const cleared = (prompt.hiddenTiles ?? []).includes(id as SpaceId) ? 'c' : '';
      return `${id}|${prompt.placementType}|${prompt.tileType ?? ''}|${cleared}`;
    },
    placementTitle(): string {
      const t = this.placementSpaceModel?.title;
      if (t === undefined) {
        return '';
      }
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    selectedCellLegal(): boolean {
      const id = this.consoleState.boardSpaceId;
      if (id === undefined) {
        return false;
      }
      const el = document.querySelector(`[data_space_id="${id}"]`);
      return el !== null && el.classList.contains('board-space--available');
    },
    /** The SERVER's per-cell illegal reason (+M€ deficit), translated. */
    selectedCellIllegalReason(): string {
      const prompt = this.placementSpaceModel;
      const id = this.consoleState.boardSpaceId;
      if (prompt === undefined || id === undefined || this.selectedCellLegal) {
        return '';
      }
      const entry = prompt.illegalSpaces?.find((s) => s.spaceId === id);
      if (entry === undefined) {
        return '';
      }
      const reason = placementReasonToUnplayable(entry.reason, entry.deficit);
      return translateTextWithParams(reason.message, (reason.params ?? []).map(String));
    },
    // ── context panel ──────────────────────────────────────────────────
    contextMode(): 'placement' | 'cell' | 'track' | 'idle' {
      if (this.placementActive) {
        return 'placement';
      }
      if (this.consoleState.scaleInspecting && this.consoleState.trackMarker !== undefined) {
        return 'track';
      }
      if (this.consoleState.inspecting) {
        return 'cell';
      }
      return 'idle';
    },
    /** P27b: the curated LORE for the inspected special cell (Ganymede,
     *  volcanoes, Noctis…) — shown in INSPECTION, deliberately not during
     *  placement (it would crowd the task panel). */
    selectedCellLore(): {title: string, description: string} | undefined {
      const id = this.consoleState.boardSpaceId;
      if (id === undefined) {
        return undefined;
      }
      const info = getSpecialCellInfo(id as SpaceId, this.game.gameOptions.boardName);
      return info !== undefined ? {title: info.title, description: info.description} : undefined;
    },
    /** The focused TRACK marker's explanation — the SAME already-translated
     *  rows the premium ScaleTooltip shows (one source, no drift). */
    trackInfo(): ScaleTooltipContent | null {
      return this.consoleState.trackMarker !== undefined ? scaleTooltipState.content : null;
    },
    /** P27c: the owning SCALE's own hover-overview (name + current value +
     *  description — mirrors ArcScale.overviewContent), shown in the panel
     *  UNDER the focused bonus so the scale hover is never lost on pad. */
    trackScaleOverview(): {titleKey: string, nounKey: string, valueText: string, descriptionKey: string} | null {
      if (this.consoleState.trackMarker === undefined) {
        return null;
      }
      const accent = scaleTooltipState.content?.accent;
      if (accent === undefined) {
        return null;
      }
      const theme = ARC_SCALE_THEMES[accent];
      const value = accent === 'temperature' ? this.game.temperature :
        accent === 'oxygen' ? this.game.oxygenLevel :
          accent === 'venus' ? this.game.venusScaleLevel :
            this.game.oceans;
      return {
        titleKey: theme.title,
        nounKey: theme.noun,
        valueText: accent === 'oceans' ? `${value}/9` : `${value}${theme.unit}`,
        descriptionKey: theme.description,
      };
    },
    /** P27: the right home panel's strategic Milestones/Awards summaries. */
    homeMilestoneSummary(): HomeMaSummary {
      return buildHomeMaSummary('milestones', this.game.milestones, {
        myColor: this.thisPlayer.color,
        availableNow: this.claimableTitles(findMilestoneOptionPath(this.playerView.waitingFor)?.options),
        maxSlots: 3,
      });
    },
    homeAwardSummary(): HomeMaSummary {
      return buildHomeMaSummary('awards', this.game.awards, {
        myColor: this.thisPlayer.color,
        availableNow: this.claimableTitles(findAwardOptionPath(this.playerView.waitingFor, this.awardNames)?.options),
        maxSlots: 3,
      });
    },
    selectedCellInfo() {
      const info = boardInfoState.info;
      return info !== undefined && info.space === this.consoleState.boardSpaceId ? info : undefined;
    },
    /**
     * The placement preview, shown only for a LEGAL cell — mirrors the desktop
     * hover popover (an illegal cell shows the server's reason instead of the
     * consequences of a placement that cannot happen).
     */
    selectedCellPreview(): BoardPlacementPreview | undefined {
      return this.selectedCellLegal ? this.cellPreview : undefined;
    },
    cellInfoLoading(): boolean {
      return boardInfoState.loading && boardInfoState.spaceId === this.consoleState.boardSpaceId;
    },
    // ── hand ────────────────────────────────────────────────────────────
    // The WHOLE hand (playable-first), before the tag filter. Drives the
    // filter panel's option counts + the "All" total.
    handEntriesAll(): Array<ConsoleHandEntry> {
      const playable = new Set((this.playAction?.input.cards ?? [])
        .filter((c) => c.isDisabled !== true)
        .map((c) => c.name));
      const robots = new Set((this.thisPlayer.selfReplicatingRobotsCards ?? []).map((c) => c.name));
      const all: Array<CardModel> = [
        ...this.playerView.cardsInHand,
        ...(this.thisPlayer.selfReplicatingRobotsCards ?? []),
      ];
      const entries = all.map((card) => ({
        card,
        playable: playable.has(card.name),
        robot: robots.has(card.name),
      }));
      // Playable-first, stable within groups (CONSOLE_MODE_CONCEPT §8).
      return [
        ...entries.filter((e) => e.playable),
        ...entries.filter((e) => !e.playable),
      ];
    },
    // The VISIBLE hand — narrowed by the active tag filter (sale mode always
    // shows the whole hand). This is what the grid renders + what handIndex
    // indexes into, so play / inspect / command-bar all read the filtered set.
    /** The card whose HAND SLOT is held empty (Vue-managed, patch-proof):
     *  staged in the play composer, mid-return after cancel, or departing
     *  after a successful play (until the server removes it from the hand).
     *  One physical card never sits in two places at once. */
    stagedHandCard(): CardName | undefined {
      return this.pendingPlayCard?.cardName ?? this.returningPlayCard ?? this.departingPlayCard;
    },
    handEntries(): ReadonlyArray<ConsoleHandEntry> {
      if (this.consoleState.sale.active) {
        return this.handEntriesAll;
      }
      // MANDATORY hand SELECT (discard / reveal / place): the tag filter is
      // replaced by the "suitable only" filter. When on (default) a NARROWED
      // (conditional) prompt shows only the candidate cards; toggling it off
      // reveals the whole hand for context (non-candidates stay non-pickable).
      if (this.handSelectTaskActive) {
        if (this.consoleState.select.suitableOnly && this.handSelectFiltered) {
          const sel = new Set(this.handSelectSelectableNames);
          return this.handEntriesAll.filter((e) => sel.has(e.card.name));
        }
        return this.handEntriesAll;
      }
      return filterHandByTag(this.handEntriesAll, this.consoleState.handTagFilter);
    },
    // ── mandatory hand SELECT (server `handSelect` task) ──────────────────
    /** The active mandatory hand-select prompt (all candidates in hand), or
     *  undefined. Derived from the shell-section task + the raw waitingFor. */
    handSelectModel(): SelectCardModel | undefined {
      if (this.shellTask?.kind !== 'handSelect') {
        return undefined;
      }
      const wf = this.playerView.waitingFor;
      return wf?.type === 'card' ? (wf as SelectCardModel) : undefined;
    },
    /** True while the hand section is serving a mandatory hand-select. */
    handSelectTaskActive(): boolean {
      return this.handSelectModel !== undefined;
    },
    /** PURE derivation of the select facts (pickable set / single-vs-multi /
     *  conditional-subset / per-card «why not» reasons) — the i18n of a
     *  disabledReason is injected so the derivation module stays locale-free. */
    handSelectDerived(): HandSelectDerivation | undefined {
      const model = this.handSelectModel;
      if (model === undefined) {
        return undefined;
      }
      const handNames = this.handEntriesAll.map((e) => e.card.name);
      const translateReason = (r: string | Message | undefined): string =>
        r === undefined ? translateText('This card cannot be chosen here') :
          (typeof r === 'string' ? translateText(r) : translateMessage(r));
      return deriveHandSelect(model, handNames, translateReason);
    },
    /** The candidate (pickable) card names of the current hand-select. */
    handSelectSelectableNames(): ReadonlyArray<string> {
      return this.handSelectDerived?.selectable ?? [];
    },
    /** The prompt is a CONDITIONAL subset of the hand (there ARE non-pickable
     *  hand cards) — only then is the "suitable only" filter meaningful. */
    handSelectFiltered(): boolean {
      return this.handSelectDerived?.filtered ?? false;
    },
    /** min===max===1 → A submits the focused card in one press (no toggle). */
    handSelectSingle(): boolean {
      return this.handSelectDerived?.single ?? false;
    },
    /** Per-card reason (pre-translated) for a NON-selectable hand card. */
    handSelectReasons(): Record<string, string> {
      return this.handSelectDerived?.reasons ?? {};
    },
    /** The bundled select-mode state handed to the hand section (undefined when
     *  not in a hand-select). */
    handSelectProps(): ConsoleHandSelectMode | undefined {
      const d = this.handSelectDerived;
      if (d === undefined) {
        return undefined;
      }
      return {
        active: true,
        selectable: d.selectable,
        // Spread so the computed re-runs (and hands the section a fresh prop)
        // on every pick mutation — the section re-renders the pick bands.
        selected: [...this.consoleState.select.selected],
        reasons: d.reasons,
        single: d.single,
        filtered: d.filtered,
        suitableOnly: this.consoleState.select.suitableOnly,
      };
    },
    /** A hand-served shell task (play-from-hand OR mandatory hand-select) — the
     *  hand section is the surface, so the right stick may scroll the grid. */
    handShellServed(): boolean {
      const t = this.shellTask;
      return t?.kind === 'handSelect' ||
        (t?.kind === 'projectCard' && t.mode === 'playFromHand');
    },
    /** The current multi-select picks satisfy the prompt bounds → RT confirms. */
    handSelectPicksValid(): boolean {
      const model = this.handSelectModel;
      return model !== undefined && handSelectPicksValid(model, this.consoleState.select.selected.length);
    },
    // The tag-filter options for the panel (All + tags present in the hand).
    handTagFilterOptions(): Array<ConsoleTagFilterOption> {
      return buildConsoleTagFilters(this.handEntriesAll.map((e) => e.card), this.consoleState.handTagFilter);
    },
    // In sale mode every NON-hosted hand card is sellable (SRR-hosted cards
    // can't be sold) — the target set for L3 select-all / unselect-all.
    saleSellableNames(): ReadonlyArray<string> {
      return this.handEntries.filter((e) => !e.robot).map((e) => e.card.name);
    },
    saleAllSelected(): boolean {
      const names = this.saleSellableNames;
      return names.length > 0 && names.every((n) => this.consoleState.sale.selected.includes(n));
    },
    /** The turn/phase reason (i18n key) shown for a hand card that is rules-OK
     *  but not playable in this window — the honest alternative to a bare block
     *  when the server has no rules-reason (opponent's turn / mid-placement). */
    handSoftReason(): string {
      return this.placementActive ? 'Finish your current action first' : 'Not your turn to take any actions';
    },
    /** True when the hand grid is the surface the right stick should scroll —
     *  in the hand section with nothing layered on top (a play-confirm / task /
     *  reveal / fullscreen zoom would otherwise get scrolled through blindly). */
    handScrollActive(): boolean {
      return this.consoleState.section === 'hand' &&
        !isHandRevealEpisodeRunning() && // flight targets pin the layout
        this.pendingPlayCard === undefined &&
        this.hostTask === undefined &&
        // A hand-served shell task (play-from-hand / mandatory hand-select)
        // keeps the grid scrollable; any OTHER shell task means the hand is
        // not the focus surface.
        (this.shellTask === undefined || this.handShellServed) &&
        this.startTask === undefined &&
        this.consoleRevealMode === undefined;
    },
    // ── banner ──────────────────────────────────────────────────────────
    // P27: MANDATORY / critical states ONLY. The plain "your turn" reads
    // from the viewer's own top chip — the centre stays clear for the board.
    bannerText(): string {
      if (this.placementActive) {
        // P20: the inspect-all toggle owns the prompt while active.
        return translateText(this.consoleState.freeRoam ? 'Inspecting all cells' : 'Choose a location on the board');
      }
      if (this.consoleState.fallbackActive) {
        // A demoted premium/desktop scope owns the screen. It used to read a
        // flat «Ожидает решения» — but the prompt behind it is classified, and
        // the marked ones (Venus bonus / spend heat) are precisely the shapes
        // no console surface serves. Name the ask; fall back only when the
        // scope is a lifecycle flow with no pending prompt of its own.
        return this.deferAsk !== '' ? this.deferAsk : translateText('Awaiting decision');
      }
      // A shell-section task (play-from-hand / std project / colony pick):
      // the banner names the server's ask over the serving section.
      if (this.shellTaskActive) {
        return this.deferAsk;
      }
      return '';
    },
    confirmTitle(): string {
      return this.consoleState.confirm === 'pass' ? 'Pass for this generation' : 'Convert heat';
    },
    confirmBody(): string {
      return this.consoleState.confirm === 'pass' ?
        'You will take no more actions this generation.' :
        'The temperature is already at its maximum.';
    },
    /** T7 info parity: the desktop PassConfirmContent warning set. */
    confirmWarnings(): Array<string> {
      if (this.consoleState.confirm !== 'pass') {
        return [];
      }
      const warnings: Array<string> = [];
      const unused = this.actionsAvailableCount;
      if (unused > 0) {
        warnings.push(`${translateText('You still have unused available actions')}: ${unused}`);
      }
      if (this.tradeColonyContext !== undefined) {
        warnings.push(translateText('You still have a free trade fleet and can afford a colony trade'));
      }
      if (findConvertPlantsOption(this.playerView.waitingFor, this.thisPlayer.canConvertPlants === true) !== undefined) {
        warnings.push(translateText('You can still convert plants into greenery'));
      }
      if (findConvertHeatOption(this.playerView.waitingFor) !== undefined) {
        warnings.push(translateText('You can still convert heat into temperature'));
      }
      if (this.hydroActionAvailable) {
        warnings.push(translateText('You can still advance the Hydronetwork this generation'));
      }
      return warnings;
    },
    // ── colonies / hydro ───────────────────────────────────────────────
    tradeColonyContext() {
      return findTradeColonyContext(this.playerView.waitingFor);
    },
    tradeableColonyNames(): ReadonlyArray<string> {
      return this.tradeColonyContext?.colonies ?? [];
    },
    colonyTradeBlockReason(): string {
      if (this.tradeColonyContext === undefined) {
        return 'Not your turn to take any actions';
      }
      const selected = this.game.colonies[this.consoleState.colonyIndex];
      if (selected !== undefined && selected.visitor !== undefined) {
        return 'Already visited this generation';
      }
      return 'Unavailable right now';
    },
    /** The colony the X = «Осмотреть» overlay shows. Two sources: the colonies
     *  SECTION (←/→ pages the rail, A can trade) and the JOURNAL (a fixed
     *  colony by name, read-only — only B closes). */
    colonyInspectModel(): ColonyModel | undefined {
      if (this.journalColonyInspect !== undefined) {
        return this.game.colonies.find((c) => c.name === this.journalColonyInspect);
      }
      if (!this.colonyInspectOpen || this.consoleState.section !== 'colonies') {
        return undefined;
      }
      return this.coloniesForRail[this.consoleState.colonyIndex];
    },
    /** The inspect overlay is up (either source). */
    colonyInspectActive(): boolean {
      return this.journalColonyInspect !== undefined ||
        (this.colonyInspectOpen && this.consoleState.section === 'colonies');
    },
    /** A journal-opened inspect is READ-ONLY (no trade bridge — only B closes). */
    colonyInspectReadonly(): boolean {
      return this.journalColonyInspect !== undefined;
    },
    /** A = trade from inspect is offered only for a live-tradeable colony
     *  opened from the section (never the read-only journal dossier). */
    colonyInspectTradeable(): boolean {
      const model = this.colonyInspectModel;
      return !this.colonyInspectReadonly && model !== undefined &&
        this.tradeableColonyNames.includes(model.name);
    },
    pendingTradeColonyModel(): ColonyModel | undefined {
      const pending = this.pendingTradeColony;
      if (pending === undefined) {
        return undefined;
      }
      return this.game.colonies.find((c) => c.name === pending.colonyName);
    },
    hydroActionAvailable(): boolean {
      return findHydroActionPath(this.playerView.waitingFor) !== undefined;
    },
    /**
     * The delta-preview refetch scope. The preview mirrors state that moves
     * WITHIN a generation (track position / usedThisGeneration / energy /
     * tags), so a generation-only key went STALE the moment the viewer
     * advanced: the screen kept planning from the OLD position, and — since
     * the stale preview still claimed `usedThisGeneration: false` — the honest
     * «уже укрепляли в этом поколении» gate never fired and the screen blamed
     * «Сейчас не ваш ход» on a live turn. `gameAge` bumps on every logged
     * change and `undoCount` covers a rewind: together they are the honest
     * "the preview may have moved" signal (same reasoning as the effects
     * overlay's within-generation refetch).
     */
    hydroCacheKey(): string {
      return `${this.game.generation}:${this.game.gameAge}:${this.game.undoCount}`;
    },
    // ── the console-native journal (View — board home only) ────────────
    /** The journal surface renders (it replaces the right info panel). */
    journalPanelVisible(): boolean {
      return journalState.open && this.consoleState.section === 'board';
    },
    /**
     * A surface that NEEDS the pad / the board arrived — the journal yields
     * (placement, an active task / start scene / reveal). A DEFERRED task
     * (amber chip) leaves the player free, so the journal stays available.
     */
    journalHardBlocked(): boolean {
      return this.placementActive ||
        this.consoleRevealMode !== undefined ||
        (this.startTask !== undefined && !this.consoleState.task.deferred) ||
        (this.hostTask !== undefined && !this.consoleState.task.deferred && this.taskSpacePending === undefined) ||
        this.shellTaskActive;
    },
    /** VP visibility for the player viewed in Information Mode. */
    infoVpVisible(): boolean {
      const color = infoModeState.playerColor;
      return color === this.thisPlayer.color || this.game.gameOptions.showOtherPlayersVP === true;
    },
    // ── the RT / LT quick selectors (P27 — direct-input command layers) ──
    quickEntries(): Array<QuickEntry> {
      if (this.consoleState.quick === 'actions') {
        return buildRtQuickEntries({
          cardsPlayable: this.cardsPlayableCount,
          cardsTotal: this.cardsTotalCount,
          actionsAvailable: this.actionsAvailableCount,
          hasColonies: this.game.colonies.length > 0,
          hasTurmoil: this.game.gameOptions.expansions.turmoil === true,
          hasHydro: this.game.gameOptions.expansions.deltaProject === true,
        });
      }
      if (this.consoleState.quick === 'basics') {
        const wf = this.playerView.waitingFor;
        return buildLtQuickEntries({
          myTurn: this.myTurn,
          stdAvailable: this.standardProjectsAction !== undefined,
          endTurnAvailable: findEndTurnPath(wf) !== undefined,
          passAvailable: findPassPath(wf) !== undefined,
          convertPlantsAvailable: this.convertPlantsReady,
          convertHeatAvailable: this.convertHeatReady,
          plantsNeeded: this.thisPlayer.plantsNeededForGreenery,
          heatNeeded: this.thisPlayer.heatNeededForTemperature,
        });
      }
      return [];
    },
    quickTitle(): string {
      return this.consoleState.quick === 'actions' ? 'Actions' : 'Basic actions';
    },
    quickTrigger(): 'triggerR' | 'triggerL' {
      return this.consoleState.quick === 'actions' ? 'triggerR' : 'triggerL';
    },
    /** The premium Standard-Projects screen rows (Patent sale included). */
    stdProjectItems(): Array<StdProjectItem> {
      return buildStdProjectItems({
        cards: this.standardProjectsAction?.input.cards ?? [],
        myTurn: this.myTurn,
        myMegacredits: this.thisPlayer.megacredits,
        sellAvailable: findSellPatentsAction(this.playerView.waitingFor) !== undefined,
        cardsInHand: this.cardsTotalCount,
      });
    },
    /** B on the MANDATORY std-project prompt minimizes (amber chip), else closes. */
    stdBackLabel(): string {
      return this.shellTask?.kind === 'projectCard' && this.shellTask.mode === 'standardProject' ?
        'Minimize' : 'Close';
    },
    // ── sheets ──────────────────────────────────────────────────────────
    sheetTitle(): string {
      switch (this.consoleState.sheet) {
      case 'cardActions': return 'Card actions';
      case 'milestones': return 'Milestones';
      case 'awards': return 'Awards';
      case 'hydroPick':
        // Name the pick honestly: a used blue action (pos 7) vs an animal
        // target card (pos 9) — the mirror comes from the hydro section.
        return consoleHydroUi.pickKind === 'animal-target' ?
          'Choose a card for the animals' : 'Choose a used blue card action';
      case 'standardProjects': return 'Standard Projects';
      default: return '';
      }
    },
    /** P26: milestones/awards render on the dedicated premium screen. */
    maScreenKind(): ConsoleMaKind | undefined {
      return this.consoleState.sheet === 'milestones' || this.consoleState.sheet === 'awards' ?
        this.consoleState.sheet : undefined;
    },
    /** The premium screen's items — PURE derivation (consoleMaModel). */
    maScreenItems(): Array<ConsoleMaItem> {
      const kind = this.maScreenKind;
      if (kind === undefined) {
        return [];
      }
      const found = kind === 'milestones' ?
        findMilestoneOptionPath(this.playerView.waitingFor) :
        findAwardOptionPath(this.playerView.waitingFor, this.awardNames);
      const describe = (name: string): string => {
        try {
          return kind === 'milestones' ?
            getMilestone(name as MilestoneName).description :
            getAward(name as AwardName).description;
        } catch (err) {
          return '';
        }
      };
      return buildConsoleMaItems(kind, kind === 'milestones' ? this.game.milestones : this.game.awards, {
        myColor: this.thisPlayer.color,
        myTurn: this.myTurn,
        myMegacredits: this.thisPlayer.megacredits,
        availableNow: this.claimableTitles(found?.options),
        describe,
        maxSlots: 3,
        // Free sponsorship (Vitor) costs 0 — the wallet then reads «Бесплатно».
        nextCost: kind === 'milestones' ? 8 : (this.awardFundingActive ? 0 : this.awardCostValue),
        // Claimant label resolves the MarsBot seat to «Бот», never the raw name.
        resolveName: (color) => displayNameForColor(this.playerView.players, color),
      });
    },
    /** The NEXT award funding price as a number (8/14/20). */
    awardCostValue(): number {
      const funded = this.game.awards.filter((a) => a.playerName !== undefined && a.playerName !== '').length;
      return [8, 14, 20][funded] ?? 20;
    },
    /** The FREE award-funding prompt (Vitor's start action) is the pending
     *  shell task — the premium awards MA screen hosts it (desktop parity:
     *  the AwardsOverlay's free-sponsorship mode), never the generic list. */
    awardFundingActive(): boolean {
      return this.shellTask?.kind === 'awardFunding';
    },
    /** The LIVE item shown in the X → «Осмотреть» reader (recomputed from the
     *  dashboard, so its standings/availability stay fresh); undefined = the
     *  reader is closed or its item left the list. */
    maInspectItem(): ConsoleMaItem | undefined {
      return this.maInspect === undefined ? undefined :
        this.maScreenItems.find((it) => it.name === this.maInspect);
    },
    /** The premium MA confirm view — REBUILT from the live playerView on
     *  every commit, so a slot raced away while the modal is open honestly
     *  re-renders as blocked (never a dead submit). */
    maConfirmView(): MaConfirmView | undefined {
      const p = this.pendingMaConfirm;
      if (p === undefined) {
        return undefined;
      }
      const models = p.kind === 'milestone' ? this.game.milestones : this.game.awards;
      const source = models.find((m) => m.name === p.name);
      if (source === undefined) {
        return undefined;
      }
      const describe = (name: string): string => {
        try {
          return p.kind === 'milestone' ?
            getMilestone(name as MilestoneName).description :
            getAward(name as AwardName).description;
        } catch (err) {
          return '';
        }
      };
      const free = p.kind === 'award' && this.awardFundingActive;
      return buildMaConfirm(p.kind, source, models, {
        myColor: this.thisPlayer.color,
        myMegacredits: this.thisPlayer.megacredits,
        cost: p.kind === 'milestone' ? 8 : (free ? 0 : this.awardCostValue),
        free, // Vitor's free sponsorship — the premium confirm shows the free chip.
        maxSlots: 3,
        playerName: (c) => {
          const pl = this.playerView.players.find((candidate) => candidate.color === c);
          return pl !== undefined ? participantDisplayName(pl) : c;
        },
        describe,
      });
    },
    /** LIVE availability for the open MA confirm (waitingFor = the truth). */
    maConfirmAvailable(): boolean {
      const p = this.pendingMaConfirm;
      if (p === undefined) {
        return false;
      }
      const found = p.kind === 'milestone' ?
        findMilestoneOptionPath(this.playerView.waitingFor) :
        findAwardOptionPath(this.playerView.waitingFor, this.awardNames);
      return this.claimableTitles(found?.options).has(p.name);
    },
    /** The CONCRETE blocker when the open MA confirm went stale. */
    maConfirmBlockReason(): string {
      if (this.maConfirmAvailable) {
        return '';
      }
      const v = this.maConfirmView;
      if (v?.takenByOther !== undefined) {
        return v.kind === 'milestone' ? 'Already claimed' : 'Already funded';
      }
      if (!this.myTurn) {
        return 'Not your turn to take any actions';
      }
      if (v !== undefined && !v.free && this.thisPlayer.megacredits < v.cost) {
        return 'Not enough M€';
      }
      return 'Finish your current action first';
    },
    sheetRows(): Array<ConsoleSheetRow> {
      switch (this.consoleState.sheet) {
      case 'hydroPick':
        // P24: hydro stage 7/9 card pick — name + the card's own rule text
        // (manifest description) + the live resource count where relevant.
        return this.hydroPickCards.map((c) => ({
          key: c.name,
          title: c.name,
          sub: this.hydroPickDescription(c.name),
          meta: c.current !== undefined ? `${c.current}` : undefined,
          available: true,
        }));
      default:
        return [];
      }
    },
    // ── the command bar (the truth of the current context) ─────────────
    commandContext(): string {
      // «Разбор хода» review owns the screen — the bar reads as the review.
      if (this.botTurnReviewState.open) {
        return 'Turn review';
      }
      // Scale-focus hold: the modal is briefly gone while the board scale
      // animates — read as the board, not the (hidden) upcoming modal.
      if (this.govScaleFocusState.holding || this.govScaleFocusState.closing) {
        return 'Board';
      }
      if (this.consoleState.fallbackActive) {
        // Lifecycle-aware naming: the wrapped premium flows read as PART of
        // the console experience, not a generic "waiting" veil.
        switch (this.consoleState.fallbackScopeId) {
        case 'startGameFlow': return 'Start of the game';
        case 'endgame': return 'Game results';
        case 'drawReveal': return 'Cards';
        case 'dialog': return 'Card details';
        case 'colonies': return 'Trading';
        // An un-named scope = the desktop modal serving a prompt the console
        // has no surface for. The classification still names it (Venus bonus,
        // spend heat, an out-of-scope guard) — only a scope with NO prompt at
        // all falls through to the honest generic.
        default: return this.activeTaskSummary?.kickerKey ?? 'Awaiting decision';
        }
      }
      if (this.infoModeState.open) {
        return 'Information';
      }
      if (this.draftWaitActive) {
        return 'Waiting for draft cards';
      }
      if (this.consoleRevealMode !== undefined) {
        return 'Cards';
      }
      if (this.startTask !== undefined && !this.consoleState.task.deferred) {
        // The scene's own header already reads «СТАРТ ПАРТИИ» (kicker +
        // title) — repeating it in the bar is noise. The bar carries ONLY
        // the physical commands during the initial setup.
        return '';
      }
      if (this.govSupportActive && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        return 'Government Support';
      }
      if (this.hostTask !== undefined && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        // The bar names the KIND of decision the host is serving ("ОПЛАТА" /
        // "ДРАФТ"), not a generic "awaiting" — the host's own header carries
        // the full ask right under it.
        return this.activeTaskSummary?.kickerKey ?? 'Awaiting decision';
      }
      if (this.pendingPlayCard !== undefined) {
        return 'Play project card';
      }
      if (this.corpFirstActionOpen) {
        return 'First action';
      }
      if (this.pendingTradeColony !== undefined) {
        return 'Trade';
      }
      if (this.colonyInspectActive) {
        return 'Colony';
      }
      if (this.maInspectItem !== undefined) {
        return this.maInspectItem.name.replace(/[0-9]+$/, '');
      }
      if (this.pendingMaConfirm !== undefined) {
        return 'Confirmation';
      }
      if (this.consoleState.confirm !== undefined) {
        return 'Confirmation';
      }
      if (this.journalPanelVisible) {
        return 'Journal';
      }
      if (this.playedHeroHolds) {
        return 'Played';
      }
      if (this.playedTableVisible) {
        return consolePlayedUi.eventsOpen ? 'Played events' : 'Played';
      }
      if (this.consoleState.quick !== undefined) {
        return this.quickTitle;
      }
      if (this.consoleState.sheet !== undefined) {
        return this.sheetTitle;
      }
      if (this.placementActive) {
        return 'Tile placement';
      }
      if (this.consoleState.sale.active) {
        return 'Sell patents';
      }
      switch (this.consoleState.section) {
      case 'hand': return 'Hand';
      case 'colonies': return 'Trading';
      case 'hydro': return consoleHydroUi.confirmOpen ? 'Confirmation' : 'Mars Hydronetwork';
      default:
        if (this.consoleState.scaleInspecting) {
          return 'Scale inspection';
        }
        return this.consoleState.inspecting ? 'Board inspection' : 'Board';
      }
    },
    /** The played project card(s) shown this turn — X = Осмотреть карту. */
    reviewCardNames(): ReadonlyArray<CardName> {
      return this.botTurnReviewState.review?.cardNames ?? [];
    },
    reviewInspectable(): boolean {
      return this.botTurnReviewState.open && this.reviewCardNames.length > 0;
    },
    /** Every tile placed this turn — L3 = Показать на карте (ALL cells pulse). */
    reviewMapSpaces(): ReadonlyArray<SpaceId> {
      const out: Array<SpaceId> = [];
      for (const tile of this.botTurnReviewState.review?.tiles ?? []) {
        if (!out.includes(tile.spaceId)) {
          out.push(tile.spaceId);
        }
      }
      return out;
    },
    commands(): Array<ConsoleCommand> {
      // SYSTEM ALERT owns the pad — the bar advertises only the acknowledge.
      if (this.consoleSystemAlertState.current !== undefined) {
        return [{control: 'confirm', label: 'OK'}];
      }
      // TRADE-FLEET LAUNCH / HYDRO MARKER / BOARD CARD-BONUS / PATENT SALE /
      // TILE-PLACEMENT HERO / DECK DRAW: the animation owns the moment — the
      // pad is inert, the bar advertises nothing (bounded, plays itself out).
      if (isTradeFleetActive() || isHydroMarkerActive() || isBoardCardBonusActive() || isPatentSaleActive() || this.tilePlacementHolds || isDeckDrawActive()) {
        return [];
      }
      // The played-card hero scene: the bar goes quiet — the card is the
      // whole story (a press during the result beat quietly skips ahead).
      if (this.playedHeroHolds) {
        return [];
      }
      // «Разбор хода» review: X inspect the played card, L3 show on map, B
      // close. While the fullscreen viewer is up its OWN footer carries the
      // contract; during a peek B returns to the review.
      if (this.botTurnReviewState.open && this.consoleCardZoom.card === undefined) {
        if (this.botTurnReviewState.peek) {
          return [{control: 'back', label: 'Back'}];
        }
        const cmds: Array<ConsoleCommand> = [];
        if (this.reviewInspectable) {
          cmds.push({control: 'secondary', label: 'Inspect card'});
        }
        if (this.reviewMapSpaces.length > 0) {
          cmds.push({control: 'stickL', label: 'Show on map'});
        }
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
      }
      // PRESENTATION FLOW: the compact AI-turn card is the foreground item.
      // The card itself carries its X verb ON the card (the one visible
      // affordance); the bar only anchors B (one place per hint — §3.2).
      if (this.foregroundHoldingCard !== undefined && this.consoleCardZoom.card === undefined) {
        return [{control: 'back', label: 'Close'}];
      }
      // Scale-focus hold: an inert transition beat — no command hints.
      if (this.govScaleFocusState.holding || this.govScaleFocusState.closing) {
        return [];
      }
      if (this.consoleState.fallbackActive) {
        return [
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: 'Back'},
        ];
      }
      // LT INFORMATION MODE — the dashboard publishes its live contextual
      // contract (players / detail tabs / VP) through consolePanelUi; the
      // bar is its ONE hint surface (the old in-panel footer is gone).
      if (this.infoModeState.open) {
        return [...(panelCommands('infoMode') ?? [{control: 'inspect', label: 'Close'}])];
      }
      // A draft beat (hero landing / the research rise) owns the moment —
      // the bar advertises only the skip (any button skips).
      if (draftPickBeatActive() || riseSceneEngaged()) {
        return [{control: 'confirm', label: 'Skip'}];
      }
      if (this.draftWaitActive) {
        // Nothing to decide — the board stays inspectable while others pick.
        const cmds: Array<ConsoleCommand> = [];
        if (this.draftedCards.length > 0) {
          cmds.push({control: 'secondary', label: 'Inspect'});
        }
        cmds.push({control: 'inspect', label: 'Information'});
        return cmds;
      }
      if (this.consoleRevealMode !== undefined) {
        // The command bar is the SINGLE hint zone for the reveal (the overlay
        // has NO footer of its own — B never reads two conflicting labels).
        // Single-card drawn is fullscreen (the dialog covers the bar), so this
        // is the multi-card modal / result / viewer contract.
        const cmds: Array<ConsoleCommand> = [];
        if (this.consoleRevealMode === 'drawn') {
          const ev = currentRevealEvent();
          cmds.push({control: 'confirm', label: 'Take card'});
          cmds.push({control: 'secondary', label: 'Inspect'});
          if (ev?.source?.type === 'card') {
            cmds.push({control: 'stickL', label: 'Source'});
          }
          // R3 opens the discard pile of a conditional search (only when it
          // discarded something) — the sole way in, mirroring the pile's glyph.
          if (ev?.sequence?.some((step) => !step.matched) === true) {
            cmds.push({control: 'stickR', label: 'Discarded pile'});
          }
          cmds.push({control: 'back', label: 'Take all cards'});
        } else if (this.consoleRevealMode === 'viewer') {
          cmds.push({control: 'secondary', label: 'Inspect'});
          cmds.push({control: 'back', label: 'Close'});
        } else {
          cmds.push({control: 'confirm', label: 'OK'});
          cmds.push({control: 'secondary', label: 'Inspect'});
        }
        return cmds;
      }
      if (this.startTask !== undefined && !this.consoleState.task.deferred) {
        // The scene publishes its live contract (consoleStartUi — wizard step
        // vs. summary vs. ceremony: X inspects, RT continues / begins, etc.);
        // the bar mirrors it verbatim so it can never diverge from the buttons
        // (the old hard-coded list wrongly showed X = «Продолжить» and hid RT).
        return consoleStartUi.commands.length > 0 ?
          [...consoleStartUi.commands] :
          [
            {control: 'confirm', label: 'Select'},
            {control: 'secondary', label: 'Inspect'},
            {control: 'back', label: 'Minimize'},
          ];
      }
      if (this.govSupportActive && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        // The panel publishes its context-aware contract (consolePanelUi) —
        // the bar is the ONE hint surface (the in-panel footer is gone).
        return [...(panelCommands('govSupport') ?? [
          {control: 'confirm', label: 'Apply'},
          {control: 'back', label: 'Minimize'},
        ])];
      }
      if (this.productionLossActive && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        return [...(panelCommands('productionLoss') ?? [
          {control: 'confirm', label: '−1'},
          {control: 'bumperL', label: '+1'},
          {control: 'secondary', label: 'Confirm'},
          {control: 'back', label: 'Minimize'},
        ])];
      }
      if (this.hostTask !== undefined && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        // The task host publishes its live contract (browse / pick / lanes /
        // payment differ) — the bar renders it; no in-frame footer anymore.
        return [...(panelCommands('taskHost') ?? [
          {control: 'confirm', label: 'Select'},
          {control: 'secondary', label: 'Confirm'},
          {control: 'back', label: this.pendingClientPayment !== undefined ? 'Cancel' : 'Minimize'},
        ])];
      }
      if (this.pendingPlayCard !== undefined) {
        // The composer publishes its CONTEXTUAL controls (A plays / Y changes a
        // resolved choice / X inspects / LB·RB only where a value dials / LT
        // only when the payment is configurable) — the bar mirrors them
        // verbatim, so it can never diverge from what the buttons actually do.
        return consolePlayCardUi.commands.length > 0 ?
          [...consolePlayCardUi.commands] :
          [{control: 'confirm', label: 'Play now'}, {control: 'back', label: 'Cancel'}];
      }
      if (this.pendingTradeColony !== undefined) {
        // The composer mirrors its live state (consoleColoniesUi) — the bar
        // is the ONLY hint surface (no inline duplicates).
        if (consoleColoniesUi.composerSub === 'lanes') {
          return [
            {control: 'triggerR', label: 'Max'},
            {control: 'confirm', label: 'Done'},
            {control: 'back', label: 'Back'},
          ];
        }
        if (consoleColoniesUi.composerSub === 'list') {
          return [
            {control: 'confirm', label: 'Select'},
            {control: 'back', label: 'Back'},
          ];
        }
        return [
          {control: 'confirm', label: 'Select', enabled: consoleColoniesUi.composerEditable},
          {control: 'secondary', label: 'Confirm trade', enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
          {control: 'back', label: 'Cancel'},
        ];
      }
      if (this.colonyInspectActive) {
        const cmds: Array<ConsoleCommand> = [];
        // Section source: ←/→ pages colonies + A trades a live-tradeable one.
        if (this.journalColonyInspect === undefined && this.colonyInspectTradeable) {
          cmds.push({control: 'confirm', label: 'Trade'});
        }
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
      }
      if (this.maInspectItem !== undefined) {
        const cmds: Array<ConsoleCommand> = [];
        if (this.maInspectItem.available) {
          cmds.push({control: 'confirm', label: this.maInspectItem.kind === 'milestone' ? 'Claim' : 'Fund'});
        }
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
      }
      if (this.pendingMaConfirm !== undefined) {
        return [
          {control: 'confirm', label: this.pendingMaConfirm.kind === 'milestone' ? 'Claim' : 'Fund', enabled: this.maConfirmAvailable},
          {control: 'back', label: 'Cancel'},
        ];
      }
      if (this.consoleState.confirm !== undefined) {
        return [
          {control: 'confirm', label: 'Confirm'},
          {control: 'back', label: 'Cancel'},
        ];
      }
      if (this.journalPanelVisible) {
        // The journal's whole grammar, honest to the panel's live mirrors
        // (consoleJournalUi — the panel syncs, the bar never guesses).
        // The «Показать» map-peek holds the referenced cells lit until the
        // player presses — B restores the journal (matches the bot review).
        if (consoleJournalUi.peekActive) {
          return [{control: 'back', label: 'Back'}];
        }
        if (consoleJournalUi.inspectOpen) {
          return [{control: 'back', label: 'Close'}];
        }
        if (consoleJournalUi.filterOpen) {
          return [
            {control: 'confirm', label: 'Select'},
            {control: 'back', label: 'Close'},
          ];
        }
        // The panel's own header carries the LB/RB mode tabs, LT/RT
        // generation pager and R3 filter chip ON the controls they drive —
        // the bar advertises only the focused ENTRY's verbs (§3.2: one
        // place per hint; this is what ends the truncated 9-hint runs).
        const cmds: Array<ConsoleCommand> = [
          {control: 'confirm', label: consoleJournalUi.focusExpanded ? 'Collapse' : 'Details', enabled: consoleJournalUi.focusIsGroup},
          // P29: X = «Осмотреть» — cards, standard projects/actions, hydro,
          // map-only entries (never the too-narrow «Карта»).
          {control: 'secondary', label: 'Inspect', enabled: consoleJournalUi.focusInspectable},
        ];
        if (consoleJournalUi.focusHasSpace) {
          cmds.push({control: 'stickL', label: 'Show on map'});
        }
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
      }
      if (this.corpFirstActionOpen) {
        // The MANDATORY corp first-action modal: A takes the action, X
        // inspects the corporation, LB/RB switches corps (Merger), B only
        // DEFERS to the amber chip (never a dismissal).
        const cmds: Array<ConsoleCommand> = [
          {control: 'confirm', label: 'Take first action', highlight: true},
          {control: 'secondary', label: 'Inspect'},
        ];
        if (this.corpFirstActionNames.length > 1) {
          cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Corporation'});
        }
        cmds.push({control: 'back', label: 'Minimize'});
        return cmds;
      }
      if (this.playedTableVisible) {
        // «Разыграно»: the tableau grammar, honest to the overlay's live
        // mirrors (consolePlayedUi). Inside the events list B is a LOCAL
        // back (closes the list, never the tableau).
        if (consolePlayedUi.eventsOpen) {
          return [
            {control: 'secondary', label: 'Inspect'},
            {control: 'back', label: 'Back'},
          ];
        }
        const cmds: Array<ConsoleCommand> = [];
        cmds.push({control: 'secondary',
          label: consolePlayedUi.focusKind === 'events' ? 'Open' : 'Inspect',
          enabled: consolePlayedUi.focusKind !== 'none'});
        if (consolePlayedUi.canCyclePlayer) {
          cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Player'});
        }
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
      }
      if (this.consoleState.quick !== undefined) {
        // The cross's slots carry their OWN direction glyphs + labels on
        // screen — the bar anchors only the retreat (user rule: when the
        // verbs are visible in the open surface, the bar stays minimal).
        return [{control: 'back', label: 'Close'}];
      }
      if (this.consoleState.sheet === 'standardProjects') {
        // Every project row renders its own Ⓐ verb chip — the bar anchors
        // only the retreat.
        return [{control: 'back', label: this.stdBackLabel}];
      }
      if (this.consoleState.sheet === 'cardActions') {
        // The Action Center (and, while open, its composer) publishes the
        // live contract — grid browse vs branch/dial/payment states differ.
        return [...(panelCommands('actionComposer') ?? panelCommands('cardActions') ?? [
          {control: 'confirm', label: 'Perform'},
          {control: 'secondary', label: 'Inspect'},
          {control: 'back', label: 'Close'},
        ])];
      }
      if (this.maScreenKind !== undefined) {
        // P26: the hints mirror the REAL state — the verb is enabled only
        // when the focused item is actionable; bumpers switch the category.
        const focusedMa = this.maScreenItems[this.consoleState.sheetIndex];
        return [
          {control: 'confirm', label: this.maScreenKind === 'milestones' ? 'Claim' : 'Fund', enabled: focusedMa?.available === true},
          {control: 'secondary', label: 'Inspect'},
          {control: this.maScreenKind === 'milestones' ? 'bumperR' : 'bumperL',
            label: this.maScreenKind === 'milestones' ? 'Awards' : 'Milestones'},
          {control: 'back', label: this.awardFundingActive ? 'Minimize' : 'Close'},
        ];
      }
      if (this.consoleState.sheet !== undefined) {
        return [
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: this.consoleState.sheet === 'hydroPick' ? 'Back' : 'To the board'},
        ];
      }
      if (this.placementActive) {
        // P21: the placement footer is CONTEXT-ONLY and one-line by
        // contract — LT/RT keep working globally (Info / Actions) but
        // never occupy this bar; a NON-cancellable B is not an action, so
        // it is not a hint (the panel + the B-toast explain mandatory).
        const cmds: Array<{control: GlyphControl, label: string, enabled?: boolean}> = [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Place here', enabled: this.selectedCellLegal},
          {control: 'stickL', label: 'Next available'},
          {control: 'stickR', label: this.consoleState.freeRoam ? 'Available only' : 'All cells'},
        ];
        if (this.placementCancellable) {
          cmds.push({control: 'back', label: 'Cancel placement'});
        }
        return cmds;
      }
      if (this.consoleState.sale.active) {
        const n = this.consoleState.sale.selected.length;
        return [
          {control: 'confirm', label: 'Select'},
          {control: 'stickL', label: this.saleAllSelected ? 'Unselect all' : 'Select all'},
          {control: 'secondary', label: 'Inspect'},
          {control: 'triggerR', label: 'Sell', enabled: n > 0, badge: n, highlight: n > 0, priority: 1},
          {control: 'back', label: 'Cancel'},
        ];
      }
      // MANDATORY hand SELECT — the pick verbs (no tag filter; the "suitable
      // only" toggle takes LT), submit on A (single) / RT (multi), B minimizes.
      if (this.handSelectTaskActive && this.consoleState.section === 'hand') {
        const focusName = this.handEntries[this.consoleState.handIndex]?.card.name;
        const canPick = focusName !== undefined && this.handSelectSelectableNames.includes(focusName);
        const verb = this.handSelectModel?.buttonLabel || 'Select';
        const n = this.consoleState.select.selected.length;
        const cmds: Array<ConsoleCommand> = [];
        if (this.handSelectSingle) {
          cmds.push({control: 'confirm', label: verb, enabled: canPick});
        } else {
          cmds.push({control: 'confirm', label: 'Select / Deselect', enabled: canPick});
          cmds.push({control: 'triggerR', label: verb, enabled: this.handSelectPicksValid, badge: n, highlight: n > 0});
        }
        cmds.push({control: 'secondary', label: 'Inspect'});
        if (this.handSelectFiltered) {
          cmds.push({control: 'triggerL', label: this.consoleState.select.suitableOnly ? 'All cards' : 'Only suitable'});
        }
        cmds.push({control: 'back', label: 'Minimize'});
        return cmds;
      }
      if (this.consoleState.section === 'hand') {
        const playable = this.handEntries[this.consoleState.handIndex]?.playable === true;
        const cmds: Array<ConsoleCommand> = [
          {control: 'confirm', label: 'Play now', enabled: playable},
          {control: 'secondary', label: 'Inspect'},
        ];
        // The tag filter owns LT/RT (+ R3 reset) — shown only when there's a
        // real tag to filter by (more options than just "All"). This is the
        // ONE place these controls are advertised (no inline duplication).
        if (this.handTagFilterOptions.length > 1) {
          cmds.push({control: 'triggerL', control2: 'triggerR', label: 'Tag filter'});
          cmds.push({control: 'stickR', label: 'Reset filter', enabled: this.consoleState.handTagFilter !== 'all'});
        }
        cmds.push({control: 'back', label: this.shellTaskActive ? 'Minimize' : 'To the board'});
        return cmds;
      }
      if (this.consoleState.section === 'colonies') {
        // T4 pick mode: A = the server verb; B = cancel (marker) / minimize.
        const pick = this.colonyPick;
        if (pick !== undefined) {
          const selected = this.coloniesForRail[this.consoleState.colonyIndex];
          const pickable = selected !== undefined && pick.selectable.includes(selected.name);
          return [
            {control: 'confirm', label: pick.buttonLabel, enabled: pickable},
            {control: 'secondary', label: 'Inspect'},
            {control: 'back', label: this.colonyCancellable ? 'Cancel' : 'Minimize'},
          ];
        }
        const selected = this.game.colonies[this.consoleState.colonyIndex];
        const tradeable = selected !== undefined && this.tradeableColonyNames.includes(selected.name);
        return [
          {control: 'confirm', label: 'Trade', enabled: tradeable},
          {control: 'secondary', label: 'Inspect'},
          {control: 'back', label: 'To the board'},
        ];
      }
      if (this.consoleState.section === 'hydro') {
        // The console-native Hydronetwork grammar (full rework). The bar is
        // honest: enabled flags come from the section's live-model mirrors.
        if (consoleHydroUi.confirmOpen) {
          // The bonus is chosen on the plan screen; the confirm modal is a
          // read-only «before → after» beat — B goes back to change it.
          return [
            {control: 'confirm', label: 'Confirm'},
            {control: 'back', label: 'Back'},
          ];
        }
        if (consoleHydroUi.helpOpen) {
          return [{control: 'back', label: 'Close'}];
        }
        const cmds: Array<ConsoleCommand> = [{control: 'dpadH', label: 'Stages', priority: 2}];
        if (consoleHydroUi.bonusChoice) {
          cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Bonus'});
        }
        cmds.push(
          // The SHORT key on purpose (the old «Farthest available» was the
          // one atom that reliably truncated in the bay bar).
          {control: 'triggerR', label: 'Farthest stage'},
          consoleHydroUi.mode === 'details' ?
            {control: 'confirm', label: 'Back to plan'} :
            {control: 'confirm', label: 'Reinforce', enabled: consoleHydroUi.primaryEnabled},
          {control: 'secondary', label: 'Details'},
          {control: 'back', label: 'To the board'},
        );
        return cmds;
      }
      // P27b: SCALE INSPECTION MODE — the bonus ring, B/R3 exit.
      if (this.consoleState.scaleInspecting) {
        return [
          {control: 'inspect', label: 'Information'},
          {control: 'back', label: 'To the board'},
          {control: 'stickR', label: 'Exit'},
        ];
      }
      // P27: BOARD INSPECTION MODE — strict cell traversal, B/L3 exit.
      if (this.consoleState.inspecting) {
        return [
          {control: 'inspect', label: 'Information'},
          {control: 'back', label: 'To the board'},
          {control: 'stickL', label: 'Exit'},
        ];
      }
      // Board — the console home screen: the full stable command map.
      // The LB/RB hints moved INTO the right panel's Milestones/Awards
      // blocks (they sit right on the objects they open) — the freed slots
      // bring the Menu/System indicator back to the bar.
      return [
        {control: 'inspect', label: 'Information'},
        {control: 'secondary', label: 'Played'},
        {control: 'triggerR', label: 'Actions', badge: this.cardsPlayableCount + this.actionsAvailableCount,
          highlight: this.myTurn && (this.cardsPlayableCount + this.actionsAvailableCount) > 0},
        // The SHORT hint key on purpose — the footer's centre bay (hand
        // dock) splits this richest set across two zones, and the full
        // «Базовые действия» is the one atom that fits neither; the LT
        // quick wheel itself keeps the full 'Basic actions' title.
        {control: 'triggerL', label: 'Basics'},
        {control: 'stickL', label: 'Inspect board'},
        {control: 'stickR', label: 'Scale inspection'},
        {control: 'view', label: 'Log'},
      ];
    },
    // ── P15: the fullscreen viewer's select context ─────────────────────
    /** The TV rules panel shows for cards with structured information —
     *  and suppresses the floating callouts (one place for details). */
    zoomHasRules(): boolean {
      const name = this.consoleCardZoom.card?.name;
      return name !== undefined && cardHasRules(name);
    },
    /** The zoomed card's name typed as a CardName for the rules panel — only
     *  read behind `zoomHasRules`, which is true solely for real project cards
     *  (a bonus entry never resolves rules), so the cast is sound. */
    zoomRulesCardName(): CardName | undefined {
      const name = this.consoleCardZoom.card?.name;
      return name === undefined ? undefined : (name as CardName);
    },
    zoomSelectable(): boolean {
      return this.consoleCardZoom.select !== undefined && this.consoleCardZoom.card !== undefined;
    },
    zoomSelected(): boolean {
      const z = this.consoleCardZoom;
      return z.select !== undefined && z.card !== undefined && z.select.isSelected(z.card.name as CardName);
    },
    zoomSelectLabel(): string {
      return this.consoleCardZoom.select?.selectLabel ?? 'Select';
    },
    zoomDeselectLabel(): string {
      return this.consoleCardZoom.select?.deselectLabel ?? 'Deselect';
    },
    /** P17: the context action verb for the CURRENT card (play parity). */
    zoomActionLabel(): string | undefined {
      const z = this.consoleCardZoom;
      if (z.action === undefined || z.card === undefined) {
        return undefined;
      }
      // The action bridge is only ever attached to project-card lists, so the
      // ZoomCard name is genuinely a CardName here (never a bonus id).
      return z.action.labelFor(z.card.name as CardName);
    },
    /** The RECEIVE bridge A-verb (drawn-cards reveal), or undefined. */
    zoomReceiveLabel(): string | undefined {
      return this.consoleCardZoom.receive?.takeLabel;
    },
    /** The RECEIVE bridge RT-verb (take all), shown only when it exists. */
    zoomTakeAllLabel(): string | undefined {
      const r = this.consoleCardZoom.receive;
      return r?.takeAll !== undefined ? r.takeAllLabel : undefined;
    },
    /** The prominent ROLE status pill (single-card reveal), or undefined. */
    zoomStatusLabel(): string | undefined {
      return this.consoleCardZoom.statusLabel;
    },
    /** The L3 role-swap chip verb (single-card reveal), or undefined. */
    zoomSwapLabel(): string | undefined {
      return this.consoleCardZoom.swap?.label;
    },
    /** The OTHER card's name shown in the swap chip, or undefined. */
    zoomSwapOtherName(): CardName | undefined {
      return this.consoleCardZoom.swap?.otherName;
    },
    /** The «ПОЛУЧЕНО N» count in the viewer bar (single-card reveal). 0 = hidden. */
    zoomReceivedCount(): number {
      return this.consoleCardZoom.receivedCount;
    },
    /** The static source chip (non-card source, e.g. tile bonus), or undefined. */
    zoomSourceInfo(): {label: string, name: string} | undefined {
      return this.consoleCardZoom.sourceInfo;
    },
    /** P17: «why not» lines when the current card is NOT actionable. */
    zoomReasons(): ReadonlyArray<string> {
      const z = this.consoleCardZoom;
      if (z.action === undefined || z.card === undefined || this.zoomActionLabel !== undefined) {
        return [];
      }
      return z.action.reasonsFor(z.card.name as CardName);
    },
    /**
     * The ONE summary of whatever decision is pending — the shared source of
     * truth for the deferred chip, the command bar's context and (via its own
     * computed) the task host's kicker, so the three can never disagree.
     * `undefined` = nothing is pending on a console-owned surface.
     *
     * Precedence mirrors how the surfaces actually mount: the START SCENE
     * outranks a section task (it owns the whole screen), then the host task,
     * then the shell-section task.
     */
    activeTaskSummary(): ConsoleTaskSummary | undefined {
      // A CLIENT-built payment's prompt is NOT `waitingFor` (which still holds
      // the action menu) — hand the summary the real prompt + its source card.
      const client = this.pendingClientPayment;
      if (client !== undefined) {
        return consoleTaskSummary(CLIENT_PAYMENT_TASK, this.playerView, {
          prompt: client.input,
          sourceCard: client.cardName as CardName,
        });
      }
      // The RAW classification — deliberately NOT `hostTask ?? shellTask ??
      // startTask`: a prompt no console surface serves (a `composite` Venus
      // bonus / spend-heat, an `unknown` guard) is EXACTLY the case that used
      // to read «Ожидает решения» hardest, and it still deserves a name.
      const task = taskFor(this.playerView);
      return task === undefined ? undefined : consoleTaskSummary(task, this.playerView);
    },
    /** P15: the deferred-chip return verb, by what is actually pending. */
    deferReturnLabel(): string {
      return this.activeTaskSummary?.returnKey ?? 'Return to the decision';
    },
    /** The deferred chip's classification chip ("ОПЛАТА" / "ДРАФТ"). */
    deferKicker(): string {
      return translateText(this.activeTaskSummary?.kickerKey ?? 'Awaiting decision');
    },
    /** The deferred chip's CONCRETE ask ("Сбросьте 1 карту") — the whole point. */
    deferAsk(): string {
      const ask = this.activeTaskSummary?.ask;
      if (ask === undefined) {
        return '';
      }
      return typeof ask === 'string' ? translateText(ask) : translateMessage(ask);
    },
    /** The card that ASKS, when the server named one — rendered as a chip. */
    deferSourceCard(): CardName | undefined {
      return this.activeTaskSummary?.sourceCard;
    },
  },
  watch: {
    // Start-of-game setup reveal: while the ceremony is DEFERRED (B → inspect the
    // board), suspend the panel override so the left rail shows the REAL applied
    // state (not a mid-reveal staged snapshot). Restored on return.
    'consoleState.task.deferred'(deferred: boolean) {
      setStartSetupRevealSuspended(deferred);
    },
    // TRADE-FLEET LAUNCH lifecycle: the composer stays mounted (dissolved via
    // `--launching`) through the whole flight; the trade overlay only fully
    // CLOSES once the ship has DOCKED (success) or the flight was recalled
    // (error/stall). Both land here as active → false.
    'tradeFleetState.active'(active: boolean) {
      if (!active && this.pendingTradeColony !== undefined) {
        this.pendingTradeColony = undefined;
      }
    },
    // MARKER ADVANCE lifecycle: the hydro screen STAYS OPEN through the whole
    // glide; when the marker has locked in + the view committed (active →
    // false), reset the plan so the (now-used) screen shows a clean state.
    // The screen is never auto-closed (advancing leaves you in hydro).
    'hydroMarkerState.active'(active: boolean) {
      if (!active && this.consoleState.section === 'hydro') {
        resetHydroPlan();
      }
    },
    // A mandatory surface claimed the screen — the journal yields so the
    // task / placement / reveal is never hidden behind it (and never has
    // to share the pad with it).
    journalHardBlocked(now: boolean) {
      if (now && journalState.open) {
        journalState.open = false;
      }
      // The «Разыграно» overlay is the same family of board-home VIEW
      // surface — it yields to a mandatory surface identically. ONE honest
      // exception: while the hero scene owns it (the landing/result beat
      // completes first — the deferred close runs in the phase watcher
      // below). The corp first action has its OWN dedicated modal now, so a
      // stale browse always yields to a mandatory prompt.
      if (now && this.playedOpen && !this.playedHeroHolds) {
        this.closePlayedOverlay();
      }
    },
    /**
     * The played-card hero scene drives the SHELL-owned surfaces around the
     * flying card (the module owns the card; the shell owns the scenery):
     *  - 'lifting' → the composer closes UNDER the already-independent
     *    proxy (the hand slot stays held until the commit removes the card
     *    from the hand — the existing departingPlayCard mechanism);
     *  - 'failed'  → the play was refused: the composer is still open —
     *    re-arm its CTA so the player can retry or cancel;
     *  - 'idle'    → transaction over: run the deferred hard-block close
     *    for a manually-open table (suppressed mid-scene above).
     */
    'playedHeroState.phase'(phase: string) {
      if (phase === 'lifting') {
        const pending = this.pendingPlayCard;
        if (pending !== undefined) {
          this.clearDepartingPlayCard();
          this.departingPlayCard = pending.cardName;
          this.departingTimer = window.setTimeout(() => this.clearDepartingPlayCard(), 6000);
        }
        this.pendingPlayCard = undefined;
        closeConsoleLayers();
        this.consoleState.section = 'board';
        return;
      }
      if (phase === 'failed') {
        const composer = this.$refs.playConfirm as InstanceType<typeof ConsolePlayCardConfirm> | undefined;
        composer?.resetSubmitting?.();
        return;
      }
      if (phase === 'idle' && this.journalHardBlocked && this.playedOpen) {
        this.closePlayedOverlay();
      }
    },
    /*
     * PATENT-SALE hero staging (consolePatentSale): the sale UI stays up
     * while the picked cards flip + converge (they lift off LIVE hand
     * slots); the moment the stack ENTERS the terminal ('inserting') the
     * hand has physically given the cards away — close the sale mode and
     * return to the board, where the payout chip lands on the resource
     * rail. An error BEFORE this point ('failed' while the sale UI is
     * still open) leaves the player's picks intact — the scene unwinds
     * with zero trace and the WaitingFor alert explains.
     */
    'patentSaleState.phase'(phase: string) {
      if (phase === 'inserting') {
        closeConsoleLayers();
        this.consoleState.section = 'board';
      }
    },
    // PRESENTATION FLOW occupancy: while a console mandatory surface (task
    // host / start scene / gov-support panel) is actively presenting, hold a
    // 'mandatory-choice' lease so transient notifications queue instead of
    // floating over it. Deferred tasks release it (the board is inspectable).
    consoleMandatoryPresenting: {
      immediate: true,
      handler(presenting: boolean): void {
        if (presenting && this.releasePresentationLease === undefined) {
          this.releasePresentationLease = acquireForegroundLease('mandatory-choice');
        } else if (!presenting && this.releasePresentationLease !== undefined) {
          this.releasePresentationLease();
          this.releasePresentationLease = undefined;
        }
      },
    },
    // Leaving the colonies section closes the X-inspect dossier (and clears
    // the composer's command-bar mirror so stale hints can't linger).
    'consoleState.section'(section: string) {
      if (section !== 'colonies' && this.colonyInspectOpen) {
        this.colonyInspectOpen = false;
        resetConsoleColoniesUi();
      }
      // The hand-reveal presentation follows the section on EVERY path, not
      // just the choreographed ones. While an episode runs the director owns
      // these flips (it switches the section itself — skip). Otherwise:
      //  - hand opened by ANY route (a serving task, sale) → the dock pack
      //    reads "cards are in the hand" (the derived dockLiftedNames hides
      //    the visible entries' backs), no proxies;
      //  - hand closed by ANY route (sale cancel, a task replacing the
      //    section) → the pack returns; a stuck hold is impossible.
      if (!isHandRevealEpisodeRunning()) {
        if (section === 'hand' && handRevealState.phase === 'docked') {
          handRevealState.phase = 'open';
        } else if (section !== 'hand' && (handRevealState.phase === 'open' ||
            (handRevealState.phase === 'docked' && (handRevealState.holdSlots || handRevealState.dockExtraLift.length > 0)))) {
          // NOT 'opening'/'closing': those belong to a director episode in
          // its pre-install flush — resetting there would kill it mid-birth.
          resetHandReveal();
        }
      }
    },
    // The journal closing for ANY reason (mandatory surface, game switch)
    // takes its read-only colony dossier with it.
    journalPanelVisible(visible: boolean) {
      if (!visible && this.journalColonyInspect !== undefined) {
        this.closeColonyInspect();
      }
    },
    // A shell-section prompt (hand-select discard/reveal / colony / play-from-
    // hand / award) can arrive BEHIND a blocking foreground presentation (the
    // Pluto draw+discard shows the drawn-cards reveal first; a bot-turn holding
    // card / theater can also be up). While busy, the prompt-change watcher's
    // section-open is skipped (`shellTask` is held). When the LAST such
    // presentation clears, open the serving surface so the still-pending prompt
    // isn't left with NO surface (the stranded guard). Respects an explicit
    // defer (the player chose to inspect the board).
    consoleForegroundBusy(busy: boolean, wasBusy: boolean): void {
      if (wasBusy && !busy && !this.consoleState.task.deferred) {
        const task = taskFor(this.playerView);
        if (task !== undefined && SHELL_SECTION_KINDS.has(task.kind)) {
          this.openShellTaskSurface(task);
        }
      }
    },
    // The corp first-action confirm can surface AFTER a 'notification-only'
    // hold (the drawn-prelude card intake) releases — a path the reveal /
    // blocking `consoleForegroundBusy` transition above never covers. Make sure
    // the board is the section behind the modal whenever it finally opens, so a
    // later defer (B) reveals the board, not a stale hand / colonies view.
    corpFirstActionOpen(open: boolean): void {
      if (open) {
        this.consoleState.section = 'board';
      }
    },
    // P13: the fullscreen viewer is a native <dialog> - open it on the
    // undefined->defined transition only (navigation keeps it open).
    // The open CHOREOGRAPHY (consoleZoomMotion): the landing geometry is
    // measured on the still-CLOSED dialog, the premium lift flies a PROXY
    // on a normal fixed layer, and `showModal()` fires only at touchdown —
    // the dialog's first top-layer frame is the final, fully-visible
    // content (the compositor-safe shape; see consoleZoomMotion.ts header).
    // The chrome stays hidden (`--flight`, set BEFORE anything renders) and
    // fades in once the card has landed.
    'consoleCardZoom.card'(card: ZoomCard | undefined, prev: ZoomCard | undefined) {
      if (card !== undefined && prev === undefined) {
        this.zoomFlight = true;
        this.zoomClosing = false;
        // Mark opening SYNCHRONOUSLY here (not inside the async runZoomOpen):
        // from this instant the dialog is rendered-but-CLOSED and the landing
        // measure runs over several frames. A B press in that window must hit
        // the `zoomOpening` branch (→ cancel the open) — NOT the normal close
        // path, which would run playZoomClose over a display:none dialog (rect
        // 0×0 → dive → zoom.close() no-op → no 'close' event → zoomClosing
        // stuck true → "B closes only on the second press"). Set it before the
        // nextTick so no intent can land in the gap.
        this.zoomOpening = true;
        // The ideological focus moves to the fullscreen inspector: the
        // background focus chrome (slot rings, «A …» chips, the gliding
        // frame) goes quiet while the viewer is open.
        document.body.classList.add('con-zoom-open');
        // Bounded-retry open: on a heavy first-open frame (cold session — chunk
        // eval / style recalc in the same tick) the ref/$el may not be ready at
        // nextTick yet; a silent no-op here left the zoom state stuck open over
        // NOTHING (the "first fullscreen shows nothing" bug). Retry a few
        // frames; give up cleanly by rolling the zoom state back.
        const tryOpen = (attempt: number) => {
          if (this.consoleCardZoom.card === undefined) {
            return; // closed before it ever opened
          }
          const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
          const el = zoom?.$el as HTMLElement | undefined;
          if (zoom === undefined || el === undefined || typeof el.querySelector !== 'function') {
            if (attempt < 10) {
              requestAnimationFrame(() => tryOpen(attempt + 1));
            } else {
              this.onCardZoomClosed(); // never strand an open-but-empty zoom state
            }
            return;
          }
          void this.runZoomOpen(zoom);
        };
        void this.$nextTick(() => tryOpen(0));
      }
    },
    // The play composer owns the ideological focus while open — the hand's
    // focus chrome behind it goes quiet (same rule as the fullscreen zoom).
    pendingPlayCard(now: PendingPlayCard | undefined) {
      document.body.classList.toggle('con-play-modal-open', now !== undefined);
    },
    // A successfully played card leaves the hand with the server response —
    // release its held slot the moment it is genuinely gone (never a fake
    // return; the safety timer below covers a rejected play).
    handEntriesAll(entries: ReadonlyArray<ConsoleHandEntry>) {
      const name = this.departingPlayCard;
      if (name !== undefined && !entries.some((e) => e.card.name === name)) {
        this.clearDepartingPlayCard();
      }
    },
    /** The focused cell (or the placed tile) changed → refetch its preview. */
    cellPreviewKey: {
      immediate: true,
      handler(): void {
        this.loadCellPreview();
      },
    },
    // Server-driven placement pulls the player to the board (§10: a
    // board-target step changes the active section, the frame persists).
    placementActive(now: boolean) {
      if (now) {
        this.consoleState.section = 'board';
        closeConsoleLayers();
      }
      // P20: the R3 inspect-all toggle never outlives its placement.
      this.consoleState.freeRoam = false;
      // P27: placement OWNS the board navigation — the inspection modes
      // yield (entering AND leaving placement land on a clean board home).
      this.consoleState.inspecting = false;
      this.consoleState.scaleInspecting = false;
      this.consoleState.trackMarker = undefined;
    },
    /** The start ceremony fully resolved (the game began) — release any
     *  residual starting-cards delivery HOLD so the dock can never stick
     *  withheld. The normal flow already cleared it on the flight's landing;
     *  this is the belt-and-braces for a theoretical no-payment path. NOT
     *  fired on defer (`startTask` stays defined while the scene is deferred,
     *  so the hold correctly survives a board inspection). */
    startTask(now: ConsoleTask | undefined, was: ConsoleTask | undefined): void {
      // Never yank a LIVE flight — its own safety timeout reconciles it.
      if (now === undefined && was !== undefined && handDeliveryState.held.length > 0 && !isHandDeliveryActive()) {
        resetHandDelivery();
      }
    },
    // A fresh playerView: reconfigure the board-info fetcher (facts may have
    // changed), clamp transient indices to the fresh lists.
    playerView: {
      immediate: true,
      handler(newView: PlayerViewModel, oldView: PlayerViewModel | undefined) {
        // Draft tray: mark a live pick beat answered, reconcile optimistic
        // state, and ARM the research-rise scene on the draft→buy
        // transition (pre-flush — the buy frame mounts already knowing).
        observeDraftTransition(oldView, newView);
        // Government Support scale-focus gate: if the last action was a WGT
        // parameter raise, HOLD the next modal for a beat so the board scale
        // glide (+ top-HUD delta chip) is seen in one focused place. Snap to
        // the board so that feedback is actually visible during the hold.
        if (commitGovScaleFocus()) {
          this.consoleState.section = 'board';
          closeConsoleLayers();
        }
        configureBoardInfo({
          participantId: this.playerView.id,
          color: this.thisPlayer.color,
          boardName: this.game.gameOptions.boardName,
          players: this.playerView.players,
        });
        // `configureBoardInfo` just dropped the fact caches because the board
        // may have moved under us (an opponent's tile landed while we choose) —
        // the focused cell's preview is stale for the same reason. The key is
        // unchanged, so the watcher won't fire: refetch here.
        this.loadCellPreview();
        this.consoleState.handIndex = stepIndex(this.consoleState.handIndex, 0, this.handEntries.length);
        this.consoleState.sheetIndex = this.consoleState.sheet === 'standardProjects' ?
          stepIndex(this.consoleState.sheetIndex, 0, this.stdProjectItems.length) :
          stepSelectable(this.consoleState.sheetIndex, 0, this.sheetRows.map((r) => r.kind !== 'header'));
        this.consoleState.colonyIndex = stepIndex(this.consoleState.colonyIndex, 0, this.coloniesForRail.length);
        // The trade window closed externally → drop the stale payment modal.
        if (this.pendingTradeColony !== undefined && this.tradeColonyContext === undefined) {
          this.pendingTradeColony = undefined;
        }
        // A resolved convert-plants prompt (server moved on) drops the local picker.
        if (this.convertPlantsPending !== undefined &&
            findConvertPlantsOption(this.playerView.waitingFor, this.thisPlayer.canConvertPlants === true) === undefined) {
          this.convertPlantsPending = undefined;
        }
        // The sell-patents window closed externally → drop the stale sale mode.
        if (this.consoleState.sale.active && findSellPatentsAction(this.playerView.waitingFor) === undefined) {
          this.consoleState.sale.active = false;
          this.consoleState.sale.selected = [];
        }
        // T6: the server cleared the reveal result → the ack marker is stale.
        if (this.playerView.lastReveal === undefined && this.dismissedRevealKey !== '') {
          this.dismissedRevealKey = '';
        }
        // CTS: a NEW prompt identity resets the defer + stale nested picks.
        const wf = this.playerView.waitingFor;
        const key = wf === undefined ? '' : `${wf.type}|${inputTitleText(wf.title) ?? ''}`;
        if (key !== this.lastTaskKey) {
          this.lastTaskKey = key;
          this.consoleState.task.deferred = false;
          this.taskSpacePending = undefined;
          // A client payment built for a prompt that moved on is stale.
          this.pendingClientPayment = undefined;
          // Same for the native play confirm (its playAction path moved on).
          this.pendingPlayCard = undefined;
          // A NEW prompt resets the mandatory hand-SELECT picks + filter (they
          // survive a defer→resume of the SAME prompt, but never leak across
          // prompts). Cleared here rather than in closeConsoleLayers so the
          // defer→resume path keeps a multi-select's accumulated picks.
          this.consoleState.select.selected = [];
          this.consoleState.select.suitableOnly = true;
          // The card-action center is a VOLUNTARY surface — if the top prompt
          // moved off the action menu (a sub-prompt / another player's turn),
          // close it so its dedicated surface can't overlap another one. It
          // survives a 'first action' → 'next action' menu change (still the
          // action menu — same task kind).
          if (this.consoleState.sheet === 'cardActions' && taskFor(this.playerView)?.kind !== 'actionMenu') {
            this.consoleState.sheet = undefined;
            this.consoleState.sheetIndex = 0;
          }
          // A shell-section task (T3/T4) auto-opens its serving surface.
          const shellTask = this.shellTask;
          if (shellTask !== undefined) {
            this.openShellTaskSurface(shellTask);
          }
        }
      },
    },
  },
  methods: {
    /** Titles of the inner SelectOptions — the server's claimable/fundable set. */
    /**
     * Fetch the focused cell's placement preview (the same bounded read-only
     * `/api/game/board-cell-preview?kind=` the desktop hover popover uses, so
     * the two surfaces can never diverge). Only `boardCellPreview` carries the
     * placement CONSEQUENCES — the M€ cost, the Ares hazard-adjacency "reduce a
     * production" penalty, the adjacency bonuses and who else receives them;
     * `boardCellInfo` (the hover facts the panel already had) describes the cell
     * as it stands and would never mention them.
     */
    loadCellPreview(): void {
      const token = ++this.cellPreviewToken;
      const prompt = this.placementSpaceModel;
      const id = this.consoleState.boardSpaceId;
      if (this.cellPreviewKey === '' || prompt?.placementType === undefined || id === undefined) {
        this.cellPreview = undefined;
        return;
      }
      const spaceId = id as SpaceId;
      const cleared = (prompt.hiddenTiles ?? []).includes(spaceId);
      fetchBoardCellPreview(spaceId, prompt.placementType, cleared, prompt.tileType).then((preview) => {
        if (token === this.cellPreviewToken) {
          this.cellPreview = preview;
        }
      });
    },
    claimableTitles(options: ReadonlyArray<PlayerInputModel> | undefined): Set<string> {
      const set = new Set<string>();
      for (const o of options ?? []) {
        if (o.type === 'option') {
          const t = inputTitleText(o.title);
          if (t !== undefined) {
            set.add(t);
          }
        }
      }
      return set;
    },
    // ── input ────────────────────────────────────────────────────────────
    handleIntent(intent: GamepadIntent): boolean {
      // Foundation: presses resolve to SEMANTIC actions (consoleActionOf) —
      // the shell compares `action`, never raw button names (undefined for
      // nav/scroll/release and the screen-specific STICKS, which stay raw).
      const action = consoleActionOf(intent);
      // SYSTEM ALERT owns the pad ABOVE everything (even mid-hero): a server
      // error / rejected input must always be acknowledgeable — A or B
      // dismisses it (running its callback + advancing the queue); every
      // other intent is swallowed so nothing acts under it.
      if (isConsoleAlertActive()) {
        if (intent.kind === 'press' && (action === 'primary' || action === 'back')) {
          dismissConsoleAlert();
        }
        return true;
      }
      // TRADE-FLEET LAUNCH / HYDRO MARKER / BOARD CARD-BONUS / PATENT SALE /
      // TILE-PLACEMENT HERO own the moment: while the ship flies, the marker
      // glides, the bonus cover travels, the terminal takes the sold cards
      // in or the tile is landing on Mars, the pad is inert (nothing can act
      // on an action that's mid-commit). Bounded by the animations' safety
      // timers, so it can never stick. The placement's `armed` beat does NOT
      // gate (nothing visual yet — mirrors the played hero's armed policy),
      // and the pick itself can't double-fire (the arm claims the moment).
      if (isTradeFleetActive() || isHydroMarkerActive() || isBoardCardBonusActive() || isPatentSaleActive() || tilePlacementHolding()) {
        return true;
      }
      // DECK DRAW: the deck is dealing itself out — a bounded, self-playing
      // scene the player only watches. The reveal it hands off to takes the
      // pad back the moment its cards are released.
      if (isDeckDrawActive()) {
        return true;
      }
      // PLAYED-CARD HERO owns the moment. While the submit is in flight
      // (`armed`) the composer stays visible: only B (cancel — it would
      // corrupt the transaction) is swallowed, the rest routes normally
      // (the composer's own latch already blocks a second A). From the
      // first visual beat on, input is inert — except during the result
      // beat, where any press ACCELERATES the close (never a cancel).
      if (isPlayedHeroActive()) {
        if (this.playedHeroState.phase === 'armed') {
          if (action === 'back') {
            return true;
          }
        } else {
          if (intent.kind === 'press' && this.playedHeroState.phase === 'showing-result') {
            skipPlayedHeroResult();
          }
          return true;
        }
      }
      // «Разбор хода» review owns the pad while open (a read-only foreground
      // item — the presentation flow holds every other surface). B closes, X
      // inspects the played card, L3 shows the placed tile on the board, the
      // right stick scrolls; during a peek any press returns to the review.
      if (this.botTurnReviewState.open) {
        // The fullscreen viewer opened via X owns the pad while it is up. It now
        // hosts BONUS cards too (the union CardZoomModal), so there is no
        // separate bonus-inspect surface to close first.
        if (this.consoleCardZoom.card !== undefined) {
          return this.handleZoomIntent(intent);
        }
        if (this.botTurnReviewState.peek) {
          if (intent.kind === 'press') {
            setBotReviewPeek(false);
          }
          return true;
        }
        if (intent.kind === 'scroll') {
          this.scrollReviewFeed(intent.dy);
          return true;
        }
        if (intent.kind === 'press') {
          if (action === 'inspect') {
            this.inspectReviewCard();
          } else if (action === 'prevSection') {
            // LB → previous bot turn (edge notice at the first archived turn).
            stepBotTurnReview(-1);
          } else if (action === 'nextSection') {
            // RB → next bot turn (edge notice if the next turn is not made yet).
            stepBotTurnReview(1);
          } else if (intent.button === 'stickL' && this.reviewMapSpaces.length > 0) {
            setBotReviewPeek(true, this.reviewMapSpaces);
          } else if (action === 'back') {
            closeBotTurnReview();
          }
        }
        return true;
      }
      // Government Support scale-focus hold: a brief, inert transition beat
      // while the board scale animates — swallow input so nothing fires under
      // the (about-to-open) next modal.
      if (this.govScaleFocusState.holding || this.govScaleFocusState.closing) {
        return true;
      }
      // P15: OUR fullscreen card viewer owns the pad completely while open
      // (it is a native <dialog>, so this must run BEFORE the resolveScope
      // fallback branch — the generic dialog scope would otherwise trap the
      // input in the DOM engine, where LB/RB browsing and the A select
      // context don't exist). Other (fallback-owned) dialogs never set
      // consoleCardZoom, so they still route to the DOM engine below.
      if (this.consoleCardZoom.card !== undefined) {
        return this.handleZoomIntent(intent);
      }
      // PRESENTATION FLOW: ANY visible console notification is dismissable with
      // B — a global rule (every toast advertises «B Закрыть» on the card). The
      // FLOW-HOLDING card (the compact AI-turn card) additionally OWNS the beat:
      // X opens the «Разбор хода» review and A is swallowed so nothing submits
      // under it. An ordinary toast claims ONLY B — navigation / actions pass
      // through to the surface beneath, so the board/section stays usable.
      const topCard = this.topNotification;
      if (topCard !== undefined && this.consoleCardZoom.card === undefined) {
        if (action === 'back') {
          dismissNotification(topCard.id);
          return true;
        }
        if (topCard.holdsFlow === true) {
          if (action === 'inspect' && topCard.botTurnKey !== undefined) {
            openBotTurnReviewByKey(topCard.botTurnKey);
            return true;
          }
          if (action === 'primary') {
            return true;
          }
        }
      }
      // A fallback surface (mandatory modal / dialog / draft / endgame…) on
      // top → the demoted DOM focus engine drives it. (The Hydronetwork is
      // fully console-native now — ConsoleHydroSection mounts no fallback
      // scope root, so its intents flow through the normal console chain
      // below and land in handleSectionIntent.)
      const scope = resolveScope();
      const fallback = scope !== undefined;
      this.consoleState.fallbackActive = fallback;
      this.consoleState.fallbackScopeId = scope?.def.id ?? '';
      if (fallback) {
        return false;
      }
      if (intent.kind === 'release') {
        return true;
      }
      if (intent.kind === 'scroll') {
        // P17: the RIGHT STICK scrolls the active console scroll container
        // (the fallback for rare overflow — console layouts fit by design
        // and never show scrollbar chrome). Fallback-owned surfaces keep
        // the DOM engine's own right-stick scroll (they return earlier).
        if (this.consoleState.sheet === 'cardActions') {
          (this.$refs.cardActions as InstanceType<typeof ConsoleCardActions> | undefined)?.handleIntent(intent);
          return true;
        }
        this.scrollActiveConsole(intent.dy);
        return true;
      }
      // The premium MA reader (X → «Осмотреть») owns the pad while open: it
      // sits above the dashboard, so no background command leaks. A sponsors /
      // claims when the item is available (hands off to the confirm), B or X
      // close back to the dashboard; the right stick scrolls the long text.
      if (this.maInspectItem !== undefined) {
        if (intent.kind === 'press') {
          if (action === 'back' || action === 'inspect') {
            this.closeMaInspect();
          } else if (action === 'primary') {
            this.confirmMaInspect();
          }
        }
        return true;
      }
      // Information Mode owns everything while open (read-only).
      if (this.infoModeState.open) {
        this.handleInfoIntent(intent);
        return true;
      }
      // The console-native journal owns the pad while open (board home
      // only; a mandatory surface closes it via the journalHardBlocked
      // watcher). View/B close; B inside the filter popover / inspect
      // card / map-peek is a LOCAL back (closes that layer, never the
      // journal); everything else is the panel's own grammar
      // (A / X / L3 / LB·RB / LT·RT / Y / d-pad — see ConsoleJournalPanel).
      // A READ-ONLY colony dossier opened from the journal (X on a colony row)
      // owns the pad ABOVE the journal — B/X closes it back to the journal.
      if (this.journalColonyInspect !== undefined) {
        this.handleColonyInspectIntent(intent);
        return true;
      }
      if (this.journalPanelVisible) {
        const journalLocalBack = consoleJournalUi.filterOpen || consoleJournalUi.inspectOpen || consoleJournalUi.peekActive;
        if (action === 'reset' || (action === 'back' && !journalLocalBack)) {
          this.closeJournal();
          return true;
        }
        // P27b consistency: Y = Information Mode on EVERY surface. The
        // journal's own player-filter moved to R3 (stickR) — so Y here opens
        // Info Mode like everywhere else. Suppressed while a local journal
        // layer (filter popover / inspect card / map peek) owns the pad, so Y
        // there still resolves that layer through the panel's own grammar.
        if (action === 'fullscreen' && !journalLocalBack) {
          this.toggleInfoMode();
          return true;
        }
        const panel = this.$refs.journalPanel as InstanceType<typeof ConsoleJournalPanel> | undefined;
        panel?.handleIntent(intent);
        return true;
      }
      // The MANDATORY corp first-action modal owns the pad while open
      // (before the «Разыграно» browse below — a stale browse yields to it
      // via the hard-block watcher). Y keeps the global Info Mode meaning.
      if (this.corpFirstActionOpen) {
        if (action === 'fullscreen') {
          this.toggleInfoMode();
          return true;
        }
        const confirm = this.$refs.corpFirstConfirm as InstanceType<typeof ConsoleCorpFirstActionConfirm> | undefined;
        confirm?.handleIntent(intent);
        return true;
      }
      // «Разыграно» (X from the board home) owns the pad while open — a
      // VIEW surface (journal family): B closes (inside the events list B is
      // a LOCAL back), X/A inspect, LB/RB cycle the viewed player, Y keeps
      // the global Info Mode meaning. A mandatory surface closes it via the
      // journalHardBlocked watcher — same yield rule as the journal.
      if (this.playedTableVisible) {
        if (action === 'fullscreen') {
          this.toggleInfoMode();
          return true;
        }
        const overlay = this.$refs.playedOverlay as InstanceType<typeof ConsolePlayedOverlay> | undefined;
        overlay?.handleIntent(intent);
        return true;
      }
      // P27b: Y = INFORMATION MODE — ALWAYS (every surface's former local
      // Y verb moved to RT: task-host MAX/confirm, start-scene Continue,
      // reveal Take-all, sale-mode Sell, hydro Farthest). The two small
      // confirm dialogs keep the pad focused on the decision itself.
      if (action === 'fullscreen' &&
          this.consoleState.confirm === undefined && !this.consoleCardActionsUi.confirmOpen) {
        this.toggleInfoMode();
        return true;
      }
      // DRAFT PICK BEAT (the hero flying into the tray): the host may have
      // already unmounted under it (the response was draftWait) — swallow
      // everything, a press skips to the final state. Bounded (<1s).
      if (draftPickBeatActive()) {
        if (intent.kind === 'press') {
          skipDraftPickBeat();
        }
        return true;
      }
      // Draft re-pick WAITING: the pad is otherwise idle (the board stays
      // inspectable, Info Mode is handled above). X opens the read-only
      // drafted-cards viewer; every other button falls through to the board.
      if (this.draftWaitActive && action === 'inspect' && this.draftedCards.length > 0) {
        // Opened from the count chip (no card tiles on screen) → TEXTUAL.
        openConsoleCardZoom([...this.draftedCards], 0, undefined, undefined, {origin: {kind: 'textual'}});
        return true;
      }
      // CTS T6: a reveal overlay owns input while visible (drawn cards
      // must be taken; the result / viewer close on any confirm).
      if (this.consoleRevealMode !== undefined) {
        const overlay = this.$refs.revealOverlay as InstanceType<typeof ConsoleRevealOverlay> | undefined;
        overlay?.handleIntent(intent);
        return true;
      }
      // CTS T5: the start scene owns input while it serves (B inside =
      // wizard back-step, else defer). The journal is a BOARD-HOME surface
      // now — no View-peek here (safe context policy).
      if (this.startTask !== undefined && !this.consoleState.task.deferred) {
        const scene = this.$refs.startScene as InstanceType<typeof ConsoleStartScene> | undefined;
        scene?.handleIntent(intent);
        return true;
      }
      // Government Support (WGT) — the dedicated briefing panel owns input
      // while it serves (before the generic host branch below).
      if (this.govSupportActive && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        const panel = this.$refs.govSupport as InstanceType<typeof ConsoleGovernmentSupport> | undefined;
        panel?.handleIntent(intent);
        return true;
      }
      // Production loss (Ares hazard) — the dedicated surface owns input while
      // it serves (before the generic host branch below).
      if (this.productionLossActive && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        const panel = this.$refs.prodLoss as InstanceType<typeof ConsoleProductionLoss> | undefined;
        panel?.handleIntent(intent);
        return true;
      }
      // CTS T1–T3: the task host owns input while it serves (B inside the
      // host = defer-to-board / cancel, handled there). No View-peek.
      if (this.hostTask !== undefined && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        const host = this.$refs.taskHost as InstanceType<typeof ConsoleTaskHost> | undefined;
        host?.handleIntent(intent);
        return true;
      }
      // T8: the native play-card confirm owns input while open.
      if (this.pendingPlayCard !== undefined) {
        const confirm = this.$refs.playConfirm as InstanceType<typeof ConsolePlayCardConfirm> | undefined;
        confirm?.handleIntent(intent);
        return true;
      }
      // T8: the native colony-trade composer owns input while open.
      if (this.pendingTradeColony !== undefined) {
        const confirm = this.$refs.tradeConfirm as InstanceType<typeof ConsoleColonyTradeConfirm> | undefined;
        confirm?.handleIntent(intent);
        return true;
      }
      // X = «Осмотреть»: the colony dossier owns the pad while open.
      if (this.colonyInspectOpen) {
        this.handleColonyInspectIntent(intent);
        return true;
      }
      // The premium Milestones/Awards confirm owns input while open (A =
      // confirm, B = cancel — no background command leakage). A vanished
      // model (game switched in-session) drops the pending confirm cleanly.
      if (this.pendingMaConfirm !== undefined) {
        if (this.maConfirmView === undefined) {
          this.pendingMaConfirm = undefined;
        } else {
          const confirm = this.$refs.maConfirm as InstanceType<typeof ConsoleMaConfirm> | undefined;
          confirm?.handleIntent(intent);
          return true;
        }
      }
      if (this.consoleState.confirm !== undefined) {
        if (action === 'primary') {
          this.acceptConfirm();
        } else if (action === 'back') {
          this.consoleState.confirm = undefined;
        }
        return true;
      }
      if (this.consoleState.quick !== undefined) {
        this.handleQuickIntent(intent);
        return true;
      }
      // The console-native card-action center owns the pad while it serves.
      if (this.consoleState.sheet === 'cardActions') {
        const panel = this.$refs.cardActions as InstanceType<typeof ConsoleCardActions> | undefined;
        panel?.handleIntent(intent);
        return true;
      }
      if (this.consoleState.sheet !== undefined) {
        this.handleSheetIntent(intent);
        return true;
      }
      return this.handleSectionIntent(intent);
    },
    // ── Information Mode (read-only; never submits; Y toggles — P27) ────
    toggleInfoMode(): void {
      if (this.infoModeState.open) {
        const snap = closeInfoMode();
        if (snap !== undefined) {
          // The snapshot's cell-focus flag maps onto INSPECTION MODE (P27).
          this.consoleState.inspecting = restoreConsoleSnapshot(snap);
        }
        // A placement prompt that arrived WHILE Info Mode was open must not
        // be restored away from — the board is the mandatory surface.
        if (this.placementActive) {
          this.consoleState.section = 'board';
          this.consoleState.inspecting = false;
        }
        return;
      }
      this.consoleState.quick = undefined;
      openInfoMode(this.thisPlayer.color, this.consoleState.inspecting);
    },
    handleInfoIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        // d-pad up/down scrolls the visible info surface.
        const scroller = document.querySelector<HTMLElement>('.con-info__scroll');
        if (scroller !== null && (intent.dir === 'up' || intent.dir === 'down')) {
          scroller.scrollBy({top: intent.dir === 'down' ? 140 : -140, behavior: 'smooth'});
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      const colors = this.playerView.players.map((p) => p.color);
      // The MarsBot participant swaps the hotkey details: its printed board /
      // played pile / bonus piles replace the human extras/actions/effects
      // (which don't exist for the Automa). Same buttons, same flow.
      const viewedIsBot = this.playerView.players
        .find((p) => p.color === this.infoModeState.playerColor)?.isMarsBot === true;
      switch (consoleActionOf(intent)) {
      case 'prevSection':
        this.infoModeState.playerColor = cyclePlayer(colors, this.infoModeState.playerColor, -1);
        this.reconcileInfoDetail();
        break;
      case 'nextSection':
        this.infoModeState.playerColor = cyclePlayer(colors, this.infoModeState.playerColor, 1);
        this.reconcileInfoDetail();
        break;
      case 'inspect':
        this.openInfoDetail(viewedIsBot ? 'botBoard' : 'extras');
        break;
      case 'prevTab':
        // P27: the actions detail moved from Y to LT (Y toggles Info Mode).
        this.openInfoDetail(viewedIsBot ? 'botPlayed' : 'actions');
        break;
      case 'fullscreen':
        this.toggleInfoMode(); // Y closes — the same key that opened it
        break;
      case 'nextTab':
        this.openInfoDetail(viewedIsBot ? 'botBonus' : 'effects');
        break;
      case 'primary':
        if (this.infoModeState.detail === undefined) {
          if (this.infoVpVisible) {
            this.openInfoDetail('vp');
          } else {
            this.showNotice('Score is hidden until the end of the game');
          }
        }
        break;
      case 'back':
        if (this.infoModeState.detail !== undefined) {
          this.infoModeState.detail = undefined;
        } else {
          this.toggleInfoMode(); // dashboard root: B = close + restore
        }
        break;
      default:
        break;
      }
    },
    openInfoDetail(detail: InfoDetail): void {
      this.infoModeState.detail = this.infoModeState.detail === detail ? undefined : detail;
    },
    // Cycling between a human and the MarsBot participant: a detail that
    // exists only for the OTHER participant type falls back to the dashboard
    // ('vp' is shared and survives the switch).
    reconcileInfoDetail(): void {
      const detail = this.infoModeState.detail;
      if (detail === undefined || detail === 'vp') {
        return;
      }
      const isBot = this.playerView.players
        .find((p) => p.color === this.infoModeState.playerColor)?.isMarsBot === true;
      const botOnly = detail === 'botBoard' || detail === 'botPlayed' || detail === 'botBonus';
      if (botOnly !== isBot) {
        this.infoModeState.detail = undefined;
      }
    },
    // ── P27: the quick selectors — DIRECT input, no aiming ───────────────
    handleQuickIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        // A d-pad direction ACTIVATES its slot immediately.
        this.activateQuickSlot(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary':
        this.activateQuickSlot('center');
        break;
      case 'back':
        this.consoleState.quick = undefined;
        break;
      case 'nextTab':
        // The opening trigger toggles its own selector closed.
        this.consoleState.quick = this.consoleState.quick === 'actions' ? undefined : 'actions';
        break;
      case 'prevTab':
        this.consoleState.quick = this.consoleState.quick === 'basics' ? undefined : 'basics';
        break;
      default:
        break;
      }
    },
    activateQuickSlot(slot: QuickSlot): void {
      const entry = this.quickEntries.find((e) => e.slot === slot);
      if (entry === undefined) {
        return;
      }
      if (!entry.available) {
        this.showNotice(entry.reason !== '' ? entry.reason : 'Unavailable right now');
        return;
      }
      const quick = this.consoleState.quick;
      this.consoleState.quick = undefined;
      if (quick === 'actions') {
        this.executeRtEntry(entry.id);
      } else if (quick === 'basics') {
        this.executeLtEntry(entry.id);
      }
    },
    // ── the dock ↔ hand-overlay REVEAL episodes (handRevealDirector) ──────
    /**
     * OPEN the hand as a physical reveal: mount the overlay HELD (slots
     * invisible, chrome arriving), measure both ends in one read batch,
     * then fly one proxy per card dock → slot (backs flip to faces around
     * the edge, centre-out fan). Reopening mid-close reverses the running
     * gather instead. Falls back to the plain section switch when the
     * geometry isn't measurable.
     */
    async openHandWithReveal(): Promise<void> {
      if (isHandRevealEpisodeRunning()) {
        if (handRevealState.phase === 'closing') {
          reverseHandReveal(); // reopen mid-close: same timeline, back to open
        }
        return;
      }
      if (this.consoleState.section === 'hand') {
        return;
      }
      this.deferShellTask(); // navigation-away (the RT path's contract)
      // Phase BEFORE the section flip: the section watcher must see a
      // director-owned transition, not an untracked open (which would lift
      // the dock instantly and skip the choreography).
      handRevealState.phase = 'opening';
      handRevealState.holdSlots = true;
      this.consoleState.section = 'hand';
      await this.$nextTick();
      // Two frames: the grid measures itself + ensureSelectedVisible seats
      // the scroll — the targets below are the settled layout.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined))));
      const section = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
      const dock = this.$refs.handDock as InstanceType<typeof ConsoleHandDock> | undefined;
      const t = section?.transitionTargets() ?? {pairs: [], scrollTop: 0};
      const sources = dock?.sourceRects(t.pairs.map((p) => p.name)) ?? new Map<string, RevealRect>();
      const pairs: Array<RevealPair> = [];
      for (const p of t.pairs) {
        const source = sources.get(p.name);
        if (source !== undefined) {
          pairs.push({name: p.name, source, target: p.rect, visible: p.visible});
        }
      }
      await runHandOpenEpisode(pairs);
    },
    /**
     * CLOSE the hand as the physical gather: measure the LIVE slot rects
     * (current scroll/filter), fly the cards back into the dock's exact
     * back positions (faces flip back-side-out on approach). `B` mid-open
     * never reaches here — handleSectionBack reverses the running episode.
     */
    async closeHandWithReveal(): Promise<void> {
      if (isHandRevealEpisodeRunning() || this.consoleState.section !== 'hand') {
        return;
      }
      const section = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
      const dock = this.$refs.handDock as InstanceType<typeof ConsoleHandDock> | undefined;
      const t = section?.transitionTargets() ?? {pairs: [], scrollTop: 0};
      const sources = dock?.sourceRects(t.pairs.map((p) => p.name)) ?? new Map<string, RevealRect>();
      const pairs: Array<RevealPair> = [];
      for (const p of t.pairs) {
        const source = sources.get(p.name);
        if (source !== undefined) {
          pairs.push({name: p.name, source, target: p.rect, visible: p.visible});
        }
      }
      await runHandCloseEpisode(pairs, t.scrollTop);
    },
    /** The hand dock (footer bay) clicked — the mouse/touch entry point to
     *  the hand. Same path as RT → КАРТЫ; guarded to the calm board home
     *  (the dock is `live` there — every overlay state is non-interactive). */
    onHandDockOpen(): void {
      if (this.consoleState.section !== 'board' || this.placementActive ||
          this.consoleState.quick !== undefined || this.consoleState.confirm !== undefined) {
        return;
      }
      this.executeRtEntry('cards');
    },
    /** RT — action categories (navigation surfaces; inspection always allowed). */
    executeRtEntry(id: string): void {
      switch (id) {
      case 'cards':
        void this.openHandWithReveal();
        break;
      case 'cardActions':
        this.openSheet('cardActions');
        break;
      case 'trading':
        this.deferShellTask();
        this.consoleState.section = 'colonies';
        this.consoleState.colonyIndex = stepIndex(this.consoleState.colonyIndex, 0, this.coloniesForRail.length);
        break;
      case 'hydro':
        this.deferShellTask();
        resetHydroPlan();
        this.consoleState.section = 'hydro';
        break;
      default:
        break;
      }
    },
    /** LT — basic actions (turn-ending SUBMITS are guarded during placement). */
    executeLtEntry(id: string): void {
      const wf = this.playerView.waitingFor;
      const guardPlacement = (): boolean => {
        if (this.placementActive) {
          this.showNotice('Finish your current action first');
          return true;
        }
        return false;
      };
      switch (id) {
      case 'standardProjects':
        // Opening is inspection-safe; item ACTIVATION is guarded in
        // activateStdItem (mirrors the sheet-row placement guard).
        this.openSheet('standardProjects');
        break;
      case 'skipTurn': {
        if (guardPlacement()) {
          return;
        }
        const path = findEndTurnPath(wf);
        if (path !== undefined) {
          closeConsoleLayers();
          this.submit(optionResponseForPath(path));
        }
        break;
      }
      case 'pass':
        if (guardPlacement()) {
          return;
        }
        // Pass ALWAYS confirms (warnings carried over from the desktop).
        this.consoleState.confirm = 'pass';
        break;
      case 'convertHeat': {
        if (guardPlacement()) {
          return;
        }
        const found = findConvertHeatOption(wf);
        if (found === undefined) {
          return;
        }
        if ((found.option.warnings ?? []).includes('maxtemp')) {
          this.consoleState.confirm = 'convertHeat';
        } else {
          this.submit(optionResponseForPath(found.path));
        }
        break;
      }
      case 'convertPlants': {
        if (guardPlacement()) {
          return;
        }
        const found = findConvertPlantsOption(wf, this.thisPlayer.canConvertPlants === true);
        if (found === undefined) {
          return;
        }
        this.convertPlantsPending = found;
        closeConsoleLayers();
        this.consoleState.section = 'board';
        break;
      }
      default:
        break;
      }
    },
    handleSheetIntent(intent: GamepadIntent): void {
      // P27: the Standard-Projects premium screen — 2-column GRID nav,
      // A = use / sell, B = close (MANDATORY prompt → defer to the chip).
      if (this.consoleState.sheet === 'standardProjects') {
        if (intent.kind === 'nav') {
          this.consoleState.sheetIndex = stepGrid(
            this.consoleState.sheetIndex, intent.dir, this.stdProjectItems.length, 2);
          return;
        }
        if (intent.kind === 'press') {
          const a = consoleActionOf(intent);
          if (a === 'primary') {
            this.activateStdItem(this.stdProjectItems[this.consoleState.sheetIndex]);
          } else if (a === 'back') {
            this.deferShellTask();
            this.consoleState.sheet = undefined;
            this.consoleState.section = 'board';
          }
        }
        return;
      }
      // P26: the milestones/awards premium screen — 2-column GRID nav
      // (every card focusable), A = claim/fund, LB/RB = category switch.
      if (this.maScreenKind !== undefined) {
        if (intent.kind === 'nav') {
          this.consoleState.sheetIndex = stepGrid(
            this.consoleState.sheetIndex, intent.dir, this.maScreenItems.length, 2);
          return;
        }
        if (intent.kind === 'press') {
          switch (consoleActionOf(intent)) {
          case 'primary':
            this.activateMaItem(this.maScreenItems[this.consoleState.sheetIndex]);
            break;
          case 'inspect':
            // X → «Осмотреть»: open the full-text reader for the focused item.
            this.openMaInspect(this.maScreenItems[this.consoleState.sheetIndex]);
            break;
          case 'prevSection':
            if (this.maScreenKind !== 'milestones') {
              this.openSheet('milestones');
            }
            break;
          case 'nextSection':
            if (this.maScreenKind !== 'awards') {
              this.openSheet('awards');
            }
            break;
          case 'back':
            // A pending free-award-funding task DEFERS to the amber chip
            // (mandatory → inspect the board, then return); a no-op when the
            // player is merely viewing the M/A dashboard.
            this.deferShellTask();
            this.consoleState.sheet = undefined;
            this.consoleState.section = 'board';
            break;
          default:
            break;
          }
        }
        return;
      }
      if (intent.kind === 'nav') {
        const step = intent.dir === 'down' ? 1 : intent.dir === 'up' ? -1 : 0;
        if (step !== 0) {
          this.consoleState.sheetIndex = stepSelectable(
            this.consoleState.sheetIndex, step, this.sheetRows.map((r) => r.kind !== 'header'));
        }
        return;
      }
      if (intent.kind === 'press') {
        const a = consoleActionOf(intent);
        if (a === 'primary') {
          this.activateSheetRow(this.sheetRows[this.consoleState.sheetIndex]);
        } else if (a === 'back') {
          // B: back to the board. The hydro card pick returns to the HYDRO
          // screen (its plan is still being composed there), never to the board.
          const stayInSection = this.consoleState.sheet === 'hydroPick';
          this.consoleState.sheet = undefined;
          if (!stayInSection) {
            this.consoleState.section = 'board';
          }
        }
      }
    },
    handleSectionIntent(intent: GamepadIntent): boolean {
      // The console-native Hydronetwork screen owns its whole grammar
      // (stages / bonus / CTA / confirm modal / help). Y = Info Mode stays
      // global (handled before this point); the journal is board-home only.
      if (this.consoleState.section === 'hydro') {
        const hydro = this.$refs.hydroSection as InstanceType<typeof ConsoleHydroSection> | undefined;
        hydro?.handleIntent(intent);
        return true;
      }
      if (intent.kind === 'nav') {
        this.handleSectionNav(intent.dir);
        return true;
      }
      if (intent.kind !== 'press') {
        return true;
      }
      const onBoard = this.consoleState.section === 'board';
      // Stick-clicks are screen-specific (no base semantic action, by design) —
      // they carry board/hand context verbs, handled raw before the semantic switch.
      if (intent.button === 'stickL') {
        // P20: L3 = next AVAILABLE placement target during placement;
        // P27: on the board home L3 toggles BOARD INSPECTION MODE. In the hand's
        // sell-patents multi-select L3 = SELECT ALL / UNSELECT ALL.
        if (this.placementActive && this.consoleState.section === 'board') {
          this.handleNextJump();
        } else if (onBoard) {
          this.toggleInspection();
        } else if (this.consoleState.section === 'hand' && this.consoleState.sale.active) {
          this.toggleSelectAllSale();
        }
        return true;
      }
      if (intent.button === 'stickR') {
        // P20: R3 toggles INSPECT-ALL cells during placement (was the LT
        // hold) — persistent, announced, and reflected in every hint row.
        // P27b: on the board home R3 = SCALE INSPECTION (the cursor walks
        // the track bonuses in a circle). In the hand (non-sale) R3 RESETS the
        // tag filter to "All" (the right-stick AXIS still scrolls the grid).
        if (this.placementActive && this.consoleState.section === 'board') {
          this.consoleState.freeRoam = !this.consoleState.freeRoam;
          this.showNotice(this.consoleState.freeRoam ? 'Inspecting all cells' : 'Available cells only');
        } else if (onBoard) {
          this.toggleScaleInspect();
        } else if (this.consoleState.section === 'hand' && !this.consoleState.sale.active && !this.handSelectTaskActive) {
          this.resetHandFilter();
        }
        return true;
      }
      switch (consoleActionOf(intent)) {
      case 'prevSection':
        // Stable board semantics: LB = Milestones (viewable any time).
        // (P29c: the temporary board-scale tuner is gone — ×1.05 shipped
        // as the compiled default in ConsoleBoardSection.)
        if (onBoard) {
          this.openSheet('milestones');
        }
        return true;
      case 'nextSection':
        if (onBoard) {
          this.openSheet('awards');
        }
        return true;
      case 'reset':
        this.toggleJournal();
        return true;
      case 'nextTab':
        // P27: RT = the action-category QUICK SELECTOR from the board home
        // (P20: including during placement — inspection is always allowed). In
        // the hand: sale mode CONFIRMS the sale; otherwise RT cycles the tag
        // filter to the NEXT tag (the old "next playable" was retired — the
        // grid + tag filter make a linear jump redundant).
        if (onBoard) {
          this.openQuick('actions');
          return true;
        }
        if (this.consoleState.section === 'hand') {
          if (this.consoleState.sale.active) {
            this.confirmSale();
          } else if (this.handSelectTaskActive) {
            // Multi-select: RT confirms the picked set (a single-card pick
            // submits directly on A, so RT is inert there).
            if (!this.handSelectSingle) {
              this.confirmHandSelect();
            }
          } else {
            this.cycleHandFilter(1);
          }
        }
        return true;
      case 'prevTab':
        // P27: LT = the basic-actions QUICK SELECTOR (board home only). In the
        // hand: SELECT mode toggles the "suitable only" filter; otherwise LT
        // cycles the tag filter to the PREVIOUS tag.
        if (onBoard) {
          this.openQuick('basics');
        } else if (this.consoleState.section === 'hand' && this.handSelectTaskActive) {
          this.toggleSuitableOnly();
        } else if (this.consoleState.section === 'hand' && !this.consoleState.sale.active) {
          this.cycleHandFilter(-1);
        }
        return true;
      case 'primary':
        this.handleSectionConfirm();
        return true;
      case 'inspect':
        // P13 global rule: X reads the focused object fullscreen — in the
        // colonies section X = «Осмотреть» (the full colony dossier); on the
        // BOARD HOME (the main field context only — never mid-placement,
        // never inside an inspection mode) X opens the «Разыграно» tableau.
        if (this.consoleState.section === 'hand') {
          this.zoomHandCard();
        } else if (this.consoleState.section === 'colonies') {
          this.toggleColonyInspect();
        } else if (onBoard && !this.placementActive &&
            !this.consoleState.inspecting && !this.consoleState.scaleInspecting) {
          this.openPlayedOverlay();
        }
        return true;
      case 'back':
        this.handleSectionBack();
        return true;
      default:
        return true;
      }
    },
    handleSectionNav(dir: NavDirection): void {
      // Mid-reveal the hand grid must not scroll (the flight targets were
      // measured against the current layout) — nav resumes at touchdown.
      // A FILTER episode never blocks input: snap it and navigate at once.
      if (this.consoleState.section === 'hand' && isHandRevealEpisodeRunning()) {
        if (runningHandRevealKind() !== 'filter') {
          return;
        }
        finishInstant();
      }
      if (this.consoleState.section === 'board') {
        const board = this.$refs.boardSection as InstanceType<typeof ConsoleBoardSection> | undefined;
        // P27b: SCALE INSPECTION — the cursor walks the bonus ring
        // (left/up = counter-clockwise, right/down = clockwise, wraps).
        if (this.consoleState.scaleInspecting && !this.placementActive) {
          board?.stepTrackMarker(dir === 'right' || dir === 'down' ? 1 : -1);
          return;
        }
        // P27: the cells are NOT part of the normal command loop — the
        // board navigates only in INSPECTION mode or during a placement.
        if (!this.placementActive && !this.consoleState.inspecting) {
          this.showNotice('Press L3 to inspect the board');
          return;
        }
        board?.move(dir);
        return;
      }
      if (this.consoleState.section === 'colonies') {
        // 2D stepping over the premium tile grid (layout-aware columns).
        const count = this.coloniesForRail.length;
        const cols = colonyGridCols(colonyGridLayout(count, this.colonyPick !== undefined), count);
        this.consoleState.colonyIndex = colonyNavStep(dir, this.consoleState.colonyIndex, count, cols);
        return;
      }
      // Hand grid: delegate to the section — it owns the plan (cols), the
      // column-preserving up/down stepping, and keep-selected-visible.
      const hand = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
      hand?.move(dir);
    },
    /** L3 during placement: focus the next available cell on the board. */
    handleNextJump(): void {
      if (this.consoleState.section === 'board' && this.placementActive) {
        const board = this.$refs.boardSection as InstanceType<typeof ConsoleBoardSection> | undefined;
        board?.nextAvailable();
      }
    },
    handleSectionConfirm(): void {
      // No accidental card activation under the flying reveal proxies —
      // A waits out the episode (navigation stays free; B reverses).
      // A FILTER episode never blocks input: snap it and confirm at once.
      if (this.consoleState.section === 'hand' && isHandRevealEpisodeRunning()) {
        if (runningHandRevealKind() !== 'filter') {
          return;
        }
        finishInstant();
      }
      if (this.consoleState.section === 'board') {
        const board = this.$refs.boardSection as InstanceType<typeof ConsoleBoardSection> | undefined;
        if (this.placementActive) {
          // Card-bonus cell: ARM the lift BEFORE activating — the click
          // submits synchronously through the headless SelectSpace, and the
          // cover must separate at submit time (never after the response).
          const targetId = this.consoleState.boardSpaceId;
          if (targetId !== undefined) {
            this.armBoardBonusIfCardCell(targetId);
          }
          if (board?.activate() !== true) {
            this.showNotice('Cannot place here');
            // Nothing was submitted — recall the armed cover instantly.
            abortBoardCardBonus('instant');
          }
        }
        return;
      }
      if (this.consoleState.section === 'colonies') {
        // T4: a server SelectColony pick outranks the trade flow.
        const pick = this.colonyPick;
        if (pick !== undefined) {
          const selected = this.coloniesForRail[this.consoleState.colonyIndex];
          if (selected === undefined) {
            return;
          }
          if (!pick.selectable.includes(selected.name)) {
            const reason = pick.reasons[selected.name];
            this.showNotice(reason !== undefined && reason !== '' ? reason : 'Unavailable right now');
            return;
          }
          closeConsoleLayers();
          this.consoleState.task.deferred = false;
          this.submit(colonyResponse(selected.name));
          // The SelectColony pick is a ONE-SHOT action (Aridor's extra tile,
          // a build target …). Leave the colonies screen so the player isn't
          // stranded wondering whether another colony choice is expected — the
          // server's next prompt (or the turn) drives what surfaces next.
          this.consoleState.section = 'board';
          return;
        }
        if (this.placementActive) {
          this.showNotice('Finish your current action first');
          return;
        }
        this.tryOpenColonyTrade();
        return;
      }
      const entry = this.handEntries[this.consoleState.handIndex];
      if (entry === undefined) {
        return;
      }
      // Sale mode: A toggles the pick (shared with the fullscreen viewer).
      if (this.consoleState.sale.active) {
        this.toggleSalePick(entry.card.name);
        return;
      }
      // MANDATORY hand SELECT: A submits the focused card (single) or toggles
      // the pick (multi). A non-candidate card explains WHY it can't be picked.
      if (this.handSelectTaskActive) {
        this.handSelectPress(entry.card.name);
        return;
      }
      if (!entry.playable) {
        // The fork's rule: NEVER a bare "Нельзя разыграть" — always the reason.
        this.showNotice(this.handBlockedNotice(entry));
        return;
      }
      // P20: inspection is free; STARTING a play mid-placement is not.
      if (this.placementActive) {
        this.showNotice('Finish your current action first');
        return;
      }
      this.openPlayCardFromHand(entry.card.name);
    },
    /** B: one calm step toward the console home (never destructive). */
    handleSectionBack(): void {
      // A running hand-reveal episode owns B: mid-open it REVERSES the same
      // timeline from its current progress (the hard `B` contract);
      // mid-close it's swallowed — the gather is already going home.
      // A FILTER episode is a state answer, not a journey: snap it and let
      // B proceed to the normal close below (responsiveness rule).
      if (isHandRevealEpisodeRunning()) {
        if (runningHandRevealKind() === 'filter') {
          finishInstant();
        } else {
          if (handRevealState.phase === 'opening') {
            reverseHandReveal();
          }
          return;
        }
      }
      // A DEFERRED task comes back first — B toggles task ↔ board-inspect.
      if ((this.hostTask !== undefined || this.shellTask !== undefined || this.startTask !== undefined) && this.consoleState.task.deferred) {
        this.consoleState.task.deferred = false;
        // A shell-section task re-opens its serving surface (the start
        // scene and the host re-render via their own v-if).
        if (this.hostTask === undefined && this.startTask === undefined && this.shellTask !== undefined) {
          this.openShellTaskSurface(this.shellTask);
        }
        return;
      }
      if (this.consoleState.sale.active) {
        this.consoleState.sale.active = false;
        this.consoleState.sale.selected = [];
        this.consoleState.section = 'board';
        return;
      }
      // B on a shell-task surface: CANCEL when the server marker allows
      // (pay-on-commit Build Colony), else DEFER to inspect the board.
      if (this.shellTaskActive) {
        if (this.shellTask?.kind === 'colony' && this.colonyCancellable) {
          this.submit(cancelResponse());
          return;
        }
        this.deferShellTask();
        this.consoleState.section = 'board';
        return;
      }
      if (this.consoleState.section === 'hand') {
        // The physical gather back into the dock (plain browse close — the
        // sale / shell-task paths returned above with their own handling).
        void this.closeHandWithReveal();
        return;
      }
      if (this.consoleState.section === 'colonies' || this.consoleState.section === 'hydro') {
        this.consoleState.section = 'board';
        return;
      }
      if (this.placementActive) {
        if (this.placementCancellable) {
          this.cancelPlacement();
        } else {
          this.showNotice('This placement is mandatory — pick a cell on the map');
        }
        return;
      }
      // P27: inspection modes — B is one calm step back to the board home.
      if (this.consoleState.scaleInspecting) {
        this.exitScaleInspect();
        return;
      }
      if (this.consoleState.inspecting) {
        this.exitInspection();
      }
    },
    // ── the console-native journal (View — board home only) ─────────────
    toggleJournal(): void {
      if (journalState.open) {
        this.closeJournal();
        return;
      }
      // Board home only (safe context policy): a placement / another
      // section keeps the pad on its own task — honest notice, no toggle.
      if (this.placementActive) {
        this.showNotice('Finish your current action first');
        return;
      }
      if (this.consoleState.section !== 'board') {
        this.showNotice('The journal is available from the main board');
        return;
      }
      journalState.open = true;
    },
    closeJournal(): void {
      journalState.open = false;
      // A read-only colony dossier only exists ON TOP of the journal — it must
      // not outlive it (e.g. a mandatory surface closes the journal underneath).
      if (this.journalColonyInspect !== undefined) {
        this.closeColonyInspect();
      }
    },
    // ── «Разыграно» — the played-cards tableau (X, board home only) ──────
    openPlayedOverlay(): void {
      // Board-home-only by the caller's guards; mutually exclusive with the
      // journal (both replace the player's attention, never each other).
      if (journalState.open) {
        this.closeJournal();
      }
      this.playedOpen = true;
    },
    closePlayedOverlay(): void {
      this.playedOpen = false;
      resetConsolePlayedUi();
      // Focus returns to the board home — the board stays mounted (v-show)
      // with its own retained cursor state; nothing to restore explicitly.
    },
    /** A in the first-action modal: submit that corp's option of the
     *  corporationInitialAction OrOptions — byte-identical to the desktop
     *  start-flow submit. The action's follow-ups (a Tharsis city placement,
     *  Vitor's award pick …) arrive as native tasks; Merger's second
     *  first-action re-opens the modal with the remaining corp. */
    onCorpFirstActionConfirm(name: CardName): void {
      const prompt = startFlowCorpPrompt(this.playerView);
      const index = corpActionOptionIndexFor(prompt, name);
      if (prompt === undefined || index === -1) {
        return;
      }
      this.consoleState.task.deferred = false;
      this.submit({type: 'or', index, response: {type: 'option'}});
    },
    /** B in the first-action modal: the MANDATORY prompt is DEFERRED to the
     *  amber chip (B returns to it) — never just swallowed. */
    onCorpFirstActionDefer(): void {
      this.deferShellTask();
    },
    // ── P27: BOARD INSPECTION MODE (L3) ──────────────────────────────────
    toggleInspection(): void {
      if (this.consoleState.inspecting) {
        this.exitInspection();
        return;
      }
      this.exitScaleInspect(); // the two inspection modes are exclusive
      this.consoleState.inspecting = true;
      // Land on a predictable cell (the last inspected one, else re-seed).
      void this.$nextTick(() => {
        if (this.consoleState.boardSpaceId === undefined) {
          const board = this.$refs.boardSection as InstanceType<typeof ConsoleBoardSection> | undefined;
          board?.seed(false);
        }
      });
    },
    exitInspection(): void {
      this.consoleState.inspecting = false;
      this.consoleState.trackMarker = undefined;
    },
    // ── P27b: SCALE INSPECTION MODE (R3) — the track-bonus ring ─────────
    toggleScaleInspect(): void {
      if (this.consoleState.scaleInspecting) {
        this.exitScaleInspect();
        return;
      }
      this.exitInspection();
      const board = this.$refs.boardSection as InstanceType<typeof ConsoleBoardSection> | undefined;
      if (board?.enterTrackInspect() === true) {
        this.consoleState.scaleInspecting = true;
      } else {
        this.showNotice('Unavailable right now');
      }
    },
    exitScaleInspect(): void {
      this.consoleState.scaleInspecting = false;
      this.consoleState.trackMarker = undefined;
    },
    // ── quick selectors / sheets ─────────────────────────────────────────
    /** Open a quick selector from the board home (RT toggles 'actions', LT 'basics'). */
    openQuick(id: ConsoleQuickId): void {
      if (this.consoleState.quick === id) {
        this.consoleState.quick = undefined;
        return;
      }
      this.consoleState.quick = id;
      this.consoleState.sheet = undefined;
    },
    openSheet(sheet: ConsoleSheetId): void {
      // A sheet switch / (re)open closes a stale full-text reader.
      this.maInspect = undefined;
      // Opening anything that is NOT the task's own surface defers the task;
      // opening the task's OWN surface un-defers it (back on the surface).
      const isTaskSurface = (sheet === 'standardProjects' &&
        this.shellTask?.kind === 'projectCard' && this.shellTask.mode === 'standardProject') ||
        (sheet === 'awards' && this.shellTask?.kind === 'awardFunding');
      if (!isTaskSurface) {
        this.deferShellTask();
      } else {
        this.consoleState.task.deferred = false;
      }
      this.consoleState.quick = undefined;
      this.consoleState.sheet = sheet;
      void this.$nextTick(() => {
        // P26/P27: the MA + Std-Projects screens focus the first ACTIONABLE
        // card, else the top row.
        const selectables = this.maScreenKind !== undefined ?
          this.maScreenItems.map((it) => ({header: false, available: it.available})) :
          this.consoleState.sheet === 'standardProjects' ?
            this.stdProjectItems.map((it) => ({header: false, available: it.available})) :
            this.sheetRows.map((r) => ({header: r.kind === 'header', available: r.available}));
        const firstAvailable = selectables.findIndex((s) => !s.header && s.available);
        const firstSelectable = selectables.findIndex((s) => !s.header);
        this.consoleState.sheetIndex = firstAvailable !== -1 ? firstAvailable : Math.max(0, firstSelectable);
      });
    },
    /** P26: A on the premium MA screen — a non-available press answers with
     *  the CONCRETE reason (owner / turn / money / slots / threshold), never
     *  a mute no-op. An AVAILABLE press opens the premium CONFIRMATION —
     *  claiming/funding is a strategic commitment, never a bare A. */
    activateMaItem(item: ConsoleMaItem | undefined): void {
      if (item === undefined || this.maScreenKind === undefined) {
        return;
      }
      if (this.placementActive) {
        this.showNotice('Finish your current action first');
        return;
      }
      if (!item.available) {
        this.showNotice(consoleMaPressNotice(item));
        return;
      }
      this.pendingMaConfirm = {kind: item.kind, name: item.name};
    },
    /** X → «Осмотреть»: open the premium full-text reader for a dashboard
     *  item (works for taken / blocked items too — it is read-only). */
    openMaInspect(item: ConsoleMaItem | undefined): void {
      if (item === undefined) {
        return;
      }
      this.maInspect = item.name;
    },
    /** B / X in the reader → back to the dashboard (nothing submitted). */
    closeMaInspect(): void {
      this.maInspect = undefined;
    },
    /** A in the reader → sponsor / claim when available: close the reader and
     *  hand off to the existing premium confirm (never submits directly). */
    confirmMaInspect(): void {
      const item = this.maInspectItem;
      this.maInspect = undefined;
      if (item !== undefined && item.available) {
        this.activateMaItem(item);
      }
    },
    /** The MA confirm's A — re-resolves the LIVE option path (the prompt may
     *  have moved while the modal was open) and submits the byte-identical
     *  nested OR response; the ceremony is armed as a CANDIDATE and fires
     *  only when the fresh view proves the claim/fund resolved. */
    submitMaConfirm(): void {
      const pending = this.pendingMaConfirm;
      const view = this.maConfirmView;
      this.pendingMaConfirm = undefined;
      if (pending === undefined) {
        return;
      }
      const found = pending.kind === 'milestone' ?
        findMilestoneOptionPath(this.playerView.waitingFor) :
        findAwardOptionPath(this.playerView.waitingFor, this.awardNames);
      if (found === undefined) {
        this.showNotice('Unavailable right now');
        return;
      }
      const sent = this.submitInnerOption(found, pending.name);
      if (sent) {
        armMaCeremony({
          kind: pending.kind,
          name: pending.name,
          cost: view?.cost ?? 0,
          free: view?.free ?? false,
        });
      }
    },
    activateSheetRow(row: ConsoleSheetRow | undefined): void {
      if (row === undefined || row.kind === 'header') {
        return;
      }
      // P20: the overlays stay OPEN for inspection during a placement, but
      // STARTING another action would desync the pending SelectSpace.
      if (this.placementActive) {
        this.showNotice('Finish your current action first');
        return;
      }
      if (!row.available) {
        this.showNotice(row.reason !== undefined && row.reason !== '' ? row.reason : 'Unavailable right now');
        return;
      }
      switch (this.consoleState.sheet) {
      case 'hydroPick':
        // A pure PLAN write (never a submit) — the hydro confirm reads it.
        hydroNetworkState.selectedCard = row.key as CardName;
        this.consoleState.sheet = undefined;
        // Smart continuation: the pick was the LAST pending to-do, so the
        // primary flow resumes — the confirmation modal opens with the
        // complete plan (nothing is submitted until its A).
        void this.$nextTick(() => {
          const hydro = this.$refs.hydroSection as InstanceType<typeof ConsoleHydroSection> | undefined;
          hydro?.onPrimary();
        });
        break;
      }
    },
    /** A on the Standard-Projects premium screen (P27) — use / sell. */
    activateStdItem(item: StdProjectItem | undefined): void {
      if (item === undefined) {
        return;
      }
      if (this.placementActive) {
        this.showNotice('Finish your current action first');
        return;
      }
      if (!item.available) {
        // The deficit reason carries params — pre-translate for the notice.
        const reason = item.reason !== '' ?
          translateTextWithParams(item.reason, [...(item.reasonParams ?? [])]) :
          'Unavailable right now';
        this.showNotice(reason);
        return;
      }
      if (item.key === 'sell-patents') {
        // Patent sale — the hand carousel's SALE mode (A toggles, Y sells).
        this.consoleState.sheet = undefined;
        this.consoleState.sale.active = true;
        this.consoleState.sale.selected = [];
        this.consoleState.section = 'hand';
        return;
      }
      if (item.cardName !== undefined) {
        this.useStandardProject(item.cardName);
      }
    },
    // ── the console-native card-action center (ConsoleCardActions.vue) ────
    // It owns the whole flow (list · inspector · composer) and builds the
    // byte-identical activation batch itself; the shell only POSTs + closes.
    onCardActionsSubmitBatch(responses: ReadonlyArray<unknown>): void {
      closeConsoleLayers();
      this.submitBatch(responses);
    },
    onCardActionsClose(): void {
      closeConsoleLayers();
    },
    acceptConfirm(): void {
      const kind = this.consoleState.confirm;
      this.consoleState.confirm = undefined;
      if (kind === 'pass') {
        const path = findPassPath(this.playerView.waitingFor);
        if (path !== undefined) {
          this.submit(optionResponseForPath(path));
        }
      } else if (kind === 'convertHeat') {
        const found = findConvertHeatOption(this.playerView.waitingFor);
        if (found !== undefined) {
          this.submit(optionResponseForPath(found.path));
        }
      }
    },
    // ── flows ────────────────────────────────────────────────────────────
    openPlayCard(cardName: CardName): void {
      const action = this.playAction;
      const card = action?.input.cards.find((c) => c.name === cardName);
      if (action === undefined || card === undefined || card.isDisabled === true) {
        return;
      }
      this.pendingPlayCard = {cardName, input: {...action.input, cards: [card]}};
    },
    /**
     * T8 (pre-select parity): the native play composer resolved — assemble the
     * byte-identical PlayerInputBatch (`buildPlayCardBatch` mirrors
     * PlayerHome.submitPlayCardBatch): the wrapped `{type:'projectCard', card,
     * payment}` + pre-branch responses + the on-play BRANCH pick + every
     * pre-collected step. Genuine follow-ups (board placement / multi-card
     * picks) still arrive as native tasks — the batch's graceful fallback
     * leaves the leftover prompt for them.
     */
    /** The live hand-grid slot for a card (data-zoom-slot marker). */
    handExitSlot(name: CardName): HTMLElement | null {
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
      return document.querySelector<HTMLElement>(`.con-hand [data-zoom-slot="${esc}"]`);
    },
    /**
     * DIRECT play from the hand overlay (A on a playable card) — the same
     * card motion language as fullscreen → modal: a FaceLite proxy
     * TRANSFERS from the hand slot into the composer's card slot (source
     * held empty for the flight, destination pre-held and revealed under
     * the proxy, cross-fade). A missing slot / reduced motion degrades to
     * the bare open.
     */
    openPlayCardFromHand(name: CardName): void {
      const slot = this.handExitSlot(name);
      // Opening pendingPlayCard ALSO engages the Vue-managed hand-slot hold
      // (stagedHandCard) in the same flush — the source card leaves the
      // table the frame its proxy exists; no double-vision, patch-proof.
      this.openPlayCard(name);
      if (slot === null) {
        return;
      }
      void runCardTransfer({
        name,
        from: slot,
        resolveTo: () => document.querySelector<HTMLElement>('.con-composer--play [data-zoom-handoff="play-card"]'),
        holdTarget: true,
      });
    },
    /**
     * CANCEL of the play composer: the card physically RETURNS to its hand
     * slot (the reverse transfer — playing was never committed). The modal
     * closes at onLift; the hand slot stays held (returningPlayCard) until
     * the proxy TOUCHES DOWN, so the card materializes exactly under it. A
     * hand slot hidden by filters/virtualization degrades to the dive-away
     * exit (touchdown still fires — the hold is always released).
     */
    onPlayCardCancel(): void {
      // Mid-transaction (submit in flight / scene running) a cancel would
      // corrupt the hero state — the input chain already swallows B, this
      // is the belt-and-braces for programmatic emits.
      if (isPlayedHeroActive()) {
        return;
      }
      const pending = this.pendingPlayCard;
      if (pending === undefined) {
        return;
      }
      const name = pending.cardName;
      const modalSlot = document.querySelector<HTMLElement>('.con-composer--play [data-zoom-handoff="play-card"]');
      if (modalSlot === null) {
        this.pendingPlayCard = undefined;
        return;
      }
      this.returningPlayCard = name; // keeps the hand slot held across the modal close
      void runCardTransfer({
        name,
        from: modalSlot,
        resolveTo: () => this.handExitSlot(name),
        onLift: () => {
          this.pendingPlayCard = undefined;
        },
        onTouchdown: () => {
          this.returningPlayCard = undefined;
        },
      });
    },
    clearDepartingPlayCard(): void {
      this.departingPlayCard = undefined;
      if (this.departingTimer !== undefined) {
        window.clearTimeout(this.departingTimer);
        this.departingTimer = undefined;
      }
    },
    onPlayCardConfirmNative(payload: {branchIndex: number, preResponses: ReadonlyArray<unknown>, optionResponse: unknown, stepResponses: ReadonlyArray<unknown>, payment: Payment, rewards?: ReadonlyArray<ResourceTransferSpec>}): void {
      const action = this.playAction;
      const pending = this.pendingPlayCard;
      if (pending === undefined || action === undefined) {
        this.pendingPlayCard = undefined;
        return;
      }
      // The HERO transaction (spec: no visual success before the server's
      // word). The composer STAYS OPEN through the submit; nothing lifts,
      // nothing closes. On the confirmed response the WaitingFor gate runs
      // the scene — the composer closes UNDER the lifted card at the
      // 'lifting' phase (watcher below); a refused play keeps the composer
      // intact and re-arms its CTA on 'failed'. Double-confirm is blocked
      // both here and by the composer's own submit latch.
      if (isPlayedHeroActive()) {
        return;
      }
      const isEvent = getCard(pending.cardName)?.type === CardType.EVENT;
      // `rewards` = the play's immediate resource gains (composer-extracted
      // from the server preview) — the hero scene's reward beat carries them
      // from the landed card onto the left panel, delta chips at contact.
      armPlayedHero(pending.cardName, isEvent, {manualTableOpen: this.playedOpen, rewards: payload.rewards});
      const batch = buildPlayCardBatch({
        playPath: action.path,
        cardName: pending.cardName,
        payment: payload.payment,
        branchIndex: payload.branchIndex,
        preResponses: payload.preResponses,
        optionResponse: payload.optionResponse,
        stepResponses: payload.stepResponses,
      });
      this.submitBatch(batch);
    },
    /**
     * P24: the hydro card pick (reuse-a-blue-action / animal target) is a
     * CONSOLE SHEET — candidates come from the overlay's own eligibleCards
     * (the preview truth), the pick writes hydroNetworkState.selectedCard
     * (the same field the desktop pick-mode bridges write), so the confirm
     * payload stays byte-identical. Mouse clicks on the overlay's own pick
     * button route here too.
     */
    openHydroPickSheet(): void {
      const hydro = this.$refs.hydroSection as InstanceType<typeof ConsoleHydroSection> | undefined;
      const cards = hydro?.eligibleCards ?? [];
      if (cards.length === 0) {
        this.showNotice('Unavailable right now');
        return;
      }
      this.hydroPickCards = cards.map((c) => ({name: c.name, current: c.current}));
      this.consoleState.sheet = 'hydroPick';
      this.consoleState.sheetIndex = 0;
    },
    useStandardProject(cardName: CardName): void {
      const action = this.standardProjectsAction;
      const card = action?.input.cards.find((c) => c.name === cardName);
      if (action === undefined || card === undefined || card.isDisabled === true) {
        return;
      }
      const cost = card.calculatedCost ?? 0;
      if (hasUsableStandardProjectAlternativeResources(this.thisPlayer, card, action.input.paymentOptions ?? {})) {
        // T3: the alt-resource payment is hosted NATIVELY by the task host
        // (promptOverride) — B cancels back to the sheet, nothing committed.
        const title = standardProjectPaymentTitle(cardName);
        this.pendingClientPayment = {
          cardName,
          input: buildStandardProjectPaymentModel(this.playerView, action.input, card, title, cost),
        };
        closeConsoleLayers();
        return;
      }
      closeConsoleLayers();
      this.submitStandardProjectPayment(cardName, Payment.of({megacredits: cost}));
    },
    submitStandardProjectPayment(cardName: CardName, payment: Payment): void {
      const action = this.standardProjectsAction;
      if (action === undefined) {
        return;
      }
      this.submit(wrapPath(action.path, {type: 'projectCard' as const, card: cardName, payment}));
    },
    submitInnerOption(found: {options: ReadonlyArray<unknown>, path: ReadonlyArray<number>} | undefined, targetTitle: string): boolean {
      if (found === undefined) {
        return false;
      }
      const options = found.options as ReadonlyArray<{type: string, title: string | Message}>;
      const innerIdx = options.findIndex((o) => o.type === 'option' && inputTitleText(o.title) === targetTitle);
      if (innerIdx === -1) {
        this.showNotice('Unavailable right now');
        return false;
      }
      closeConsoleLayers();
      this.submit(wrapPath([...found.path, innerIdx], {type: 'option' as const}));
      return true;
    },
    // ── colonies trade (mirrors the desktop contract byte-for-byte) ─────
    /** X = «Осмотреть» from the colonies SECTION — toggle the dossier (A can
     *  then trade). */
    toggleColonyInspect(): void {
      if (this.colonyInspectOpen) {
        this.colonyInspectOpen = false;
        consoleColoniesUi.inspectOpen = false;
        return;
      }
      if (this.coloniesForRail.length === 0) {
        return;
      }
      this.colonyInspectOpen = true;
      consoleColoniesUi.inspectOpen = true;
    },
    /** X on a JOURNAL colony row — open the READ-ONLY dossier over the journal. */
    openJournalColonyInspect(name: ColonyName): void {
      this.colonyInspectOpen = false;
      this.journalColonyInspect = name;
      consoleColoniesUi.inspectOpen = true;
    },
    /** Close whichever inspect source is open (section or journal). */
    closeColonyInspect(): void {
      this.colonyInspectOpen = false;
      this.journalColonyInspect = undefined;
      consoleColoniesUi.inspectOpen = false;
    },
    /** The inspect overlay owns the pad: ←/→ page colonies (section source
     *  only), ↑/↓ scroll, A trades a live-tradeable colony (section), B/X close. */
    handleColonyInspectIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        // ←/→ pages the rail ONLY for the section source (a journal dossier is
        // pinned to its one colony).
        if ((intent.dir === 'left' || intent.dir === 'right') && this.journalColonyInspect === undefined) {
          this.consoleState.colonyIndex = stepIndex(
            this.consoleState.colonyIndex, intent.dir === 'right' ? 1 : -1, this.coloniesForRail.length);
          return;
        }
        if (intent.dir === 'up' || intent.dir === 'down') {
          const scroller = document.querySelector<HTMLElement>('.con-colinspect .con-colinspect__main');
          scroller?.scrollBy({top: intent.dir === 'down' ? 140 : -140, behavior: 'smooth'});
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      // A = trade this colony (section source, live-tradeable only) — close the
      // dossier and open the composer. Read-only journal dossier: A does nothing.
      const a = consoleActionOf(intent);
      if (a === 'primary' && this.colonyInspectTradeable) {
        this.closeColonyInspect();
        this.tryOpenColonyTrade();
        return;
      }
      if (a === 'back' || a === 'inspect') {
        this.closeColonyInspect();
      }
    },
    tryOpenColonyTrade(): void {
      const ctx = this.tradeColonyContext;
      const selected = this.game.colonies[this.consoleState.colonyIndex];
      if (selected === undefined) {
        return;
      }
      if (ctx === undefined || !ctx.colonies.includes(selected.name)) {
        this.showNotice(this.colonyTradeBlockReason);
        return;
      }
      // ALWAYS confirm through the premium trade composer — never instant.
      const pending = {
        colonyName: selected.name,
        paymentOptions: ctx.paymentOptions,
        disabledPayments: ctx.disabledPayments,
      };
      this.pendingTradeColony = pending;
      // The shared server preview (track advance / card targets / M€ prompt)
      // loads in the background; the composer degrades gracefully meanwhile.
      void fetchColonyTradePreview(this.playerView.id, selected.name).then((preview) => {
        if (this.pendingTradeColony === pending && preview !== undefined && preview.colonyName === pending.colonyName) {
          this.pendingTradeColony = {...pending, preview};
        }
      });
    },
    /**
     * The composer's ONE confirm: the trade and-response + every pre-collected
     * follow-up (M€ payment mix / track choice / card targets) as a single
     * PlayerInputBatch — byte-identical to answering the live prompts one at a
     * time (a diverged later step gracefully arrives as a live prompt).
     */
    onColonyTradeComposerConfirm(payload: {paymentIndex: number, steps: ReadonlyArray<TradeStep>, captures: Readonly<Record<number, unknown>>}): void {
      const pending = this.pendingTradeColony;
      const ctx = this.tradeColonyContext;
      // Guard a double-confirm: once the launch is armed the flight owns the
      // moment (input is gated), so a second press can never re-submit.
      if (pending === undefined || ctx === undefined || isTradeFleetActive()) {
        return;
      }
      const batch = buildTradeBatch({
        tradePath: ctx.path,
        paymentIndex: payload.paymentIndex,
        colonyName: pending.colonyName,
        steps: payload.steps,
        captures: payload.captures,
      });
      // PREMIUM LAUNCH: ARM the trade-fleet flight (client-side) FIRST — the
      // composer dissolves + the ship lifts off toward the colony immediately,
      // independent of the server — THEN submit. The `pendingTradeColony`
      // overlay is deliberately KEPT (dissolved via `--launching`, not closed)
      // until the ship DOCKS; the WaitingFor `holdingForTradeFleet` gate
      // blocks the view commit (delta chips / next prompt / docked board
      // state) until then. A watcher on `tradeFleetState.active` closes the
      // composer once the flight ends (dock or abort). Desktop is unaffected
      // (never arms → detectTradeFleet returns undefined → no hold).
      armTradeFleet(pending.colonyName, this.thisPlayer.color);
      this.submitBatch(batch);
    },
    // ── hydro advance (mirrors PlayerHome.submitHydroAdvance) ───────────
    submitHydroAdvance(payload: {spend: number, rewardChoice: number | undefined, selectedCard?: CardName, fromPosition: number, toPosition: number}): void {
      const path = findHydroActionPath(this.playerView.waitingFor);
      if (path === undefined || isHydroMarkerActive()) {
        return; // guard a double-confirm: the marker glide owns the moment
      }
      const responses: Array<unknown> = [
        optionResponseForPath(path),
        {type: 'deltaProject' as const, amount: payload.spend},
      ];
      if (payload.rewardChoice !== undefined) {
        responses.push({type: 'or' as const, index: payload.rewardChoice, response: {type: 'option' as const}});
      }
      if (payload.selectedCard !== undefined) {
        responses.push({type: 'card' as const, cards: [payload.selectedCard]});
      }
      // PREMIUM MARKER ADVANCE: ARM the marker glide (client-side, from→to)
      // FIRST — the confirm modal already closed, the hydro SCREEN STAYS OPEN,
      // and the marker physically moves to the new stop — THEN submit. The
      // WaitingFor `holdingForHydroMarker` gate BLOCKS the commit (delta chips /
      // new position) until the marker LOCKS IN. The plan is reset + the
      // screen kept open by the `hydroMarkerState.active` watcher (never
      // `section='board'` — trading leaves you in colonies, advancing leaves
      // you in hydro). Desktop is unaffected (never arms).
      armHydroMarker(payload.fromPosition, payload.toPosition, this.thisPlayer.color);
      this.submitBatch(responses);
    },
    confirmSale(): void {
      const picked = this.consoleState.sale.selected;
      if (picked.length === 0 || isPatentSaleActive()) {
        return; // the terminal owns the moment — never a double submit
      }
      const action = findSellPatentsAction(this.playerView.waitingFor);
      if (action === undefined) {
        this.showNotice('Not your turn to take any actions');
        return;
      }
      const cards = [...picked] as Array<CardName>;
      // PREMIUM PATENT SALE: ARM the trade-terminal scene FIRST — the sold
      // cards' live hand-slot rects are captured in this same synchronous
      // turn (the hand is still on screen) — THEN submit. The sale UI stays
      // up while the cards flip + gather; the `patentSaleState.phase`
      // watcher closes it when the stack enters the terminal, and the
      // WaitingFor `holdingForPatentSale` gate blocks the commit (new M€ /
      // delta chip) until the payout chip lands on the resource rail.
      // Desktop is unaffected (never arms).
      armPatentSale({cards});
      this.submit(wrapPath(action.path, {type: 'card' as const, cards}));
    },
    onConvertPlantsSpacePicked(spaceResponse: {type: 'space', spaceId: string}): void {
      const found = this.convertPlantsPending;
      this.convertPlantsPending = undefined;
      if (found === undefined || found.path.length === 0) {
        return;
      }
      this.armBoardBonusIfCardCell(spaceResponse.spaceId);
      this.submit(wrapPath(found.path, spaceResponse));
    },
    /**
     * The placed cell prints a card-draw bonus and its cover is on the
     * board → ARM the "card bonus lifts off the cell" cinematic BEFORE the
     * submit (the cover separates while the server resolves; the arriving
     * tile-source reveal is then staged instead of popping instantly). A
     * cell without the visual source (no icon in the DOM) never arms —
     * the standard reveal flow stays untouched.
     */
    armBoardBonusIfCardCell(spaceId: string): void {
      const space = this.playerView.game.spaces.find((s) => s.id === spaceId);
      if (space === undefined || !space.bonus.includes(SpaceBonus.DRAW_CARD)) {
        return;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(spaceId) : spaceId;
      const icon = document.querySelector(`.board-space[data_space_id="${esc}"] .board-space-bonus--card`);
      if (icon === null) {
        return;
      }
      armBoardCardBonus({kind: 'board-cell', spaceId});
    },
    cancelPlacement(): void {
      if (this.taskSpacePending !== undefined) {
        // A task's nested board pick: nothing committed — return to the task.
        this.taskSpacePending = undefined;
        return;
      }
      if (this.convertPlantsPending !== undefined) {
        // Client-side picker: nothing committed — just drop it.
        this.convertPlantsPending = undefined;
        return;
      }
      const wfRef = this.$refs.waitingFor as {onPlacementCancel?: () => void} | undefined;
      wfRef?.onPlacementCancel?.();
    },
    // ── CTS task host (T1–T3) ────────────────────────────────────────────
    onTaskSubmit(response: unknown): void {
      // The CLIENT payment resolves into the std-project response (T3).
      if (this.pendingClientPayment !== undefined) {
        const cardName = this.pendingClientPayment.cardName;
        this.pendingClientPayment = undefined;
        const payment = (response as {payment?: Payment}).payment;
        if (payment !== undefined) {
          this.submitStandardProjectPayment(cardName, payment);
        }
        return;
      }
      // (The starting-cards DELIVERY is armed + fired entirely inside
      // ConsoleStartScene — the hold begins at the first ceremony frame and
      // the flight fires ONLY on the project-payment confirm. The shell just
      // hosts the delivery layer + passes the held set to the dock.)
      closeConsoleLayers();
      this.consoleState.task.deferred = false;
      this.submit(response);
    },
    /**
     * Government Support scale param (temp/oxygen/venus): CLOSE the panel
     * first, THEN submit — so the board scale glide + accent (see the
     * commit in the playerView watcher) play on a clean board, and the next
     * modal is held until that beat finishes. Snap to the board so the scale
     * is what shows while the panel dismisses.
     */
    onGovSupportLeafConfirm(payload: {response: unknown, param: string}): void {
      this.consoleState.section = 'board';
      closeConsoleLayers();
      this.consoleState.task.deferred = false;
      beginGovScaleClose(payload.param, () => this.submit(payload.response));
    },
    /** B in the host: defer a SERVER task; CANCEL a client payment. */
    onTaskDefer(): void {
      if (this.pendingClientPayment !== undefined) {
        // Nothing committed — back to the sheet the payment came from.
        this.pendingClientPayment = undefined;
        const task = this.shellTask;
        if (task?.kind === 'projectCard' && task.mode === 'standardProject') {
          this.openShellTaskSurface(task);
        }
        return;
      }
      this.consoleState.task.deferred = true;
    },
    // ── shell-section tasks (T3 projectCard / T4 colony) ─────────────────
    /** Open (or re-open after un-defer) the section that serves the task. */
    openShellTaskSurface(task: ConsoleTask): void {
      closeConsoleLayers();
      if (task.kind === 'awardFunding') {
        // FREE award funding rides the premium awards MA screen (its own
        // v-if renders it); openSheet treats it as the task surface.
        this.consoleState.section = 'board';
        this.openSheet('awards');
        return;
      }
      if (task.kind === 'colony') {
        this.consoleState.section = 'colonies';
        // Land on the first PICKABLE tile so A is meaningful immediately.
        const pick = this.colonyPick;
        const rail = this.coloniesForRail;
        const first = pick !== undefined ? rail.findIndex((c) => pick.selectable.includes(c.name)) : -1;
        this.consoleState.colonyIndex = first !== -1 ? first : 0;
        return;
      }
      if (task.kind === 'handSelect') {
        // MANDATORY pick from hand (discard / reveal / place): open the hand
        // carousel in select mode + land on the first PICKABLE card so A means
        // something at once. Picks/filter are reset by the prompt-change watcher.
        this.consoleState.section = 'hand';
        const selectable = new Set(this.handSelectSelectableNames);
        const idx = this.handEntries.findIndex((e) => selectable.has(e.card.name));
        this.consoleState.handIndex = idx !== -1 ? idx : 0;
        return;
      }
      if (task.kind === 'projectCard') {
        if (task.mode === 'playFromHand') {
          this.consoleState.section = 'hand';
          const firstPlayable = this.handEntries.findIndex((e) => e.playable);
          this.consoleState.handIndex = firstPlayable !== -1 ? firstPlayable : 0;
        } else {
          this.consoleState.section = 'board';
          this.openSheet('standardProjects');
        }
        return;
      }
      if (task.kind === 'corpFirstAction') {
        // The corporation's mandatory FIRST ACTION (the player's first turn):
        // the dedicated confirm modal serves it. Its presence is DERIVED
        // (corpFirstActionOpen), so there is nothing to open here: only the
        // board must be the section underneath it.
        this.consoleState.section = 'board';
      }
    },
    /** Navigating away from a shell task's surface DEFERS it (amber chip). */
    deferShellTask(): void {
      if (this.shellTask !== undefined && !this.consoleState.task.deferred) {
        this.consoleState.task.deferred = true;
      }
    },
    onTaskSpacePick(payload: {index: number, spacePrompt: PlayerInputModel}): void {
      this.taskSpacePending = payload;
      this.consoleState.section = 'board';
    },
    onTaskSpacePicked(spaceResponse: {type: 'space', spaceId: string}): void {
      const pending = this.taskSpacePending;
      this.taskSpacePending = undefined;
      if (pending === undefined) {
        return;
      }
      this.consoleState.task.deferred = false;
      this.armBoardBonusIfCardCell(spaceResponse.spaceId);
      this.submit(orWrappedResponse(pending.index, spaceResponse));
    },
    // ── T6: reveal-result ack + notification CTAs ────────────────────────
    /** «ОК» on the deck-check result: mark seen until the server clears it. */
    onDismissRevealResult(): void {
      const lr = this.playerView.lastReveal;
      if (lr !== undefined) {
        this.dismissedRevealKey = `${lr.action}|${lr.revealed.name}`;
      }
    },
    /**
     * The notification card's «Перейти к действию» CTA (window event —
     * PlayerHome's listener doesn't exist in console): bring the pending
     * decision back — un-defer the task, re-open its serving surface,
     * snap to the board for a pending placement.
     */
    onNotificationGoToAction(): void {
      if (this.consoleState.task.deferred) {
        this.consoleState.task.deferred = false;
        if (this.hostTask === undefined && this.startTask === undefined && this.shellTask !== undefined) {
          this.openShellTaskSurface(this.shellTask);
        }
      }
      if (this.placementActive) {
        this.consoleState.section = 'board';
        closeConsoleLayers();
      }
    },
    hydroPickDescription(name: CardName): string {
      try {
        const meta = getCard(name)?.metadata;
        const d = meta?.description;
        if (typeof d === 'string') {
          return d;
        }
        if (d !== undefined && typeof (d as {text?: string}).text === 'string') {
          return (d as {text: string}).text;
        }
      } catch (err) {
        // manifest miss — the name alone still identifies the card
      }
      return '';
    },
    /** The notification's «Отменить размещение» CTA (server-cancellable). */
    onNotificationCancel(): void {
      this.cancelPlacement();
    },
    // ── P13/P15: the fullscreen card viewer (module-state driven) ───────
    onCardZoomNavigate(card: ZoomCard, pos: number): void {
      navigateConsoleCardZoom(card, pos);
      // The card "in hand" changed: the table hold moves to ITS slot, and
      // the host keeps the underlying focus in lockstep (so closing lands
      // the cursor on the card the player looked at LAST).
      retargetZoomHold(pos);
      this.consoleCardZoom.origin.onBrowse?.(pos);
    },
    /**
     * The OPEN sequence (see consoleZoomMotion.ts header — load-bearing):
     * measure the landing on the CLOSED dialog, fly the proxy on a normal
     * layer, and call `show()` (showModal) only at touchdown so the dialog's
     * first top-layer frame is final, static, fully-visible content — the
     * compositor-safe shape the mouse path always had. Every deferred
     * callback is fenced by `zoomOpenToken` (a close + reopen can never be
     * touched by a stale flight/safety callback).
     */
    async runZoomOpen(zoom: InstanceType<typeof CardZoomModal>): Promise<void> {
      const token = ++this.zoomOpenToken;
      this.zoomOpening = true;
      const origin: ZoomOrigin = this.consoleCardZoom.origin;
      beginZoomOpen(origin);
      const landing = await zoom.measureLanding();
      if (token !== this.zoomOpenToken || this.consoleCardZoom.card === undefined) {
        return; // closed / reopened while measuring — that sequence owns state
      }
      const index = this.consoleCardZoom.index;
      if (landing === undefined || consoleReducedMotionActive()) {
        // VANILLA open (also the reduced-motion / JSDOM / degenerate-layout
        // path): show immediately — first frame final and fully visible.
        zoom.show();
        this.zoomOpening = false;
        window.setTimeout(() => {
          if (token === this.zoomOpenToken) {
            this.zoomFlight = false;
          }
        }, motionMs(140));
        return;
      }
      // Premium flight: proxy flies slot→landing while the veil (the ONE
      // dim — the dialog's ::backdrop paints nothing) fades in beneath it;
      // showModal at touchdown adds no visual dim step.
      const source = zoomOpenSourceRect(index);
      this.zoomOpenProxy = {card: this.consoleCardZoom.card, zoom: landing.zoom};
      await this.$nextTick();
      if (token !== this.zoomOpenToken) {
        return;
      }
      const proxyEl = this.$refs.zoomFlightProxy as HTMLElement | undefined;
      playZoomOpenFlight(proxyEl, index, source, landing.rect, {
        onShow: () => {
          if (token === this.zoomOpenToken && this.consoleCardZoom.card !== undefined) {
            zoom.show();
          }
        },
        onDone: () => {
          if (token !== this.zoomOpenToken) {
            return;
          }
          this.zoomOpening = false;
          this.zoomFlight = false; // chrome fades in over the landed card
          // The proxy was already made INVISIBLE synchronously at hand-off
          // (playZoomOpenFlight — it must not share a single PAINT with the
          // dialog card, or their halos stack into a bright contour flash).
          // This is only the UNMOUNT of an already-hidden element, so its
          // timing is free — a beat later keeps it off the hand-off frame.
          this.zoomOpenClearTimer = window.setTimeout(() => this.clearZoomOpenFlight(), motionMs(160));
        },
      });
    },
    /** Drop the open-flight proxy (idempotent; any close path). */
    clearZoomOpenFlight(): void {
      if (this.zoomOpenClearTimer !== undefined) {
        window.clearTimeout(this.zoomOpenClearTimer);
        this.zoomOpenClearTimer = undefined;
      }
      this.zoomOpenProxy = undefined;
    },
    onCardZoomClosed(): void {
      // Any close path (choreographed B, native Esc, backdrop tap): restore
      // every held slot + kill the flight, then clear the module state.
      releaseZoomMotion();
      this.zoomOpenToken++; // fence out any stale open-sequence callback
      this.zoomFlight = false;
      this.zoomClosing = false;
      this.zoomSwapping = false;
      this.zoomOpening = false;
      this.clearZoomOpenFlight();
      document.body.classList.remove('con-zoom-open');
      closeConsoleCardZoom();
    },
    /** P15: the controller drives the viewer natively while it is open. */
    handleZoomIntent(intent: GamepadIntent): boolean {
      // A close/handoff flight is in progress: the card is mid-air — swallow
      // everything (no browsing a departing card, no double execute).
      if (this.zoomClosing) {
        return true;
      }
      // Mid OPEN-flight (dialog not shown yet): only closing is meaningful —
      // browsing/acting waits for the landing (≤400ms). B/X aborts cleanly.
      if (this.zoomOpening) {
        if (intent.kind === 'press' && !this.consoleCardZoom.mandatory) {
          const action = consoleActionOf(intent);
          if (action === 'back' || action === 'inspect') {
            void this.closeZoomViewer();
          }
        }
        return true;
      }
      const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
      if (intent.kind === 'nav') {
        if (intent.dir === 'left') {
          zoom?.prev();
        } else if (intent.dir === 'right') {
          zoom?.next();
        }
        return true;
      }
      if (intent.kind === 'scroll') {
        // Right-stick does nothing in the fullscreen viewer — the rule-overlay
        // traversal was removed (it overloaded the controls for little value).
        // Swallow it so it can't leak to a surface underneath.
        return true;
      }
      if (intent.kind !== 'press') {
        return true;
      }
      // L3 = the single-card reveal ROLE SWAP (received ⇄ source) on the SAME
      // viewer (screen-specific stick, before the semantic-action switch).
      if (intent.button === 'stickL' && this.consoleCardZoom.swap !== undefined) {
        this.zoomSwap();
        return true;
      }
      switch (consoleActionOf(intent)) {
      case 'prevSection':
        zoom?.prev();
        return true;
      case 'nextSection':
        zoom?.next();
        return true;
      case 'primary':
        // A = take the on-screen card (RECEIVE bridge) OR toggle the pick
        // (selection contexts) OR fire the context ACTION (play-from-hand
        // parity, P17) — read-only contexts (source viewer) no-op.
        if (this.consoleCardZoom.receive !== undefined) {
          this.zoomTakeReceived();
        } else if (this.consoleCardZoom.select !== undefined) {
          this.zoomToggleSelect();
        } else {
          this.zoomExecuteAction();
        }
        return true;
      case 'nextTab': {
        // RT = take all (RECEIVE bridge only). Same premium parity as the
        // single take: CLOSE the viewer first (the card flies back to its
        // slot), THEN run the reveal modal's own group collect — never a
        // bare state jump. Otherwise the viewer owns RT.
        const r = this.consoleCardZoom.receive;
        if (r?.takeAll !== undefined && !this.zoomClosing) {
          const takeAll = r.takeAll;
          void this.closeZoomViewer().then(() => takeAll());
        }
        return true;
      }
      case 'inspect': // X closes too — the same key that opened it
      case 'back':
        // A MANDATORY viewer (single-card reveal) cannot be closed — the only
        // completion is taking the received card (A). Swallow B / X so the
        // player can never return to the game with the card untaken; the swap
        // (L3) is the only way to look at the source and back.
        if (this.consoleCardZoom.mandatory) {
          return true;
        }
        void this.closeZoomViewer();
        return true;
      default:
        return true; // the viewer owns ALL input while open
      }
    },
    /**
     * L3 single-card reveal ROLE SWAP — flip the fullscreen between the
     * received card and the draw source on the SAME viewer (a soft crossfade,
     * never a nested viewer / recreation). The reveal overlay's `swap()`
     * re-points the module card + bridges; `playZoomSwap` crossfades the stage
     * and re-fits (the paired card can size differently). Re-entrant-guarded
     * so rapid L3 gives clean flips, not a mid-animation stutter.
     */
    zoomSwap(): void {
      const swap = this.consoleCardZoom.swap;
      if (swap === undefined || this.zoomClosing || this.zoomSwapping) {
        return;
      }
      const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
      this.zoomSwapping = true;
      void playZoomSwap(zoom?.$el as HTMLElement | undefined, () => swap.swap(), () => zoom?.fitCardToViewport())
        .then(() => {
          this.zoomSwapping = false;
        });
    },
    zoomToggleSelect(): void {
      const z = this.consoleCardZoom;
      if (z.select !== undefined && z.card !== undefined) {
        z.select.toggle(z.card.name as CardName);
      }
    },
    /**
     * The RECEIVE bridge A-verb — take the inspected card from FULLSCREEN.
     * PREMIUM PARITY: never a bare state jump — the viewer CLOSES first (the
     * card flies back into its reveal slot, choreographed), THEN the opener
     * runs the SAME premium take the reveal modal uses (the hand intake —
     * the card lifts off the slot and lays into the hand dock). So a
     * fullscreen take is the identical physical pipeline as an in-modal
     * take. Re-entrant safe (`zoomClosing` guards a double press mid-flight).
     */
    zoomTakeReceived(): void {
      const r = this.consoleCardZoom.receive;
      if (r === undefined || this.zoomClosing) {
        return;
      }
      const idx = this.consoleCardZoom.index;
      const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
      if (r.departFromFullscreen === true) {
        // SINGLE-CARD reveal: the card departs from fullscreen INTO THE HAND
        // — playZoomDepart hands the flight to the hand-intake director (the
        // proxy takes over at the stage rect; the dialog closes in that same
        // paint via the staged callback, so the top layer never covers the
        // flight) and the card arcs into the dock, flipping to its back.
        // `takeAt` is the reveal overlay's bare commit — fired as the flight
        // begins; the counter ticks only on the touchdown.
        const card = this.consoleCardZoom.card;
        if (card === undefined) {
          r.takeAt(idx);
          zoom?.close();
          return;
        }
        this.zoomFlight = true;
        this.zoomClosing = true;
        void playZoomDepart(zoom?.$el as HTMLElement | undefined, card.name as CardName, () => r.takeAt(idx), () => zoom?.close());
        return;
      }
      // MULTI-CARD: close back to the strip slot first, then the reveal modal's
      // own premium take (the hand intake) lifts the card off the slot.
      void this.closeZoomViewer().then(() => r.takeAt(idx));
    },
    /** P17: the viewer's A hands the card to the context action. Two paths:
     *  - HANDOFF (the action opens a surface showing this card, e.g. the
     *    play-confirm composer): execute FIRST — the composer mounts UNDER
     *    the top-layer dialog — then the fullscreen card FLIES INTO the
     *    composer's card slot and the viewer closes on landing. The card
     *    visibly travels fullscreen → modal, never "back to the table".
     *  - default: the viewer closes first (flight included), so the exact
     *    source context restores underneath the follow-up surface. */
    zoomExecuteAction(): void {
      const z = this.consoleCardZoom;
      const card = z.card;
      const action = z.action;
      if (card === undefined || action === undefined || action.labelFor(card.name as CardName) === undefined) {
        return;
      }
      const handoffSel = action.handoffTarget?.(card.name as CardName);
      const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
      if (handoffSel !== undefined && zoom !== undefined) {
        action.execute(card.name as CardName);
        this.zoomFlight = true;
        this.zoomClosing = true;
        void playZoomHandoff(zoom.$el as HTMLElement | undefined, () => document.querySelector<HTMLElement>(handoffSel))
          .then(() => zoom.close());
        return;
      }
      void this.closeZoomViewer().then(() => action.execute(card.name as CardName));
    },
    /**
     * Choreographed close: the chrome hides, the card flies back into the
     * CURRENT card's slot (physical origin) or dives away (textual/none),
     * THEN the dialog actually closes. Re-entrant safe (playZoomClose
     * resolves immediately while a close is already in flight; dialog.close
     * self-guards on `open`).
     */
    async closeZoomViewer(): Promise<void> {
      const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
      if (zoom === undefined) {
        return;
      }
      const dialogEl = zoom.$el as HTMLDialogElement | undefined;
      // Closed during the OPEN flight (dialog never shown): abort the flight
      // and unwind directly — `dialog.close()` would no-op and the 'close'
      // event (the normal state unwinder) would never fire.
      if (this.zoomOpening && dialogEl?.open !== true) {
        cancelZoomOpen();
        this.onCardZoomClosed();
        return;
      }
      this.zoomFlight = true;
      this.zoomClosing = true;
      await playZoomClose(dialogEl as HTMLElement | undefined, this.consoleCardZoom.index);
      zoom.close();
    },
    /** P17: right-stick scroll for the ACTIVE console scroll container —
     *  the journal peek while open, else the topmost visible scrollable
     *  `.con-info__scroll` (console layers stack in DOM order). */
    scrollActiveConsole(dy: number): void {
      if (Math.abs(dy) < 0.05) {
        return;
      }
      // The hand SMART GRID owns its own vertical scroll (+ keep-selected-visible
      // reconcile) — but only when it is the active surface (no play-confirm /
      // task / reveal / zoom on top, which would otherwise scroll it blindly).
      if (this.handScrollActive) {
        const hand = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
        hand?.stickScroll(dy);
        return;
      }
      // The corp first-action modal's briefing column scrolls first.
      if (this.corpFirstActionOpen) {
        const confirm = this.$refs.corpFirstConfirm as InstanceType<typeof ConsoleCorpFirstActionConfirm> | undefined;
        confirm?.stickScroll(dy);
        return;
      }
      // The «Разыграно» overlay owns the right stick while open (main table
      // or the nested events list — the overlay routes internally).
      if (this.playedTableVisible) {
        const played = this.$refs.playedOverlay as InstanceType<typeof ConsolePlayedOverlay> | undefined;
        played?.stickScroll(dy);
        return;
      }
      const candidates: Array<HTMLElement> = [];
      if (journalState.open) {
        const feed = document.querySelector<HTMLElement>('.con-journal__scroll');
        if (feed !== null) {
          candidates.push(feed);
        }
      }
      if (candidates.length === 0) {
        document.querySelectorAll<HTMLElement>('.con-info__scroll').forEach((el) => candidates.push(el));
      }
      for (let i = candidates.length - 1; i >= 0; i--) {
        const el = candidates[i];
        if (el.offsetParent !== null && el.scrollHeight > el.clientHeight + 1) {
          el.scrollBy({top: dy * CONSOLE_SCROLL_STEP_PX * conUiScale(), behavior: 'auto'});
          return;
        }
      }
    },
    /** Right-stick scroll of the review's scroll area. Returns true when it
     *  actually OVERFLOWS. */
    scrollReviewFeed(dy: number): boolean {
      const feed = document.querySelector<HTMLElement>('.con-bot-review__scroll');
      if (feed === null || feed.scrollHeight <= feed.clientHeight + 1) {
        return false;
      }
      if (Math.abs(dy) >= 0.05) {
        feed.scrollBy({top: dy * CONSOLE_SCROLL_STEP_PX * conUiScale(), behavior: 'auto'});
      }
      return true;
    },
    /**
     * X on the review — inspect the played card. A BONUS turn opens the
     * full-rules bonus-card inspect; a PROJECT turn opens the fullscreen browser
     * over the project cards the turn played (newest on screen).
     */
    inspectReviewCard(): boolean {
      const review = this.botTurnReviewState.review;
      if (review === undefined) {
        return false;
      }
      const card = review.card;
      // Service flips (tie-break / pick — themselves project cards) always page
      // LAST, so X opens the MAIN card first and the flips are reachable only by
      // browsing to the end (lower priority, per the review's card-order rule).
      const service: Array<ZoomCard> = (review.technicalReveals ?? []).map((t) => ({name: t.name} as CardModel));
      if (card?.kind === 'bonus') {
        // A BONUS turn is now part of the SAME pageable browser: the primary
        // bonus card first, then any secondary bonus card (Corp Competition
        // drew another), then the service flips — one LB/RB list, desktop parity.
        const entries: Array<ZoomCard> = [bonusZoomEntry(card.id, review.ctx)];
        if (card.secondaryCard !== undefined) {
          entries.push(bonusZoomEntry(card.secondaryCard, review.ctx));
        }
        entries.push(...service);
        // Bot-turn review — opened from log chips, no card tiles → TEXTUAL.
        openConsoleCardZoom(entries, 0, undefined, undefined, {contextLabel: 'MarsBot turn', origin: {kind: 'textual'}});
        return true;
      }
      // A project turn: the played card(s) FIRST, then the service flips LAST.
      const projects: Array<ZoomCard> = this.reviewCardNames.map((name) => ({name} as CardModel));
      const entries = [...projects, ...service];
      if (entries.length === 0) {
        return false;
      }
      openConsoleCardZoom(entries, 0, undefined, undefined, {contextLabel: 'MarsBot turn', origin: {kind: 'textual'}});
      return true;
    },
    /** PHYSICAL zoom origin for the hand grid: the fullscreen card lifts out
     *  of the `data-zoom-slot` tile; browsing LB/RB moves `handIndex`, whose
     *  section watcher scrolls the slot into view — so the close flight
     *  always has a live slot to land in (a still-virtualized slot falls
     *  back to the inspector dive gracefully). */
    handZoomOrigin() {
      const names = this.handEntries.map((e) => e.card.name);
      return slotZoomOrigin(
        () => document.querySelector<HTMLElement>('.con-hand'),
        (i) => names[i] ?? '',
        (i) => {
          this.consoleState.handIndex = i;
        },
      );
    },
    /** X in the hand section: read the focused card fullscreen. In SALE
     *  mode the viewer's A toggles the pick (a pure selection flip — the
     *  sale submit stays on the section's Y). In PLAY mode (P17 desktop
     *  parity) the viewer's A plays a PLAYABLE card through the existing
     *  play-confirm flow, and an unplayable card shows its structured
     *  «why not» reasons instead — never a mute fullscreen. */
    zoomHandCard(): void {
      if (this.handEntries.length === 0) {
        return;
      }
      // X mid-filter-glide: snap the episode first — the zoom flight measures
      // the slot rect, which is held-invisible under a flying proxy.
      if (runningHandRevealKind() === 'filter') {
        finishInstant();
      }
      const origin = this.handZoomOrigin();
      if (this.consoleState.sale.active) {
        openConsoleCardZoom(this.handEntries.map((e) => e.card), this.consoleState.handIndex, {
          isSelected: (name: CardName) => this.consoleState.sale.selected.includes(name),
          toggle: (name: CardName) => this.toggleSalePick(name),
        }, undefined, {origin});
        return;
      }
      // MANDATORY hand SELECT: fullscreen A submits the single-pick / toggles a
      // multi-pick; a non-candidate card surfaces its «why not» reason (single)
      // or is inert (multi — the reason is on the grid card / verdict bar).
      if (this.handSelectTaskActive) {
        const verb = this.handSelectModel?.buttonLabel || 'Select';
        const selectable = (name: CardName) => this.handSelectSelectableNames.includes(name);
        if (this.handSelectSingle) {
          openConsoleCardZoom(this.handEntries.map((e) => e.card), this.consoleState.handIndex, undefined, {
            labelFor: (name: CardName) => (selectable(name) ? verb : undefined),
            reasonsFor: (name: CardName) => {
              const r = this.handSelectReasons[name];
              return !selectable(name) && r !== undefined && r !== '' ? [r] : [];
            },
            execute: (name: CardName) => this.submitHandSelect([name]),
          }, {origin});
        } else {
          openConsoleCardZoom(this.handEntries.map((e) => e.card), this.consoleState.handIndex, {
            isSelected: (name: CardName) => this.consoleState.select.selected.includes(name),
            toggle: (name: CardName) => {
              if (selectable(name)) {
                this.toggleHandSelectPick(name);
              }
            },
          }, undefined, {origin});
        }
        return;
      }
      openConsoleCardZoom(this.handEntries.map((e) => e.card), this.consoleState.handIndex, undefined, {
        labelFor: (name: CardName) => {
          const entry = this.handEntries.find((e) => e.card.name === name);
          return entry?.playable === true ? 'Play now' : undefined;
        },
        reasonsFor: (name: CardName) => this.handUnplayableReasons(name),
        execute: (name: CardName) => this.openPlayCard(name),
        // «Разыграть» opens the play-confirm composer, which shows THIS card
        // — the fullscreen card flies INTO its slot there, not back to the hand.
        handoffTarget: () => '.con-composer--play [data-zoom-handoff="play-card"]',
      }, {origin});
    },
    /** Translated «why not» lines for a hand card (mirrors the hand
     *  section's info panel — same server-structured reasons, same shared
     *  formatter so the unit-suffixed "Сейчас: …" reads identically). */
    handUnplayableReasons(name: CardName): ReadonlyArray<string> {
      const entry = this.handEntries.find((e) => e.card.name === name);
      const reasons = entry?.card.unplayableReasons ?? [];
      return reasons.slice(0, 3).map((r) => unplayableReasonLine(r));
    },
    /** "Нельзя разыграть: <первая причина>" — the global fix so pressing A on
     *  an unplayable card never shows a bare block (the fork's always-explain
     *  rule). Pre-translated (showNotice's $t is a no-op on unknown strings),
     *  with an honest generic fallback when no structured reason surfaced. */
    handBlockedNotice(entry: ConsoleHandEntry): string {
      const first = (entry.card.unplayableReasons ?? [])[0];
      // No server RULES reason → the card is fine, it's just not the player's
      // window (opponent's turn / mid-placement) — name that honestly rather
      // than a misleading "conditions not met".
      if (first === undefined) {
        return translateText(this.handSoftReason);
      }
      return translateTextWithParams('Cannot play: ${0}', [unplayableReasonLine(first)]);
    },
    /** LT/RT: cycle the hand tag filter; R3: reset it to "All". Both preserve
     *  the selected card when it survives the new filter, else focus the first
     *  card of the filtered set (never a lost / dangling selection). */
    cycleHandFilter(dir: 1 | -1): void {
      this.applyHandFilterChange(() => {
        this.consoleState.handTagFilter = cycleTagFilter(this.handTagFilterOptions, this.consoleState.handTagFilter, dir);
      });
    },
    resetHandFilter(): void {
      if (this.consoleState.handTagFilter === 'all') {
        return;
      }
      this.applyHandFilterChange(() => {
        this.consoleState.handTagFilter = 'all';
      });
    },
    /**
     * Apply a tag-filter mutation as a PHYSICAL transition (the cards are
     * objects in the player's hand, they never blink): measure the OLD slot
     * rects + the dock homes BEFORE the change, apply it (entries recompute
     * synchronously — the director's state writes ride the SAME patch flush,
     * so nothing flashes), then hand the episode to `runHandFilterEpisode`:
     * leavers gather into the dock, enterers fan out of it, survivors glide
     * to their re-planned slots. Rapid re-filtering stays responsive: a
     * still-running episode is SNAPPED to its end state first (never queued).
     * Falls back to the plain instant switch outside the browsable open hand
     * (sale/select never reach here; staged-card / reduced-motion / unmounted
     * refs degrade the same way).
     */
    applyHandFilterChange(apply: () => void): void {
      const selectedName = this.handEntries[this.consoleState.handIndex]?.card.name;
      if (isHandRevealEpisodeRunning()) {
        // Re-filter mid-glide (or mid-open): snap the running episode to its
        // end state, then answer the new input from settled geometry.
        finishInstant();
      }
      const section = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
      const dock = this.$refs.handDock as InstanceType<typeof ConsoleHandDock> | undefined;
      const canAnimate = this.consoleState.section === 'hand' &&
        handRevealState.phase === 'open' && !isHandRevealEpisodeRunning() &&
        this.stagedHandCard === undefined &&
        section !== undefined && dock !== undefined;
      if (!canAnimate) {
        apply();
        this.refocusAfterFilter(selectedName);
        return;
      }
      const before = section.transitionTargets();
      apply();
      this.refocusAfterFilter(selectedName);
      const newNames = this.handEntries.map((e) => e.card.name);
      const involved = new Set<string>([...before.pairs.map((p) => p.name), ...newNames]);
      const dockRects = dock.sourceRects([...involved]);
      void runHandFilterEpisode({
        before: before.pairs.map((p) => ({name: p.name, rect: p.rect, visible: p.visible})),
        dock: dockRects,
        newNames,
        measureAfter: () => {
          // Seat the grid scroll on the refocused card FIRST (sync layout),
          // so the measured targets are the settled post-filter geometry.
          section.ensureSelectedVisible();
          return section.transitionTargets().pairs.map((p) => ({name: p.name, rect: p.rect, visible: p.visible}));
        },
      });
    },
    refocusAfterFilter(selectedName: CardName | undefined): void {
      const list = this.handEntries; // recomputed for the new filter
      const at = selectedName !== undefined ? list.findIndex((e) => e.card.name === selectedName) : -1;
      this.consoleState.handIndex = at >= 0 ? at : 0;
      const hand = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
      void this.$nextTick(() => hand?.ensureSelectedVisible());
    },
    /** P15: the sale pick flip, shared by the section's A and the viewer. */
    toggleSalePick(name: string): void {
      const at = this.consoleState.sale.selected.indexOf(name);
      if (at === -1) {
        this.consoleState.sale.selected.push(name);
      } else {
        this.consoleState.sale.selected.splice(at, 1);
      }
    },
    /** L3 in the sell-patents multi-select: select ALL sellable cards, or clear
     *  the selection if they're already all picked. */
    toggleSelectAllSale(): void {
      const names = this.saleSellableNames;
      if (names.length === 0) {
        return;
      }
      this.consoleState.sale.selected = this.saleAllSelected ? [] : [...names];
    },
    // ── mandatory hand SELECT (server `handSelect` task) ──────────────────
    /** A on a hand card in select mode: submit (single-pick) / toggle (multi),
     *  or explain WHY a non-candidate card can't be chosen (never a mute A). */
    handSelectPress(name: string): void {
      if (this.handSelectModel === undefined) {
        return;
      }
      if (!this.handSelectSelectableNames.includes(name)) {
        const reason = this.handSelectReasons[name];
        this.showNotice(reason !== undefined && reason !== '' ? reason : translateText('This card cannot be chosen here'));
        return;
      }
      if (this.handSelectSingle) {
        // Single-card pick: A submits it in one press (no toggle-then-confirm).
        this.submitHandSelect([name]);
        return;
      }
      this.toggleHandSelectPick(name);
    },
    /** Multi-select toggle (respects `max` — a full set ignores a new pick). */
    toggleHandSelectPick(name: string): void {
      const picked = this.consoleState.select.selected;
      const at = picked.indexOf(name);
      if (at !== -1) {
        picked.splice(at, 1);
        return;
      }
      if (picked.length >= (this.handSelectModel?.max ?? 1)) {
        return;
      }
      picked.push(name);
    },
    /** RT / confirm: submit the accumulated multi-select picks (bounds-checked). */
    confirmHandSelect(): void {
      const model = this.handSelectModel;
      if (model === undefined) {
        return;
      }
      const picked = this.consoleState.select.selected;
      if (picked.length < model.min || picked.length > model.max) {
        return;
      }
      this.submitHandSelect([...picked]);
    },
    /** Submit the mandatory hand-select answer. The TOP-LEVEL SelectCard takes
     *  the BARE {type:'card', cards} (no OR wrapping) — byte-identical to the
     *  desktop hand-select overlay's `onHandSelect`. */
    submitHandSelect(cards: ReadonlyArray<string>): void {
      closeConsoleLayers();
      this.consoleState.select.selected = [];
      this.consoleState.select.suitableOnly = true;
      this.consoleState.section = 'board';
      this.submit(cardsResponse(cards as ReadonlyArray<CardName>));
    },
    /** LT: flip the "suitable only" filter (candidates-only ↔ the whole hand).
     *  Keeps the focus on the same card when it survives, else the first one. */
    toggleSuitableOnly(): void {
      if (!this.handSelectFiltered) {
        return;
      }
      const focused = this.handEntries[this.consoleState.handIndex]?.card.name;
      this.consoleState.select.suitableOnly = !this.consoleState.select.suitableOnly;
      void this.$nextTick(() => {
        const list = this.handEntries;
        const at = focused !== undefined ? list.findIndex((e) => e.card.name === focused) : -1;
        this.consoleState.handIndex = at >= 0 ? at : 0;
        const hand = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
        hand?.ensureSelectedVisible();
      });
    },
    // ── transport ────────────────────────────────────────────────────────
    submit(response: unknown): void {
      const wfRef = this.$refs.waitingFor as {onsave?: (out: unknown) => void} | undefined;
      wfRef?.onsave?.(response);
    },
    submitBatch(responses: ReadonlyArray<unknown>): void {
      const wfRef = this.$refs.waitingFor as {onsaveBatch?: (out: ReadonlyArray<unknown>) => void} | undefined;
      wfRef?.onsaveBatch?.(responses);
    },
    showNotice(key: string): void {
      this.notice = key;
      if (this.noticeTimer !== undefined) {
        window.clearTimeout(this.noticeTimer);
      }
      this.noticeTimer = window.setTimeout(() => {
        this.notice = '';
      }, motionMs(2400));
    },
  },
  mounted() {
    this.offIntent = registerConsoleIntentHandler((intent) => this.handleIntent(intent));
    // The console-mode <html> class is owned by GamepadLayer (it spans every
    // lifecycle screen); the shell only reports its own presence.
    this.consoleState.shellMounted = true;
    // The hand-reveal director owns WHEN the section switches during its
    // episodes (and re-seats the grid scroll on a mid-close reopen).
    setHandRevealHooks({
      setSection: (s) => {
        this.consoleState.section = s;
      },
      restoreScroll: (px) => {
        (this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined)?.restoreScroll(px);
      },
    });
    // Clear any scale-overview tooltip a stray real-mouse hover left showing
    // before the shell reported its presence (mouse tooltips are suppressed in
    // console mode from here on — see ArcScale.mouseTooltipsSuppressed).
    hideScaleTooltip();
    startConsoleLeakDetector(() => this.playerView);
    // T6: the notification CTAs go through the typed notificationBus;
    // PlayerHome's listeners don't exist in console — the shell answers them.
    (this as unknown as {__notifOff: Array<() => void>}).__notifOff = [
      notificationBus.goToAction.on(this.onNotificationGoToAction),
      notificationBus.cancel.on(this.onNotificationCancel),
    ];
  },
  beforeUnmount() {
    this.offIntent?.();
    resetHandReveal(); // never leak a mid-episode timeline / held dock
    resetHandDelivery(); // never leak a mid-flight delivery / held dock
    if (this.noticeTimer !== undefined) {
      window.clearTimeout(this.noticeTimer);
    }
    this.releasePresentationLease?.();
    this.releasePresentationLease = undefined;
    this.consoleState.shellMounted = false;
    stopConsoleLeakDetector();
    resetGovScaleFocus();
    releaseZoomMotion();
    this.zoomOpenToken++; // fence out any stale open-sequence callback
    this.clearZoomOpenFlight();
    abortTradeFleet(); // recall any in-flight fleet (zombie-safe on teardown)
    abortHydroMarker(); // recall any in-flight marker glide (zombie-safe)
    abortBoardCardBonus('instant'); // recall any in-flight bonus cover (zombie-safe)
    abortDeckDraw(); // drop any in-flight deck-draw scene (zombie-safe)
    abortPlayedHero(); // unwind any in-flight played-card hero scene (zombie-safe)
    document.body.classList.remove('con-zoom-open');
    document.body.classList.remove('con-play-modal-open');
    this.clearDepartingPlayCard();
    (this as unknown as {__notifOff?: Array<() => void>}).__notifOff?.forEach((off) => off());
  },
});
</script>
