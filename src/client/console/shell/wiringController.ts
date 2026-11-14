/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SHELL'S WIRING (architecture v2 - S-last: the shell is layout). What the game screen registers with the rest of the client while it stands - the probes, suppliers, hooks and leases other modules read (`shellMounted`), their release in the leaving order (`shellLeaving`) - and the reactions and one-line verbs that belong to no single domain (the phase anchors' word, the board's two inspection modes, the notification CTAs). It owns no decision of a domain: a body here either hands a module its supplier or asks a controller to act.
 */
import type {UnwrapRef} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import type {SurfaceRegistry} from '@/client/console/shell/surfaceRegistry';
import {installCursorArrivalInput} from '@/client/console/cursorArrivalInput';
import {computed, ref, watch} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SpaceId} from '@/common/Types';
import {submitInput, submitBatch as transportSubmitBatch, SubmitTicket} from '@/client/console/transport/gameTransport';
import {InputResponse} from '@/common/inputs/InputResponse';
import {registerTerraformedSceneProbes, terraformedSceneState, terraformedSceneUp} from '@/client/console/terraformedScene/terraformedScene';
import {botTurnReviewState} from '@/client/components/marsbot/botTurnReviewState';
import {acquireForegroundLease, registerRevealParkSupplier} from '@/client/components/presentation/presentationFlow';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {waitGraphSnapshot} from '@/client/console/waitGraph/waitGraph';
import {ceilingStats} from '@/client/console/waitGraph/ceilingWait';
import {registerNotificationCornerProbe} from '@/client/components/notifications/notificationState';
import {cancelNotifHold, resetNotifHold} from '@/client/console/consoleNotifHold';
import {LiveNotification} from '@/client/components/notifications/notificationTypes';
import {maFocusState, openMaFocus, discardMaFocusDraft} from '@/client/console/consoleMaFocus';
import {hideScaleTooltip} from '@/client/components/board/scaleTooltipState';
import ConsoleBoardSection from '@/client/components/console/ConsoleBoardSection.vue';
import ConsoleHandSection from '@/client/components/console/ConsoleHandSection.vue';
import {endFinaleSession} from '@/client/console/finalGreenery/finalGreenerySession';
import {boardSceneSettling} from '@/client/console/rewardPayoutQuiet';
import {closeWorkspaceRoot, offStageDeadFrames, pruneOffStageDeadFrames, registerAnchorDropListener, registerFrameAnchorDead, registerFrameBeatExpired, stackYieldedToBoard, enterWorkspace, goBoardHome, leaveWorkspace, setWorkspaceFramePhase, workspaceFrameRenders, workspaceStackTop, workspaceFrameHost, workspaceFrameKnown, workspaceStackCollapsed, workspaceStackState, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {installConsoleReadinessProbe, registerReadinessDecisionDiag} from '@/client/console/e2eReadiness';
import {installFlowCoverageProbe} from '@/client/console/flowCoverageProbe';
import {resetStdProjectsFlow, stdProjectsFlow} from '@/client/console/consoleStdProjects';
import {registerDiscardOverlayHandoff, registerPreselectedDiscardArm} from '@/client/console/cardDiscard/consoleCardDiscard';
import {colonyBonusEntry, colonyResolutionUi, remoteColonyBonusParksReveal} from '@/client/console/colonyTrade/colonyResolution';
import {handRevealState} from '@/client/console/handDock/handRevealState';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {isHandDeliveryActive, resetHandDelivery} from '@/client/console/handDock/handDeliveryDirector';
import {setHandRevealHooks} from '@/client/console/handDock/handRevealDirector';
import {Phase} from '@/common/Phase';
import {colonyTradeState, isColonyTradeInputLocked, colonyTradeDiagnostics} from '@/client/console/colonyTrade/consoleColonyTrade';
import {conWsPresence, installConWsPresenceBridge} from '@/client/console/conWsPresenceBridge';
import {installRowLeaveRects} from '@/client/console/surfaceMotion/rowLeaveRect';
import {colonyFocusState} from '@/client/console/consoleColoniesModel';
import {consoleStartState, startSceneHeld} from '@/client/console/consoleStartState';
import {boardExcursionActive, releaseBoardExcursion} from '@/client/console/boardExcursion';
import {firstActionOwed} from '@/client/console/startFirstAction';
import {isResourceTransferActive, resourceTransferDiagnostics} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {consoleCardZoom} from '@/client/console/consoleCardZoom';
import {currentRevealEvent, drawnCardsState, registerRevealQueuePark, revealPresented} from '@/client/components/drawnCards/drawnCardsState';
import {generationSceneState, registerGenerationSceneHandoff} from '@/client/console/generationScene/generationScene';
import {ConsoleTask, taskFor, SHELL_SECTION_KINDS, corpFirstActionInStartFlow} from '@/client/console/consoleTaskRouter';
import {registerScreenCureExecutor, registerScreenShadowContext, screenShadowStanding, startConsoleLeakDetector, setConsoleTaskHandoffPending} from '@/client/console/consoleLeakDetector';
import {resetScreenShadowLog, screenCureArming, screenCureArmingFor, screenCurePlanText, screenShadowLog} from '@/client/console/screenDirector';
import {armSceneDestination, deferSceneReveal, loadingScreenState, registerGameExitTarget} from '@/client/console/loadingScreenState';
import {paths} from '@/common/app/paths';
import {isHydroMarkerActive, hydroRewardHoldOwed, hydroTraversalPending} from '@/client/console/hydroMarker/consoleHydroMarker';
import {hydroCeremonyOwed, hydroFlowState, hydroFlowTrail, installHydroFlowWitnesses, isHydroCeremonyActive, registerHydroFlowProbe} from '@/client/console/hydroFlow/consoleHydroFlow';
import {preludePlayChainState} from '@/client/console/deckPick/preludePlayChain';
import {workspaceOutcomeBeatPending, lastOutcomeReleaseStack, setWorkspaceOutcomeServingProbe, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {boardBeatParkState, registerBoardBeatLiveParams, registerBoardBeatRedrive, registerBoardBeatSurfaceProbe, registerBoardWatchableProbe} from '@/client/console/boardBeatPark';
import {colonyBonusPayoutParksReveal} from '@/client/console/colonyLedger/colonyBonusPayout';
import {boardCardBonusState} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {planetFocusState, captureGlobalParams, isPlanetFocusEngaged} from '@/client/console/planetFocus';
import {deckDrawHolds} from '@/client/console/deckDraw/consoleDeckDraw';
import {patentSaleState} from '@/client/console/patentSale/consolePatentSale';
import {cardReactionPending, hurryCardReactions} from '@/client/console/cardReaction/cardReactionDirector';
import {registerBoardShownDespiteStack} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {isColonyBuildActive} from '@/client/console/colonyBuild/consoleColonyBuild';
import {consoleState, closeConsoleLayers, registerConsoleIntentHandler} from '@/client/console/consoleRouter';
import {cardDeltaAdvanceCard, clearCardDeltaAdvance} from '@/client/console/hydroFlow/deltaAdvanceEntry';
import {setAlbumLayoutRecomposer} from '@/client/console/consoleAlbumLayout';
import {leaveConsoleSession} from '@/client/console/session/consoleSession';
import {handoffPendingEntries} from '@/client/console/shell/shellFlowState';
import {notificationBus} from '@/client/components/notifications/notificationBus';
import {isMandatoryBeatPresented, resetMandatoryGate, setMandatoryGateHeld} from '@/client/console/consoleMandatoryGate';
import {startShadowLog} from '@/client/console/startDirector';
import {promptAdmissionBlock, releasePromptPresence} from '@/client/console/consolePromptAdmission';
import {waitScreenHandoff} from '@/client/console/screenHandoff';
import {PARLIAMENT_DOOR} from '@/client/console/parliament/parliamentDoorHandoff';
import {setConsoleBoardHomeIdle} from '@/client/console/consoleForegroundWatchdog';
import {registerColonyTrackMoveHost} from '@/client/console/colonyTrade/colonyTrackMove';
import {registerColonyRosterHost} from '@/client/console/colonyRoster/consoleColonyRoster';
import {consoleSessionScope} from '@/client/console/session/consoleSession';
import type {RouterController} from '@/client/console/shell/routerController';
import type {HandSelectController} from '@/client/console/shell/handSelectController';
import type {PlacementController} from '@/client/console/shell/placementController';
import type {HandController} from '@/client/console/shell/handController';
import type {PlayCardController} from '@/client/console/shell/playCardController';
import type {ViewerController} from '@/client/console/shell/viewerController';
import type {ColonyController} from '@/client/console/shell/colonyController';
import type {RevealController} from '@/client/console/shell/revealController';
import type {SupervisorController} from '@/client/console/supervisor/supervisorController';
import type {DraftController} from '@/client/console/shell/draftController';
import type {HydroController} from '@/client/console/shell/hydroController';
import type {FinaleController} from '@/client/console/shell/finaleController';
import type {OutcomeController} from '@/client/console/shell/outcomeController';
import type {PadRouterController} from '@/client/console/shell/padRouterController';
import type {ParliamentController} from '@/client/console/shell/parliamentController';
import type {JournalController} from '@/client/console/shell/journalController';
import type {MandatoryController} from '@/client/console/shell/mandatoryController';
import type {MaController} from '@/client/console/shell/maController';
import type {PlayedController} from '@/client/console/shell/playedController';
import type {NoticeController} from '@/client/console/shell/noticeController';
import type {StartController} from '@/client/console/shell/startController';
import type {SeatController} from '@/client/console/shell/seatController';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type WiringPort = {
  $nextTick(fn?: () => void): Promise<void>,
  admissionSignals: UnwrapRef<RouterController['admissionSignals']>,
  applyHandFilterChange: UnwrapRef<HandSelectController['applyHandFilterChange']>,
  armDiscardScene: UnwrapRef<HandSelectController['armDiscardScene']>,
  boardBeatsWatchable: UnwrapRef<PlacementController['boardBeatsWatchable']>,
  cardArrivalBusy: UnwrapRef<HandController['cardArrivalBusy']>,
  cardStageExitBusy: UnwrapRef<HandController['cardStageExitBusy']>,
  clearDepartingPlayCard: UnwrapRef<PlayCardController['clearDepartingPlayCard']>,
  clearZoomOpenFlight: UnwrapRef<ViewerController['clearZoomOpenFlight']>,
  closeColonyInspect: UnwrapRef<ColonyController['closeColonyInspect']>,
  colonyEmbedTarget: UnwrapRef<ColonyController['colonyEmbedTarget']>,
  colonyFocusRestorePending: UnwrapRef<ColonyController['colonyFocusRestorePending']>,
  colonyFollowUpLive: UnwrapRef<ColonyController['colonyFollowUpLive']>,
  colonyPromptOpenable: UnwrapRef<ColonyController['colonyPromptOpenable']>,
  colonyPromptRaw: UnwrapRef<ColonyController['colonyPromptRaw']>,
  colonyRailIsCatalog: UnwrapRef<ColonyController['colonyRailIsCatalog']>,
  colonyResolutionEvidence: UnwrapRef<ColonyController['colonyResolutionEvidence']>,
  colonyResolutionLive: UnwrapRef<ColonyController['colonyResolutionLive']>,
  readonly conRootEl: HTMLElement | undefined,
  consoleRevealMode: UnwrapRef<RevealController['consoleRevealMode']>,
  deckPickServing: UnwrapRef<RevealController['deckPickServing']>,
  declareScreenControlDefect: UnwrapRef<SupervisorController['declareScreenControlDefect']>,
  draftFrameLive: UnwrapRef<DraftController['draftFrameLive']>,
  drainBoardBeats: UnwrapRef<PlacementController['drainBoardBeats']>,
  driveHydroFlowStuck: UnwrapRef<HydroController['driveHydroFlowStuck']>,
  effectDecisionActive: UnwrapRef<RouterController['effectDecisionActive']>,
  effectDecisionBelongsToWorkspace: UnwrapRef<RouterController['effectDecisionBelongsToWorkspace']>,
  effectDecisionDirectPick: UnwrapRef<RouterController['effectDecisionDirectPick']>,
  effectDecisionHeldForWorkspace: UnwrapRef<RouterController['effectDecisionHeldForWorkspace']>,
  effectDecisionRendered: UnwrapRef<RouterController['effectDecisionRendered']>,
  effectDecisionVm: UnwrapRef<RouterController['effectDecisionVm']>,
  endgameFrameLive: UnwrapRef<FinaleController['endgameFrameLive']>,
  exitBarrierHolds: UnwrapRef<RevealController['exitBarrierHolds']>,
  finalGreeneryActive: UnwrapRef<PlacementController['finalGreeneryActive']>,
  followUpStepOwed: UnwrapRef<OutcomeController['followUpStepOwed']>,
  forceRecoverStuckWorkspace: UnwrapRef<SupervisorController['forceRecoverStuckWorkspace']>,
  frameAnchorIsDead: UnwrapRef<OutcomeController['frameAnchorIsDead']>,
  handExitVerb: UnwrapRef<HandController['handExitVerb']>,
  handleIntent: UnwrapRef<PadRouterController['handleIntent']>,
  handOffHandForDiscard: UnwrapRef<HandSelectController['handOffHandForDiscard']>,
  hostTask: UnwrapRef<RouterController['hostTask']>,
  hydroFollowUpLive: UnwrapRef<HydroController['hydroFollowUpLive']>,
  hydroResolutionBusy: UnwrapRef<HydroController['hydroResolutionBusy']>,
  hydroResultTimer: UnwrapRef<HydroController['hydroResultTimer']>,
  inspectParliament: UnwrapRef<ParliamentController['inspectParliament']>,
  journalColonyInspect: UnwrapRef<JournalController['journalColonyInspect']>,
  mandatoryActionPresented: UnwrapRef<MandatoryController['mandatoryActionPresented']>,
  mandatoryAnnounceVisible: UnwrapRef<MandatoryController['mandatoryAnnounceVisible']>,
  mandatoryBeat: UnwrapRef<MandatoryController['mandatoryBeat']>,
  mandatoryChipAttention: UnwrapRef<MandatoryController['mandatoryChipAttention']>,
  mandatoryGateHeld: UnwrapRef<MandatoryController['mandatoryGateHeld']>,
  maScreenItems: UnwrapRef<MaController['maScreenItems']>,
  /** WRITTEN here. */ offHydroWitnesses: UnwrapRef<HydroController['offHydroWitnesses']>,
  /** WRITTEN here. */ offIntent: UnwrapRef<PadRouterController['offIntent']>,
  onNotificationCancel: UnwrapRef<PlacementController['onNotificationCancel']>,
  onNotificationOpenParliament: UnwrapRef<ParliamentController['onNotificationOpenParliament']>,
  openEffectDecisionPick: UnwrapRef<RouterController['openEffectDecisionPick']>,
  openFinalGreeneryOnBoard: UnwrapRef<PlacementController['openFinalGreeneryOnBoard']>,
  openHandWorkspace: UnwrapRef<HandController['openHandWorkspace']>,
  openShellTaskSurface: UnwrapRef<RouterController['openShellTaskSurface']>,
  outcomeAdoptionDecision: UnwrapRef<OutcomeController['outcomeAdoptionDecision']>,
  parliamentSittingFrameLive: UnwrapRef<ParliamentController['parliamentSittingFrameLive']>,
  /** WRITTEN here. */ pendingClientPick: UnwrapRef<PlayCardController['pendingClientPick']>,
  placementActive: UnwrapRef<PlacementController['placementActive']>,
  playedHeroHolds: UnwrapRef<PlayedController['playedHeroHolds']>,
  readonly playerView: PlayerViewModel,
  promptOwnedByClaim: UnwrapRef<MandatoryController['promptOwnedByClaim']>,
  promptServedWhereIStand: UnwrapRef<MandatoryController['promptServedWhereIStand']>,
  rawAdmissionSignals: UnwrapRef<RouterController['rawAdmissionSignals']>,
  rawDrawnRevealPending: UnwrapRef<RevealController['rawDrawnRevealPending']>,
  rawEffectDecisionVm: UnwrapRef<RouterController['rawEffectDecisionVm']>,
  /** WRITTEN here. */ releaseRevealParkSupplier: UnwrapRef<RevealController['releaseRevealParkSupplier']>,
  /** WRITTEN here. */ releaseRevealQueuePark: UnwrapRef<RevealController['releaseRevealQueuePark']>,
  remoteColonyBonusPending: UnwrapRef<ColonyController['remoteColonyBonusPending']>,
  restoreDeferredTask: UnwrapRef<MandatoryController['restoreDeferredTask']>,
  revealBatchParked: UnwrapRef<RevealController['revealBatchParked']>,
  revealEmbedTarget: UnwrapRef<RevealController['revealEmbedTarget']>,
  revealHeldForWorkspace: UnwrapRef<RevealController['revealHeldForWorkspace']>,
  revealOverlayMode: UnwrapRef<RevealController['revealOverlayMode']>,
  runScreenDirectorCure: UnwrapRef<SupervisorController['runScreenDirectorCure']>,
  showNotice: UnwrapRef<NoticeController['showNotice']>,
  startExcursionHolds: UnwrapRef<StartController['startExcursionHolds']>,
  startFrameLive: UnwrapRef<StartController['startFrameLive']>,
  startPromptSurfaceStands: UnwrapRef<StartController['startPromptSurfaceStands']>,
  startSceneMounted: UnwrapRef<StartController['startSceneMounted']>,
  startSceneOwnsPad: UnwrapRef<StartController['startSceneOwnsPad']>,
  startSceneServes: UnwrapRef<StartController['startSceneServes']>,
  startSceneVisible: UnwrapRef<StartController['startSceneVisible']>,
  startShadowNow: UnwrapRef<StartController['startShadowNow']>,
  startSponsorEmbed: UnwrapRef<StartController['startSponsorEmbed']>,
  startSupervisor: UnwrapRef<SupervisorController['startSupervisor']>,
  startTask: UnwrapRef<StartController['startTask']>,
  stopSupervisor: UnwrapRef<SupervisorController['stopSupervisor']>,
  readonly surfaces: SurfaceRegistry,
  syncHydroBonusDoor: UnwrapRef<HydroController['syncHydroBonusDoor']>,
  taskEmbedTarget: UnwrapRef<RouterController['taskEmbedTarget']>,
  taskGateHeld: UnwrapRef<MandatoryController['taskGateHeld']>,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
  tilePlacementHolds: UnwrapRef<PlacementController['tilePlacementHolds']>,
  viewerAskedNothing: UnwrapRef<SeatController['viewerAskedNothing']>,
  viewerAskedOffTurn: UnwrapRef<SeatController['viewerAskedOffTurn']>,
  workspaceOutcomeServingNow: UnwrapRef<OutcomeController['workspaceOutcomeServingNow']>,
  /** WRITTEN here. */ zoomOpenToken: UnwrapRef<ViewerController['zoomOpenToken']>,
};

export function createWiringController(shell: WiringPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Unregister fn of the planet-focus live-params source. */
  const offPlanetFocusParams = ref(undefined as (() => void) | undefined);
  const offWsPresence = ref(undefined as (() => void) | undefined);
  /** Release fn of the held 'mandatory-choice' presentation lease. */
  const releasePresentationLease = ref(undefined as (() => void) | undefined);
  /** Unregister of the notification corner probe (FK — a new card waits while a viewer stands in its corner). */
  const releaseNotificationCorner = ref(undefined as (() => void) | undefined);
  /** Un-registrations of the notification bus's CTAs (T6) — the shell answers them while it stands. */
  const notificationBusOff = ref([] as Array<() => void>);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * THE PHASE ANCHORS' WORD, as ONE reactive fact (the anchor rule — `consoleWorkspaceStack.ts` § A FRAME LIVES ONLY
   * WHILE ITS ANCHOR HOLDS): which phase roots are PROVABLY over. The same predicates the lifecycle watchers close on
   * — the draft's, the sitting's (per seat), the endgame's. The START is not judged here: its life is the opening
   * director's (the scene's own release beat), and no server fact says «over» before it does.
   */
  const deadPhaseAnchors = computed((): ReadonlyArray<string> => {
    const dead: Array<string> = [];
    if (!shell.draftFrameLive) {
      dead.push('draft');
    }
    if (!shell.parliamentSittingFrameLive) {
      dead.push(Phase.PARLIAMENT);
    }
    if (!shell.endgameFrameLive) {
      dead.push('end');
    }
    return dead;
  });

  /** Off-stage frames (parked / aside for the board) whose phase is over — the prune watcher's key. Reads the phase
   *  facts THROUGH `deadPhaseAnchors` (a reactive edge), never only through the stack's registered predicate. */
  const offStageDeadAnchorKey = computed((): string => {
    return deadPhaseAnchors.value.length === 0 ? '' : offStageDeadFrames().join(',');
  });

  /** Every tile placed this turn — L3 = Показать на карте (ALL cells pulse). */
  const reviewMapSpaces = computed((): ReadonlyArray<SpaceId> => {
    const out: Array<SpaceId> = [];
    for (const tile of botTurnReviewState.review?.tiles ?? []) {
      if (!out.includes(tile.spaceId)) {
        out.push(tile.spaceId);
      }
    }
    return out;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * «Осмотреть» on a fired-passive card whose source is the ENACTED RESOLUTION
   * (Development Craze doubled a placement's bonuses): the resolution's OWN
   * inspector — the one viewer the Parliament's X opens — never a second one.
   * Textual origin: the toast is not the card's physical place.
   */
  function onNotificationInspectResolution(resolution: string): void {
    if (shell.playerView.game.parliament === undefined) {
      return;
    }
    shell.inspectParliament({kind: 'resolution', ids: [resolution], index: 0});
  }

  // ── P27: BOARD INSPECTION MODE (L3) ──────────────────────────────────
  function toggleInspection(): void {
    if (consoleState.inspecting) {
      exitInspection();
      return;
    }
    exitScaleInspect(); // the two inspection modes are exclusive
    consoleState.inspecting = true;
    // Land on a predictable cell (the last inspected one, else re-seed).
    void shell.$nextTick(() => {
      if (consoleState.boardSpaceId === undefined) {
        const board = shell.surfaces.at<ExposedOf<typeof ConsoleBoardSection>>('boardSection');
        board?.seed(false);
      }
    });
  }

  function exitInspection(): void {
    consoleState.inspecting = false;
    consoleState.trackMarker = undefined;
  }

  // ── P27b: SCALE INSPECTION MODE (R3) — the track-bonus ring ─────────
  function toggleScaleInspect(): void {
    if (consoleState.scaleInspecting) {
      exitScaleInspect();
      return;
    }
    exitInspection();
    const board = shell.surfaces.at<ExposedOf<typeof ConsoleBoardSection>>('boardSection');
    if (board?.enterTrackInspect() === true) {
      consoleState.scaleInspecting = true;
    } else {
      shell.showNotice('Unavailable right now');
    }
  }

  function exitScaleInspect(): void {
    consoleState.scaleInspecting = false;
    consoleState.trackMarker = undefined;
  }

  /** A client-hosted pick folds ONE level back to the door that promised it (nothing was sent). */
  function cancelClientPick(): void {
    const pick = shell.pendingClientPick;
    // An ANSWERED pick is past its boundary: its batch is on the wire and its scene owed — B is absorbed.
    if (pick === undefined || pick.answered === true) {
      return;
    }
    shell.pendingClientPick = undefined;
    pick.onCancel();
  }

  // ── shell-section tasks (T3 projectCard / T4 colony) ─────────────────
  /** Open (or re-open after un-defer) the section that serves the task. */
  /**
   * Land the cursor on the awards surface a funding task just opened:
   * a suspended PRE-COMMIT detail re-seats exactly (RESUME ≠ FRESH-OPEN),
   * else the cursor goes to the first fundable award so A means something
   * at once. Shared by the hosted push (the start's first-action step) and
   * the parked-stack restore.
   */
  function seatAwardFundingSurface(): void {
    void shell.$nextTick(() => {
      const draft = maFocusState.draft;
      if (draft !== undefined && draft.kind === 'award') {
        const idx = shell.maScreenItems.findIndex((it) => it.name === draft.name);
        if (idx !== -1) {
          consoleState.sheetIndex = idx;
          openMaFocus(draft.kind, draft.name);
        }
        discardMaFocusDraft();
        return;
      }
      if (maFocusState.open) {
        return;
      }
      const first = shell.maScreenItems.findIndex((it) => it.available);
      consoleState.sheetIndex = first !== -1 ? first : 0;
    });
  }

  /**
   * The notification card's «Перейти к действию» CTA (window event —
   * PlayerHome's listener doesn't exist in console): bring the pending
   * decision back — un-defer the task, re-open its serving surface,
   * snap to the board for a pending placement.
   */
  function onNotificationGoToAction(): void {
    // THROUGH `restoreDeferredTask`, never a copy of its body. This site was
    // a hand-copied older version of it — un-defer + re-open the shell task —
    // written before the park existed, so it cleared the flag the park's own
    // way back is gated on (`mandatoryDeferredActive`) while leaving the
    // frames parked: a minimized card play answered here lost its picks AND
    // became unreachable, since `restoreWorkspaceStack` is only ever called
    // from the restore path this branch was bypassing.
    if (consoleState.task.deferred || workspaceStackCollapsed()) {
      shell.restoreDeferredTask();
    }
    if (shell.placementActive) {
      goBoardHome();
      closeConsoleLayers();
    }
  }

  /**
   * SCENE TRANSITION: where «выйти из партии» actually leads. A campaign
   * mission's honest parent is its campaign map (with the mission identity
   * riding the curtain's context); an ordinary game exits to the main
   * menu. Registered at mount — the campaign contract is immutable for the
   * game's whole life, so no watcher is needed.
   */
  function syncGameExitTarget(): void {
    const campaign = shell.playerView.game.gameOptions?.campaign;
    if (campaign !== undefined) {
      registerGameExitTarget(
        paths.CAMPAIGN + '?id=' + encodeURIComponent(campaign.campaignId),
        {kind: 'campaign-map', mission: campaign.missionSlot + 1, missionCount: campaign.missionCount},
        'sync');
    } else {
      registerGameExitTarget('/', {kind: 'main-menu'}, 'interface');
    }
  }

  // ── transport ────────────────────────────────────────────────────────
  /** The press's TICKET comes back: `accepted: false` = the funnel was busy and nothing was sent (`gameTransport.SubmitTicket`). */
  function submit(response: unknown): SubmitTicket {
    return submitInput(response as InputResponse);
  }

  /** `promptId` — the prompt the batch was COMPOSED for (default: the one standing now; see `gameTransport.submitBatch`). */
  function submitBatch(responses: ReadonlyArray<unknown>, promptId?: number): SubmitTicket {
    return transportSubmitBatch(responses as ReadonlyArray<InputResponse>, promptId);
  }

  /** …a new prompt is a new entry … */
  function whenPromptPresenceIdentityChanges(): void {
    releasePromptPresence();
  }

  /**
   * A CARD'S HYDRONETWORK ENTRY DIES WITH ITS FRAME.
   *
   * B popped the frame, or the finished move unwound the whole stack — either
   * way the lock must go, or the next visit to the track would still believe
   * it is serving that card. Watched HERE, in the always-mounted shell: the
   * action workspace unmounts together with the very frames whose departure
   * this observes, so it cannot be the witness of its own end.
   *
   * Keyed on `workspaceFrameKnown`, so a PARKED hydro frame (the player
   * minimized the move to read the board) keeps its entry intact.
   */
  function whenCardDeltaEntryFrameLiveChanges(live: boolean): void {
    if (!live && cardDeltaAdvanceCard() !== '') {
      clearCardDeltaAdvance();
    }
  }

  /** The free-award-funding task ended (submitted / expired / new game) —
   *  a suspended MA detail draft has lost its restore door and must die
   *  with it (a stale draft re-seating in a LATER game is the trap). */
  function whenAwardFundingActiveChanges(next: boolean): void {
    if (!next) {
      discardMaFocusDraft();
    }
  }

  // NOTIFICATION X-HOLD safety: the tracked card left the screen (TTL ran
  // out despite the pause safeguard, a flow ack, a queue promotion) or a
  // DIFFERENT card took the top slot — an in-flight hold must die with it,
  // never fire an action for a card the player no longer sees.
  function whenTopNotificationChanges(next: LiveNotification | undefined, prev: LiveNotification | undefined): void {
    if (next?.id !== prev?.id) {
      cancelNotifHold();
    }
  }

  /*
   * PATENT-SALE hero staging (consolePatentSale): the sale UI stays up
   * while the picked cards flip + converge (they lift off LIVE hand
   * slots); the moment the stack ENTERS the terminal ('inserting') the
   * hand has physically given the cards away — close the sale mode and
   * return to the board, where the payout chip lands on the resource
   * rail. An error BEFORE this point ('failed' while the sale UI is
   * still open) leaves the player's picks intact — the scene unwinds
   * with zero trace and the transport's alert explains.
   */
  function whenPatentSaleStatePhaseChanges(phase: string): void {
    if (phase === 'inserting') {
      // THE RESOLUTION ACTION'S sale (Open IP Trade): the hand STEP has given
      // the cards away — the step leaves, the action workspace STAYS for the
      // terminal's payout and the draw that follows in its own zone.
      if (patentSaleState.source === 'resolution') {
        if (workspaceFrameHost('hand') === 'card-actions' && workspaceStackTop()?.kind === 'hand') {
          leaveWorkspace();
        }
        return;
      }
      // The hand has physically given the cards away — the WHOLE flow closes
      // in one splice (std-projects host included: no flash of the parent
      // list between the sale and the payout chip landing on the rail).
      resetStdProjectsFlow();
      closeConsoleLayers();
      goBoardHome();
    }
    // A sale refused BEFORE the terminal took the stack: the picks are
    // intact (the scene unwinds), so a hosting std-projects frame returns
    // to its reversible configure stage — B must work again.
    if (phase === 'failed' && workspaceFrameHost('hand') === 'standard-projects') {
      setWorkspaceFramePhase('standard-projects', 'configure');
    }
  }

  // PRESENTATION FLOW occupancy: while a console mandatory surface (task
  // host / start scene / gov-support panel) is actively presenting, hold a
  // 'mandatory-choice' lease so transient notifications queue instead of
  // floating over it. Deferred tasks release it (the board is inspectable).
  function whenConsoleMandatoryPresentingChanges(presenting: boolean): void {
    if (presenting && releasePresentationLease.value === undefined) {
      releasePresentationLease.value = acquireForegroundLease('mandatory-choice');
    } else if (!presenting && releasePresentationLease.value !== undefined) {
      releasePresentationLease.value();
      releasePresentationLease.value = undefined;
    }
  }

  // Leaving the colonies ends the workspace flow with it: the focus stage
  // folds away and the command-bar mirror is cleared so stale hints can't
  // linger. Reopening always lands on the browse surface.
  //
  // ⚠️ This watcher used to close the HAND's descent too, guarded by a
  // hand-written «unless a colony follow-up is live inside it». Both are gone:
  // `section` is a PROJECTION now, so leaving the hand IS the frame going
  // away, and a frame cannot be removed from under the step it is carrying.
  // That guard-plus-write pair was the soft-lock.
  /** «СРАБАТЫВАНИЕ КАРТЫ» (iteration 3): the player opened a sheet while reactions play — they HURRY (a pace, never a cut). */
  function whenConsoleStateSheetChanges(sheet: string | undefined): void {
    if (sheet !== undefined && cardReactionPending()) {
      hurryCardReactions('navigation');
    }
  }

  // The journal closing for ANY reason (mandatory surface, game switch)
  // takes its read-only colony dossier with it.
  function whenJournalPanelVisibleChanges(visible: boolean): void {
    if (!visible && shell.journalColonyInspect !== undefined) {
      shell.closeColonyInspect();
    }
  }

  /** WATCH `consoleForegroundBusy` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenConsoleForegroundBusyChanges(busy: boolean, wasBusy: boolean): void {
    // Don't auto-open an interruptive task that is still GATED (announced,
    // not yet opened via B) — it waits for the player's press, not for the
    // foreground to clear (consoleMandatoryGate).
    if (wasBusy && !busy && !consoleState.task.deferred && !shell.taskGateHeld) {
      const task = taskFor(shell.playerView);
      if (task !== undefined && SHELL_SECTION_KINDS.has(task.kind)) {
        shell.openShellTaskSurface(task);
      }
    }
  }

  // THE PARLIAMENT'S SITTING FRAME — the same contract: the falling edge
  // (the political phase is over) closes a PHASE-anchored Parliament root,
  // parked or standing. A Parliament the player walked into on their own
  // (an `always` anchor) is not the sitting's and stays.
  function whenOffStageDeadAnchorKeyChanges(key: string): void {
    if (key !== '') {
      pruneOffStageDeadFrames();
    }
  }

  /** WATCH `startFrameLive` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenStartFrameLiveChanges(live: boolean): void {
    if (live) {
      // `Known`, not `Index`: while the opening is PARKED its frame is set
      // aside, not gone — standing a second one up beside it would mount the
      // scene over the board the player parked it to look at.
      if (!workspaceFrameKnown('start')) {
        enterWorkspace('start', {anchor: {type: 'phase', phase: 'start'}});
      }
    } else {
      // Its OWN anchor went dead — `closeWorkspaceRoot`, never `goBoardHome`:
      // that one deliberately protects a phase root from a step inside it,
      // so using it here would leave the scene mounted for the whole game.
      closeWorkspaceRoot('start');
    }
  }

  // Mirror the live gate-held state into the module so the leak detector (a
  // timer that can't recompute the shell signals) treats a held prompt as
  // legitimately served — the announcement / chip is its surface (A opens it).
  function whenMandatoryGateHeldChanges(held: boolean): void {
    setMandatoryGateHeld(held);
  }

  // …and the watchdog's SCOPE: it may only act while the player is on the
  // board home with nothing of their own open (see boardHomeIdle).
  function whenBoardHomeIdleChanges(idle: boolean): void {
    setConsoleBoardHomeIdle(idle);
  }

  /** The start ceremony fully resolved (the game began) — release any
   *  residual starting-cards delivery HOLD so the dock can never stick
   *  withheld. The normal flow already cleared it on the flight's landing;
   *  this is the belt-and-braces for a theoretical no-payment path. NOT
   *  fired on defer (`startTask` stays defined while the scene is deferred,
   *  so the hold correctly survives a board inspection). */
  function whenStartTaskChanges(now: ConsoleTask | undefined, was: ConsoleTask | undefined): void {
    // Never yank a LIVE flight — its own safety timeout reconciles it. And
    // never a HELD workspace's withhold: `startTask` flickers undefined in
    // every prompt gap of the deployment (submit round trips), while the
    // bought cards must stay out of the dock until the payment flies them in.
    if (now === undefined && was !== undefined && !startSceneHeld() &&
        handDeliveryState.held.length > 0 && !isHandDeliveryActive()) {
      resetHandDelivery();
    }
  }

  /** The workspace itself let go (the deployment settled / the game moved
   *  on) — a latch without its scene is meaningless, and it must never
   *  leak into a rematch. */
  function whenStartSceneServesChanges(now: boolean): void {
    if (!now && boardExcursionActive()) {
      releaseBoardExcursion();
    }
  }

  /** THE SEAT'S FINALE IS OVER (the server's fact / the END): the session ends, the camera and the dossier let go. */
  function whenFinaleOverForViewerChanges(over: boolean): void {
    if (over) {
      endFinaleSession();
    }
  }

  /** THE SHELL IS MOUNTED — its wiring: the probes, suppliers, hooks and leases other modules read while it stands. */
  function shellMounted(): void {
    // THE CURSOR ARRIVES (TR58): a step or a press during an arrival releases it — input never waits for a ring.
    installCursorArrivalInput();
    // THE START YIELDS ITS SCENE, NOT ITS FRAME (the reliability iteration): while it does, the board is on screen.
    registerBoardShownDespiteStack(() => shell.startSceneMounted && !shell.startSceneVisible &&
      workspaceStackState.frames.length === 1 && workspaceStackState.frames[0].kind === 'start');
    // THE START SHADOW's reader (phase 0) — the findings so far and the judged state right now.
    (window as unknown as {__conStartShadow?: () => unknown}).__conStartShadow = () => ({
      findings: [...startShadowLog.findings], judged: startShadowLog.judged, now: shell.startShadowNow,
    });
    // THE SCREEN SHADOW (`screenDirector.ts`, phase 0) — the leak detector's 1 Hz pass judges every question past the
    // opening; the shell supplies what only it knows (the start owns the opening; the admission block on the surface).
    resetScreenShadowLog();
    registerReadinessDecisionDiag(() => ({
      raw: shell.rawEffectDecisionVm !== undefined, vm: shell.effectDecisionVm !== undefined,
      belongs: shell.effectDecisionBelongsToWorkspace, heldForWorkspace: shell.effectDecisionHeldForWorkspace,
      active: shell.effectDecisionActive, rendered: shell.effectDecisionRendered,
      askedNothing: shell.viewerAskedNothing, offTurn: shell.viewerAskedOffTurn,
      gateHeld: shell.mandatoryGateHeld, presented: shell.mandatoryActionPresented, plate: shell.mandatoryAnnounceVisible,
      beacon: shell.mandatoryChipAttention, servedHere: shell.promptServedWhereIStand, ownedByClaim: shell.promptOwnedByClaim,
      hostBlock: shell.playerView.waitingFor === undefined ? '' : promptAdmissionBlock('host', shell.admissionSignals) ?? '',
      // The start's pad and the prelude chain (P58 · FS — the order step's two hosts).
      start: {ownsPad: shell.startSceneOwnsPad, visible: shell.startSceneVisible, serves: shell.startSceneServes,
        promptSurface: shell.startPromptSurfaceStands, excursion: shell.startExcursionHolds, sheet: consoleState.sheet ?? '',
        section: consoleState.section, deferred: consoleState.task.deferred, deckPick: shell.deckPickServing},
      chain: {live: preludePlayChainState.live, host: preludePlayChainState.host, yielded: stackYieldedToBoard(),
        host2: shell.hostTask === undefined ? '' : `${shell.hostTask.kind}${'flavor' in shell.hostTask ? ':' + String(shell.hostTask.flavor) : ''}`,
        embed: shell.taskEmbedTarget ?? ''},
    }));
    // STEP 4 — the owner's armed classes (`SCREEN_CURE_DEFAULT_ARMED`: the blind announce); a stand names its own set
    // (`?screenCure=open,restore,yield,announce` / `all` / `none`).
    screenCureArming.armed = screenCureArmingFor(new URLSearchParams(window.location.search).get('screenCure'));
    registerScreenCureExecutor((plan) => shell.runScreenDirectorCure(plan));
    // THE ANCHOR RULE: the stack's return doors and prunes ask the shell which phases are over, and name what they drop.
    registerFrameAnchorDead((anchor) => shell.frameAnchorIsDead(anchor));
    // A frame's beat past its own bound (the frame machine's structural net — the arbiter cuts a quiet beat much sooner):
    // the same teardown the arbiter's rung runs.
    registerFrameBeatExpired((kind, phase) => shell.forceRecoverStuckWorkspace(kind, `[workspace-stall] beat «${kind}:${phase}» torn down at the frame's own bound`));
    registerAnchorDropListener(({home, kinds}) => {
      console.warn(`[workspace-anchor] dropped ${kinds.join(', ')} (${home}) — its phase is over; it does not come back`);
    });
    // THE CURE STAND'S SEAM (`?screenControl=1` only): a latch bug put in on purpose — the stack dropped, or a foreign
    // workspace stood up, behind the product's back.
    if (new URLSearchParams(window.location.search).get('screenControl') === '1') {
      (window as unknown as {__conScreenControl?: unknown}).__conScreenControl = {
        dropStack: () => goBoardHome(),
        standWorkspace: (kind: WorkspaceFrameKind) => enterWorkspace(kind),
        // A NOTIFICATION-ONLY hold the screen handoff waits for and the task host's admission does not — the class of a
        // card into the dock / a token wave at a sitting's close (the «К драфту» stand: no legacy browser in the wait).
        holdScreen: (ms: number) => {
          // The seam's own recovery is its release: a ceiling ends the owed screen exactly as the timer would.
          const owned: {hold?: AnimationHold} = {};
          const release = () => owned.hold?.release();
          owned.hold = beginAnimationHold('screen-control-owed', {scope: 'notification-only', expire: release});
          consoleSessionScope().guarantee(ms, 'ConsoleShell: a release\'s bound', release);
        },
        // A DEFECT PUT IN ON PURPOSE is declared to the liveness arbiter: the screen shadow's live control hides a
        // question's surface for a few seconds to prove the shadow names it, and the arbiter (a stranded question is
        // judged at 4 s) would cure that very defect first. The window is named and bounded; `0` ends it.
        declareDefect: (ms: number) => {
          shell.declareScreenControlDefect(ms);
        },
      };
    }
    registerScreenShadowContext(() => {
      const wf = shell.playerView.waitingFor;
      const block = wf === undefined ? undefined : promptAdmissionBlock(wf.type === 'space' ? 'placement' : 'host', shell.admissionSignals);
      return {
        startOwned: shell.startSceneMounted,
        admission: block ?? '',
        announce: !shell.mandatoryGateHeld ? 'none' : isMandatoryBeatPresented(shell.mandatoryBeat) ? 'presented' : 'pending',
      };
    });
    // THE WAIT GRAPH's evidence (Э2): the last snapshot's nodes, the counts, the standing streaks.
    (window as unknown as {__conWaitGraph?: () => unknown}).__conWaitGraph = () => JSON.parse(JSON.stringify({...waitGraphSnapshot(), ceilings: ceilingStats})) as unknown;
    (window as unknown as {__conScreenShadow?: () => unknown}).__conScreenShadow = () => ({
      findings: [...screenShadowLog.findings], judged: screenShadowLog.judged,
      stats: JSON.parse(JSON.stringify(screenShadowLog.stats)) as unknown,
      cure: {
        armed: [...screenCureArming.armed],
        standing: screenShadowStanding.plan === undefined ? null : screenCurePlanText(screenShadowStanding.plan),
      },
    });
    // A decision that IS its pick standing at boot (a reload mid-prompt) opens its album — the watcher is not
    // `immediate`, so the mount edge is asked here.
    shell.openEffectDecisionPick(shell.effectDecisionDirectPick);
    // …and a FINALE standing open at boot (a reload mid-finale): the watcher is not `immediate`, so its mount edge
    // is asked here — the board takes the pick once the shell has rendered.
    void shell.$nextTick(() => {
      if (shell.finalGreeneryActive) {
        shell.openFinalGreeneryOnBoard();
      }
    });
    // A CHOSEN TRACK's move (TR07) is seeded only while the stage that will play it stands — the shell knows.
    registerColonyTrackMoveHost((colony) => workspaceFrameKnown('colonies') && colonyFocusState.open && colonyFocusState.colonyName === colony);
    // A ROSTER change somebody else made is played on the colony GRID — only while that grid is what the player is
    // looking at: the colonies frame on top, browsing (no stage, no dossier), the in-game table on the rail.
    registerColonyRosterHost(() => consoleState.section === 'colonies' && workspaceFrameRenders('colonies') &&
      !colonyFocusState.open && !shell.colonyRailIsCatalog && !colonyTradeState.active && !isColonyBuildActive());
    // The e2e readiness probe (`window.__conReady`) — read-only snapshots of
    // the holds/transport/stack facts this shell already stands on. Installed
    // here so the aggregator adds no new edges to any import graph.
    installConsoleReadinessProbe();
    // …and HOW MUCH OF THE KERNEL'S STATE SPACE A WALK WENT THROUGH (`flowCoverageProbe.ts`) — only when the e2e harness
    // asks for it (its flag, or `?coverage=1`): a player's game never installs it.
    installFlowCoverageProbe();
    // THE RELEASE FUNNEL'S GUARD (consoleWorkspaceOutcome): a claim serving a
    // live prompt/batch whose host frame still stands cannot be released out
    // from under the player. The evidence lives in the shell (the raw
    // `waitingFor`, the server's unconsumed reveals), so the shell registers
    // the one probe; the module refuses on its own.
    setWorkspaceOutcomeServingProbe(() => shell.workspaceOutcomeServingNow);
    // THE HYDRO FLOW-CLOSE WITNESSES (consoleHydroFlow → presentationLedger):
    // the committed flow's close chain is edge-driven, and a missed edge used
    // to wedge the workspace until some unrelated 20–30 s safety shook it.
    // The shell registers the facts only it has (the busy conjunction, the
    // result hold's timer, the server position) and the witnesses re-drive
    // the flow's OWN doors within one grace window.
    registerHydroFlowProbe({
      busy: () => shell.hydroResolutionBusy,
      resultHoldArmed: () => shell.hydroResultTimer !== undefined,
      serverAtDestination: () => {
        const c = hydroFlowState.commit;
        return c !== undefined && (shell.thisPlayer.deltaProject?.position ?? -1) === c.toPosition;
      },
      drive: () => shell.driveHydroFlowStuck(),
    });
    shell.offHydroWitnesses = installHydroFlowWitnesses();
    // (THE WORKSPACE-CONCLUSION TIME NET is gone — architecture v2 · S5. An owed ending is a run in its frame's scope
    // that wakes on the decision's own facts and re-asks on its own cadence, `workspaceConclusionOwe.ts`; the truth
    // witness that re-drove a hand-listed signal's misses every half second has nothing left to witness.)
    // THE BOARD-BEAT PARK'S «watchable» verdict (boardBeatPark) — coverage
    // facts only, shell-owned. Registered at mount, so a reload that lands
    // with a parked batch (server reveals survive the trip) re-parks or
    // drains against the real screen; the mount-edge drain below covers the
    // watcher's blind spot (a watcher never fires on its initial truth).
    registerBoardWatchableProbe(() => shell.boardBeatsWatchable);
    // THE GENERATION SCENE'S RISE waits for the screen handoff (state delivery, 2026-10-28): the scene holds the
    // foreground itself through the wait, so its own label is the one the director ignores.
    registerGenerationSceneHandoff((id, into) => waitScreenHandoff(id, {
      ignoreHolds: ['generation-scene'],
      // A rise INTO THE SITTING waits for the player's own owed objects only (see `enterWorkspaceAfterHandoff`).
      ...(into === 'parliament' ? PARLIAMENT_DOOR : {}),
    }));
    // …and «a workspace surface is still LEAVING» — the bridge counts a
    // `.con-ws` through its whole fade, so the scale story starts on a board
    // the player can actually see (never under a dissolving workspace).
    registerBoardBeatSurfaceProbe(() => conWsPresence.wsOpen);
    // …and the QUEUE skips what the park holds: a parked Venus draw must not
    // wall the workspace's own batch behind it (drawnCardsState — the queue
    // park), the same verdict `rawDrawnRevealPending` subtracts.
    // …and a ledger row's batch whose turn has not come (`colonyBonusPayoutParksReveal` — TR23).
    // …and ONE verdict for the batch (`revealBatchParked` — the card-intake law's R7: a park holds a batch by its
    // ROOT, and a batch a workspace claims is never held out of its own zone by the board beat).
    shell.releaseRevealQueuePark = registerRevealQueuePark((batch) => shell.revealBatchParked(batch));
    // …and the ledger's redrive rides the shell's GUARDED drain (the one
    // that folds board cinematics + the read admission in) — the bare
    // module drain is only the desktop/test default.
    registerBoardBeatRedrive(() => shell.drainBoardBeats());
    void shell.$nextTick(() => shell.drainBoardBeats());
    // «МАРС ТЕРРАФОРМИРОВАН» (TR70 — `terraformedScene.ts`): the scene is a BOARD BEAT and waits for a board the
    // player can see — the field's story over (the tile hero, the payouts, a remote landing, the camera), no
    // reveal standing or pending, no cards in flight, no discard settling, no generation scene mid-phrase; and
    // whether a SECTION stands on the board's slot (the board is then faded in under it for the scene).
    registerTerraformedSceneProbes({
      quiet: () => {
        const s = shell.rawAdmissionSignals;
        return !boardSceneSettling() && !s.revealOpen && !s.revealPending && !s.cardArrival && !s.cardDiscard &&
          !s.playedHero && !s.tileHero && !s.boardBonus && !isPlanetFocusEngaged() && !planetFocusState.arcsReturning &&
          generationSceneState.phase === 'idle';
      },
      sectionCovered: () => consoleState.section !== 'board',
      playerOwned: () => shell.rawAdmissionSignals.revealOpen || shell.rawAdmissionSignals.revealPending,
    });
    // READ-ONLY e2e/diagnostics probe: the nested-continuation state in one
    // snapshot (the e2e specs dump it on a failure instead of guessing from
    // pixels). Never used by product code.
    // READ-ONLY e2e/diagnostics probe (same idiom): «МАРС ТЕРРАФОРМИРОВАН» (TR70) — the scene's phase (the ARMED wait
    // has no DOM of its own), what it holds and the camera it rides; a storyboard reads the product's own tact off this.
    (window as unknown as Record<string, unknown>).__conTerraformedDiag = () => ({
      phase: terraformedSceneState.phase,
      stage: terraformedSceneState.stage,
      nonce: terraformedSceneState.nonce,
      showNonce: terraformedSceneState.showNonce,
      skipped: terraformedSceneState.skipped,
      final: terraformedSceneState.final,
      lastEnd: terraformedSceneState.lastEnd,
      up: terraformedSceneUp(),
      parkHeld: boardBeatParkState.sceneHeld,
      camera: {phase: planetFocusState.phase, mode: planetFocusState.mode},
    });
    // READ-ONLY e2e/diagnostics probe (same idiom): the Hydronetwork's commit
    // flow with its close gate BROKEN DOWN INTO ITS TERMS. The flow reaches
    // its result stage on the FALLING EDGE of `hydroResolutionBusy`, so a
    // single stuck term reads from the outside as «the track never played its
    // result» — the symptom, three screens away from the cause.
    (window as unknown as Record<string, unknown>).__conHydroDiag = () => ({
      commit: hydroFlowState.commit === undefined ? null : {
        phase: hydroFlowState.commit.phase,
        toPosition: hydroFlowState.commit.toPosition,
        kind: hydroFlowState.commit.kind,
      },
      step: hydroFlowState.step ?? null,
      repeatBridge: hydroFlowState.repeatBridge,
      resolutionBusy: shell.hydroResolutionBusy,
      busyTerms: {
        markerGliding: isHydroMarkerActive(),
        rewardHeld: hydroRewardHoldOwed(),
        transfersFlying: isResourceTransferActive(),
        ceremony: isHydroCeremonyActive(),
        followUpInteractive: shell.hydroFollowUpLive,
        traversalPending: hydroTraversalPending(),
        intakeFlying: shell.cardArrivalBusy,
        ceremonyOwed: hydroCeremonyOwed(),
      },
      parked: {
        deferred: consoleState.task.deferred,
        collapsed: workspaceStackCollapsed(),
      },
      // The module's own transition trail (bounded ring) — a field wedge
      // names its last edges instead of demanding a reproduction.
      trail: hydroFlowTrail(),
    });
    (window as unknown as Record<string, unknown>).__conColonyDiag = () => ({
      // THE STACK IS THE SNAPSHOT — one ordered list instead of five flags that
      // had to be read together and could disagree.
      stack: workspaceStackState.frames.map((f) => ({
        kind: f.kind, subject: f.subject, stage: f.stage, phase: f.phase,
        overlay: f.overlay, slot: f.slot, anchor: f.anchor.type,
      })),
      parked: workspaceStackState.parked.map((f) => f.kind),
      // The STD-PROJECTS flow, for the acceptance probes: «which project, how
      // far along, and is a cancel in flight» is the one thing the stack alone
      // cannot say (the frame phase is shared by several of its states).
      stdpFlow: {
        state: stdProjectsFlow.state,
        card: stdProjectsFlow.card,
        cancelRequested: stdProjectsFlow.cancelRequested,
        excursion: stdProjectsFlow.boardExcursion?.card ?? null,
      },
      hostKind: workspaceFrameHost('colonies') ?? null,
      embedTarget: shell.colonyEmbedTarget ?? null,
      promptRaw: shell.colonyPromptRaw,
      // …and whether its own DOOR is open yet: a prompt that is live while its
      // surface is deliberately held is the state the sequencing probes read
      // («one press, several effects» — the previous one is still being worked
      // through). `owedStep` is the same fact from the FLOW's side.
      promptOpenable: shell.colonyPromptOpenable,
      owedStep: shell.followUpStepOwed,
      followUp: shell.colonyFollowUpLive,
      section: consoleState.section,
      sheet: consoleState.sheet ?? null,
      sponsorEmbed: shell.startSponsorEmbed,
      taskDeferred: consoleState.task.deferred,
      wfType: shell.playerView.waitingFor?.type ?? null,
      // The COLONY RESOLUTION's lifecycle, for the e2e timeline probes.
      outcomeHost: workspaceOutcomeState.host ?? null,
      outcomeStage: workspaceOutcomeState.stage,
      // The claim's own identity — «why didn't this batch match» is decided
      // by these three, and reading them from pixels is impossible.
      outcomeKinds: [...workspaceOutcomeState.kinds],
      outcomeScope: workspaceOutcomeState.scope,
      outcomeSourceCard: workspaceOutcomeState.sourceCard,
      outcomeSlot: workspaceOutcomeState.embedSlot,
      tradeActive: colonyTradeState.active,
      // The COVER SCENE's own state: a scene stuck past its last beat holds
      // the pad (isColonyTradeInputLocked), which reads on screen as «the card
      // is there and А does nothing» — the one symptom with no other tell.
      cardScene: colonyTradeState.cardScene,
      tradePhase: colonyTradeState.phase,
      // The reward TRANSACTION and the transfer framework's own trail —
      // «the chip never flew» vs «it flew onto nothing» are told apart here.
      trade: colonyTradeDiagnostics(),
      transfer: resourceTransferDiagnostics(),
      // WHICH batches the cover scene claimed vs which are still on the table:
      // the reset glide's gate is «every staged batch was taken», and the two
      // lists are the only way to see it disagree with the screen.
      stagedIds: [...colonyTradeState.stagedRevealIds],
      liveReveals: drawnCardsState.events.map((e) => `${e.id}:${e.cards.length - e.takenIndices.size}${e.dismissed ? 'D' : ''}`),
      glideNonce: colonyTradeState.glideNonce,
      inputLocked: isColonyTradeInputLocked(),
      arrivalPending: workspaceOutcomeBeatPending(),
      resolutionLive: shell.colonyResolutionLive,
      // …and WHAT is holding it: server evidence, or only the client-armed
      // entry. A resolution live on the entry ALONE past its bounded wait is
      // the latch this pair exists to make visible.
      resolutionEvidence: shell.colonyResolutionEvidence,
      entry: {colony: colonyBonusEntry.colonyName, awaiting: colonyBonusEntry.awaiting},
      revealPending: shell.rawDrawnRevealPending,
      // THE MOUNT DECISION OF THE REVEAL, term by term (`consoleRevealMode` → `revealOverlayMode`): «the payout
      // never presented» has a dozen possible holders and every one of them is a read of these, never a pixel.
      revealDecision: ((): Record<string, unknown> => {
        const ev = currentRevealEvent();
        return {
          event: ev === undefined ? null : {id: ev.id, cards: ev.cards.length, taken: ev.takenIndices.size, dismissed: ev.dismissed,
            source: ev.source?.type === 'colony' ? `colony:${ev.source.colonyName}:${ev.source.trade?.role ?? '-'}` : ev.source?.type ?? null},
          mode: shell.consoleRevealMode ?? null,
          overlayMode: shell.revealOverlayMode ?? null,
          embedTarget: shell.revealEmbedTarget ?? null,
          rawPending: shell.rawDrawnRevealPending,
          heldForWorkspace: shell.revealHeldForWorkspace,
          heroHolds: shell.playedHeroHolds,
          tileHolds: shell.tilePlacementHolds,
          deckHolds: deckDrawHolds(),
          remotePark: ev !== undefined && remoteColonyBonusParksReveal(shell.remoteColonyBonusPending, ev.source),
          payoutPark: ev !== undefined && colonyBonusPayoutParksReveal(ev.source),
          embedSlot: workspaceOutcomeState.embedSlot,
          beatPending: workspaceOutcomeBeatPending(),
          presented: ev !== undefined && revealPresented(ev.id),
          exitBarrier: ev !== undefined && shell.exitBarrierHolds(ev.id),
          exitBusy: shell.cardStageExitBusy,
          adoption: shell.outcomeAdoptionDecision.kind,
          discardStage: colonyResolutionUi.discardStage,
          restorePending: shell.colonyFocusRestorePending,
          focusOpen: colonyFocusState.open,
        };
      })(),
      // The COVER-LIFT scene (a colony BUILD's card bonus rides it, exactly as
      // a board cell's does). Its phase ladder is the only way to tell «the
      // flight played» from «the cards just appeared»: an `idle` scene next to
      // a live colony reveal is the missing-animation signature.
      bonusScene: {
        active: boardCardBonusState.active,
        phase: boardCardBonusState.phase,
        source: boardCardBonusState.source.kind,
        staged: boardCardBonusState.stagedEventId ?? null,
      },
      // ⚠️ The reason is ONE line (`«reason» @ms`) — the old `.split('\n')
      // .slice(1)` here dropped it entirely, so every probe read «nobody
      // released it» while the claim was demonstrably gone. Raw, verbatim.
      lastRelease: lastOutcomeReleaseStack,
      // THE START WORKSPACE'S LIFE, for the first-action probes: «why is the
      // frame still here / why did it go» has five terms, and reading them
      // from pixels is guesswork (the frame's disappearance and the claim's
      // release look identical on screen — one causes the other).
      start: {
        frameLive: shell.startFrameLive,
        serves: shell.startSceneServes,
        held: startSceneHeld(),
        task: shell.startTask?.kind ?? null,
        owed: firstActionOwed(shell.playerView),
        inFlow: corpFirstActionInStartFlow(shell.playerView),
        outcomeSource: workspaceOutcomeState.sourceCard,
        mounted: shell.startSceneMounted,
        stage: consoleStartState.firstAct.stage,
      },
    });
    // Phase D of the discard cinematic reuses the ORDINARY hand-close episode;
    // the transaction awaits this instead of the shell watching a phase.
    registerDiscardOverlayHandoff((discarded) => shell.handOffHandForDiscard(discarded));
    // …and a card action's PRE-SELECTED discard (P68): armed at the composer's press, the cards leaving from the dock.
    registerPreselectedDiscardArm((names, meta) => shell.armDiscardScene(names, meta));
    // An «Компоновка альбома» flip while the hand album is OPEN rides the
    // same measured FLIP episode a filter change uses: cards glide and scale
    // into the new composition, the out-of-capacity ones exit to the page
    // packets, and focus keeps its CARD (the page holding it opens by
    // derivation). Anywhere else the preference applies directly — the next
    // open lands in the chosen composition from its first frame.
    setAlbumLayoutRecomposer((apply) => {
      if (consoleState.section === 'hand' && handRevealState.phase === 'open') {
        shell.applyHandFilterChange(apply);
      } else {
        apply();
      }
    });
    shell.offIntent = registerConsoleIntentHandler((intent) => shell.handleIntent(intent));
    // The `.con-ws` / planet-focus DOM-presence flags (the ex-`:has()` rules)
    // — one observer on the shell root, folded into conRootClasses.
    const offPresence = installConWsPresenceBridge(shell.conRootEl as HTMLElement);
    // …and the row's other DOM fact: where its members stood when a leave was DECIDED — the stack's frames or the
    // section changed. A section frozen for its dissolve is pinned to that rect, never to what the board's return
    // has left of it by its leave hook's turn (`surfaceMotion/rowLeaveRect.ts`).
    const offRowRects = installRowLeaveRects(
      () => (shell.conRootEl as HTMLElement | undefined)?.querySelector(':scope > .con-main'),
      () => `${consoleState.section}|${workspaceStackState.frames.map((frame) => frame.kind).join(',')}`,
    );
    offWsPresence.value = () => {
      offPresence();
      offRowRects();
    };
    // The console-mode <html> class is owned by GamepadLayer (it spans every
    // lifecycle screen); the shell only reports its own presence.
    consoleState.shellMounted = true;
    resetMandatoryGate(); // a fresh shell starts with no acknowledged beat
    resetNotifHold(); // a fresh shell never inherits a mid-flight X-hold
    // The board-beat park reads the LIVE committed parameters through this
    // source at its drain's release — the accent names exactly the scales
    // that moved (the playerView root identity changes every response, so
    // the module can never hold an object reference itself).
    offPlanetFocusParams.value = registerBoardBeatLiveParams(
      () => captureGlobalParams(shell.playerView.game));
    // The hand-reveal director owns WHEN the section switches during its
    // episodes (and re-seats the grid scroll on a mid-close reopen).
    setHandRevealHooks({
      // The director owns WHEN the hand appears / goes home during an episode;
      // it asks in the shell's vocabulary, and the shell answers with the verb.
      setSection: (s) => {
        if (s === 'hand') {
          shell.openHandWorkspace();
          return;
        }
        // THE SHARED LAW (`handExitVerb`): a HOSTED hand pops ONE level (the
        // host keeps the room and its own flow continues — `goBoardHome` here
        // wiped the whole stack out from under the colony resolution the
        // instant the gather finished), and a hand whose OWN flow is still owed
        // does not leave at all. The home verb belongs only to a hand standing
        // alone with nothing left to host.
        const verb = shell.handExitVerb();
        if (verb === 'pop') {
          leaveWorkspace();
        } else if (verb === 'home') {
          goBoardHome();
        }
      },
      restoreScroll: (px) => {
        (shell.surfaces.at<ExposedOf<typeof ConsoleHandSection>>('handSection'))?.restoreScroll(px);
      },
    });
    // Clear any scale-overview tooltip a stray real-mouse hover left showing
    // before the shell reported its presence (mouse tooltips are suppressed in
    // console mode from here on — see ArcScale.mouseTooltipsSuppressed).
    hideScaleTooltip();
    // THE DOOR'S MOUNT EDGE. A reload with a card-granted bonus move already on
    // the wire computes its door as `open` on the very first evaluation, so no
    // change watcher can ever fire for it — the workspace never opened and the
    // prompt was genuinely stranded. Asked HERE, not with `immediate`: an
    // immediate handler runs at setup, before there is a shell to enter a
    // workspace from.
    shell.syncHydroBonusDoor();
    startConsoleLeakDetector(() => shell.playerView);
    // THE BEAT STALL GUARD: a machine beat with nothing in flight is a stall, whatever its cause (the R&D Funding freeze).
    shell.startSupervisor();
    // THE PARK MUST NOT SILENCE THE FEED (the «Экран завис» deadlock). A
    // foreign colony bonus's batch is deliberately presented NOWHERE until the
    // player opens its announcement — and the announcement's own FIRST
    // presentation waits for the notification feed to settle. Counted as a
    // live result-modal, the parked batch silenced the very feed its door was
    // waiting for, and only the foreground watchdog got out (`expired
    // result-modal`). The shell owns the park verdict, so it injects it: the
    // SAME pending + parks pair `rawDrawnRevealPending` reads, never a second
    // derivation — the silence and the surface cannot disagree about the batch.
    // …and the BOARD-BEAT park is the second member of the same exemption:
    // a global-parameter batch waiting out a covered board is presented
    // NOWHERE by design, and must not read as a live result-modal either.
    // …and the parliament's Agenda CARD park is the third (same law, same shape).
    shell.releaseRevealParkSupplier = registerRevealParkSupplier((batch) => shell.revealBatchParked(batch));
    // FK — THE CARD'S CORNER: a full-bleed inspection (the card / party dossier viewer) stands where the card would;
    // a NEW card waits in the queue (its tail is the beacon) and presents when the viewer leaves (PL-680). (The
    // received-cards reveal claims the corner itself — FL; never a read of this shell's computeds from here.)
    releaseNotificationCorner.value = registerNotificationCornerProbe(() => consoleCardZoom.card !== undefined);
    // T6: the notification CTAs go through the typed notificationBus;
    // PlayerHome's listeners don't exist in console — the shell answers them.
    notificationBusOff.value = [
      notificationBus.goToAction.on(onNotificationGoToAction),
      notificationBus.cancel.on(shell.onNotificationCancel),
      notificationBus.openParliament.on(shell.onNotificationOpenParliament),
      notificationBus.inspectResolution.on(onNotificationInspectResolution),
    ];
    // SCENE TRANSITION (the game destination). Register where «выйти из
    // партии» leads — a campaign mission returns to ITS campaign map, an
    // ordinary game to the main menu; every exit door funnels through
    // exitGameToMenu() so the destination can never diverge between doors.
    syncGameExitTarget();
    // …and hold the boot curtain until this shell's FIRST frame is real:
    // fonts settled (a fallback-font swap moves layout) and — when the boot
    // state demands the start workspace — the start scene actually rendered,
    // so a new game reveals INTO its opening composition, never onto a bare
    // board a workspace then pops over. The board section registers its own
    // geometry-convergence hold. Every hold is bounded by the director.
    if (loadingScreenState.phase === 'covering') {
      const releaseFonts = deferSceneReveal('fonts', 3000);
      const fonts = (document as Partial<Document>).fonts;
      if (fonts !== undefined) {
        void fonts.ready.then(() => releaseFonts());
      } else {
        releaseFonts();
      }
      if (shell.startFrameLive) {
        const releaseStart = deferSceneReveal('start-scene', 8000);
        const settle = () => void shell.$nextTick(() => releaseStart());
        if (shell.startSceneVisible) {
          settle();
        } else {
          const stop = watch(
            () => shell.startSceneVisible,
            (visible: boolean) => {
              if (visible) {
                settle();
                stop();
              }
            });
        }
      }
      armSceneDestination();
    }
  }

  /** THE SHELL IS LEAVING — its own wiring first, then the session's ordered pass, then what is the instance's own. */
  function shellLeaving(): void {
    // ── THE SHELL'S OWN WIRING GOES FIRST: a dead shell's closures (its probes, suppliers, hooks and leases) must not
    //    drive what the teardown below does — or the next game. ──
    registerGenerationSceneHandoff(undefined); // a dead shell's director must not gate the next game's rise
    handoffPendingEntries.clear();
    shell.stopSupervisor(); // the liveness arbiter dies with its shell (the start watchdog and its shadow are its scope's)
    delete (window as unknown as {__conStartShadow?: unknown}).__conStartShadow;
    registerScreenShadowContext(undefined);
    registerScreenCureExecutor(undefined);
    registerFrameAnchorDead(undefined);
    registerFrameBeatExpired(undefined);
    registerAnchorDropListener(undefined);
    registerReadinessDecisionDiag(undefined);
    delete (window as unknown as {__conScreenShadow?: unknown}).__conScreenShadow;
    delete (window as unknown as {__conWaitGraph?: unknown}).__conWaitGraph;
    delete (window as unknown as {__conScreenControl?: unknown}).__conScreenControl;
    registerBoardShownDespiteStack(undefined);
    setConsoleTaskHandoffPending(false);
    registerColonyTrackMoveHost(undefined);
    registerColonyRosterHost(undefined);
    shell.offIntent?.();
    offWsPresence.value?.();
    shell.offHydroWitnesses?.();
    shell.offHydroWitnesses = undefined;
    registerHydroFlowProbe(undefined); // a dead shell's closures must not drive the next game
    offPlanetFocusParams.value?.();
    registerTerraformedSceneProbes(undefined);
    shell.releaseRevealQueuePark?.();
    shell.releaseRevealQueuePark = undefined;
    registerDiscardOverlayHandoff(undefined);
    registerPreselectedDiscardArm(undefined);
    setAlbumLayoutRecomposer(undefined);
    releasePresentationLease.value?.();
    releasePresentationLease.value = undefined;
    // Restore the default reveal-park supplier: a dead shell's closure reads
    // computeds whose effects are stopped at unmount.
    shell.releaseRevealParkSupplier?.();
    shell.releaseRevealParkSupplier = undefined;
    releaseNotificationCorner.value?.();
    releaseNotificationCorner.value = undefined;
    consoleState.shellMounted = false;
    setMandatoryGateHeld(false); // shell gone → clear the held mirror (the watcher won't fire on unmount)
    // The claim's serving probe goes before the claim's own reset (in the pass below): a dead shell's computeds must
    // never guard the next game's releases — the reset itself is forced either way.
    setWorkspaceOutcomeServingProbe(undefined);
    // ── THE GAME SCREEN LEAVES. Every module that keeps state of the running game DECLARED it beside its own reset
    //    (`sessionState(label, reset, at)`), and the session takes all of it down here in ONE ordered pass — the list
    //    of `reset…()` rows this hook used to be (66 of them; a module missing from it leaked into the next game) is
    //    gone (architecture v2 — PLAN §10 · C5). The session's SCOPE — every flow, hold, timer and wait of the game —
    //    ends in `unmounted`, after the shell's children. ──
    leaveConsoleSession();
    // ── …and what is the shell instance's own. ──
    shell.zoomOpenToken++; // fence out any stale open-sequence callback
    shell.clearZoomOpenFlight();
    document.body.classList.remove('con-zoom-open');
    document.body.classList.remove('con-play-modal-open');
    shell.clearDepartingPlayCard();
    notificationBusOff.value.forEach((off) => off());
    notificationBusOff.value = [];
  }

  return {
    offPlanetFocusParams,
    offWsPresence,
    releasePresentationLease,
    releaseNotificationCorner,
    notificationBusOff,
    deadPhaseAnchors,
    offStageDeadAnchorKey,
    reviewMapSpaces,
    onNotificationInspectResolution,
    toggleInspection,
    exitInspection,
    toggleScaleInspect,
    exitScaleInspect,
    cancelClientPick,
    seatAwardFundingSurface,
    onNotificationGoToAction,
    syncGameExitTarget,
    submit,
    submitBatch,
    whenPromptPresenceIdentityChanges,
    whenCardDeltaEntryFrameLiveChanges,
    whenAwardFundingActiveChanges,
    whenTopNotificationChanges,
    whenPatentSaleStatePhaseChanges,
    whenConsoleMandatoryPresentingChanges,
    whenConsoleStateSheetChanges,
    whenJournalPanelVisibleChanges,
    whenConsoleForegroundBusyChanges,
    whenOffStageDeadAnchorKeyChanges,
    whenStartFrameLiveChanges,
    whenMandatoryGateHeldChanges,
    whenBoardHomeIdleChanges,
    whenStartTaskChanges,
    whenStartSceneServesChanges,
    whenFinaleOverForViewerChanges,
    shellMounted,
    shellLeaving,
  };
}

export type WiringController = ReturnType<typeof createWiringController>;
