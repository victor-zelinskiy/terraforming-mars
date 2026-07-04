<template>
  <div class="con-root">
    <ConsoleStatusStrip :game="game"
                        :players="playerView.players"
                        :thisPlayerColor="thisPlayer.color"
                        :cardsPlayable="cardsPlayableCount"
                        :cardsTotal="cardsTotalCount"
                        :actionsAvailable="actionsAvailableCount"
                        :actionsTotal="actionsTotalCount"
                        :epoch="playerView.runId" />

    <div v-if="bannerText !== ''" class="con-banner" :class="{'con-banner--action': bannerAction}">
      <span class="con-banner__pulse" aria-hidden="true"></span>
      <span>{{ bannerText }}</span>
      <span v-if="bannerAction && consoleState.sheet === undefined" class="con-banner__hint">
        <GamepadGlyph control="inspect" /><span>{{ $t('Basic actions') }}</span>
      </span>
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

    <div class="con-main">
      <ConsoleResourcePanel :player="thisPlayer" :epoch="playerView.runId" />
      <!-- v-show (NOT v-if): the board must stay in the DOM — the headless
           SelectSpace attaches placement handlers to its cells. -->
      <ConsoleBoardSection v-show="consoleState.section === 'board'"
                           ref="boardSection"
                           :playerView="playerView"
                           :placementActive="placementActive" />
      <!-- The right CONTEXT + COMMAND panel (board home / cell / task). -->
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
                           :milestonesClaimable="milestonesClaimableCount"
                           :awardsFundable="awardsFundableCount" />
      <ConsoleHandSection v-if="consoleState.section === 'hand'"
                          :entries="handEntries"
                          :index="consoleState.handIndex"
                          :saleActive="consoleState.sale.active"
                          :saleSelected="consoleState.sale.selected" />
      <ConsoleColoniesSection v-if="consoleState.section === 'colonies'"
                              :colonies="coloniesForRail"
                              :index="consoleState.colonyIndex"
                              :tradeable="tradeableColonyNames"
                              :tradeBlockReason="colonyTradeBlockReason"
                              :pick="colonyPick" />
      <!-- The premium Hydronetwork surface, mounted as a console screen.
           Its internals are driven by the demoted DOM focus engine (its
           scope def exists) — the console carves out ONLY LT (Info Mode). -->
      <div v-if="consoleState.section === 'hydro'" class="con-hydro-host con-info__scroll">
      <HydroNetworkOverlay ref="hydroOverlay"
                           :playerView="playerView"
                           :viewerId="playerView.id"
                           :actionAvailable="hydroActionAvailable"
                           :cacheKey="String(game.generation)"
                           @pick-action="openHydroPickSheet"
                           @pick-played-card="openHydroPickSheet"
                           @confirm="submitHydroAdvance($event)"
                           @close="consoleState.section = 'board'" />
      </div>
    </div>

    <!-- LT INFORMATION MODE — read-only player dashboard over everything
         console (fallback surfaces still render above at z12000+). -->
    <ConsoleInfoMode v-if="infoModeState.open" :playerView="playerView" :myTurn="myTurn" />

    <!-- Colony trade — the console-native confirm (CTS T8: the desktop
         modal re-host is retired; same and-response submit path). -->
    <transition name="con-layer">
      <ConsoleColonyTradeConfirm v-if="pendingTradeColony !== undefined"
                                 ref="tradeConfirm"
                                 :colony="pendingTradeColonyModel"
                                 :colonyName="pendingTradeColony.colonyName"
                                 :options="pendingTradeColony.paymentOptions"
                                 :disabledOptions="pendingTradeColony.disabledPayments"
                                 :players="playerView.players"
                                 @confirm="onColonyTradePaymentSelected($event)"
                                 @cancel="pendingTradeColony = undefined" />
    </transition>

    <ConsoleActionWheel v-if="consoleState.wheelOpen" :entries="wheelEntries" :index="consoleState.wheelIndex" />
    <ConsoleSheet v-if="consoleState.sheet !== undefined" :title="sheetTitle" :subtitle="sheetSubtitle" :kind="sheetMaKind" :allTaken="sheetAllTaken" :wide="sheetWide" :rows="sheetRows" :index="consoleState.sheetIndex" />

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

    <!-- T7: the card-action CONFIRM (desktop parity: an action is NEVER
         executed on a bare click — the player first sees what it does).
         Effects come from the same /api/action-preview the desktop modal
         uses; follow-up choices arrive as native tasks after confirm. -->
    <div v-if="pendingCardAction !== undefined" class="con-confirm con-actconfirm" role="dialog">
      <div class="con-confirm__backdrop" aria-hidden="true"></div>
      <div class="con-confirm__card con-actconfirm__card">
        <div class="con-task__kicker">
          <span class="con-task__kicker-mark" aria-hidden="true">◈</span>
          <span>{{ $t('Confirmation') }}</span>
        </div>
        <div class="con-confirm__title">{{ $t(pendingCardAction.cardName) }}</div>
        <div v-if="pendingCardAction.loading" class="con-actconfirm__loading">{{ $t('Loading') }}…</div>
        <template v-else-if="cardActionBranches.length > 0">
          <div v-for="(branch, i) in cardActionBranches" :key="i"
               class="con-actconfirm__branch"
               :class="{'con-actconfirm__branch--off': !branch.available}">
            <div v-if="cardActionBranches.length > 1" class="con-actconfirm__branch-title">{{ branchTitleText(branch) }}</div>
            <div class="con-actconfirm__effects">
              <ActionEffectChip v-for="(eff, k) in branch.effects" :key="k" :effect="eff" />
            </div>
            <div v-if="!branch.available && branch.unavailableReason !== undefined" class="con-actconfirm__reason">
              ✕ {{ branchReasonText(branch) }}
            </div>
          </div>
          <div v-if="cardActionBranches.length > 1" class="con-actconfirm__note">
            {{ $t('The choice of option follows after confirmation') }}
          </div>
        </template>
        <div v-else class="con-confirm__body">{{ $t('Confirm to perform this action.') }}</div>
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
      <ConsoleTaskHost v-if="hostTask !== undefined && !consoleState.task.deferred && taskSpacePending === undefined"
                       ref="taskHost"
                       :playerView="playerView"
                       :task="hostTask"
                       :prompt-override="pendingClientPayment !== undefined ? pendingClientPayment.input : undefined"
                       :defer-label="pendingClientPayment !== undefined ? 'Cancel' : 'Minimize'"
                       @submit="onTaskSubmit"
                       @defer="onTaskDefer"
                       @space-pick="onTaskSpacePick" />
    </transition>

    <!-- CTS T5: the game-opening START SCENE (initialCards wizard /
         start-sequence ceremony) — the console-native replacement for
         both desktop start surfaces. B defers to the amber chip. -->
    <transition name="con-layer">
      <ConsoleStartScene v-if="startTask !== undefined && !consoleState.task.deferred"
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
        <!-- P17: an UNPLAYABLE card is never mute — the same structured
             server reasons the hand verdict shows (desktop parity). -->
        <div v-if="zoomReasons.length > 0" class="con-zoom__reasons">
          <span class="con-zoom__reasons-head"><span aria-hidden="true">✕</span> {{ $t('Unplayable now') }}</span>
          <span v-for="(r, i) in zoomReasons" :key="i" class="con-zoom__reason">{{ r }}</span>
        </div>
        <div class="con-zoom__bar">
          <span v-if="zoomSelected" class="con-zoom__state">✓ {{ $t('Card selected') }}</span>
          <button v-if="zoomSelectable" class="con-zoom__btn con-zoom__btn--select" @click="zoomToggleSelect">
            <GamepadGlyph control="confirm" />
            <span>{{ $t(zoomSelected ? zoomDeselectLabel : zoomSelectLabel) }}</span>
          </button>
          <!-- P17: the context ACTION (play-from-hand parity) — A hands the
               card to the existing play flow; hidden when not actionable. -->
          <button v-else-if="zoomActionLabel !== undefined" class="con-zoom__btn con-zoom__btn--play" @click="zoomExecuteAction">
            <GamepadGlyph control="confirm" />
            <span>{{ $t(zoomActionLabel) }}</span>
          </button>
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
                   :modal-suppressed="activeConsoleTask !== undefined || startTask !== undefined"></waiting-for>
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
 *  MAIN BOARD = the console home screen. Stable semantics from it:
 *   LB → Milestones panel (badge = claimable count; viewable any time)
 *   RB → Awards panel (badge = fundable count; viewable any time)
 *   Y  → Basic actions (standard projects + sell patents + conversions + pass)
 *   LT → the category ACTION WHEEL (cards / card actions / …; journal NOT here)
 *   View → journal; B → calm (drops cell focus → home summary; never destructive)
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
import {SelectColonyModel, SelectPaymentModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {ActionPreview, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {getMilestone, getAward} from '@/client/MilestoneAwardManifest';
import {standardProjectVisual} from '@/client/components/overview/standardProjectVisuals';
import {playerActionSourceCount} from '@/client/components/actions/actionExtraction';
import {placementReasonToUnplayable} from '@/client/components/board/placementReason';

import WaitingFor from '@/client/components/WaitingFor.vue';
import SelectSpace from '@/client/components/SelectSpace.vue';
import {buildStandardProjectPaymentModel, hasUsableStandardProjectAlternativeResources, standardProjectPaymentTitle} from '@/client/components/payment/paymentModelUtils';

import ConsoleStatusStrip from '@/client/components/console/ConsoleStatusStrip.vue';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';
import ConsoleSheet, {ConsoleSheetRow} from '@/client/components/console/ConsoleSheet.vue';
import ConsoleActionWheel, {WheelEntry} from '@/client/components/console/ConsoleActionWheel.vue';
import ConsoleContextPanel from '@/client/components/console/ConsoleContextPanel.vue';
import ConsoleBoardSection from '@/client/components/console/ConsoleBoardSection.vue';
import ConsoleHandSection, {ConsoleHandEntry} from '@/client/components/console/ConsoleHandSection.vue';
import ConsoleResourcePanel from '@/client/components/console/ConsoleResourcePanel.vue';
import ConsoleColoniesSection, {ConsoleColonyPick} from '@/client/components/console/ConsoleColoniesSection.vue';
import ConsoleInfoMode from '@/client/components/console/ConsoleInfoMode.vue';
import ConsoleStrandedPrompt from '@/client/components/console/ConsoleStrandedPrompt.vue';
import ConsoleTaskHost from '@/client/components/console/ConsoleTaskHost.vue';
import ConsoleStartScene from '@/client/components/console/ConsoleStartScene.vue';
import ConsoleRevealOverlay, {ConsoleRevealMode} from '@/client/components/console/ConsoleRevealOverlay.vue';
import ConsolePlayCardConfirm from '@/client/components/console/ConsolePlayCardConfirm.vue';
import ConsoleColonyTradeConfirm from '@/client/components/console/ConsoleColonyTradeConfirm.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import {consoleCardZoom, openConsoleCardZoom, navigateConsoleCardZoom, closeConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {revealViewerState} from '@/client/components/notifications/revealViewerState';
import {ConsoleTask, taskFor, taskServedByHost, SCENE_KINDS, SHELL_SECTION_KINDS} from '@/client/console/consoleTaskRouter';
import {cancelResponse, colonyResponse, orWrappedResponse} from '@/client/console/taskResponses';
import {leakDetectorState, startConsoleLeakDetector, stopConsoleLeakDetector} from '@/client/console/consoleLeakDetector';
import HydroNetworkOverlay from '@/client/components/hydronetwork/HydroNetworkOverlay.vue';
import {hydroNetworkState, resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {resolveScope} from '@/client/gamepad/focusScopes';
import {consoleState, closeConsoleLayers, stepIndex, stepSelectable, registerConsoleIntentHandler, ConsoleSheetId} from '@/client/console/consoleRouter';
import {
  ConvertPlantsMatch,
  findAwardOptionPath,
  findConvertHeatOption,
  findConvertPlantsOption,
  findEndTurnPath,
  findHydroActionPath,
  findMilestoneOptionPath,
  findPassPath,
  findPerformActionCard,
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
    ConsoleCommandBar,
    ConsoleSheet,
    ConsoleActionWheel,
    ConsoleContextPanel,
    ConsoleBoardSection,
    ConsoleHandSection,
    ConsoleResourcePanel,
    ConsoleColoniesSection,
    ConsoleInfoMode,
    ConsoleStrandedPrompt,
    ConsoleTaskHost,
    ConsoleStartScene,
    ConsoleRevealOverlay,
    ConsolePlayCardConfirm,
    ConsoleColonyTradeConfirm,
    CardZoomModal,
    ActionEffectChip,
    HydroNetworkOverlay,
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
      pendingPlayCard: undefined as PendingPlayCard | undefined,
      pendingClientPayment: undefined as PendingClientPayment | undefined,
      /** P24: the hydro pick-sheet candidates (name + live animal count). */
      hydroPickCards: [] as Array<{name: CardName, current?: number}>,
      pendingTradeColony: undefined as {colonyName: ColonyName, paymentOptions: TradeColonyContext['paymentOptions'], disabledPayments: TradeColonyContext['disabledPayments']} | undefined,
      convertPlantsPending: undefined as ConvertPlantsMatch | undefined,
      /** A task's nested space-type option being picked on the board. */
      taskSpacePending: undefined as {index: number, spacePrompt: PlayerInputModel} | undefined,
      /** Prompt identity — a change resets the task defer state. */
      lastTaskKey: '',
      /** The reveal-result the player already acknowledged (until the server clears). */
      dismissedRevealKey: '',
      /** T7: the card-action confirm (preview-backed; nothing submitted yet). */
      pendingCardAction: undefined as {cardName: CardName, preview: ActionPreview | undefined, loading: boolean} | undefined,
      /** The player has actively focused a cell → the panel shows it (B drops back to the summary). */
      cellFocused: false,
      notice: '',
      noticeTimer: undefined as number | undefined,
      offIntent: undefined as (() => void) | undefined,
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
    milestonesClaimableCount(): number {
      return this.claimableTitles(findMilestoneOptionPath(this.playerView.waitingFor)?.options).size;
    },
    awardsFundableCount(): number {
      return this.claimableTitles(findAwardOptionPath(this.playerView.waitingFor)?.options).size;
    },
    // ── placement ───────────────────────────────────────────────────────
    /** The convert-plants inner SelectSpace, narrowed for the headless picker. */
    convertPlantsPrompt() {
      const p = this.convertPlantsPending?.spacePrompt;
      return p !== undefined && p.type === 'space' ? p : undefined;
    },
    /** The task-host task (undefined = not served natively → fallback/other surfaces). */
    activeConsoleTask(): ConsoleTask | undefined {
      return taskServedByHost(this.playerView);
    },
    /** What the ConsoleTaskHost renders: a server task OR the client payment. */
    hostTask(): ConsoleTask | undefined {
      if (this.pendingClientPayment !== undefined) {
        return CLIENT_PAYMENT_TASK;
      }
      return this.activeConsoleTask;
    },
    /** A SHELL-SECTION task (T3/T4): projectCard → hand / std sheet; colony → rail. */
    shellTask(): ConsoleTask | undefined {
      const task = taskFor(this.playerView);
      return task !== undefined && SHELL_SECTION_KINDS.has(task.kind) ? task : undefined;
    },
    /** The T5 START SCENE task (initialCards wizard / start-sequence ceremony). */
    startTask(): ConsoleTask | undefined {
      const task = taskFor(this.playerView);
      return task !== undefined && SCENE_KINDS.has(task.kind) ? task : undefined;
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
    contextMode(): 'placement' | 'cell' | 'idle' {
      if (this.placementActive) {
        return 'placement';
      }
      return this.cellFocused ? 'cell' : 'idle';
    },
    selectedCellInfo() {
      const info = boardInfoState.info;
      return info !== undefined && info.space === this.consoleState.boardSpaceId ? info : undefined;
    },
    cellInfoLoading(): boolean {
      return boardInfoState.loading && boardInfoState.spaceId === this.consoleState.boardSpaceId;
    },
    // ── hand ────────────────────────────────────────────────────────────
    handEntries(): Array<ConsoleHandEntry> {
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
    // ── banner ──────────────────────────────────────────────────────────
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
      if (this.myTurn) {
        return translateText('Your turn');
      }
      if (this.playerView.waitingFor === undefined) {
        return translateText('Waiting for other players');
      }
      return '';
    },
    bannerAction(): boolean {
      return this.myTurn && !this.placementActive;
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
    /** The pending card action's preview branches (empty while loading/failed). */
    cardActionBranches(): ReadonlyArray<ActionPreviewBranch> {
      return this.pendingCardAction?.preview?.branches ?? [];
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
    /** VP visibility for the player viewed in Information Mode. */
    infoVpVisible(): boolean {
      const color = infoModeState.playerColor;
      return color === this.thisPlayer.color || this.game.gameOptions.showOtherPlayersVP === true;
    },
    // ── the RT category wheel (journal deliberately NOT here; every
    //    sector carries a DIRECT hotkey; A = highlighted / default Cards) ─
    wheelEntries(): Array<WheelEntry> {
      const entries: Array<WheelEntry> = [
        {id: 'cards', label: 'Cards', barIcon: 'cards', shortcut: 'confirm', available: true, reason: '', badge: this.cardsPlayableCount},
        {id: 'cardActions', label: 'Card actions', barIcon: 'actions', shortcut: 'secondary', available: true, reason: '', badge: this.actionsAvailableCount},
        {id: 'effects', label: 'Effects', barIcon: 'effects', shortcut: 'bumperL', available: true, reason: ''},
      ];
      if (this.game.colonies.length > 0) {
        entries.push({id: 'colonies', label: 'Colonies', barIcon: 'colonies', shortcut: 'bumperR', available: true, reason: ''});
      }
      if (this.game.gameOptions.expansions.deltaProject) {
        entries.push({id: 'hydro', label: 'Hydronetwork', barIcon: 'hydronetwork', shortcut: 'inspect', available: true, reason: ''});
      }
      return entries;
    },
    // ── sheets ──────────────────────────────────────────────────────────
    sheetTitle(): string {
      switch (this.consoleState.sheet) {
      case 'basics': return 'Basic actions';
      case 'cardActions': return 'Card actions';
      case 'milestones': return 'Milestones';
      case 'awards': return 'Awards';
      case 'hydroPick': return 'Select action';
      case 'standardProjects': return 'Standard Projects';
      default: return '';
      }
    },
    /** P22: milestones/awards go near-fullscreen with a summary line. */
    sheetWide(): boolean {
      return this.consoleState.sheet === 'milestones' || this.consoleState.sheet === 'awards';
    },
    sheetSubtitle(): string {
      if (this.consoleState.sheet === 'milestones') {
        const claimed = this.game.milestones.filter((m) => m.playerName !== undefined && m.playerName !== '').length;
        return `${translateText('Claimed')}: ${claimed}/3`;
      }
      if (this.consoleState.sheet === 'awards') {
        const funded = this.game.awards.filter((a) => a.playerName !== undefined && a.playerName !== '').length;
        return `${translateText('Funded')}: ${funded}/3 · ${this.awardCostText()}`;
      }
      return '';
    },
    /** P23: the header symbol + the gold all-taken state. */
    sheetMaKind(): string {
      return this.consoleState.sheet === 'milestones' || this.consoleState.sheet === 'awards' ? this.consoleState.sheet : '';
    },
    sheetAllTaken(): boolean {
      if (this.consoleState.sheet === 'milestones') {
        return this.game.milestones.length > 0 && this.game.milestones.every((m) => m.playerName !== undefined && m.playerName !== '');
      }
      if (this.consoleState.sheet === 'awards') {
        return this.game.awards.length > 0 && this.game.awards.every((a) => a.playerName !== undefined && a.playerName !== '');
      }
      return false;
    },
    /** The NEXT award funding price as a number (8/14/20). */
    awardCostValue(): number {
      const funded = this.game.awards.filter((a) => a.playerName !== undefined && a.playerName !== '').length;
      return [8, 14, 20][funded] ?? 20;
    },
    sheetRows(): Array<ConsoleSheetRow> {
      switch (this.consoleState.sheet) {
      case 'basics':
        return this.basicsRows();
      case 'standardProjects':
        // The MANDATORY std-project prompt (T3): only the server's cards.
        return this.standardProjectRows(this.standardProjectsAction?.input.cards ?? []);
      case 'cardActions':
        return this.cardActionsRows();
      case 'milestones': {
        // P22: RICH rows — desktop information parity (art plate / rule /
        // MY progress vs the per-game threshold / rival badges / cost).
        const claimable = this.claimableTitles(findMilestoneOptionPath(this.playerView.waitingFor)?.options);
        return this.game.milestones.map((m) => {
          const claimed = m.playerName !== undefined && m.playerName !== '';
          let description = m.description ?? '';
          if (description === '') {
            try {
              description = getMilestone(m.name).description;
            } catch (err) {
              description = '';
            }
          }
          return {
            key: m.name,
            title: m.name,
            sub: description,
            available: claimable.has(m.name),
            reason: claimed ? '' : (claimable.has(m.name) ? '' : 'Unavailable right now'),
            takenBy: claimed && m.color !== undefined ? {color: m.color, name: m.playerName ?? ''} : undefined,
            ma: {
              kind: 'milestone' as const,
              name: m.name,
              scores: m.scores,
              threshold: m.threshold,
              cost: claimed ? undefined : 8,
              myColor: this.thisPlayer.color,
            },
          };
        });
      }
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
      case 'awards': {
        const fundable = this.claimableTitles(findAwardOptionPath(this.playerView.waitingFor)?.options);
        const cost = this.awardCostValue;
        return this.game.awards.map((a) => {
          const funded = a.playerName !== undefined && a.playerName !== '';
          let description = '';
          try {
            description = getAward(a.name).description;
          } catch (err) {
            description = '';
          }
          return {
            key: a.name,
            title: a.name,
            sub: description,
            available: fundable.has(a.name),
            reason: funded ? '' : (fundable.has(a.name) ? '' : 'Unavailable right now'),
            takenBy: funded && a.color !== undefined ? {color: a.color, name: a.playerName ?? ''} : undefined,
            ma: {
              kind: 'award' as const,
              name: a.name,
              scores: a.scores,
              cost: funded ? undefined : cost,
              myColor: this.thisPlayer.color,
            },
          };
        });
      }
      default:
        return [];
      }
    },
    // ── the command bar (the truth of the current context) ─────────────
    commandContext(): string {
      if (this.consoleState.fallbackActive) {
        // Lifecycle-aware naming: the wrapped premium flows read as PART of
        // the console experience, not a generic "waiting" veil.
        switch (this.consoleState.fallbackScopeId) {
        case 'startGameFlow': return 'Start of the game';
        case 'endgame': return 'Game results';
        case 'drawReveal': return 'Cards';
        case 'dialog': return 'Card details';
        case 'colonies': return 'Colonies';
        default: return 'Awaiting decision';
        }
      }
      if (this.consoleRevealMode !== undefined) {
        return 'Cards';
      }
      if (this.startTask !== undefined && !this.consoleState.task.deferred) {
        return 'Start of the game';
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
      if (this.pendingCardAction !== undefined || this.consoleState.confirm !== undefined) {
        return 'Confirmation';
      }
      if (this.consoleState.wheelOpen) {
        return 'Categories';
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
      case 'colonies': return 'Colonies';
      case 'hydro': return 'Mars Hydronetwork';
      default: return 'Board';
      }
    },
    commands(): Array<ConsoleCommand> {
      if (this.consoleState.fallbackActive) {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: 'Back'},
        ];
      }
      if (this.consoleRevealMode !== undefined) {
        // The overlay footer carries the detailed contract; the bar mirrors it.
        return [
          {control: 'dpadH', label: 'Navigate'},
          {control: 'confirm', label: this.consoleRevealMode === 'drawn' ? 'Take card' : 'OK'},
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
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          {control: 'secondary', label: 'Trade'},
          {control: 'back', label: 'Cancel'},
        ];
      }
      if (this.pendingCardAction !== undefined || this.consoleState.confirm !== undefined) {
        return [
          {control: 'confirm', label: 'Confirm'},
          {control: 'back', label: 'Cancel'},
        ];
      }
      if (this.consoleState.wheelOpen) {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Open'},
          {control: 'secondary', label: 'Card actions'},
          {control: 'bumperR', label: 'Colonies', enabled: this.game.colonies.length > 0},
          {control: 'bumperL', label: 'Effects'},
          {control: 'back', label: 'Close'},
        ];
      }
      if (this.consoleState.sheet !== undefined) {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: this.consoleState.sheet === 'standardProjects' ? 'Minimize' : 'To the board'},
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
          {control: 'dpadH', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          {control: 'secondary', label: 'Card'},
          {control: 'inspect', label: 'Sell', enabled: n > 0, badge: n, highlight: n > 0},
          {control: 'back', label: 'Cancel'},
        ];
      }
      if (this.consoleState.section === 'hand') {
        const playable = this.handEntries[this.consoleState.handIndex]?.playable === true;
        return [
          {control: 'dpadH', label: 'Navigate'},
          {control: 'confirm', label: 'Play now', enabled: playable},
          {control: 'secondary', label: 'Card'},
          {control: 'triggerR', label: 'Next playable'},
          {control: 'triggerL', label: 'Information'},
          {control: 'back', label: this.shellTaskActive ? 'Minimize' : 'To the board'},
        ];
      }
      if (this.consoleState.section === 'colonies') {
        // T4 pick mode: A = the server verb; B = cancel (marker) / minimize.
        const pick = this.colonyPick;
        if (pick !== undefined) {
          const selected = this.coloniesForRail[this.consoleState.colonyIndex];
          const pickable = selected !== undefined && pick.selectable.includes(selected.name);
          return [
            {control: 'dpadH', label: 'Navigate'},
            {control: 'confirm', label: pick.buttonLabel, enabled: pickable},
            {control: 'triggerL', label: 'Information'},
            {control: 'back', label: this.colonyCancellable ? 'Cancel' : 'Minimize'},
          ];
        }
        const selected = this.game.colonies[this.consoleState.colonyIndex];
        const tradeable = selected !== undefined && this.tradeableColonyNames.includes(selected.name);
        return [
          {control: 'dpadH', label: 'Navigate'},
          {control: 'confirm', label: 'Trade', enabled: tradeable},
          {control: 'triggerL', label: 'Information'},
          {control: 'back', label: 'To the board'},
        ];
      }
      if (this.consoleState.section === 'hydro') {
        // P24: the console-native Hydronetwork grammar.
        return [
          {control: 'dpadH', label: 'Stages'},
          {control: 'bumperL', label: '−1'},
          {control: 'bumperR', label: '+1'},
          {control: 'inspect', label: 'MAX'},
          {control: 'confirm', label: 'Confirm'},
          {control: 'back', label: 'To the board'},
        ];
      }
      // Board — the console home screen: the full stable command map
      // (system-level actions live behind Menu, never on the bar itself).
      return [
        {control: 'inspect', label: 'Basic actions', enabled: this.myTurn},
        {control: 'triggerR', label: 'Actions'},
        {control: 'triggerL', label: 'Information'},
        {control: 'bumperL', label: 'Milestones', badge: this.milestonesClaimableCount, highlight: this.milestonesClaimableCount > 0},
        {control: 'bumperR', label: 'Awards', badge: this.awardsFundableCount, highlight: this.awardsFundableCount > 0},
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
      return z.select !== undefined && z.card !== undefined && z.select.isSelected(z.card.name);
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
      return z.action.labelFor(z.card.name);
    },
    /** P17: «why not» lines when the current card is NOT actionable. */
    zoomReasons(): ReadonlyArray<string> {
      const z = this.consoleCardZoom;
      if (z.action === undefined || z.card === undefined || this.zoomActionLabel !== undefined) {
        return [];
      }
      return z.action.reasonsFor(z.card.name);
    },
    /** P15: the deferred-chip return verb, by what is actually pending. */
    deferReturnLabel(): string {
      if (this.startTask !== undefined) {
        return this.startTask.kind === 'initialDraft' ? 'Return to selection' : 'Resume start setup';
      }
      const t = this.hostTask ?? this.shellTask;
      if (t !== undefined && t.kind === 'cardSelect') {
        return t.mode === 'draft' ? 'Return to the draft' : 'Return to selection';
      }
      return 'Return to the decision';
    },
  },
  watch: {
    // P13: the fullscreen viewer is a native <dialog> - open it on the
    // undefined->defined transition only (navigation keeps it open).
    'consoleCardZoom.card'(card: CardModel | undefined, prev: CardModel | undefined) {
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
    },
    // A fresh playerView: reconfigure the board-info fetcher (facts may have
    // changed), clamp transient indices to the fresh lists.
    playerView: {
      immediate: true,
      handler() {
        configureBoardInfo({
          participantId: this.playerView.id,
          color: this.thisPlayer.color,
          boardName: this.game.gameOptions.boardName,
          players: this.playerView.players,
        });
        this.consoleState.handIndex = stepIndex(this.consoleState.handIndex, 0, this.handEntries.length);
        this.consoleState.wheelIndex = stepIndex(this.consoleState.wheelIndex, 0, this.wheelEntries.length);
        this.consoleState.sheetIndex = stepSelectable(this.consoleState.sheetIndex, 0, this.sheetRows.map((r) => r.kind !== 'header'));
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
          // A card-action confirm built against the old prompt is stale too.
          this.pendingCardAction = undefined;
          // Same for the native play confirm (its playAction path moved on).
          this.pendingPlayCard = undefined;
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
    /** Award funding cost by the rules ladder (8 / 14 / 20 M€ by funded count). */
    awardCostText(): string {
      const funded = this.game.awards.filter((a) => a.playerName !== undefined && a.playerName !== '').length;
      const cost = [8, 14, 20][funded] ?? 20;
      return `${cost} M€`;
    },
    // ── sheet row builders ───────────────────────────────────────────────
    /** One std-project row per server card (shared: basics + the T3 sheet). */
    standardProjectRows(cards: ReadonlyArray<CardModel>): Array<ConsoleSheetRow> {
      return cards.map((c) => {
        const visual = standardProjectVisual(c.name);
        return {
          key: c.name,
          icon: visual.iconClass,
          title: c.name,
          sub: visual.description,
          meta: `${c.calculatedCost ?? 0} M€`,
          available: c.isDisabled !== true,
          reason: c.isDisabled === true ? 'Unavailable right now' : '',
        };
      });
    },
    /** Y — «Базовые действия»: standard projects + sell patents + conversions + turn. */
    basicsRows(): Array<ConsoleSheetRow> {
      const rows: Array<ConsoleSheetRow> = [];
      const wf = this.playerView.waitingFor;

      const std = this.standardProjectsAction?.input.cards ?? [];
      if (std.length > 0) {
        rows.push({key: 'h-std', kind: 'header', title: 'Standard Projects', available: false});
        rows.push(...this.standardProjectRows(std));
      }

      rows.push({key: 'h-turn', kind: 'header', title: 'Turn actions', available: false});
      const sell = findSellPatentsAction(wf);
      const sellVisual = standardProjectVisual(CardName.SELL_PATENTS_STANDARD_PROJECT);
      rows.push({
        key: 'sell',
        icon: sellVisual.iconClass,
        title: 'Sell patents',
        sub: sellVisual.description,
        available: sell !== undefined && this.cardsTotalCount > 0,
        reason: sell === undefined ? 'Not your turn to take any actions' : 'No cards in hand',
      });
      const heat = findConvertHeatOption(wf);
      rows.push({
        key: 'convertHeat',
        icon: 'resource_icon resource_icon--heat con-sheet__res-icon',
        title: 'Convert heat',
        meta: `${this.thisPlayer.heatNeededForTemperature} ♨`,
        available: heat !== undefined,
        reason: 'Not enough heat',
      });
      const plants = findConvertPlantsOption(wf, this.thisPlayer.canConvertPlants === true);
      rows.push({
        key: 'convertPlants',
        icon: 'resource_icon resource_icon--plants con-sheet__res-icon',
        title: 'Convert plants',
        meta: `${this.thisPlayer.plantsNeededForGreenery} ☘`,
        available: plants !== undefined,
        reason: 'Not enough plants',
      });
      if (findEndTurnPath(wf) !== undefined) {
        rows.push({key: 'endTurn', title: 'End Turn', available: true, reason: ''});
      }
      const pass = findPassPath(wf);
      rows.push({
        key: 'pass',
        title: 'Pass for this generation',
        available: pass !== undefined,
        reason: 'Not your turn to take any actions',
      });
      return rows;
    },
    /** LT wheel → «Действия карт»: every action source; available NOW per the server. */
    cardActionsRows(): Array<ConsoleSheetRow> {
      const perform = findPerformActionCard(this.playerView.waitingFor);
      const availableNames = new Set((perform?.model.cards ?? []).map((c) => c.name));
      const sources = this.thisPlayer.tableau.filter((c) => availableNames.has(c.name) ||
        (c.actionReasons !== undefined && c.actionReasons.length > 0) || this.hasActionSource(c.name));
      return sources.map((c) => {
        const available = availableNames.has(c.name);
        const reason = c.actionReasons?.[0];
        return {
          key: c.name,
          title: c.name,
          sub: undefined,
          available,
          reason: available ? '' :
            (reason !== undefined ? translateTextWithParams(reason.message, (reason.params ?? []).map(String)) : 'Unavailable right now'),
        };
      });
    },
    hasActionSource(name: CardName): boolean {
      return playerActionSourceCount([{name} as CardModel]) > 0;
    },
    // ── input ────────────────────────────────────────────────────────────
    handleIntent(intent: GamepadIntent): boolean {
      // P15: OUR fullscreen card viewer owns the pad completely while open
      // (it is a native <dialog>, so this must run BEFORE the resolveScope
      // fallback branch — the generic dialog scope would otherwise trap the
      // input in the DOM engine, where LB/RB browsing and the A select
      // context don't exist). Other (fallback-owned) dialogs never set
      // consoleCardZoom, so they still route to the DOM engine below.
      if (this.consoleCardZoom.card !== undefined) {
        return this.handleZoomIntent(intent);
      }
      // A fallback surface (mandatory modal / dialog / draft / endgame…) on
      // top → the demoted DOM focus engine drives it. ONE carve-out: the
      // console-mounted Hydronetwork surface is a fallback-driven scope, but
      // LT must still open Information Mode from it (§8.3).
      const scope = resolveScope();
      const fallback = scope !== undefined;
      this.consoleState.fallbackActive = fallback;
      this.consoleState.fallbackScopeId = scope?.def.id ?? '';
      if (fallback) {
        // P24: the Hydronetwork is CONSOLE-NATIVE — while it is the top
        // surface the shell owns the pad completely (the old re-host rode
        // the fallback DOM engine: clunky focus, browser scroll). A DESKTOP
        // modal on top resolves to its own scope first and stays
        // engine-driven; a CONSOLE layer on top (Info Mode / the pick
        // sheet / wheel / confirm / reveal) falls through to the normal
        // console flow, which owns those layers.
        if (scope?.def.id === 'overlay-hydro' && this.consoleState.section === 'hydro') {
          const consoleLayerOnTop = this.infoModeState.open || this.consoleState.sheet !== undefined ||
            this.consoleState.wheelOpen || this.consoleState.confirm !== undefined || this.consoleRevealMode !== undefined;
          if (!consoleLayerOnTop) {
            return this.handleHydroIntent(intent);
          }
          // fall through — the console layer handlers below take over.
        } else {
          return false;
        }
      }
      // LT INFORMATION MODE: toggle from every safe console context —
      // P20: INCLUDING active placement (LT/RT keep their global meaning;
      // inspect-all moved to R3 as a toggle, so no hold state remains).
      if (intent.kind === 'press' && intent.button === 'triggerL') {
        if (this.consoleState.confirm === undefined) {
          this.toggleInfoMode();
        }
        return true;
      }
      if (intent.kind === 'release') {
        return true;
      }
      if (intent.kind === 'scroll') {
        // P17: the RIGHT STICK scrolls the active console scroll container
        // (the fallback for rare overflow — console layouts fit by design
        // and never show scrollbar chrome). Fallback-owned surfaces keep
        // the DOM engine's own right-stick scroll (they return earlier).
        this.scrollActiveConsole(intent.dy);
        return true;
      }
      // Information Mode owns everything while open (read-only).
      if (this.infoModeState.open) {
        this.handleInfoIntent(intent);
        return true;
      }
      // CTS T6: a reveal overlay owns input while visible (drawn cards
      // must be taken; the result / viewer close on any confirm).
      if (this.consoleRevealMode !== undefined) {
        const overlay = this.$refs.revealOverlay as InstanceType<typeof ConsoleRevealOverlay> | undefined;
        overlay?.handleIntent(intent);
        return true;
      }
      // CTS T5: the start scene owns input while it serves (View still
      // peeks the journal; B inside = wizard back-step, else defer).
      if (this.startTask !== undefined && !this.consoleState.task.deferred) {
        if (intent.kind === 'press' && intent.button === 'view') {
          journalState.open = !journalState.open;
          return true;
        }
        const scene = this.$refs.startScene as InstanceType<typeof ConsoleStartScene> | undefined;
        scene?.handleIntent(intent);
        return true;
      }
      // CTS T1–T3: the task host owns input while it serves (View still peeks
      // the journal; B inside the host = defer-to-board / cancel, handled there).
      if (this.hostTask !== undefined && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        if (intent.kind === 'press' && intent.button === 'view') {
          journalState.open = !journalState.open;
          return true;
        }
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
      // T8: the native colony-trade confirm owns input while open.
      if (this.pendingTradeColony !== undefined) {
        const confirm = this.$refs.tradeConfirm as InstanceType<typeof ConsoleColonyTradeConfirm> | undefined;
        confirm?.handleIntent(intent);
        return true;
      }
      // T7: the card-action preview confirm (A/X = execute, B = back to the sheet).
      if (this.pendingCardAction !== undefined) {
        if (intent.kind === 'press' && (intent.button === 'confirm' || intent.button === 'secondary')) {
          this.confirmCardAction();
        } else if (intent.kind === 'press' && intent.button === 'back') {
          this.pendingCardAction = undefined;
        }
        return true;
      }
      if (this.consoleState.confirm !== undefined) {
        if (intent.kind === 'press' && intent.button === 'confirm') {
          this.acceptConfirm();
        } else if (intent.kind === 'press' && intent.button === 'back') {
          this.consoleState.confirm = undefined;
        }
        return true;
      }
      if (this.consoleState.wheelOpen) {
        this.handleWheelIntent(intent);
        return true;
      }
      if (this.consoleState.sheet !== undefined) {
        this.handleSheetIntent(intent);
        return true;
      }
      return this.handleSectionIntent(intent);
    },
    // ── Information Mode (read-only; never submits) ─────────────────────
    toggleInfoMode(): void {
      if (this.infoModeState.open) {
        const snap = closeInfoMode();
        if (snap !== undefined) {
          this.cellFocused = restoreConsoleSnapshot(snap);
        }
        // A placement prompt that arrived WHILE Info Mode was open must not
        // be restored away from — the board is the mandatory surface.
        if (this.placementActive) {
          this.consoleState.section = 'board';
        }
        return;
      }
      this.consoleState.wheelOpen = false;
      openInfoMode(this.thisPlayer.color, this.cellFocused);
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
      switch (intent.button) {
      case 'bumperL':
        this.infoModeState.playerColor = cyclePlayer(colors, this.infoModeState.playerColor, -1);
        break;
      case 'bumperR':
        this.infoModeState.playerColor = cyclePlayer(colors, this.infoModeState.playerColor, 1);
        break;
      case 'secondary':
        this.openInfoDetail('extras');
        break;
      case 'inspect':
        this.openInfoDetail('actions');
        break;
      case 'triggerR':
        this.openInfoDetail('effects');
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
    handleWheelIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        const step = (intent.dir === 'right' || intent.dir === 'down') ? 1 : -1;
        const n = this.wheelEntries.length;
        this.consoleState.wheelIndex = (this.consoleState.wheelIndex + step + n) % n;
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      // DIRECT hotkeys — no aiming needed (§6.3). RT is NOT a shortcut
      // (it opens the wheel). A = highlighted sector (index 0 = Cards by
      // default, so "nothing aimed" A opens Cards).
      const byShortcut = (id: string) => this.wheelEntries.find((e) => e.id === id);
      switch (intent.button) {
      case 'confirm':
        this.executeWheel(this.wheelEntries[this.consoleState.wheelIndex] ?? byShortcut('cards'));
        break;
      case 'secondary':
        this.executeWheel(byShortcut('cardActions'));
        break;
      case 'inspect':
        this.executeWheel(byShortcut('hydro'));
        break;
      case 'bumperR':
        this.executeWheel(byShortcut('colonies'));
        break;
      case 'bumperL':
        this.executeWheel(byShortcut('effects'));
        break;
      case 'back':
        this.consoleState.wheelOpen = false;
        break;
      default:
        break;
      }
    },
    handleSheetIntent(intent: GamepadIntent): void {
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
          // B: back to the board. Closing a MANDATORY task's own sheet
          // (the std-project prompt) defers it — the amber chip returns it.
          if (this.consoleState.sheet === 'standardProjects') {
            this.deferShellTask();
          }
          this.consoleState.sheet = undefined;
          this.consoleState.section = 'board';
        }
      }
    },
    handleSectionIntent(intent: GamepadIntent): boolean {
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
        if (onBoard) {
          this.openSheet('milestones');
        }
        return true;
      case 'bumperR':
        if (onBoard) {
          this.openSheet('awards');
        }
        return true;
      case 'inspect':
        // In SALE mode Y confirms the sale (the card-context confirm);
        // elsewhere Y = Basic actions (std projects / sell / conversions).
        if (this.consoleState.sale.active) {
          this.confirmSale();
          return true;
        }
        if (this.myTurn) {
          this.openSheet('basics');
        } else {
          this.showNotice('Not your turn to take any actions');
        }
        return true;
      case 'view':
        journalState.open = !journalState.open;
        return true;
      case 'triggerR':
        // RT: the action wheel — from the board home, P20: including an
        // active placement (the player may INSPECT cards/actions; starting
        // a conflicting action is gated with an honest warning). Elsewhere
        // RT keeps its local jump semantics (hand: next playable).
        if (onBoard) {
          this.deferShellTask(); // the wheel is navigation-away
          this.consoleState.wheelOpen = true;
          this.consoleState.wheelIndex = 0; // Cards = the A default
          this.consoleState.sheet = undefined;
          return true;
        }
        this.handleNextJump();
        return true;
      case 'stickL':
        // P20: L3 = next AVAILABLE placement target (was RT).
        if (this.placementActive && this.consoleState.section === 'board') {
          this.handleNextJump();
        }
        return true;
      case 'stickR':
        // P20: R3 toggles INSPECT-ALL cells during placement (was the LT
        // hold) — persistent, announced, and reflected in every hint row.
        if (this.placementActive && this.consoleState.section === 'board') {
          this.consoleState.freeRoam = !this.consoleState.freeRoam;
          this.showNotice(this.consoleState.freeRoam ? 'Inspecting all cells' : 'Available cells only');
        }
        return true;
      case 'confirm':
        this.handleSectionConfirm();
        return true;
      case 'secondary':
        // P13 global rule: X reads the focused card fullscreen.
        if (this.consoleState.section === 'hand') {
          this.zoomHandCard();
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
        board?.move(dir);
        this.cellFocused = true;
        return;
      }
      if (this.consoleState.section === 'colonies') {
        if (dir === 'left' || dir === 'up') {
          this.consoleState.colonyIndex = stepIndex(this.consoleState.colonyIndex, -1, this.coloniesForRail.length);
        } else {
          this.consoleState.colonyIndex = stepIndex(this.consoleState.colonyIndex, 1, this.coloniesForRail.length);
        }
        return;
      }
      // Hand carousel: left/right steps.
      if (dir === 'left' || dir === 'right') {
        this.consoleState.handIndex = stepIndex(this.consoleState.handIndex, dir === 'right' ? 1 : -1, this.handEntries.length);
      }
    },
    /** RT: next available cell (placement) / next playable card (hand). */
    handleNextJump(): void {
      if (this.consoleState.section === 'board' && this.placementActive) {
        const board = this.$refs.boardSection as InstanceType<typeof ConsoleBoardSection> | undefined;
        if (board?.nextAvailable() === true) {
          this.cellFocused = true;
        }
        return;
      }
      if (this.consoleState.section === 'hand' && !this.consoleState.sale.active) {
        const n = this.handEntries.length;
        for (let step = 1; step <= n; step++) {
          const i = (this.consoleState.handIndex + step) % n;
          if (this.handEntries[i]?.playable) {
            this.consoleState.handIndex = i;
            return;
          }
        }
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
      if (!entry.playable) {
        this.showNotice('Unplayable now');
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
      // Board home: drop the cell focus back to the turn summary.
      this.cellFocused = false;
    },
    // ── wheel / sheets ───────────────────────────────────────────────────
    executeWheel(entry: WheelEntry | undefined): void {
      if (entry === undefined) {
        return;
      }
      if (!entry.available) {
        this.showNotice(entry.reason);
        return;
      }
      this.consoleState.wheelOpen = false;
      switch (entry.id) {
      case 'cards':
        this.consoleState.section = 'hand';
        break;
      case 'cardActions':
        this.openSheet('cardActions');
        break;
      case 'effects':
        // Effects category = Information Mode's effects detail (the one
        // read-only effects surface; RT-in-wheel is deliberately NOT used).
        openInfoMode(this.thisPlayer.color, this.cellFocused);
        this.infoModeState.detail = 'effects';
        break;
      case 'colonies':
        this.consoleState.section = 'colonies';
        this.consoleState.colonyIndex = stepIndex(this.consoleState.colonyIndex, 0, this.coloniesForRail.length);
        break;
      case 'hydro':
        resetHydroPlan();
        this.consoleState.section = 'hydro';
        break;
      }
    },
    openSheet(sheet: ConsoleSheetId): void {
      // Opening anything that is NOT the task's own surface defers the task.
      const isTaskSurface = sheet === 'standardProjects' &&
        this.shellTask?.kind === 'projectCard' && this.shellTask.mode === 'standardProject';
      if (!isTaskSurface) {
        this.deferShellTask();
      }
      this.consoleState.wheelOpen = false;
      this.consoleState.sheet = sheet;
      void this.$nextTick(() => {
        const rows = this.sheetRows;
        const firstAvailable = rows.findIndex((r) => r.kind !== 'header' && r.available);
        const firstSelectable = rows.findIndex((r) => r.kind !== 'header');
        this.consoleState.sheetIndex = firstAvailable !== -1 ? firstAvailable : Math.max(0, firstSelectable);
      });
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
      case 'basics':
        this.activateBasicsRow(row.key);
        break;
      case 'standardProjects':
        this.useStandardProject(row.key as CardName);
        break;
      case 'cardActions':
        // T7: NEVER execute on a bare click — the preview-backed confirm
        // shows the costs/gains first (desktop confirm-first parity).
        this.openCardActionConfirm(row.key as CardName);
        break;
      case 'milestones':
        this.submitInnerOption(findMilestoneOptionPath(this.playerView.waitingFor), row.key);
        break;
      case 'awards':
        this.submitInnerOption(findAwardOptionPath(this.playerView.waitingFor), row.key);
        break;
      case 'hydroPick':
        // A pure PLAN write (never a submit) — the hydro confirm reads it.
        hydroNetworkState.selectedCard = row.key as CardName;
        this.consoleState.sheet = undefined;
        break;
      }
    },
    activateBasicsRow(key: string): void {
      switch (key) {
      case 'sell':
        this.consoleState.sheet = undefined;
        this.consoleState.sale.active = true;
        this.consoleState.sale.selected = [];
        this.consoleState.section = 'hand';
        break;
      case 'convertHeat': {
        const found = findConvertHeatOption(this.playerView.waitingFor);
        if (found === undefined) {
          return;
        }
        this.consoleState.sheet = undefined;
        if ((found.option.warnings ?? []).includes('maxtemp')) {
          this.consoleState.confirm = 'convertHeat';
        } else {
          this.submit(optionResponseForPath(found.path));
        }
        break;
      }
      case 'convertPlants': {
        const found = findConvertPlantsOption(this.playerView.waitingFor, this.thisPlayer.canConvertPlants === true);
        if (found === undefined) {
          return;
        }
        this.convertPlantsPending = found;
        closeConsoleLayers();
        this.consoleState.section = 'board';
        break;
      }
      case 'endTurn': {
        const path = findEndTurnPath(this.playerView.waitingFor);
        if (path !== undefined) {
          closeConsoleLayers();
          this.submit(optionResponseForPath(path));
        }
        break;
      }
      case 'pass':
        this.consoleState.sheet = undefined;
        this.consoleState.confirm = 'pass';
        break;
      default:
        this.useStandardProject(key as CardName);
      }
    },
    // ── T7: the card-action preview confirm ──────────────────────────────
    openCardActionConfirm(cardName: CardName): void {
      this.pendingCardAction = {cardName, preview: undefined, loading: true};
      const url = apiUrl(paths.API_ACTION_PREVIEW) +
        '?id=' + encodeURIComponent(this.playerView.id) +
        '&card=' + encodeURIComponent(cardName);
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((p) => {
          if (this.pendingCardAction?.cardName === cardName) {
            this.pendingCardAction = {cardName, preview: p as ActionPreview | undefined, loading: false};
          }
        })
        .catch(() => {
          // Best-effort: the confirm still shows (generic body), never blocks.
          if (this.pendingCardAction?.cardName === cardName) {
            this.pendingCardAction = {cardName, preview: undefined, loading: false};
          }
        });
    },
    confirmCardAction(): void {
      const pending = this.pendingCardAction;
      if (pending === undefined || pending.loading) {
        return;
      }
      const perform = findPerformActionCard(this.playerView.waitingFor);
      this.pendingCardAction = undefined;
      if (perform === undefined) {
        this.showNotice('Not your turn to take any actions');
        return;
      }
      closeConsoleLayers();
      this.submit(wrapPath(perform.path, {type: 'card' as const, cards: [pending.cardName]}));
    },
    branchTitleText(branch: ActionPreviewBranch): string {
      const t = branch.title;
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    branchReasonText(branch: ActionPreviewBranch): string {
      const reason = branch.unavailableReason;
      if (reason === undefined) {
        return '';
      }
      if (typeof reason === 'string') {
        return translateTextWithParams(reason, (branch.unavailableReasonParams ?? []).map(String));
      }
      return translateMessage(reason);
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
     * T8: the native play confirm resolved — submit the bare
     * `{type:'projectCard', card, payment}` (wrapped into the action-menu
     * path; empty path for the mandatory play-from-hand prompt). The
     * on-play choices arrive as NATIVE follow-up tasks — the sequential
     * server contract the legacy radio UI has always used.
     */
    onPlayCardConfirmNative(payment: Payment): void {
      const action = this.playAction;
      const pending = this.pendingPlayCard;
      this.pendingPlayCard = undefined;
      if (pending === undefined || action === undefined) {
        return;
      }
      closeConsoleLayers();
      this.consoleState.section = 'board';
      this.submit(wrapPath(action.path, {type: 'projectCard' as const, card: pending.cardName, payment}));
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
      const hydro = this.$refs.hydroOverlay as InstanceType<typeof HydroNetworkOverlay> | undefined;
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
    submitInnerOption(found: {options: ReadonlyArray<unknown>, path: ReadonlyArray<number>} | undefined, targetTitle: string): void {
      if (found === undefined) {
        return;
      }
      const options = found.options as ReadonlyArray<{type: string, title: string | Message}>;
      const innerIdx = options.findIndex((o) => o.type === 'option' && inputTitleText(o.title) === targetTitle);
      if (innerIdx === -1) {
        this.showNotice('Unavailable right now');
        return;
      }
      closeConsoleLayers();
      this.submit(wrapPath([...found.path, innerIdx], {type: 'option' as const}));
    },
    // ── colonies trade (mirrors the desktop contract byte-for-byte) ─────
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
      // ALWAYS confirm through the premium payment modal — never instant.
      this.pendingTradeColony = {
        colonyName: selected.name,
        paymentOptions: ctx.paymentOptions,
        disabledPayments: ctx.disabledPayments,
      };
    },
    onColonyTradePaymentSelected(paymentIdx: number): void {
      const pending = this.pendingTradeColony;
      const ctx = this.tradeColonyContext;
      this.pendingTradeColony = undefined;
      if (pending === undefined || ctx === undefined) {
        return;
      }
      // Shape (desktop-identical): wrap(tradePath, {type:'and', responses:
      // [{type:'or', index: paymentIdx, response:{type:'option'}}, {type:'colony', colonyName}]}).
      const andResponse = {
        type: 'and' as const,
        responses: [
          {type: 'or' as const, index: paymentIdx, response: {type: 'option' as const}},
          {type: 'colony' as const, colonyName: pending.colonyName},
        ],
      };
      this.submit(wrapPath(ctx.path, andResponse));
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
      if (task.kind === 'colony') {
        this.consoleState.section = 'colonies';
        // Land on the first PICKABLE tile so A is meaningful immediately.
        const pick = this.colonyPick;
        const rail = this.coloniesForRail;
        const first = pick !== undefined ? rail.findIndex((c) => pick.selectable.includes(c.name)) : -1;
        this.consoleState.colonyIndex = first !== -1 ? first : 0;
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
    /**
     * P24: console-native Hydronetwork control. Drives the SAME overlay
     * API the mouse uses (onSelectPosition / onSpend / onChoice /
     * onConfirm — hydroNetworkState is the one brain), so payloads and
     * legality stay byte-identical:
     *  ←/→ = inspect/plan stages · LB/RB = spend −/+ · Y = MAX ·
     *  ↑/↓ = reward choice (when the target stage offers one) ·
     *  A = the smart primary (pick the required card → confirm) ·
     *  X = open the card pick · LT = Info · View = journal · B = board.
     */
    handleHydroIntent(intent: GamepadIntent): boolean {
      const hydro = this.$refs.hydroOverlay as InstanceType<typeof HydroNetworkOverlay> | undefined;
      const model = hydro?.model;
      if (hydro === undefined || model === undefined) {
        return false;
      }
      if (intent.kind === 'scroll') {
        this.scrollActiveConsole(intent.dy);
        return true;
      }
      if (intent.kind === 'nav') {
        if (intent.dir === 'left' || intent.dir === 'right') {
          const step = intent.dir === 'right' ? 1 : -1;
          const last = model.stages.length - 1;
          const next = Math.min(last, Math.max(0, model.selectedPosition + step));
          hydro.onSelectPosition(next);
          return true;
        }
        // Reward choice on stages that offer one (↑/↓ cycles the options).
        const stage = model.stages[model.selectedPosition];
        const options = stage?.stage.rewardOptions.length ?? 0;
        if (options > 1) {
          const cur = hydroNetworkState.rewardChoice ?? -1;
          const step = intent.dir === 'down' ? 1 : -1;
          hydro.onChoice(((cur + step) % options + options) % options);
        }
        return true;
      }
      if (intent.kind !== 'press') {
        return true;
      }
      switch (intent.button) {
      case 'triggerL':
        this.toggleInfoMode();
        return true;
      case 'view':
        journalState.open = !journalState.open;
        return true;
      case 'bumperL':
      case 'bumperR': {
        if (model.maxSpend <= 0) {
          return true;
        }
        const cur = Math.max(1, model.selectedSpend);
        const next = Math.min(model.maxSpend, Math.max(1, cur + (intent.button === 'bumperR' ? 1 : -1)));
        hydro.onSpend(next);
        return true;
      }
      case 'inspect':
        if (model.maxSpend > 0) {
          hydro.onSpend(model.maxSpend);
        }
        return true;
      case 'secondary':
        this.clickHydroPick();
        return true;
      case 'confirm':
        // The smart primary: a mandatory card pick first, then confirm.
        if (model.mustSelectCard && model.selectedCard === undefined) {
          this.clickHydroPick();
          return true;
        }
        if (model.canConfirm) {
          hydro.onConfirm();
        } else {
          this.showNotice('Unavailable right now');
        }
        return true;
      case 'back':
        this.consoleState.section = 'board';
        return true;
      default:
        return true;
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
    /** The card-pick opener (X / the smart A) — the console pick sheet. */
    clickHydroPick(): void {
      this.openHydroPickSheet();
    },
    /** The notification's «Отменить размещение» CTA (server-cancellable). */
    onNotificationCancel(): void {
      this.cancelPlacement();
    },
    // ── P13/P15: the fullscreen card viewer (module-state driven) ───────
    onCardZoomNavigate(card: CardModel, pos: number): void {
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
        // A = toggle the pick (selection contexts) OR fire the context
        // ACTION (play-from-hand parity, P17) — read-only contexts no-op.
        if (this.consoleCardZoom.select !== undefined) {
          this.zoomToggleSelect();
        } else {
          this.zoomExecuteAction();
        }
        return true;
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
        z.select.toggle(z.card.name);
      }
    },
    /** P17: the viewer's A hands the card to the context action (e.g. the
     *  play-confirm flow) — the viewer closes FIRST, so the exact source
     *  context restores underneath the follow-up surface. */
    zoomExecuteAction(): void {
      const z = this.consoleCardZoom;
      const card = z.card;
      const action = z.action;
      if (card === undefined || action === undefined || action.labelFor(card.name) === undefined) {
        return;
      }
      this.closeZoomViewer();
      action.execute(card.name);
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
      const candidates: Array<HTMLElement> = [];
      if (journalState.open) {
        const feed = document.querySelector<HTMLElement>('.journal-feed__scroll');
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
     *  section's verdict bar — same server-structured reasons). */
    handUnplayableReasons(name: CardName): ReadonlyArray<string> {
      const entry = this.handEntries.find((e) => e.card.name === name);
      const reasons = entry?.card.unplayableReasons ?? [];
      return reasons.slice(0, 3).map((r) => {
        const text = translateTextWithParams(r.message, (r.params ?? []).map(String));
        return r.current !== undefined ? `${text} · ${translateText('Now')}: ${r.current}` : text;
      });
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
    this.consoleState.shellMounted = false;
    stopConsoleLeakDetector();
    window.removeEventListener('tm-notification-go-to-action', this.onNotificationGoToAction);
    window.removeEventListener('tm-notification-cancel', this.onNotificationCancel);
  },
});
</script>
