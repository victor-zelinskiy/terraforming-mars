/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PADROUTER CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {cursorEnsureVisible, scrollContainerOf} from '@/client/console/cursorScroll';
import {stickScrollBy} from '@/client/console/stickScrollTarget';
import {computed, ref, onBeforeUnmount, onMounted} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {noteInputAbsorbed, registerInputAbsorber} from '@/client/console/inputAbsorb';
import ConsoleCardActions from '@/client/components/console/ConsoleCardActions.vue';
import {consoleCardActionsUi} from '@/client/console/consoleCardActions';
import {SpaceId} from '@/common/Types';
import {SubmitTicket} from '@/client/console/transport/gameTransport';
import {skipTerraformedScene, terraformedSceneUp} from '@/client/console/terraformedScene/terraformedScene';
import {botTurnReviewState, closeBotTurnReview, setBotReviewPeek} from '@/client/components/marsbot/botTurnReviewState';
import {openBotTurnReviewByKey, skipBotTurnPresentation, stepBotTurnReview} from '@/client/components/marsbot/marsBotPresentation';
import {CONSOLE_SCROLL_STEP_PX} from '@/client/console/shell/shellMetrics';
import {notificationState, dismiss as dismissNotification} from '@/client/components/notifications/notificationState';
import {beginNotifHold, cancelNotifHold, consumeNotifHoldRelease} from '@/client/console/consoleNotifHold';
import {LiveNotification} from '@/client/components/notifications/notificationTypes';
import {stepGrid} from '@/client/components/console/consoleMaModel';
import {maFocusState, discardMaFocusDraft, maFocusAcceptsInput} from '@/client/console/consoleMaFocus';
import ConsoleStdProjectsScreen from '@/client/components/console/ConsoleStdProjectsScreen.vue';
import {QuickSlot} from '@/client/console/consoleQuickModel';
import ConsoleBoardSection from '@/client/components/console/ConsoleBoardSection.vue';
import ConsoleHandSection from '@/client/components/console/ConsoleHandSection.vue';
import ConsoleColoniesSection from '@/client/components/console/ConsoleColoniesSection.vue';
import ConsoleParliamentSection from '@/client/components/console/ConsoleParliamentSection.vue';
import ConsoleInfoMode from '@/client/components/console/ConsoleInfoMode.vue';
import {dismissConsoleAlert, isConsoleAlertActive} from '@/client/console/consoleSystemAlertState';
import ConsoleTaskHost from '@/client/components/console/ConsoleTaskHost.vue';
import ConsoleGovernmentSupport from '@/client/components/console/ConsoleGovernmentSupport.vue';
import ConsoleEffectDecision from '@/client/components/console/ConsoleEffectDecision.vue';
import {FINISH_WAITS, LANDING_LINE} from '@/client/console/finalGreenery/finalGreeneryModel';
import ConsoleProductionLoss from '@/client/components/console/ConsoleProductionLoss.vue';
import {promptSettleAbsorbs} from '@/client/console/promptSequence';
import ConsoleDeckPick from '@/client/components/console/deckPick/ConsoleDeckPick.vue';
import ConsoleStartScene from '@/client/components/console/ConsoleStartScene.vue';
import ConsoleEndgameWorkspace from '@/client/components/console/ConsoleEndgameWorkspace.vue';
import ConsoleRevealOverlay from '@/client/components/console/ConsoleRevealOverlay.vue';
import ConsolePlayCardConfirm from '@/client/components/console/ConsolePlayCardConfirm.vue';
import {enterWorkspace, goBoardHome, leaveWorkspace, popWorkspaceFrame, workspaceFrameIndex, workspaceFramePhase, workspaceStackBack, workspaceStackBackVerb, workspaceFrameHost, workspaceFrameIsOverlay, workspaceStackTopAxis} from '@/client/console/consoleWorkspaceStack';
import {acceptsInput, isCommitted} from '@/client/console/consoleWorkspaceFlow';
import {requestStdProjectCancel, stdProjectsFlowLive} from '@/client/console/consoleStdProjects';
import {handStageTransitioning} from '@/client/console/consoleHandStageMotion';
import ConsoleCorpFirstActionConfirm from '@/client/components/console/ConsoleCorpFirstActionConfirm.vue';
import {handRevealState} from '@/client/console/handDock/handRevealState';
import {finishInstant, isHandRevealEpisodeRunning, reverseHandReveal, runningHandRevealKind} from '@/client/console/handDock/handRevealDirector';
import {draftPickBeatActive, skipDraftPickBeat} from '@/client/console/cardDeal/consoleDraftTray';
import ConsoleDraftWorkspace from '@/client/components/console/draft/ConsoleDraftWorkspace.vue';
import ConsoleExternalDrawWorkspace from '@/client/components/console/externalDraw/ConsoleExternalDrawWorkspace.vue';
import {isTradeFleetActive} from '@/client/console/colonyFleet/consoleTradeFleet';
import {isColonyTradeInputLocked} from '@/client/console/colonyTrade/consoleColonyTrade';
import ConsolePlayedOverlay from '@/client/components/console/played/ConsolePlayedOverlay.vue';
import {consolePlayedUi} from '@/client/console/consolePlayedUi';
import {isPlayedHeroActive, playedHeroState, skipPlayedHeroResult} from '@/client/console/played/consolePlayedHero';
import {colonyGridCols, colonyGridLayout, colonyNavStep, closeColonyFocus, colonyDockCursor} from '@/client/console/consoleColoniesModel';
import {colonyCursorStep} from '@/client/console/colonyTrade/fleetDockModel';
import {effectForecastOpen} from '@/client/console/consoleEffectForecast';
import {availabilityContextFor} from '@/client/console/cardAvailability';
import {consoleCardZoom, openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {openRevealViewer} from '@/client/components/notifications/revealViewerState';
import ConsoleSpendHeat from '@/client/components/console/ConsoleSpendHeat.vue';
import ConsoleVenusBonus from '@/client/components/console/ConsoleVenusBonus.vue';
import ConsoleBotAttack from '@/client/components/console/ConsoleBotAttack.vue';
import ConsoleAresGlobals from '@/client/components/console/ConsoleAresGlobals.vue';
import {cancelResponse} from '@/client/console/taskResponses';
import {govScaleFocusState} from '@/client/console/consoleGovScaleFocus';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
import {isHydroMarkerActive} from '@/client/console/hydroMarker/consoleHydroMarker';
import {abortBoardCardBonus, isBoardCardBonusActive} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {isDeckDrawActive} from '@/client/console/deckDraw/consoleDeckDraw';
import {isPatentSaleActive} from '@/client/console/patentSale/consolePatentSale';
import {cardReactionPending, hurryCardReactions} from '@/client/console/cardReaction/cardReactionDirector';
import {tilePlacementHolding} from '@/client/console/tilePlacement/consoleTilePlacement';
import {lockPlacementCell, placementCommitReady, placementFlowState, placementPressAllowed, unlockPlacementCell} from '@/client/console/tilePlacement/placementFlow';
import {pickUpMoveSource, putDownMoveSource} from '@/client/console/tilePlacement/placementMove';
import {nomadMoveHolding} from '@/client/console/nomads/consoleNomadMove';
import ConsoleJournalPanel from '@/client/components/console/ConsoleJournalPanel.vue';
import {consoleJournalUi} from '@/client/console/consoleJournalState';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {activeGlyphSet} from '@/client/gamepad/glyphSets';
import {resolveScope} from '@/client/gamepad/focusScopes';
import {consoleState, closeConsoleLayers, stepIndex, stepSelectable} from '@/client/console/consoleRouter';
import {isSurfaceAwaitingHandoff, markWheelHandoff, retargetWheelEcho} from '@/client/console/surfaceMotion/surfaceMotionState';
import {WheelArmEvent, reduceWheel} from '@/client/console/quickWheel/wheelArmModel';
import {wheelControlState} from '@/client/console/quickWheel/wheelControlMode';
import {wheelHandoffSpecFor, CONFIRM_HANDOFF} from '@/client/console/quickWheel/wheelHandoffModel';
import {pulseWheelAnchors} from '@/client/console/quickWheel/wheelPulse';
import {pinQuickWheelBox} from '@/client/console/surfaceMotion/surfaceMotionDirector';
import {cancelConsoleHandPick, declineConsoleHandPick, deferConsoleHandPick} from '@/client/console/consoleHandPick';
import {cancelConsolePlayPick} from '@/client/console/consolePlayPick';
import {isDeltaRewardPickActive} from '@/client/console/hydroFlow/deltaRewardEntry';
import {isDeltaEspionagePickActive} from '@/client/console/hydroFlow/deltaEspionageEntry';
import {isBlockadeExecutionActive, isDeltaBlockadePickActive} from '@/client/console/hydroFlow/deltaBlockadeEntry';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {findConvertHeatOption, findConvertPlantsOption, findEndTurnPath, optionResponseForPath} from '@/client/console/turnIntents';
import {infoModeState, cyclePlayer} from '@/client/console/infoModeState';
import {extrasExplorerUi, selectExtrasType} from '@/client/console/consoleExtrasExplorer';
import {effectsExplorerLayer} from '@/client/console/consoleEffectsExplorer';
import {infoRouteApplies, infoZoneRoute, infoZoneFocusable, infoZoneNavigate, infoFocusRing, botScreenNavigate, isVpRoute} from '@/client/console/infoRoute';
import {playInspectedSwitchMotion} from '@/client/console/inspectSwitchMotion';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {journalState} from '@/client/components/journal/journalState';
import {stagedPlayState, stagedColonyOf} from '@/client/console/stagedPlay';
import ConsoleActionConfirm from '@/client/components/console/ConsoleActionConfirm.vue';
import {colonyRosterDraft, colonyRosterPending, hurryColonyRoster, isColonyRosterInputLocked} from '@/client/console/colonyRoster/consoleColonyRoster';
import {hurryColonyCity, isColonyCityInputLocked} from '@/client/console/colonyCity/consoleColonyCity';
import type {PlayCardController} from '@/client/console/shell/playCardController';
import type {SeatController} from '@/client/console/shell/seatController';
import type {WorkspaceController} from '@/client/console/shell/workspaceController';
import type {StdProjectsController} from '@/client/console/shell/stdProjectsController';
import type {HandSelectController} from '@/client/console/shell/handSelectController';
import type {RouterController} from '@/client/console/shell/routerController';
import type {PlacementController} from '@/client/console/shell/placementController';
import type {MaController} from '@/client/console/shell/maController';
import type {StagedController} from '@/client/console/shell/stagedController';
import type {RevealController} from '@/client/console/shell/revealController';
import type {JournalController} from '@/client/console/shell/journalController';
import type {ColonyController} from '@/client/console/shell/colonyController';
import type {ConvertController} from '@/client/console/shell/convertController';
import type {PlayedController} from '@/client/console/shell/playedController';
import type {MandatoryController} from '@/client/console/shell/mandatoryController';
import type {DraftController} from '@/client/console/shell/draftController';
import type {FinaleController} from '@/client/console/shell/finaleController';
import type {ParliamentController} from '@/client/console/shell/parliamentController';
import type {HandController} from '@/client/console/shell/handController';
import type {HydroController} from '@/client/console/shell/hydroController';
import type {WheelController} from '@/client/console/shell/wheelController';
import type {ViewerController} from '@/client/console/shell/viewerController';
import type {InfoController} from '@/client/console/shell/infoController';
import type {CellController} from '@/client/console/shell/cellController';
import type {CommandBarController} from '@/client/console/shell/commandBarController';
import type {NoticeController} from '@/client/console/shell/noticeController';
import type {StartController} from '@/client/console/shell/startController';
import type {OutcomeController} from '@/client/console/shell/outcomeController';
import {noteUnreceivedPress} from '@/client/console/inputEcho';
import type {SurfaceRegistry} from '@/client/console/shell/surfaceRegistry';

/** PC04 · GS — the ledger's name of the series' visit standing between two questions (`seriesHeld`). */
const SERIES_VISIT_ABSORBER = 'series-visit';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type PadRouterPort = {
  surfaces: SurfaceRegistry,
  acceptConfirm: UnwrapRef<PlayCardController['acceptConfirm']>,
  actionBlockedReason: UnwrapRef<SeatController['actionBlockedReason']>,
  activateSheetRow: UnwrapRef<WorkspaceController['activateSheetRow']>,
  activateStdItem: UnwrapRef<StdProjectsController['activateStdItem']>,
  applyFocusedFilterChip: UnwrapRef<HandSelectController['applyFocusedFilterChip']>,
  aresGlobalsActive: UnwrapRef<RouterController['aresGlobalsActive']>,
  armBoardBonusIfCardCell: UnwrapRef<PlacementController['armBoardBonusIfCardCell']>,
  awardFundingActive: UnwrapRef<MaController['awardFundingActive']>,
  awardStepHosted: UnwrapRef<MaController['awardStepHosted']>,
  beginFinalGreeneryFinish: UnwrapRef<PlacementController['beginFinalGreeneryFinish']>,
  botAttackActive: UnwrapRef<RouterController['botAttackActive']>,
  cancelClientPick(): void,
  cancelPlacement: UnwrapRef<PlacementController['cancelPlacement']>,
  cancelStagedPlay: UnwrapRef<StagedController['cancelStagedPlay']>,
  cardDiscardHolds: UnwrapRef<HandSelectController['cardDiscardHolds']>,
  closeHandWithReveal: UnwrapRef<RevealController['closeHandWithReveal']>,
  closeJournal: UnwrapRef<JournalController['closeJournal']>,
  collapseWorkspace: UnwrapRef<WorkspaceController['collapseWorkspace']>,
  coloniesForRail: UnwrapRef<ColonyController['coloniesForRail']>,
  colonyCancellable: UnwrapRef<ColonyController['colonyCancellable']>,
  /** WRITTEN here. */ colonyCursorTarget: UnwrapRef<ColonyController['colonyCursorTarget']>,
  colonyDocks: UnwrapRef<ColonyController['colonyDocks']>,
  colonyFocusOpen: UnwrapRef<ColonyController['colonyFocusOpen']>,
  colonyPick: UnwrapRef<ColonyController['colonyPick']>,
  colonyResolutionLive: UnwrapRef<ColonyController['colonyResolutionLive']>,
  colonyRosterOutgoing: UnwrapRef<ColonyController['colonyRosterOutgoing']>,
  confirmColonySelection: UnwrapRef<ColonyController['confirmColonySelection']>,
  confirmHandSelect: UnwrapRef<HandSelectController['confirmHandSelect']>,
  confirmSale: UnwrapRef<StdProjectsController['confirmSale']>,
  consoleRevealMode: UnwrapRef<RevealController['consoleRevealMode']>,
  contextualSourceKnown: UnwrapRef<HandSelectController['contextualSourceKnown']>,
  /** WRITTEN here. */ convertPlantsPending: UnwrapRef<ConvertController['convertPlantsPending']>,
  corpFirstActionOpen: UnwrapRef<PlayedController['corpFirstActionOpen']>,
  cycleHandFilter: UnwrapRef<HandSelectController['cycleHandFilter']>,
  deckPickServing: UnwrapRef<RevealController['deckPickServing']>,
  deferFinalGreenery: UnwrapRef<PlacementController['deferFinalGreenery']>,
  deferShellTask: UnwrapRef<MandatoryController['deferShellTask']>,
  draftedCards: UnwrapRef<DraftController['draftedCards']>,
  draftTrayMounted: UnwrapRef<DraftController['draftTrayMounted']>,
  draftWaitActive: UnwrapRef<DraftController['draftWaitActive']>,
  draftWorkspaceOwnsPad: UnwrapRef<DraftController['draftWorkspaceOwnsPad']>,
  effectDecisionActive: UnwrapRef<RouterController['effectDecisionActive']>,
  endgameStageUp: UnwrapRef<FinaleController['endgameStageUp']>,
  enterColonyFocus: UnwrapRef<ColonyController['enterColonyFocus']>,
  enterMaFocus: UnwrapRef<MaController['enterMaFocus']>,
  enterOrRestoreWorkspace: UnwrapRef<WorkspaceController['enterOrRestoreWorkspace']>,
  exitInspection(): void,
  exitScaleInspect(): void,
  externalDrawOwnsPad: UnwrapRef<RevealController['externalDrawOwnsPad']>,
  finalePanel: UnwrapRef<FinaleController['finalePanel']>,
  finaleSessionEngaged: UnwrapRef<FinaleController['finaleSessionEngaged']>,
  finalGreeneryActive: UnwrapRef<PlacementController['finalGreeneryActive']>,
  finalGreeneryPickPending: UnwrapRef<PlacementController['finalGreeneryPickPending']>,
  foldMaFocus: UnwrapRef<MaController['foldMaFocus']>,
  govSupportActive: UnwrapRef<ParliamentController['govSupportActive']>,
  handBlockedNotice: UnwrapRef<HandController['handBlockedNotice']>,
  handCoveredByHydro: UnwrapRef<HydroController['handCoveredByHydro']>,
  handEntries: UnwrapRef<HandController['handEntries']>,
  handleColonyInspectIntent: UnwrapRef<ColonyController['handleColonyInspectIntent']>,
  handleMaPayIntent: UnwrapRef<MaController['handleMaPayIntent']>,
  handleQuickIntent: UnwrapRef<WheelController['handleQuickIntent']>,
  handleZoomIntent: UnwrapRef<ViewerController['handleZoomIntent']>,
  handPickActive: UnwrapRef<HandSelectController['handPickActive']>,
  handPickDeclineLive: UnwrapRef<HandSelectController['handPickDeclineLive']>,
  handPickDeferLive: UnwrapRef<MandatoryController['handPickDeferLive']>,
  handScrollActive: UnwrapRef<HandController['handScrollActive']>,
  handSelectModel: UnwrapRef<HandSelectController['handSelectModel']>,
  handSelectPress: UnwrapRef<HandSelectController['handSelectPress']>,
  handSelectSingle: UnwrapRef<HandSelectController['handSelectSingle']>,
  handSelectTaskActive: UnwrapRef<HandSelectController['handSelectTaskActive']>,
  handSelectUiActive: UnwrapRef<HandSelectController['handSelectUiActive']>,
  hostTask: UnwrapRef<RouterController['hostTask']>,
  infoBack: UnwrapRef<InfoController['infoBack']>,
  infoExtrasChipList: UnwrapRef<InfoController['infoExtrasChipList']>,
  infoGo: UnwrapRef<InfoController['infoGo']>,
  infoViewedKind: UnwrapRef<InfoController['infoViewedKind']>,
  infoZoneCtx: UnwrapRef<InfoController['infoZoneCtx']>,
  inspectCellSource: UnwrapRef<PlacementController['inspectCellSource']>,
  inspectContextualSource: UnwrapRef<HandSelectController['inspectContextualSource']>,
  inspectFleetDock: UnwrapRef<ColonyController['inspectFleetDock']>,
  inspectPlacementSource: UnwrapRef<PlacementController['inspectPlacementSource']>,
  inspectReviewCard: UnwrapRef<HandController['inspectReviewCard']>,
  journalColonyInspect: UnwrapRef<JournalController['journalColonyInspect']>,
  journalPanelVisible: UnwrapRef<JournalController['journalPanelVisible']>,
  landColonyCursorOnTradeable: UnwrapRef<ColonyController['landColonyCursorOnTradeable']>,
  mandatoryAnnounceVisible: UnwrapRef<MandatoryController['mandatoryAnnounceVisible']>,
  mandatoryDeferredActive: UnwrapRef<MandatoryController['mandatoryDeferredActive']>,
  mandatoryGateHeld: UnwrapRef<MandatoryController['mandatoryGateHeld']>,
  maScreenItems: UnwrapRef<MaController['maScreenItems']>,
  maScreenKind: UnwrapRef<MaController['maScreenKind']>,
  onNotificationInspectResolution(resolution: string): void,
  onNotificationOpenParliament: UnwrapRef<ParliamentController['onNotificationOpenParliament']>,
  openFinalGreeneryOnBoard: UnwrapRef<PlacementController['openFinalGreeneryOnBoard']>,
  openHandWithReveal: UnwrapRef<RevealController['openHandWithReveal']>,
  openJournalToNotification: UnwrapRef<JournalController['openJournalToNotification']>,
  openMandatoryAnnounce: UnwrapRef<MandatoryController['openMandatoryAnnounce']>,
  openPlayCardFromHand: UnwrapRef<PlayCardController['openPlayCardFromHand']>,
  openPlayedOverlay: UnwrapRef<PlayedController['openPlayedOverlay']>,
  openQuick: UnwrapRef<WheelController['openQuick']>,
  openSheet: UnwrapRef<WorkspaceController['openSheet']>,
  padSection: UnwrapRef<HandSelectController['padSection']>,
  /** WRITTEN here. */ pendingClientPayment: UnwrapRef<PlayCardController['pendingClientPayment']>,
  pendingClientPick: UnwrapRef<PlayCardController['pendingClientPick']>,
  pendingPlayCard: UnwrapRef<PlayCardController['pendingPlayCard']>,
  placementActive: UnwrapRef<PlacementController['placementActive']>,
  placementCancellable: UnwrapRef<PlacementController['placementCancellable']>,
  placementMoveLevelNow: UnwrapRef<PlacementController['placementMoveLevelNow']>,
  placementSpaceModel: UnwrapRef<PlacementController['placementSpaceModel']>,
  playedTableVisible: UnwrapRef<PlayedController['playedTableVisible']>,
  readonly playerView: PlayerViewModel,
  playPickActive: UnwrapRef<HandSelectController['playPickActive']>,
  postGameInspection: UnwrapRef<SeatController['postGameInspection']>,
  productionLossActive: UnwrapRef<RouterController['productionLossActive']>,
  quickEntries: UnwrapRef<WheelController['quickEntries']>,
  repeatPickActive: UnwrapRef<HandSelectController['repeatPickActive']>,
  reseatColonyRosterLevel: UnwrapRef<ColonyController['reseatColonyRosterLevel']>,
  resetHandFilter: UnwrapRef<HandSelectController['resetHandFilter']>,
  restoreDeferredTask: UnwrapRef<MandatoryController['restoreDeferredTask']>,
  readonly reviewMapSpaces: ReadonlyArray<SpaceId>,
  rollbackStdProjectFlow: UnwrapRef<StdProjectsController['rollbackStdProjectFlow']>,
  selectedCellLegal: UnwrapRef<CellController['selectedCellLegal']>,
  seriesHeld: UnwrapRef<RouterController['seriesHeld']>,
  sheetRows: UnwrapRef<CommandBarController['sheetRows']>,
  shellTask: UnwrapRef<RouterController['shellTask']>,
  shellTaskActive: UnwrapRef<RouterController['shellTaskActive']>,
  showNotice: UnwrapRef<NoticeController['showNotice']>,
  spendHeatActive: UnwrapRef<RouterController['spendHeatActive']>,
  stagedBackOwedNow: UnwrapRef<StagedController['stagedBackOwedNow']>,
  startSceneOwnsPad: UnwrapRef<StartController['startSceneOwnsPad']>,
  stdBackLabel: UnwrapRef<StdProjectsController['stdBackLabel']>,
  stdProjectItems: UnwrapRef<StdProjectsController['stdProjectItems']>,
  submit(response: unknown): SubmitTicket,
  submitMaFocusCommit: UnwrapRef<MaController['submitMaFocusCommit']>,
  taskSpacePending: UnwrapRef<PlacementController['taskSpacePending']>,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
  toggleInfoMode: UnwrapRef<InfoController['toggleInfoMode']>,
  toggleInspection(): void,
  toggleJournal: UnwrapRef<JournalController['toggleJournal']>,
  togglePickSelectAll: UnwrapRef<HandSelectController['togglePickSelectAll']>,
  toggleSalePick: UnwrapRef<StdProjectsController['toggleSalePick']>,
  toggleScaleInspect(): void,
  toggleSelectAllSale: UnwrapRef<StdProjectsController['toggleSelectAllSale']>,
  toggleSelectAllTask: UnwrapRef<HandSelectController['toggleSelectAllTask']>,
  toggleSuitableOnly: UnwrapRef<HandSelectController['toggleSuitableOnly']>,
  turnHandPage: UnwrapRef<HandController['turnHandPage']>,
  venusBonusActive: UnwrapRef<RouterController['venusBonusActive']>,
  /** WRITTEN here. */ wheelInput: UnwrapRef<WheelController['wheelInput']>,
  workspaceOutcomeEmbedded: UnwrapRef<OutcomeController['workspaceOutcomeEmbedded']>,
  zoomHandCard: UnwrapRef<HandController['zoomHandCard']>,
};

export function createPadRouterController(shell: PadRouterPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Re-entrancy guard: an X TAP being replayed past the toast's hold capture. */
  const notifTapReplay = ref(false);
  const offIntent = ref(undefined as (() => void) | undefined);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The currently VISIBLE transient notification — the topmost (the feed is
   *  serial, so at most one). GLOBAL rule: any console toast is dismissable
   *  with B («B Закрыть» on the card); the flow-holding AI-turn card
   *  additionally offers its detail action on press-and-HOLD X. */
  const topNotification = computed((): LiveNotification | undefined => {
    const feed = notificationState.transient;
    return feed.length > 0 ? feed[feed.length - 1] : undefined;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * THE PAD GOES TO A SURFACE'S OWN HANDLER — and the router says when nobody was there to receive it.
   *
   * Who owns the pad is decided from the game's state (the ladder below); the surface itself is a mounted component
   * reached through a ref. The two can disagree — a surface the state says stands while its node is not mounted (a
   * `v-if` one term apart, a leave that outlived its frame) — and a bare `ref?.handleIntent(intent); return true`
   * then reported a press NOBODY received as taken: the deaf screen, invisible to the liveness arbiter because the
   * router vouched for it. The intent is still consumed (nothing may act under an owned pad); the verb is counted
   * DROPPED (`inputEcho.noteUnreceivedPress`), and the surface is named once while it stays away.
   */
  const deafSurfaces = new Set<string>();
  function handedTo(surface: {handleIntent(intent: GamepadIntent): unknown} | undefined | null, name: string, intent: GamepadIntent): void {
    if (surface === undefined || surface === null) {
      noteUnreceivedPress(name);
      if (intent.kind === 'press' && !deafSurfaces.has(name)) {
        deafSurfaces.add(name);
        console.warn(`[pad] «${name}» owns the pad and is not mounted — the press went to nobody (counted as dropped)`);
      }
      return;
    }
    deafSurfaces.delete(name);
    surface.handleIntent(intent);
  }

  // ── input ────────────────────────────────────────────────────────────
  function handleIntent(intent: GamepadIntent): boolean {
    // Foundation: presses resolve to SEMANTIC actions (consoleActionOf) —
    // the shell compares `action`, never raw button names (undefined for
    // nav/scroll/release and the screen-specific STICKS, which stay raw).
    const action = consoleActionOf(intent);
    // «СРАБАТЫВАНИЕ КАРТЫ» (iteration 3, the owner's 2026-10-27): a PRESS while the table's reactions play HURRIES
    // them — a pace, never a cut: every face still rises, every token still flies, the read beats shorten; a second
    // press completes them at once. The press itself goes on to whatever owns it — a reaction never holds input.
    if (intent.kind === 'press' && cardReactionPending()) {
      hurryCardReactions('press');
    }
    // NOTIFICATION X-HOLD lifecycle (consoleNotifHold): the release edge of a
    // tracked hold is resolved FIRST — ahead of every swallowing gate — so a
    // let-go can never be eaten by a scene/alert branch and leave the timer
    // to fire a hold the player abandoned. A release BEFORE the threshold is
    // a TAP: it is REPLAYED through this handler (guarded by notifTapReplay)
    // so X keeps its normal meaning on the surface beneath the toast.
    if (intent.kind === 'release' && intent.button === 'secondary') {
      if (consumeNotifHoldRelease()) {
        return true;
      }
      if (cancelNotifHold()) {
        notifTapReplay.value = true;
        try {
          handleIntent({kind: 'press', button: 'secondary'});
        } finally {
          notifTapReplay.value = false;
        }
        return true;
      }
    }
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
    // SURFACE MOTION — a COMMITTED submit is awaiting its answer (the
    // composer holds the stage, its CTA shows the in-flight beat). The
    // action is already on the wire: B must not read as a cancel, another
    // A must not double-fire, and nothing may act under the held scene.
    // Bounded by AWAITING_SAFETY_MS (the resolve/expiry lives in the
    // playerView watcher), so the pad can never stick. Sits BELOW the
    // system alert (a rejected input stays acknowledgeable above).
    if (shell.stagedBackOwedNow(intent, action)) {
      return true;
    }
    if (isSurfaceAwaitingHandoff()) {
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
    if (isTradeFleetActive() || isHydroMarkerActive() || isBoardCardBonusActive() || isPatentSaleActive() || tilePlacementHolding() || nomadMoveHolding()) {
      return true;
    }
    // TRADE REWARDS: the chip waves / card covers / marker glide own the
    // moment. PHASE-aware on purpose — the gate opens for the reveal take
    // and for a mandatory prompt between two colony-bonus draws (Pluto's
    // draw→discard pairing), so the transaction can never wedge the pad.
    if (isColonyTradeInputLocked()) {
      return true;
    }
    // THE COLONY ROSTER CEREMONY (a tile replaced / added / removed): the planet is leaving or docking — the pad
    // is the ceremony's. A does not act: it PRESSES THE BEAT THROUGH (final poses at once), never a second
    // submit and never a skipped state. Bounded by the ceremony's own named hold.
    if (isColonyRosterInputLocked()) {
      if (intent.kind === 'press' && action === 'primary') {
        hurryColonyRoster();
      }
      return true;
    }
    // A CITY LANDING ON A COLONY TILE (TR22): the piece is in the air, or the stage is folding home — the pad is
    // the scene's. A PRESSES IT THROUGH (final poses at once): never a second submit, never a skipped state.
    if (isColonyCityInputLocked()) {
      if (intent.kind === 'press' && action === 'primary') {
        hurryColonyCity();
      }
      return true;
    }
    // «МАРС ТЕРРАФОРМИРОВАН» (TR70): the planet shows — the pad is the scene's for its whole phrase. A press
    // after the camera has come in SKIPS it (one atomic finish: the scales let go, the title leaves, the
    // return plays once); every other intent is absorbed. Bounded by the scene's own named hold.
    if (terraformedSceneUp()) {
      if (intent.kind === 'press') {
        skipTerraformedScene();
      }
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
      if (playedHeroState.phase === 'armed') {
        if (action === 'back') {
          return true;
        }
      } else {
        if (intent.kind === 'press' && playedHeroState.phase === 'showing-result') {
          skipPlayedHeroResult();
          // (the table's reactions still in the air were HURRIED by the press itself, at the top of this handler —
          // a pace, never a cut; a second call here would be the cut.)
        }
        return true;
      }
    }
    // «Разбор хода» review owns the pad while open (a read-only foreground
    // item — the presentation flow holds every other surface). B closes, X
    // inspects the played card, L3 shows the placed tile on the board, the
    // right stick scrolls; during a peek any press returns to the review.
    if (botTurnReviewState.open) {
      // The fullscreen viewer opened via X owns the pad while it is up. It now
      // hosts BONUS cards too (the union CardZoomModal), so there is no
      // separate bonus-inspect surface to close first.
      if (consoleCardZoom.card !== undefined) {
        return shell.handleZoomIntent(intent);
      }
      if (botTurnReviewState.peek) {
        if (intent.kind === 'press') {
          setBotReviewPeek(false);
        }
        return true;
      }
      if (intent.kind === 'scroll') {
        scrollReviewFeed(intent.dy);
        return true;
      }
      if (intent.kind === 'press') {
        if (action === 'inspect') {
          shell.inspectReviewCard();
        } else if (action === 'prevSection') {
          // LB → previous bot turn (edge notice at the first archived turn).
          stepBotTurnReview(-1);
        } else if (action === 'nextSection') {
          // RB → next bot turn (edge notice if the next turn is not made yet).
          stepBotTurnReview(1);
        } else if (intent.button === 'stickL' && shell.reviewMapSpaces.length > 0) {
          setBotReviewPeek(true, shell.reviewMapSpaces);
        } else if (action === 'back') {
          closeBotTurnReview();
        }
      }
      return true;
    }
    // Government Support scale-focus hold: a brief, inert transition beat
    // while the board scale animates — swallow input so nothing fires under
    // the (about-to-open) next modal.
    if (govScaleFocusState.holding || govScaleFocusState.closing) {
      return true;
    }
    // P15: OUR fullscreen card viewer owns the pad completely while open
    // (it is a native <dialog>, so this must run BEFORE the resolveScope
    // fallback branch — the generic dialog scope would otherwise trap the
    // input in the DOM engine, where LB/RB browsing and the A select
    // context don't exist). Other (fallback-owned) dialogs never set
    // consoleCardZoom, so they still route to the DOM engine below.
    if (consoleCardZoom.card !== undefined) {
      return shell.handleZoomIntent(intent);
    }
    // THE FINALE ON THE BOARD (PL-296): while the finale's own board pick is out, RT is the FINISH — a HOLD (the
    // shared hold-to-confirm, «Пас»'s gesture), never the actions wheel (nothing else can be done at the end of the
    // game). Only at the cell-choice level: a LOCKED cell is a placement in progress — B steps back first.
    if (shell.finalGreeneryPickPending && shell.placementActive && intent.kind === 'press' && intent.button === 'triggerR') {
      if (placementFlowState.phase === 'navigate') {
        shell.beginFinalGreeneryFinish();
      }
      return true;
    }
    // MANDATORY PROMPT (consoleMandatoryGate): while the prompt card is
    // visible the pending mandatory decision is the priority — A OPENS a held
    // one / RETURNS to a deferred one (A is free on the board home; the
    // surface was held closed so it never popped over what the player was
    // watching). Navigation / other presses pass through so the player can
    // keep inspecting the board. Takes A ahead of a transient toast.
    if (shell.mandatoryAnnounceVisible && intent.kind === 'press' && action === 'primary') {
      if (shell.mandatoryGateHeld) {
        shell.openMandatoryAnnounce();
      } else {
        shell.restoreDeferredTask();
      }
      return true;
    }
    // PRESENTATION FLOW: a visible console toast never re-labels the command
    // bar and never swallows the screen's own verbs — the bar keeps the
    // CURRENT screen's contract; the card carries its own hints. The toast
    // claims exactly two overrides, both advertised ON the card:
    //  - B closes it («B Закрыть» — every toast);
    //  - press-and-HOLD X fires its DETAIL action (the flow-holding AI-turn
    //    card's «Осмотреть ход»). A single X TAP falls through to the
    //    surface beneath (the release-edge replay at the top of this
    //    handler), so the console-wide inspect verb (open a card fullscreen
    //    etc.) is never stolen. A / navigation pass through untouched — a
    //    deliberate acting press auto-acknowledges the flow-holding card
    //    (acknowledgeFlowHoldingCards in fetchPlayerInput).
    const topCard = topNotification.value;
    if (topCard !== undefined && consoleCardZoom.card === undefined) {
      // A visible toast OVERRIDES B everywhere — the press closes the card
      // and is consumed; only the NEXT B (no toast) is the screen's own
      // back/minimize. The other assignment shipped and was wrong within a
      // day: the player sees a toast, taps B to clear it, and their
      // workspace steps back under them instead — a navigation they never
      // asked for is strictly worse than a toast that costs one extra B.
      // The branch sits BELOW every screen-owning moment (alert / awaiting
      // handoff / heroes / review), so a cinematic's own swallow still wins.
      if (action === 'back') {
        cancelNotifHold();
        // A bot-turn card closed BY THE PLAYER collapses the whole AI-turn
        // backlog (ack + deliver + commit) instead of merely uncovering the
        // next one — «я посмотрел» is about the bot's turns, not about this
        // one card. A bare dismiss here also never acked, so the server kept
        // pacing the next turn on a client that had already caught up.
        if (topCard.botTurnKey !== undefined) {
          skipBotTurnPresentation(topCard.botTurnKey);
        } else {
          dismissNotification(topCard.id);
        }
        return true;
      }
      // The DETAIL action (press-and-HOLD X): the flow-holding AI-turn card
      // opens its «Разбор хода» review; ANY card carrying a journal root
      // (correlationId) opens the journal AT that event — the full causal
      // chain behind the toast, matching the «Hold X Журнал» hint the card
      // renders. Same availability policy as the View toggle (board home
      // only, never over a live placement) — refusals speak, never no-op.
      const detailKey = topCard.holdsFlow === true ? topCard.botTurnKey : undefined;
      // A fired passive of the ENACTED RESOLUTION: the detail is the resolution's own inspector, not the journal.
      const detailResolution = detailKey === undefined && topCard.variant === 'passive-effect' && topCard.effectSource?.kind === 'resolution' ?
        topCard.effectSource.resolution : undefined;
      const detailCorrelation = detailKey === undefined && detailResolution === undefined ? topCard.correlationId : undefined;
      // …and a card ABOUT THE PARLIAMENT (the chairmanship, a card's delegates / rally / support / walk — PL-025): the
      // model's own CTA opens the table, where the cubes and the marker read as they stand now; the label says so.
      const detailParliament = detailKey === undefined && detailResolution === undefined && topCard.cta?.action === 'open-parliament';
      // …and a card about REVEALED / SHOWN cards (standalone, or folded into the play that revealed them): the detail
      // is the cards themselves — the reveal viewer, never the journal (TR59, PL-557).
      const detailReveal = detailKey === undefined && detailResolution === undefined && !detailParliament ? topCard.reveal : undefined;
      if ((detailKey !== undefined || detailResolution !== undefined || detailCorrelation !== undefined || detailReveal !== undefined) && action === 'inspect' && !notifTapReplay.value) {
        beginNotifHold(topCard.id, () => {
          if (detailKey !== undefined) {
            openBotTurnReviewByKey(detailKey);
            return;
          }
          if (detailResolution !== undefined) {
            dismissNotification(topCard.id);
            shell.onNotificationInspectResolution(detailResolution);
            return;
          }
          if (detailParliament) {
            dismissNotification(topCard.id);
            shell.onNotificationOpenParliament();
            return;
          }
          if (detailReveal !== undefined) {
            if (shell.placementActive) {
              shell.showNotice('Finish your current action first');
              return;
            }
            dismissNotification(topCard.id);
            openRevealViewer(detailReveal);
            return;
          }
          shell.openJournalToNotification(topCard);
        });
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
    consoleState.fallbackActive = fallback;
    consoleState.fallbackScopeId = scope?.def.id ?? '';
    if (fallback) {
      return false;
    }
    if (intent.kind === 'release' || intent.kind === 'navEnd' ||
        intent.kind === 'aim' || intent.kind === 'aimEnd') {
      // PRESS→RELEASE surfaces consume falling edges and the stick's AIM
      // protocol; everywhere else those die here so no legacy handler ever
      // double-acts on a button-up or a stick gesture. The quick wheel is
      // the one such surface today: its armed slot commits on the release
      // of the SAME control that seated it (wheelArmModel).
      //
      // ⚠️ A falling edge that STOPS something must never be routed through
      // here at all. The shared hold-to-confirm gate learned that the hard
      // way — it read the button-up as «the player let go», this branch ate
      // it, and the ring kept filling after the release until an
      // irreversible action fired. `consoleHoldConfirm` therefore observes
      // the intent bus directly (`observeConsoleIntents`), above every
      // consuming branch including this one.
      if (consoleState.quick !== undefined) {
        shell.handleQuickIntent(intent);
      }
      return true;
    }
    if (intent.kind === 'scroll') {
      // P17: the RIGHT STICK scrolls the active console scroll container
      // (the fallback for rare overflow — console layouts fit by design
      // and never show scrollbar chrome). Fallback-owned surfaces keep
      // the DOM engine's own right-stick scroll (they return earlier).
      // …but NOT while an outcome is re-homed inside it: the browse list is
      // parked behind the outcome zone, so scrolling it would move something
      // the player cannot see instead of the content in front of them.
      if (consoleState.sheet === 'cardActions' && !shell.handPickActive &&
          !shell.workspaceOutcomeEmbedded) {
        handedTo(shell.surfaces.at<InstanceType<typeof ConsoleCardActions>>('cardActions'), 'cardActions', intent);
        return true;
      }
      scrollActiveConsole(intent.dy, intent.dx);
      return true;
    }
    // THE FINAL SCORING WORKSPACE owns the pad WHILE ITS SCENE IS ON SCREEN
    // («Обзор партии» included — the workspace routes to its own scene).
    // It consumes EVERYTHING below deliberately: Info
    // Mode, the journal and the wheels are live-game instruments — and
    // during the ceremony an Info Mode peek would leak the very totals
    // the count is about to reveal.
    //
    // ⚠ …AND ONLY WHILE ITS SCENE IS ON SCREEN (`endgameStageUp`, not
    // `…Mounted`). Past «Свернуть» the scene is hidden BY THE PLAYER'S OWN
    // HAND to read the final board, and a hidden surface that keeps eating
    // the pad is not a workspace, it is a lock: the whole post-game
    // inspection was one static board with a single button on it. Collapsed,
    // the chain below runs normally — every surface it reaches is a VIEW
    // surface at Phase.END, and the action verbs answer with a reason
    // (`actionBlockedReason`). B at the board-home root brings the results
    // back (`handleSectionBack`).
    if (shell.endgameStageUp) {
      // …except a LIVE drawn-cards reveal: a reload into an ended game can
      // still owe undelivered draws, and that overlay stands OVER the
      // settled result (its branch normally sits below this one, which
      // would strand the take press). The cards must be takeable — no
      // silent loss, even at the finish line.
      if (shell.consoleRevealMode !== undefined) {
        const overlay = shell.surfaces.at<InstanceType<typeof ConsoleRevealOverlay>>('revealOverlay');
        handedTo(overlay, 'revealOverlay', intent);
        return true;
      }
      handedTo(shell.surfaces.at<InstanceType<typeof ConsoleEndgameWorkspace>>('endgameWs'), 'endgameWs', intent);
      return true;
    }
    // Information Mode owns everything while open (read-only).
    if (infoModeState.open) {
      handleInfoIntent(intent);
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
    if (shell.journalColonyInspect !== undefined) {
      shell.handleColonyInspectIntent(intent);
      return true;
    }
    if (shell.journalPanelVisible) {
      const journalLocalBack = consoleJournalUi.filterOpen || consoleJournalUi.inspectOpen || consoleJournalUi.peekActive;
      if (action === 'reset' || (action === 'back' && !journalLocalBack)) {
        shell.closeJournal();
        return true;
      }
      // P27b consistency: Y = Information Mode on EVERY surface. The
      // journal's own player-filter moved to R3 (stickR) — so Y here opens
      // Info Mode like everywhere else. Suppressed while a local journal
      // layer (filter popover / inspect card / map peek) owns the pad, so Y
      // there still resolves that layer through the panel's own grammar.
      if (action === 'fullscreen' && !journalLocalBack) {
        shell.toggleInfoMode();
        return true;
      }
      const panel = shell.surfaces.at<InstanceType<typeof ConsoleJournalPanel>>('journalPanel');
      handedTo(panel, 'journalPanel', intent);
      return true;
    }
    // The MANDATORY corp first-action modal owns the pad while open
    // (before the «Разыграно» browse below — a stale browse yields to it
    // via the hard-block watcher). Y keeps the global Info Mode meaning.
    if (shell.corpFirstActionOpen) {
      if (action === 'fullscreen') {
        shell.toggleInfoMode();
        return true;
      }
      const confirm = shell.surfaces.at<InstanceType<typeof ConsoleCorpFirstActionConfirm>>('corpFirstConfirm');
      handedTo(confirm, 'corpFirstConfirm', intent);
      return true;
    }
    // «Разыграно» (X from the board home) owns the pad while open — a
    // VIEW surface (journal family): B closes (inside the events list B is
    // a LOCAL back), X/A inspect, LB/RB cycle the viewed player, Y keeps
    // the global Info Mode meaning. A mandatory surface closes it via the
    // journalHardBlocked watcher — same yield rule as the journal.
    if (shell.playedTableVisible) {
      if (action === 'fullscreen') {
        shell.toggleInfoMode();
        return true;
      }
      const overlay = shell.surfaces.at<InstanceType<typeof ConsolePlayedOverlay>>('playedOverlay');
      handedTo(overlay, 'playedOverlay', intent);
      return true;
    }
    // P27b: Y = INFORMATION MODE — ALWAYS (every surface's former local
    // Y verb moved to RT: task-host MAX/confirm, start-scene Continue,
    // reveal Take-all, sale-mode Sell, hydro Farthest). The two small
    // confirm dialogs keep the pad focused on the decision itself.
    if (action === 'fullscreen' &&
        consoleState.confirm === undefined && !consoleCardActionsUi.confirmOpen) {
      shell.toggleInfoMode();
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
    // THE DISCARD CINEMATIC owns the screen while it plays (bounded — the
    // transaction's own 7 s ceiling, and every beat resolves on its GSAP
    // completion). Swallowing here is what stops a fast controller from
    // tearing the sequence apart: re-opening the hand mid-flip, submitting
    // the next prompt over the carry, or deferring the surface the packet is
    // still standing on.
    if (shell.cardDiscardHolds) {
      return true;
    }
    // Draft re-pick WAITING: the pad is otherwise idle (the board stays
    // inspectable, Info Mode is handled above). X opens the read-only
    // drafted-cards viewer; every other button falls through to the board.
    if (shell.draftWaitActive && shell.draftTrayMounted && action === 'inspect' && shell.draftedCards.length > 0) {
      // The pre-game POPOVER path only (the workspace's wait offers the LT
      // sub-stage instead). Opened from the count chip → TEXTUAL. The
      // viewer's OWN mid-draft cards are still being evaluated for later
      // ('drafted-review' → draft voice — same as the workspace's inspect).
      openConsoleCardZoom([...shell.draftedCards], 0, undefined, undefined,
        {origin: {kind: 'textual'}, availability: availabilityContextFor('drafted-review')});
      return true;
    }
    // CTS T6: a reveal overlay owns input while visible (drawn cards
    // must be taken; the result / viewer close on any confirm).
    if (shell.consoleRevealMode !== undefined) {
      const overlay = shell.surfaces.at<InstanceType<typeof ConsoleRevealOverlay>>('revealOverlay');
      handedTo(overlay, 'revealOverlay', intent);
      return true;
    }
    // CTS T5: the start scene owns input while it serves (B inside =
    // wizard back-step, else defer). The journal is a BOARD-HOME surface
    // now — no View-peek here (safe context policy).
    // …EXCEPT while it hosts the play-from-hand step: the hand it is holding
    // is a real screen with a real cursor, and the player is browsing THAT.
    // Falling through hands input to the normal hand/composer path — the
    // same one they would get outside the start, which is the point.
    // Same for the hosted COLONIES step (a prelude's Build Colony): the
    // colony grid is the surface in front of the player.
    // Same for the YIELD to a board PLACEMENT (a prelude that owes a tile):
    // the scene is hidden, so routing here would swallow the pad — the
    // board below is the surface that serves it (`startSceneOwnsPad`).
    // …and the GENERAL form of all three: a PROMPT SURFACE OF ITS OWN is
    // standing (the task host and the panels cascading off it, a dedicated
    // composite — `startPromptSurfaceStands`). The branches for those sit
    // BELOW this one, so yielding here is what lets the press reach them:
    // «Огромный астероид» paid with Helion's heat raised the payment INSIDE
    // this very workspace and the scene swallowed every press aimed at it.
    // DRAW & SELECT owns the pad while it serves — BEFORE the start scene,
    // because the commonest host for it IS the start scene (a prelude that
    // looks at the top of the deck). Through its own outgoing beats it
    // deliberately swallows everything, so a committed move can never be
    // re-submitted by a stray press.
    if (shell.deckPickServing) {
      handedTo(shell.surfaces.at<InstanceType<typeof ConsoleDeckPick>>('deckPick'), 'deckPick', intent);
      return true;
    }
    // THE DRAFT WORKSPACE owns the pad while it is the serving surface.
    // `hostTask === undefined` inside the predicate yields it to the
    // embedded payment / the Underworld research choice (host-served).
    if (shell.draftWorkspaceOwnsPad) {
      handedTo(shell.surfaces.at<InstanceType<typeof ConsoleDraftWorkspace>>('draftWs'), 'draftWs', intent);
      return true;
    }
    // THE EXTERNAL-DRAW WORKSPACE owns the pad outright while it stands —
    // it is locked by construction (the take is the only way out), so
    // NOTHING below it may see a press. Its own phases absorb input during
    // the deal and the take flights.
    if (shell.externalDrawOwnsPad) {
      handedTo(shell.surfaces.at<InstanceType<typeof ConsoleExternalDrawWorkspace>>('extDrawWs'), 'extDrawWs', intent);
      return true;
    }
    if (shell.startSceneOwnsPad) {
      const scene = shell.surfaces.at<InstanceType<typeof ConsoleStartScene>>('startScene');
      handedTo(scene, 'startScene', intent);
      return true;
    }
    // THE DECISION SETTLE (`promptSequence.ts`): a decision modal that has just
    // appeared does not take a DECIDING press (A / X / the bumpers / the
    // triggers) for a short window — longest when its character FLIPPED (a
    // loss right after a reward: Philares, then the Ares hazard). ONE gate in
    // front of every prompt surface below, so none of them can be answered
    // by the rhythm of the decision before it; navigation, B, Y and the
    // stick presses always pass, and the absorbed press pulses the tone tag.
    if (promptSettleAbsorbs(intent)) {
      return true;
    }
    // Government Support (WGT) — the dedicated briefing panel owns input
    // while it serves (before the generic host branch below).
    if (shell.govSupportActive && !consoleState.task.deferred && shell.taskSpacePending === undefined) {
      const panel = shell.surfaces.at<InstanceType<typeof ConsoleGovernmentSupport>>('govSupport');
      handedTo(panel, 'govSupport', intent);
      return true;
    }
    // Production loss (Ares hazard) — the dedicated surface owns input while
    // it serves (before the generic host branch below).
    if (shell.productionLossActive && !consoleState.task.deferred && shell.taskSpacePending === undefined) {
      const panel = shell.surfaces.at<InstanceType<typeof ConsoleProductionLoss>>('prodLoss');
      handedTo(panel, 'prodLoss', intent);
      return true;
    }
    // The three dedicated COMPOSITE surfaces own the pad on the same terms.
    if (shell.spendHeatActive) {
      handedTo(shell.surfaces.at<InstanceType<typeof ConsoleSpendHeat>>('spendHeat'), 'spendHeat', intent);
      return true;
    }
    if (shell.venusBonusActive) {
      handedTo(shell.surfaces.at<InstanceType<typeof ConsoleVenusBonus>>('venusBonus'), 'venusBonus', intent);
      return true;
    }
    if (shell.aresGlobalsActive) {
      handedTo(shell.surfaces.at<InstanceType<typeof ConsoleAresGlobals>>('aresGlobals'), 'aresGlobals', intent);
      return true;
    }
    if (shell.botAttackActive) {
      handedTo(shell.surfaces.at<InstanceType<typeof ConsoleBotAttack>>('botAttack'), 'botAttack', intent);
      return true;
    }
    // The EFFECT DECISION screen owns input while it stands in for the host
    // (same contract, same gate — kept next to it so the two can never both
    // claim the pad).
    if (shell.effectDecisionActive) {
      const panel = shell.surfaces.at<InstanceType<typeof ConsoleEffectDecision>>('effectDecision');
      handedTo(panel, 'effectDecision', intent);
      return true;
    }
    // THE FINALE between «open» and the board pick (one flush): A hands the pick over now, B minimizes, RT holds.
    if (shell.finalGreeneryActive) {
      if (intent.kind === 'press') {
        const act = consoleActionOf(intent);
        if (act === 'back') {
          shell.deferFinalGreenery();
        } else if (intent.button === 'triggerR') {
          shell.beginFinalGreeneryFinish();
        } else if (act === 'primary') {
          shell.openFinalGreeneryOnBoard();
        }
      }
      return true;
    }
    // THE FINALE CONTEXT STANDS WITHOUT A PICK (PL-303 — a greenery landing, another seat deciding): B minimizes,
    // RT names why the finish waits (nothing of ours to answer), A has nothing to open yet; everything else (the
    // hand, the quick wheel, the sticks, the log) passes through — the player may look around inside the context.
    if (shell.finaleSessionEngaged && !shell.placementActive && intent.kind === 'press') {
      const act = consoleActionOf(intent);
      if (act === 'back') {
        shell.deferFinalGreenery();
        return true;
      }
      if (intent.button === 'triggerR') {
        const who = shell.finalePanel?.waitingOn;
        shell.showNotice(who !== undefined ? translateTextWithParams(FINISH_WAITS, [who.name]) : translateText(LANDING_LINE));
        return true;
      }
      if (act === 'primary') {
        return true;
      }
    }
    // CTS T1–T3: the task host owns input while it serves (B inside the
    // host = defer-to-board / cancel, handled there). No View-peek.
    // …EXCEPT while it has handed a card pick to the hand overlay
    // (`handPickActive`): the host is UNMOUNTED then (same condition as its
    // v-if), so routing here would drop every press into a dead ref. Keep
    // this gate, the two command-bar gates and the template's v-if in
    // LOCK-STEP — a mismatch silently swallows the pad.
    if (shell.hostTask !== undefined && !consoleState.task.deferred && shell.taskSpacePending === undefined && !shell.handPickActive) {
      const host = shell.surfaces.at<InstanceType<typeof ConsoleTaskHost>>('taskHost');
      handedTo(host, 'taskHost', intent);
      return true;
    }
    // …and while it stands between two questions of ONE series (PC04 · GS), the answered question is a picture: every
    // press is absorbed on the ledger until the next one arrives in place.
    if (shell.seriesHeld !== undefined) {
      noteInputAbsorbed(SERIES_VISIT_ABSORBER);
      return true;
    }
    // A DELTA PICK BRIDGE owns the pad while it stands — the asking composer
    // waits underneath with its captures intact (the hand-pick precedent;
    // routed BEFORE the composer branch, or the covered composer swallows
    // every press). ⚠️ WHO IS DEEPER IS THE STACK'S ANSWER, never a fixed
    // list order: with same-kind nesting EITHER surface can stand above the
    // other — the reward pick opens the repeat browser OVER its own hydro
    // frame (the browser is deeper), and that browser's composer opens the
    // NESTED blockade pick over itself (hydro is deeper again). A static
    // «delta picks first» sent the d-pad into a hydro surface hidden BEHIND
    // the live browser — the player walked invisible stages while the
    // browser they were looking at never moved.
    // …and so does a hydro frame standing OVER THE HAND (`handCoveredByHydro`): the espionage EXECUTION is the
    // play's commit descended into the track, and the composer it covers is hidden with nothing left to answer —
    // routed to it, the A meant for the track's «Продолжить» re-posted the play (2026-10-23).
    {
      const deltaInstrumentUp = isDeltaEspionagePickActive() || isDeltaRewardPickActive() ||
        isDeltaBlockadePickActive() || isBlockadeExecutionActive() || shell.handCoveredByHydro;
      const hydroDeeper = workspaceFrameIndex('hydro') > workspaceFrameIndex('repeat-pick');
      if (deltaInstrumentUp && (!shell.repeatPickActive || hydroDeeper)) {
        const section = shell.surfaces.at<InstanceType<typeof ConsoleHydroSection>>('hydroSection');
        handedTo(section, 'hydroSection', intent);
        return true;
      }
    }
    // REPEAT-ACTION PICK (source composer → ДЕЙСТВИЯ КАРТ bridge): the pick
    // surface owns the pad while it is out — the hidden source composers
    // (v-show) must not swallow input. Routed BEFORE every composer branch.
    if (shell.repeatPickActive) {
      const panel = shell.surfaces.at<InstanceType<typeof ConsoleCardActions>>('repeatPick');
      handedTo(panel, 'repeatPick', intent);
      return true;
    }
    // CLIENT HAND PICK (composer → hand bridge): the hand section owns the
    // pad while the pick is out — the hidden composers (v-show) must not
    // swallow input. Routed BEFORE the composer branches below.
    if (shell.handPickActive) {
      return handleSectionIntent(intent);
    }
    // THE DESCENT OWNS THE PAD WHILE IT MOVES. Between the press and the
    // settled work surface the composer is already mounted but not yet
    // readable — an A there would confirm a play against a CTA the player
    // cannot see. On the way back the same gate stops a second A from
    // re-descending into a card that is still flying home to its slot.
    if (handStageTransitioning()) {
      return true;
    }
    // T8: the native play-card confirm owns input while open.
    if (shell.pendingPlayCard !== undefined) {
      const confirm = shell.surfaces.at<InstanceType<typeof ConsolePlayCardConfirm>>('playConfirm');
      handedTo(confirm, 'playConfirm', intent);
      return true;
    }
    // T8: the COLONY FOCUS STAGE owns input while open (the section routes
    // the pad into the stage's own composer rows) — standalone AND embedded.
    if (shell.colonyFocusOpen) {
      // L3 = the source card, on the stage exactly as on the overview (the
      // viewer opens OVER it — selection and focus survive underneath).
      if (intent.kind === 'press' && intent.button === 'stickL' && shell.contextualSourceKnown) {
        shell.inspectContextualSource();
        return true;
      }
      const section = shell.surfaces.at<InstanceType<typeof ConsoleColoniesSection>>('coloniesSection');
      section?.handleFocusIntent(intent);
      return true;
    }
    /* (The EMBEDDED COLONIES STEP had its own copy of the grid grammar here
       — nav, A, X, L3, B — because `section` said 'hand' (or 'board') while
       the player was demonstrably driving a colony grid. It projects the
       DEEPEST frame now, so the standalone branch below IS the embedded one,
       and B's verb comes from the frame's own phase. Forty lines of
       second-copy deleted, including the one that held the soft-lock.) */
    if (consoleState.confirm !== undefined) {
      // THE «ЭФФЕКТЫ» LAYER owns the pad while it is open; R3 on the plate opens it (PL-394) — both resolved BEFORE
      // the semantic map, the stages' order (no default R3).
      const confirm = shell.surfaces.at<InstanceType<typeof ConsoleActionConfirm>>('actionConfirm');
      if (effectForecastOpen('confirm')) {
        confirm?.forecastIntent(intent);
        return true;
      }
      if (intent.kind === 'press' && intent.button === 'stickR') {
        confirm?.openForecastLayer();
        return true;
      }
      if (action === 'primary') {
        shell.acceptConfirm();
      } else if (action === 'back') {
        consoleState.confirm = undefined;
      }
      return true;
    }
    if (consoleState.quick !== undefined) {
      shell.handleQuickIntent(intent);
      return true;
    }
    // The console-native card-action center owns the pad while it serves —
    // UNLESS a section-projecting workspace stands INSIDE it. Both axes are
    // set then (sheet `cardActions` + section `colonies`), and asking the
    // sheet first hands the pad to the parked composer while the player is
    // demonstrably driving the colony grid on top of it. Depth breaks the
    // tie, the same rule presence already uses.
    if (consoleState.sheet === 'cardActions' && workspaceStackTopAxis() !== 'section') {
      const panel = shell.surfaces.at<InstanceType<typeof ConsoleCardActions>>('cardActions');
      handedTo(panel, 'cardActions', intent);
      return true;
    }
    if (consoleState.sheet !== undefined && workspaceStackTopAxis() !== 'section') {
      handleSheetIntent(intent);
      return true;
    }
    return handleSectionIntent(intent);
  }

  /** LB/RB inside the workspace: ONE state flip (rail + panel read the
   *  same inspected color) + the directional switch beat. Rapid presses
   *  coalesce — the state lands on the final player instantly, the motion
   *  restarts from live values (inspectSwitchMotion kills the old tween). */
  function cycleInspectedPlayer(step: 1 | -1): void {
    const colors = shell.playerView.players.map((p) => p.color);
    const before = infoModeState.playerColor;
    // The SEMANTIC chip focus: capture WHICH resource type the ring
    // stands on BEFORE the seat flips — the keys are one space across
    // seats (cardResourceKey), so the same type on the next owner keeps
    // the focus; a vanished type degrades to the nearest chip index.
    const chipsBefore = shell.infoExtrasChipList();
    const focusedChipKey = infoModeState.summaryFocus === 'extras' ?
      chipsBefore[Math.min(infoModeState.extrasCursor, Math.max(0, chipsBefore.length - 1))]?.key :
      undefined;
    infoModeState.playerColor = cyclePlayer(colors, before, step);
    // THE ROUTE SURVIVES the switch by contract (`infoRoute.ts`): a route
    // the new participant cannot serve presents the workspace FALLBACK at
    // the same depth — never a silent reset to the summary. The summary
    // FOCUS is normalized eagerly: a ring standing on a zone the new
    // participant does not have would leave the summary with no cursor
    // and a dead A until the first d-pad press.
    if (!infoZoneFocusable(infoModeState.summaryFocus, shell.infoViewedKind(), shell.infoZoneCtx())) {
      infoModeState.summaryFocus = infoFocusRing(shell.infoViewedKind(), shell.infoZoneCtx())[0] ?? 'vp';
    }
    const chipsAfter = shell.infoExtrasChipList();
    if (focusedChipKey !== undefined && infoModeState.summaryFocus === 'extras') {
      const sameType = chipsAfter.findIndex((c) => c.key === focusedChipKey);
      infoModeState.extrasCursor = sameType !== -1 ? sameType :
        Math.min(infoModeState.extrasCursor, Math.max(0, chipsAfter.length - 1));
    } else {
      infoModeState.extrasCursor = Math.min(infoModeState.extrasCursor, Math.max(0, chipsAfter.length - 1));
    }
    if (infoModeState.playerColor !== before) {
      playInspectedSwitchMotion(step);
    }
  }

  /**
   * A rail-satellite cell press (mouse/touch) while the Information
   * workspace is up: on the summary it both SELECTS the pressed type and
   * opens the extras screen; on the extras screen it selects the type in
   * place (the pad's A over the column does the same).
   */
  function onAuxCellPressed(press: {key: string, index: number}): void {
    if (!infoModeState.open) {
      return;
    }
    if (infoModeState.route === 'summary') {
      selectExtrasType(press.key, press.index);
      infoModeState.summaryFocus = 'extras';
      infoModeState.extrasCursor = press.index;
      shell.infoGo('extras');
      return;
    }
    if (infoModeState.route === 'extras') {
      (shell.surfaces.at<InstanceType<typeof ConsoleInfoMode>>('infoMode'))
        ?.selectExtrasType(press.key, press.index);
    }
  }

  function handleInfoIntent(intent: GamepadIntent): void {
    // THE EMBEDDED «РАЗЫГРАНО» ROUTE (X): the table owns the pad — nav,
    // A (open category), X (inspect), B (fold a category first; at table
    // level the overlay's close event returns to the summary). LB/RB
    // stay the GLOBAL seat switch at TABLE level only (matching the
    // standalone grammar — inside a category view the bumpers turn the
    // album's pages, the seat stays); Y keeps the global close.
    if (infoModeState.route === 'played') {
      if (intent.kind === 'press') {
        const action = consoleActionOf(intent);
        if (action === 'fullscreen') {
          shell.toggleInfoMode();
          return;
        }
        const catEngaged = consolePlayedUi.categoryOpen || consolePlayedUi.categoryBusy;
        if (!catEngaged && (action === 'prevSection' || action === 'nextSection')) {
          cycleInspectedPlayer(action === 'prevSection' ? -1 : 1);
          return;
        }
      }
      (shell.surfaces.at<InstanceType<typeof ConsoleInfoMode>>('infoMode'))?.handlePlayedIntent(intent);
      return;
    }
    // THE SCORE EXPLORER (vp subtree): the explorer owns nav, A (descend)
    // and X (fullscreen the previewed card). The global chords stay
    // global: Y closes, LB/RB switch the seat (semantic depth survives),
    // B walks the route tree one level. (The per-route direct shortcuts
    // are GONE — sections open through the ring + A only.)
    if (isVpRoute(infoModeState.route)) {
      if (intent.kind === 'press') {
        const action = consoleActionOf(intent);
        if (action === 'fullscreen') {
          shell.toggleInfoMode();
          return;
        }
        if (action === 'prevSection' || action === 'nextSection') {
          cycleInspectedPlayer(action === 'prevSection' ? -1 : 1);
          return;
        }
        if (action === 'back') {
          // The MA inspection consumes B first (fold back into its entry);
          // only then does B walk the route tree.
          const view = shell.surfaces.at<InstanceType<typeof ConsoleInfoMode>>('infoMode');
          if (view?.consumeScoreBack() !== true) {
            shell.infoBack();
          }
          return;
        }
      }
      (shell.surfaces.at<InstanceType<typeof ConsoleInfoMode>>('infoMode'))?.handleScoreIntent(intent);
      return;
    }
    // THE EXTRAS EXPLORER: the satellite column + gallery own nav, A
    // (select a type / the gallery alias) and X (inspect the focused
    // card). Same global chords: Y closes, LB/RB switch the seat, B
    // returns to the summary with the ring on the extras group.
    if (infoModeState.route === 'extras') {
      if (intent.kind === 'press') {
        const action = consoleActionOf(intent);
        if (action === 'fullscreen') {
          shell.toggleInfoMode();
          return;
        }
        if (action === 'prevSection' || action === 'nextSection') {
          cycleInspectedPlayer(action === 'prevSection' ? -1 : 1);
          return;
        }
        if (action === 'back') {
          // The ring lands back on the chip of the TYPE the player was
          // reading — the carried object survives B.
          infoModeState.extrasCursor = Math.max(0, extrasExplorerUi.typeCursor);
          shell.infoBack();
          return;
        }
      }
      (shell.surfaces.at<InstanceType<typeof ConsoleInfoMode>>('infoMode'))?.handleExtrasIntent(intent);
      return;
    }
    // THE CAMPAIGN OVERVIEW: the overview owns nav, A (open results /
    // participant legacy), X (inspect a legacy card) and B inside its
    // nested layers; at its base layer B falls through to the route tree
    // (back to the summary with the ring on the campaign zone). Global
    // chords stay global: Y closes, LB/RB switch the inspected seat.
    if (infoModeState.route === 'campaign') {
      if (intent.kind === 'press') {
        const action = consoleActionOf(intent);
        if (action === 'fullscreen') {
          shell.toggleInfoMode();
          return;
        }
        if (action === 'prevSection' || action === 'nextSection') {
          cycleInspectedPlayer(action === 'prevSection' ? -1 : 1);
          return;
        }
      }
      const view = shell.surfaces.at<InstanceType<typeof ConsoleInfoMode>>('infoMode');
      if (view?.handleCampaignIntent(intent) !== true &&
          intent.kind === 'press' && consoleActionOf(intent) === 'back') {
        shell.infoBack();
      }
      return;
    }
    // THE «ДЕЙСТВИЯ» GALLERY (TR60): the «Действия карт» tiles read-only —
    // the d-pad walks the cards (the page follows the cursor), X / A open
    // the face. Global chords stay global: Y closes, LB/RB switch the
    // seat, B returns to the summary with the ring on the zone.
    if (infoModeState.route === 'actions' && infoRouteApplies('actions', shell.infoViewedKind())) {
      if (intent.kind === 'press') {
        const action = consoleActionOf(intent);
        if (action === 'fullscreen') {
          shell.toggleInfoMode();
          return;
        }
        if (action === 'prevSection' || action === 'nextSection') {
          cycleInspectedPlayer(action === 'prevSection' ? -1 : 1);
          return;
        }
        if (action === 'back') {
          shell.infoBack();
          return;
        }
      }
      (shell.surfaces.at<InstanceType<typeof ConsoleInfoMode>>('infoMode'))?.handleActionsIntent(intent);
      return;
    }
    // THE EFFECTS EXPLORER: the grid owns nav, A (descend into the effect
    // dossier), X (inspect the source card), LT/RT (the family facet) and
    // R3 (reset it). B folds an open dossier first; only then does it walk
    // the route tree. LB/RB switch the seat at BROWSE level only — at the
    // dossier they step the SIBLING effect (the layer-conditional bumper
    // grammar the «Разыграно» categories set).
    if (infoModeState.route === 'effects') {
      if (intent.kind === 'press') {
        const action = consoleActionOf(intent);
        if (action === 'fullscreen') {
          shell.toggleInfoMode();
          return;
        }
        const detailUp = effectsExplorerLayer() === 'detail';
        if (!detailUp && (action === 'prevSection' || action === 'nextSection')) {
          cycleInspectedPlayer(action === 'prevSection' ? -1 : 1);
          return;
        }
        if (action === 'back') {
          const view = shell.surfaces.at<InstanceType<typeof ConsoleInfoMode>>('infoMode');
          if (view?.consumeEffectsBack() !== true) {
            shell.infoBack();
          }
          return;
        }
      }
      (shell.surfaces.at<InstanceType<typeof ConsoleInfoMode>>('infoMode'))?.handleEffectsIntent(intent);
      return;
    }
    const route = infoModeState.route;
    const kind = shell.infoViewedKind();
    if (intent.kind === 'nav') {
      // The SUMMARY is a single-screen zone grid — the d-pad drives the
      // focus ring (no scroll target exists there by design). «Экран
      // бота» walks its two deep entries. Every other route scrolls.
      if (route === 'summary') {
        // On the SATELLITE the chips are individual ring stops: up/down
        // walk the column's own chips (an edge is an edge — the column is
        // the ring's leftmost stop, matching the console's d-pad grammar).
        if (infoModeState.summaryFocus === 'extras' && (intent.dir === 'up' || intent.dir === 'down')) {
          const count = shell.infoExtrasChipList().length;
          const at = Math.min(infoModeState.extrasCursor, Math.max(0, count - 1));
          const next = at + (intent.dir === 'down' ? 1 : -1);
          infoModeState.extrasCursor = Math.min(Math.max(next, 0), Math.max(0, count - 1));
          return;
        }
        infoModeState.summaryFocus =
          infoZoneNavigate(infoModeState.summaryFocus, intent.dir, kind, shell.infoZoneCtx());
        return;
      }
      if (route === 'botScreen' && infoRouteApplies('botScreen', kind)) {
        const before = infoModeState.botScreenFocus;
        infoModeState.botScreenFocus = botScreenNavigate(before, intent.dir);
        if (infoModeState.botScreenFocus !== before) {
          const entry = document.querySelector<HTMLElement>(`[data-bot-entry="${infoModeState.botScreenFocus}"]`);
          const box = entry === null ? undefined : scrollContainerOf(entry, 'y');
          if (entry !== null && box !== undefined) {
            cursorEnsureVisible(box, entry, {axis: 'y'});
          }
          return;
        }
        // The cursor is at the ring's edge — the press becomes a plain
        // scroll, so the hub's informational sections below the entries
        // (storage, scoring) stay reachable on the d-pad.
      }
      // Scoped to the workspace: the board's context panel is an
      // `aside.con-info__scroll` too, mounted EARLIER in the DOM.
      const scroller = document.querySelector<HTMLElement>('.con-info .con-info__scroll');
      if (scroller !== null && (intent.dir === 'up' || intent.dir === 'down')) {
        scroller.scrollBy({top: (intent.dir === 'down' ? 140 : -140) * conUiScale(), behavior: 'smooth'});
      }
      return;
    }
    if (intent.kind !== 'press') {
      return;
    }
    switch (consoleActionOf(intent)) {
    case 'prevSection':
      cycleInspectedPlayer(-1);
      break;
    case 'nextSection':
      cycleInspectedPlayer(1);
      break;
    case 'fullscreen':
      shell.toggleInfoMode(); // Y closes — the same key that opened it
      break;
    case 'primary':
      // ONE navigation model, built to scale: the ring focuses a zone,
      // A opens it (the per-block dedicated buttons are gone — a new
      // section is a new ring stop, never a new physical binding).
      if (route === 'summary') {
        // A on a satellite CHIP opens the extras screen ON that type —
        // the same road the mouse press takes (onAuxCellPressed).
        if (infoModeState.summaryFocus === 'extras') {
          const chips = shell.infoExtrasChipList();
          const at = Math.min(infoModeState.extrasCursor, Math.max(0, chips.length - 1));
          const chip = chips[at];
          if (chip !== undefined) {
            selectExtrasType(chip.key, at);
          }
          shell.infoGo('extras');
          return;
        }
        const zoneRoute = infoZoneRoute(infoModeState.summaryFocus);
        if (zoneRoute !== undefined && infoZoneFocusable(infoModeState.summaryFocus, kind, shell.infoZoneCtx())) {
          shell.infoGo(zoneRoute);
        }
      } else if (route === 'botScreen' && infoRouteApplies('botScreen', kind)) {
        shell.infoGo(infoModeState.botScreenFocus);
      }
      break;
    case 'back':
      shell.infoBack();
      break;
    default:
      break;
    }
  }

  function feedWheelArm(event: WheelArmEvent): void {
    const result = reduceWheel(shell.wheelInput, event, wheelControlState.mode, {
      has: (slot) => shell.quickEntries.some((e) => e.slot === slot),
      available: (slot) => shell.quickEntries.find((e) => e.slot === slot)?.available === true,
    });
    shell.wheelInput = result.state;
    const effect = result.effect;
    switch (effect.kind) {
    case 'commit':
      activateQuickSlot(effect.slot);
      break;
    case 'refuse': {
      // The blocked slot resisted through the hold; the release restates
      // the honest reason on the shared notice rail.
      const entry = shell.quickEntries.find((e) => e.slot === effect.slot);
      shell.showNotice(entry !== undefined && entry.reason !== '' ? entry.reason : 'Unavailable right now');
      break;
    }
    case 'dismiss':
      consoleState.quick = undefined;
      break;
    default:
      break;
    }
  }

  function activateQuickSlot(slot: QuickSlot): void {
    const entry = shell.quickEntries.find((e) => e.slot === slot);
    if (entry === undefined) {
      return;
    }
    if (!entry.available) {
      shell.showNotice(entry.reason !== '' ? entry.reason : 'Unavailable right now');
      return;
    }
    // WHEEL HANDOFF (surface motion): record the chosen slot + its centre
    // BEFORE the wheel unmounts. The grammar is PRESS → MECHANICAL COMMIT
    // → DEPTH COLLAPSE → CONTEXT REVEAL: the leave hook plays the chosen
    // tile's commit press-in and the wheel's recession while the next
    // surface forms IN PARALLEL from the slot's direction; the handoff
    // spec adds the destination's emblem ECHO and/or a PULSE on the live
    // HUD element a direct action is about to change. Nothing flies.
    const handoff = wheelHandoffSpecFor(entry.id);
    markWheelHandoff(slot, document.querySelector(`.con-quick__slot--${slot}`), handoff?.echo);
    // …and PIN the cross's own box in the same breath. The lines below open a
    // workspace that takes (or hides) the strategy rail, and the wheel's band
    // insets would re-solve in the wider opening while it is still playing its
    // recession — half a rail of sideways twitch on the first frame after the
    // press. Captured here, BEFORE the state change, because that is the last
    // moment the geometry is still the one the player pressed in.
    pinQuickWheelBox();
    const quick = consoleState.quick;
    consoleState.quick = undefined;
    if (quick === 'actions') {
      executeRtEntry(entry.id);
    } else if (quick === 'basics') {
      executeLtEntry(entry.id);
    }
    // The PULSE fires only when the commit stayed DIRECT — an execute that
    // diverted into the shared confirm card (heat at max temperature)
    // must not acknowledge on the reservoir it did not touch.
    if (handoff?.pulse !== undefined && consoleState.confirm === undefined) {
      pulseWheelAnchors(handoff.pulse);
    }
  }

  /** RT — action categories (navigation surfaces; inspection always allowed). */
  function executeRtEntry(id: string): void {
    switch (id) {
    case 'cards':
      // A BROWSE open always starts at the TOP of the grid: reset the
      // persisted selection so `ensureSelectedVisible` never pre-scrolls
      // the freshly-mounted grid — the initial viewport is deterministic
      // (first rows), which is what the open reveal measures against.
      // Index 0 = the first PLAYABLE card (playable-first sort). Flows
      // that need a specific focus (hand-select / pick) set their own
      // index on their own path.
      consoleState.handIndex = 0;
      void shell.openHandWithReveal();
      break;
    case 'cardActions':
      shell.openSheet('card-actions');
      break;
    case 'trading':
      shell.deferShellTask('colonies');
      // The player's OWN visit: the default `always` anchor is what says «this
      // screen stays when the prompt is answered» (a prompt-pushed frame
      // carries a `prompt` anchor and hands the screen back instead).
      enterWorkspace('colonies');
      consoleState.colonyIndex = stepIndex(consoleState.colonyIndex, 0, shell.coloniesForRail.length);
      shell.landColonyCursorOnTradeable();
      break;
    case 'hydro':
      // The section's own mount decides RESUME vs FRESH (a still-fresh
      // draft re-seats; a stale one resets) — never a blanket reset here.
      shell.enterOrRestoreWorkspace('hydro');
      break;
    case 'parliament':
      // The Parliament (Turmoil Redux) — a VIEW as much as an action screen:
      // it opens whenever the module is on, and the vote's availability is
      // read inside from the server's own menu.
      shell.enterOrRestoreWorkspace('parliament');
      break;
    default:
      break;
    }
  }

  /** LT — basic actions (turn-ending SUBMITS are guarded during placement). */
  function executeLtEntry(id: string): void {
    const wf = shell.playerView.waitingFor;
    const guardBusy = (): boolean => {
      if (shell.actionBlockedReason !== '') {
        shell.showNotice(shell.actionBlockedReason);
        return true;
      }
      return false;
    };
    switch (id) {
    case 'standardProjects':
      // Opening is inspection-safe; item ACTIVATION is guarded in
      // activateStdItem (mirrors the sheet-row placement guard).
      shell.openSheet('standard-projects');
      break;
    case 'skipTurn': {
      if (guardBusy()) {
        return;
      }
      const path = findEndTurnPath(wf);
      if (path !== undefined) {
        closeConsoleLayers();
        shell.submit(optionResponseForPath(path));
      }
      break;
    }
    case 'pass':
      if (guardBusy()) {
        return;
      }
      // Pass ALWAYS confirms (warnings carried over from the desktop).
      consoleState.confirm = 'pass';
      break;
    case 'convertHeat': {
      if (guardBusy()) {
        return;
      }
      const found = findConvertHeatOption(wf);
      if (found === undefined) {
        return;
      }
      // THE MINI-STAGE (PL-067): a one-press verb stands a stage up exactly when the table ANSWERS it (the
      // server's own forecast on the option — the ruling Greens' 2 M€, a bonus step the raise crosses) or
      // when the step is empty (the temperature's maximum) — or when the press has a STEP to collect (RX35: the
      // «where» of a replaced unit). A quiet table keeps the one press.
      const reacts = (found.option.metadata?.forecast?.facts.length ?? 0) > 0;
      const collects = (found.option.metadata?.steps ?? []).length > 0;
      if ((found.option.warnings ?? []).includes('maxtemp') || reacts || collects) {
        // The commit resolves into the confirm card, not a direct spend —
        // the ECHO follows the question instead of the reservoir.
        retargetWheelEcho(CONFIRM_HANDOFF.echo);
        consoleState.confirm = 'convertHeat';
      } else {
        shell.submit(optionResponseForPath(found.path));
      }
      break;
    }
    case 'convertPlants': {
      if (guardBusy()) {
        return;
      }
      const found = findConvertPlantsOption(wf, shell.thisPlayer.canConvertPlants === true);
      if (found === undefined) {
        return;
      }
      // Under a law that REPLACES the greenery (RX35) the conversion is a one-press OPTION with a «where» to
      // collect: the plate, the heat conversion's twin — never the board.
      if (found.option !== undefined) {
        retargetWheelEcho(CONFIRM_HANDOFF.echo);
        consoleState.confirm = 'convertPlants';
        break;
      }
      shell.convertPlantsPending = found;
      closeConsoleLayers();
      goBoardHome();
      break;
    }
    default:
      break;
    }
  }

  function handleSheetIntent(intent: GamepadIntent): void {
    // P27: the Standard-Projects premium screen — 2-column GRID nav,
    // A = use / sell, B = close (MANDATORY prompt → defer to the chip).
    // While a SECTION-projecting step stands inside it (the sale's hand,
    // the colony pick) the deepest axis owns the pad — this branch yields.
    if (consoleState.sheet === 'standardProjects' && workspaceStackTopAxis() !== 'section') {
      // A beat in flight (the submit round trip / the committed beat)
      // ABSORBS input: a double submit is impossible by construction, and
      // a stray press cannot reach the rows underneath.
      if (!acceptsInput(workspaceFramePhase('standard-projects') ?? 'browse')) {
        return;
      }
      // THE «ЭФФЕКТЫ» LAYER owns the pad while it is open; R3 on the browse opens it (PL-066). Both resolved
      // BEFORE the semantic map (no default R3) — the composers' and the stages' order.
      const stdpScreen = shell.surfaces.at<InstanceType<typeof ConsoleStdProjectsScreen>>('stdpScreen');
      if (effectForecastOpen('stdp')) {
        stdpScreen?.forecastIntent(intent);
        return;
      }
      if (intent.kind === 'press' && intent.button === 'stickR') {
        stdpScreen?.openForecastLayer();
        return;
      }
      if (intent.kind === 'nav') {
        consoleState.sheetIndex = stepGrid(
          consoleState.sheetIndex, intent.dir, shell.stdProjectItems.length, 2);
        return;
      }
      if (intent.kind === 'press') {
        const a = consoleActionOf(intent);
        if (a === 'primary') {
          shell.activateStdItem(shell.stdProjectItems[consoleState.sheetIndex]);
        } else if (a === 'back') {
          // The EMBEDDED PAYMENT step folds one level (nothing committed) —
          // otherwise B closes the browse layer, exactly as before.
          if (shell.pendingClientPayment !== undefined) {
            shell.pendingClientPayment = undefined;
            shell.rollbackStdProjectFlow();
            return;
          }
          if (shell.pendingClientPick?.host === 'standard-projects') {
            shell.cancelClientPick();
            return;
          }
          // A PROMPT'S standard project («Свернуть» — «Проверенные методы»
          // raises it INSIDE the opening, the screen standing OVER the start
          // root) PARKS THE WHOLE STACK, the awards step's rule: popping the
          // screen alone left the start standing under a still-owed prompt it
          // does not serve, the restore had no park to bring back, the scene
          // found nothing of its own to wait for and let go — the board home
          // with the stranded guard and no way back (the field report of
          // 2026-10-18). A visit the player opened is still a plain close.
          if (shell.stdBackLabel === 'Minimize') {
            shell.collapseWorkspace();
            return;
          }
          shell.deferShellTask('board');
          leaveWorkspace();
        }
      }
      return;
    }
    // The milestones/awards WORKSPACE. Overview: 2-column GRID nav (every
    // card focusable), A = SELECT (descend into the detail stage), LB/RB =
    // category switch. Detail: A = the real claim/fund commit, B = fold
    // back to the overview; the commit/ceremony beats absorb everything
    // (a double submit is impossible by construction).
    if (shell.maScreenKind !== undefined) {
      if (maFocusState.open) {
        if (!maFocusAcceptsInput()) {
          return;
        }
        if (maFocusState.pay !== undefined) {
          shell.handleMaPayIntent(intent);
          return;
        }
        if (intent.kind === 'press') {
          switch (consoleActionOf(intent)) {
          case 'primary':
            shell.submitMaFocusCommit();
            break;
          case 'back':
            shell.foldMaFocus();
            break;
          default:
            break;
          }
        }
        return;
      }
      if (intent.kind === 'nav') {
        // Two columns of three tiles (FB′): the d-pad walks the grid; the family's other screen is a BUMPER.
        consoleState.sheetIndex = stepGrid(
          consoleState.sheetIndex, intent.dir, shell.maScreenItems.length, 2);
        return;
      }
      if (intent.kind === 'press') {
        switch (consoleActionOf(intent)) {
        case 'primary':
          // A = «Выбрать»: EVERY item descends into its detail stage —
          // taken/blocked ones included (the stage explains the state).
          // Nothing is ever submitted from the overview, and there is no
          // second inspect route: this IS the reading surface.
          shell.enterMaFocus();
          break;
        case 'prevSection':
          // LB / RB walk the FAMILY (a lateral `openSheet` — the other workspace arrives from its bumper's side).
          // Vitor's hosted funding step stands with the awards alone: no lateral move off a mandatory task.
          if (shell.maScreenKind !== 'milestones' && !shell.awardStepHosted) {
            shell.openSheet('milestones');
          }
          break;
        case 'nextSection':
          if (shell.maScreenKind !== 'awards') {
            shell.openSheet('awards');
          }
          break;
        case 'back':
          // A HOSTED step minimizes its WHOLE flow — B on a nested step is
          // «свернуть весь workspace» (the start included, full depth); the
          // way back is the board-home restore card (`restoreDeferredTask`
          // → `restoreWorkspaceStack`). A bare `leaveWorkspace` here would
          // pop the step alone and stand the deployment back up UNDER a
          // still-owed mandatory prompt.
          if (shell.awardStepHosted) {
            shell.collapseWorkspace();
            break;
          }
          // A pending free-award-funding task DEFERS to the amber chip
          // (mandatory → inspect the board, then return); a no-op when the
          // player is merely viewing the M/A dashboard. A plain close also
          // drops any suspended detail draft — the visit is over.
          if (!shell.awardFundingActive) {
            discardMaFocusDraft();
          }
          shell.deferShellTask('board');
          leaveWorkspace();
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
        consoleState.sheetIndex = stepSelectable(
          consoleState.sheetIndex, step, shell.sheetRows.map((r) => r.kind !== 'header'));
      }
      return;
    }
    if (intent.kind === 'press') {
      const a = consoleActionOf(intent);
      if (a === 'primary') {
        shell.activateSheetRow(shell.sheetRows[consoleState.sheetIndex]);
      } else if (a === 'back') {
        // B: ONE logical level. The hydro card pick uncovers the HYDRO track
        // it was opened from (its plan is still being composed there); a sheet
        // opened from the board home uncovers the board. Same verb, no
        // per-sheet special case — that is what a stack is for.
        leaveWorkspace();
      }
    }
  }

  function handleSectionIntent(intent: GamepadIntent): boolean {
    // The console-native Hydronetwork screen owns its whole grammar
    // (stages / bonus / CTA / confirm modal / help). Y = Info Mode stays
    // global (handled before this point); the journal is board-home only.
    if (shell.padSection === 'hydro') {
      const hydro = shell.surfaces.at<InstanceType<typeof ConsoleHydroSection>>('hydroSection');
      handedTo(hydro, 'hydroSection', intent);
      return true;
    }
    // The Parliament owns its whole grammar too (zones / stages / submits).
    if (shell.padSection === 'parliament') {
      const parliament = shell.surfaces.at<InstanceType<typeof ConsoleParliamentSection>>('parliamentSection');
      handedTo(parliament, 'parliamentSection', intent);
      return true;
    }
    if (intent.kind === 'nav') {
      handleSectionNav(intent.dir);
      return true;
    }
    if (intent.kind !== 'press') {
      return true;
    }
    const onBoard = shell.padSection === 'board';
    // Stick-clicks are screen-specific (no base semantic action, by design) —
    // they carry board/hand context verbs, handled raw before the semantic switch.
    if (intent.button === 'stickL') {
      // L3 — «ОСМОТРЕТЬ ИСТОЧНИК» whenever a CONTEXTUAL pick is running (the
      // hand was opened BY an effect). Checked FIRST so the verb reads the
      // same on every contextual selection surface; X stays the card under
      // the cursor, which is why the source needs a button of its own.
      // DURING PLACEMENT L3 is the SAME verb: the card placing this tile.
      // (It used to be «next available cell» — a jump nobody used, on the one
      // screen where the shell's most consistent verb had nowhere to live.)
      // P27: on the board home L3 toggles BOARD INSPECTION MODE. (The hand's
      // «select all» lives on R3 since 2026-10-14 — it shared L3 with the
      // source, and the source, checked first, always won.)
      if (shell.contextualSourceKnown) {
        shell.inspectContextualSource();
      } else if (shell.placementActive && shell.padSection === 'board') {
        shell.inspectPlacementSource();
      } else if (onBoard) {
        shell.toggleInspection();
      }
      return true;
    }
    if (intent.button === 'stickR') {
      // P20: R3 toggles INSPECT-ALL cells during placement (was the LT
      // hold) — persistent, announced, and reflected in every hint row.
      // P27b: on the board home R3 = SCALE INSPECTION (the cursor walks
      // the track bonuses in a circle). In the hand (non-sale) R3 RESETS the
      // tag filter to "All" (the right-stick AXIS still scrolls the grid).
      if (shell.placementActive && shell.padSection === 'board') {
        consoleState.freeRoam = !consoleState.freeRoam;
        shell.showNotice(consoleState.freeRoam ? 'Inspecting all cells' : 'Available cells only');
      } else if (onBoard) {
        shell.toggleScaleInspect();
      } else if (shell.padSection === 'hand' && consoleState.sale.active) {
        // The patent sale: R3 = SELECT ALL / UNSELECT ALL.
        shell.toggleSelectAllSale();
      } else if (shell.padSection === 'hand' && shell.handPickActive && shell.handSelectSingle && shell.handPickDeferLive) {
        // A table question that may wait for a draw (2026-10-15): R3 = «Решить после добора» — the early answer let
        // go, the question asked live once the draw has landed. Its plate stands in the album's question line.
        deferConsoleHandPick();
      } else if (shell.padSection === 'hand' && shell.handPickActive && !shell.handSelectSingle) {
        // A composer's multi hand pick (Public Plans «reveal any number»): R3 = select every candidate (bounded
        // by max) / clear — the sale's R3. L3 stays the SOURCE (the card being played), as on every contextual
        // surface; the two shared L3 until 2026-10-14 and the source always won.
        shell.togglePickSelectAll();
      } else if (shell.padSection === 'hand' && shell.handSelectTaskActive && !shell.handSelectSingle && shell.handSelectModel?.showSelectAll === true) {
        // The server's own «select all» on a live multi select (`SelectCard.showSelectAll`).
        shell.toggleSelectAllTask();
      } else if (shell.padSection === 'hand' && !consoleState.sale.active && !shell.handSelectUiActive) {
        shell.resetHandFilter();
      }
      return true;
    }
    switch (consoleActionOf(intent)) {
    case 'prevSection':
      // Stable board semantics: LB = Milestones (viewable any time).
      // (P29c: the temporary board-scale tuner is gone — ×1.05 shipped
      // as the compiled default in ConsoleBoardSection.)
      // In the hand ALBUM — every mode of it — LB is the PREVIOUS PAGE:
      // leafing is the album's primary horizontal verb and the shoulder
      // pair is its natural instrument (the bay spine shows the same
      // LB/RB beside the position). The first page swallows the press.
      if (onBoard) {
        shell.openSheet('milestones');
      } else if (shell.padSection === 'hand') {
        shell.turnHandPage(-1);
      }
      return true;
    case 'nextSection':
      // In the hand ALBUM RB is the NEXT PAGE (see prevSection).
      if (onBoard) {
        shell.openSheet('awards');
      } else if (shell.padSection === 'hand') {
        shell.turnHandPage(1);
      }
      return true;
    case 'reset':
      shell.toggleJournal();
      return true;
    case 'nextTab':
      // P27: RT = the action-category QUICK SELECTOR from the board home
      // (P20: including during placement — inspection is always allowed).
      // In the hand: sale mode CONFIRMS the sale, multi-select CONFIRMS the
      // picked set (established commit verbs — those modes have no tag
      // filters to cycle); the BROWSE hand cycles the tag filter FORWARD
      // (the filter is the album's secondary axis, on the triggers).
      if (onBoard) {
        shell.openQuick('actions');
        return true;
      }
      if (shell.padSection === 'hand') {
        if (consoleState.sale.active) {
          shell.confirmSale();
        } else if (shell.handSelectUiActive) {
          // Multi-select: RT confirms the picked set (a single-card pick
          // submits directly on A). On an OPTIONAL pick RT is the DECLINE —
          // the console's «finish this choice» with nothing chosen (the
          // owner's decision 2026-10-13; never B, never a row).
          if (shell.handPickDeclineLive) {
            declineConsoleHandPick();
          } else if (!shell.handSelectSingle) {
            shell.confirmHandSelect();
          }
        } else {
          shell.cycleHandFilter(1);
        }
      }
      return true;
    case 'prevTab':
      // P27: LT = the basic-actions QUICK SELECTOR (board home only). In the
      // hand: SELECT mode toggles the "suitable only" filter (that IS its
      // one filter axis); the BROWSE hand cycles the tag filter BACK.
      if (onBoard) {
        shell.openQuick('basics');
      } else if (shell.padSection === 'hand' && shell.handSelectUiActive) {
        shell.toggleSuitableOnly();
      } else if (shell.padSection === 'hand' && !consoleState.sale.active) {
        shell.cycleHandFilter(-1);
      }
      return true;
    case 'primary':
      if (shell.padSection === 'hand' && consoleState.filterFocus >= 0) {
        // THE CHIP ROW (FD): A applies the focused chip — a re-pagination — and hands the cursor back to the cards.
        shell.applyFocusedFilterChip();
        return true;
      }
      handleSectionConfirm();
      return true;
    case 'inspect':
      // P13 global rule: X reads the focused object fullscreen; on the BOARD
      // HOME (the main field context only — never mid-placement, never
      // inside an inspection mode) X opens the «Разыграно» tableau.
      //
      // THE COLONIES OVERVIEW: X opens the DOSSIER (ConsoleColonyInspect —
      // the archive entry, the planet with the trade-track instrument, the
      // rules), read-only and for ANY colony; A enters the act. The two
      // verbs lead to two different surfaces now, so the bar's choice is
      // real (an earlier iteration had dropped X because both led to the
      // same stage).
      if (shell.padSection === 'colonies' && colonyDockCursor.active && shell.colonyDocks.length > 0) {
        // A DOCK IS A CARD: X is the card's own inspection (the live model —
        // the fleet on its ▲ included), never a colony dossier.
        shell.inspectFleetDock(shell.colonyDocks[Math.min(colonyDockCursor.index, shell.colonyDocks.length - 1)].card);
      } else if (shell.padSection === 'colonies') {
        shell.enterColonyFocus('inspect');
      } else if (shell.padSection === 'hand') {
        shell.zoomHandCard();
      } else if (onBoard && !shell.placementActive && consoleState.inspecting) {
        // TR67: the inspected tile's own card, fullscreen (the dossier's «Поставлено» chip); none → the reason, said.
        shell.inspectCellSource();
      } else if (onBoard && !shell.placementActive &&
          !consoleState.inspecting && !consoleState.scaleInspecting) {
        shell.openPlayedOverlay();
      }
      return true;
    case 'back':
      if (shell.padSection === 'hand' && consoleState.filterFocus >= 0) {
        consoleState.filterFocus = -1; // ONE level back — from the chips to the cards
        return true;
      }
      handleSectionBack();
      return true;
    default:
      return true;
    }
  }

  function handleSectionNav(dir: NavDirection): void {
    // Mid-reveal the hand grid must not scroll (the flight targets were
    // measured against the current layout) — nav resumes at touchdown.
    // A FILTER episode never blocks input: snap it and navigate at once.
    if (shell.padSection === 'hand' && isHandRevealEpisodeRunning()) {
      if (runningHandRevealKind() !== 'filter') {
        return;
      }
      finishInstant();
    }
    if (shell.padSection === 'board') {
      const board = shell.surfaces.at<InstanceType<typeof ConsoleBoardSection>>('boardSection');
      // P27b: SCALE INSPECTION — the cursor walks the bonus ring
      // (left/up = counter-clockwise, right/down = clockwise, wraps).
      if (consoleState.scaleInspecting && !shell.placementActive) {
        board?.stepTrackMarker(dir === 'right' || dir === 'down' ? 1 : -1);
        return;
      }
      // P27: the cells are NOT part of the normal command loop — the
      // board navigates only in INSPECTION mode or during a placement.
      if (!shell.placementActive && !consoleState.inspecting) {
        // The button NAME comes from the active glyph set — the notice is
        // plain text (no glyph slot), so it interpolates the label rather
        // than hardcoding «L3», which is only correct by coincidence today.
        shell.showNotice(translateTextWithParams('Press ${0} to inspect the board', [activeGlyphSet().stickL.label]));
        return;
      }
      if (shell.placementActive) {
        // A commit on the wire keeps the reticle where the decision was
        // made; a d-pad step out of the LOCKED phase releases the lock
        // and moves in the same press — no dead input, and the release
        // is visible (the lock pose lets go before the glide).
        if (placementFlowState.phase === 'committing') {
          return;
        }
        if (placementFlowState.phase === 'locked') {
          unlockPlacementCell();
        }
      }
      board?.move(dir);
      return;
    }
    if (shell.padSection === 'colonies') {
      // 2D stepping over the premium tile grid (layout-aware columns) — ONE walk over ONE grid: the cells are the
      // colonies and, last in reading order, the viewer's fleet docks (ledger EZ — `colonyCursorStep`).
      const count = shell.coloniesForRail.length;
      const docks = shell.colonyDocks.length;
      const cols = colonyGridCols(colonyGridLayout(count, shell.colonyPick !== undefined, docks), count + docks);
      const next = colonyCursorStep(dir, {
        zone: colonyDockCursor.active ? 'docks' : 'grid',
        index: consoleState.colonyIndex,
        dock: colonyDockCursor.index,
      }, count, cols, docks, colonyNavStep);
      consoleState.colonyIndex = next.index;
      colonyDockCursor.active = next.zone === 'docks';
      colonyDockCursor.index = next.dock;
      return;
    }
    // Hand grid: delegate to the section — it owns the plan (cols), the
    // column-preserving up/down stepping, and keep-selected-visible.
    const hand = shell.surfaces.at<InstanceType<typeof ConsoleHandSection>>('handSection');
    hand?.move(dir);
  }

  function handleSectionConfirm(): void {
    // No accidental card activation under the flying reveal proxies —
    // A waits out the episode (navigation stays free; B reverses).
    // A FILTER episode never blocks input: snap it and confirm at once.
    if (shell.padSection === 'hand' && isHandRevealEpisodeRunning()) {
      if (runningHandRevealKind() !== 'filter') {
        return;
      }
      finishInstant();
    }
    if (shell.padSection === 'board') {
      const board = shell.surfaces.at<InstanceType<typeof ConsoleBoardSection>>('boardSection');
      if (shell.placementActive) {
        const flow = placementFlowState;
        // A commit already on the wire absorbs every further press — a
        // double submit is impossible by construction, not by luck.
        if (flow.phase === 'committing') {
          return;
        }
        // The press that OPENED this mode is still physically held — it
        // may never place a tile (both modes).
        if (!placementPressAllowed()) {
          return;
        }
        const targetId = consoleState.boardSpaceId;
        if (targetId === undefined) {
          return;
        }
        if (!shell.selectedCellLegal) {
          console.warn('[placement] refused: the focused cell is not legal', {targetId});
          shell.showNotice('Cannot place here');
          return;
        }
        // A MOVE's SOURCE LEVEL (Turmoil Redux TR14 / TR39): A LIFTS the
        // focused tile — one press in BOTH confirm modes, pure presentation
        // (nothing is sent; B puts it down). The legal set becomes that
        // tile's destinations and the pick continues as an ordinary placement.
        if (shell.placementMoveLevelNow === 'source') {
          pickUpMoveSource(targetId as SpaceId);
          return;
        }
        // TWO-PHASE CONFIRM (the console default): the first press LOCKS
        // the cell — pure presentation, nothing is submitted, no event
        // exists yet. The second, separately-released press commits.
        if (flow.twoStep && flow.phase === 'navigate') {
          lockPlacementCell(targetId as SpaceId);
          return;
        }
        if (flow.twoStep && flow.phase === 'locked') {
          // The gate: the locking press must have been RELEASED and the
          // lock must have stood its minimum dwell — a held button, a
          // bounce or a reflex double-tap all land here and do nothing.
          if (flow.lockedSpaceId !== targetId || !placementCommitReady()) {
            return;
          }
        }
        // Card-bonus cell: ARM the lift BEFORE activating — the click
        // submits synchronously through the headless SelectSpace, and the
        // cover must separate at submit time (never after the response).
        shell.armBoardBonusIfCardCell(targetId, shell.placementSpaceModel?.placementEffect);
        if (board?.activate() !== true) {
          console.warn('[placement] refused: the board section did not take the press', {
            targetId, section: board === undefined ? 'no-ref' : 'refused',
          });
          shell.showNotice('Cannot place here');
          // Nothing was submitted — recall the armed cover instantly.
          abortBoardCardBonus('instant');
        }
      }
      return;
    }
    if (shell.padSection === 'colonies') {
      shell.confirmColonySelection();
      return;
    }
    const entry = shell.handEntries[consoleState.handIndex];
    if (entry === undefined) {
      return;
    }
    // Sale mode: A toggles the pick (shared with the fullscreen viewer).
    if (consoleState.sale.active) {
      shell.toggleSalePick(entry.card.name);
      return;
    }
    // Hand SELECT (server task OR a client composer pick): A submits/resolves
    // the focused card (single) or toggles the pick (multi). A non-candidate
    // card explains WHY it can't be picked.
    if (shell.handSelectUiActive) {
      shell.handSelectPress(entry.card.name);
      return;
    }
    if (!entry.playable) {
      // The fork's rule: NEVER a bare "Нельзя разыграть" — always the reason.
      shell.showNotice(shell.handBlockedNotice(entry));
      return;
    }
    // Inspection is free; STARTING a play while something is already owed is
    // not — the cards are shown, the reason is named, nothing is hidden.
    if (shell.actionBlockedReason !== '') {
      shell.showNotice(shell.actionBlockedReason);
      return;
    }
    shell.openPlayCardFromHand(entry.card.name);
  }

  /** B: one calm step toward the console home (never destructive). */
  function handleSectionBack(): void {
    // A running hand-reveal episode owns B: mid-open it REVERSES the same
    // timeline from its current progress (the hard `B` contract);
    // mid-close it's swallowed — the gather is already going home.
    // A FILTER episode is a state answer, not a journey: snap it and let
    // B proceed to the normal close below (responsiveness rule).
    if (isHandRevealEpisodeRunning()) {
      if (runningHandRevealKind() === 'filter') {
        finishInstant();
      } else if (shell.handPickActive) {
        // Mid-open under a client pick: snap the flight — the pick-cancel
        // below owns the way back (a reversal would fight its section restore).
        finishInstant();
      } else if (handRevealState.phase === 'opening' && workspaceFrameHost('hand') !== undefined && !workspaceFrameIsOverlay('hand')) {
        // Mid-open of a HOSTED STEP (the start's play-from-hand — Ecology Experts, Eccentric Sponsor): snap the flight and
        // let B do what it does on the step — minimize the WHOLE host (the restore card brings it back). The reversal
        // closed only the hand's level: the start stood around an empty zone with the server's `projectCard` asked of
        // nobody, no restore card, no new prompt edge to re-open it — the monkey's wg2 table `field-start-sbp-triton`
        // (3/3, a B 150 ms after the step opened; inventory R15).
        finishInstant();
      } else {
        if (handRevealState.phase === 'opening') {
          reverseHandReveal();
        }
        return;
      }
    }
    // CLIENT HAND PICK: B returns to the composer with the OLD choice kept
    // (the pick is voluntary re-openable — never a lost decision).
    if (shell.handPickActive) {
      cancelConsoleHandPick();
      return;
    }
    // A LAW'S PLAY PICK (RX36): B in the ALBUM is one level — back to the law's stage, its slot as it was. (B in the
    // composer above it is the composer's own: the card goes home into the album.)
    if (shell.playPickActive && shell.pendingPlayCard === undefined) {
      cancelConsolePlayPick();
      return;
    }
    if (consoleState.sale.active) {
      // The sale is ON THE WIRE / physically flying — the press is absorbed
      // (the move is committed; folding the hand mid-scene would tear the
      // gather's live slots out from under its own proxies).
      if (isPatentSaleActive()) {
        return;
      }
      consoleState.sale.active = false;
      consoleState.sale.selected = [];
      // A sale hosted as a STEP of the std-projects flow folds ONE level
      // back — same workspace, same row, nothing sold. A standalone sale
      // (the legacy lateral entry) still closes to the board.
      if (workspaceFrameHost('hand') === 'standard-projects') {
        popWorkspaceFrame();
        shell.rollbackStdProjectFlow();
      } else {
        goBoardHome();
      }
      return;
    }
    // A NESTED STEP (the hand hosted by the start, …): B minimizes the WHOLE
    // hosting workspace — its standard verb — never a bare close. Closing
    // just this level would leave the host standing around an empty zone.
    if (workspaceFrameHost('hand') !== undefined && !workspaceFrameIsOverlay('hand')) {
      shell.collapseWorkspace();
      return;
    }
    // A REPLACEMENT's RESERVE CATALOG (the roster pick's second level): B is ONE level — back to «which tile
    // leaves», the leaving tile un-chosen and the cursor on it. Staged and live doors alike; nothing was sent.
    if (consoleState.section === 'colonies' && !shell.colonyFocusOpen && shell.colonyRosterOutgoing !== undefined && !colonyRosterPending()) {
      const back = shell.colonyRosterOutgoing;
      void shell.reseatColonyRosterLevel(() => {
        shell.colonyCursorTarget = back;
        colonyRosterDraft.outgoing = undefined;
      });
      return;
    }
    // A STAGED COLONY's grid (TR07): B is ONE level — the composer comes back
    // (nothing was sent). Past the commit a beat is in flight: B is absorbed.
    if (stagedColonyOf(stagedPlayState.arm) !== undefined && consoleState.section === 'colonies' && !shell.colonyFocusOpen) {
      if (!stagedPlayState.committing) {
        shell.cancelStagedPlay();
      }
      return;
    }
    // THE COLONY FOCUS STAGE: B folds ONE level back to the browse surface
    // (workspace flow: configure → browse) — before the shell-task branch,
    // so an X-opened dossier during a SelectColony pick closes to the grid
    // instead of deferring the whole prompt.
    if (shell.colonyFocusOpen) {
      // …but PAST THE COMMIT the stage IS the resolution's scene (the payout,
      // the bonus cycles, the mandatory discard). B there means «свернуть» —
      // the whole workspace parks and the decision stays live on the board's
      // return card — never a fold that would tear the reveal out from under
      // its own flow, and never a way around a mandatory step. The FRAME's
      // phase is the discriminator (set by the resolution's own lifecycle),
      // so a casual inspect while someone ELSE's payout is pending still
      // closes normally.
      if (shell.colonyResolutionLive &&
          isCommitted(workspaceFramePhase('colonies') ?? 'browse')) {
        shell.collapseWorkspace();
        return;
      }
      closeColonyFocus();
      return;
    }
    // B on a shell-task surface: CANCEL when the server marker allows
    // (pay-on-commit Build Colony), else DEFER to inspect the board.
    if (shell.shellTaskActive) {
      if (shell.shellTask?.kind === 'colony' && shell.colonyCancellable) {
        // Inside the std-projects flow the response to this cancel is what
        // folds the colony step back to the same browse row (the flow's
        // reconciler) — mark it so the fold is a return, never a close.
        if (stdProjectsFlowLive()) {
          requestStdProjectCancel();
        }
        shell.submit(cancelResponse());
        return;
      }
      shell.collapseWorkspace();
      return;
    }
    if (consoleState.section === 'hand') {
      // The physical gather back into the dock (plain browse close — the
      // sale / shell-task paths returned above with their own handling).
      void shell.closeHandWithReveal();
      return;
    }
    // Any other open workspace SECTION: the verb comes from the STACK's own
    // depth model, so B can never do one thing and say another — a committed
    // step MINIMIZES its whole workspace (the embed contract's verb), a
    // browse layer closes, a descent folds. «Colonies» and «hydro» need no
    // branch of their own, and neither will the next screen. (A PARKED stack
    // projects to the board, so it falls through to the restore branch below,
    // where it belongs.)
    if (consoleState.section !== 'board') {
      if (workspaceStackBackVerb() === 'collapse') {
        shell.collapseWorkspace();
      } else {
        workspaceStackBack();
      }
      return;
    }
    if (shell.placementActive) {
      // The back hierarchy is one level at a time: a commit in flight
      // absorbs B (it cannot be recalled off the wire); the LOCKED phase
      // steps back to navigation with zero gameplay consequence; only the
      // navigation level reaches the whole-flow cancel.
      if (placementFlowState.phase === 'committing') {
        return;
      }
      if (placementFlowState.phase === 'locked') {
        unlockPlacementCell();
        return;
      }
      // A MOVE with a tile lifted: B puts it down — back to «which tile»,
      // still nothing sent. The whole-flow cancel is one more B away.
      if (shell.placementMoveLevelNow === 'cell') {
        putDownMoveSource();
        return;
      }
      if (shell.finalGreeneryPickPending) {
        shell.deferFinalGreenery();
        return;
      }
      if (shell.placementCancellable) {
        shell.cancelPlacement();
      } else {
        shell.showNotice('This placement is mandatory — pick a cell on the map');
      }
      return;
    }
    // A DEFERRED task comes back — B toggles task ↔ board-inspect, the same
    // thing the prompt card's A does.
    //
    // DELIBERATELY LAST of the "go somewhere" branches. It used to run FIRST,
    // as a global fallback, which made B inside another section (the hand,
    // colonies, hydro) yank the minimized prompt back instead of closing the
    // screen the player was looking at — B stopped meaning "one calm step
    // back" the moment anything was deferred. The task is reachable exactly
    // where its card is: from the BOARD HOME. Inspection modes stay BELOW it,
    // because "minimize to look at the board" is what deferring is for.
    // …and it is the SAME predicate the card itself renders on. Spelling the
    // condition out a second time is how it drifted: the card grew two more
    // arms (`startSceneServes`, a PARKED stack — a minimized flow whose
    // prompt is the action menu, which is neither a host nor a shell-section
    // kind) and B never got them, so the announcement stood at the board home
    // saying «вернуться», A restored it and B did nothing at all.
    if (shell.mandatoryDeferredActive) {
      shell.restoreDeferredTask();
      return;
    }
    // P27: inspection modes — B is one calm step back to the board home.
    if (consoleState.scaleInspecting) {
      shell.exitScaleInspect();
      return;
    }
    if (consoleState.inspecting) {
      shell.exitInspection();
      return;
    }
    // THE POST-GAME INSPECTION ENDS WHERE IT STARTED. B is one calm step
    // back on every level of the free roam; at the board-home ROOT — the
    // level below which there is nothing left — the last step is the road
    // back to the results the player minimized. DELIBERATELY LAST: the
    // inspection modes above are steps of their own, and swallowing them
    // here would make B skip a level the player can see.
    if (shell.postGameInspection) {
      (shell.surfaces.at<InstanceType<typeof ConsoleEndgameWorkspace>>('endgameWs'))?.expandFromBoard();
    }
  }

  /** P17: right-stick scroll for the ACTIVE console scroll container —
   *  the journal peek while open, else the topmost visible scrollable
   *  `.con-info__scroll` (console layers stack in DOM order). */
  function scrollActiveConsole(dy: number, dx = 0): void {
    if (Math.abs(dy) < 0.05 && Math.abs(dx) < 0.05) {
      return;
    }
    // The hand ALBUM turns pages on the right stick (either axis — a firm
    // flick, hold-to-repeat) — but only when it is the active surface (no
    // play-confirm / task / reveal / zoom on top, which would otherwise be
    // paged through blindly).
    if (shell.handScrollActive) {
      const hand = shell.surfaces.at<InstanceType<typeof ConsoleHandSection>>('handSection');
      hand?.stickScroll(dy, dx);
      return;
    }
    // The EMBEDDED «Разыграно» table (Information Workspace X route) owns
    // the right stick while it is the workspace's content.
    if (infoModeState.open && infoModeState.route === 'played') {
      (shell.surfaces.at<InstanceType<typeof ConsoleInfoMode>>('infoMode'))
        ?.handlePlayedIntent({kind: 'scroll', dx: 0, dy});
      return;
    }
    // …and the EFFECTS EXPLORER (its grid, or the open dossier's reading
    // scroll — the explorer knows which layer stands).
    if (infoModeState.open && infoModeState.route === 'effects') {
      (shell.surfaces.at<InstanceType<typeof ConsoleInfoMode>>('infoMode'))
        ?.handleEffectsIntent({kind: 'scroll', dx: 0, dy});
      return;
    }
    // The corp first-action modal's briefing column scrolls first.
    if (shell.corpFirstActionOpen) {
      const confirm = shell.surfaces.at<InstanceType<typeof ConsoleCorpFirstActionConfirm>>('corpFirstConfirm');
      confirm?.stickScroll(dy);
      return;
    }
    // The «Разыграно» overlay owns the right stick while open (main table
    // or the nested events list — the overlay routes internally).
    if (shell.playedTableVisible) {
      const played = shell.surfaces.at<InstanceType<typeof ConsolePlayedOverlay>>('playedOverlay');
      played?.stickScroll(dy);
      return;
    }
    // The JOURNAL's feed while it is open (its own scroll is the inner
    // viewport — the `.con-journal__scroll` box itself clips).
    if (journalState.open) {
      const journal = document.querySelector<HTMLElement>('.con-journal__scroll');
      if (journal !== null && stickScrollBy(dy, journal)) {
        return;
      }
    }
    // THE NET: no routed surface took the stick — move the overflowing
    // container the player is LOOKING AT (painted, on top, the largest:
    // an Info Mode body, a prompt panel, a workspace's list), never one
    // under a foreign surface, never swallow the stick over a list that
    // does not fit.
    stickScrollBy(dy);
  }

  /** Right-stick scroll of the review's scroll area. Returns true when it
   *  actually OVERFLOWS. */
  function scrollReviewFeed(dy: number): boolean {
    const feed = document.querySelector<HTMLElement>('.con-bot-review__scroll');
    if (feed === null || feed.scrollHeight <= feed.clientHeight + 1) {
      return false;
    }
    if (Math.abs(dy) >= 0.05) {
      feed.scrollBy({top: dy * CONSOLE_SCROLL_STEP_PX * conUiScale(), behavior: 'auto'});
    }
    return true;
  }

  // ── lifecycle ────────────────────────────────────────────────────────────────────────────────────────────────────
  // A SERIES' VISIT IS A DELIBERATE SWALLOW (PC04 · GS) — on the ledger, so a driver waits it out. The router notes
  // the gate (`handleIntent`), so the router registers it, for the shell's mounted life.
  let seriesAbsorbOff: (() => void) | undefined;
  onMounted(() => {
    seriesAbsorbOff = registerInputAbsorber(SERIES_VISIT_ABSORBER, () => shell.seriesHeld !== undefined, {scope: 'all'});
  });
  onBeforeUnmount(() => {
    seriesAbsorbOff?.();
    seriesAbsorbOff = undefined;
  });

  return {
    notifTapReplay,
    offIntent,
    topNotification,
    handleIntent,
    cycleInspectedPlayer,
    onAuxCellPressed,
    handleInfoIntent,
    feedWheelArm,
    activateQuickSlot,
    executeRtEntry,
    executeLtEntry,
    handleSheetIntent,
    handleSectionIntent,
    handleSectionNav,
    handleSectionConfirm,
    handleSectionBack,
    scrollActiveConsole,
    scrollReviewFeed,
  };
}

export type PadRouterController = ReturnType<typeof createPadRouterController>;
