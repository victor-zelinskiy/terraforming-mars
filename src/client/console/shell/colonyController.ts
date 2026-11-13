/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE COLONY CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {computed, nextTick as vueNextTick, ref, watch as vueWatch} from 'vue';
import {scopedState} from '@/client/console/session/scopedState';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {intakeBatchSources} from '@/common/models/CardDrawRevealModel';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {ColonyBonusCollectMeta, ColonyBonusDiscardMeta, SelectColonyModel} from '@/common/models/PlayerInputModel';
import {SubmitTicket} from '@/client/console/transport/gameTransport';
import {InputResponse} from '@/common/inputs/InputResponse';
import {displayNameForColor, participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleColoniesSection from '@/client/components/console/ConsoleColoniesSection.vue';
import {ConsoleColonyPick} from '@/client/components/console/consoleColoniesSectionTypes';
import {consoleParliamentUi, parliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {workspaceStackRootKind, resumeStackFromBoard, yieldedStackCards, enterWorkspace, goBoardHome, leaveWorkspace, pushWorkspaceFrame, setWorkspaceFramePhase, setWorkspaceFrameServes, setWorkspaceFrameStage, setWorkspaceFrameSubject, workspaceFrameHasNested, workspaceFrameIndex, workspaceFrameMounted, workspaceFramePhase, workspaceStackTop, workspaceFrameSubject, workspaceFrameAnchor, workspaceFrameHost, workspaceStepSourceCard, workspaceFrameKnown, workspaceFrameTarget, workspaceHostForStep, FrameAnchor, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {isCommitted} from '@/client/console/consoleWorkspaceFlow';
import {cardDiscardColonyBonus} from '@/client/console/cardDiscard/consoleCardDiscard';
import {COLONY_RESOLUTION_SERVES, COLONY_BONUS_ENTRY_WAIT_MS, ColonyResolutionSignals, armColonyBonusEntry, clearColonyBonusEntry, colonyBonusCollectOf, colonyBonusDiscardOf, colonyBonusCardPickOf, COLONY_BONUS_CYCLE_WAIT_MS, colonyBonusEntry, colonyBonusSequence, clearColonyBonusSequence, colonyResolutionColony, colonyRevealSourceOf, colonyResolutionEvidenceFor, colonyResolutionFocusIntent, colonyResolutionLiveFor, colonyResolutionUi, discardStageStrandedFor, noteColonyBonusCycleWaitOver, noteColonyBonusEntryWaitOver, noticeColonyBonusSequence, remoteColonyBonusPendingFor, resetColonyResolutionUi, setColonyDiscardStage} from '@/client/console/colonyTrade/colonyResolution';
import {colonyTradeEntryLocked} from '@/client/console/colonyTrade/colonyTradeEntry';
import {armSettlementTable, clearSettlementTable, settlementPairOf, settlementStageText, settlementTable} from '@/client/console/colonyTrade/settlementTable';
import {handRevealState} from '@/client/console/handDock/handRevealState';
import {isHandRevealEpisodeRunning, resetHandReveal, settledPaint} from '@/client/console/handDock/handRevealDirector';
import {armTradeFleet, isTradeFleetActive, tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {armColonyTrade, colonyTradeClaimsReveal, colonyTradeState, notifyColonyTradeTrackCommitted} from '@/client/console/colonyTrade/consoleColonyTrade';
import {ColonyTradeTargets} from '@/client/console/colonyTrade/colonyTradeModel';
import ConsoleColonyInspect from '@/client/components/console/ConsoleColonyInspect.vue';
import {consoleColoniesUi, resetConsoleColoniesUi, colonyFocusState, closeColonyFocus, openColonyFocus, resetColonyFocus, ColonyFocusIntent, colonyRailIsCatalog as railIsCatalog, colonyDockCursor, resetColonyDockCursor, colonyPickIntent, markColonyFocusCommitting} from '@/client/console/consoleColoniesModel';
import {FleetDockView, fleetDockViews} from '@/client/console/colonyTrade/fleetDockModel';
import {releaseFleetDockHoldWhenGone, endFleetDockScene, fleetDockSceneState} from '@/client/console/colonyTrade/fleetDockScene';
import type {FleetDockConfirmPayload} from '@/client/components/console/consoleFleetDockStageTypes';
import {buildTradeBatch, colonyBuildAsksCardTarget, colonyBuildDrawsCards, colonyOwnerBonusDrawsCards, colonyTradeAsksCardTargets, colonyTradeMayDrawCards, freeTradeFleets, stepResponse, tradeDestinationResponse, TradeStep} from '@/client/components/colonies/colonyTradePlan';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {colonyTradeReason} from '@/client/console/colonyTradeReason';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {ConsoleTask, taskFor, followUpStepStage} from '@/client/console/consoleTaskRouter';
import {sittingAskResolution} from '@/client/console/promptSource';
import {cardGrantOwedTo} from '@/client/console/cardGrantHost';
import {colonyResponse} from '@/client/console/taskResponses';
import {workspaceClaimsColonyRevealBatch, workspaceOutcomeClaimed, claimWorkspaceOutcome, markWorkspaceOutcomeArrivalDone, markWorkspaceOutcomeBeatDone, releaseWorkspaceOutcome, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {colonyBonusPayoutLive} from '@/client/console/colonyLedger/colonyBonusPayout';
import {cardReactionPending, hurryCardReactions} from '@/client/console/cardReaction/cardReactionDirector';
import {armColonyBuild, clearColonyBuildReceipt, colonyBuildAnswered, colonyBuildState, isColonyBuildActive, setColonyBuildHoming} from '@/client/console/colonyBuild/consoleColonyBuild';
import {buildSiteOf, nextBuildSlot} from '@/client/console/colonyBuild/colonyBerths';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleState, closeConsoleLayers} from '@/client/console/consoleRouter';
import {probeTick} from '@/client/console/probeTick';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {offTurnReason} from '@/client/console/offTurnReason';
import {findTradeColonyContext} from '@/client/console/turnIntents';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {motionMs} from '@/client/components/motion/motionTokens';
import {MandatoryBeat, acknowledgeMandatoryBeat} from '@/client/console/consoleMandatoryGate';
import {PromptSurface} from '@/client/console/consolePromptAdmission';
import {waitScreenHandoff} from '@/client/console/screenHandoff';
import {stagedPlayState, stagedColonyOf, stagedStepHost, clearStagedPlay} from '@/client/console/stagedPlay';
import type {StagedPlayArm} from '@/client/console/stagedPlay';
import type {StagedColonyModel} from '@/common/models/ActionPreviewModel';
import {clearColonyTrackMove, colonyTrackMoveAnswered, colonyTrackMoveFlow, playOwedColonyTrackMove, promiseColonyTrackMove} from '@/client/console/colonyTrade/colonyTrackMove';
import {trackMoveOf} from '@/client/console/colonyTrade/colonyTrackMoveModel';
import {clearColonyTrackRaise, colonyTrackRaiseFlow, colonyTrackRaiseLive, colonyTrackRaiseOf, playOwedColonyTrackRaise, seedColonyTrackRaise} from '@/client/console/colonyTrade/colonyTrackRaise';
import {armColonyRosterChange, clearColonyRoster, colonyRosterAnswered, colonyRosterDraft, colonyRosterPending, colonyRosterState, disarmColonyRoster, presentedColonyRoster, setColonyRosterLanding} from '@/client/console/colonyRoster/consoleColonyRoster';
import {ROSTER_READ_MS, RosterLevel, reanchorColonyCursor, rosterDraftStands, rosterIncomingOf, rosterLeavable, rosterLevel} from '@/client/console/colonyRoster/colonyRosterModel';
import {rosterBuildLands} from '@/common/colonies/ColonyRoster';
import {armColonyCity, clearColonyCity, colonyCityAnswered, colonyCityPending, colonyCitySceneDone, colonyCityState, disarmColonyCity, setColonyCityHoming} from '@/client/console/colonyCity/consoleColonyCity';
import type {SeatController} from '@/client/console/shell/seatController';
import type {StdProjectsController} from '@/client/console/shell/stdProjectsController';
import type {StagedController} from '@/client/console/shell/stagedController';
import type {JournalController} from '@/client/console/shell/journalController';
import type {NoticeController} from '@/client/console/shell/noticeController';
import {span} from '@/client/console/session/sessionWaits';
import {whenPainted} from '@/client/console/session/sessionWaits';
import {consoleSessionScope} from '@/client/console/session/consoleSession';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import type {SurfaceRegistry} from '@/client/console/shell/surfaceRegistry';
import {takeUpQuestion} from '@/client/console/setAside';

/** The roster's LANDING: the stage's fold home into the slot (the focus motion's own fold + the grid breathing back), base ms. */
const COLONY_ROSTER_LANDING_MS = 420;

/**
 * THE HOSTED COLONY STEP HANDS THE SCREEN BACK ONLY AFTER ITS STORY (P48 · ledger EY): the follow-up's falling edge
 * waits for the tokens the build paid (`transfer`, bounded) and one read of the landed cube — the same dwell the
 * standalone screen owns (`ConsoleColoniesSection` COMPLETION_SETTLE_MS) — before the frame pops into its host.
 * `idle` → `dwelling` (the wait runs) → `done` (the next settle proceeds). One shell, one dwell at a time.
 */
let colonySettleDwell: 'idle' | 'dwelling' | 'done' = 'idle';

/** The read of the landed cube before a hosted colony step hands its screen back (the standalone dwell's value). */
const COLONY_STEP_SETTLE_MS = 300;

/** How long that hand-back waits for the build's tokens at most (a ledger story; a named degrade past it). */
const COLONY_STEP_HANDOFF_MAX_MS = 4_000;

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type ColonyPort = {
  $nextTick(fn?: () => void): Promise<void>,
  surfaces: SurfaceRegistry,
  actionBlockedReason: UnwrapRef<SeatController['actionBlockedReason']>,
  admits(surface: PromptSurface): boolean,
  armStdpStepOrigin: UnwrapRef<StdProjectsController['armStdpStepOrigin']>,
  awaitingInput: UnwrapRef<SeatController['awaitingInput']>,
  cancelStagedPlay: UnwrapRef<StagedController['cancelStagedPlay']>,
  commitStagedTail: UnwrapRef<StagedController['commitStagedTail']>,
  concludeWorkspaceFlowOrOwe(kind: WorkspaceFrameKind, servedPromptHolds?: boolean): boolean,
  endCardActionsWithHostedStep(): void,
  endHandWithHostedStep(colonyPick?: ConsoleColonyPick): void,
  endPlayCardFlow(): void,
  endStdProjectsFlow: UnwrapRef<StdProjectsController['endStdProjectsFlow']>,
  enterStagedHostedStep(arm: StagedPlayArm, frame: Parameters<typeof pushWorkspaceFrame>[0]): Promise<void>,
  focusFirstSelectableHandCard(): void,
  foldWorkspaceAfterResult(host?: WorkspaceFrameKind): void,
  readonly followUpStepOwed: boolean,
  game: UnwrapRef<SeatController['game']>,
  readonly handAlbumParked: boolean,
  /** WRITTEN here. */ journalColonyInspect: UnwrapRef<JournalController['journalColonyInspect']>,
  readonly mandatoryBeat: MandatoryBeat | undefined,
  myTurn: UnwrapRef<SeatController['myTurn']>,
  openHandWithReveal(opts?: {keepTask?: boolean, overlay?: boolean}): Promise<void>,
  openShellTaskSurface(task: ConsoleTask): void,
  readonly playerView: PlayerViewModel,
  postGame: UnwrapRef<SeatController['postGame']>,
  readonly rawDrawnRevealPending: boolean,
  restoreParkedWorkspace(kind: WorkspaceFrameKind): boolean,
  readonly shellTask: ConsoleTask | undefined,
  readonly shellTaskActive: boolean,
  showNotice: UnwrapRef<NoticeController['showNotice']>,
  submit(response: unknown): SubmitTicket,
  submitBatch(responses: ReadonlyArray<unknown>, promptId?: number): SubmitTicket,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
  viewerPassed: UnwrapRef<SeatController['viewerPassed']>,
};

export function createColonyController(shell: ColonyPort) {
  // The controller's own scope (architecture v2 — PLAN §10 · C1): it ends with the shell, and the two bounded waits of
  // the colony-bonus resolution come due with it.
  const flow = useFlowScope('colony-controller');
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * …and the hosted COLONIES' (a staged colony's step, TR07): the frame pops first, the section stays MOUNTED
   * in the dissolving hand's zone (a transition outside a Teleport never sees the v-if inside it, so the
   * section cannot play a leave of its own) and is released by the hand's dissolve. The zone and the pick it
   * stood on are LATCHED for that leave — a leaving step re-read as a live screen re-words itself mid-fade.
   */
  const coloniesLeaving = scopedState('colonies-leaving', false);
  const colonyEmbedLatch = scopedState('colony-embed-latch', '');
  const colonyPickLatch = scopedState('colony-pick-latch', undefined as ConsoleColonyPick | undefined);
  /** The ride's net — the DISARM of a guaranteed release (armed by the outcome controller on its own scope). */
  const coloniesLeaveNet = ref(undefined as (() => void) | undefined);
  /**
   * THE POST-DISCARD RESTORE is owed: the hand has answered and is on its
   * way back to the dock, and the colony focus must re-expand from the
   * source chip BEFORE the track's committed reset may be reported — the
   * marker's return is the resolution's FINAL commit beat and it plays on
   * the big track of the colony's own focus, never over the hand and
   * never on the overview grid.
   */
  const colonyFocusRestorePending = scopedState('colony-focus-restore-pending', false);
  /** The colony-bonus cube this workspace already answered by itself (the
   *  auto-collect's one-shot dedupe — see `colonyBonusAutoCollect`). */
  const colonyBonusCollected = ref('');
  /**
   * THE RESOLUTION ENDED, BUT ITS CLOSING RELEASE WAS REFUSED — the
   * release funnel judged the claim still serving (a stale view echo, a
   * mid-flush blink). The INTENT «resolution over ⇒ the claim goes» is
   * not a one-shot: it stands until it is executed on the serving
   * probe's own falling edge, or invalidated by the resolution rising
   * again. Without it the claim sat wedged `presenting` until the 20 s
   * claim safety met a fresh view — a browse grid yielded EMPTY and a
   * workspace that never concluded, for the length of a poll cycle.
   */
  const colonyResolutionReleaseOwed = scopedState('colony-resolution-release-owed', false);
  /** The armed entry's BOUNDED WAIT (COLONY_BONUS_ENTRY_WAIT_MS) — the net
   *  under «entered, and nothing ever arrived»: a guaranteed release of `flow` (it comes at its time, or with the shell). */
  let disarmColonyEntryWait: () => void = () => {};
  /** …and the SEQUENCE's own net (COLONY_BONUS_CYCLE_WAIT_MS) — a guaranteed release of `flow` as well. */
  let disarmColonyCycleNet: () => void = () => {};
  /** Where the colony cursor lands on the NEXT rail (a roster pick's level change names it; '' = follow the colony). */
  const colonyCursorTarget = ref('');

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * THE SETTLEMENT TABLE IS PARKED — a multi-settlement payout's table has been presented and the resolution
   * still owes another cycle, but no batch presents right now (the discard step owns the room, or the next card
   * is between the server and the screen). The reveal instance stays mounted in its own zone — no batch, no
   * input, no command contract (`consoleRevealMode` stays undefined, so nothing routes to it) — so the table is
   * ONE instance from the first deal to the marker's return (colony polish 1, rule 3). Requires the zone: a
   * table with nowhere to stand (a collapse retracted it) simply unmounts and re-renders the same picture from
   * the module's memory when it comes back.
   */
  /** The pending colony-bonus discard's ordinal as a VALUE key (the table arms on it — `settlementMarkerKey` watcher). */
  const settlementMarkerKey = computed((): string => {
    const pair = settlementPairOf(shell.playerView.waitingFor);
    return pair === undefined ? '' : `${pair.meta.colonyName}|${pair.meta.index}|${pair.meta.total}|${pair.via}`;
  });

  const settlementTableParked = computed((): boolean => {
    // …and only while a place is still OWED: once the last place's card is taken and its discard has handed the
    // room back, the table is finished — parked any longer it stood (empty sockets, «Взята · сброс за вами») under
    // the trade track coming back for the closing glide, two surfaces in one zone (colony polish 1, PL-187).
    const owed = settlementTable.taken.length < settlementTable.total || colonyResolutionUi.discardStage;
    if (settlementTable.nonce === 0 || !settlementTable.presented || !owed || workspaceOutcomeState.embedSlot === '') {
      return false;
    }
    // A QUESTION's table (Ф4 host 2 — Mars University's answer beside the play's own draw) parks under the hand's
    // album while the question is answered; the answer's draw turns in its place when the stage comes back.
    if (settlementTable.kind === 'question') {
      return workspaceOutcomeState.host === 'hand';
    }
    // A TRADE's table parks under the colony resolution's discard stage; a CARD's (Ф4 — Habitat Science's Pluto
    // pairs, `via`) under the ledger's hand step in the action workspace — the same table, the same park.
    if (settlementTable.via !== '') {
      return colonyBonusPayoutLive() && workspaceOutcomeState.host === 'card-actions';
    }
    return colonyResolutionLive.value && workspaceOutcomeState.host === 'colonies';
  });

  /**
   * A CARD'S QUESTION WAITS FOR THE COLONY STEP TO HAND THE SCREEN BACK (CI 2026-11-03, `console-mu-colony-question` B,
   * red ×3 since P48): «Научная колония» builds, and the SAME response asks Mars University's discard. The hosted
   * colony step stands until its story is told (the build's scene, then `dwellColonyFollowUp` — the tokens, one read
   * of the cube), and the scene's blocking hold falls a beat BEFORE the frame pops — so the question came alive in
   * that gap and its album stood on the hand's shelf over a colony step still in the stack
   * (`hand:committed>colonies:committed` — the 2026-10-14 lock's very shape). A question a CARD raised elsewhere
   * (the server's structural `choiceContext.source.kind === 'card'` — never the colony's own follow-up, which is
   * hosted INSIDE the step) belongs to the stage AFTER this one: the stage gate holds it until the prompt-pushed
   * frame has left. Bounded by the frame's own bounded return (`COLONY_STEP_HANDOFF_MAX_MS` + the read).
   */
  const colonyStepReturnGatesPrompt = computed((): boolean => {
    const wf = shell.playerView.waitingFor;
    const host = workspaceFrameHost('colonies');
    // …and a CARD's own discard raised in the build's response (P55 Old Mining Colony — `DiscardCards` names its asker
    // on the `discardPrompt` marker, not on `choiceContext`). The colony's own bonus discards (`colonyBonus` /
    // `colonyRepeat`) are steps INSIDE the colony flow and never wait for it to leave.
    const discard = wf?.discardPrompt;
    const cardDiscard = discard?.source?.kind === 'card' && discard.colonyBonus === undefined && discard.colonyRepeat === undefined;
    return wf !== undefined && wf.type !== 'colony' && (wf.choiceContext?.source.kind === 'card' || cardDiscard) &&
      host !== undefined && host !== 'parliament' &&
      workspaceFrameAnchor('colonies')?.type === 'prompt' && !workspaceFrameHasNested('colonies');
  });

  // ── colony pick (T4 — a server SelectColony) ────────────────────────
  const colonyModel = computed((): SelectColonyModel | undefined => {
    const wf = shell.playerView.waitingFor;
    if (wf?.type === 'colony') {
      return wf as SelectColonyModel;
    }
    // THE STAGED COLONY (TR07): the prompt the hand's colony step serves while the tile is chosen — field for
    // field the SelectColony the commit WILL raise (`previewSelectColony`), so the grid, the projections and
    // the stage read ONE model whichever door is open. A live prompt always outranks it.
    return stagedColonyModel.value?.prompt;
  });

  const colonyPick = computed((): ConsoleColonyPick | undefined => {
    const model = colonyModel.value;
    if (model === undefined) {
      return undefined;
    }
    // Standalone: only while the shell-section task actually serves (the
    // admission gate holds it back behind cinematics). EMBEDDED: the host
    // workspace IS the serving surface — `shellTask` is legitimately gated
    // under a live scene there (the start), so the raw prompt + the latch
    // are the truth instead.
    if (shell.shellTask?.kind !== 'colony' && workspaceFrameHost('colonies') === undefined) {
      return undefined;
    }
    const reasons: Record<string, string> = {};
    for (const d of model.disabledColonies ?? []) {
      reasons[d.name] = typeof d.reason === 'string' ? translateText(d.reason) : translateMessage(d.reason);
    }
    const label = model.buttonLabel;
    const buttonLabel = label !== undefined && label !== '' && !['Save', 'Confirm', 'Ok'].includes(label) ? label : 'Select';
    // A ROSTER PICK (`rosterChange` — a tile enters, leaves, or is replaced): the grid asks ONE question per
    // level, and both the candidates and the reasons are the SERVER's lists — «who leaves» reads `outgoing`
    // (the table, each refused tile with its ONE reason), «who enters» the prompt's own reserve tiles.
    const roster = model.rosterChange;
    const level = colonyRosterLevel.value;
    if (roster !== undefined && level !== undefined) {
      const leaving = level === 'outgoing';
      if (leaving) {
        for (const tile of roster.outgoing ?? []) {
          if (tile.reason !== undefined) {
            reasons[tile.colony] = translateText(tile.reason);
          }
        }
      }
      return {
        selectable: leaving ? rosterLeavable(roster) : model.coloniesModel.map((c) => c.name),
        reasons,
        buttonLabel,
        labelKey: leaving ? 'Remove the tile' : (roster.kind === 'add' ? 'Add the tile' : 'Replace the tile'),
        roster: {prompt: roster, level, ...(colonyRosterOutgoing.value !== undefined ? {outgoing: colonyRosterOutgoing.value} : {})},
        ...(shell.playerView.waitingFor?.type !== 'colony' && stagedColonyModel.value !== undefined ? {staged: true} : {}),
      };
    }
    return {
      selectable: model.coloniesModel.map((c) => c.name),
      reasons,
      buttonLabel,
      // The DISPLAY key. `'trade'` is a machine sentinel (the trade
      // orchestration below keys on it) — it maps to the real «Trade» i18n
      // key here and is never rendered raw again.
      labelKey: buttonLabel === 'trade' ? 'Trade' : buttonLabel,
      // A pick that MOVES the chosen tile's track (TR07) — the server's projection, read by the grid and the stage.
      ...(model.trackMoves !== undefined ? {trackMoves: model.trackMoves} : {}),
      // A pick that LAYS A TILE on the chosen colony tile (TR22) — the server's projection again: the seat's ghost on
      // every candidate, the count «now → after» and the card's VP are read off this marker, never computed here.
      ...(model.tileSite !== undefined ? {tileSite: model.tileSite} : {}),
      // A pick that BUILDS A COLONY (every build prompt carries it) — the server's projection of each candidate's
      // berth; the act is read off this marker, never off the button's label. A CARD's own door (staged, or the
      // prompt naming a card as its giver) additionally projects the cube on the grid.
      ...(model.buildSites !== undefined ? {
        buildSites: model.buildSites,
        ...(model.choiceContext?.source.kind === 'card' ? {buildProjected: true} : {}),
      } : {}),
      // …and whether it is the STAGED door (nothing on the wire yet) or a live server prompt.
      ...(shell.playerView.waitingFor?.type !== 'colony' && stagedColonyModel.value !== undefined ? {staged: true} : {}),
      // A BOARD CELL asked for this colony (Terra Cimmeria's MSL Curiosity): the head names it — the source plate.
      ...(model.choiceContext?.source.kind === 'space' ? {cellGiver: {source: model.choiceContext.source, boardName: shell.game.gameOptions.boardName}} : {}),
    };
  });

  /** STAGED COLONY (TR07): the store's fourth target — the colony pick the hand's step serves before the one submit. */
  const stagedColonyModel = computed((): StagedColonyModel | undefined => {
    return stagedColonyOf(stagedPlayState.arm);
  });

  /** The staged colony's commit is on the wire (the abort battery's falling edge gives the stage back). */
  const stagedColonyCommitting = computed((): boolean => {
    return stagedColonyModel.value !== undefined && stagedPlayState.committing;
  });

  /**
   * WHAT A LANDED BUILD STILL OWES INSIDE ITS STAGE (the staged door's HOME waits for all of it — `landColonyBuild`):
   *  · a follow-up the COLONY's claim holds — a draw being taken (Pluto), a late card target;
   *  · the presented card still receiving its resources and being read (Titan);
   *  · a step hosted inside the colonies frame that the STAGE lives with (the hand's discard);
   *  · a prompt the tile's own bonus raised that the stage serves — named by the server's structural source
   *    (`choiceContext.source = {kind: 'colony', name}`), never by a title.
   * NOT in it: a board placement (Europa's ocean — it takes the board once the hand has left), and the
   * Parliament's delegate grant (the Redux Venus) — that step takes the SECTION's whole central area, so it stands
   * AFTER the stage has gone home (`colonyBuildSectionStepOwed`); under a standing stage it was a Parliament drawn
   * over a lit track with the stage's verbs on the bar.
   */
  const colonyBuildContinuationOwed = computed((): boolean => {
    if (workspaceOutcomeState.host === 'colonies' && workspaceOutcomeClaimed()) {
      return true;
    }
    if (colonyResolutionUi.cardSceneLive ||
        (workspaceFrameHasNested('colonies') && workspaceFrameHost('parliament') !== 'colonies')) {
      return true;
    }
    const wf = shell.playerView.waitingFor;
    const source = wf?.choiceContext?.source;
    return wf !== undefined && wf.type !== 'space' && wf.type !== 'party' && source?.kind === 'colony' &&
      source.name === colonyBuildState.receipt?.colony;
  });

  /**
   * The player's OWN colony act on the focus stage is ANSWERED — past its press, by the act's own transaction:
   * a card's build (`colonyBuildAnswered` — the staged door; a live build keeps the bar it always had), a roster
   * change, a city laid on the tile, a chosen track. The bar is a status from here on («Выполняется…»).
   */
  const colonyActAnswered = computed((): boolean => {
    switch (colonyFocusState.intent) {
    case 'build': return colonyBuildAnswered();
    case 'roster': return colonyRosterAnswered();
    case 'city': return colonyCityAnswered();
    case 'track': return colonyTrackMoveAnswered();
    default: return false;
    }
  });

  /** The delegate grant the built tile's bonus raised (the Redux Venus), by the server's structural markers. */
  const colonyBuildGrantPrompt = computed((): boolean => {
    const wf = shell.playerView.waitingFor;
    const source = wf?.choiceContext?.source;
    return wf !== undefined && wf.type === 'party' && wf.votePrompt?.source === 'grant' &&
      source?.kind === 'colony' && source.name === colonyBuildState.receipt?.colony;
  });

  /**
   * WHAT A LANDED BUILD STILL OWES IN THE SECTION'S OWN ZONE, once its stage has gone home: the Parliament's
   * vote step for the delegates the tile's bonus pays — standing, or still behind its door.
   */
  const colonyBuildSectionStepOwed = computed((): boolean => {
    return workspaceFrameHost('parliament') === 'colonies' || colonyBuildGrantPrompt.value;
  });

  /**
   * THE RAIL IS THE ADD-A-TILE CATALOG — a pick-a-NEW-tile prompt (Aridor's
   * first action, Maria) offers the game's UNUSED colonies, so the tiles on
   * the rail are NOT in the game. ONE derivation, because two consumers ask
   * it: which colonies to rail, and whether anything server-scoped may be
   * asked about them (nothing may — they have no track, no cubes, no trade).
   */
  const colonyRailIsCatalog = computed((): boolean => {
    // «The colony task put this rail up» is asked the way `colonyPick` asks it: the shell's own task, OR a
    // host workspace serving the prompt (under the start scene `shellTask` is legitimately gated — the catalog
    // inside `start ⊃ colonies` then railed the tiles IN PLAY), OR the staged door's prompt.
    const colonyTask = shell.shellTask?.kind === 'colony' || workspaceFrameHost('colonies') !== undefined ||
      (shell.playerView.waitingFor?.type !== 'colony' && stagedColonyModel.value !== undefined);
    // …and only while the pick is still a QUESTION: once the roster change is answered and playing (its receipt
    // exists) the rail is the TABLE again — a staged door's prompt outlives the answer by the whole ceremony, and
    // the stage must fold home into a slot of the table, never back into the reserve it was chosen from.
    return colonyRosterState.receipt === undefined && railIsCatalog(colonyModel.value?.purpose, colonyTask, colonyRosterLevel.value);
  });

  /** A REPLACEMENT's chosen leaving tile — only while the server's marker still lists it as able to leave. */
  const colonyRosterOutgoing = computed((): ColonyName | undefined => {
    return rosterDraftStands(colonyModel.value?.rosterChange, colonyRosterDraft.outgoing) ? colonyRosterDraft.outgoing : undefined;
  });

  /** THE LEVEL of a roster pick: «who leaves» (the table) or «who enters» (the reserve) — undefined for any other pick. */
  const colonyRosterLevel = computed((): RosterLevel | undefined => {
    return rosterLevel(colonyModel.value?.rosterChange, colonyRosterOutgoing.value);
  });

  /**
   * The rail source: the add-a-tile catalog lists ONLY the offered tiles;
   * everything else shows the in-game colonies (unpickable ones stay visible
   * with the server reason — information parity).
   */
  const coloniesForRail = computed((): ReadonlyArray<ColonyModel> => {
    const model = colonyModel.value;
    if (colonyRailIsCatalog.value && model !== undefined) {
      // A RESERVE tile is shown AS IT WOULD ENTER: the bare catalog model is serialized inactive whatever it is,
      // so the server's own projection (`rosterChange.incoming[].entersActive`) is what every reader of the
      // tile's activity gets — the grid, the stage and the dossier alike.
      const roster = model.rosterChange;
      if (roster === undefined) {
        return model.coloniesModel;
      }
      return model.coloniesModel.map((c) => {
        const entry = rosterIncomingOf(roster, c.name);
        return entry === undefined ? c : {...c, isActive: entry.entersActive};
      });
    }
    // THE PRESENTED ROSTER (`consoleColonyRoster`): while somebody else's change of the table is being played on
    // this grid, the table stands as it stood — the ONE reader of «which tiles are on the grid».
    return presentedColonyRoster(shell.game.colonies);
  });

  /**
   * THE RAIL BY NAME — what the cursor is anchored to. The cursor is stored as a position, so a tile seated
   * BEFORE it (an addition is sorted in by name) silently moved the focus onto another colony; the watcher on
   * this string re-anchors it to the colony it stood on (`reanchorColonyCursor`).
   */
  const colonyRailNames = computed((): string => {
    return coloniesForRail.value.map((c) => c.name).join('|');
  });

  /** SelectColony pay-on-commit cancel (Build Colony std project). */
  const colonyCancellable = computed((): boolean => {
    return colonyModel.value?.placementContext?.cancellable === true;
  });

  /**
   * The COMMITTED track position of the colony an armed trade transaction
   * is watching (undefined outside a transaction). Feeds the watcher that
   * tells the orchestrator when the server's reset really landed — the
   * only signal the reset glide is allowed to start on.
   */
  const armedColonyTradeTrack = computed((): number | undefined => {
    if (!colonyTradeState.active || colonyTradeState.colonyName === '') {
      return undefined;
    }
    return shell.game.colonies.find((c) => c.name === colonyTradeState.colonyName)?.trackPosition;
  });

  // ── colonies / hydro ───────────────────────────────────────────────
  const tradeColonyContext = computed(() => {
    return findTradeColonyContext(shell.playerView.waitingFor);
  });

  const tradeableColonyNames = computed((): ReadonlyArray<string> => {
    return tradeColonyContext.value?.colonies ?? [];
  });

  /**
   * THE «ПРИЧАЛЫ» COLUMN (Turmoil Redux TR06 Water Hauling and its sisters —
   * a card that is a destination of its owner's trade action): the viewer's
   * dock cards, with the live pick's verdict when a trade window is open (the
   * main door's AndOptions, or a card door's bare SelectColony). Only where a
   * TRADE is the act: a build / setup / add-tile pick is a different verb,
   * and the column is no part of it.
   */
  const colonyDocks = computed((): ReadonlyArray<FleetDockView> => {
    const pick = colonyPick.value;
    if (colonyRailIsCatalog.value || (pick !== undefined && pick.buttonLabel !== 'trade')) {
      return [];
    }
    const offers = tradeColonyContext.value?.docks ?? (pick !== undefined ? (colonyModel.value?.fleetDocks ?? []) : []);
    return fleetDockViews(shell.thisPlayer.tableau, (name) => getCard(name)?.fleetDock === true, offers);
  });

  /** The viewer's FREE trade fleets (mirrors ConsoleColoniesSection.freeFleetsFor:
   *  the MORE restrictive of used-trade-fleets and physically-deployed). */
  const viewerFreeFleets = computed((): number => {
    const deployed = shell.game.colonies.filter((c) => c.visitor === shell.thisPlayer.color).length;
    return Math.min(freeTradeFleets(shell.thisPlayer), Math.max(0, shell.thisPlayer.fleetSize - deployed));
  });

  /**
   * The REAL «why can't I trade at the FOCUSED colony» reason, via the shared
   * smart ladder (colony-intrinsic → no fleet → can't afford → turn). Returns a
   * TRANSLATED string (the one params case — another player's docked fleet —
   * needs substitution); consumers `$t()` it, which is a safe passthrough for an
   * already-translated string. '' when the colony IS tradeable (no blocker).
   */
  const colonyTradeBlockReason = computed((): string => {
    const selected = shell.game.colonies[consoleState.colonyIndex];
    if (selected === undefined) {
      return translateText(offTurnReason(shell.awaitingInput, shell.viewerPassed));
    }
    const reason = colonyTradeReason({
      colony: selected,
      tradeable: tradeableColonyNames.value,
      colonyBlock: shell.thisPlayer.colonyTradeBlocks?.find((b) => b.colony === selected.name)?.reason,
      viewerColor: shell.thisPlayer.color,
      availableFleets: viewerFreeFleets.value,
      myTurn: shell.myTurn,
      awaitingInput: shell.awaitingInput,
      passed: shell.viewerPassed,
      resolveName: (color) => displayNameForColor(shell.playerView.players, color),
    });
    if (reason === undefined) {
      return '';
    }
    return reason.params !== undefined ?
      translateTextWithParams(reason.key, reason.params.map(String)) :
      translateText(reason.key);
  });

  /** The colony the JOURNAL dossier shows (X on a journal colony row —
   *  read-only, pinned to its one colony, only B closes). The colonies
   *  SECTION's own inspect verb descends into the COLONY FOCUS STAGE
   *  instead — it never opens this overlay. */
  const colonyInspectModel = computed((): ColonyModel | undefined => {
    if (shell.journalColonyInspect === undefined) {
      return undefined;
    }
    return shell.game.colonies.find((c) => c.name === shell.journalColonyInspect);
  });

  /** The colony workspace's FOCUS STAGE is open (browse grid parked) —
   *  standalone section AND embedded step alike. */
  const colonyFocusOpen = computed((): boolean => {
    // …and STANDING: a stage that RECEDED under the resolution's discard step (colony polish 1 — it stays
    // mounted, the settlement table parked in its zone) is not the surface the player drives. The hand owns the
    // pad, the bar and B until the room is handed back; the stage takes them again the instant it returns.
    // …and the same while the PARLIAMENT's vote step stands in the section's zone (the Redux Venus trade's delegate
    // cells: the trade stage waits for its income under the vote — the vote owns the pad, the bar and B).
    return workspaceFrameMounted('colonies') && colonyFocusState.open &&
      !(colonyResolutionUi.discardStage && workspaceFrameKnown('hand')) &&
      workspaceFrameHost('parliament') !== 'colonies';
  });

  /**
   * THE ACT BEHIND THE DOSSIER'S A (X = «Осмотреть»): the same derivation
   * the grid's A makes — a server SelectColony pick outranks the trade —
   * with the verb that LEADS ON («К торговле» / «К постройке» / «К выбору»)
   * and whether the server offers it for the inspected colony. The bar
   * reads the verb; `available` is INFORMATION the dossier states beside
   * the act's name — never a gate on A (the dossier reads, the stage
   * decides and carries the refusal). `onColonyInspectEnter` acts on it.
   */
  const colonyInspectAct = computed((): {intent: ColonyFocusIntent, label: string, available: boolean} => {
    const name = colonyFocusState.colonyName;
    const pick = colonyPick.value;
    if (pick !== undefined) {
      const intent: ColonyFocusIntent = colonyPickIntent(pick);
      return {intent, label: intent === 'build' ? 'To building' : 'To selection', available: name !== '' && pick.selectable.includes(name)};
    }
    return {intent: 'trade', label: 'To trade', available: name !== '' && tradeableColonyNames.value.includes(name)};
  });

  /** The descended-into colony is live-tradeable (the stage's CTA verbs). */
  const colonyFocusTradeable = computed((): boolean => {
    return colonyFocusState.colonyName !== '' && colonyPick.value === undefined &&
      tradeableColonyNames.value.includes(colonyFocusState.colonyName);
  });

  /**
   * A payout batch of the LIVE trade transaction is waiting to be presented
   * — the signal the colonies section must be on screen for (the covers
   * launch from the traded tile; the reveal lands in the section's embed
   * zone). Between two Pluto colony bonuses the discard runs on the HAND
   * (select mode), and the next payout is what brings the player home.
   */
  const tradePayoutIncoming = computed((): boolean => {
    return colonyTradeState.active &&
      // ANY segment — a claim answers for the batch when any of its causes is its own (a Venus trade's batch is rooted
      // on the 8 % card, the trade's own runs ride after it).
      intakeBatchSources(currentRevealEvent() ?? {}).some((source) => colonyTradeClaimsReveal(source));
  });

  /**
   * A COLONY payout of ANY origin is arriving for a claim we hold. The
   * trade-only predicate above cannot see a BUILD's draw: the server
   * deliberately leaves `benefit === 'build'` un-tagged (`Colony.tradeRevealTag`),
   * so `source.trade` is undefined and no trade transaction is armed. Keyed
   * on the CLAIM instead — the one fact that says «this flow is still ours».
   */
  const colonyPayoutIncoming = computed((): boolean => {
    // The HOST term is load-bearing since the claim predicate lost its host
    // pin: a colony claim RE-HOMED to another live workspace (the adoption
    // net) still answers for its batch, but it is that workspace's stage now
    // — dragging the player back into the colonies section for it would be
    // the exact «yanked to another screen» this family exists to prevent.
    return shell.rawDrawnRevealPending &&
      workspaceOutcomeState.host === 'colonies' &&
      workspaceClaimsColonyRevealBatch(currentRevealEvent());
  });

  // ── THE COLONY RESOLUTION (colonyResolution.ts) — the Pluto flow's ONE
  //    lifecycle. Every signal is authoritative: the server's discard marker,
  //    the reveal batch's own source, the trade transaction that concludes
  //    only on the committed track reset, the running discard scene. ──────
  /**
   * THE FULL-STAGE DISCARD FLAG IS STRANDED — its room is hidden and nothing
   * is left that could give it back.
   *
   * `colonyResolutionUi.discardStage` is a CLIENT latch, and the console has
   * paid for that shape before (`colonyBonusEntry.awaiting`). While it is up
   * the section's browse grid YIELDS and the outcome slot is deliberately
   * EMPTY — the next cycle's batch parks, and the focus restore is what
   * republishes both. Exactly ONE call site cleared it on the ordinary path
   * (`handOffHandForDiscard` → `restoreColonyFocusAfterDiscard`), and that
   * site can be skipped: it returns early when the section has already been
   * projected away from the hand. The flag then survived the whole
   * resolution, and the player was left looking at «КОЛОНИИ › ПЛУТОН › БОНУС
   * ВЛАДЕЛЬЦА» over an EMPTY frame with the second colony's card owed and no
   * surface anywhere to answer it — a soft-lock, since the only other
   * release is the resolution's own falling edge, which that card is what
   * holds open.
   *
   * So the release is a DERIVED fact instead of a call site: the hand step is
   * gone, the server is not asking for a discard, no card is physically
   * leaving, and no ordinary return is already in flight. Nothing here is
   * client-written except the flag it ends.
   */
  const colonyDiscardStageStranded = computed((): boolean => {
    // …and «the server is not asking» means not asking THIS STAGE'S discard: the next cycle's marker rides the
    // response that answered this one (the pure rule and its history: `discardStageStrandedFor`).
    return discardStageStrandedFor({
      discardStage: colonyResolutionUi.discardStage,
      stageIndex: colonyResolutionUi.discardStageIndex,
      restorePending: colonyFocusRestorePending.value,
      handStands: consoleState.section === 'hand' || workspaceFrameKnown('hand'),
      marker: colonyBonusDiscardOf(shell.playerView.waitingFor),
      flight: cardDiscardColonyBonus() !== undefined,
    });
  });

  const colonyResolutionSignals = computed((): ColonyResolutionSignals => {
    return {
      discardMeta: colonyBonusDiscardOf(shell.playerView.waitingFor),
      collectMeta: colonyBonusCollectOf(shell.playerView.waitingFor),
      // The colony's OWN segment of the batch, never its root (a Venus trade's batch is rooted on the 8 % card).
      revealSource: colonyRevealSourceOf(currentRevealEvent()),
      tradeActive: colonyTradeState.active,
      tradeColony: colonyTradeState.colonyName,
      cardPickColony: colonyBonusCardPick.value?.colonyName ?? '',
      discardFlightMeta: cardDiscardColonyBonus(),
      entryColony: colonyBonusEntry.colonyName,
      entryAwaiting: colonyBonusEntry.awaiting,
      cycleAwaiting: colonyBonusSequence.awaiting,
      claimedByColonies: workspaceOutcomeState.host === 'colonies',
    };
  });

  /**
   * THE THIRD SHAPE OF AN OWNER BONUS: one the viewer has to PLACE (Enceladus'
   * microbes, Titan's floaters). Structural — the server's own
   * `choiceContext.source` names the colony that is paying.
   */
  const colonyBonusCardPick = computed((): {colonyName: string} | undefined => {
    return colonyBonusCardPickOf(shell.playerView.waitingFor);
  });

  /** The armed entry is still waiting for its payout (its bounded net rides
   *  this — a computed rather than a path watcher, which is the form module
   *  reactive state is read in here). */
  const colonyEntryAwaiting = computed((): boolean => {
    return colonyBonusEntry.awaiting;
  });

  /**
   * THE AUTHORITATIVE HALF of the gate (`colonyResolutionEvidenceFor`): what
   * the SERVER — or a beat already physically in flight — says is owed, with
   * the client-armed entry left out. Its rising edge ENDS the entry's wait:
   * from then on the resolution stands on its own evidence, so the entry can
   * never outlive it (the latch that froze the whole colony subsystem).
   */
  const colonyResolutionEvidence = computed((): boolean => {
    return colonyResolutionEvidenceFor(colonyResolutionSignals.value);
  });

  /**
   * The SEQUENCE writer's trigger — the two facts `noticeColonyBonusSequence`
   * reads, as one key so the watcher fires exactly when either moves (and not
   * on every unrelated recompute).
   */
  const colonySequenceKey = computed((): string => {
    const m = colonyBonusDiscardOf(shell.playerView.waitingFor);
    const marker = m === undefined ? '' : `${m.colonyName}#${m.index}/${m.total}`;
    return `${marker}|${colonyResolutionEvidence.value ? 1 : 0}`;
  });

  /**
   * THE PLUTO CLOSE GATE: while true, the colony workspace is the flow's one
   * interaction owner — it may collapse (the decision stays live) but never
   * unmount, and no reveal / discard of this resolution may open a second
   * root beside it. An empty reveal between two bonus cycles, a pending
   * discard whose batch was fully taken, the closing track glide — each
   * keeps exactly one term true until the next takes over.
   */
  const colonyResolutionLive = computed((): boolean => {
    return colonyResolutionLiveFor(colonyResolutionSignals.value);
  });

  /**
   * A colony-bonus COLLECT the workspace may answer BY ITSELF — the next
   * cube of a multi-settlement payout, arriving while the viewer already
   * stands on that colony's bonus stage with nothing on its table. '' = no
   * such delivery (it goes through the announcement instead). The value is
   * the cube's structural key, which is also the one-shot dedupe.
   */
  const colonyBonusAutoCollect = computed((): string => {
    const collect = colonyBonusCollectOf(shell.playerView.waitingFor);
    if (collect === undefined ||
        colonyBonusEntry.colonyName !== collect.colonyName ||
        !workspaceFrameMounted('colonies') ||
        currentRevealEvent() !== undefined) {
      return '';
    }
    return `${collect.colonyName}#${collect.index}/${collect.total}`;
  });

  /** The colony this resolution belongs to ('' when nothing is owed). */
  const colonyResolutionColonyName = computed((): string => {
    return colonyResolutionColony(colonyResolutionSignals.value);
  });

  /**
   * A FOREIGN trade's owner bonus is waiting for its ENTRY: the batch/discard
   * exist, the viewer neither traded nor entered yet. While this holds the
   * presentation is parked behind the mandatory announcement — the plate
   * blinks, nothing force-opens, and the announce's press is the one door.
   *
   * A STATE, not a verdict about a batch. What it parks is scoped by
   * `remoteColonyBonusParksReveal` at every reader: a reveal of the viewer's
   * OWN that happens to be on the table when the marker lands is not this
   * bonus's, and taking it down cost the player their untaken card and every
   * gate that reveal was holding shut.
   */
  const remoteColonyBonusPending = computed((): {colonyName: string} | undefined => {
    return remoteColonyBonusPendingFor(colonyResolutionSignals.value);
  });

  // ── THE COLONY EMBED — SelectColony inside a live workspace flow ──────
  /** A SelectColony prompt stands, structurally (no admission gating — the
   *  latch must land before any surface routing runs). */
  const colonyPromptRaw = computed((): boolean => {
    return shell.playerView.waitingFor?.type === 'colony';
  });

  /** The identity of the raise the live colony prompt carries (P48) — '' for every other prompt. */
  const colonyTrackRaiseKey = computed((): string => {
    return colonyTrackRaiseOf(shell.playerView.waitingFor, shell.playerView.id)?.key ?? '';
  });

  /**
   * …AND THE SURFACE MAY OPEN FOR IT NOW — the colony workspace's own DOOR.
   *
   * The prompt above is the structural latch; this is the admission. It was
   * the ONE prompt-routed door that never asked (`waitingFor.type === 'colony'`
   * raw, straight into `pushWorkspaceFrame`), and that is the whole of the
   * reported bug: «Научная колония» draws 2 cards AND builds a colony in one
   * response, so the grid stood up on the raw prompt while the drawn batch
   * assembled on top of it — two live decision surfaces from one press, the
   * lower one unreachable. Worse, both teleport into the SAME zone, so the
   * grid was laid out beside whatever still occupied it (the landing tableau,
   * then the reveal) and re-solved its fit when that left: measured 521 px of
   * a 1621 px band, then a jump to full width — «сначала половина экрана,
   * криво, потом весь workspace».
   *
   * GATED, NOT DEFERRED: the value is reactive, so the door opens by itself
   * the instant the previous effect has finished being presented (for a draw
   * that is «every card taken and landed» — the `followUp` policy's whole
   * arrival chain). Nothing else changes: the same door, the same host
   * resolution, the same crumb — one beat later.
   */
  const colonyPromptOpenable = computed((): boolean => {
    return colonyPromptRaw.value && shell.admits('followUp');
  });

  /**
   * The colony FOLLOW-UP is still running: the prompt itself, the armed
   * fleet flight, the reward transaction, the claimed Pluto payout — or ANY
   * leg of the colony RESOLUTION (a mandatory bonus discard, its physical
   * flight, an armed remote-bonus entry). The colonies FRAME lives exactly
   * as long as this does: the reported «COLONIES → MODAL → HAND» break was
   * this list missing the resolution's middle legs.
   */
  const colonyFollowUpLive = computed((): boolean => {
    return colonyPromptRaw.value || colonyTradeState.active ||
      tradeFleetState.active || isColonyBuildActive() ||
      // A DOCK's scene (TR06) owns its own ending — the card answers, reads and
      // leaves, then the workspace goes through the guarded conclusion; nothing
      // may settle the frame under it.
      fleetDockSceneState.holding ||
      workspaceOutcomeState.host === 'colonies' ||
      colonyResolutionLive.value ||
      colonyGrantStepLive.value || workspaceFrameHost('parliament') === 'colonies' ||
      // A CHOSEN TRACK's move (TR07) the answer carried: the stage it was confirmed on plays it first.
      colonyTrackMoveFlow.owed !== undefined || colonyTrackMoveFlow.live ||
      // A PLAY's RAISE of every track (P48) before its pick: the wave plays to its last landing first.
      colonyTrackRaiseLive() ||
      // A ROSTER change of the player's own: armed, playing on the stage, or still landing as a receipt.
      colonyRosterPending() || colonyRosterState.landing ||
      // A CITY laid on a colony tile (TR22): armed, landing on the stage, or the stage folding home to its receipt.
      colonyCityPending() || colonyCityState.homing ||
      // A colony a CARD built (TR25's staged door): its stage folding home, its receipt being read.
      colonyBuildState.homing || colonyBuildState.receipt !== undefined;
  });

  /**
   * A COLONY'S OWN DELEGATE GRANT STANDS (Turmoil Redux — the Redux Venus:
   * «add 2 delegates to a resolution» on the build, ×1 / ×2 on a trade). The
   * server names the giver (`choiceContext.source.kind === 'colony'`) on the
   * grant-marked party prompt, so the prompt is a STEP of the colony flow
   * that paid it — the frame may not hand the screen back while it stands
   * (the follow-up ended one response early and the vote rose over an empty
   * stack), and it stays through the vote's landing while the Parliament's
   * step is hosted inside the colonies (the second term above).
   */
  const colonyGrantStepLive = computed((): boolean => {
    const wf = shell.playerView.waitingFor;
    return wf?.votePrompt?.source === 'grant' && wf.choiceContext?.source.kind === 'colony';
  });

  /** The colony the standing delegate grant NAMES (the crumb's carried object while the vote is its step; '' = none). */
  const colonyGrantColony = computed((): string => {
    const source = shell.playerView.waitingFor?.choiceContext?.source;
    return colonyGrantStepLive.value && typeof source?.name === 'string' ? source.name : '';
  });

  /**
   * The zone the colonies section is TELEPORTED into — published by the
   * frame BELOW it, whichever workspace that is (the hand's card-play step,
   * the action centre, the start's prelude). ONE lookup instead of a
   * per-host switch: the chain does not care who is hosting whom, only that
   * something is (embed rule 3 — slots compose).
   */
  const colonyEmbedTarget = computed((): string | undefined => {
    return workspaceFrameTarget('colonies');
  });

  const colonyEmbedActive = computed((): boolean => {
    return colonyEmbedTarget.value !== undefined;
  });

  /** Where the colonies section renders: its frame's zone — or, while it rides its host's dissolve, the latched one. */
  const colonySectionTarget = computed((): string | undefined => {
    return colonyEmbedTarget.value ?? (coloniesLeaving.value && colonyEmbedLatch.value !== '' ? colonyEmbedLatch.value : undefined);
  });

  /**
   * The CARD whose effect owes this colony step — the L3 «Источник» target
   * (§ inspection grammar: X = the current object, L3 = what produced it).
   * It is the HOST frame's carried object: the hand's card-play step carries
   * the played card, the start's prelude step carries the prelude. The action
   * centre is the one host whose card lives in the outcome CLAIM instead (the
   * composer owns the activation, not the browse frame). '' → no verb, never
   * a broken zoom — a standalone entry has no source by definition.
   */
  /**
   * THE LAW THAT ASKED, when the colonies stand on the Parliament as a WHOLE step (Colony Contest's free colony): the
   * carrier card no longer stands beside the grid (`sittingFullStep` — the step takes the stage), so L3 «Источник»
   * is how the player reads it — the console-wide grammar (X the current object, L3 its source).
   */
  const colonyEmbedSourceResolution = computed((): string | undefined => {
    if (workspaceFrameHost('colonies') !== 'parliament' || !parliamentFlow.sittingFullStep) {
      return undefined;
    }
    return sittingAskResolution(shell.playerView.waitingFor) ?? shell.playerView.game.parliament?.phase?.summary?.enacted?.resolution;
  });

  /** The embedded colonies step has a source L3 can open — a card, or the law that asked. */
  const colonyEmbedHasSource = computed((): boolean => {
    return colonyEmbedSourceCard.value !== undefined || colonyEmbedSourceResolution.value !== undefined;
  });

  const colonyEmbedSourceCard = computed((): CardName | undefined => {
    const host = workspaceFrameHost('colonies');
    if (host === undefined) {
      return undefined;
    }
    // ONE QUESTION, ANSWERED BY THE HOST. This used to be a ternary that
    // carved out the single host it knew was different, which is a per-case
    // `if` wearing the shape of a rule — and it was already wrong for a THIRD
    // host: a Hydronetwork traversal's crumb subject is its STAGE NAME
    // («Микробная фиксация»), so a colony step opened by a repeated action
    // would have offered `L3 Источник` on a string that is not a card and the
    // zoom would have opened on nothing. A host that carries a card publishes
    // it (`setWorkspaceFrameSourceCard`); the fallback holds only while the
    // subject really IS a card, so a host with none contributes nothing
    // rather than a broken target. A new workspace joins by publishing.
    const name = workspaceStepSourceCard(host, (n) => getCard(n as CardName) !== undefined);
    return name === '' ? undefined : name as CardName;
  });

  /**
   * A live SelectColony that NO FRAME serves. The watcher heals it by
   * entering the standalone colonies — a prompt may degrade from embedded to
   * standalone, but it may never strand.
   *
   * The «my host died under me» half of this predicate is GONE: a frame is
   * only ever removed from the top, so a host cannot vanish out from under
   * the step it is carrying. That disagreement between ownership and presence
   * was the soft-lock.
   *
   * It reads the DOOR (`colonyPromptOpenable`), never the raw prompt: a prompt
   * whose door is deliberately held behind a running cinematic is not
   * stranded, it is WAITING — and healing it there would re-open the very
   * overlap the gate exists to remove. The leak detector agrees by
   * construction (`isAnimationHoldActive` early-returns), and the value is
   * reactive, so the heal still fires the moment the chain clears.
   */
  const colonyPromptStranded = computed((): boolean => {
    return colonyPromptOpenable.value && !consoleState.task.deferred &&
      workspaceFrameIndex('colonies') === -1;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * A SelectColony arrived — stand the colonies where they BELONG: inside the
   * nearest live unfinished step, or as a screen of their own. The `prompt`
   * anchor is what later says «the demand brought the player here, so hand the
   * screen back when it is met».
   */
  /**
   * THE COLONY FOLLOW-UP IS OVER — the prompt answered, the build's cube landed, the payout's last leg done: a frame
   * the PROMPT pushed hands the screen back to whatever hosted it. Called on the falling edge of `colonyFollowUpLive`
   * and — the one case that edge cannot see — after a yielded stack comes BACK from the board with the follow-up
   * already over (Europa's build ocean inside the sitting: the frame was aside while its chain ended).
   */
  function settleColonyFollowUp(): void {
    // A ROSTER change of the player's own ends with its LANDING: the stage folds home into the slot the tile now
    // holds, the grid stands as the receipt, and only then does the frame hand the screen on (this very method,
    // called again by the landing's end).
    if (colonyRosterState.receipt !== undefined) {
      void landColonyRoster();
      return;
    }
    // …and so does a CITY laid on a colony tile (TR22): the stage folds home with its seat, the grid is read once.
    if (colonyCityState.receipt !== undefined) {
      void landColonyCity();
      return;
    }
    // A visit the PLAYER made stays exactly where it is; a frame the PROMPT
    // pushed hands the screen back once its demand is met. That distinction
    // is the frame's own anchor, not a flag somebody has to clear.
    if (workspaceFrameAnchor('colonies')?.type !== 'prompt') {
      return;
    }
    const host = workspaceFrameHost('colonies');
    // THE COMPLETION SETTLE (standalone only). Popping on the same frame the
    // last physical change lands means the player never sees what it was: the
    // cube had only just seated. The section owns the dwell, then hands the
    // screen forward through `flow-complete`.
    const section = shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection');
    if (host === undefined && colonyFocusState.open && section !== undefined) {
      section.completeFlow();
      return;
    }
    // …and HOSTED it is a hand-over too (P48 · ledger EY — «the premium wave played to the end, and only then the
    // player was returned»): the frame waits for the build's tokens and one read of the cube, then pops. The
    // Parliament keeps its own walk (it reads the frame's departure itself).
    if (host !== undefined && host !== 'parliament' && colonySettleDwell !== 'done') {
      void dwellColonyFollowUp();
      return;
    }
    colonySettleDwell = 'idle';
    // The focus stage (if the follow-up resolved on it) folds with the step —
    // the parent continuation gets a clean surface back.
    closeColonyFocus();
    leaveWorkspace();
    // WHAT THE UNCOVERED HOST DOES NEXT. Not a latch table: each of these is a
    // genuinely different completion, and every one of them is now a plain
    // question about the frame that came back.
    if (host === 'hand') {
      // THE CARD-PLAY STEP IS OVER — its only remaining business WAS this
      // colony. It ends through the play's ONE guarded ending, which is what
      // makes the two shapes one call: hosted (`start ⊃ hand`) the hand step
      // leaves and the deployment gets its screen back exactly where it
      // stopped; standing alone there is nothing left to show and it goes
      // home. And it still HOLDS if this play ALSO drew cards — the colony
      // was one of two things it owed. (The played hero's own closing beat
      // does this when no colony was involved — same ending, one beat
      // earlier.)
      shell.endPlayCardFlow();
    } else if (host === 'card-actions') {
      // The activation's follow-up is done — the action workspace folds the
      // way every completed action does.
      shell.foldWorkspaceAfterResult();
    } else if (host === 'parliament') {
      // THE SITTING'S COLONY STEP IS OVER (Colony Contest): the winner's free
      // colony stands, its build chain (the cube's flight, the tile's own
      // bonus) has finished, and the frame above was just popped. That is
      // ALL the shell does here. The Parliament is not a card play — it is
      // neither concluded nor folded nor collapsed by a step's end: the
      // section reads the frame's departure itself (`stepFrameNested`
      // falling — the stage's door closes, the hero card folds home) and
      // continues its own walk from the reward page («получено» → the
      // renewal → the results); the sitting ends only through its own gate
      // («Закрыть заседание»), never through a pop.
      consoleParliamentUi.stepFrameLeftAt = Date.now();
    }
  }

  /**
   * THE HOSTED STEP'S HAND-OVER (see `colonySettleDwell`): wait out the build's tokens (bounded, `transfer` only — a
   * host's own lifetime holds are not this step's story), dwell one read, and settle again — only if the step is
   * still the prompt's and its follow-up still over (a new demand arriving meanwhile keeps the frame).
   */
  async function dwellColonyFollowUp(): Promise<void> {
    if (colonySettleDwell === 'dwelling') {
      return;
    }
    colonySettleDwell = 'dwelling';
    const alive = () => workspaceFrameAnchor('colonies')?.type === 'prompt' && !colonyFollowUpLive.value;
    const outcome = await waitScreenHandoff('colony-step-return', {only: ['transfer'], alive, maxMs: COLONY_STEP_HANDOFF_MAX_MS});
    if (outcome !== 'dead') {
      await span(motionMs(COLONY_STEP_SETTLE_MS));
    }
    if (!alive()) {
      colonySettleDwell = 'idle';
      return;
    }
    colonySettleDwell = 'done';
    settleColonyFollowUp();
  }

  /**
   * The board's business is done and the yielded stack comes back at the same depth — and a colony follow-up
   * that ENDED while the stack was aside (the build's own ocean, placed on the board) is settled at once: its
   * falling edge fired against a stack that held no frames, so nothing else will pop the frame.
   */
  function resumeStackFromBoardAndSettle(): void {
    const carried = yieldedStackCards();
    if (!resumeStackFromBoard()) {
      return;
    }
    if (!colonyFollowUpLive.value) {
      settleColonyFollowUp();
    }
    // THE PLAY'S SECOND DOOR (T03): the flow came back for the card's own live grant — its vote opens INSIDE it now
    // (the party branch held it while the flow stood aside).
    const task = taskFor(shell.playerView);
    if (task !== undefined && task.kind === 'party' && cardGrantOwedTo(shell.playerView.waitingFor, carried)) {
      shell.openShellTaskSurface(task);
    }
  }

  function openColoniesForPrompt(): void {
    if (shell.restoreParkedWorkspace('colonies')) {
      return;
    }
    const host = workspaceHostForStep();
    const anchor: FrameAnchor = {type: 'prompt', promptType: 'colony'};
    // THE STAGE THE FRAME OPENS UNDER is the prompt's own: a resolution-sourced pick (the winner's free colony
    // of Colony Contest) is a step of the SITTING and reads «КОЛОНИИ» — the key `consoleSittingFlow` prints
    // for that step; every other pick keeps «ВЫБОР КОЛОНИИ». The same table the section publishes up from
    // (`followUpStepStage`), so the tail animates once.
    const stage = followUpStepStage('colony', shell.playerView.waitingFor) ?? 'Colony selection';
    // A PRELUDE's colony pick hosted by the start names the prelude in the start's crumb — after a reload the press
    // that set the subject is gone, and the server's `choiceContext` names the asker (P55 · FN).
    const asker = shell.playerView.waitingFor?.choiceContext?.source;
    if (host === 'start' && workspaceFrameSubject('start') === '' && asker?.kind === 'card' && asker.card !== undefined) {
      setWorkspaceFrameSubject('start', asker.card);
    }
    if (host === undefined) {
      enterWorkspace('colonies', {anchor});
    } else if (host === 'standard-projects' && colonyCancellable.value) {
      // The STD-PROJECTS flow's pay-on-commit target step: NOTHING is spent
      // yet (the server marks the pick cancellable), so the flow is still
      // REVERSIBLE — the crumb stays cyan, B cancels server-side for free
      // and folds back to the very row the player left. The colony's own
      // confirm is the single atomic commit.
      shell.armStdpStepOrigin();
      setWorkspaceFramePhase(host, 'configure');
      pushWorkspaceFrame({
        kind: 'colonies', subject: '', stage, phase: 'configure',
        serves: ['colony'], anchor,
      });
    } else {
      // The host's own beat is OVER — what remains is a decision about its
      // result. Past the commit boundary its B means «collapse», and its
      // crumb tail hands over to the step now standing inside it.
      setWorkspaceFramePhase(host, 'committed');
      pushWorkspaceFrame({
        // The SAME stage name the section publishes up on mount (and the same
        // one the reversible branch above pushes): a frame that opens under a
        // placeholder its own surface immediately corrects makes the crumb
        // tail animate twice to say one thing. Inside the SITTING the host's
        // subject («ЗАСЕДАНИЕ») stays the crumb's — this frame carries none.
        kind: 'colonies', subject: '', stage, phase: 'committed',
        serves: ['colony'], anchor,
      });
    }
    // Land on the first PICKABLE tile so A is meaningful immediately —
    // or on a free DOCK when the pick offers no colony at all (TR06).
    const pick = colonyPick.value;
    const first = pick !== undefined ?
      coloniesForRail.value.findIndex((c) => pick.selectable.includes(c.name)) : -1;
    consoleState.colonyIndex = first !== -1 ? first : 0;
    landColonyCursorOnTradeable();
    tellColonyTrackRaise();
  }

  /**
   * THE RAISE THE PLAY ALREADY MADE (P48 Early Colonization — `trackRaise` on the prompt): seeded in the SAME
   * block that pushed the frame, so the grid's first frame paints every marker where it STOOD, then the ONE
   * track wave plays (it waits for the standing tiles itself) and the pick opens after the last landing. A raise
   * this session already told (a reload mid-step) seeds nothing — the tiles stand on the truth.
   */
  function tellColonyTrackRaise(): void {
    if (!seedColonyTrackRaise(colonyTrackRaiseOf(shell.playerView.waitingFor, shell.playerView.id))) {
      return;
    }
    void playOwedColonyTrackRaise();
  }

  /**
   * A CARD ACTION WALKED INTO THE TRADE. The frame is already pushed (the
   * card-actions surface owns that — it is its own step), so the shell only
   * does what it does for every colony arrival: land the cursor where A is
   * meaningful, i.e. on the first colony this player may actually trade with.
   */
  function onCardActionsColonyStep(): void {
    const first = coloniesForRail.value.findIndex((c) => tradeableColonyNames.value.includes(c.name));
    consoleState.colonyIndex = first !== -1 ? first : 0;
    landColonyCursorOnTradeable();
  }

  /**
   * THE TRADE WITH NO COLONY BUT A FREE DOCK (rule 5 of TR06): the window is
   * live — the server's pick names the dock — so the overview opens with the
   * cursor ON the dock, where A is meaningful. Any tradeable colony keeps the
   * cursor on the grid, exactly as before.
   */
  function landColonyCursorOnTradeable(): void {
    resetColonyDockCursor();
    // The live colony set: a card door's bare pick names its own, the main door its trade window's.
    const liveColonies = colonyPick.value !== undefined ? colonyPick.value.selectable : tradeableColonyNames.value;
    if (liveColonies.length > 0) {
      return;
    }
    const dock = colonyDocks.value.findIndex((d) => d.offer?.available === true);
    if (dock !== -1) {
      colonyDockCursor.active = true;
      colonyDockCursor.index = dock;
    }
  }

  /**
   * PLUTO COMES HOME. A trade/build payout needs its own surface back: the
   * covers launch from the traded tile and the reveal lands in the section's
   * zone. Re-entering is a NO-OP while the colonies already stand (embedded
   * or not), so this can never swap the section under a hosting workspace.
   */
  function bringColoniesHome(): void {
    if (workspaceFrameMounted('colonies')) {
      return;
    }
    enterWorkspace('colonies', {anchor: {type: 'prompt', promptType: 'colony'}});
    // A workspace re-entered MID-RESOLUTION (a reload, a self-heal) stands
    // straight at the resolution's own depth: committed, hosting, serving
    // the mandatory discard — the rising-edge watcher fired long ago.
    if (colonyResolutionLive.value) {
      setWorkspaceFramePhase('colonies', 'committed');
      setWorkspaceFrameServes('colonies', COLONY_RESOLUTION_SERVES);
    }
  }

  /**
   * Report the traded colony's COMMITTED track position — GATED on the
   * glide's stage. While the full-stage discard owns the room, or the
   * post-discard focus restore is still owed, the committed reset is held
   * back: the marker's return is the resolution's FINAL commit beat, played
   * on the colony's own big track. The restore flushes this.
   */
  function syncColonyTrackCommit(): void {
    const value = armedColonyTradeTrack.value;
    if (value === undefined || colonyTradeState.colonyName === '') {
      return;
    }
    if (colonyResolutionUi.discardStage || colonyFocusRestorePending.value) {
      return;
    }
    notifyColonyTradeTrackCommitted(colonyTradeState.colonyName as ColonyName, value);
  }

  /**
   * THE POST-DISCARD RETURN — the resolution comes back from the hand to
   * the colony's own focus: the source chip re-expands into the hero stage,
   * a held next-cycle batch gets its zone republished, and only then the
   * deferred track commit is reported (the final glide plays on the big
   * track). Runs after the hand physically gathered into the dock.
   */
  async function restoreColonyFocusAfterDiscard(): Promise<void> {
    const name = colonyResolutionColonyName.value;
    if (colonyResolutionLive.value && workspaceFrameMounted('colonies') &&
        !colonyFocusState.open && name !== '') {
      const idx = coloniesForRail.value.findIndex((c) => c.name === name);
      consoleState.colonyIndex = idx !== -1 ? idx : 0;
      // FOCUS FIRST, flag second: the browse grid stays yielded (the
      // discard-stage flag keeps it hidden) until the focus stage is
      // genuinely standing over it — clearing the flag first uncovered the
      // overview grid for the one-two frames of the swap, and «не
      // показывать Overview даже на один кадр» is the contract.
      // …in the composition the resolution belongs to: a FOREIGN trade's
      // payout comes back to its bonus stage, the viewer's own act to its
      // own stage — never `'inspect'`, which mounts the read-only DOSSIER
      // (no outcome zone, no track for the reset) since 2026-09-27.
      openColonyFocus(name as ColonyName,
        colonyResolutionFocusIntent(colonyResolutionSignals.value, name));
      await shell.$nextTick();
      setColonyDiscardStage(false);
      // Let the stage publish its zones before anything measures against it
      // (the settle beat of the restore — a held batch opens on it now).
      await settledPaint();
    } else {
      setColonyDiscardStage(false);
    }
    colonyFocusRestorePending.value = false;
    syncColonyTrackCommit();
  }

  /**
   * THE OWNER-BONUS ENTRY — the colony workspace opens DIRECTLY on the
   * colony's focus stage in its bonus context (never the overview: the
   * player is here to answer one colony's payout). Used by the remote
   * entry (another player traded) and by a reload straight into the
   * resolution; the viewer's own trade is already standing here.
   *
   * The TRADER is authoritative game state: the trade parked their fleet on
   * the colony (`visitor`), so the stage can honestly say whose trade
   * triggered the bonus without a new server field.
   */
  function enterColonyBonusStage(colonyName: string, traderHint?: Color): void {
    const colony = coloniesForRail.value.find((c) => c.name === colonyName);
    // The SERVER names the trader when it knows them (the collect marker);
    // the colony's parked visitor is the fallback for a discard-marked
    // entry, which carries no colour of its own.
    const traderColor = traderHint ?? colony?.visitor;
    const trader = traderColor !== undefined ?
      shell.playerView.players.find((p) => p.color === traderColor) : undefined;
    armColonyBonusEntry(colonyName as ColonyName, trader !== undefined ?
      {color: trader.color, name: participantDisplayName(trader)} : undefined);
    if (!workspaceFrameMounted('colonies')) {
      enterWorkspace('colonies', {anchor: {type: 'prompt', promptType: 'card'}});
    }
    setWorkspaceFramePhase('colonies', 'committed');
    setWorkspaceFrameServes('colonies', COLONY_RESOLUTION_SERVES);
    const idx = coloniesForRail.value.findIndex((c) => c.name === colonyName);
    consoleState.colonyIndex = idx !== -1 ? idx : 0;
    if (!colonyFocusState.open) {
      // THE BONUS COMPOSITION, not the trade dossier: the player did not come
      // to weigh an action here — somebody else's trade owes them one thing.
      // (`inspect` put the whole trade screen up and hid the actual decision
      // inside it.)
      openColonyFocus(colonyName as ColonyName, 'bonus');
    }
    // The workspace claims the payout: the reveal presents INSIDE it and the
    // deck-draw scene SERVES the claim (the cards honestly come off the deck
    // and fly into the embedded slots — the start-host pattern). No execution
    // beat exists for an entry, so it is marked done outright.
    //
    // `pick` rides along because an owner bonus has THREE shapes and one of
    // them is a card TARGET pick («куда положить ресурс»): the claim is what
    // re-homes that prompt into this stage's own zone (`taskEmbedTarget` →
    // `workspaceClaimsPick`) instead of raising a band over the colony that
    // is paying it.
    if (workspaceOutcomeState.host !== 'colonies') {
      claimWorkspaceOutcome('colonies', colonyName, ['draw', 'pick']);
      markWorkspaceOutcomeArrivalDone();
    }
    markWorkspaceOutcomeBeatDone();
    // …AND THE WAIT IS ALREADY OVER IF THE PAYOUT IS ALREADY REAL — which is
    // the ordinary case: the marker that opened this door is pending from the
    // same tick. Read here rather than left to the evidence watcher, which
    // fires on a CHANGE and would have nothing to change.
    if (colonyResolutionEvidence.value) {
      noteColonyBonusEntryWaitOver();
    }
  }

  /**
   * COLLECT the colony bonus ANOTHER player's trade paid the viewer — the
   * whole flow of Miranda's «возьмите карту», and Pluto's twin minus the
   * discard.
   *
   * The press is the ANSWER and the JOURNEY at once: the workspace opens on
   * the paying colony (bonus context, the trader named) FIRST — so the claim
   * exists before anything can arrive — and only then does the collect go to
   * the server. The card is drawn inside that answer, so it flies from the
   * deck into the workspace's own zone instead of appearing in a hand
   * nobody looked at.
   */
  function openColonyBonusCollect(meta: ColonyBonusCollectMeta): void {
    enterColonyBonusStage(meta.colonyName, meta.trader);
    shell.submit({type: 'option'});
  }

  function openColonyBonusDiscard(meta: ColonyBonusDiscardMeta): void {
    if (!workspaceFrameMounted('colonies')) {
      enterColonyBonusStage(meta.colonyName);
    } else {
      setWorkspaceFramePhase('colonies', 'committed');
      setWorkspaceFrameServes('colonies', COLONY_RESOLUTION_SERVES);
    }
    const ev = currentRevealEvent();
    const untaken = ev === undefined ? 0 : ev.cards.length - ev.takenIndices.size;
    if (untaken > 0) {
      // The bonus card must be COLLECTED first — the reveal owns the screen
      // and its closer brings the flow back here once everything is taken.
      return;
    }
    // THE FULL-STAGE DISCARD. Comparing every card is this phase's one job,
    // so the hand owns the whole central area and the REAL hand opens with its
    // own premium dock→grid reveal — never a ready-made grid.
    //
    // ⚠️ THE STAGE RECEDES, IT DOES NOT CLOSE (colony polish 1). It used to
    // close (a quick fade, then a re-open from the colony's chip on the way
    // back), and with it went the reveal it hosted — the SETTLEMENT TABLE whose
    // next card the player is discarding for: the table vanished from the
    // player's world, was rebuilt from scratch afterwards, and the next card
    // flew in AGAIN to a place that had just held it face-down. The stage now
    // waits under the hand MOUNTED (`ConsoleColonyFocusStage.receded`), the
    // table parked in its zone (`settlementTableParked`), and both come back
    // as the same instance. The next cycle's batch is held explicitly
    // (`revealHeldForWorkspace` § the discard stage) until the room is back.
    // (No stage to recede — a reload straight into the discard — changes
    // nothing: the section-level slot hosts the hand as before.)
    setColonyDiscardStage(true, meta.index);
    void shell.openHandWithReveal({keepTask: true});
    setWorkspaceFrameStage('hand', settlementStageText('discard', meta) ?? 'Discarding a card');
    shell.focusFirstSelectableHandCard();
  }

  // ── the colony workspace (browse ⇄ focus; submit mirrors desktop) ─────
  /**
   * Descend into the FOCUSED colony's stage (A = trade, X = inspect — ONE
   * stage either way; consoleColoniesModel.colonyFocusState). The section
   * arms the descend origin (the pressed tile's rect) and opens the flow;
   * the shell only gates re-entry during a live transaction.
   */
  /**
   * DOES TRADING HERE PUT CARDS ON THE TABLE? — the ONE structural question
   * behind the colonies' embedded-outcome claim, asked of the colony's own
   * metadata and never of its name.
   *
   * Both trade paths used to claim `['draw']` unconditionally while the
   * build path beside them was already structural. The claim's only visible
   * consequence is that the workspace stands a follow-up STAGE from submit
   * time — so every colony that pays in production, plants or heat opened an
   * empty, dimmed stage over its own focus surface and held it there
   * (`completeFlow` refuses to fold under a live claim) until the 20 s
   * claim backstop fired. Луна was the report; every non-card colony had it.
   */
  function colonyTradeDealsCards(colonyName: string): boolean {
    const model = coloniesForRail.value.find((c) => c.name === colonyName);
    if (model === undefined) {
      return false;
    }
    const metadata = getColony(colonyName as ColonyName);
    const top = metadata.trade.quantity.length - 1;
    // The OWNER bonus only becomes a reveal for THIS player when this player
    // owns a settlement here — otherwise its cards are dealt to someone else
    // and there is nothing for our workspace to present.
    const ownerDraw = colonyOwnerBonusDrawsCards(metadata) &&
      shell.thisPlayer !== undefined && model.colonies.includes(shell.thisPlayer.color);
    return ownerDraw || colonyTradeMayDrawCards(metadata, Math.min(model.trackPosition, top));
  }

  /**
   * The STRUCTURAL claim kinds of a trade on this colony: `draw` when its
   * payout deals cards the workspace will present, `pick` when a reward can
   * land ON a card the viewer points at (Titan's floaters, Enceladus'
   * microbes — income or the viewer's own settlement bonus). The composer
   * pre-collects every pick into the batch, so `pick` normally never
   * surfaces — the claim is the DEFENSE for the prompt that still does (a
   * capture pruned mid-flight): it teleports into the colony stage's own
   * zone instead of rising as a standalone band over the workspace that
   * asked the question.
   */
  function colonyTradeClaimKinds(colonyName: string): Array<'draw' | 'pick' | 'venus-bonus'> {
    const kinds: Array<'draw' | 'pick' | 'venus-bonus'> = [];
    // A trade can step Venus (the Redux «Venus» colony's fixed income) — on the alternative board that step may earn
    // the bonus, asked between the income and the track's reset: the trade's own next stage (P89 · EE). Optimistic,
    // like a play's: the reconciler keeps it only while the bonus is what the server asks.
    if (shell.playerView.game.gameOptions.altVenusBoard === true) {
      kinds.push('venus-bonus');
    }
    if (colonyTradeDealsCards(colonyName)) {
      kinds.push('draw');
    }
    const model = coloniesForRail.value.find((c) => c.name === colonyName);
    if (model !== undefined) {
      const ownsSettlement = shell.thisPlayer !== undefined && model.colonies.includes(shell.thisPlayer.color);
      if (colonyTradeAsksCardTargets(getColony(colonyName as ColonyName), ownsSettlement)) {
        kinds.push('pick');
      }
    }
    return kinds;
  }

  /**
   * A ON THE DOSSIER — go on into the act. The section performs the
   * HAND-OFF (the stage takes the dossier's place with the planet, the
   * track and the berths carried over); the shell only decides WHICH act,
   * from the same server truth the grid's A reads. NEVER gated on the act
   * being offerable — the stage states the refusal with its reason; the
   * only refusal here is a transaction already owning the moment.
   */
  function onColonyInspectEnter(): void {
    const act = colonyInspectAct.value;
    if (!colonyFocusState.open || colonyFocusState.intent !== 'inspect') {
      return;
    }
    if (isTradeFleetActive() || colonyTradeState.active || isColonyBuildActive()) {
      return;
    }
    const section = shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection');
    section?.enterFocusFromInspect(act.intent);
  }

  function enterColonyFocus(intent: ColonyFocusIntent): void {
    if (coloniesForRail.value.length === 0 || colonyFocusState.open) {
      return;
    }
    // A trade in flight owns the moment (its own gates already swallow A/X;
    // this is the belt for the first frame before they engage).
    if (isTradeFleetActive() || colonyTradeState.active) {
      return;
    }
    const section = shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection');
    section?.enterFocus(intent);
  }

  /**
   * A on the colony grid — standalone section AND embedded step alike.
   * T4: a server SelectColony pick outranks the trade flow; without a pick
   * A descends into the focused colony's FOCUS STAGE (trade intent —
   * blocked colonies descend too: the stage carries the honest verdict and
   * the full dossier, which beats a bare refusal notice).
   */
  function confirmColonySelection(): void {
    // A ON A DOCK — the dock's own stage (a trade whose fleet goes to the
    // card). Same guards as the colony descent; the stage carries the
    // server's verdict and its one reason.
    if (colonyDockCursor.active && colonyDocks.value.length > 0) {
      if (colonyFocusState.open || isTradeFleetActive() || colonyTradeState.active) {
        return;
      }
      if (shell.actionBlockedReason !== '' && !shell.postGame) {
        shell.showNotice(shell.actionBlockedReason);
        return;
      }
      (shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection'))?.enterDockFocus();
      return;
    }
    // THE OVERVIEW SELECTS; THE FOCUS STAGE RESOLVES (iteration 2). A on
    // the grid never performs an irreversible action any more — every verb
    // descends into the ONE detail surface, where the destination, the
    // grant and the consequences are on screen before the confirm.
    const pick = colonyPick.value;
    if (pick !== undefined) {
      if (isColonyBuildActive()) {
        return; // a build hero is already flying — never re-enter
      }
      // A REPLACEMENT's FIRST level — «which tile leaves»: A CHOOSES it (nothing is sent, nothing is auto-picked:
      // a single candidate is still pressed) and the grid walks one level deeper, onto the reserve. A tile that
      // cannot leave says why.
      if (pick.roster !== undefined && pick.roster.prompt.kind === 'replace' && pick.roster.level === 'outgoing') {
        const focused = coloniesForRail.value[consoleState.colonyIndex];
        if (focused === undefined) {
          return;
        }
        if (!pick.selectable.includes(focused.name)) {
          shell.showNotice(pick.reasons[focused.name] ?? 'Unavailable right now');
          return;
        }
        const leaving = focused.name as ColonyName;
        const first = colonyModel.value?.coloniesModel[0]?.name ?? '';
        void reseatColonyRosterLevel(() => {
          colonyCursorTarget.value = first;
          colonyRosterDraft.outgoing = leaving;
        });
        return;
      }
      enterColonyFocus(colonyPickIntent(pick));
      return;
    }
    // THE STAGE IS THE DOSSIER — the one exemption to the blocked-reason
    // guard, and only in the post-game. A blocked LIVE game means a decision
    // is owed and starting a trade would desync the prompt the server holds;
    // a FINISHED game holds no prompt at all, and refusing the descent there
    // would take the colonies' final state away from the read-only
    // inspection over an action nobody asked for. The stage's own CTA is
    // dead on its own terms (no offer to answer).
    if (shell.actionBlockedReason !== '' && !shell.postGame) {
      shell.showNotice(shell.actionBlockedReason);
      return;
    }
    enterColonyFocus('trade');
  }

  /**
   * The FOCUS STAGE's build confirm (A on the build brief): arm the
   * premium colony-build hero and submit — the cube physically flies into
   * the stage's own destination slot (the big berth is the live anchor
   * while the stage is up). The stage STAYS: the build resolves where it
   * was configured. A board follow-up (an ocean/hazard build bonus)
   * self-heals via the `placementActive` watcher.
   */
  function onColonyBuildConfirm(payload?: {steps: ReadonlyArray<TradeStep>, captures: Readonly<Record<number, unknown>>, targets?: ColonyTradeTargets}): void {
    const pick = colonyPick.value;
    const name = colonyFocusState.colonyName;
    if (pick === undefined || name === '' || isColonyBuildActive()) {
      return;
    }
    const selected = coloniesForRail.value.find((c) => c.name === name);
    if (selected === undefined || !pick.selectable.includes(selected.name)) {
      return;
    }
    // A ROSTER act wearing the build's composition (a replacement that also builds): its own ONE confirm.
    if (pick.roster !== undefined) {
      onColonyRosterConfirm();
      return;
    }
    // THE STAGED DOOR (a card that builds by being played — TR25 Exclusive Colony): A on the stage is the PLAY's
    // one POST. The build itself is committed by the SAME body as the live door's (`armColonyBuildCommit`) —
    // only the address differs: the tile rides the parked play batch as its ADDRESSED tail, and the build
    // bonus's pre-collected answers ride BEHIND it, in order (the server replays the batch positionally and
    // parks whatever has not met its prompt yet — `deferredInputBatch`).
    if (pick.staged === true) {
      const staged = stagedColonyOf(stagedPlayState.arm);
      if (staged === undefined || stagedPlayState.committing) {
        return;
      }
      markColonyFocusCommitting();
      setWorkspaceFramePhase('colonies', 'committed');
      const build = armColonyBuildCommit(selected, pick, payload, 'staged');
      shell.commitStagedTail(
        {type: 'colony', colonyName: selected.name as ColonyName, stagedFor: staged.sourceCard},
        build.tail,
        // THE BUILD BONUS'S FOLLOW-UP IS BORN INSIDE THE STAGE on this door too: the claim is the COLONY's, made
        // AFTER the play's own optimistic one — a draw (Pluto) or a late card target lands in the stage's zone,
        // never in the hand's. A tile whose bonus asks nothing claims nothing, and the play's claim stands.
        () => claimColonyBuildOutcome(selected.name as ColonyName, build.slot));
      return;
    }
    // THE ATOMIC COMMIT of a build hosted by the STD-PROJECTS flow: this is
    // the single press that spends the project's cost (pay-on-commit), so
    // BOTH frames cross the boundary together — B stops meaning «отмена» and
    // starts meaning «свернуть», and the flow's conclusion (the build's own
    // payout finishing) is what closes the chain. `closeConsoleLayers` must
    // NOT run here: it pops the sheet-shaped host out from under the very
    // step that is committing.
    if (workspaceFrameHost('colonies') === 'standard-projects') {
      setWorkspaceFramePhase('standard-projects', 'committed');
      setWorkspaceFramePhase('colonies', 'committed');
    } else {
      closeConsoleLayers();
    }
    takeUpQuestion('answered');
    const build = armColonyBuildCommit(selected, pick, payload, 'live');
    // EMBEDDED OUTCOME — the same two lines the trade paths already have.
    // WITHOUT them a build whose placement bonus DRAWS (Pluto: «возьмите 2
    // карты») had no claim, so `workspaceClaimsColonyReveal` was false, the
    // section never published its embed zone and the reveal teleported to
    // `body` as a full-bleed band over the colony workspace. `kinds` is
    // STRUCTURAL — derived from the colony's own build benefit, so a colony
    // that grants no cards claims nothing and `reconcileWorkspaceOutcome`
    // has nothing to drop.
    claimColonyBuildOutcome(selected.name as ColonyName, build.slot);
    if (build.tail.length > 0) {
      shell.submitBatch([colonyResponse(selected.name), ...build.tail]);
      return;
    }
    shell.submit(colonyResponse(selected.name));
  }

  /**
   * THE BUILD'S COMMIT, ONE BODY FOR BOTH DOORS — everything a build confirm does that does not depend on how
   * the answer travels: the stage pins what it shows, the berth is the SERVER's (`buildSites` — the marker of
   * the pick; `nextBuildSlot` only where no door names one), the cube's hero is armed for that very berth with
   * the placement bonus's host card, and the bonus's pre-collected answers are built. Returns the berth (the
   * outcome claim reads the SAME one) and the tail of responses that follow the colony's own.
   */
  function armColonyBuildCommit(selected: ColonyModel, pick: ConsoleColonyPick, payload: {steps: ReadonlyArray<TradeStep>, captures: Readonly<Record<number, unknown>>, targets?: ColonyTradeTargets} | undefined, door: 'live' | 'staged'): {slot: number, tail: Array<InputResponse>} {
    // The guards accepted: freeze the stage's presentation for the whole
    // resolution (the answer flips its props under the flying cube).
    (shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection'))?.holdFocusStage();
    // The berth the cube takes — the hero, the outcome claim and the server all speak of the same one.
    const slot = nextBuildSlot(selected, buildSiteOf(pick.buildSites, selected.name));
    // THE PLACEMENT BONUS'S HOST CARD, chosen on the stage before the cube
    // moves (Titan's floaters). It rides the transaction so the reward chip
    // flies onto that exact card — and the tail below answers the prompt
    // the server is about to raise, so the player is never asked twice.
    armColonyBuild(selected.name, slot, shell.thisPlayer.color, payload?.targets?.incomeTargetCard, door);
    // The BUILD's own pre-collected tail — byte-identical to answering the
    // live prompts one at a time (`stepResponse`, the trade's own builder),
    // truncated at the first uncaptured step so a diverged decision still
    // arrives as an honest live prompt.
    const tail: Array<InputResponse> = [];
    for (const [i, step] of (payload?.steps ?? []).entries()) {
      const response = stepResponse(step, payload?.captures[i]);
      if (response === undefined) {
        break;
      }
      tail.push(response as InputResponse);
    }
    return {slot, tail};
  }

  /**
   * The FOCUS STAGE's generic pick confirm (setup remove / Aridor add-tile
   * / a card's free-trade SelectColony). A trade-labelled pick gets the
   * full premium launch (fleet + reward transaction + Pluto claim) and
   * resolves ON the stage; the one-shot picks fold back to the overview —
   * the server's next prompt (or the latch's finalize) drives what
   * surfaces next.
   */
  function onColonyPickConfirm(): void {
    const pick = colonyPick.value;
    const name = colonyFocusState.colonyName;
    // (A dock's bare pick answers through `onFleetDockConfirm` — the stage's
    // own confirm; this path is the colony tiles'.)
    if (pick === undefined || name === '') {
      return;
    }
    const selected = coloniesForRail.value.find((c) => c.name === name);
    if (selected === undefined || !pick.selectable.includes(selected.name)) {
      return;
    }
    // A ROSTER act (a tile replaced / added / removed): its own ONE confirm — staged and live doors alike.
    if (pick.roster !== undefined) {
      onColonyRosterConfirm();
      return;
    }
    // A STAGED COLONY (TR07): A on the stage is the PLAY's one submit — the parked batch with this tile as its
    // ADDRESSED tail. Nothing of the live pick's path applies (there is no live prompt to answer).
    if (pick.staged === true) {
      commitStagedColony(selected.name as ColonyName);
      return;
    }
    // A LIVE pick that LAYS A CITY on the chosen tile (TR22's live door — a re-ask, a reload, a play outside the
    // hand): the stage stays, pinned; the landing is ARMED for the transport's gate and plays on this stage with
    // the commit held to the contact. The same scene as the staged door — only A's verb and B differ.
    if (pick.tileSite !== undefined) {
      (shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection'))?.holdFocusStage();
      markColonyFocusCommitting();
      setWorkspaceFramePhase('colonies', 'committed');
      armColonyCity({colony: selected.name as ColonyName, space: pick.tileSite.space, color: pick.tileSite.color, card: pick.tileSite.card});
      takeUpQuestion('answered');
      shell.submit(colonyResponse(selected.name));
      return;
    }
    // A LIVE pick that MOVES the chosen tile's track (TR07's live door): the stage stays, pinned, and plays the
    // move once the answer carries it (the follow-up stays live through it); the same reading as the staged door.
    if (pick.trackMoves !== undefined) {
      const move = trackMoveOf(pick.trackMoves, selected.name);
      if (move !== undefined) {
        (shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection'))?.holdFocusStage();
        markColonyFocusCommitting();
        setWorkspaceFramePhase('colonies', 'committed');
        promiseColonyTrackMove({
          colony: selected.name as ColonyName, card: colonyModel.value?.choiceContext?.source.card,
          before: move.before, after: move.after,
        });
        takeUpQuestion('answered');
        shell.submit(colonyResponse(selected.name));
        return;
      }
    }
    closeConsoleLayers();
    takeUpQuestion('answered');
    if (pick.buttonLabel === 'trade') {
      if (isTradeFleetActive() || colonyTradeState.active) {
        return;
      }
      (shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection'))?.holdFocusStage();
      // The PRESSED cell — the origin of the pre-trade advance leg (a
      // trade-offset card moves the track forward before the reward is
      // read). Server truth as of the press; the manifest names where it
      // lands.
      armColonyTrade(selected.name as ColonyName, shell.thisPlayer.color, {}, selected.trackPosition);
      armTradeFleet(selected.name as ColonyName, shell.thisPlayer.color);
      // STRUCTURAL, like the build path beside it: a colony that pays in
      // production or plants has no follow-up stage to stand. `pick` rides
      // along when a reward can land ON a card — the defense that keeps a
      // late card-target prompt inside this workspace.
      {
        const kinds = colonyTradeClaimKinds(selected.name);
        if (kinds.length > 0) {
          claimWorkspaceOutcome('colonies', selected.name, kinds);
          markWorkspaceOutcomeArrivalDone();
          // The TRADE owns this batch's whole pacing (veil + cover flight):
          // the generic execution-beat gate must not hold the veiled reveal
          // off screen while the covers need its slots measured.
          markWorkspaceOutcomeBeatDone();
        }
      }
      shell.submit(colonyResponse(selected.name));
      return;
    }
    shell.submit(colonyResponse(selected.name));
    closeColonyFocus();
    if (!colonyEmbedActive.value) {
      goBoardHome();
    }
  }

  /**
   * THE COLONY FLOW IS OVER (the stage settled and folded itself). A
   * committed action only moves FORWARD: never back onto the overview the
   * player configured from. Whatever is still unresolved owns the screen —
   * a live task surface already took it — and otherwise the field does.
   */
  function onColonyFlowComplete(): void {
    // THE RESOLUTION'S LAST NET first: whatever local edge fired this
    // completion, nothing goes home while the viewer still owes a Pluto
    // follow-up (a pending discard, a flight, a parked batch). The gate has
    // one owner (colonyResolutionLive); this is its enforcement here.
    if (colonyResolutionLive.value) {
      return;
    }
    // A colony step of the STD-PROJECTS flow. The completion signal fires for
    // BOTH endings — the build and the cancel — so the discriminator is the
    // HOST FRAME's own phase, never the signal: past the commit boundary the
    // build happened and the WHOLE flow closes in one splice (never a flash
    // of the parent list between the payout and the board); still reversible
    // means the player CANCELLED, and the step simply folds back to the row
    // they came from (the flow's reconciler owns that leg).
    if (workspaceFrameHost('colonies') === 'standard-projects') {
      if (isCommitted(workspaceFramePhase('standard-projects') ?? 'browse')) {
        // ONE guarded conclusion for every ending of this workspace — never
        // a local close (the `stdpConclusionSignal` watcher re-asks it as
        // the holds fall, so a step that unmounts on its own schedule still
        // ends the flow instead of stranding the parent list on screen).
        shell.endStdProjectsFlow();
      }
      return;
    }
    // A STEP THIS FLOW HOSTS OR STILL OWES (the Redux Venus's delegate grant:
    // the Parliament's vote step standing inside these colonies, or its door
    // held behind the build's own beat): the ending routes through the ONE
    // guarded conclusion — it holds on `nested-step` / `owed-step` and
    // re-fires the moment the step leaves, so the colonies leave WITH the
    // whole result read and never before their step has been answered.
    // …and the same for a LOCKED-ENTRY TRADE standing inside another workspace (a card's or a party's door —
    // the Unity action: card-actions ⊃ colonies ⊃ parliament). Its flow-complete fires while the step still
    // stands ABOVE the colonies, so the projected section is the step's and the go-home below never ran: the
    // ending was dropped, and once the delegates were sent the colony grid stayed («ОСМОТР») over the seat's
    // next action until a reload (2026-10-26). Owed on the COLONIES frame — its hold is exactly the step above
    // it — and `concludeWorkspaceFlow` lands a locked trade's ending on the board, the whole flow with it.
    const colonyStepStands = workspaceFrameHasNested('colonies') ||
      (shell.followUpStepOwed && workspaceHostForStep() === 'colonies');
    if (colonyStepStands && (workspaceFrameIndex('colonies') === 0 || (colonyEmbedActive.value && colonyTradeEntryLocked()))) {
      shell.concludeWorkspaceFlowOrOwe('colonies');
      return;
    }
    // An embedded host normally CONTINUES the sequence (a played card's own
    // colony pick is one step of playing it) — but a card-sourced TRADE has
    // no continuation: the card action was never submitted, the trade IS the
    // whole move. Its host is a browse list of actions, and one of them has
    // just been used, so returning there would land the player on a screen
    // that no longer offers what they came from. A PARTY-sourced trade (the
    // Unity door — from the action menu or from the Parliament) is the same
    // case: the trade IS the whole move, so a finished one leaves.
    if ((colonyEmbedActive.value && !colonyTradeEntryLocked()) || shell.shellTaskActive) {
      return;
    }
    // A STEP ANOTHER FLOW RAISED hands the screen BACK to that flow — through the follow-up's own hand-over
    // (`settleColonyFollowUp`: the build's tokens, one read, the pop), never home. A host that carries its guest as
    // a SCENE (the Hydronetwork's stage-7 copied trade — the colonies stand over it as an overlay, so
    // `colonyEmbedActive` is false) reached the `goBoardHome` below and lost its whole flow: the result read, the
    // conclusion, the frame. Latent until P48's hosted dwell (`dwellColonyFollowUp`) outlasted this section's own
    // completion settle — the pop used to win the race (`console-hydro-copied-colony`, CI 2026-11-03).
    if (workspaceFrameHost('colonies') !== undefined && workspaceFrameAnchor('colonies')?.type === 'prompt') {
      if (!colonyFollowUpLive.value) {
        settleColonyFollowUp();
      }
      return;
    }
    if (consoleState.section === 'colonies') {
      goBoardHome();
    }
  }

  function closeColonyInspect(): void {
    shell.journalColonyInspect = undefined;
    consoleColoniesUi.inspectOpen = false;
  }

  /** The JOURNAL dossier owns the pad while open: the dossier itself
   *  scrolls its rules panel (↑/↓) and emits `cancel` on B; X — the verb
   *  that opened it — closes it too. (Pinned to its one colony — no paging,
   *  no trade bridge: history is read-only.) */
  function handleColonyInspectIntent(intent: GamepadIntent): void {
    if (intent.kind === 'press' && consoleActionOf(intent) === 'inspect') {
      closeColonyInspect();
      return;
    }
    const dossier = shell.surfaces.at<ExposedOf<typeof ConsoleColonyInspect>>('journalInspect');
    dossier?.handleIntent(intent);
  }

  /**
   * The FOCUS STAGE's ONE confirm: the trade and-response + every
   * pre-collected follow-up (M€ payment mix / track choice / card targets)
   * as a single PlayerInputBatch — byte-identical to answering the live
   * prompts one at a time (a diverged later step gracefully arrives as a
   * live prompt).
   */
  function onColonyTradeComposerConfirm(payload: {paymentIndex: number, steps: ReadonlyArray<TradeStep>, captures: Readonly<Record<number, unknown>>, targets?: ColonyTradeTargets}): void {
    const colonyName = colonyFocusState.colonyName;
    const ctx = tradeColonyContext.value;
    // Guard a double-confirm: once the launch is armed the flight (and then
    // the whole reward transaction) owns the moment, so a second press can
    // never re-submit — even after the ship has already docked.
    if (colonyName === '' || ctx === undefined || !ctx.colonies.includes(colonyName) ||
        isTradeFleetActive() || colonyTradeState.active) {
      return;
    }
    const batch = buildTradeBatch({
      tradePath: ctx.path,
      paymentIndex: payload.paymentIndex,
      colonyName,
      steps: payload.steps,
      captures: payload.captures,
    });
    // The stage's card-resource DESTINATIONS — its picked targets AND the
    // single-candidate AUTO targets the server applies without a prompt
    // (`colonyTradeCardDestinations`, one read for the flight and the
    // presented scene alike) — ride into the reward transaction so each
    // chip can fly onto the exact host card. The fallback derivation covers
    // an older payload shape (picks only, no autos).
    const targets: ColonyTradeTargets = payload.targets ?? (() => {
      const derived: ColonyTradeTargets = {};
      const bonusPicks: Array<CardName> = [];
      payload.steps.forEach((step, i) => {
        const capture = payload.captures[i];
        if (step.kind !== 'cardTarget' || capture === undefined) {
          return;
        }
        if (step.role === 'tradeReward') {
          derived.incomeTargetCard = capture as CardName;
        } else {
          bonusPicks.push(capture as CardName);
        }
      });
      if (bonusPicks.length > 0) {
        derived.bonusTargetCards = bonusPicks;
      }
      return derived;
    })();
    // PREMIUM LAUNCH — ITERATION 2: the trade RESOLVES ON THE FOCUS STAGE.
    // The stage does NOT fold at the confirm: the fleet lifts off the
    // always-visible fleet dock and docks at the HERO PLANET's orbital
    // berth, the reward waves launch from the stage's own result groups,
    // the Pluto payout reveals over the stage, and the white marker glides
    // home along the EXPANDED track — the action completes exactly where
    // it was configured. The WaitingFor `holdingForTradeFleet` gate blocks
    // the view commit until the ship docks; the section auto-folds back to
    // the overview only when the WHOLE transaction has settled (its
    // `colonyTradeState.active` falling edge). Desktop is unaffected.
    (shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection'))?.holdFocusStage();
    // …and the pressed cell, so a trade-offset card's forward step is a
    // MOVE the player watches instead of a number that changed (see the
    // overview path above).
    armColonyTrade(colonyName, shell.thisPlayer.color, targets,
      coloniesForRail.value.find((c) => c.name === colonyName)?.trackPosition);
    armTradeFleet(colonyName, shell.thisPlayer.color);
    // EMBEDDED OUTCOMES (north star): the player confirmed the trade INSIDE
    // the colony workspace, so its drawn payout (Pluto's income / colony
    // bonuses) presents INSIDE it — the section publishes an embed zone and
    // the reveal re-homes there. The claim is synchronous with the submit
    // (nothing may slip to a standalone band for a frame); `sourceCard`
    // carries the COLONY name (the claim key `workspaceClaimsColonyReveal`
    // matches the server's own `{type:'colony', colonyName}` batch source).
    // The claim is STRUCTURAL (`colonyTradeClaimKinds`) — a colony with no
    // card payout and no card-target reward claims nothing, so it stands no
    // follow-up stage; a trade that could have dealt but didn't is released
    // by `reconcileWorkspaceOutcome` a tick after the answer. The arrival
    // gate is opened up front: the trade transaction OWNS the pacing (veil
    // + cover flight + input lock), so the generic batch-arrival gate must
    // not double-hold the pad.
    {
      const kinds = colonyTradeClaimKinds(colonyName);
      if (kinds.length > 0) {
        claimWorkspaceOutcome('colonies', colonyName, kinds);
        markWorkspaceOutcomeArrivalDone();
        // Same as the overview-confirm path: the trade transaction owns the
        // pacing — the veiled reveal must mount promptly so the covers can
        // measure its landing slots.
        markWorkspaceOutcomeBeatDone();
      }
    }
    shell.submitBatch(batch);
  }

  /**
   * THE FLEET-DOCK STAGE's ONE confirm (Turmoil Redux TR06 — a trade whose
   * fleet goes to a CARD). The same guards as the colony composer (a fleet in
   * flight owns the moment), the same ONE batch builder with the other
   * destination (`{fleetDock}` — the second form of the colony answer), the
   * same flight with a CARD target. No colony transaction is armed (there is
   * no colony manifest) and no outcome is claimed (the reward is a PLACEMENT,
   * which the dock's own scene hands to the board).
   *
   * A card door's BARE pick (`SelectColony` with the dock marker — the fee
   * already paid by the card) answers `{type: 'colony', fleetDock}` alone.
   */
  function onFleetDockConfirm(payload: FleetDockConfirmPayload): void {
    const card = colonyFocusState.dock;
    if (card === '' || isTradeFleetActive() || colonyTradeState.active) {
      return;
    }
    const ctx = tradeColonyContext.value;
    const pick = colonyPick.value;
    const offer = (ctx?.docks ?? colonyModel.value?.fleetDocks ?? []).find((d) => d.card === card);
    if (offer === undefined || !offer.available) {
      return;
    }
    const section = shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection');
    if (ctx === undefined && pick?.buttonLabel === 'trade') {
      closeConsoleLayers();
      takeUpQuestion('answered');
      section?.holdDockStage();
      armTradeFleet({kind: 'card', card}, shell.thisPlayer.color);
      // The reward's target, chosen on the stage, rides the same submit (its fee was the card's, its question is not).
      const tail = payload.steps.flatMap((step, i) => step.kind === 'cardTarget' ? [stepResponse(step, payload.captures[i])] : [])
        .filter((response): response is NonNullable<typeof response> => response !== undefined);
      if (payload.asksCard) {
        claimWorkspaceOutcome('colonies', card, ['pick']);
      }
      if (tail.length > 0) {
        shell.submitBatch([tradeDestinationResponse({fleetDock: card}), ...tail]);
      } else {
        shell.submit(tradeDestinationResponse({fleetDock: card}));
      }
      return;
    }
    if (ctx === undefined) {
      return;
    }
    const batch = buildTradeBatch({
      tradePath: ctx.path,
      paymentIndex: payload.paymentIndex,
      fleetDock: card,
      steps: payload.steps,
      captures: payload.captures,
    });
    section?.holdDockStage();
    // A reward that lands ON A CARD (TR27): its target rides the batch, and should the server ask it again (a
    // stale pick, a tail parked behind another question) the question is THIS workspace's — the claim keeps it
    // inside the dock's stage instead of a band over the colonies. Released a tick after the answer when nothing
    // turned out to be asked.
    if (payload.asksCard) {
      claimWorkspaceOutcome('colonies', card, ['pick']);
    }
    armTradeFleet({kind: 'card', card}, shell.thisPlayer.color);
    shell.submitBatch(batch);
  }

  /** X on a dock (its tile, or its stage): the card itself, in the shared viewer — the live model, the fleet on its ▲. */
  function inspectFleetDock(card: CardName): void {
    const model = shell.thisPlayer.tableau.find((c) => c.name === card);
    // THE CARD IS LIFTED, never re-drawn (physical causality): from the dock's own stage it rises out of the hero,
    // on the overview out of its tile's art medallion (a cell of the colony grid) — the viewer holds that very slot
    // empty while the card is in the player's hands and lands it back there on close.
    const host = colonyFocusOpen.value && colonyFocusState.dock === card ? '.con-fleetdock' : '.con-colonies__grid';
    const key = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(card) : card.replace(/"/g, '\\"');
    openConsoleCardZoom([model ?? {name: card}], 0, undefined, undefined, {
      origin: {kind: 'physical', resolve: () => document.querySelector<HTMLElement>(`${host} [data-zoom-slot="${key}"]`)},
    });
  }

  /**
   * THE DOCK'S SCENE IS OVER (the card answered, read, left): the workspace
   * leaves as ONE surface through the ONE guarded conclusion — never a
   * `goBoardHome()` in the open — and the scene's hold falls at the END of
   * that leave (its root element leaving the document), so the ocean's
   * placement stands up over a clean board. A conclusion the flow refuses
   * (a step still owed) leaves the hold to its honest end: the placement is
   * admitted where it stands.
   */
  function onFleetDockFlowComplete(root: Element | null | undefined): void {
    // The stage is NOT folded first: it departs WITH the workspace, in one motion.
    const rootKind = workspaceStackRootKind();
    const concluded = rootKind === undefined || shell.concludeWorkspaceFlowOrOwe(rootKind);
    if (concluded) {
      releaseFleetDockHoldWhenGone(root);
    } else {
      // The flow still owes a step: the stage (its card already gone) folds
      // back to the overview, and the placement is admitted where it stands.
      closeColonyFocus();
      endFleetDockScene('conclusion-held');
    }
  }

  /**
   * THE STAGED HANDOFF TO THE COLONIES (TR07) — the store's fourth target,
   * the SAME entry as the vote's: the colony grid is pushed as a step INTO the
   * hand's own zone, out of the rect the landing scene lets go of. The cursor
   * lands on the first candidate (no auto-select: A there only descends).
   */
  async function enterStagedColony(arm: StagedPlayArm): Promise<void> {
    closeColonyFocus();
    resetColonyDockCursor();
    const pick = stagedColonyOf(arm);
    // A fresh door: no leaving tile is chosen yet (a replacement starts on «which tile leaves»).
    colonyRosterDraft.outgoing = undefined;
    const leavable = rosterLeavable(pick?.prompt.rosterChange);
    const first = pick === undefined ? -1 : coloniesForRailOf(pick.prompt).findIndex((c) =>
      pick.prompt.rosterChange?.kind === 'replace' ? leavable.includes(c.name as ColonyName) : pick.prompt.coloniesModel.some((m) => m.name === c.name));
    consoleState.colonyIndex = Math.max(0, first);
    await shell.enterStagedHostedStep(arm, {
      kind: 'colonies',
      subject: '',
      stage: 'Colony selection',
      phase: 'configure',
      // It serves no prompt — none exists yet; a re-asked pick earns `colony` in `settleStagedColony`.
      serves: [],
      anchor: {type: 'always'},
      sourceCard: arm.cardName,
    });
  }

  /** The rail a staged pick will show — the in-game colonies (a track pick is never an add-a-tile catalog). */
  function coloniesForRailOf(prompt: SelectColonyModel): ReadonlyArray<ColonyModel> {
    // A REPLACEMENT opens on the TABLE («which tile leaves»), though its prompt is a catalog one.
    return prompt.purpose === 'addNewColonyToGame' && prompt.rosterChange?.kind !== 'replace' ? prompt.coloniesModel : shell.game.colonies;
  }

  /** A roster pick's level change is the section's RESEAT (content lets go → the rail changes → content surfaces); no section — at once. */
  function reseatColonyRosterLevel(apply: () => void): Promise<void> {
    const section = shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection');
    if (section === undefined) {
      apply();
      return Promise.resolve();
    }
    return section.reseatRosterLevel(apply);
  }

  /**
   * THE ROSTER ACT'S ONE CONFIRM (A on the stage) — a tile is added, removed, or replaced (and built on). The
   * stage pins what it shows, the change is ARMED for the transport's gate (`consoleColonyRoster` — the
   * ceremony plays on this stage with the commit held), a colony the same answer builds arms the build hero on
   * the stage's own berth, and the answer goes out: the staged door's as the play's ADDRESSED tail (the one
   * POST), a live door's as the prompt's own response. A replacement names BOTH tiles in ONE answer.
   */
  function onColonyRosterConfirm(): void {
    const pick = colonyPick.value;
    const roster = pick?.roster;
    const name = colonyFocusState.colonyName;
    if (pick === undefined || roster === undefined || name === '' || colonyRosterPending() || isColonyBuildActive()) {
      return;
    }
    if (!pick.selectable.includes(name)) {
      return;
    }
    const kind = roster.prompt.kind;
    const outgoing = kind === 'replace' ? roster.outgoing : undefined;
    if (kind === 'replace' && outgoing === undefined) {
      return;
    }
    const staged = pick.staged === true ? stagedColonyOf(stagedPlayState.arm) : undefined;
    if (pick.staged === true && (staged === undefined || stagedPlayState.committing)) {
      return;
    }
    const build = kind === 'replace' ? rosterIncomingOf(roster.prompt, name)?.build : undefined;
    const builds = rosterBuildLands(build);
    (shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection'))?.holdFocusStage();
    markColonyFocusCommitting();
    setWorkspaceFramePhase('colonies', 'committed');
    takeUpQuestion('answered');
    armColonyRosterChange({
      kind,
      ...(kind === 'remove' ? {removed: name} : {added: name}),
      ...(outgoing !== undefined ? {removed: outgoing} : {}),
      builds,
    });
    if (rosterBuildLands(build)) {
      // The colony the same answer builds: the cube lands in the stage's own berth, AFTER the planet has docked.
      armColonyBuild(name, build.slot, shell.thisPlayer.color);
      if (staged === undefined) {
        claimColonyBuildOutcome(name, build.slot);
      }
    }
    const response: InputResponse = outgoing !== undefined ?
      {type: 'colony', colonyName: name, replaces: outgoing} : {type: 'colony', colonyName: name};
    if (staged !== undefined) {
      shell.commitStagedTail({...response, stagedFor: staged.sourceCard} as InputResponse);
      return;
    }
    shell.submit(response);
  }

  /**
   * THE BUILD'S EMBEDDED OUTCOME — a build whose placement bonus DRAWS (Pluto) or lands ON a card (Titan) keeps
   * its follow-up inside the colony workspace. STRUCTURAL: derived from the colony's own build benefit, so a
   * colony that grants no cards claims nothing. (The cover-lift scene owns the payout's pacing: the arrival and
   * the beat are reported done at claim time.)
   */
  function claimColonyBuildOutcome(colony: ColonyName, slotIndex: number): void {
    const kinds: Array<'draw' | 'pick'> = [];
    if (colonyBuildDrawsCards(getColony(colony), slotIndex)) {
      kinds.push('draw');
    }
    if (colonyBuildAsksCardTarget(getColony(colony), slotIndex)) {
      kinds.push('pick');
    }
    if (kinds.length > 0) {
      claimWorkspaceOutcome('colonies', colony, kinds);
      markWorkspaceOutcomeArrivalDone();
      // …and the BEAT is not owed either — exactly as on the trade paths. THE COVER-LIFT SCENE OWNS THIS PAYOUT'S
      // PACING: the build bonus separates from the slot's own printed card glyph and flies into the reveal's real
      // slots, which it can only measure once that reveal is MOUNTED. Leaving the beat pending held the surface
      // for the whole 2.6 s backstop, so the scene found no slots, degraded, and the cards then appeared out of
      // nothing — the reported «при строительстве карты просто появляются».
      markWorkspaceOutcomeBeatDone();
    }
  }

  /**
   * THE LANDING of a roster change the player made — the tile takes its final place. The ceremony played on the
   * stage with the commit held; the build's own beats (the cube, its reward, a follow-up it owes) have finished.
   * Now the rail is the TABLE again: its one fit lands under the parked stage, the fold's home is re-aimed at
   * the slot the tile holds there (a destination is solved before it is aimed at), and the stage folds HOME by
   * the existing phrase. The grid stands as a RECEIPT — no cursor, no verbs, input `none` — for one read, and
   * the flow goes on: a staged play ends with its step, any other door hands the screen forward.
   */
  async function landColonyRoster(): Promise<void> {
    if (colonyRosterState.landing) {
      return;
    }
    setColonyRosterLanding(true);
    const settle = (get: () => boolean) => new Promise<void>((resolve) => {
      if (!get()) {
        resolve();
        return;
      }
      const stop = vueWatch(get, (busy) => {
        if (!busy) {
          stop();
          resolve();
        }
      });
    });
    const frames = () => whenPainted();
    const dwell = (ms: number) => new Promise<void>((resolve) => {
      consoleSessionScope().guarantee(motionMs(ms), 'colonyController: a release\'s bound', resolve);
    });
    // The ceremony and the build's own scene first (a staged door's version move can arrive a tick before the
    // cube's handoff ends).
    await settle(() => colonyRosterState.live || isColonyBuildActive());
    const receipt = colonyRosterState.receipt;
    const section = shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection');
    await vueNextTick();
    await frames();
    if (receipt !== undefined && colonyFocusState.open && section !== undefined) {
      if (receipt.added !== undefined) {
        // The slot the tile now holds is where the result stands: the fold's «pressed tile» and the receipt's mark.
        const slot = coloniesForRail.value.findIndex((c) => c.name === receipt.added);
        if (slot !== -1) {
          consoleState.colonyIndex = slot;
          await vueNextTick();
        }
        section.retargetFocusHome(receipt.added);
      } else {
        section.releaseFocusInPlace();
      }
      closeColonyFocus();
      await dwell(COLONY_ROSTER_LANDING_MS + ROSTER_READ_MS);
    }
    const staged = stagedColonyOf(stagedPlayState.arm) !== undefined;
    clearColonyRoster();
    if (staged) {
      endStagedColony();
      return;
    }
    settleColonyFollowUp();
  }

  /**
   * HOME — the end of a city's landing on a colony tile (TR22), the roster landing's own grammar. The scene played
   * on the stage (the commit applied at the contact; the cube, the count and the read followed under the scene's
   * hold). Now the stage folds HOME into its tile by the existing phrase — the city's seat rides it as the carried
   * object into its box in the tile's head — and the grid stands as a RECEIPT (no cursor, no verbs, input `none`)
   * for one read. Then the flow goes on: a staged play ends with its step, any other door hands the screen forward.
   */
  async function landColonyCity(): Promise<void> {
    if (colonyCityState.homing) {
      return;
    }
    setColonyCityHoming(true);
    const frames = () => whenPainted();
    const dwell = (ms: number) => new Promise<void>((resolve) => {
      consoleSessionScope().guarantee(motionMs(ms), 'colonyController: a release\'s bound', resolve);
    });
    // The scene first — through its read (resolved at once when none is playing; it never rejects).
    await colonyCitySceneDone();
    const receipt = colonyCityState.receipt;
    const section = shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection');
    await vueNextTick();
    await frames();
    if (receipt !== undefined && colonyFocusState.open && section !== undefined) {
      // The fold's home is the tile the city now lies on — re-measured at rest (a destination is solved before it
      // is aimed at); a tile that cannot be measured lets the stage go where it stands.
      section.retargetFocusHome(receipt.colony);
      closeColonyFocus();
      await dwell(COLONY_ROSTER_LANDING_MS + ROSTER_READ_MS);
    }
    const staged = stagedColonyOf(stagedPlayState.arm) !== undefined;
    clearColonyCity();
    if (staged) {
      endStagedColony();
      return;
    }
    settleColonyFollowUp();
  }

  /**
   * HOME — the end of a STAGED BUILD (TR25 Exclusive Colony), the roster landing's and the city's own grammar. The
   * cube landed on the stage with the commit held; the build bonus's continuation — a draw being taken in the
   * stage's zone, the chosen card receiving its resources, a step the bonus hosts — plays INSIDE the stage and
   * is waited out (`colonyBuildContinuationOwed`: state, never a timer — a player may read a draw as long as
   * they like). Then the stage folds HOME into its tile — the berth the cube took stands on that tile already,
   * so nothing is re-laid — and the grid stands as a RECEIPT (no cursor, no verbs, input `none`) for one read.
   * A board placement the bonus raised (Europa's ocean) is not waited for: it takes the board once the hand
   * has left with the step.
   */
  async function landColonyBuild(): Promise<void> {
    if (colonyBuildState.homing) {
      return;
    }
    setColonyBuildHoming(true);
    const settle = (get: () => boolean) => new Promise<void>((resolve) => {
      if (!get()) {
        resolve();
        return;
      }
      const stop = vueWatch(get, (busy) => {
        if (!busy) {
          stop();
          resolve();
        }
      });
    });
    const frames = () => whenPainted();
    const dwell = (ms: number) => new Promise<void>((resolve) => {
      consoleSessionScope().guarantee(motionMs(ms), 'colonyController: a release\'s bound', resolve);
    });
    // The cube's own scene first (a version move can arrive a tick before its handoff ends)…
    await settle(() => isColonyBuildActive());
    // …one flush for the answer's own follow-up to surface (a claim, a prompt), then all of it.
    await vueNextTick();
    await settle(() => colonyBuildContinuationOwed.value);
    const receipt = colonyBuildState.receipt;
    const section = shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection');
    await vueNextTick();
    await frames();
    if (receipt !== undefined && colonyFocusState.open && section !== undefined) {
      // The fold's home is the tile the colony now stands on — re-measured at rest (a destination is solved
      // before it is aimed at); a tile that cannot be measured lets the stage go where it stands.
      section.retargetFocusHome(receipt.colony);
      closeColonyFocus();
      if (colonyBuildGrantPrompt.value) {
        // THE DELEGATES THE TILE PAYS (the Redux Venus): the stage is home — now the Parliament's vote step takes
        // the section's central area (its door was held while the stage stood), and the receipt is read after it.
        // «Home» is a STATE: the stage's own node has left the section (its fold ended), bounded.
        await new Promise<void>((resolve) => {
          let left = 80;
          const look = () => {
            const stage = section.rootEl?.querySelector('.con-colfocus');
            if (stage === null || stage === undefined || --left <= 0) {
              resolve();
              return;
            }
            probeTick(look);
          };
          look();
        });
        const task = shell.shellTask;
        if (task !== undefined && task.kind === 'party' && colonyBuildGrantPrompt.value) {
          shell.openShellTaskSurface(task);
        }
        await vueNextTick();
        await settle(() => colonyBuildSectionStepOwed.value);
        await vueNextTick();
        await frames();
      }
      await dwell(COLONY_ROSTER_LANDING_MS + ROSTER_READ_MS);
    }
    const staged = stagedColonyOf(stagedPlayState.arm) !== undefined;
    clearColonyBuildReceipt();
    if (staged) {
      endStagedColony();
      return;
    }
    settleColonyFollowUp();
  }

  /**
   * THE STAGED COLONY'S COMMIT (TR07) — A on the tile's stage. The one POST:
   * `[projectCard + payment, …pre-collected, {colony, colonyName, stagedFor}]`.
   * The stage pins what it shows (the commit boundary), the crumb goes amber,
   * and the move the answer will carry is PROMISED — it is seeded from the
   * views' diff in the apply block and played on this stage, never before.
   */
  function commitStagedColony(colony: ColonyName): void {
    const arm = stagedPlayState.arm;
    const staged = stagedColonyOf(arm);
    if (arm === undefined || staged === undefined || stagedPlayState.committing) {
      return;
    }
    (shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection'))?.holdFocusStage();
    markColonyFocusCommitting();
    setWorkspaceFramePhase('colonies', 'committed');
    const move = trackMoveOf(staged.prompt.trackMoves, colony);
    if (move !== undefined) {
      promiseColonyTrackMove({colony, card: arm.cardName, before: move.before, after: move.after});
    }
    // A CITY ON THE CHOSEN TILE (TR22): the landing is ARMED for the transport's gate — an answer that carries
    // exactly this tile plays it on this stage with the commit held to the contact; any other answer drops the arm.
    const site = staged.prompt.tileSite;
    if (site !== undefined) {
      armColonyCity({colony, space: site.space, color: site.color, card: site.card});
    }
    shell.commitStagedTail({type: 'colony', colonyName: colony, stagedFor: staged.sourceCard});
  }

  /**
   * A version move under a STAGED COLONY (TR07). Before the commit the world
   * moved under an unsent play (its preview is void → back to the composer);
   * after it the answer is in and the step settles into one of its three
   * honest outcomes.
   */
  function reconcileStagedColonyWorldMove(): void {
    const arm = stagedPlayState.arm;
    if (arm === undefined) {
      return;
    }
    const played = shell.playerView.thisPlayer.tableau.some((c) => c.name === arm.cardName);
    if (stagedPlayState.committing || played) {
      settleStagedColony(arm);
      return;
    }
    shell.cancelStagedPlay();
    shell.showNotice('Game state changed');
  }

  /**
   * THE THREE OUTCOMES OF A STAGED COLONY'S COMMIT (the staged cell's
   * §9-quater, mirrored once more). The play itself is real in all three.
   *  · LANDED — the chosen tile's marker moved: the apply block held it on its
   *    old cell and owed the move; the stage plays it, then the step and the
   *    play end together (`endStagedColony`).
   *  · RE-ASKED — the server dropped the tail as stale and the card's own pick
   *    stands LIVE: the standing grid / stage becomes that live door in place
   *    (the frame earns the prompt, nothing closes and nothing opens).
   *  · PARKED — another prompt stands in front of the card's own: nothing
   *    moved, so nothing moves; the step leaves, the track arrives with the
   *    ordinary update once the server's drain lands the parked answer.
   */
  function settleStagedColony(arm: StagedPlayArm): void {
    const wf = shell.playerView.waitingFor;
    const reAsked = wf?.type === 'colony' && wf.choiceContext?.source.kind === 'card' && wf.choiceContext.source.card === arm.cardName;
    if (reAsked) {
      clearStagedPlay();
      clearColonyTrackMove();
      // (A roster arm goes with the staged door; the draft of the leaving tile stays — the level stands live.)
      disarmColonyRoster();
      // (…and so does a city's arm: the live door's own A arms it again.)
      disarmColonyCity();
      // (…and a build's: the answer carried no cube, so its hero was aborted at the detect — nothing stands as
      // a receipt, and the live door's own A arms it again.)
      clearColonyBuildReceipt();
      colonyFocusState.committing = false;
      (shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection'))?.releaseFocusStage();
      setWorkspaceFrameServes('colonies', ['colony']);
      setWorkspaceFramePhase('colonies', 'committed');
      setWorkspaceFramePhase(stagedStepHost(arm) ?? 'hand', 'committed');
      const frame = workspaceStackTop();
      if (frame !== undefined && frame.kind === 'colonies') {
        frame.anchor = {type: 'prompt', promptType: 'colony'};
      }
      return;
    }
    // LANDED as a ROSTER change (TR10): the gate played it on the stage with the commit held — what is left is
    // the LANDING (the stage folds home into the slot, the receipt is read), then the step and the play end.
    if (colonyRosterState.receipt !== undefined || colonyRosterState.live) {
      void landColonyRoster();
      return;
    }
    // LANDED as a CITY on the tile (TR22): the gate played the landing with the commit held to the contact — the
    // rest of the scene is still on stage; what is left is HOME (the stage folds into its tile, the receipt is
    // read), then the step and the play end.
    if (colonyCityState.receipt !== undefined) {
      void landColonyCity();
      return;
    }
    // LANDED as a BUILD (TR25): the gate played the cube on the stage with the commit held — what is left is
    // everything the build bonus still owes INSIDE the stage, then HOME (the stage folds into its tile, the
    // receipt is read), then the step and the play end.
    if (colonyBuildState.door === 'staged' && (isColonyBuildActive() || colonyBuildState.receipt !== undefined)) {
      void landColonyBuild();
      return;
    }
    if (colonyTrackMoveFlow.live) {
      // The move is already on stage (a second view of the same answer) — its own landing ends the step.
      return;
    }
    if (colonyTrackMoveFlow.owed !== undefined) {
      void playStagedColonyMove(arm.cardName);
      return;
    }
    // PARKED — or a lost answer whose truth a forced update brought (the card is on the table, nothing was
    // held): nothing moved on screen, so nothing flies; the step and the play end together.
    endStagedColony();
  }

  /** LANDED: the move plays on the stage it was confirmed on; once it has landed and been read the flow leaves. */
  async function playStagedColonyMove(cardName: CardName): Promise<void> {
    await playOwedColonyTrackMove();
    // Only the flow that started the move ends here (a B / abort meanwhile already ended it).
    if (stagedColonyOf(stagedPlayState.arm) !== undefined && stagedPlayState.arm?.cardName === cardName) {
      endStagedColony();
    }
  }

  /** The staged colony's step and the play it belonged to end together — the hand's one guarded conclusion takes the whole stack. */
  function endStagedColony(): void {
    // The pick IS the staged store's (`colonyModel` falls back to it): read AFTER the clear it is gone, and the
    // section riding the hand's dissolve lost its pick mid-leave — the stage let go and the grid un-parked under it.
    const pick = colonyPick.value;
    const flow = stagedPlayState.arm?.flow;
    clearStagedPlay();
    clearColonyTrackMove();
    clearColonyRoster();
    // (A PARKED city: the arm goes with the step — the tile arrives with the ordinary update, as a watcher's.)
    clearColonyCity();
    // (…and a staged build's receipt: the step it belonged to is over.)
    clearColonyBuildReceipt();
    if (flow === 'law') {
      // A card played THROUGH A LAW (RX36): the colony step stood in the law's stage — the stage and the step end
      // together through «Действия карт»'s one guarded conclusion.
      shell.endCardActionsWithHostedStep();
      return;
    }
    shell.endHandWithHostedStep(pick);
  }

  /** The hosted colonies' ride is over (the hand's dissolve ended, or its net): the section may unmount now. */
  function releaseColoniesLeave(): void {
    coloniesLeaveNet.value?.();
    coloniesLeaveNet.value = undefined;
    if (!coloniesLeaving.value) {
      return;
    }
    coloniesLeaving.value = false;
    colonyEmbedLatch.value = '';
    colonyPickLatch.value = undefined;
    // The reset the section watcher deferred to the ride's end (a frame-less colonies stage is a reset one).
    resetColonyFocus();
    resetConsoleColoniesUi();
  }

  // (The old trade-composer close-on-dock watcher is gone: the COLONY FOCUS
  // STAGE folds back to the browse surface AT the confirm — the flight and
  // the reward transaction play over the surface they belong to.)
  //
  // PLUTO COMES HOME. The colony workspace is the trade transaction's HOME
  // surface. A Pluto sequence legitimately walks away from it (each colony
  // bonus's discard runs on the hand in select mode); the moment the NEXT
  // payout batch arrives — or the closing track glide needs the traded tile
  // — the section returns, so the covers/marker have their physical anchors
  // and the reveal lands EMBEDDED in the workspace again (never a detached
  // fullscreen modal mid-flow). The claim is re-established structurally
  // from the transaction itself: the hand trip released it (the embed's
  // falling edge), and the transaction — not a timer — is the truth that
  // says the flow is still ours.
  function whenTradePayoutIncomingChanges(incoming: boolean): void {
    if (!incoming) {
      return;
    }
    if (workspaceOutcomeState.host !== 'colonies' && colonyTradeState.colonyName !== '') {
      // A payout is incoming, so `draw` is claimed even when the structural
      // lookup cannot see the colony any more; `pick` rides along when the
      // colony's rewards can land on a card (the late-prompt defense).
      const kinds = colonyTradeClaimKinds(colonyTradeState.colonyName);
      claimWorkspaceOutcome('colonies', colonyTradeState.colonyName, kinds.some((k) => k !== 'venus-bonus') ? kinds : ['draw', ...kinds]);
      markWorkspaceOutcomeArrivalDone();
    }
    bringColoniesHome();
  }

  /**
   * The same return, for a payout we hold a claim on that the TRADE
   * transaction cannot explain (a build's draw, a second colony bonus after
   * a hand discard). The claim is the truth; the section comes back so the
   * reveal lands INSIDE the workspace instead of over it.
   */
  function whenColonyPayoutIncomingChanges(incoming: boolean): void {
    if (incoming) {
      bringColoniesHome();
    }
  }

  /** ONE WRITER for the sequence context (see `colonyBonusSequence`). */
  function whenColonySequenceKeyChanges(): void {
    noticeColonyBonusSequence(
      colonyBonusDiscardOf(shell.playerView.waitingFor), colonyResolutionEvidence.value);
  }

  /**
   * THE SEQUENCE'S BOUNDED WAIT (`COLONY_BONUS_CYCLE_WAIT_MS`) — the same
   * shape as the entry's, at the other seam: armed when the server's ordinal
   * says another cycle is owed and nothing of it has arrived, cancelled by
   * the evidence itself, and released on the net so it can never become the
   * latch it exists to replace.
   */
  function whenBonusSequenceAwaitingChanges(awaiting: boolean): void {
    disarmColonyCycleNet();
    if (!awaiting) {
      return;
    }
    disarmColonyCycleNet = flow.guarantee(COLONY_BONUS_CYCLE_WAIT_MS, 'the colony-bonus sequence\'s next cycle (its bounded wait)', () => {
      noteColonyBonusCycleWaitOver();
    });
  }

  /** WATCH `colonyResolutionEvidence` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenColonyResolutionEvidenceChanges(live: boolean): void {
    if (live) {
      noteColonyBonusEntryWaitOver();
    }
  }

  /**
   * …AND A WAIT NOBODY ANSWERS STILL ENDS. The net is bounded and named
   * (`COLONY_BONUS_ENTRY_WAIT_MS`): armed with the wait, cancelled the
   * instant it is over. Nothing is torn down here — the flag simply stops
   * being a reason to stand, and if genuine evidence exists by then the
   * resolution carries on unaffected.
   */
  function whenColonyEntryAwaitingChanges(awaiting: boolean): void {
    disarmColonyEntryWait();
    if (!awaiting) {
      return;
    }
    disarmColonyEntryWait = flow.guarantee(COLONY_BONUS_ENTRY_WAIT_MS, 'the colony-bonus entry\'s first evidence (its bounded wait)', () => {
      noteColonyBonusEntryWaitOver();
    });
  }

  /**
   * THE COLONY RESOLUTION'S LIFECYCLE — one watcher, both edges.
   *
   * RISING: the workspace crosses the commit boundary for the whole span of
   * the resolution. The frame's phase goes `committed` (B = «свернуть», the
   * crumb's accent turns amber, `hosts: 'inFlow'` starts answering — the
   * hand can now mount INSIDE as a step), and the frame EARNS `handSelect`
   * so the leak detector knows the mandatory discard is served here.
   *
   * FALLING: the resolution is over — no pending input, no flight, the
   * track reset committed. Only now the claim releases, the serves shrink
   * back, and the phase returns to the player's own depth. This is the ONE
   * close gate the task demanded: nothing folds earlier — and the entry's
   * bounded wait above is what guarantees this edge can be REACHED at all.
   */
  /**
   * THE SETTLEMENT TABLE ARMS ON THE SERVER'S ORDINAL — a colony-bonus discard of a payout with several
   * settlements (`total > 1`) stands the table (or advances it) BEFORE anything renders: pre-flush, so the trade's
   * cover scene (a later scheduler job) already knows how many places to deal sealed, and the reveal mounts as
   * the table from its first frame.
   */
  function whenSettlementMarkerKeyChanges(): void {
    const pair = settlementPairOf(shell.playerView.waitingFor);
    if (pair !== undefined && pair.meta.total > 1) {
      armSettlementTable(pair.meta.colonyName, pair.meta.total, pair.meta.index, pair.via);
    }
  }

  /** The stranded flag's own release — see `colonyDiscardStageStranded`. */
  function whenColonyDiscardStageStrandedChanges(stranded: boolean): void {
    if (stranded) {
      void restoreColonyFocusAfterDiscard();
    }
  }

  /** WATCH `colonyResolutionLive` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenColonyResolutionLiveChanges(live: boolean, was: boolean): void {
    if (live && !was) {
      resetColonyResolutionUi(); // a fresh resolution starts a fresh receipt
      colonyResolutionReleaseOwed.value = false; // a new resolution owns the claim again
      if (workspaceFrameMounted('colonies')) {
        setWorkspaceFramePhase('colonies', 'committed');
        setWorkspaceFrameServes('colonies', COLONY_RESOLUTION_SERVES);
      }
      return;
    }
    if (!live && was) {
      clearColonyBonusEntry();
      clearColonyBonusSequence();
      clearSettlementTable(); // the table ends with its resolution (one instance per resolution)
      setColonyDiscardStage(false);
      colonyFocusRestorePending.value = false;
      colonyBonusCollected.value = ''; // a new payout may repeat a cube key
      if (workspaceOutcomeState.host === 'colonies') {
        // The funnel may refuse (a stale-view echo of an already-consumed
        // batch, a mid-flush blink). The intent stands: the serving probe's
        // own falling edge re-executes it (`workspaceOutcomeServingNow`
        // watcher), so the close is bounded by the evidence's lifetime,
        // never by the 20 s claim safety.
        colonyResolutionReleaseOwed.value = !releaseWorkspaceOutcome('resolution-end');
      }
      if (workspaceFrameMounted('colonies')) {
        setWorkspaceFrameServes('colonies', ['colony']);
        if (!workspaceFrameHasNested('colonies')) {
          setWorkspaceFramePhase('colonies', colonyFocusState.open ? 'configure' : 'browse');
        }
      }
    }
  }

  /**
   * THE NEXT CUBE COLLECTS ITSELF. A recipient with several settlements on
   * one colony is paid one cube at a time (the server resolves each in full
   * before the next), so the second delivery arrives while the player is
   * ALREADY standing on that colony's stage. Announcing it again would send
   * them back to the board to press A on the same colony they are looking
   * at; instead the workspace answers it the moment its table is clear —
   * the next card then arrives into the very stage that is already open.
   *
   * Gated on an EMPTY table on purpose: submitting while the previous card
   * is still lying there would draw the next one into a batch the player is
   * mid-way through taking.
   */
  function whenColonyBonusAutoCollectChanges(key: string): void {
    if (key === '' || key === colonyBonusCollected.value) {
      return;
    }
    colonyBonusCollected.value = key;
    // The announcement must not fire for a beat we are answering ourselves.
    const beat = shell.mandatoryBeat;
    if (beat !== undefined) {
      acknowledgeMandatoryBeat(beat.key);
    }
    shell.submit({type: 'option'});
  }

  // The closing track glide measures the traded tile's own track cells —
  // the section must be mounted for the marker to physically step home.
  function whenColonyTradeStateGlideNonceChanges(): void {
    if (colonyTradeState.active) {
      bringColoniesHome();
    }
  }

  // ── THE COLONIES FRAME's lifecycle ────────────────────────────────────
  // Rising edge of a SelectColony prompt: PUSH the colonies onto whatever
  // flow the player is standing in. The frame is the claim — there is no
  // second place recording «who hosts whom», so it cannot disagree with the
  // stack, and the host cannot be re-derived later (after the composer left,
  // after a screen change) into a different answer.
  // …and it is the ADMITTED door, never the raw prompt (`colonyPromptOpenable`):
  // one press can produce several effects in one response, and the previous
  // one must be worked through before this surface is handed over. Reactive,
  // so the push happens by itself on the frame the chain clears.
  function whenColonyPromptOpenableChanges(on: boolean): void {
    if (!on || workspaceFrameIndex('colonies') !== -1) {
      return;
    }
    openColoniesForPrompt();
  }

  // THE RAISE BELONGS TO ITS PROMPT (P48): the server asked something else — whatever it still holds is released.
  function whenColonyTrackRaiseKeyChanges(key: string): void {
    const owed = colonyTrackRaiseFlow.owed;
    if (owed !== undefined && owed.key !== key) {
      clearColonyTrackRaise();
    }
  }

  // The follow-up ended (rewards granted, Pluto resolved, track reset) — the
  // colonies frame is done and pops, uncovering whatever hosted it.
  function whenColonyFollowUpLiveChanges(live: boolean, was: boolean): void {
    if (live || !was) {
      return;
    }
    settleColonyFollowUp();
  }

  // THE STRANDED-COLONY SELF-HEAL: a live SelectColony that no frame serves
  // degrades to the STANDALONE colonies — never to a prompt with no surface.
  // The deferred flush gives a mounting host its tick before the verdict.
  function whenColonyPromptStrandedChanges(stranded: boolean): void {
    if (stranded) {
      openColoniesForPrompt();
    }
  }

  // TRADE-REWARD transaction: report the traded colony's COMMITTED track
  // position to the orchestrator. The server sequences its reset AFTER
  // every reward (including interactive colony bonuses that resolve over
  // several responses — Pluto's discards), so the reset can arrive via the
  // gated commit OR a later poll; this one watcher covers both, and the
  // reset glide runs only once the drop truly committed — AND only once the
  // glide's own stage is standing (syncColonyTrackCommit's gate).
  function whenArmedColonyTradeTrackChanges(): void {
    syncColonyTrackCommit();
  }

  /** WATCH `consoleState.section` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenConsoleStateSectionChanges(section: string): void {
    // «СРАБАТЫВАНИЕ КАРТЫ» (iteration 3): the player walked to another screen while the table's reactions play —
    // they HURRY (a pace, never a cut; a fold back to the board home is the flow's own ending, never a hurry).
    if (section !== 'board' && cardReactionPending()) {
      hurryCardReactions('navigation');
    }
    // `section` is a PROJECTION of the deepest frame — a hand step nested
    // INSIDE the colonies projects 'hand' while the focus stage is still
    // the standing host of its zone, and a PARKED resolution must come back
    // at full depth. The stage therefore resets only when the colonies
    // frame is genuinely GONE (neither live nor parked) — «the section
    // moved» alone is not «the player left».
    // …and a hosted step that RIDES its host's dissolve (`coloniesLeaving`) is gone as a frame but still on
    // screen: its reset waits for the ride's own end (`releaseColoniesLeave`) — resetting here un-parked the grid
    // under the leaving stage for the whole dissolve.
    if (section !== 'colonies' && colonyFocusState.open && !workspaceFrameKnown('colonies') && !coloniesLeaving.value) {
      resetColonyFocus();
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
      // …but a hand standing on a COMMITTED STAGE has no album on screen for
      // the cards to be in — its shelf is parked behind the play's own scene
      // and the pack has already gone home («the silent return»). Calling
      // that `open` would both lie and freeze the pack: the layer skips its
      // pose ride for every phase but `docked`.
      if (section === 'hand' && handRevealState.phase === 'docked' && !shell.handAlbumParked) {
        handRevealState.phase = 'open';
      } else if (section !== 'hand') {
        // LEAVING the hand by any route resets the presentation — including
        // from 'opening'/'closing'.
        //
        // ⚠️ Those two used to be excluded «because they belong to a
        // director episode in its pre-install flush». The fear was real but
        // the exclusion was over-broad: that birth happens with the section
        // set TO 'hand', so this `section !== 'hand'` branch can never kill
        // it. What the exclusion DID do was strand the pre-install window —
        // `phase='opening'` + `holdSlots=true` are set BEFORE the measure,
        // so a section change in that gap latched `holdSlots` true FOREVER:
        // every hand slot rendered held (invisible), and the dock's intake
        // accent (which used to read this flag) disabled the compact pose
        // for the rest of the game.
        resetHandReveal();
      }
    }
  }

  /**
   * A STAGED VOTE'S COMMIT WAS REFUSED (or its answer lost): the transport's
   * abort battery cleared `committing` with the arm still standing. The play
   * is «not yet made» again — the mode gets its hands back on the same
   * selection (B still walks back to the composer), the hand's beat ends,
   * and the claim made at the press answers for nothing.
   */
  /**
   * THE STAGED COLONY'S COMMIT WAS REFUSED (TR07 — the abort battery cleared
   * `committing` with the arm standing): the stage is a door again on the same
   * tile, the hand's beat ends, the claim made at the press answers for nothing.
   */
  /** A roster pick's DRAFT belongs to the prompt that asked: no roster question standing and no flow of its own → no draft. */
  function whenColonyRosterLevelChanges(level: RosterLevel | undefined): void {
    if (level === undefined && !colonyRosterPending() && colonyRosterState.receipt === undefined) {
      colonyRosterDraft.outgoing = undefined;
    }
  }

  /** THE CURSOR IS A NAME: the table under it changed → it follows its colony (or the successor of one that left). */
  function whenColonyRailNamesChanges(next: string, prev: string): void {
    const names = next === '' ? [] : next.split('|');
    // A LEVEL CHANGE of a roster pick names where the cursor lands on the new rail (the first reserve tile; the
    // tile un-chosen by B) — the old rail's focus has no meaning on it.
    const target = colonyCursorTarget.value;
    colonyCursorTarget.value = '';
    consoleState.colonyIndex = target !== '' && names.includes(target) ? names.indexOf(target) :
      reanchorColonyCursor(prev === '' ? [] : prev.split('|'), names, consoleState.colonyIndex);
    // THE TILE UNDER AN OPEN STAGE / DOSSIER LEFT THE TABLE (somebody else replaced or removed it): the surface
    // has no subject any more — it folds honestly and says why, instead of standing open over nothing with the
    // grid parked beneath it. The player's OWN change is not this case: its ceremony owns the stage until it ends.
    const subject = colonyFocusState.colonyName;
    if (colonyFocusState.open && subject !== '' && !names.includes(subject) &&
        !colonyRosterState.live && colonyRosterState.armed === undefined && colonyRosterState.receipt === undefined) {
      closeColonyFocus();
      shell.showNotice(translateTextWithParams('The ${0} colony tile was removed from the table', [translateText(subject)]));
    }
  }

  /** WATCH `stagedColonyCommitting` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenStagedColonyCommittingChanges(now: boolean, was: boolean): void {
    if (now || !was || stagedColonyModel.value === undefined) {
      return;
    }
    (shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection'))?.releaseFocusStage();
    colonyFocusState.committing = false;
    // The step's HOST takes its decision back — the hand's play, the law's stage (RX36).
    setWorkspaceFramePhase(stagedStepHost() ?? 'hand', 'configure');
    setWorkspaceFramePhase('colonies', 'configure');
    if (workspaceOutcomeState.host === 'hand') {
      releaseWorkspaceOutcome('staged-colony-refused');
    }
  }

  return {
    coloniesLeaving,
    colonyEmbedLatch,
    colonyPickLatch,
    coloniesLeaveNet,
    colonyFocusRestorePending,
    colonyBonusCollected,
    colonyResolutionReleaseOwed,
    colonyCursorTarget,
    settlementMarkerKey,
    settlementTableParked,
    colonyStepReturnGatesPrompt,
    colonyModel,
    colonyPick,
    stagedColonyModel,
    stagedColonyCommitting,
    colonyBuildContinuationOwed,
    colonyActAnswered,
    colonyBuildGrantPrompt,
    colonyBuildSectionStepOwed,
    colonyRailIsCatalog,
    colonyRosterOutgoing,
    colonyRosterLevel,
    coloniesForRail,
    colonyRailNames,
    colonyCancellable,
    armedColonyTradeTrack,
    tradeColonyContext,
    tradeableColonyNames,
    colonyDocks,
    viewerFreeFleets,
    colonyTradeBlockReason,
    colonyInspectModel,
    colonyFocusOpen,
    colonyInspectAct,
    colonyFocusTradeable,
    tradePayoutIncoming,
    colonyPayoutIncoming,
    colonyDiscardStageStranded,
    colonyResolutionSignals,
    colonyBonusCardPick,
    colonyEntryAwaiting,
    colonyResolutionEvidence,
    colonySequenceKey,
    colonyResolutionLive,
    colonyBonusAutoCollect,
    colonyResolutionColonyName,
    remoteColonyBonusPending,
    colonyPromptRaw,
    colonyTrackRaiseKey,
    colonyPromptOpenable,
    colonyFollowUpLive,
    colonyGrantStepLive,
    colonyGrantColony,
    colonyEmbedTarget,
    colonyEmbedActive,
    colonySectionTarget,
    colonyEmbedSourceResolution,
    colonyEmbedHasSource,
    colonyEmbedSourceCard,
    colonyPromptStranded,
    settleColonyFollowUp,
    dwellColonyFollowUp,
    resumeStackFromBoardAndSettle,
    openColoniesForPrompt,
    tellColonyTrackRaise,
    onCardActionsColonyStep,
    landColonyCursorOnTradeable,
    bringColoniesHome,
    syncColonyTrackCommit,
    restoreColonyFocusAfterDiscard,
    enterColonyBonusStage,
    openColonyBonusCollect,
    openColonyBonusDiscard,
    colonyTradeDealsCards,
    colonyTradeClaimKinds,
    onColonyInspectEnter,
    enterColonyFocus,
    confirmColonySelection,
    onColonyBuildConfirm,
    armColonyBuildCommit,
    onColonyPickConfirm,
    onColonyFlowComplete,
    closeColonyInspect,
    handleColonyInspectIntent,
    onColonyTradeComposerConfirm,
    onFleetDockConfirm,
    inspectFleetDock,
    onFleetDockFlowComplete,
    enterStagedColony,
    coloniesForRailOf,
    reseatColonyRosterLevel,
    onColonyRosterConfirm,
    claimColonyBuildOutcome,
    landColonyRoster,
    landColonyCity,
    landColonyBuild,
    commitStagedColony,
    reconcileStagedColonyWorldMove,
    settleStagedColony,
    playStagedColonyMove,
    endStagedColony,
    releaseColoniesLeave,
    whenTradePayoutIncomingChanges,
    whenColonyPayoutIncomingChanges,
    whenColonySequenceKeyChanges,
    whenBonusSequenceAwaitingChanges,
    whenColonyResolutionEvidenceChanges,
    whenColonyEntryAwaitingChanges,
    whenSettlementMarkerKeyChanges,
    whenColonyDiscardStageStrandedChanges,
    whenColonyResolutionLiveChanges,
    whenColonyBonusAutoCollectChanges,
    whenColonyTradeStateGlideNonceChanges,
    whenColonyPromptOpenableChanges,
    whenColonyTrackRaiseKeyChanges,
    whenColonyFollowUpLiveChanges,
    whenColonyPromptStrandedChanges,
    whenArmedColonyTradeTrackChanges,
    whenConsoleStateSectionChanges,
    whenColonyRosterLevelChanges,
    whenColonyRailNamesChanges,
    whenStagedColonyCommittingChanges,
  };
}

export type ColonyController = ReturnType<typeof createColonyController>;
