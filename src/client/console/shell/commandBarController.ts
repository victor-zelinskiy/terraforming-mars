/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE COMMANDBAR CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {SpaceId} from '@/common/Types';
import {botTurnReviewState} from '@/client/components/marsbot/botTurnReviewState';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {ConsoleSheetRow} from '@/client/components/console/consoleSheetTypes';
import {maFocusState, maFocusAcceptsInput} from '@/client/console/consoleMaFocus';
import {countTone} from '@/client/console/potentialAvailability';
import {multiPickConfirmCommand} from '@/client/components/console/consoleHandSelectModel';
import {consoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
import {consoleSystemAlertState} from '@/client/console/consoleSystemAlertState';
import {FINALE_KICKER, finalGreeneryFinishCommand} from '@/client/console/finalGreenery/finalGreeneryModel';
import {workspaceHostYieldsScene, workspaceFrameIndex, workspaceFrameMounted, workspaceFramePhase, workspaceFrameStage, workspaceFrameHost, workspaceFrameRoot, workspaceStackTopAxis} from '@/client/console/consoleWorkspaceStack';
import {acceptsInput} from '@/client/console/consoleWorkspaceFlow';
import {cardDiscardTransaction} from '@/client/console/cardDiscard/consoleCardDiscard';
import {colonyTradeEntryLocked} from '@/client/console/colonyTrade/colonyTradeEntry';
import {settlementTable} from '@/client/console/colonyTrade/settlementTable';
import {draftPickBeatActive, riseSceneEngaged} from '@/client/console/cardDeal/consoleDraftTray';
import {consoleDraftUi} from '@/client/console/draft/consoleDraftUi';
import {isTradeFleetActive} from '@/client/console/colonyFleet/consoleTradeFleet';
import {isColonyTradeInputLocked} from '@/client/console/colonyTrade/consoleColonyTrade';
import {consolePlayedUi} from '@/client/console/consolePlayedUi';
import {consoleColoniesUi, colonyFocusState, fleetDockUi} from '@/client/console/consoleColoniesModel';
import {consolePlayCardUi} from '@/client/console/consolePlayCardUi';
import {consoleStartUi} from '@/client/console/consoleStartUi';
import {panelCommands} from '@/client/console/consolePanelUi';
import {consoleActionComposerUi} from '@/client/console/consoleActionComposerUi';
import {focusKicker} from '@/client/console/consoleActionFlow';
import {effectForecastOpen, forecastExplorerUi, forecastStageText} from '@/client/console/consoleEffectForecast';
import {forecastLayerAvailable} from '@/client/console/effectForecastModel';
import {armedEffectsOf} from '@/client/console/armedEffects';
import {PresentedArmedEffect, presentedArmedEffects} from '@/client/console/armedEffectFlight';
import {consoleCardZoom} from '@/client/console/consoleCardZoom';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {taskFor, followUpStepStage, DELEGATE_GRANT_STEP_STAGE} from '@/client/console/consoleTaskRouter';
import {agendaReactionOf} from '@/client/console/parliament/agendaReaction';
import {ConsoleTaskSummary, consoleTaskSummary} from '@/client/console/consoleTaskSummary';
import {govScaleFocusState} from '@/client/console/consoleGovScaleFocus';
import {isHydroMarkerActive} from '@/client/console/hydroMarker/consoleHydroMarker';
import {drawnRevealCommandRun} from '@/client/console/consoleRevealCommands';
import {revealSourcePeekState} from '@/client/console/revealSourcePeek';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {PARLIAMENT_DRAW_ZONE} from '@/client/console/parliament/parliamentDraw';
import {COLONY_LEDGER_STAGE, colonyBonusPayoutArmed} from '@/client/console/colonyLedger/colonyBonusPayout';
import {isBoardCardBonusActive} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {isDeckDrawActive} from '@/client/console/deckDraw/consoleDeckDraw';
import {isPatentSaleActive} from '@/client/console/patentSale/consolePatentSale';
import {placementFlowState} from '@/client/console/tilePlacement/placementFlow';
import {MOVE_SOURCE_BANNER} from '@/client/console/tilePlacement/placementMove';
import {placementCommands, STAGED_BACK_OWED} from '@/client/console/tilePlacement/placementCommands';
import {consoleHydroUi} from '@/client/console/consoleHydroState';
import {consoleJournalUi} from '@/client/console/consoleJournalState';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {consoleState} from '@/client/console/consoleRouter';
import {wheelControlState} from '@/client/console/quickWheel/wheelControlMode';
import {consoleHandPickState} from '@/client/console/consoleHandPick';
import {isDeltaRewardPickActive} from '@/client/console/hydroFlow/deltaRewardEntry';
import {isDeltaEspionagePickActive} from '@/client/console/hydroFlow/deltaEspionageEntry';
import {isDeltaBlockadePickActive} from '@/client/console/hydroFlow/deltaBlockadeEntry';
import {consoleRepeatPickUi} from '@/client/console/consoleRepeatPickUi';
import {infoModeState} from '@/client/console/infoModeState';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {journalState} from '@/client/components/journal/journalState';
import {stagedStepHost} from '@/client/console/stagedPlay';
import {CLIENT_PAYMENT_TASK, CLIENT_PICK_TASK} from '@/client/console/shell/shellShared';
import type {RouterController} from '@/client/console/shell/routerController';
import type {MaController} from '@/client/console/shell/maController';
import type {ColonyController} from '@/client/console/shell/colonyController';
import type {PlayCardController} from '@/client/console/shell/playCardController';
import type {RevealController} from '@/client/console/shell/revealController';
import type {HandSelectController} from '@/client/console/shell/handSelectController';
import type {PlayedController} from '@/client/console/shell/playedController';
import type {MandatoryController} from '@/client/console/shell/mandatoryController';
import type {DraftController} from '@/client/console/shell/draftController';
import type {FinaleController} from '@/client/console/shell/finaleController';
import type {PlacementController} from '@/client/console/shell/placementController';
import type {ParliamentController} from '@/client/console/shell/parliamentController';
import type {HydroController} from '@/client/console/shell/hydroController';
import type {HandController} from '@/client/console/shell/handController';
import type {JournalController} from '@/client/console/shell/journalController';
import type {OutcomeController} from '@/client/console/shell/outcomeController';
import type {SeatController} from '@/client/console/shell/seatController';
import type {StdProjectsController} from '@/client/console/shell/stdProjectsController';
import type {CellController} from '@/client/console/shell/cellController';
import type {StagedController} from '@/client/console/shell/stagedController';
import type {StartController} from '@/client/console/shell/startController';
import type {WheelController} from '@/client/console/shell/wheelController';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type CommandBarPort = {
  aresGlobalsActive: UnwrapRef<RouterController['aresGlobalsActive']>,
  awardFundingActive: UnwrapRef<MaController['awardFundingActive']>,
  awardStepHosted: UnwrapRef<MaController['awardStepHosted']>,
  botAttackActive: UnwrapRef<RouterController['botAttackActive']>,
  colonyActAnswered: UnwrapRef<ColonyController['colonyActAnswered']>,
  colonyCancellable: UnwrapRef<ColonyController['colonyCancellable']>,
  colonyEmbedActive: UnwrapRef<ColonyController['colonyEmbedActive']>,
  colonyEmbedHasSource: UnwrapRef<ColonyController['colonyEmbedHasSource']>,
  colonyFocusOpen: UnwrapRef<ColonyController['colonyFocusOpen']>,
  colonyFocusTradeable: UnwrapRef<ColonyController['colonyFocusTradeable']>,
  colonyInspectAct: UnwrapRef<ColonyController['colonyInspectAct']>,
  colonyInspectModel: UnwrapRef<ColonyController['colonyInspectModel']>,
  colonyPick: UnwrapRef<ColonyController['colonyPick']>,
  confirmForecast: UnwrapRef<PlayCardController['confirmForecast']>,
  confirmWarnings: UnwrapRef<PlayCardController['confirmWarnings']>,
  consoleRevealMode: UnwrapRef<RevealController['consoleRevealMode']>,
  contextualSourceKnown: UnwrapRef<HandSelectController['contextualSourceKnown']>,
  corpFirstActionNames: UnwrapRef<PlayedController['corpFirstActionNames']>,
  corpFirstActionOpen: UnwrapRef<PlayedController['corpFirstActionOpen']>,
  deckPickServing: UnwrapRef<RevealController['deckPickServing']>,
  deferAsk: UnwrapRef<MandatoryController['deferAsk']>,
  draftedCards: UnwrapRef<DraftController['draftedCards']>,
  draftTrayMounted: UnwrapRef<DraftController['draftTrayMounted']>,
  draftWaitActive: UnwrapRef<DraftController['draftWaitActive']>,
  draftWorkspaceOwnsPad: UnwrapRef<DraftController['draftWorkspaceOwnsPad']>,
  effectDecisionActive: UnwrapRef<RouterController['effectDecisionActive']>,
  effectDecisionEmbedTarget: UnwrapRef<RouterController['effectDecisionEmbedTarget']>,
  effectDecisionVm: UnwrapRef<RouterController['effectDecisionVm']>,
  endgameStageUp: UnwrapRef<FinaleController['endgameStageUp']>,
  externalDrawOwnsPad: UnwrapRef<RevealController['externalDrawOwnsPad']>,
  finaleSessionEngaged: UnwrapRef<FinaleController['finaleSessionEngaged']>,
  finalGreeneryActive: UnwrapRef<PlacementController['finalGreeneryActive']>,
  finalGreeneryPickPending: UnwrapRef<PlacementController['finalGreeneryPickPending']>,
  govSupportActive: UnwrapRef<ParliamentController['govSupportActive']>,
  handCoveredByHydro: UnwrapRef<HydroController['handCoveredByHydro']>,
  handEntries: UnwrapRef<HandController['handEntries']>,
  handPickActive: UnwrapRef<HandSelectController['handPickActive']>,
  handPickDeclineLive: UnwrapRef<HandSelectController['handPickDeclineLive']>,
  handPickDeferLive: UnwrapRef<MandatoryController['handPickDeferLive']>,
  handSelectFiltered: UnwrapRef<HandSelectController['handSelectFiltered']>,
  handSelectModel: UnwrapRef<HandSelectController['handSelectModel']>,
  handSelectSelectableNames: UnwrapRef<HandSelectController['handSelectSelectableNames']>,
  handSelectSingle: UnwrapRef<HandSelectController['handSelectSingle']>,
  handSelectSuitableOnly: UnwrapRef<HandSelectController['handSelectSuitableOnly']>,
  handSelectTaskActive: UnwrapRef<HandSelectController['handSelectTaskActive']>,
  handSelectVerb: UnwrapRef<HandSelectController['handSelectVerb']>,
  handStage: UnwrapRef<HandController['handStage']>,
  handTagFilterOptions: UnwrapRef<HandSelectController['handTagFilterOptions']>,
  hostTask: UnwrapRef<RouterController['hostTask']>,
  inspectedCellSourceCard: UnwrapRef<PlacementController['inspectedCellSourceCard']>,
  journalPanelVisible: UnwrapRef<JournalController['journalPanelVisible']>,
  liveGrantStepEntered: UnwrapRef<OutcomeController['liveGrantStepEntered']>,
  maFocusAvailable: UnwrapRef<MaController['maFocusAvailable']>,
  maFocusItem: UnwrapRef<MaController['maFocusItem']>,
  mandatoryAnnounceView: UnwrapRef<MandatoryController['mandatoryAnnounceView']>,
  mandatoryAnnounceVisible: UnwrapRef<MandatoryController['mandatoryAnnounceVisible']>,
  maPayReady: UnwrapRef<MaController['maPayReady']>,
  maScreenItems: UnwrapRef<MaController['maScreenItems']>,
  maScreenKind: UnwrapRef<MaController['maScreenKind']>,
  myTurn: UnwrapRef<SeatController['myTurn']>,
  parliamentAnswerTask: UnwrapRef<ParliamentController['parliamentAnswerTask']>,
  parliamentStageTask: UnwrapRef<ParliamentController['parliamentStageTask']>,
  pendingClientPayment: UnwrapRef<PlayCardController['pendingClientPayment']>,
  pendingClientPick: UnwrapRef<PlayCardController['pendingClientPick']>,
  pendingPlayCard: UnwrapRef<PlayCardController['pendingPlayCard']>,
  pickAllSelected: UnwrapRef<HandSelectController['pickAllSelected']>,
  placementActive: UnwrapRef<PlacementController['placementActive']>,
  placementCancellable: UnwrapRef<PlacementController['placementCancellable']>,
  placementKickerKey: UnwrapRef<PlacementController['placementKickerKey']>,
  placementMoveFamilyNow: UnwrapRef<PlacementController['placementMoveFamilyNow']>,
  placementMoveLevelNow: UnwrapRef<PlacementController['placementMoveLevelNow']>,
  placementSourceInspectable: UnwrapRef<PlacementController['placementSourceInspectable']>,
  placementStagedBar: UnwrapRef<PlacementController['placementStagedBar']>,
  playedHeroHolds: UnwrapRef<PlayedController['playedHeroHolds']>,
  playedTableVisible: UnwrapRef<PlayedController['playedTableVisible']>,
  readonly playerView: PlayerViewModel,
  playPickActive: UnwrapRef<HandSelectController['playPickActive']>,
  postGameInspection: UnwrapRef<SeatController['postGameInspection']>,
  productionLossActive: UnwrapRef<RouterController['productionLossActive']>,
  repeatPickActive: UnwrapRef<HandSelectController['repeatPickActive']>,
  revealDiscardCloser: UnwrapRef<RevealController['revealDiscardCloser']>,
  revealEmbedTarget: UnwrapRef<RevealController['revealEmbedTarget']>,
  reviewInspectable: UnwrapRef<HandController['reviewInspectable']>,
  readonly reviewMapSpaces: ReadonlyArray<SpaceId>,
  saleAllSelected: UnwrapRef<StdProjectsController['saleAllSelected']>,
  selectedCellLegal: UnwrapRef<CellController['selectedCellLegal']>,
  seriesHeld: UnwrapRef<RouterController['seriesHeld']>,
  shellTaskActive: UnwrapRef<RouterController['shellTaskActive']>,
  shellTaskOnSurface: UnwrapRef<RouterController['shellTaskOnSurface']>,
  spendHeatActive: UnwrapRef<RouterController['spendHeatActive']>,
  stagedBackOwed: UnwrapRef<StagedController['stagedBackOwed']>,
  stagedColonyModel: UnwrapRef<ColonyController['stagedColonyModel']>,
  stagedLandingInFlight: UnwrapRef<StagedController['stagedLandingInFlight']>,
  stagedVoteModel: UnwrapRef<ParliamentController['stagedVoteModel']>,
  startPromptSurfaceStands: UnwrapRef<StartController['startPromptSurfaceStands']>,
  startSceneOwnsPad: UnwrapRef<StartController['startSceneOwnsPad']>,
  startSceneServes: UnwrapRef<StartController['startSceneServes']>,
  stdBackLabel: UnwrapRef<StdProjectsController['stdBackLabel']>,
  stdProjectItems: UnwrapRef<StdProjectsController['stdProjectItems']>,
  stdpStepUp: UnwrapRef<StdProjectsController['stdpStepUp']>,
  taskAllSelected: UnwrapRef<RouterController['taskAllSelected']>,
  taskSpacePending: UnwrapRef<PlacementController['taskSpacePending']>,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
  tilePlacementHolds: UnwrapRef<PlacementController['tilePlacementHolds']>,
  venusBonusActive: UnwrapRef<RouterController['venusBonusActive']>,
  wheelCounts: UnwrapRef<WheelController['wheelCounts']>,
  wheelCountsTotal: UnwrapRef<WheelController['wheelCountsTotal']>,
  wheelCountsUseful: UnwrapRef<WheelController['wheelCountsUseful']>,
};

export function createCommandBarController(shell: CommandBarPort) {
  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // ── context panel ──────────────────────────────────────────────────
  const contextMode = computed((): 'placement' | 'cell' | 'track' | 'idle' => {
    // The FINALE SESSION keeps the dossier in placement mode between two picks and through another seat's
    // answer (PL-303): the panel never unmounts, its stage block says where the context stands.
    if (shell.placementActive || shell.finaleSessionEngaged) {
      return 'placement';
    }
    if (consoleState.scaleInspecting && consoleState.trackMarker !== undefined) {
      return 'track';
    }
    if (consoleState.inspecting) {
      return 'cell';
    }
    return 'idle';
  });

  /** The dossier overlay's mode — undefined on the idle home (unmounted). */
  const contextOverlayMode = computed((): 'placement' | 'cell' | 'track' | undefined => {
    const m = contextMode.value;
    return m === 'idle' ? undefined : m;
  });

  // ── banner ──────────────────────────────────────────────────────────
  // P27: MANDATORY / critical states ONLY. The plain "your turn" reads
  // from the viewer's own top chip — the centre stays clear for the board.
  const bannerText = computed((): string => {
    if (shell.placementActive) {
      // P20: the inspect-all toggle owns the prompt while active.
      if (consoleState.freeRoam) {
        return translateText('Inspecting all cells');
      }
      // A MOVE asks two things in turn — the banner names the one being asked, in the family's words.
      const level = shell.placementMoveLevelNow;
      return translateText(level === 'source' ? MOVE_SOURCE_BANNER[shell.placementMoveFamilyNow ?? 'city'] :
        level === 'cell' ? 'Choose an adjacent space' : 'Choose a location on the board');
    }
    if (consoleState.fallbackActive) {
      // A demoted premium/desktop scope owns the screen. It used to read a
      // flat «Ожидает решения» — but the prompt behind it is classified, and
      // the marked ones (Venus bonus / spend heat) are precisely the shapes
      // no console surface serves. Name the ask; fall back only when the
      // scope is a lifecycle flow with no pending prompt of its own.
      return shell.deferAsk !== '' ? shell.deferAsk : translateText('Awaiting decision');
    }
    // A shell-section task (play-from-hand / std project / colony pick):
    // the banner means «what you owe is NOT on the screen you are looking
    // at». It is therefore gated on the player being AWAY from the task's
    // own surface — never on the task merely existing.
    //
    // ⚠️ `shellTaskActive` alone is «the task exists AND is not deferred»,
    // i.e. its surface is OPEN — so keying the banner on it showed the chip
    // exactly when it was pointless and hid it the moment it would have
    // helped. Over an open workspace it is not information but a SECOND
    // TITLE: it reads as «a prompt has arrived» on top of the very screen
    // that prompt IS (inside the Game Start Workspace it landed straight
    // across the breadcrumb tail).
    //
    // The MINIMIZED case is deliberately NOT here either: a deferred task is
    // served by the unified mandatory card (`.con-mandatory`), whose CTA
    // relabels itself «Открыть» / «Вернуться к решению». One state, one
    // voice — the banner is only for «live, un-deferred, and you are
    // elsewhere» (a task admitted while a sheet / the journal / another
    // section still owns the screen).
    if (shell.shellTaskActive && !shell.shellTaskOnSurface) {
      return shell.deferAsk;
    }
    return '';
  });

  // ── sheets ──────────────────────────────────────────────────────────
  const sheetTitle = computed((): string => {
    switch (consoleState.sheet) {
    case 'cardActions': return 'Card actions';
    case 'milestones': return 'Milestones';
    case 'awards': return 'Awards';
    case 'standardProjects': return 'Standard Projects';
    default: return '';
    }
  });

  const sheetRows = computed((): Array<ConsoleSheetRow> => {
    return [];
  });

  // ── the command bar (the truth of the current context) ─────────────
  const commandContext = computed((): string => {
    // «Разбор хода» review owns the screen — the bar reads as the review.
    if (botTurnReviewState.open) {
      return 'Turn review';
    }
    // Scale-focus hold: the modal is briefly gone while the board scale
    // animates — read as the board, not the (hidden) upcoming modal.
    if (govScaleFocusState.holding || govScaleFocusState.closing) {
      return 'Board';
    }
    // A SERIES' VISIT (PC04 · GS): the bar keeps the standing question's name — the board is not what the player sees.
    const held = shell.seriesHeld;
    if (held !== undefined) {
      return consoleTaskSummary(held.task, shell.playerView, {prompt: held.input}).kickerKey;
    }
    if (consoleState.fallbackActive) {
      // Lifecycle-aware naming: the wrapped premium flows read as PART of
      // the console experience, not a generic "waiting" veil.
      switch (consoleState.fallbackScopeId) {
      case 'startGameFlow': return 'Start of the game';
      case 'endgame': return 'Game results';
      case 'drawReveal': return 'Cards';
      case 'dialog': return 'Card details';
      case 'colonies': return 'Trading';
      // An un-named scope = the desktop modal serving a prompt the console
      // has no surface for. The classification still names it (Venus bonus,
      // spend heat, an out-of-scope guard) — only a scope with NO prompt at
      // all falls through to the honest generic.
      default: return activeTaskSummary.value?.kickerKey ?? 'Awaiting decision';
      }
    }
    if (shell.endgameStageUp) {
      // The scene's own header already reads «ФИНАЛЬНЫЙ ПОДСЧЁТ» /
      // «ИТОГИ ПАРТИИ» — repeating it in the bar is noise.
      return '';
    }
    // COLLAPSED: the bar belongs to the surface the player walked to (the
    // journal names itself, the colonies name themselves) — it falls
    // through the ordinary chain below and only the BOARD HOME, which has
    // no name of its own in the live game, is labelled from here.
    if (shell.postGameInspection && consoleState.section === 'board' &&
        !journalState.open && !shell.playedTableVisible && !infoModeState.open) {
      return 'Final state';
    }
    if (infoModeState.open) {
      return 'Information';
    }
    if (shell.draftWaitActive) {
      return 'Waiting for draft cards';
    }
    if (shell.consoleRevealMode !== undefined) {
      // EMBEDDED drawn batch: the kicker mirrors the workspace STAGE
      // («ДОБОР КАРТ») — never a generic «КАРТЫ» beside a breadcrumb that
      // already names the stage. One voice, two places (the buy stage's
      // «ПОКУПКА» parity).
      if (shell.revealEmbedTarget !== undefined) {
        // «ПРИЁМКА»: the Parliament's draw stage is no claim's phase — the bar names it in its own word («Добор карт»).
        if (shell.revealEmbedTarget === PARLIAMENT_DRAW_ZONE) {
          return focusKicker('draw');
        }
        return workspaceOutcomeState.phaseKey !== '' ? workspaceOutcomeState.phaseKey : focusKicker('draw');
      }
      return 'Cards';
    }
    if (shell.startSceneServes && !consoleState.task.deferred && !shell.placementActive &&
        !shell.startPromptSurfaceStands) {
      // The scene's own header already reads «СТАРТ ПАРТИИ» (kicker +
      // title) — repeating it in the bar is noise. The bar carries ONLY
      // the physical commands during the initial setup.
      // …unless the workspace has YIELDED to a board placement: the scene
      // paints nothing then, so an empty context would leave the placement
      // unnamed — it falls through to the placement kicker below.
      // …or to a PROMPT SURFACE of its own (the prelude's payment host, a
      // composite): the bar belongs to the surface the player is driving,
      // exactly as the pad does — it falls through and names that decision.
      // A hosted STEP (the sponsor's hand, a colony) keeps the '' : the
      // crumb already names the whole path and the step is not a new voice.
      return '';
    }
    if (shell.govSupportActive && !consoleState.task.deferred && shell.taskSpacePending === undefined) {
      return 'Government Support';
    }
    if (shell.effectDecisionActive) {
      // EMBEDDED: the bar names the STAGE the crumb above already names —
      // one voice in two places, exactly as the embedded reveal does. The
      // standalone band has no crumb, so there it names the KIND of decision.
      return shell.effectDecisionEmbedTarget !== undefined ?
        (shell.effectDecisionVm?.stageKey ?? 'Awaiting decision') :
        (shell.effectDecisionVm?.eyebrowKey ?? 'Awaiting decision');
    }
    if (shell.finalGreeneryActive || shell.finaleSessionEngaged) {
      return FINALE_KICKER;
    }
    if (shell.hostTask !== undefined && (shell.parliamentStageTask || shell.parliamentAnswerTask) && workspaceFrameMounted('parliament') &&
        !consoleState.task.deferred) {
      // EMBEDDED in the Parliament's sitting (the recipient picker in the reward stage's zone): the
      // bar names the STAGE the crumb already names («ВЫБОР»), one voice in two places — never the
      // picker's own kicker over a workspace that has a name (final polish P-13). A table's answer to a step of
      // the Career names WHAT is put down («ИСТРЕБИТЕЛЬ» — the marker's own word, TR78).
      const wf = shell.playerView.waitingFor;
      return followUpStepStage(shell.hostTask.kind, agendaReactionOf(wf) !== undefined ? wf : undefined) ??
        activeTaskSummary.value?.kickerKey ?? 'Awaiting decision';
    }
    if (shell.hostTask !== undefined && !consoleState.task.deferred && shell.taskSpacePending === undefined && !shell.handPickActive) {
      // The bar names the KIND of decision the host is serving ("ОПЛАТА" /
      // "ДРАФТ"), not a generic "awaiting" — the host's own header carries
      // the full ask right under it.
      return activeTaskSummary.value?.kickerKey ?? 'Awaiting decision';
    }
    if (shell.handPickActive) {
      // A composer's card pick is out on the hand — the bar names the pick.
      return 'Card selection';
    }
    // ...and the REPEAT-ACTION pick (ProjInsp / Viron / Hydronetwork stage 7):
    // the ДЕЙСТВИЯ КАРТ repeat surface owns the screen — never the hidden
    // source composer / the hydro section underneath. EXCEPT while a plan's
    // landing pre-select stands OVER it (the reward-pick descent): the
    // deepest surface names the bar, one voice with the crumb's tail.
    if (shell.repeatPickActive) {
      // The DEEPEST surface names the context (the pad-routing tiebreak):
      // a pick's hydro frame standing OVER the browser owns the line; the
      // browser standing over the pick's own frame keeps its own name.
      const hydroDeeper = workspaceFrameIndex('hydro') > workspaceFrameIndex('repeat-pick');
      if (hydroDeeper && (isDeltaBlockadePickActive() || isDeltaEspionagePickActive())) {
        return 'Target selection';
      }
      return hydroDeeper && isDeltaRewardPickActive() ? 'Reward selection' : 'Repeat action';
    }
    const stagedHost = stagedStepHost();
    if ((shell.stagedVoteModel !== undefined && stagedHost !== undefined && workspaceFrameHost('parliament') === stagedHost) ||
        (shell.stagedColonyModel !== undefined && stagedHost !== undefined && workspaceFrameHost('colonies') === stagedHost)) {
      // A STAGED VOTE stands: the bar reads as it will for the step's whole
      // life (a hosted step's convention — its host's root), from the frame
      // the step is pushed. The handoff's few frames otherwise walked it
      // through the composer's stage name and the landing scene's «Разыграно».
      // (The host is the FLOW's: the hand for a play, «Действия карт» for an action — TR15.)
      return workspaceFrameRoot(stagedHost ?? 'hand');
    }
    // THE PLAY'S LIVE GRANT (P72 · CZ — PL-1167): the vote risen inside the hand from the commit speaks ONE voice with
    // the crumb's tail from the frame it is pushed — never the landing's «Разыграно» under a crumb that already says
    // «ГОЛОСОВАНИЕ», never the host's root a beat later.
    if (shell.liveGrantStepEntered()) {
      return workspaceFrameStage('parliament') || DELEGATE_GRANT_STEP_STAGE;
    }
    // …and once the composer has LET GO (a hosted step rising out of its rect — TR04's walk, TR31's rally; PL-084)
    // the bar reads as the step's host does below (the hand's root), from the frame the step is pushed — never
    // the stage name for the fade's length and the host's root after it.
    if (shell.pendingPlayCard !== undefined && !consolePlayCardUi.released) {
      // Inside the hand workspace the bar names the STAGE, not the surface —
      // the breadcrumb above already says which workspace and which card, and
      // repeating that in the footer is the duplication the one-bar rule
      // exists to prevent. Standalone (no descent) it still names itself.
      return shell.handStage !== undefined ? shell.handStage.name : 'Play project card';
    }
    if (shell.corpFirstActionOpen) {
      return 'First action';
    }
    if (shell.colonyInspectModel !== undefined) {
      return 'Colony';
    }
    if (shell.maFocusItem !== undefined) {
      return shell.maFocusItem.name.replace(/[0-9]+$/, '');
    }
    if (consoleState.confirm !== undefined) {
      // The R3 «Эффекты» layer is a level INSIDE the confirm: the context gains «· ЭФФЕКТЫ» (+ the source card at
      // its detail) — a composed, pre-translated string (PL-394).
      return forecastStageText('confirm', 'Confirmation') ?? 'Confirmation';
    }
    if (shell.journalPanelVisible) {
      return 'Journal';
    }
    if (shell.playedHeroHolds) {
      return 'Played';
    }
    if (shell.playedTableVisible) {
      // The open category's caption; the bare table reads as «Разыграно».
      return (consolePlayedUi.categoryOpen || consolePlayedUi.categoryBusy) && consolePlayedUi.categoryLabel !== '' ?
        consolePlayedUi.categoryLabel : 'Played';
    }
    if (consoleState.quick !== undefined) {
      // The wheel's own kicker (trigger glyph + title) already names the
      // context centre-screen — repeating it bottom-left is noise on a TV
      // (same rule as the start scene's ''). The bar carries commands only.
      return '';
    }
    if (consoleState.sheet === 'cardActions' && consoleActionComposerUi.open &&
        workspaceStackTopAxis() !== 'section') {
      // The ACTION FOCUS stage inside the Action Center: the bar names the
      // STAGE by its PHASE (the SAME source as the frame header — the bar
      // and the breadcrumb can never disagree), never the grid underneath.
      // …unless a SECTION-projecting workspace is standing INSIDE it (a
      // hosted colony step): the bar belongs to the surface the player is
      // driving, which is the same rule input routing uses.
      // «THE LEDGER PAYS» (TR23): past the press the stage is the ledger's —
      // the crumb's own word (its steps publish their own while they stand).
      if (colonyBonusPayoutArmed() && workspaceFrameMounted('card-actions')) {
        return COLONY_LEDGER_STAGE;
      }
      // THE CRUMB'S OWN WORD, published by «Действия карт» (PL-090): a draw beat reads «Добор карт» here exactly as
      // in the crumb (it read «Настройка» while the crumb had moved on). Composed already (R3 «· Эффекты» included).
      if (consoleActionComposerUi.stageKey !== '') {
        return consoleActionComposerUi.stageKey;
      }
      // A SENT action with no outcome stage of its own reads «Выполнение» here exactly as in the crumb (PL-062).
      const phase = focusKicker(consoleActionComposerUi.revealClaim !== '' ? 'reveal' :
        consoleActionComposerUi.executing ? 'executing' : 'setup');
      // The composer's R3 «Эффекты» layer — one voice with the crumb's
      // composed tail (pre-translated; `$t` passes an unknown key through).
      return forecastStageText('action', phase) ?? phase;
    }
    // A SHEET standing INSIDE a section that yielded its scene (the
    // Parliament's door into the action workspace — Turmoil Redux): the bar
    // is one voice with the crumb's ROOT, the screen the player entered.
    const sheetHost = consoleState.sheet === 'cardActions' ? workspaceFrameHost('card-actions') : undefined;
    if (sheetHost !== undefined && workspaceHostYieldsScene(sheetHost) && workspaceStackTopAxis() !== 'section') {
      return workspaceFrameRoot(sheetHost);
    }
    if (consoleState.sheet !== undefined && workspaceStackTopAxis() !== 'section') {
      return sheetTitle.value;
    }
    if (shell.placementActive) {
      // Same source as the right panel's kicker — the bar and the panel can
      // never disagree about what this cell pick puts down.
      return shell.placementKickerKey;
    }
    if (consoleState.sale.active) {
      return 'Sell patents';
    }
    // A SECTION standing as a STEP of another flow reads as its HOST: the
    // player is inside «СТАНДАРТНЫЕ ПРОЕКТЫ», picking a colony — the bar
    // saying «ТОРГОВЛЯ» beside a breadcrumb that says otherwise is the one
    // place the two voices could contradict each other. (The crumb still
    // carries the full path; the bar carries only where the player IS.)
    const sectionHost = consoleState.section === 'colonies' ? workspaceFrameHost('colonies') :
      consoleState.section === 'hand' ? workspaceFrameHost('hand') :
        consoleState.section === 'hydro' ? workspaceFrameHost('hydro') :
          consoleState.section === 'parliament' ? workspaceFrameHost('parliament') : undefined;
    if (sectionHost !== undefined) {
      // …and a step hosted by a workspace that is itself a scene guest (the
      // Reds' discard inside the action workspace inside the Parliament)
      // reads the same root as the crumb: the outermost screen.
      const grandHost = workspaceFrameHost(sectionHost);
      if (grandHost !== undefined && workspaceHostYieldsScene(grandHost)) {
        return workspaceFrameRoot(grandHost);
      }
      return workspaceFrameRoot(sectionHost);
    }
    switch (consoleState.section) {
    case 'hand': return 'Hand';
    case 'colonies': return 'Trading';
    case 'hydro': return 'Mars Hydronetwork';
    case 'parliament': return 'Parliament';
    default:
      if (consoleState.scaleInspecting) {
        return 'Scale inspection';
      }
      return consoleState.inspecting ? 'Board inspection' : 'Board';
    }
  });

  const commands = computed((): Array<ConsoleCommand> => {
    // SYSTEM ALERT owns the pad — the bar advertises only the acknowledge.
    if (consoleSystemAlertState.current !== undefined) {
      return [{control: 'confirm', label: 'OK'}];
    }
    // TRADE-FLEET LAUNCH / TRADE REWARDS / HYDRO MARKER / BOARD CARD-BONUS /
    // PATENT SALE / TILE-PLACEMENT HERO / DECK DRAW: the animation owns the
    // moment — the pad is inert, the bar advertises nothing (bounded, plays
    // itself out). The trade-reward gate is PHASE-aware: it frees the pad
    // for the reveal take and for a Pluto discard between bonus draws.
    if (isTradeFleetActive() || isColonyTradeInputLocked() || isHydroMarkerActive() || isBoardCardBonusActive() || isPatentSaleActive() || shell.tilePlacementHolds || isDeckDrawActive()) {
      return [];
    }
    // (A CITY LANDING ON A COLONY TILE (TR22) and its homing beat used to blank the bar here. The pad is still the
    // scene's — the input routing absorbs it — but the bar now speaks the colony acts' ONE status grammar below:
    // «Выполняется…» on the stage past the press, «Выполнено» while the grid stands as the receipt.)
    // THE STAGED RITUAL (T15 · CD): the card lands on its stack BEFORE the board and nothing is sent — A has nothing to
    // do (the cell is the next press), and B is offered for what it is: back to the card, OWED to the ritual's end
    // and shown as the return once pressed. Above the played-hero quiet below: that quiet is for a play whose commit
    // is made; this one's is still ahead, and a bar with no verb is where the stand found the B being lost.
    if (shell.stagedLandingInFlight) {
      return [
        {control: 'confirm', label: 'Going to the board…', enabled: false},
        shell.stagedBackOwed ? {control: 'back', label: STAGED_BACK_OWED, enabled: false} : {control: 'back', label: 'Back to the card'},
      ];
    }
    // The played-card hero scene: the bar goes quiet — the card is the
    // whole story (a press during the result beat quietly skips ahead).
    // …except the STAGED hand-off's tail: the board already holds the staged pick, and its own verbs speak (T15 · CD).
    if (shell.playedHeroHolds && shell.placementStagedBar === undefined) {
      return [];
    }
    // «Разбор хода» review: X inspect the played card, L3 show on map, B
    // close. While the fullscreen viewer is up its OWN footer carries the
    // contract; during a peek B returns to the review.
    if (botTurnReviewState.open && consoleCardZoom.card === undefined) {
      if (botTurnReviewState.peek) {
        return [{control: 'back', label: 'Back'}];
      }
      const cmds: Array<ConsoleCommand> = [];
      if (shell.reviewInspectable) {
        cmds.push({control: 'secondary', label: 'Inspect card'});
      }
      if (shell.reviewMapSpaces.length > 0) {
        cmds.push({control: 'stickL', label: 'Show on map'});
      }
      cmds.push({control: 'back', label: 'Close'});
      return cmds;
    }
    // PRESENTATION FLOW: a visible toast (incl. the compact AI-turn card)
    // deliberately does NOT re-label the bar — the bar keeps the CURRENT
    // screen's contract, and the card carries its own hints
    // («зажать X Осмотреть ход» · «B Закрыть» in .con-notif__actions).
    // Scale-focus hold: an inert transition beat — no command hints.
    if (govScaleFocusState.holding || govScaleFocusState.closing) {
      return [];
    }
    // …and so is a series' visit between two questions (PC04 · GS): every press is absorbed, no verb is promised.
    if (shell.seriesHeld !== undefined) {
      return [];
    }
    // THE EXTERNAL-DRAW WORKSPACE mirrors its live contract — ABOVE the
    // fallback branch on purpose: `fallbackActive` is STICKY (it is only
    // re-derived when a press falls through to the scope resolver, and the
    // plate's A is consumed before that line), so a stale `true` latched on
    // the loading screen would dress a locked workspace's bar as a generic
    // «Выбрать/Назад» until the first in-workspace press.
    if (shell.externalDrawOwnsPad) {
      return [...(panelCommands('externalDraw') ?? [])];
    }
    if (consoleState.fallbackActive) {
      return [
        {control: 'confirm', label: 'Select'},
        {control: 'back', label: 'Back'},
      ];
    }
    // THE FINAL SCORING WORKSPACE owns the screen while its scene shows —
    // its bar contract follows the ceremony phase (the one labelled skip
    // verb while the count runs, the action-list verbs once it settles).
    // COLLAPSED it owns nothing: the bar falls through to whatever surface
    // the free roam is standing on, and the board home appends the one verb
    // that leads back (see the board `home` run below).
    if (shell.endgameStageUp) {
      return [...(panelCommands('endgame') ?? [])];
    }
    // LT INFORMATION MODE — the dashboard publishes its live contextual
    // contract (players / detail tabs / VP) through consolePanelUi; the
    // bar is its ONE hint surface (the old in-panel footer is gone).
    if (infoModeState.open) {
      return [...(panelCommands('infoMode') ?? [{control: 'inspect', label: 'Close'}])];
    }
    // A draft beat (hero landing / the research rise) owns the moment —
    // the bar advertises only the skip (any button skips).
    if (draftPickBeatActive() || riseSceneEngaged()) {
      return [{control: 'confirm', label: 'Skip'}];
    }
    if (shell.draftWaitActive && shell.draftTrayMounted) {
      // The pre-game POPOVER path only: nothing to decide — the board stays
      // inspectable while others pick. (The between-generations wait is the
      // WORKSPACE's own stage; its contract arrives via consoleDraftUi.)
      const cmds: Array<ConsoleCommand> = [];
      if (shell.draftedCards.length > 0) {
        cmds.push({control: 'secondary', label: 'Inspect'});
      }
      cmds.push({control: 'inspect', label: 'Information'});
      return cmds;
    }
    if (shell.consoleRevealMode !== undefined) {
      // The command bar is the SINGLE hint zone for the reveal (the overlay
      // has NO footer of its own — B never reads two conflicting labels).
      // Single-card drawn is fullscreen (the dialog covers the bar), so this
      // is the multi-card modal / result / viewer contract.
      const cmds: Array<ConsoleCommand> = [];
      if (shell.consoleRevealMode === 'drawn' && settlementTable.focusSealed > 0) {
        // THE CURSOR READS A SEALED PLACE (the owner's decision: focusable, read-only). There is no card to take
        // or inspect yet — the server has not drawn it — so the bar promises no verb; the status line under the
        // table reads the seal's condition. Moving on is the only thing to do here.
        cmds.push({control: 'dpadH', label: 'Navigate'});
      } else if (shell.consoleRevealMode === 'drawn') {
        const ev = currentRevealEvent();
        // ONE pure builder, shared with the EMBEDDED host (the action
        // workspace's outcome stage) — the same component and the same input
        // handler must never advertise two different contracts. A colony
        // bonus that still owes its discard (Pluto) closes INSIDE the modal:
        // once everything is taken, A is that step and there is no take-all /
        // dismiss left to advertise — the step is mandatory.
        cmds.push(...drawnRevealCommandRun({
          closer: shell.revealDiscardCloser,
          hasCardSource: ev?.source?.type === 'card',
          // A cell source is shown on the board by L3 — only in the standalone SCENE (a workspace stands its own).
          hasCellSource: ev?.source?.type === 'tile' && ev.source.spaceId !== undefined && shell.revealEmbedTarget === undefined,
          peeking: revealSourcePeekState.cell !== undefined,
          hasDiscards: ev?.sequence?.some((step) => !step.matched) === true,
          multi: ev !== undefined && ev.cards.length - ev.takenIndices.size > 1,
          autoDiscarded: ev !== undefined && ev.cards.some((_c, i) => !ev.takenIndices.has(i)) &&
            ev.cards.every((c, i) => ev.takenIndices.has(i) || ev.autoDiscarded?.includes(c.name) === true),
        }));
      } else if (shell.consoleRevealMode === 'viewer') {
        cmds.push({control: 'secondary', label: 'Inspect'});
        cmds.push({control: 'back', label: 'Close'});
      } else {
        // result: A = OK, X = inspect the REVEALED card, L3 = inspect the
        // SOURCE (acting) card — the same X/L3 idiom as the drawn reveal.
        cmds.push({control: 'confirm', label: 'OK'});
        cmds.push({control: 'secondary', label: 'Inspect'});
        cmds.push({control: 'stickL', label: 'Source'});
      }
      return cmds;
    }
    // …but NOT while the workspace is hosting the play-from-hand step: the
    // player is browsing a real hand, so the bar must carry the HAND's
    // contract (A разыграть · X осмотреть · LB/RB фильтр · B назад), not the
    // deployment's. The scene's own verbs would advertise presses that do
    // nothing on the surface actually in front of the player.
    // Same for the hosted COLONIES step — the colony grid's contract leads.
    // Same for the YIELD to a board placement — the board is the surface.
    // DRAW & SELECT publishes its own contract, and publishes an EMPTY one
    // through its outgoing beats on purpose: the bar must not advertise a
    // verb the surface is swallowing while the cards fly to the dock. Ahead
    // of the start scene for the same reason the pad routing is.
    if (shell.deckPickServing) {
      return [...(panelCommands('deckPick') ?? [])];
    }
    if (shell.draftWorkspaceOwnsPad) {
      // The workspace publishes its live contract (consoleDraftUi); the bar
      // mirrors it verbatim so it can never diverge from the buttons.
      return consoleDraftUi.commands.length > 0 ?
        [...consoleDraftUi.commands] :
        [{control: 'back', label: 'Minimize'}];
    }
    if (shell.startSceneOwnsPad) {
      // The scene publishes its live contract (consoleStartUi — wizard step
      // vs. summary vs. ceremony: X inspects, RT continues / begins, etc.);
      // the bar mirrors it verbatim so it can never diverge from the buttons
      // (the old hard-coded list wrongly showed X = «Продолжить» and hid RT).
      // ⚠️ THE SAME QUESTION AS THE PAD, deliberately: reading `startSceneServes`
      // here instead is what printed «A РАЗЫГРАТЬ · X ОСМОТРЕТЬ · B СВЕРНУТЬ»
      // over a live payment the queue could not take — the bar belongs to the
      // surface the player is driving, and the branches below name it.
      return consoleStartUi.commands.length > 0 ?
        [...consoleStartUi.commands] :
        [
          {control: 'confirm', label: 'Select'},
          {control: 'secondary', label: 'Inspect'},
          {control: 'back', label: 'Minimize'},
        ];
    }
    if (shell.govSupportActive && !consoleState.task.deferred && shell.taskSpacePending === undefined) {
      // The panel publishes its context-aware contract (consolePanelUi) —
      // the bar is the ONE hint surface (the in-panel footer is gone).
      return [...(panelCommands('govSupport') ?? [
        {control: 'confirm', label: 'Apply'},
        {control: 'back', label: 'Minimize'},
      ])];
    }
    if (shell.productionLossActive && !consoleState.task.deferred && shell.taskSpacePending === undefined) {
      return [...(panelCommands('productionLoss') ?? [
        {control: 'confirm', label: '−1'},
        {control: 'bumperL', label: '+1'},
        {control: 'secondary', label: 'Confirm'},
        {control: 'back', label: 'Minimize'},
      ])];
    }
    // The dedicated composite surfaces publish their own contracts; the
    // fallbacks below only ever show for the frame before the watcher runs.
    if (shell.spendHeatActive) {
      return [...(panelCommands('spendHeat') ?? [{control: 'secondary', label: 'Pay'}, {control: 'back', label: 'Minimize'}])];
    }
    if (shell.botAttackActive) {
      return [...(panelCommands('botAttack') ?? [{control: 'confirm', label: 'Choose the target'}, {control: 'back', label: 'Minimize'}])];
    }
    if (shell.venusBonusActive) {
      return [...(panelCommands('venusBonus') ?? [{control: 'secondary', label: 'Collect'}, {control: 'back', label: 'Minimize'}])];
    }
    if (shell.aresGlobalsActive) {
      return [...(panelCommands('aresGlobals') ?? [{control: 'secondary', label: 'Apply'}, {control: 'back', label: 'Minimize'}])];
    }
    if (shell.effectDecisionActive) {
      return [...(panelCommands('effectDecision') ?? [])];
    }
    if (shell.finalGreeneryActive) {
      // The beat between «the finale stands open» and the board taking the pick (the watcher hands it over in the
      // same flush): the finale's own verbs, never the host's.
      return [finalGreeneryFinishCommand(), {control: 'back', label: 'Minimize'}];
    }
    if (shell.hostTask !== undefined && !consoleState.task.deferred && shell.taskSpacePending === undefined && !shell.handPickActive) {
      // The task host publishes its live contract (browse / pick / lanes /
      // payment differ) — the bar renders it; no in-frame footer anymore.
      return [...(panelCommands('taskHost') ?? [
        {control: 'confirm', label: 'Select'},
        {control: 'secondary', label: 'Confirm'},
        {control: 'back', label: shell.pendingClientPayment !== undefined || shell.pendingClientPick !== undefined ? 'Cancel' : 'Minimize'},
      ])];
    }
    // A NESTED target pick standing over the repeat browser (the same-kind
    // nesting law: the browser's composer opened the blockade/espionage
    // pick over itself) — the DEEPEST surface names the bar, one voice
    // with the pad routing's depth tiebreak.
    if (shell.repeatPickActive &&
        (isDeltaBlockadePickActive() || isDeltaEspionagePickActive()) &&
        workspaceFrameIndex('hydro') > workspaceFrameIndex('repeat-pick')) {
      return consoleHydroUi.commands.length > 0 ?
        [...consoleHydroUi.commands] :
        [{control: 'confirm', label: 'Select'}, {control: 'back', label: 'Back'}];
    }
    // The STAGE-REWARD pick owns the pad wherever it was opened from (the
    // action composer, the play composer's espionage owner rows, a repeat
    // browser's landing pre-select) — the bar mirrors the pad precedence
    // and reads the SAME store the section branch does, or it advertises
    // the covered composer's verbs over the track the player is driving.
    // ⚠️ EXCEPT while the repeat browser stands DEEPER than the pick's own
    // hydro frame (the reward pick OPENED the browser): the browser owns
    // the pad, so it owns the bar.
    if (isDeltaRewardPickActive() && (!shell.repeatPickActive ||
        workspaceFrameIndex('hydro') > workspaceFrameIndex('repeat-pick'))) {
      return consoleHydroUi.commands.length > 0 ?
        [...consoleHydroUi.commands] :
        [{control: 'confirm', label: 'Select'}, {control: 'back', label: 'Back'}];
    }
    // The REPEAT-ACTION pick surface owns the pad (the source composers are
    // hidden): it publishes its live contract (the grid «Выбрать» or the
    // nested composer's own verbs) to its DEDICATED store — unstealable,
    // never the shared cardActions slot the outer Viron composer may own.
    if (shell.repeatPickActive) {
      return consoleRepeatPickUi.commands.length > 0 ?
        [...consoleRepeatPickUi.commands] :
        [{control: 'confirm', label: 'Select'}, {control: 'back', label: 'Cancel'}];
    }
    // A composer's CLIENT HAND PICK owns the pad (the composers are hidden):
    // the pick verbs mirror the mandatory hand-select grammar, with B as a
    // plain «Назад» to the composer (nothing is lost).
    if (shell.handPickActive) {
      const focusName = shell.handEntries[consoleState.handIndex]?.card.name;
      const canPick = focusName !== undefined && shell.handSelectSelectableNames.includes(focusName);
      const verb = shell.handSelectVerb;
      const n = consoleHandPickState.selected.length;
      const cmds: Array<ConsoleCommand> = [];
      if (shell.handSelectSingle) {
        cmds.push({control: 'confirm', label: verb, enabled: canPick});
        // THE DECLINE of an optional pick — a button, repeated by the plate in the album's question line.
        const decline = shell.handPickDeclineLive ? consoleHandPickState.request?.decline : undefined;
        if (decline !== undefined) {
          cmds.push({control: 'triggerR', label: typeof decline.label === 'string' ? decline.label : translateMessage(decline.label), priority: 1});
        }
        // …and «decide after the draw» of a table question that may wait (2026-10-15) — R3, its plate beside.
        const defer = shell.handPickDeferLive ? consoleHandPickState.request?.defer : undefined;
        if (defer !== undefined) {
          // The bar's SHORT form («После добора» — the plate above says it whole, with who draws): a tight fhd bar
          // keeps it beside the decline instead of dropping it.
          cmds.push({control: 'stickR', label: 'After the draw', priority: 1});
        }
      } else {
        cmds.push({control: 'confirm', label: 'Select / Deselect', enabled: canPick});
        // R3 = select all / unselect all (L3 is the SOURCE on every contextual surface — the two once shared L3,
        // and the source always won: 2026-10-14, the owner's Public Plans report).
        // A multi pick's «select all» has no other home (no plate repeats it), so it outranks the generic hints the
        // way the decline does: with the filter's LT beside it the fhd / 4K bar overflowed by a few rem and the fit
        // dropped R3 FIRST (a stick hint) — the one verb a «discard every requirement card» play is for (TR65).
        cmds.push({control: 'stickR', label: shell.pickAllSelected ? 'Unselect all' : 'Select all', priority: 1});
        // With nothing picked an optional pick's RT is its DECLINE; from the first pick on it confirms the set.
        // A `min 0` pick with no decline of its own says the refusal in words at zero («Ничего не сбрасывать» — never
        // the verb with a badge of 0, PL-259); from the first pick on it is the verb with its count.
        const decline = shell.handPickDeclineLive ? consoleHandPickState.request?.decline : undefined;
        const bounds = consoleHandPickState.request ?? {min: 1, max: 1};
        cmds.push(decline !== undefined ?
          {control: 'triggerR', label: typeof decline.label === 'string' ? decline.label : translateMessage(decline.label), priority: 1} :
          {control: 'triggerR', ...multiPickConfirmCommand(verb, bounds, n)});
      }
      // The universal verb (X inspects the current object on every surface) yields FIRST when the bar overflows:
      // the pick's own verbs (A · R3 · RT · the filter's LT) have no other home, and at 4K with four picks the fit
      // was dropping the filter's hint while «Осмотреть» stood (TR65, PL-618).
      cmds.push({control: 'secondary', label: 'Inspect', priority: 3});
      // X inspects the card under the cursor, so the EFFECT that sent the
      // player here needs its own verb — never make them guess the context.
      if (shell.contextualSourceKnown) {
        // The SHORT form of the source verb («L3 Источник» — the console-wide inspection grammar's own word): the long
        // «Осмотреть источник» was the widest verb of a bar that overflows by a few rem with the multi pick's R3, the
        // refusal's words and the filter's LT beside it — and the fit drops the widest of a priority first (TR65, PL-618).
        cmds.push({control: 'stickL', label: 'Source', priority: 1});
      }
      if (shell.handSelectFiltered) {
        cmds.push({control: 'triggerL', label: shell.handSelectSuitableOnly ? 'All cards' : 'Only suitable'});
      }
      cmds.push({control: 'back', label: consoleHandPickState.request?.backLabel ?? 'Back'});
      return cmds;
    }
    // A HYDRO FRAME OVER THE HAND (the espionage pick, the espionage EXECUTION) is the surface the pad drives
    // (`handCoveredByHydro` — the routing's own term), so it names the bar: the covered composer's verbs read over
    // the track's result while A on «Продолжить» went to that composer and posted the play again (2026-10-23).
    if (shell.handCoveredByHydro) {
      return consoleHydroUi.commands.length > 0 ?
        [...consoleHydroUi.commands] :
        [{control: 'back', label: 'Back'}];
    }
    // …unless the composer has LET GO of the bar (PL-084): a hosted step is rising out of its rect while it
    // fades, its frame already past the commit — the bar then reads the STEP's own contract below, never the
    // composer's verbs over a surface that accepts none of them.
    if (shell.pendingPlayCard !== undefined && !consolePlayCardUi.released) {
      // The composer publishes its CONTEXTUAL controls (A plays / Y changes a
      // resolved choice / X inspects / LB·RB only where a value dials / LT
      // only when the payment is configurable) — the bar mirrors them
      // verbatim, so it can never diverge from what the buttons actually do.
      return consolePlayCardUi.commands.length > 0 ?
        [...consolePlayCardUi.commands] :
        [{control: 'confirm', label: 'Play now'}, {control: 'back', label: 'Cancel'}];
    }
    if (shell.colonyFocusOpen && colonyFocusState.dock !== '') {
      // THE FLEET-DOCK STAGE publishes its ONE primary verb (A selects a path,
      // opens the payment, or trades) — the bar reads it, never guesses.
      // PAST THE PRESS the stage is a beat in flight (the card answers, the reward lands, the workspace leaves):
      // the bar is the colony acts' ONE status, never «Торговать · Осмотреть · Назад» gone inert (PL-018).
      if (fleetDockUi.answered) {
        return [{control: 'confirm', label: 'Performing…', enabled: false}];
      }
      // The R3 «Эффекты» LAYER owns the bar while it is open — the explorer's own contract, verbatim (the
      // composers' rule; PL-060).
      if (fleetDockUi.forecastOpen) {
        return [...(forecastExplorerUi('dock').barCommands ?? [])];
      }
      if (fleetDockUi.sub === 'lanes') {
        return [
          {control: 'triggerR', label: 'Max'},
          {control: 'confirm', label: 'Done', enabled: fleetDockUi.primaryEnabled},
          {control: 'back', label: 'Back'},
        ];
      }
      // The reward's TARGET STEP (TR27): the shared selector's own grammar — A chooses, X inspects the focused
      // candidate, B returns to the trade with everything intact.
      if (fleetDockUi.sub === 'targets') {
        return [
          {control: 'confirm', label: 'Select'},
          {control: 'secondary', label: 'Inspect'},
          {control: 'back', label: 'Back'},
        ];
      }
      // THE COLONY TRADE'S GRAMMAR (the owner, 2026-10-25 — a dock is one more direction of the trade): the Delta
      // Works mix dials on the bumpers and X trades; on the rows A SELECTS, X trades, L3 lifts the card itself into
      // the viewer (unless the trade came through a card's door — then L3 is that SOURCE, the shell's own branch).
      if (fleetDockUi.sub === 'mix') {
        return [
          {control: 'bumperL', control2: 'bumperR', label: 'Payment mix', priority: 2},
          {control: 'secondary', label: 'Confirm trade', enabled: fleetDockUi.confirmEnabled, highlight: fleetDockUi.confirmEnabled},
          {control: 'back', label: 'Back'},
        ];
      }
      return [
        {control: 'confirm', label: fleetDockUi.primaryLabel, enabled: fleetDockUi.primaryEnabled},
        {control: 'secondary', label: fleetDockUi.confirmLabel, enabled: fleetDockUi.confirmEnabled, highlight: fleetDockUi.confirmEnabled},
        shell.contextualSourceKnown ?
          {control: 'stickL' as const, label: 'Source'} :
          {control: 'stickL' as const, label: 'Inspect card'},
        // R3 — the «Эффекты» layer (the table's answer to the reward), only when the forecast has something to show.
        ...(fleetDockUi.forecastAvailable ? [{control: 'stickR' as const, label: 'Effects'}] : []),
        {control: 'back', label: 'Back'},
      ];
    }
    if (shell.colonyFocusOpen) {
      // The COLONY FOCUS STAGE mirrors its live state (consoleColoniesUi) —
      // the bar is the ONLY hint surface (no inline duplicates). The verbs
      // follow the INTENT: trade = rows + the one X confirm; build / pick =
      // A IS the confirm (nothing else to choose); inspect = B only.
      // The R3 «Эффекты» LAYER owns the bar while it is open — the explorer's own contract, verbatim (the
      // composers' and the dock stage's rule; PL-066).
      if (consoleColoniesUi.forecastOpen) {
        return [...(forecastExplorerUi('colony').barCommands ?? [])];
      }
      // THE VENUS BONUS'S INNER STEP of a trade (P89 · EM): the step's own bar — the ONE pure reading every host shows.
      if (consoleColoniesUi.composerSub === 'venus') {
        return [...consoleColoniesUi.composerVenusBar];
      }
      if (consoleColoniesUi.composerSub === 'lanes') {
        return [
          {control: 'triggerR', label: 'Max'},
          {control: 'confirm', label: 'Done'},
          {control: 'back', label: 'Back'},
        ];
      }
      // The Delta Works COMPOSITION substep: the dial, the same final
      // trade confirm, and B back to Configure. Nothing else.
      if (consoleColoniesUi.composerSub === 'mix') {
        return [
          {control: 'bumperL', control2: 'bumperR', label: 'Payment mix', priority: 2},
          {control: 'secondary', label: 'Confirm trade', enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
          {control: 'back', label: 'Back'},
        ];
      }
      if (consoleColoniesUi.composerSub === 'list') {
        return [
          {control: 'confirm', label: 'Select'},
          // An optional list's refusal is RT (the plate in its question line repeats it), never a row.
          ...(consoleColoniesUi.composerDecline !== '' ? [{control: 'triggerR' as const, label: consoleColoniesUi.composerDecline, priority: 1}] : []),
          {control: 'back', label: 'Back'},
        ];
      }
      // The embedded played-card TARGET step (the trade reward's host card):
      // the shared selector's own grammar — A chooses, X inspects the focused
      // candidate fullscreen, B returns to the trade with everything intact.
      if (consoleColoniesUi.composerSub === 'targets') {
        return [
          {control: 'confirm', label: 'Select'},
          {control: 'secondary', label: 'Inspect'},
          {control: 'back', label: 'Back'},
        ];
      }
      const intent = colonyFocusState.intent;
      // PAST THE PRESS of the player's own colony act (a card's build, a roster change, a city on the tile, a chosen
      // track) the stage is a beat in flight: the bar is a STATUS, never the stage's verbs gone inert.
      if (shell.colonyActAnswered) {
        return [{control: 'confirm', label: 'Performing…', enabled: false}];
      }
      if (intent === 'inspect') {
        // THE DOSSIER: A goes ON into the act the grid's A would have
        // opened — «К торговле» — ALWAYS enabled: the dossier does not
        // validate the act, the stage does (its verdict stands in the
        // dossier's act block as information). B folds back to the grid.
        // Nothing on the dossier submits.
        const act = shell.colonyInspectAct;
        return [
          {control: 'confirm', label: act.label, highlight: true},
          {control: 'back', label: 'Back'},
        ];
      }
      if (intent === 'roster') {
        // THE ROSTER ACT's stage: A is the confirm — «Разыграть карту» on the staged door (it IS the play's one
        // submit), the act's own verb on a live one («Заменить плитку» / «Добавить плитку» / «Убрать плитку»);
        // L3 the source card; B one level back. Past the press the ceremony owns the pad.
        const staged = shell.colonyPick?.staged === true;
        return [
          {control: 'confirm', label: staged ? 'Play card' : (shell.colonyPick?.labelKey ?? 'Select'),
            enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
          ...(shell.colonyEmbedHasSource ? [{control: 'stickL' as GlyphControl, label: 'Source'}] : []),
          {control: 'back', label: 'Back'},
        ];
      }
      if (intent === 'build') {
        // A BUILD THAT COMPOSES speaks the trade's grammar: its placement
        // bonus needs a card, so A opens that decision and X commits. With
        // nothing to decide it keeps the single-verb «A Построить».
        // A STAGED door (a card that builds by being played — TR25): the commit IS the play's one submit, so it
        // speaks the play's verb, and L3 reads the source card.
        const stagedBuild = shell.colonyPick?.staged === true;
        const verb = stagedBuild ? 'Play card' : 'Build';
        const source = stagedBuild && shell.colonyEmbedHasSource ?
          [{control: 'stickL' as GlyphControl, label: 'Source'}] : [];
        // R3 — the «Эффекты» layer (the table's answer to the build), only when the forecast has something to show.
        const effects = consoleColoniesUi.forecastAvailable ? [{control: 'stickR' as GlyphControl, label: 'Effects'}] : [];
        if (consoleColoniesUi.composerDecisions) {
          return [
            {control: 'confirm', label: 'Select', enabled: consoleColoniesUi.composerEditable},
            {control: 'secondary', label: verb, enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
            ...source,
            ...effects,
            {control: 'back', label: 'Back'},
          ];
        }
        return [
          {control: 'confirm', label: verb, enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
          // A CARD's own build door with nothing to compose: X reads the colony's dossier (the staged acts' grammar).
          ...(shell.colonyPick?.buildProjected === true ? [{control: 'secondary' as GlyphControl, label: 'Inspect'}] : []),
          ...source,
          ...effects,
          {control: 'back', label: 'Back'},
        ];
      }
      if (intent === 'pick') {
        return [
          {control: 'confirm', label: shell.colonyPick?.labelKey ?? 'Select', enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
          {control: 'back', label: 'Back'},
        ];
      }
      if (intent === 'track') {
        // A CHOSEN TRACK's stage (TR07): A is the confirm — «Разыграть карту» on the staged door (it IS the
        // play's one submit), the server's verb on a live one; X reads the colony's dossier; L3 the source card.
        const staged = shell.colonyPick?.staged === true;
        return [
          {control: 'confirm', label: staged ? 'Play card' : (shell.colonyPick?.labelKey ?? 'Select'),
            enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
          {control: 'secondary', label: 'Inspect'},
          ...(shell.colonyEmbedHasSource ? [{control: 'stickL' as GlyphControl, label: 'Source'}] : []),
          {control: 'back', label: 'Back'},
        ];
      }
      if (intent === 'city') {
        // A CITY ON THE CHOSEN TILE (TR22): A is the confirm — «Разыграть карту» on the staged door (it IS the play's
        // one submit), the server's verb on a live one; X reads the colony's dossier; L3 the source card.
        const staged = shell.colonyPick?.staged === true;
        return [
          {control: 'confirm', label: staged ? 'Play card' : (shell.colonyPick?.labelKey ?? 'Select'),
            enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
          {control: 'secondary', label: 'Inspect'},
          ...(shell.colonyEmbedHasSource ? [{control: 'stickL' as GlyphControl, label: 'Source'}] : []),
          {control: 'back', label: 'Back'},
        ];
      }
      if (intent !== 'trade' || !shell.colonyFocusTradeable) {
        // The dossier composition: B is the only verb.
        return [{control: 'back', label: 'Back'}];
      }
      // Configure: NO composition controls here (the dial lives on the
      // payment substep). With several valid mixes X is a GATEWAY — its
      // label says so instead of promising the final commit.
      return [
        {control: 'confirm', label: 'Select', enabled: consoleColoniesUi.composerEditable},
        {
          control: 'secondary',
          label: consoleColoniesUi.composerMixAdjustable ? 'Continue to payment' : 'Confirm trade',
          enabled: consoleColoniesUi.composerReady,
          highlight: consoleColoniesUi.composerReady,
        },
        // R3 — the «Эффекты» layer (the table's answer to the income), only when the forecast has something to show.
        ...(consoleColoniesUi.forecastAvailable ? [{control: 'stickR' as GlyphControl, label: 'Effects'}] : []),
        {control: 'back', label: 'Back'},
      ];
    }
    if (shell.colonyInspectModel !== undefined) {
      // The read-only JOURNAL colony dossier: B closes, nothing else.
      return [{control: 'back', label: 'Close'}];
    }
    if (consoleState.confirm !== undefined) {
      // The R3 «Эффекты» LAYER owns the bar while it is open — the explorer's own contract, verbatim (PL-394).
      if (effectForecastOpen('confirm')) {
        return [...(forecastExplorerUi('confirm').barCommands ?? [])];
      }
      // THE VERB NAMES THE OPERATION (PL-385): «Пас» — in the danger ink when the pass leaves something unused —
      // or «Конвертировать»; R3 only when the table's answer has something behind it.
      const pass = consoleState.confirm === 'pass';
      const risky = pass && shell.confirmWarnings.length > 0;
      return [
        pass ?
          {control: 'confirm', label: 'Pass', ...(risky ? {tone: 'danger' as const} : {highlight: true})} :
          {control: 'confirm', label: 'Convert', highlight: true},
        ...(!pass && forecastLayerAvailable(shell.confirmForecast) ? [{control: 'stickR' as GlyphControl, label: 'Effects'}] : []),
        {control: 'back', label: 'Cancel'},
      ];
    }
    if (shell.journalPanelVisible) {
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
    if (shell.corpFirstActionOpen) {
      // The MANDATORY corp first-action modal: A takes the action, X
      // inspects the corporation, LB/RB switches corps (Merger), B only
      // DEFERS to the amber chip (never a dismissal).
      const cmds: Array<ConsoleCommand> = [
        {control: 'confirm', label: 'Take first action', highlight: true},
        {control: 'secondary', label: 'Inspect'},
      ];
      if (shell.corpFirstActionNames.length > 1) {
        cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Corporation'});
      }
      cmds.push({control: 'back', label: 'Minimize'});
      return cmds;
    }
    if (shell.playedTableVisible) {
      // «Разыграно»: the CATEGORY grammar, honest to the overlay's live
      // mirrors (consolePlayedUi). The table navigates zones and A opens
      // the focused one; inside the category view A/X inspect a card and
      // B is a LOCAL back (the cards fly home, never the tableau closing);
      // mid-flight only B is live (it reverses the same flight).
      if (consolePlayedUi.categoryBusy) {
        return [{control: 'back', label: 'Back'}];
      }
      if (consolePlayedUi.categoryOpen) {
        // X = inspect (the universal read verb); A stays free — it is the
        // reserved pick verb for the future tableau-pick mode of this view.
        // An ALBUM's pages ride LB/RB — inside a category the seat is not switched (the owner, 2026-10-19).
        return [
          {control: 'secondary', label: 'Inspect'},
          ...(consolePlayedUi.pageCount > 1 ? [{control: 'bumperL', control2: 'bumperR', label: 'Browse'} as ConsoleCommand] : []),
          {control: 'back', label: 'Back'},
        ];
      }
      // The table is ONE page of stacks — no page verb at this level; LB/RB are the seat's.
      const cmds: Array<ConsoleCommand> = [];
      cmds.push({control: 'confirm', label: 'Open', enabled: consolePlayedUi.focusCategory !== ''});
      if (consolePlayedUi.canCyclePlayer) {
        cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Player'});
      }
      cmds.push({control: 'back', label: 'Close'});
      return cmds;
    }
    if (consoleState.quick !== undefined) {
      // The cross's slots carry their OWN glyphs + labels on screen — the
      // bar anchors the retreat plus the ONE affordance the wheel itself
      // cannot show: the opposite trigger switches wheels in place. In
      // FOCUS & CONFIRM the bar additionally leads with the mode's core
      // verb (A confirms whatever is focused — directions only navigate).
      const other: ConsoleCommand = consoleState.quick === 'actions' ?
        {control: 'triggerL', label: 'Basic actions'} :
        {control: 'triggerR', label: 'Actions'};
      if (wheelControlState.mode === 'focus-confirm') {
        return [{control: 'confirm', label: 'Select'}, other, {control: 'back', label: 'Close'}];
      }
      return [other, {control: 'back', label: 'Close'}];
    }
    if (consoleState.sheet === 'standardProjects' && workspaceStackTopAxis() !== 'section') {
      // A SECTION-projecting step standing inside (the sale's hand, the
      // colony pick) publishes its own contract — this branch yields to it
      // by DEPTH (the axis rule), exactly like the card-actions branch.
      //
      // A beat in flight advertises NOTHING: input is absorbed by phase, so
      // the bar must not promise verbs that cannot land. (The embedded
      // PAYMENT step never reaches here — the task-host branch above owns
      // the bar while a client payment is up.)
      if (!acceptsInput(workspaceFramePhase('standard-projects') ?? 'browse')) {
        return [];
      }
      // The R3 «Эффекты» LAYER owns the bar while it is open — the explorer's own contract, verbatim (PL-066).
      if (effectForecastOpen('stdp')) {
        return [...(forecastExplorerUi('stdp').barCommands ?? [])];
      }
      // One context-sensitive CTA belongs in the canonical command rail;
      // repeating it on every project card adds noise and weakens focus.
      const focused = shell.stdProjectItems[consoleState.sheetIndex];
      return [
        {
          control: 'confirm',
          label: focused?.key === 'sell-patents' ? 'Sell' : 'Select',
          enabled: focused?.available === true,
          highlight: focused?.available === true,
        },
        // R3 — the «Эффекты» layer (the table's answer to the focused project), only when it has something to show.
        ...(!shell.stdpStepUp && forecastLayerAvailable(focused?.preview?.forecast) ? [{control: 'stickR' as GlyphControl, label: 'Effects'}] : []),
        {control: 'back', label: shell.stdBackLabel},
      ];
    }
    if (consoleState.sheet === 'cardActions' && workspaceStackTopAxis() !== 'section') {
      // While the COMPOSER (setup / confirmation) is up, its dedicated
      // store is the authority — with an honest Confirm/Cancel fallback,
      // never the grid verbs (the shared-slot fallback once showed
      // Perform/Inspect/Close under a confirm).
      if (consoleActionComposerUi.open) {
        return consoleActionComposerUi.commands.length > 0 ?
          [...consoleActionComposerUi.commands] :
          [{control: 'confirm', label: 'Confirm'}, {control: 'back', label: 'Cancel'}];
      }
      // The Action Center grid publishes the live contract.
      return [...(panelCommands('cardActions') ?? [
        {control: 'confirm', label: 'Perform'},
        {control: 'secondary', label: 'Inspect'},
        {control: 'back', label: 'Close'},
      ])];
    }
    if (shell.maScreenKind !== undefined) {
      // The MA WORKSPACE. Detail stage open: A carries the REAL verb
      // (enabled only when the live waitingFor offers it — the stage names
      // the concrete blocker), B is one logical level. During the commit /
      // ceremony beats input is absorbed — the bar advertises nothing.
      if (maFocusState.open) {
        if (!maFocusAcceptsInput()) {
          return [];
        }
        // A TAKEN item is over — its stage reads history, and the bar offers no dimmed «Заявить» (FB).
        if (shell.maFocusItem?.takenBy !== undefined) {
          return [{control: 'back', label: 'Back'}];
        }
        // «› ОПЛАТА» (PL-1622): the shared payment contract — ↑↓ a source, ←→ / LB RB ±1, RT its MAX, A pays and
        // claims (ONE POST), B one level back to the detail (nothing sent).
        if (maFocusState.pay !== undefined) {
          return [
            {control: 'dpad', label: 'Navigate'},
            {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
            {control: 'triggerR', label: 'MAX'},
            {control: 'confirm', label: 'Pay', enabled: shell.maPayReady && shell.maFocusAvailable, highlight: shell.maPayReady, priority: 0},
            {control: 'back', label: 'Back'},
          ];
        }
        return [
          {control: 'confirm', label: shell.maScreenKind === 'milestones' ? 'Claim milestone' : 'Fund',
            enabled: shell.maFocusAvailable, highlight: shell.maFocusAvailable},
          {control: 'back', label: 'Back'},
        ];
      }
      // The OVERVIEW: ONE primary verb, and it is CONTEXTUAL — A on an item
      // whose action is genuinely offered names the INTENT («Заявить» /
      // «Спонсировать» — the press leads into that action's confirmation
      // stage), while a blocked / taken item honestly offers the reading
      // verb («Осмотреть» — A still opens every item; the stage explains).
      // A universal «Выбрать» promised the same thing for a dead race and a
      // live claim. Bumpers switch the category, B closes the workspace.
      const anyMa = shell.maScreenItems.length > 0;
      const focusedMa = shell.maScreenItems[consoleState.sheetIndex];
      const maIntent = focusedMa !== undefined && focusedMa.available && focusedMa.takenBy === undefined;
      return [
        {
          control: 'confirm',
          label: !maIntent ? 'Inspect' :
            shell.maScreenKind === 'milestones' ? 'Claim milestone' : 'Fund',
          enabled: anyMa,
          highlight: maIntent,
        },
        // The bumpers walk to the family's OTHER workspace; inside the start's hosted funding step that is a
        // lateral move off the mandatory task — not offered (see the input arm).
        ...(shell.awardStepHosted ? [] : [
          {control: (shell.maScreenKind === 'milestones' ? 'bumperR' : 'bumperL') as GlyphControl,
            label: shell.maScreenKind === 'milestones' ? 'Awards' : 'Milestones'},
        ]),
        {control: 'back', label: shell.awardFundingActive ? 'Minimize' : 'Close'},
      ];
    }
    if (consoleState.sheet !== undefined && workspaceStackTopAxis() !== 'section') {
      return [
        {control: 'confirm', label: 'Select'},
        {control: 'back', label: 'To the board'},
      ];
    }
    // THE FINALE CONTEXT WITHOUT A PICK (PL-303): the finish stands, disabled with its reason on the press (the
    // seat holds nothing to answer yet); B minimizes. The bar never flips to the board-home run mid-finale.
    if (shell.finaleSessionEngaged && !shell.placementActive) {
      return [{...finalGreeneryFinishCommand(), enabled: false}, {control: 'back', label: 'Minimize'}];
    }
    if (shell.placementActive) {
      // P21: the placement footer is CONTEXT-ONLY and one-line by
      // contract — LT/RT keep working globally (Info / Actions) but
      // never occupy this bar. The bar is the ONE home of every placement
      // verb (the panel renders no controller prompts at all); WHICH verbs
      // stand at each phase — and at each LEVEL of a move — is the pure
      // `placementCommands` (tilePlacement/placementCommands.ts, spec'd).
      return placementCommands({
        phase: placementFlowState.phase,
        twoStep: placementFlowState.twoStep,
        legal: shell.selectedCellLegal,
        cancellable: shell.placementCancellable,
        freeRoam: consoleState.freeRoam,
        sourceInspectable: shell.placementSourceInspectable,
        moveLevel: shell.placementMoveLevelNow,
        moveFamily: shell.placementMoveFamilyNow,
        finale: shell.finalGreeneryPickPending ? {finish: finalGreeneryFinishCommand()} : undefined,
        staged: shell.placementStagedBar,
      });
    }
    // THE CHIP ROW (FD) owns the bar while the cursor stands on it — in every album mode.
    if (consoleState.section === 'hand' && consoleState.filterFocus >= 0 && shell.handTagFilterOptions.length > 1) {
      return [
        {control: 'dpadH', label: 'Navigate'},
        {control: 'confirm', label: 'Apply filter'},
        {control: 'back', label: 'To the cards'},
      ];
    }
    if (consoleState.sale.active) {
      const n = consoleState.sale.selected.length;
      return [
        {control: 'confirm', label: 'Select'},
        {control: 'stickR', label: shell.saleAllSelected ? 'Unselect all' : 'Select all'},
        {control: 'secondary', label: 'Inspect'},
        {control: 'triggerR', label: 'Sell', enabled: n > 0, badge: n, highlight: n > 0, priority: 1},
        {control: 'back', label: 'Cancel'},
      ];
    }
    // PAST THE DISCARD'S PRESS THE BAR IS A STATUS (colony polish 1): the answer moves the prompt on while the
    // hand still stands for its own cinematic (the card seized, turned, carried to «СБРОШЕННЫЕ»), and for that
    // whole second the hand branch advertised the hand's BROWSE verbs — «A Разыграть · LT Фильтр · B На поле»
    // over a discard the player had just made (and the NEXT cycle's discard, raised by the same answer, must
    // not read as asked over the hand that is still leaving).
    if (consoleState.section === 'hand' && cardDiscardTransaction.active && cardDiscardTransaction.phase !== 'failed') {
      return [{control: 'confirm', label: 'Performing…', enabled: false}];
    }
    // MANDATORY hand SELECT — the pick verbs (no tag filter; the "suitable
    // only" toggle takes LT), submit on A (single) / RT (multi), B minimizes.
    if (shell.handSelectTaskActive && consoleState.section === 'hand') {
      const focusName = shell.handEntries[consoleState.handIndex]?.card.name;
      const canPick = focusName !== undefined && shell.handSelectSelectableNames.includes(focusName);
      const verb = shell.handSelectModel?.buttonLabel || 'Select';
      const n = consoleState.select.selected.length;
      const cmds: Array<ConsoleCommand> = [];
      if (shell.handSelectSingle) {
        cmds.push({control: 'confirm', label: verb, enabled: canPick});
      } else {
        cmds.push({control: 'confirm', label: 'Select / Deselect', enabled: canPick});
        // The server's own «select all» (`SelectCard.showSelectAll` — Public Plans' live play) rides R3, beside L3's source.
        if (shell.handSelectModel?.showSelectAll === true) {
          cmds.push({control: 'stickR', label: shell.taskAllSelected ? 'Unselect all' : 'Select all', priority: 1});
        }
        // At zero on a `min 0` pick RT is the refusal in words (PL-259), never the verb with a badge of 0.
        const bounds = {min: shell.handSelectModel?.min ?? 1, max: shell.handSelectModel?.max ?? 1};
        cmds.push({control: 'triggerR', ...multiPickConfirmCommand(verb, bounds, n)});
      }
      // The universal verb (X inspects the current object on every surface) yields FIRST when the bar overflows:
      // the pick's own verbs (A · R3 · RT · the filter's LT) have no other home, and at 4K with four picks the fit
      // was dropping the filter's hint while «Осмотреть» stood (TR65, PL-618).
      cmds.push({control: 'secondary', label: 'Inspect', priority: 3});
      if (shell.contextualSourceKnown) {
        // The SHORT form of the source verb («L3 Источник» — the console-wide inspection grammar's own word): the long
        // «Осмотреть источник» was the widest verb of a bar that overflows by a few rem with the multi pick's R3, the
        // refusal's words and the filter's LT beside it — and the fit drops the widest of a priority first (TR65, PL-618).
        cmds.push({control: 'stickL', label: 'Source', priority: 1});
      }
      if (shell.handSelectFiltered) {
        cmds.push({control: 'triggerL', label: consoleState.select.suitableOnly ? 'All cards' : 'Only suitable'});
      }
      // THE PICKER'S CHIPS (FD): ▲ from the top row enters the filter row — the triggers keep their select verbs.
      if (shell.handTagFilterOptions.length > 1) {
        cmds.push({control: 'dpadU', label: 'Filter', priority: 2});
      }
      cmds.push({control: 'back', label: 'Minimize'});
      return cmds;
    }
    // The HAND's own browse verbs — but never over an EMBEDDED colony step:
    // the colonies teleported into the hand's zone are DEEPER than it, and
    // `section` projects the deepest frame — so it already says 'colonies'
    // and this branch cannot fire over a colony grid. («A Разыграть» over a
    // colony pick was the lie a hand-written `!colonyEmbedActive` term used
    // to have to prevent, at every section-keyed branch, one at a time.)
    if (consoleState.section === 'hand') {
      const playable = shell.handEntries[consoleState.handIndex]?.playable === true;
      const cmds: Array<ConsoleCommand> = [
        {control: 'confirm', label: 'Play now', enabled: playable},
        {control: 'secondary', label: 'Inspect'},
      ];
      // The tag filter owns LT/RT (+ R3 reset) — shown only when there's a
      // real tag to filter by (more options than just "All"). This is the
      // ONE place these controls are advertised (no inline duplication).
      // Rendered as a spread prev/next hint: LT ◀ ФИЛЬТР ▶ RT. The PAGE
      // verbs (LB/RB) are deliberately NOT here: the bay spine carries
      // them beside the position it navigates — one action, one hint.
      if (shell.handTagFilterOptions.length > 1) {
        cmds.push({control: 'triggerL', control2: 'triggerR', label: 'Tag filter', spread: true});
        cmds.push({control: 'stickR', label: 'Reset filter', enabled: consoleState.handTagFilter !== 'all'});
      }
      // A LAW'S PLAY PICK (RX36): the album is a STEP of the law's stage — B is one level back to its slot.
      cmds.push({control: 'back', label: shell.playPickActive ? 'Back' : shell.shellTaskActive ? 'Minimize' : 'To the board'});
      return cmds;
    }
    if (consoleState.section === 'colonies') {
      // T4 pick mode: A = the server verb; B = cancel (marker) / minimize.
      // Standalone section AND the embedded step publish the SAME contract
      // (one grid, one grammar — only B's label differs: an embedded step
      // minimizes its host).
      const pick = shell.colonyPick;
      // THE GRID AS THE RECEIPT (a roster change, a city laid on a tile, a colony a card built — the section's ONE
      // `receiptOn` reading): the stage folded home, the grid states the result for one read — no cursor and no
      // verbs, so the bar states it too (a staged door's prompt outlives its answer, and by it the bar would still
      // offer «Выбрать · Осмотреть · Назад» over a grid that takes none of them).
      if (consoleColoniesUi.receipt) {
        return [{control: 'confirm', label: 'Completed', enabled: false}];
      }
      if (pick !== undefined) {
        // The overview SELECTS; the focus stage resolves — A's label says
        // where it goes, never pretends the commit happens here.
        return [
          // ONE VERB ON THE OVERVIEW. A always opens the focused colony's
          // detail stage — the action itself is performed THERE, with its
          // availability and its blocked reason on screen — so the label
          // names the press, not a destination it cannot promise
          // («К строительству» over a colony that refuses the build read as
          // a commitment). «Осмотреть» (X) is a DIFFERENT verb: it opens the
          // read-only dossier, never the act.
          {control: 'confirm', label: 'Select'},
          // X = «Осмотреть» — the DOSSIER (ConsoleColonyInspect): a read of
          // the colony, for ANY colony, whether or not the pick accepts it.
          // It is not a second name for A: A enters the act, X reads.
          {control: 'secondary', label: 'Inspect'},
          // The pick is OWED BY A CARD → the console-wide source verb.
          ...(shell.colonyEmbedHasSource ?
            [{control: 'stickL' as GlyphControl, label: 'Inspect the source'}] : []),
          // A STAGED door (TR07) is one reversible level: B walks back to the composer, nothing to minimize.
          // …and so is a replacement's RESERVE level: B walks back to «which tile leaves».
          {control: 'back', label: pick.staged === true || pick.roster?.outgoing !== undefined ? 'Back' : (shell.colonyCancellable ? 'Cancel' : 'Minimize')},
        ];
      }
      return [
        // A always ENTERS the focus stage — see the pick branch above: one
        // verb, one destination, and the stage owns both the action and the
        // reason it may be impossible.
        {control: 'confirm', label: 'Select'},
        // X = «Осмотреть» — the dossier, read-only, for any colony (a
        // blocked trade is a reason on the dossier, never a hidden verb).
        {control: 'secondary', label: 'Inspect'},
        ...(shell.colonyEmbedHasSource ?
          [{control: 'stickL' as GlyphControl, label: 'Inspect the source'}] : []),
        // B: «свернуть» is right for a step a COMMITTED host owns — the
        // decision stays live and the player is only going to look at the
        // board. A card-sourced TRADE is the opposite case: nothing is
        // committed, the step is one reversible level, and B walks back to
        // the variant that opened it. Promising «свернуть» there would name
        // a park that does not happen.
        {control: 'back',
          label: colonyTradeEntryLocked() ? 'Back' :
            (shell.colonyEmbedActive ? 'Minimize' : 'To the board')},
      ];
    }
    if (consoleState.section === 'hydro') {
      // The hydro WORKSPACE publishes its live command contract into its
      // dedicated store (per step / focus / phase) — the bar never guesses.
      return consoleHydroUi.commands.length > 0 ?
        [...consoleHydroUi.commands] :
        [{control: 'back', label: 'To the board'}];
    }
    if (consoleState.section === 'parliament') {
      // Same contract for the Parliament workspace (Turmoil Redux).
      return consoleParliamentUi.commands.length > 0 ?
        [...consoleParliamentUi.commands] :
        [{control: 'back', label: 'To the board'}];
    }
    // P27b: SCALE INSPECTION MODE — the bonus ring, B/R3 exit.
    if (consoleState.scaleInspecting) {
      return [
        {control: 'inspect', label: 'Information'},
        {control: 'back', label: 'To the board'},
        {control: 'stickR', label: 'Exit'},
      ];
    }
    // P27: BOARD INSPECTION MODE — strict cell traversal, B/L3 exit. TR67: X opens the face of the CARD that put the
    // focused tile there (the grammar «X — the current object»: in the inspection the cell's object is its tile, and
    // a tile's face is its card); a cell with no such card keeps X in the bar, refused, its reason as the label.
    if (consoleState.inspecting) {
      const source = shell.inspectedCellSourceCard;
      return [
        {control: 'secondary', label: source !== undefined ? 'Source card' : 'No source card', enabled: source !== undefined},
        {control: 'inspect', label: 'Information'},
        {control: 'back', label: 'To the board'},
        {control: 'stickL', label: 'Exit'},
      ];
    }
    // Board — the console home screen: the full stable command map.
    // The LB/RB hints moved INTO the right panel's Milestones/Awards
    // blocks (they sit right on the objects they open) — the freed slots
    // bring the Menu/System indicator back to the bar.
    const home: Array<ConsoleCommand> = [
      {control: 'inspect', label: 'Information'},
      {control: 'secondary', label: 'Played'},
      // The bar's badge is the SUM of the wheel it opens — all four
      // categories, same potential semantics — so the hint and the wheel can
      // never say different numbers. The HIGHLIGHT is the other question
      // («can I act right now»), and that one is legitimately turn-gated.
      {control: 'triggerR', label: 'Actions', badge: shell.wheelCountsTotal,
        // The glow invites only to what is worth doing; a count of actions with no effect alone reads white.
        highlight: shell.myTurn && shell.wheelCountsUseful > 0,
        ...(countTone(shell.wheelCountsTotal, shell.wheelCounts.futileCardActions) === 'neutral' ? {badgeTone: 'neutral' as const} : {})},
      // The SHORT hint key on purpose — the footer's centre bay (hand
      // dock) splits this richest set across two zones, and the full
      // «Базовые действия» is the one atom that fits neither; the LT
      // quick wheel itself keeps the full 'Basic actions' title.
      {control: 'triggerL', label: 'Basics'},
      {control: 'stickL', label: 'Inspect board'},
      {control: 'stickR', label: 'Scale inspection'},
      {control: 'view', label: 'Log'},
    ];
    // A pending mandatory decision is announced on the board home and opened
    // / returned-to with A (consoleMandatoryGate) — anchor its A verb in the
    // bar (A is otherwise free on the board home).
    if (shell.mandatoryAnnounceVisible) {
      home.unshift({control: 'confirm', label: shell.mandatoryAnnounceView.openLabel});
    }
    // THE POST-GAME INSPECTION: the SAME home run — every view verb on it
    // still works, and the two wheels are how «Колонии» and «Гидросеть» are
    // reached at all — plus the one verb that leads back to the results.
    // The wheels' dead tiles say why they are dead («партия завершена»),
    // which is this console's rule everywhere else; hiding them would make
    // the post-game a different screen instead of the same one, read-only.
    // (No `priority`: a `back` command is `keep: true` in the bar's fit
    //  model, so the road home survives every drop pass by construction —
    //  a priority number there would only read as «drop this first».)
    if (shell.postGameInspection) {
      return [...home, {control: 'back', label: 'Game results'}];
    }
    return home;
  });

  /** Rules blocks the availability panel restates in full (server keys). */
  /** The viewer's ARMED one-play effects (TR49 class) — the dock's chip beside its count. */
  const dockArmedEffects = computed((): ReadonlyArray<PresentedArmedEffect> => {
    // Through the class's flight holds: a spent effect stands until its token leaves, an armed one lands (TR49).
    return presentedArmedEffects(armedEffectsOf(shell.thisPlayer));
  });

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
  const activeTaskSummary = computed((): ConsoleTaskSummary | undefined => {
    // A CLIENT-built payment's prompt is NOT `waitingFor` (which still holds
    // the action menu) — hand the summary the real prompt + its source card.
    const client = shell.pendingClientPayment;
    if (client !== undefined) {
      return consoleTaskSummary(CLIENT_PAYMENT_TASK, shell.playerView, {
        prompt: client.input,
        sourceCard: client.cardName as CardName,
      });
    }
    if (shell.pendingClientPick !== undefined) {
      return consoleTaskSummary(CLIENT_PICK_TASK, shell.playerView, {prompt: shell.pendingClientPick.input});
    }
    // The RAW classification — deliberately NOT `hostTask ?? shellTask ??
    // startTask`: a prompt no console surface serves (a `composite` Venus
    // bonus / spend-heat, an `unknown` guard) is EXACTLY the case that used
    // to read «Ожидает решения» hardest, and it still deserves a name.
    const task = taskFor(shell.playerView);
    return task === undefined ? undefined : consoleTaskSummary(task, shell.playerView);
  });

  return {
    contextMode,
    contextOverlayMode,
    bannerText,
    sheetTitle,
    sheetRows,
    commandContext,
    commands,
    dockArmedEffects,
    activeTaskSummary,
  };
}

export type CommandBarController = ReturnType<typeof createCommandBarController>;
