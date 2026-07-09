<template>
  <div class="con-root">
    <!-- P27: the strip is player IDENTITY + live turn STATUS only — the
         cards/actions counters live in the right home panel now, and the
         viewer's "your turn" reads from their own chip (no central pill). -->
    <ConsoleStatusStrip :playerView="playerView" :epoch="playerView.runId" />

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
    <div v-if="(hostTask !== undefined || shellTask !== undefined || startTask !== undefined) && consoleState.task.deferred" class="con-banner con-banner--deferred">
      <span class="con-banner__pulse" aria-hidden="true"></span>
      <span>{{ $t('Awaiting decision') }}</span>
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

    <!-- OPTIONAL draft re-pick: the fork does NOT surface re-picking (desktop
         parity). A calm, non-blocking waiting banner tells the player their
         pick is locked while the other players choose; the board stays fully
         inspectable underneath (pointer-events: none). WaitingFor's headless
         poll transitions to the next round automatically. -->
    <div v-if="draftWaitActive" class="con-draftwait" role="status">
      <div class="con-draftwait__main">
        <span class="con-draftwait__pulse" aria-hidden="true"></span>
        <span class="con-draftwait__text">
          <span class="con-draftwait__title">{{ $t('Waiting for draft cards') }}</span>
          <span class="con-draftwait__sub">{{ $t('Your pick is locked — waiting for the other players.') }}</span>
        </span>
      </div>
      <!-- The desktop-style DRAFTED CARDS stack, adapted to the console glass
           language. X opens the read-only fullscreen browser (LB/RB paging). -->
      <div v-if="draftedCards.length > 0" class="con-draftwait__pile">
        <div class="con-draftwait__pile-head">
          <span class="con-draftwait__pile-label">{{ $t('DRAFTED CARDS') }}</span>
          <span class="con-draftwait__pile-count">{{ draftedCards.length }}</span>
        </div>
        <div class="con-draftwait__pile-stack">
          <div v-for="(card, idx) in draftedCards" :key="card.name + '-' + idx"
               class="con-draftwait__pile-slot" :style="{zIndex: idx + 1}">
            <Card :card="card" lightweight />
          </div>
        </div>
        <div class="con-draftwait__pile-hint"><GamepadGlyph control="secondary" /><span>{{ $t('Inspect') }}</span></div>
      </div>
    </div>

    <!-- Terraforming complete — the one-shot console-native cinematic event
         (pointer-events: none, bounded lifetime; the persistent state lives
         in the top-HUD rail + generation marker). -->
    <ConsoleTerraformingBanner />

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
                            :convertPlants="convertPlantsReady" :convertHeat="convertHeatReady" />
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
                           :loading="cellInfoLoading"
                           :viewerColor="thisPlayer.color"
                           :players="playerView.players"
                           :placementTitle="placementTitle"
                           :selectedLegal="selectedCellLegal"
                           :illegalReason="selectedCellIllegalReason"
                           :inspectAll="consoleState.freeRoam"
                           :cancellable="placementCancellable"
                           :myTurn="myTurn"
                           :cardsPlayable="cardsPlayableCount"
                           :cardsTotal="cardsTotalCount"
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
                          :select="handSelectProps"
                          :softReason="handSoftReason"
                          :tagFilters="handTagFilterOptions"
                          :activeTag="consoleState.handTagFilter" />
      <ConsoleColoniesSection v-if="consoleState.section === 'colonies'"
                              :colonies="coloniesForRail"
                              :index="consoleState.colonyIndex"
                              :tradeable="tradeableColonyNames"
                              :tradeBlockReason="colonyTradeBlockReason"
                              :pick="colonyPick"
                              :players="playerView.players"
                              :viewerColor="thisPlayer.color"
                              :tradeOffset="thisPlayer.colonyTradeOffset ?? 0" />
      <!-- The console-NATIVE Hydronetwork screen (the full rework — the
           desktop overlay is no longer re-hosted here). One shared brain:
           hydroNetworkState + buildHydroModel; the shell keeps the pick
           sheet + the byte-identical submit batch. -->
      <ConsoleHydroSection v-if="consoleState.section === 'hydro'"
                           ref="hydroSection"
                           :playerView="playerView"
                           :actionAvailable="hydroActionAvailable"
                           :cacheKey="String(game.generation)"
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
      <ConsoleTaskHost v-if="hostTask !== undefined && !govSupportActive && !govScaleFocusState.holding && !consoleState.task.deferred && taskSpacePending === undefined"
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

    <!-- CTS T5: the game-opening START SCENE (initialCards wizard /
         start-sequence ceremony) — the console-native replacement for
         both desktop start surfaces. B defers to the amber chip. -->
    <transition name="con-layer">
      <ConsoleStartScene v-if="startTask !== undefined && !govScaleFocusState.holding && !consoleState.task.deferred"
                         ref="startScene"
                         :playerView="playerView"
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
                   :card="consoleCardZoom.card"
                   :cards="consoleCardZoom.cards.length > 1 ? consoleCardZoom.cards : undefined"
                   :index="consoleCardZoom.index"
                   :selected="zoomSelected"
                   @navigate="onCardZoomNavigate"
                   @close="onCardZoomClosed">
      <template #actions>
        <!-- A read-only SOURCE viewer (opened via L3 from the reveal) names
             itself, so the card never reads as an ordinary picked card. -->
        <div v-if="consoleCardZoom.contextLabel !== undefined" class="con-zoom__context">
          <span class="con-zoom__context-mark" aria-hidden="true">◈</span>
          <span>{{ $t(consoleCardZoom.contextLabel) }}</span>
        </div>
        <!-- P17: an UNPLAYABLE card is never mute — the same structured
             server reasons the hand verdict shows (desktop parity). -->
        <div v-if="zoomReasons.length > 0" class="con-zoom__reasons">
          <span class="con-zoom__reasons-head"><span aria-hidden="true">✕</span> {{ $t('Unplayable now') }}</span>
          <span v-for="(r, i) in zoomReasons" :key="i" class="con-zoom__reason">{{ r }}</span>
        </div>
        <div class="con-zoom__bar">
          <span v-if="zoomSelected" class="con-zoom__state">✓ {{ $t('Card selected') }}</span>
          <!-- The RECEIVE bridge (drawn-cards reveal) — A takes the on-screen
               card without leaving the viewer; RT takes them all. -->
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
          <span v-if="consoleCardZoom.cards.length > 1" class="con-zoom__cmd">
            <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
            <span>{{ $t('Browse') }}</span>
          </span>
          <button class="con-zoom__btn" @click="closeZoomViewer">
            <GamepadGlyph control="back" />
            <span>{{ $t('Close') }}</span>
          </button>
        </div>
      </template>
    </CardZoomModal>

    <ConsoleCommandBar :context="commandContext" :commands="commands" />

    <!-- HEADLESS transport: the WaitingFor brain (polling / holds / modal
         routing / SelectSpace placement handlers) runs unchanged; its INLINE
         rendering is hidden. Its teleported surfaces (MandatoryInputModal,
         PlacementBanner) render at body level = the iteration-1 FALLBACK. -->
    <div class="con-wf-host" aria-hidden="true">
      <waiting-for v-if="game.phase !== 'end'" ref="waitingFor"
                   :playerView="playerView"
                   :waitingfor="playerView.waitingFor"
                   :modal-suppressed="activeConsoleTask !== undefined || startTask !== undefined || draftWaitActive || govScaleFocusState.holding || govScaleFocusState.closing"></waiting-for>
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
                              @cancel="pendingPlayCard = undefined" />
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
import ConsoleTerraformingBanner from '@/client/components/console/ConsoleTerraformingBanner.vue';
import ConsoleBotTurnReview from '@/client/components/console/ConsoleBotTurnReview.vue';
import {botTurnReviewState, closeBotTurnReview, setBotReviewPeek} from '@/client/components/marsbot/botTurnReviewState';
import {openBotTurnReviewByKey, stepBotTurnReview} from '@/client/components/marsbot/marsBotPresentation';
import {acquireForegroundLease, isMandatoryPromptsHeld} from '@/client/components/presentation/presentationFlow';
import {PendingQueueSummary} from '@/client/components/presentation/presentationPolicy';
import {notificationState, pendingSummary, dismiss as dismissNotification} from '@/client/components/notifications/notificationState';
import {LiveNotification} from '@/client/components/notifications/notificationTypes';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';
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
import {buildRtQuickEntries, buildLtQuickEntries, buildStdProjectItems, buildHomeMaSummary, HomeMaSummary, QuickEntry, QuickSlot, QUICK_SLOT_GLYPH, StdProjectItem} from '@/client/console/consoleQuickModel';
import ConsoleContextPanel from '@/client/components/console/ConsoleContextPanel.vue';
import {scaleTooltipState, ScaleTooltipContent} from '@/client/components/board/scaleTooltipState';
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
import ConsoleTaskHost from '@/client/components/console/ConsoleTaskHost.vue';
import ConsoleGovernmentSupport from '@/client/components/console/ConsoleGovernmentSupport.vue';
import ConsoleStartScene from '@/client/components/console/ConsoleStartScene.vue';
import ConsoleRevealOverlay, {ConsoleRevealMode} from '@/client/components/console/ConsoleRevealOverlay.vue';
import ConsolePlayCardConfirm from '@/client/components/console/ConsolePlayCardConfirm.vue';
import ConsoleColonyTradeConfirm from '@/client/components/console/ConsoleColonyTradeConfirm.vue';
import ConsoleColonyInspect from '@/client/components/console/ConsoleColonyInspect.vue';
import {colonyGridCols, colonyGridLayout, colonyNavStep, consoleColoniesUi, resetConsoleColoniesUi} from '@/client/console/consoleColoniesModel';
import {buildTradeBatch, TradeStep} from '@/client/components/colonies/colonyTradePlan';
import {buildPlayCardBatch} from '@/client/console/consolePlayCardComposer';
import {fetchColonyTradePreview} from '@/client/components/colonies/colonyTradePreviewFetch';
import {ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import Card from '@/client/components/card/Card.vue';
import {ZoomCard, bonusZoomEntry} from '@/client/components/card/cardZoomTypes';
import {consoleCardZoom, openConsoleCardZoom, navigateConsoleCardZoom, closeConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {revealViewerState} from '@/client/components/notifications/revealViewerState';
import {ConsoleTask, taskFor, taskServedByHost, SCENE_KINDS, SHELL_SECTION_KINDS} from '@/client/console/consoleTaskRouter';
import {cancelResponse, cardsResponse, colonyResponse, orWrappedResponse} from '@/client/console/taskResponses';
import {leakDetectorState, startConsoleLeakDetector, stopConsoleLeakDetector} from '@/client/console/consoleLeakDetector';
import {govScaleFocusState, beginGovScaleClose, commitGovScaleFocus, resetGovScaleFocus} from '@/client/console/consoleGovScaleFocus';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
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
import {boardInfoState, configureBoardInfo} from '@/client/components/board/boardInfoState';
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
    ConsoleTerraformingBanner,
    ConsoleBotTurnReview,
    ConsoleCommandBar,
    ConsoleSheet,
    ConsoleMaScreen,
    ConsoleMaConfirm,
    ConsoleMaInspect,
    ConsoleMaCeremony,
    ConsoleQuickSelector,
    ConsoleStdProjectsScreen,
    ConsoleContextPanel,
    ConsoleBoardSection,
    ConsoleHandSection,
    ConsoleResourcePanel,
    ConsoleColoniesSection,
    ConsoleInfoMode,
    ConsoleStrandedPrompt,
    ConsoleTaskHost,
    ConsoleGovernmentSupport,
    ConsoleStartScene,
    ConsoleRevealOverlay,
    ConsolePlayCardConfirm,
    ConsoleColonyTradeConfirm,
    ConsoleColonyInspect,
    CardZoomModal,
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
  },
  data() {
    return {
      consoleState,
      consoleCardZoom,
      infoModeState,
      leakDetectorState,
      govScaleFocusState,
      botTurnReviewState,
      pendingPlayCard: undefined as PendingPlayCard | undefined,
      pendingClientPayment: undefined as PendingClientPayment | undefined,
      /** P24: the hydro pick-sheet candidates (name + live animal count). */
      hydroPickCards: [] as Array<{name: CardName, current?: number}>,
      pendingTradeColony: undefined as {colonyName: ColonyName, paymentOptions: TradeColonyContext['paymentOptions'], disabledPayments: TradeColonyContext['disabledPayments'], preview?: ColonyTradePreviewModel} | undefined,
      /** X = «Осмотреть» — the read-only colony dossier overlay. */
      colonyInspectOpen: false,
      /** A colony name opened READ-ONLY from the journal (X on a colony row). */
      journalColonyInspect: undefined as ColonyName | undefined,
      convertPlantsPending: undefined as ConvertPlantsMatch | undefined,
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
      return (this.playAction?.input.cards ?? []).filter((c) => c.isDisabled !== true).length;
    },
    cardsTotalCount(): number {
      return this.playerView.cardsInHand.length + (this.thisPlayer.selfReplicatingRobotsCards ?? []).length;
    },
    actionsAvailableCount(): number {
      return this.thisPlayer.availableBlueCardActionCount;
    },
    actionsTotalCount(): number {
      return playerActionSourceCount(this.thisPlayer.tableau);
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
      return this.consoleRevealMode !== undefined || this.presentationHeld;
    },
    /** The visible flow-holding notification (the compact AI-turn card), if any. */
    foregroundHoldingCard(): LiveNotification | undefined {
      return notificationState.transient.find((n) => n.holdsFlow === true);
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
    /** The task-host task (undefined = not served natively → fallback/other surfaces). */
    activeConsoleTask(): ConsoleTask | undefined {
      if (this.presentationHeld) {
        return undefined;
      }
      return taskServedByHost(this.playerView);
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
    /** A SHELL-SECTION task (T3/T4): projectCard → hand / std sheet; colony → rail. */
    shellTask(): ConsoleTask | undefined {
      if (this.presentationHeld) {
        return undefined;
      }
      const task = taskFor(this.playerView);
      return task !== undefined && SHELL_SECTION_KINDS.has(task.kind) ? task : undefined;
    },
    /** The T5 START SCENE task (initialCards wizard / start-sequence ceremony). */
    startTask(): ConsoleTask | undefined {
      if (this.presentationHeld) {
        return undefined;
      }
      const task = taskFor(this.playerView);
      return task !== undefined && SCENE_KINDS.has(task.kind) ? task : undefined;
    },
    /** OPTIONAL draft re-pick — the fork shows a calm "waiting for the other
     *  players" banner instead of offering to change the pick (desktop parity). */
    draftWaitActive(): boolean {
      return taskFor(this.playerView)?.kind === 'draftWait';
    },
    /** Cards already drafted this round (server-managed; cleared at endRound) —
     *  drawn as the desktop-style stack beside the draftWait banner. */
    draftedCards(): ReadonlyArray<CardModel> {
      return this.playerView.draftedCards ?? [];
    },
    /** The T6 REVEAL overlay mode (drawn > result > viewer), undefined = none. */
    consoleRevealMode(): ConsoleRevealMode | undefined {
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
    /** The active space prompt (server top-level OR the convert-plants inner). */
    activeSpacePrompt(): PlayerInputModel | undefined {
      const wf = this.playerView.waitingFor;
      if (wf?.type === 'space') {
        return wf;
      }
      return this.convertPlantsPrompt;
    },
    placementTitle(): string {
      const t = this.activeSpacePrompt?.title;
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
      const prompt = this.activeSpacePrompt;
      const id = this.consoleState.boardSpaceId;
      if (prompt === undefined || prompt.type !== 'space' || id === undefined || this.selectedCellLegal) {
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
        return translateText('Awaiting decision');
      }
      // A shell-section task (play-from-hand / std project / colony pick):
      // the banner names the server's ask over the serving section.
      if (this.shellTaskActive) {
        const t = this.playerView.waitingFor?.title;
        if (t !== undefined) {
          return typeof t === 'string' ? translateText(t) : translateMessage(t);
        }
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
        default: return 'Awaiting decision';
        }
      }
      if (this.draftWaitActive) {
        return 'Waiting for draft cards';
      }
      if (this.consoleRevealMode !== undefined) {
        return 'Cards';
      }
      if (this.startTask !== undefined && !this.consoleState.task.deferred) {
        return 'Start of the game';
      }
      if (this.govSupportActive && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        return 'Government Support';
      }
      if (this.hostTask !== undefined && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        return 'Awaiting decision';
      }
      if (this.pendingPlayCard !== undefined) {
        return 'Play project card';
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
      // PRESENTATION FLOW: the compact AI-turn card is the foreground item —
      // its contract owns the bar (X open the review, B close).
      if (this.foregroundHoldingCard !== undefined && this.consoleCardZoom.card === undefined) {
        const cmds: Array<ConsoleCommand> = [];
        if (this.foregroundHoldingCard.botTurnKey !== undefined) {
          cmds.push({control: 'secondary', label: 'Watch turn'});
        }
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
      }
      // Scale-focus hold: an inert transition beat — no command hints.
      if (this.govScaleFocusState.holding || this.govScaleFocusState.closing) {
        return [];
      }
      if (this.consoleState.fallbackActive) {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: 'Back'},
        ];
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
        // The overlay footer carries the detailed contract; the bar mirrors it.
        return [
          {control: 'dpadH', label: 'Navigate'},
          {control: 'confirm', label: this.consoleRevealMode === 'drawn' ? 'Take card' : 'OK'},
          {control: 'secondary', label: 'Inspect'},
          {control: 'back', label: this.consoleRevealMode === 'drawn' ? 'Take all cards' : 'Close'},
        ];
      }
      if (this.startTask !== undefined && !this.consoleState.task.deferred) {
        // The scene footer carries the detailed contract; the bar mirrors it.
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          {control: 'secondary', label: 'Continue'},
          {control: 'back', label: 'Back'},
        ];
      }
      if (this.govSupportActive && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        // The panel footer carries the context-aware contract; the bar mirrors it.
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Apply'},
          {control: 'back', label: 'Minimize'},
        ];
      }
      if (this.hostTask !== undefined && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        // The task frame carries the detailed contract; the bar mirrors it.
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          {control: 'secondary', label: 'Confirm'},
          {control: 'back', label: this.pendingClientPayment !== undefined ? 'Cancel' : 'Minimize'},
        ];
      }
      if (this.pendingPlayCard !== undefined) {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
          {control: 'secondary', label: 'Play now'},
          {control: 'back', label: 'Cancel'},
        ];
      }
      if (this.pendingTradeColony !== undefined) {
        // The composer mirrors its live state (consoleColoniesUi) — the bar
        // is the ONLY hint surface (no inline duplicates).
        if (consoleColoniesUi.composerSub === 'lanes') {
          return [
            {control: 'dpad', label: 'Navigate'},
            {control: 'triggerR', label: 'Max'},
            {control: 'confirm', label: 'Done'},
            {control: 'back', label: 'Back'},
          ];
        }
        if (consoleColoniesUi.composerSub === 'list') {
          return [
            {control: 'dpad', label: 'Navigate'},
            {control: 'confirm', label: 'Select'},
            {control: 'back', label: 'Back'},
          ];
        }
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select', enabled: consoleColoniesUi.composerEditable},
          {control: 'secondary', label: 'Confirm trade', enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
          {control: 'back', label: 'Cancel'},
        ];
      }
      if (this.colonyInspectActive) {
        const cmds: Array<ConsoleCommand> = [];
        // Section source: ←/→ pages colonies + A trades a live-tradeable one.
        if (this.journalColonyInspect === undefined) {
          cmds.push({control: 'dpad', label: 'Navigate'});
          if (this.colonyInspectTradeable) {
            cmds.push({control: 'confirm', label: 'Trade'});
          }
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
            {control: 'dpad', label: 'Navigate'},
            {control: 'confirm', label: 'Select'},
            {control: 'back', label: 'Close'},
          ];
        }
        const cmds: Array<ConsoleCommand> = [
          {control: 'dpad', label: 'Entries'},
          {control: 'confirm', label: consoleJournalUi.focusExpanded ? 'Collapse' : 'Details', enabled: consoleJournalUi.focusIsGroup},
          // P29: X = «Осмотреть» — cards, standard projects/actions, hydro,
          // map-only entries (never the too-narrow «Карта»).
          {control: 'secondary', label: 'Inspect', enabled: consoleJournalUi.focusInspectable},
        ];
        if (consoleJournalUi.focusHasSpace) {
          cmds.push({control: 'stickL', label: 'Show on map'});
        }
        cmds.push(
          {control: 'bumperL', control2: 'bumperR', label: 'Mode'},
          {control: 'triggerL', control2: 'triggerR', label: 'Generation',
            enabled: consoleJournalUi.canPrevGen || consoleJournalUi.canNextGen},
        );
        if (consoleJournalUi.filterAvailable) {
          cmds.push({control: 'stickR', label: 'Filter'});
        }
        cmds.push(
          {control: 'inspect', label: 'Information'},
          {control: 'back', label: 'Close'},
        );
        return cmds;
      }
      if (this.consoleState.quick !== undefined) {
        // P27: the bar mirrors the selector's OWN slot map — one source.
        const cmds: Array<ConsoleCommand> = this.quickEntries.map((e) => ({
          control: QUICK_SLOT_GLYPH[e.slot],
          label: e.label,
          enabled: e.available,
          badge: e.badge,
          highlight: e.available && (e.badge ?? 0) > 0,
        }));
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
      }
      if (this.consoleState.sheet === 'standardProjects') {
        const focusedStd = this.stdProjectItems[this.consoleState.sheetIndex];
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select', enabled: focusedStd?.available === true},
          {control: 'back', label: this.stdBackLabel},
        ];
      }
      if (this.maScreenKind !== undefined) {
        // P26: the hints mirror the REAL state — the verb is enabled only
        // when the focused item is actionable; bumpers switch the category.
        const focusedMa = this.maScreenItems[this.consoleState.sheetIndex];
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: this.maScreenKind === 'milestones' ? 'Claim' : 'Fund', enabled: focusedMa?.available === true},
          {control: 'secondary', label: 'Inspect'},
          {control: this.maScreenKind === 'milestones' ? 'bumperR' : 'bumperL',
            label: this.maScreenKind === 'milestones' ? 'Awards' : 'Milestones'},
          {control: 'back', label: this.awardFundingActive ? 'Minimize' : 'Close'},
        ];
      }
      if (this.consoleState.sheet !== undefined) {
        return [
          {control: 'dpad', label: 'Navigate'},
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
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          {control: 'stickL', label: this.saleAllSelected ? 'Unselect all' : 'Select all'},
          {control: 'secondary', label: 'Inspect'},
          {control: 'triggerR', label: 'Sell', enabled: n > 0, badge: n, highlight: n > 0},
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
        const cmds: Array<ConsoleCommand> = [{control: 'dpad', label: 'Navigate'}];
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
          {control: 'dpad', label: 'Navigate'},
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
        cmds.push({control: 'inspect', label: 'Information'});
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
            {control: 'dpad', label: 'Navigate'},
            {control: 'confirm', label: pick.buttonLabel, enabled: pickable},
            {control: 'secondary', label: 'Inspect'},
            {control: 'inspect', label: 'Information'},
            {control: 'back', label: this.colonyCancellable ? 'Cancel' : 'Minimize'},
          ];
        }
        const selected = this.game.colonies[this.consoleState.colonyIndex];
        const tradeable = selected !== undefined && this.tradeableColonyNames.includes(selected.name);
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Trade', enabled: tradeable},
          {control: 'secondary', label: 'Inspect'},
          {control: 'inspect', label: 'Information'},
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
        return [
          {control: 'dpadH', label: 'Stages'},
          {control: 'bumperL', control2: 'bumperR', label: 'Bonus', enabled: consoleHydroUi.bonusChoice},
          {control: 'triggerR', label: 'Farthest available'},
          consoleHydroUi.mode === 'details' ?
            {control: 'confirm', label: 'Back to plan'} :
            {control: 'confirm', label: 'Reinforce', enabled: consoleHydroUi.primaryEnabled},
          {control: 'secondary', label: 'Details'},
          {control: 'back', label: 'To the board'},
        ];
      }
      // P27b: SCALE INSPECTION MODE — the bonus ring, B/R3 exit.
      if (this.consoleState.scaleInspecting) {
        return [
          {control: 'dpadH', label: 'Navigate'},
          {control: 'inspect', label: 'Information'},
          {control: 'back', label: 'To the board'},
          {control: 'stickR', label: 'Exit'},
        ];
      }
      // P27: BOARD INSPECTION MODE — strict cell traversal, B/L3 exit.
      if (this.consoleState.inspecting) {
        return [
          {control: 'dpad', label: 'Navigate'},
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
        {control: 'triggerR', label: 'Actions', badge: this.cardsPlayableCount + this.actionsAvailableCount,
          highlight: this.myTurn && (this.cardsPlayableCount + this.actionsAvailableCount) > 0},
        {control: 'triggerL', label: 'Basic actions'},
        {control: 'stickL', label: 'Inspect board'},
        {control: 'stickR', label: 'Scale inspection'},
        {control: 'view', label: 'Log'},
        {control: 'menu', label: 'System'},
      ];
    },
    // ── P15: the fullscreen viewer's select context ─────────────────────
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
    /** P17: «why not» lines when the current card is NOT actionable. */
    zoomReasons(): ReadonlyArray<string> {
      const z = this.consoleCardZoom;
      if (z.action === undefined || z.card === undefined || this.zoomActionLabel !== undefined) {
        return [];
      }
      return z.action.reasonsFor(z.card.name as CardName);
    },
    /** P15: the deferred-chip return verb, by what is actually pending. */
    deferReturnLabel(): string {
      if (this.startTask !== undefined) {
        return this.startTask.kind === 'initialDraft' ? 'Return to selection' : 'Resume start setup';
      }
      const t = this.hostTask ?? this.shellTask;
      if (t?.kind === 'handSelect') {
        return 'Return to selection';
      }
      if (t !== undefined && t.kind === 'cardSelect') {
        return t.mode === 'draft' ? 'Return to the draft' : 'Return to selection';
      }
      return 'Return to the decision';
    },
  },
  watch: {
    // A mandatory surface claimed the screen — the journal yields so the
    // task / placement / reveal is never hidden behind it (and never has
    // to share the pad with it).
    journalHardBlocked(now: boolean) {
      if (now && journalState.open) {
        journalState.open = false;
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
    // P13: the fullscreen viewer is a native <dialog> - open it on the
    // undefined->defined transition only (navigation keeps it open).
    'consoleCardZoom.card'(card: ZoomCard | undefined, prev: ZoomCard | undefined) {
      if (card !== undefined && prev === undefined) {
        void this.$nextTick(() => (this.$refs.cardZoom as {show?: () => void} | undefined)?.show?.());
      }
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
    // A fresh playerView: reconfigure the board-info fetcher (facts may have
    // changed), clamp transient indices to the fresh lists.
    playerView: {
      immediate: true,
      handler() {
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
          if (intent.button === 'secondary') {
            this.inspectReviewCard();
          } else if (intent.button === 'bumperL') {
            // LB → previous bot turn (edge notice at the first archived turn).
            stepBotTurnReview(-1);
          } else if (intent.button === 'bumperR') {
            // RB → next bot turn (edge notice if the next turn is not made yet).
            stepBotTurnReview(1);
          } else if (intent.button === 'stickL' && this.reviewMapSpaces.length > 0) {
            setBotReviewPeek(true, this.reviewMapSpaces);
          } else if (intent.button === 'back') {
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
      // PRESENTATION FLOW: a visible flow-holding notification (the compact
      // AI-turn card) is the foreground item — B closes it, X opens the «Разбор
      // хода» review. Deliberately CLAIMS only back/secondary/confirm (A is
      // swallowed so nothing submits under the card); navigation and scrolling
      // pass through, so the board stays inspectable. Ordinary corner toasts
      // never capture the pad (B stays "back" for navigation).
      const holdingCard = this.foregroundHoldingCard;
      if (holdingCard !== undefined && this.consoleCardZoom.card === undefined) {
        if (intent.kind === 'press' && intent.button === 'back') {
          dismissNotification(holdingCard.id);
          return true;
        }
        if (intent.kind === 'press' && intent.button === 'secondary' && holdingCard.botTurnKey !== undefined) {
          openBotTurnReviewByKey(holdingCard.botTurnKey);
          return true;
        }
        if (intent.kind === 'press' && intent.button === 'confirm') {
          return true;
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
          if (intent.button === 'back' || intent.button === 'secondary') {
            this.closeMaInspect();
          } else if (intent.button === 'confirm') {
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
        if (intent.kind === 'press' &&
            (intent.button === 'view' || (intent.button === 'back' && !journalLocalBack))) {
          this.closeJournal();
          return true;
        }
        // P27b consistency: Y = Information Mode on EVERY surface. The
        // journal's own player-filter moved to R3 (stickR) — so Y here opens
        // Info Mode like everywhere else. Suppressed while a local journal
        // layer (filter popover / inspect card / map peek) owns the pad, so Y
        // there still resolves that layer through the panel's own grammar.
        if (intent.kind === 'press' && intent.button === 'inspect' && !journalLocalBack) {
          this.toggleInfoMode();
          return true;
        }
        const panel = this.$refs.journalPanel as InstanceType<typeof ConsoleJournalPanel> | undefined;
        panel?.handleIntent(intent);
        return true;
      }
      // P27b: Y = INFORMATION MODE — ALWAYS (every surface's former local
      // Y verb moved to RT: task-host MAX/confirm, start-scene Continue,
      // reveal Take-all, sale-mode Sell, hydro Farthest). The two small
      // confirm dialogs keep the pad focused on the decision itself.
      if (intent.kind === 'press' && intent.button === 'inspect' &&
          this.consoleState.confirm === undefined && !this.consoleCardActionsUi.confirmOpen) {
        this.toggleInfoMode();
        return true;
      }
      // Draft re-pick WAITING: the pad is otherwise idle (the board stays
      // inspectable, Info Mode is handled above). X opens the read-only
      // drafted-cards viewer; every other button falls through to the board.
      if (this.draftWaitActive && intent.kind === 'press' && intent.button === 'secondary' && this.draftedCards.length > 0) {
        openConsoleCardZoom([...this.draftedCards], 0);
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
        if (intent.kind === 'press' && intent.button === 'confirm') {
          this.acceptConfirm();
        } else if (intent.kind === 'press' && intent.button === 'back') {
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
      switch (intent.button) {
      case 'bumperL':
        this.infoModeState.playerColor = cyclePlayer(colors, this.infoModeState.playerColor, -1);
        this.reconcileInfoDetail();
        break;
      case 'bumperR':
        this.infoModeState.playerColor = cyclePlayer(colors, this.infoModeState.playerColor, 1);
        this.reconcileInfoDetail();
        break;
      case 'secondary':
        this.openInfoDetail(viewedIsBot ? 'botBoard' : 'extras');
        break;
      case 'triggerL':
        // P27: the actions detail moved from Y to LT (Y toggles Info Mode).
        this.openInfoDetail(viewedIsBot ? 'botPlayed' : 'actions');
        break;
      case 'inspect':
        this.toggleInfoMode(); // Y closes — the same key that opened it
        break;
      case 'triggerR':
        this.openInfoDetail(viewedIsBot ? 'botBonus' : 'effects');
        break;
      case 'confirm':
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
      switch (intent.button) {
      case 'confirm':
        this.activateQuickSlot('center');
        break;
      case 'back':
        this.consoleState.quick = undefined;
        break;
      case 'triggerR':
        // The opening trigger toggles its own selector closed.
        this.consoleState.quick = this.consoleState.quick === 'actions' ? undefined : 'actions';
        break;
      case 'triggerL':
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
    /** RT — action categories (navigation surfaces; inspection always allowed). */
    executeRtEntry(id: string): void {
      switch (id) {
      case 'cards':
        this.deferShellTask(); // navigation-away
        this.consoleState.section = 'hand';
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
          if (intent.button === 'confirm') {
            this.activateStdItem(this.stdProjectItems[this.consoleState.sheetIndex]);
          } else if (intent.button === 'back') {
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
          switch (intent.button) {
          case 'confirm':
            this.activateMaItem(this.maScreenItems[this.consoleState.sheetIndex]);
            break;
          case 'secondary':
            // X → «Осмотреть»: open the full-text reader for the focused item.
            this.openMaInspect(this.maScreenItems[this.consoleState.sheetIndex]);
            break;
          case 'bumperL':
            if (this.maScreenKind !== 'milestones') {
              this.openSheet('milestones');
            }
            break;
          case 'bumperR':
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
        if (intent.button === 'confirm') {
          this.activateSheetRow(this.sheetRows[this.consoleState.sheetIndex]);
        } else if (intent.button === 'back') {
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
      switch (intent.button) {
      case 'bumperL':
        // Stable board semantics: LB = Milestones (viewable any time).
        // (P29c: the temporary board-scale tuner is gone — ×1.05 shipped
        // as the compiled default in ConsoleBoardSection.)
        if (onBoard) {
          this.openSheet('milestones');
        }
        return true;
      case 'bumperR':
        if (onBoard) {
          this.openSheet('awards');
        }
        return true;
      case 'view':
        this.toggleJournal();
        return true;
      case 'triggerR':
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
      case 'triggerL':
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
      case 'stickL':
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
      case 'stickR':
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
      case 'confirm':
        this.handleSectionConfirm();
        return true;
      case 'secondary':
        // P13 global rule: X reads the focused object fullscreen — in the
        // colonies section X = «Осмотреть» (the full colony dossier).
        if (this.consoleState.section === 'hand') {
          this.zoomHandCard();
        } else if (this.consoleState.section === 'colonies') {
          this.toggleColonyInspect();
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
      if (this.consoleState.section === 'board') {
        const board = this.$refs.boardSection as InstanceType<typeof ConsoleBoardSection> | undefined;
        if (this.placementActive && board?.activate() !== true) {
          this.showNotice('Cannot place here');
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
      this.openPlayCard(entry.card.name);
    },
    /** B: one calm step toward the console home (never destructive). */
    handleSectionBack(): void {
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
      if (this.consoleState.section === 'hand' || this.consoleState.section === 'colonies' || this.consoleState.section === 'hydro') {
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
    onPlayCardConfirmNative(payload: {branchIndex: number, preResponses: ReadonlyArray<unknown>, optionResponse: unknown, stepResponses: ReadonlyArray<unknown>, payment: Payment}): void {
      const action = this.playAction;
      const pending = this.pendingPlayCard;
      this.pendingPlayCard = undefined;
      if (pending === undefined || action === undefined) {
        return;
      }
      closeConsoleLayers();
      this.consoleState.section = 'board';
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
      if (intent.button === 'confirm' && this.colonyInspectTradeable) {
        this.closeColonyInspect();
        this.tryOpenColonyTrade();
        return;
      }
      if (intent.button === 'back' || intent.button === 'secondary') {
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
      this.pendingTradeColony = undefined;
      if (pending === undefined || ctx === undefined) {
        return;
      }
      const batch = buildTradeBatch({
        tradePath: ctx.path,
        paymentIndex: payload.paymentIndex,
        colonyName: pending.colonyName,
        steps: payload.steps,
        captures: payload.captures,
      });
      this.submitBatch(batch);
    },
    // ── hydro advance (mirrors PlayerHome.submitHydroAdvance) ───────────
    submitHydroAdvance(payload: {spend: number, rewardChoice: number | undefined, selectedCard?: CardName}): void {
      const path = findHydroActionPath(this.playerView.waitingFor);
      if (path === undefined) {
        return;
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
      this.submitBatch(responses);
      resetHydroPlan();
      this.consoleState.section = 'board';
    },
    confirmSale(): void {
      const picked = this.consoleState.sale.selected;
      if (picked.length === 0) {
        return;
      }
      const action = findSellPatentsAction(this.playerView.waitingFor);
      if (action === undefined) {
        this.showNotice('Not your turn to take any actions');
        return;
      }
      const cards = [...picked];
      closeConsoleLayers();
      this.consoleState.section = 'board';
      this.submit(wrapPath(action.path, {type: 'card' as const, cards}));
    },
    onConvertPlantsSpacePicked(spaceResponse: {type: 'space', spaceId: string}): void {
      const found = this.convertPlantsPending;
      this.convertPlantsPending = undefined;
      if (found === undefined || found.path.length === 0) {
        return;
      }
      this.submit(wrapPath(found.path, spaceResponse));
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
    },
    onCardZoomClosed(): void {
      closeConsoleCardZoom();
    },
    /** P15: the controller drives the viewer natively while it is open. */
    handleZoomIntent(intent: GamepadIntent): boolean {
      const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
      if (intent.kind === 'nav') {
        if (intent.dir === 'left') {
          zoom?.prev();
        } else if (intent.dir === 'right') {
          zoom?.next();
        }
        return true;
      }
      if (intent.kind !== 'press') {
        return true;
      }
      switch (intent.button) {
      case 'bumperL':
        zoom?.prev();
        return true;
      case 'bumperR':
        zoom?.next();
        return true;
      case 'confirm':
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
      case 'triggerR': {
        // RT = take all (RECEIVE bridge only); otherwise the viewer owns it.
        const r = this.consoleCardZoom.receive;
        if (r?.takeAll !== undefined) {
          r.takeAll();
        }
        return true;
      }
      case 'secondary': // X closes too — the same key that opened it
      case 'back':
        this.closeZoomViewer();
        return true;
      default:
        return true; // the viewer owns ALL input while open
      }
    },
    zoomToggleSelect(): void {
      const z = this.consoleCardZoom;
      if (z.select !== undefined && z.card !== undefined) {
        z.select.toggle(z.card.name as CardName);
      }
    },
    /** The RECEIVE bridge A-verb — take the card at the viewer's index. The
     *  opener (reveal overlay) owns the take + list-sync + close-on-last. */
    zoomTakeReceived(): void {
      const r = this.consoleCardZoom.receive;
      if (r !== undefined) {
        r.takeAt(this.consoleCardZoom.index);
      }
    },
    /** P17: the viewer's A hands the card to the context action (e.g. the
     *  play-confirm flow) — the viewer closes FIRST, so the exact source
     *  context restores underneath the follow-up surface. */
    zoomExecuteAction(): void {
      const z = this.consoleCardZoom;
      const card = z.card;
      const action = z.action;
      if (card === undefined || action === undefined || action.labelFor(card.name as CardName) === undefined) {
        return;
      }
      this.closeZoomViewer();
      action.execute(card.name as CardName);
    },
    closeZoomViewer(): void {
      (this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined)?.close();
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
          el.scrollBy({top: dy * CONSOLE_SCROLL_STEP_PX, behavior: 'auto'});
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
        feed.scrollBy({top: dy * CONSOLE_SCROLL_STEP_PX, behavior: 'auto'});
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
        openConsoleCardZoom(entries, 0, undefined, undefined, {contextLabel: 'MarsBot turn'});
        return true;
      }
      // A project turn: the played card(s) FIRST, then the service flips LAST.
      const projects: Array<ZoomCard> = this.reviewCardNames.map((name) => ({name} as CardModel));
      const entries = [...projects, ...service];
      if (entries.length === 0) {
        return false;
      }
      openConsoleCardZoom(entries, 0, undefined, undefined, {contextLabel: 'MarsBot turn'});
      return true;
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
      if (this.consoleState.sale.active) {
        openConsoleCardZoom(this.handEntries.map((e) => e.card), this.consoleState.handIndex, {
          isSelected: (name: CardName) => this.consoleState.sale.selected.includes(name),
          toggle: (name: CardName) => this.toggleSalePick(name),
        });
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
          });
        } else {
          openConsoleCardZoom(this.handEntries.map((e) => e.card), this.consoleState.handIndex, {
            isSelected: (name: CardName) => this.consoleState.select.selected.includes(name),
            toggle: (name: CardName) => {
              if (selectable(name)) {
                this.toggleHandSelectPick(name);
              }
            },
          });
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
      });
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
      const selectedName = this.handEntries[this.consoleState.handIndex]?.card.name;
      this.consoleState.handTagFilter = cycleTagFilter(this.handTagFilterOptions, this.consoleState.handTagFilter, dir);
      this.refocusAfterFilter(selectedName);
    },
    resetHandFilter(): void {
      if (this.consoleState.handTagFilter === 'all') {
        return;
      }
      const selectedName = this.handEntries[this.consoleState.handIndex]?.card.name;
      this.consoleState.handTagFilter = 'all';
      this.refocusAfterFilter(selectedName);
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
    startConsoleLeakDetector(() => this.playerView);
    // T6: the notification CTAs dispatch window events; PlayerHome's
    // listeners don't exist in console — the shell answers them instead.
    window.addEventListener('tm-notification-go-to-action', this.onNotificationGoToAction);
    window.addEventListener('tm-notification-cancel', this.onNotificationCancel);
  },
  beforeUnmount() {
    this.offIntent?.();
    if (this.noticeTimer !== undefined) {
      window.clearTimeout(this.noticeTimer);
    }
    this.releasePresentationLease?.();
    this.releasePresentationLease = undefined;
    this.consoleState.shellMounted = false;
    stopConsoleLeakDetector();
    resetGovScaleFocus();
    window.removeEventListener('tm-notification-go-to-action', this.onNotificationGoToAction);
    window.removeEventListener('tm-notification-cancel', this.onNotificationCancel);
  },
});
</script>
