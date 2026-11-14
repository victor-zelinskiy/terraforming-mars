/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PLACEMENT CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {computed, nextTick, ref} from 'vue';
import {scopedState} from '@/client/console/session/scopedState';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {PlacementEffect, SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {consoleCardActionsUi} from '@/client/console/consoleCardActions';
import {SpaceId} from '@/common/Types';
import {cancelPlacement, waitForUpdate, SubmitTicket} from '@/client/console/transport/gameTransport';
import {serverAheadOfView} from '@/client/components/realtime/viewFreshness';
import {settlePresentationDue} from '@/client/console/presentationLedger';
import {scaleTooltipState, ScaleTooltipContent} from '@/client/components/board/scaleTooltipState';
import {ARC_SCALE_THEMES} from '@/client/components/board/arcScaleTheme';
import ConsoleBoardSection from '@/client/components/console/ConsoleBoardSection.vue';
import {consoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
import {sittingRiseOwed} from '@/client/console/parliament/sittingRise';
import {buildFinalGreenery, FINALE_KICKER, FinalGreeneryViewModel} from '@/client/console/finalGreenery/finalGreeneryModel';
import {collapseFinaleSession, enterFinaleSession} from '@/client/console/finalGreenery/finalGreenerySession';
import {TileType} from '@/common/TileType';
import {beginHoldConfirm, cancelHoldConfirm} from '@/client/console/consoleHoldConfirm';
import {scaleStorySceneSettling, waitConsoleQuiet} from '@/client/console/rewardPayoutQuiet';
import {yieldStackToBoard, yieldStackForStagedPlay, discardYieldedStack, stackYieldedToBoard, boardTakeableFromStack, yieldedStackCards, goBoardHome, setWorkspaceFrameStage, workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';
import {requestStdProjectCancel, stdProjectsFlowLive} from '@/client/console/consoleStdProjects';
import {noteTransferTrail} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {resolutionZoomEntry} from '@/client/components/card/cardZoomTypes';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';
import {promptSourceView, PromptSourceView} from '@/client/console/promptSource';
import {PlacementConversion, PlacementShape, StagedPlayPlate, stagedPlayPlate} from '@/client/console/placementDossier';
import {cardGrantOwedTo} from '@/client/console/cardGrantHost';
import {placementKicker} from '@/client/console/consoleTaskSummary';
import {orOptionResponse, orWrappedResponse} from '@/client/console/taskResponses';
import {setConsoleTaskSpacePlacement} from '@/client/console/consoleLeakDetector';
import {endPreludePlayChain, preludeChainOn, preludeChainOwesHand, preludeChainYieldsToBoard, preludePlayChainState} from '@/client/console/deckPick/preludePlayChain';
import {workspaceClaimsRevealSource, releaseWorkspaceOutcome} from '@/client/console/consoleWorkspaceOutcome';
import {boardBeatParkPending, boardBeatParkState, drainBoardBeatsIfDue} from '@/client/console/boardBeatPark';
import {armBoardCardBonus, isBoardCardBonusFieldPhase} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {planetFocusState, enterPlanetFocus, beginPlanetFocusExit, qualifiesForPlanetFocus, isPlanetFocusEngaged, planetFocusStoryReady, snapPlanetFocusSettled} from '@/client/console/planetFocus';
import {setPlacementPeek} from '@/client/components/board/placementRenderState';
import {PlacementPeek, peekTargetOf} from '@/client/console/tilePlacement/placementPeek';
import {tilePlacementState} from '@/client/console/tilePlacement/consoleTilePlacement';
import {enterPlacementFlow, placementFlowState, resetPlacementFlow, unlockPlacementCell} from '@/client/console/tilePlacement/placementFlow';
import {moveFamily, moveFirstDestination, moveFocusTile, moveLevelPrompt, moveSourceOf, placementMoveLevel, placementMoveState, resetPlacementMove, PlacementMoveFamily, PlacementMoveLevel} from '@/client/console/tilePlacement/placementMove';
import {PlacementStagedState} from '@/client/console/tilePlacement/placementCommands';
import {remoteLandingOwed} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {nomadMoveState} from '@/client/console/nomads/consoleNomadMove';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {getGlobalParameterMaximums} from '@/common/boards/GlobalParameterMaximums';
import {consoleState, closeConsoleLayers} from '@/client/console/consoleRouter';
import {gameStateVersion} from '@/client/console/gameStateVersion';
import {clearLawPlayDraft, endLawPlayLanding} from '@/client/console/consolePlayPick';
import {wrapPath} from '@/client/console/turnIntents';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {AdmissionSignals, PromptSurface, promptAdmissionBlock, setConsolePlacementHeld} from '@/client/console/consolePromptAdmission';
import {screenHandoffOwed} from '@/client/console/screenHandoff';
import {guardedAdmissionSignals} from '@/client/console/consoleForegroundWatchdog';
import {stagedPlayState, stagedPinState, beginStagedPin, resolveStagedPinLanded, resolveStagedPinDropped, stagedPlayActive, stagedPlacementOf, stagedVoteOf, stagedColonyOf, armStagedPlay, clearStagedPlay} from '@/client/console/stagedPlay';
import type {StagedPlayArm} from '@/client/console/stagedPlay';
import type {StagedPlacementModel} from '@/common/models/ActionPreviewModel';
import {colonyTrackMoveFlow, playOwedColonyTrackMove} from '@/client/console/colonyTrade/colonyTrackMove';
import {PendingPlayCard} from '@/client/console/shell/shellShared';
import type {StagedController} from '@/client/console/shell/stagedController';
import type {ConvertController} from '@/client/console/shell/convertController';
import type {FinaleController} from '@/client/console/shell/finaleController';
import type {ParliamentController} from '@/client/console/shell/parliamentController';
import type {ColonyController} from '@/client/console/shell/colonyController';
import type {CellController} from '@/client/console/shell/cellController';
import type {NoticeController} from '@/client/console/shell/noticeController';
import type {SeatController} from '@/client/console/shell/seatController';
import type {SurfaceRegistry} from '@/client/console/shell/surfaceRegistry';
import {questionScope} from '@/client/console/session/questionScope';
import {setQuestionAside, takeUpQuestion} from '@/client/console/setAside';

/** The shared hold-to-confirm key of the finale's irreversible stop (PL-296). */
const FINALE_FINISH_HOLD = 'final-greenery-finish';

/**
 * THE BOARD-BEAT DRAIN'S ONE QUIET-WAITER is armed (PL-489): the ledger re-drives the park every 500 ms while it is
 * ready, and each re-drive over a blocked board used to arm ANOTHER bounded waiter — sixteen pollers deep behind a
 * standing reveal, the first to reach its cap draining under it. Plain module state: `drainBoardBeats` is its only
 * reader and writer.
 */
let boardBeatDrainWaitArmed = false;

/**
 * The yielded stack's return waits for the board's handoff this long at most — above the reveal's own take (player-
 * paced, but the park's 30 s safety presents a parked batch by then) and the remote stage's 20 s board wait; past it
 * the frame comes back over whatever still stands (the old 8 s cap was shorter than a single reveal's take).
 */
const STACK_RETURN_MAX_MS = 45_000;

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type PlacementPort = {
  $nextTick(fn?: () => void): Promise<void>,
  surfaces: SurfaceRegistry,
  readonly admissionSignals: AdmissionSignals,
  readonly admissionSignalsBeforeStory: AdmissionSignals,
  admits(surface: PromptSurface): boolean,
  cancelStagedPlay: UnwrapRef<StagedController['cancelStagedPlay']>,
  /** WRITTEN here. */ convertPlantsPending: UnwrapRef<ConvertController['convertPlantsPending']>,
  convertPlantsPrompt: UnwrapRef<ConvertController['convertPlantsPrompt']>,
  finaleSessionEngaged: UnwrapRef<FinaleController['finaleSessionEngaged']>,
  game: UnwrapRef<SeatController['game']>,
  govSupportActive: UnwrapRef<ParliamentController['govSupportActive']>,
  readonly handPickActive: boolean,
  readonly hostTask: ConsoleTask | undefined,
  parliamentPlacementDoorClosed: UnwrapRef<ParliamentController['parliamentPlacementDoorClosed']>,
  /** WRITTEN here. */ pendingPlayCard: PendingPlayCard | undefined,
  readonly playerView: PlayerViewModel,
  readonly productionLossActive: boolean,
  readonly promptPresenceIdentity: string,
  readonly rawAdmissionSignals: AdmissionSignals,
  reconcileStagedColonyWorldMove: UnwrapRef<ColonyController['reconcileStagedColonyWorldMove']>,
  reconcileStagedPlayWorldMove: UnwrapRef<StagedController['reconcileStagedPlayWorldMove']>,
  reconcileStagedVoteWorldMove: UnwrapRef<ParliamentController['reconcileStagedVoteWorldMove']>,
  resumeStackFromBoardAndSettle: UnwrapRef<ColonyController['resumeStackFromBoardAndSettle']>,
  selectedCellInfo: UnwrapRef<CellController['selectedCellInfo']>,
  showNotice: UnwrapRef<NoticeController['showNotice']>,
  stagedBackOwed: UnwrapRef<StagedController['stagedBackOwed']>,
  stagedPlayPrompt: UnwrapRef<StagedController['stagedPlayPrompt']>,
  submit(response: unknown): SubmitTicket,
  readonly taskEmbedTarget: string | undefined,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
  readonly workspaceScreenUp: boolean,
};

export function createPlacementController(shell: PlacementPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * A PLACEMENT IS LIVE — the `placementActive` watcher's own record (a data field, so the admission computed may
   * read it without a cycle through `placementHeld`): the `remote-landing` block holds a placement that is NOT yet
   * live for a foreign tile owed to the board, and never tears a live aim down for one (the tile lands beside it).
   */
  const placementLiveLatch = scopedState('placement-live-latch', false);
  /**
   * PL-1840 — the prompt (`promptPresenceIdentity`) whose placement waits for a scale story under a cover: latched by
   * `boardStoryCoverCandidate`'s rising edge, let go once the park owes nothing or the server asks something else.
   */
  const boardStoryCoverFor = ref('');
  /** A task's nested space-type option being picked on the board. */
  // A latch of the QUESTION (session/questionScope.ts): the branch belongs to the prompt it was sent for and ends with it.
  const taskSpacePending = scopedState('task-space-pending', undefined as {index: number, spacePrompt: PlayerInputModel} | undefined, questionScope);
  /** The board pick out right now came from the FINALE's placement branch. */
  const finalGreeneryPickPending = scopedState('final-greenery-pick-pending', false, questionScope);
  /** …and the board COMMITTED it. `waitingFor` still holds the finale
   *  prompt for the whole round-trip (the server has not answered yet), so
   *  without this the screen re-mounts the instant the pick is released and
   *  BLINKS over the greenery's landing animation. */
  const finalGreeneryCommitting = scopedState('final-greenery-committing', false);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The tile-placement hero owns the foreground (reactive twin of
   *  `tilePlacementHolding()` — `tilePlacementState` is in data()). */
  const tilePlacementHolds = computed((): boolean => {
    const p = tilePlacementState.phase;
    return tilePlacementState.active && p !== 'idle' && p !== 'armed' && p !== 'failed';
  });

  /** The nomad-move hero owns the foreground (reactive twin of
   *  `nomadMoveHolding()` — `nomadMoveState` is in data()). The remote
   *  hop counts too: a foreign camp mid-air is the same board cinematic. */
  const nomadMoveHolds = computed((): boolean => {
    const p = nomadMoveState.phase;
    return (nomadMoveState.active && p !== 'idle' && p !== 'armed' && p !== 'failed') ||
      nomadMoveState.remoteActive;
  });

  /**
   * THE FINALE. The endgame "turn your plants into greeneries" loop, played
   * ON THE BOARD (PL-295, the owner's decision 2026-10-14) — see
   * finalGreeneryModel.ts for why stopping is a hold and placing is the
   * board's own pick. Marker-gated like every other adapter: unmarked → the
   * host keeps it. This is the ADMITTED read (the gate / the host's
   * admission let the finale open); the board pick reads the raw one.
   */
  const finalGreeneryVm = computed((): FinalGreeneryViewModel | undefined => {
    if (shell.hostTask?.kind !== 'choice') {
      return undefined;
    }
    return buildFinalGreenery(shell.playerView.waitingFor, shell.playerView.thisPlayer);
  });

  /**
   * The finale read off the RAW prompt — what the board pick, its dossier
   * block and its finish hold stand on. Admission may blink while the pick
   * is out (a bot card's flow hold, a landing cinematic), and the stock and
   * the finish verb must not blink with it.
   */
  const finalGreeneryRawVm = computed((): FinalGreeneryViewModel | undefined => {
    return buildFinalGreenery(shell.playerView.waitingFor, shell.playerView.thisPlayer);
  });

  /**
   * THE FINALE STANDS OPEN with no board pick out — a transient state: the
   * watcher below hands the placement to the board the moment it rises (the
   * announce's A, a restored minimize, the next greenery after a landing).
   */
  const finalGreeneryActive = computed((): boolean => {
    return finalGreeneryVm.value !== undefined &&
      !finalGreeneryCommitting.value &&
      !shell.govSupportActive && !shell.productionLossActive &&
      !consoleState.task.deferred && taskSpacePending.value === undefined &&
      !shell.handPickActive;
  });

  /**
   * ANOTHER SEAT'S TILE LANDS BEFORE THE GRID LIGHTS (state delivery, 2026-10-28). Read by the `remote-landing`
   * admission block: a landing queued / parked / in the air while no placement is live yet. The latch (not the
   * `placementActive` computed) keeps this acyclic; `remoteLandingOwed` reads REACTIVE terms only (`queued`, `draining`, …).
   */
  const remoteLandingBeforePlacement = computed((): boolean => {
    return !placementLiveLatch.value && remoteLandingOwed();
  });

  /**
   * A SERVER PLACEMENT HELD ONLY BY A FOREIGN LANDING must still TAKE THE BOARD — the landing waits for a board the
   * player can see, and the board is covered by the very workspace the placement's own rising edge would have
   * stepped aside; held, that edge never comes. So the hold's rising edge does what the placement's would (the
   * watcher below): the stack yields (or the screen goes board-home), the tile lands on the uncovered board, the
   * block falls, the placement comes alive — the owner's order: the field's truth, THEN the demand.
   */
  const placementTakesBoardForLanding = computed((): boolean => {
    return shell.playerView.waitingFor?.type === 'space' &&
      promptAdmissionBlock('placement', shell.admissionSignals) === 'remote-landing';
  });

  /**
   * …AND A SERVER PLACEMENT OWED BEHIND A SCALE STORY THE COVERED BOARD CANNOT TELL takes the board too (PL-1840, the
   * Palladin action at −2 °C): `board-story` is raised only over a board in plain view, so a placement arriving under a
   * workspace was admitted at once — its rising edge then stepped the workspace aside and the grid lit over a dial still
   * resting on −2, the park's story told after the landing. When nothing but that story would hold the placement (the
   * block `board-story`, the board as if uncovered), the hold's edge does what the placement's would: the stack yields
   * (or the screen goes board-home), `board-story` now holds the placement over the board in plain view, the park drains
   * — the marker glides, the rating flies — and only then does the grid light.
   */
  const placementTakesBoardForStory = computed((): boolean => {
    return shell.playerView.waitingFor?.type === 'space' && !boardInPlainViewForStory.value &&
      promptAdmissionBlock('placement', shell.admissionSignals) === 'board-story';
  });

  /**
   * PL-336 (TR47 «ВВЕРХ И ОБРАТНО»): the park holds scale values (or drains them) while the board is in plain view
   * BUT FOR a placement — the term of `boardBeatsWatchable` deliberately left out here, because it is the very thing
   * this signal holds back (reading it would close a reactivity cycle through `placementHeld`). The CAMERA is left
   * out too: a placement held by this block does not hold Planet Focus (`planetFocusTarget`), so the focus the last
   * placement engaged pulls back, the scales tell their story, and the camera comes in again for the next pick. A
   * covered board (a workspace, a sheet) raises nothing: no placement may wait on a drain that cannot run.
   */
  const boardStoryBeforePlacement = computed((): boolean => {
    void boardBeatParkState.heldParams;
    if (!(boardBeatParkPending() || boardBeatParkState.draining)) {
      return false;
    }
    if (boardInPlainViewForStory.value) {
      return true;
    }
    // PL-1840 — UNDER A COVER, the placement the story is owed BEFORE: the board is taken first
    // (`placementTakesBoardForStory`), the drain runs there, then the grid lights. The LIVE candidate answers the very
    // flush the placement would come alive in (the presence latch's watcher runs before the cover's — a placement
    // admitted for one tick stays present, and `board-story` never withdraws a present surface); the LATCH keeps it
    // from then on, so the camera's own hold can never flip it back (see the candidate).
    return shell.playerView.waitingFor?.type === 'space' &&
      ((boardStoryCoverFor.value !== '' && boardStoryCoverFor.value === shell.promptPresenceIdentity) || boardStoryCoverCandidate.value);
  });

  /**
   * PL-1840 — THE CANDIDATE: a server placement nothing ELSE holds (the workspace's own commit flights, a reveal — that
   * block's), while the park owes a scale story the covered board cannot tell. Its rising edge LATCHES the cover for this
   * prompt (`boardStoryCoverFor`), never a live term of the signal itself: the signal releases the camera
   * (`placementHeldForBoardStory`), the camera's exit raises the blocking `planet-focus` hold, and a live «nothing else
   * holds» would then drop the story, re-engage the camera and ping-pong until the page crashed (the box, 2026-11-05).
   * The latch is set in the SAME reaction that tells the camera, before it (`whenPlanetFocusOrderChanges`) — as a
   * watcher of its own it lost its turn to the camera's and never ran (the same crash again, 2026-11-14).
   * Any other surface never waits on a story under a cover (no drain can run there) — and neither does a placement
   * under a cover the board cannot TAKE (`boardTakeableFromStack`: the start's phase root stands through its own
   * placements, so the drain cannot run until the phase ends — the hold only waited out the park's safety).
   */
  const boardStoryCoverCandidate = computed((): boolean => {
    void boardBeatParkState.heldParams;
    return shell.playerView.waitingFor?.type === 'space' && !placementLiveLatch.value && !boardInPlainViewForStory.value &&
      boardTakeableFromStack() && boardBeatParkPending() &&
      promptAdmissionBlock('placement', guardedAdmissionSignals(shell.admissionSignalsBeforeStory)) === undefined;
  });

  /** PL-1840 — the cover's candidate and the camera's target as ONE source (`whenPlanetFocusOrderChanges`). */
  const planetFocusOrder = computed((): number => {
    return (boardStoryCoverCandidate.value ? 1 : 0) | (planetFocusTarget.value ? 2 : 0);
  });

  /** PL-1840 — the latched cover still owes its story (the park pending or draining, the same prompt). */
  const boardStoryCoverOwed = computed((): boolean => {
    void boardBeatParkState.heldParams;
    return boardStoryCoverFor.value !== '' && boardStoryCoverFor.value === shell.promptPresenceIdentity &&
      (boardBeatParkPending() || boardBeatParkState.draining);
  });

  /** The board the park drains on: the board section, no sheet, no workspace screen. */
  const boardInPlainViewForStory = computed((): boolean => {
    return consoleState.section === 'board' &&
      consoleState.sheet === undefined &&
      !shell.workspaceScreenUp;
  });

  /**
   * The server's placement is held WHILE the board owes its scale story (PL-336) — the one state that releases the
   * camera. Deliberately NOT «board-story is the top block»: the focus's own exit raises a BLOCKING hold
   * (`planet-focus` → `presentation`, which outranks `board-story`), so a top-block test re-engaged the camera the
   * moment it started to leave, and the two edges ping-ponged until the page froze. Both facts here are
   * independent of the camera, so the release is stable for the story's whole length.
   */
  const placementHeldForBoardStory = computed((): boolean => {
    return shell.playerView.waitingFor?.type === 'space' && placementHeld.value && shell.admissionSignals.boardStory;
  });

  /** …and the same classification, gated on the `host` admission so a reveal
   *  still owns the foreground while it plays. */
  /**
   * THE SCALE BONUS IS OWED BEHIND ITS STEP'S STORY (P89 · DZ): the bonus prompt rides the commit's own response, while
   * the workspace that made the step still covers the board — the admission's `board-story` block is raised only on a
   * board in plain view, so the band rose OVER the workspace and the step's story then played under it (the marker
   * still on 16 % under «Разместите бонус шкалы Венеры»). While the park owes the story, the band waits; the workspace
   * leaves (it never waits for this prompt), the board tells the step, the band stands. A colony trade and a sitting
   * tell the scales by their OWN laws (the trade's park under the covered stage, the sitting's world beat) — there the
   * band keeps the host family's admission.
   */
  const scaleBonusOwesStory = computed((): boolean => {
    void boardBeatParkState.heldParams;
    return (boardBeatParkPending() || boardBeatParkState.draining) &&
      !workspaceFrameKnown('colonies') && !workspaceFrameKnown('parliament');
  });

  /** P58 · FS — the prelude chain's «which tile next» stands in its host's zone (the crumb's tail names it). */
  const chainPlacementOrderEmbedded = computed((): boolean => {
    return shell.hostTask?.kind === 'choice' && shell.hostTask.flavor === 'placementOrder' && shell.taskEmbedTarget !== undefined &&
      preludeChainOn(preludePlayChainState.host);
  });

  /** A task's nested SelectSpace, narrowed for the headless picker. */
  const taskSpacePrompt = computed(() => {
    const p = taskSpacePending.value?.spacePrompt;
    return p !== undefined && p.type === 'space' ? p : undefined;
  });

  /** Every cell id of this board — a move's city level names the reason of each cell that is no city of the player's. */
  const boardSpaceIds = computed((): ReadonlyArray<SpaceId> => {
    return shell.playerView.game.spaces.map((space) => space.id);
  });

  /**
   * The server's top-level `SelectSpace` is being HELD behind a cinematic
   * (consolePromptAdmission). The board is ALWAYS mounted, so placement has no
   * `v-if` to suppress — this verdict is what stands in for one.
   *
   * The case that shipped it: Experimental Forest draws 2 plant cards AND
   * places a greenery. The executor draws synchronously and only DEFERS the
   * placement, so ONE response carries the drawn-cards reveal and the
   * SelectSpace together — the reveal assembled over a board that had already
   * gone live, force-switched the section and closed every layer underneath.
   * The draw is a cinematic with a defined END (its last card landing in the
   * dock); nothing may be asked of the player before it.
   *
   * Mirrored out for the board binder (see setConsolePlacementHeld):
   * it paints the hex highlight, which would otherwise stay lit under the modal.
   */
  const placementHeld = computed((): boolean => {
    return shell.playerView.waitingFor?.type === 'space' && (!shell.admits('placement') || shell.parliamentPlacementDoorClosed);
  });

  /**
   * Server-driven placement (SelectSpace) or a client-side board picker.
   *
   * Only the SERVER branch is admission-gated. The two client-side pickers are
   * hand-offs the player just initiated from a surface that UNMOUNTS itself for
   * the pick (convert-plants, a task's nested space branch) — holding those
   * would leave the prompt with no surface at all, which is the strand the
   * `setConsoleTaskSpacePlacement` mirror exists to prevent.
   */
  const placementActive = computed((): boolean => {
    return (shell.playerView.waitingFor?.type === 'space' && !placementHeld.value) ||
      shell.convertPlantsPending !== undefined ||
      taskSpacePending.value !== undefined ||
      shell.stagedPlayPrompt !== undefined;
  });

  const placementCancellable = computed((): boolean => {
    if (shell.convertPlantsPending !== undefined || taskSpacePending.value !== undefined ||
        shell.stagedPlayPrompt !== undefined) {
      return true; // client-side — nothing committed yet
    }
    return shell.playerView.waitingFor?.placementContext?.cancellable === true;
  });

  /**
   * WHO asked for this placement. Read off `placementSpaceModel` — the one
   * resolver that already unifies the three placement sources — so the two
   * CLIENT pickers (convert plants, a task's nested space) are covered too;
   * reading the task summary instead would classify only the server prompt.
   *
   * `createMarsSelectSpace` has derived `placementContext.source` from the
   * placing card since the marker existed, and the panel showed none of it:
   * a tile that arrives from a triggered effect had no attribution on screen.
   */
  /**
   * The card a reward THE CELL DECIDES will land on, as this staged play chose
   * it in the composer (Arboretum: the data holder) — with its live count, so
   * the dossier prints «k → k + N» for every cell from two server numbers.
   * Only while that staged cell pick stands.
   */
  const placementChosenTarget = computed((): {name: CardName, count: number} | undefined => {
    const arm = stagedPlayState.arm;
    if (arm?.cardTarget === undefined || arm.target.kind !== 'cell') {
      return undefined;
    }
    const card = shell.thisPlayer.tableau.find((c) => c.name === arm.cardTarget);
    return {name: arm.cardTarget, count: card?.resources ?? 0};
  });

  const placementSourceView = computed((): PromptSourceView | undefined => {
    return placementActive.value ? promptSourceView(placementSpaceModel.value) : undefined;
  });

  /** The placement source CARD, when there is one — what X inspects. */
  const placementSourceCard = computed((): CardName | undefined => {
    const view = placementSourceView.value;
    return view?.inspectable === true ? view.card : undefined;
  });

  /** The placement source RESOLUTION (Turmoil Redux — the winner's ocean of an enacted resolution), when there is one. */
  const placementSourceResolution = computed((): string | undefined => {
    const view = placementSourceView.value;
    return view?.inspectable === true ? view.resolution : undefined;
  });

  /** SOMETHING to open fullscreen placed this tile — a card or a resolution (L3 «Источник»). */
  const placementSourceInspectable = computed((): boolean => {
    return placementSourceCard.value !== undefined || placementSourceResolution.value !== undefined;
  });

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
  const placementSpaceModel = computed((): SelectSpaceModel | undefined => {
    const raw = placementRawSpaceModel.value;
    // A MOVE prompt (Turmoil Redux TR14 — `tileMove`) is read AT ITS LEVEL by
    // every placement reader: which city (the legal cells are the cities
    // that may move) → which cell (the lifted city's destinations). The two
    // levels are one prompt read twice (`placementMove.ts`); any other
    // prompt comes back as the very same object.
    return raw === undefined ? undefined : moveLevelPrompt(raw, placementMoveState.from, boardSpaceIds.value);
  });

  /** The space prompt as it was asked — before a move's level is applied (the marker's own lists live here). */
  const placementRawSpaceModel = computed((): SelectSpaceModel | undefined => {
    const wf = shell.playerView.waitingFor;
    if (wf?.type === 'space') {
      return wf;
    }
    return shell.convertPlantsPrompt ?? taskSpacePrompt.value ?? shell.stagedPlayPrompt;
  });

  /** A move's level right now — `source` (which tile leaves) / `cell` (where it lands); undefined for any other placement. */
  const placementMoveLevelNow = computed((): PlacementMoveLevel | undefined => {
    return placementActive.value ? placementMoveLevel(placementRawSpaceModel.value, placementMoveState.from) : undefined;
  });

  /** A move's FAMILY — the words its levels speak (a city's, an ocean's) — by the prompt's own kind; undefined for any other placement. */
  const placementMoveFamilyNow = computed((): PlacementMoveFamily | undefined => {
    return placementActive.value ? moveFamily(placementRawSpaceModel.value) : undefined;
  });

  /** The tile the player has LIFTED (its cell) — only while the prompt still offers it. */
  const placementMoveFrom = computed((): SpaceId | undefined => {
    return placementMoveLevelNow.value === 'cell' ? placementMoveState.from : undefined;
  });

  /**
   * The placement is a STAGED PLAY's (the cell is picked before the card is
   * paid) — its previews ask the server to fold the card's unpaid price into
   * every affordability fact (`staged=1`). A play only: an ACTION's card is
   * already on the table, and its own cost is not the card's price.
   */
  const placementStaged = computed((): boolean => {
    const raw = placementRawSpaceModel.value;
    // …and a card played THROUGH A LAW (RX36): its price is unpaid at the cell exactly as a play's is.
    return raw !== undefined && raw === shell.stagedPlayPrompt && stagedPlayState.arm !== undefined && stagedPlayState.arm.flow !== 'action';
  });

  /**
   * THE STAGED BOARD SPEAKS THE PLAY (T15 · CD): the bar's staged state — whose words (a play / an action), the
   * price the one POST charges (the arm's locked receipt) and whether a B is OWED. Undefined for every other pick
   * (a live prompt, convert plants, a task's nested cell).
   */
  /** THE PLAY PLATE (T15 · CD): the staged card carried onto the dossier — art, name, price, one line; gone with the commit. */
  const placementStagedPlate = computed((): StagedPlayPlate | undefined => {
    const arm = stagedPlayState.arm;
    if (placementStagedBar.value === undefined || arm === undefined) {
      return undefined;
    }
    return stagedPlayPlate({card: arm.cardName, flow: arm.flow, phase: placementFlowState.phase, receipt: arm.receipt});
  });

  const placementStagedBar = computed((): PlacementStagedState | undefined => {
    const arm = stagedPlayState.arm;
    const raw = placementRawSpaceModel.value;
    if (arm === undefined || raw === undefined || raw !== shell.stagedPlayPrompt) {
      return undefined;
    }
    return {
      flow: arm.flow === 'action' ? 'action' : 'play',
      ...(arm.receipt?.icon === 'megacredits' ? {price: `${arm.receipt.amount} M€`} : {}),
      ...(shell.stagedBackOwed ? {backOwed: true} : {}),
    };
  });

  /**
   * PLANET FOCUS target — should the enlarged placement stage be up?
   *
   * TRUE while a space prompt whose WHOLE candidate set lives on the main
   * Mars grid is present (read RAW off `placementSpaceModel`, not the
   * admission-gated `placementActive`: a prompt held behind a reveal
   * still engages the mode, so the board is already focused when the
   * overlay clears — and a chained second placement re-claims the mode
   * before any exit gets to run). After the pick resolves, the tile-hero
   * transaction and the card-bonus cover's FIELD phases SUSTAIN an
   * already-engaged mode through the landing + the field reward beats —
   * they never INITIATE it (a non-qualifying placement runs its hero on
   * the normal stage).
   */
  const planetFocusTarget = computed((): boolean => {
    // THE FINALE SESSION HOLDS THE CAMERA (PL-303): the planet grew for the first pick and stays grown through
    // every landing and every hand-off until the seat's finale is over — never the shrink-and-grow around each
    // greenery the per-pick target produced (the exit ran while the admission gate waited out the hero).
    if (shell.finaleSessionEngaged) {
      return true;
    }
    const prompt = placementSpaceModel.value;
    // A placement held for the board's owed scale story (PL-336) does not hold the camera: the scales can only be
    // READ with the arcs back, so the focus pulls back for the story and comes in again when the pick is admitted.
    if (prompt !== undefined && !placementHeldForBoardStory.value &&
        qualifiesForPlanetFocus(prompt.spaces, shell.playerView.game.spaces)) {
      return true;
    }
    return (tilePlacementState.active || nomadMoveState.active || isBoardCardBonusFieldPhase()) &&
      isPlanetFocusEngaged();
  });

  /**
   * The SCALE STORY's read gate: the park's drain must not release the
   * held values while the scales cannot be READ — a reveal overlay above
   * the board, cards mid-flight, a discard settling (the old planet-focus
   * beat's own admission list, kept verbatim by the one-owner merge; the
   * board-scene half lives in `boardSceneSettling`, folded in by the
   * drain trigger). `revealPending` already subtracts parked batches, so
   * a parked venus draw can never hold its own drain.
   */
  const scaleStoryReadBlocked = computed((): boolean => {
    const s = shell.rawAdmissionSignals;
    return s.revealOpen || s.revealPending || s.cardArrival || s.cardDiscard;
  });

  /**
   * The (cell, tile) the preview is for — the refetch key. '' → no preview
   * (not placing, no cell focused, or a custom SelectSpace with no kind).
   */
  /**
   * THE SEE-THROUGH's target («ПРОСВЕТ», TR47): the focused LEGAL candidate of a pick that LIFTS a piece — an
   * ocean removal, a move's SOURCE level, a remove-and-replace — read from the ONE prompt resolver and the
   * board's focused cell (`peekTargetOf`, pure). The watcher below is the ONE writer of the render state.
   */
  const placementPeekTarget = computed((): PlacementPeek | undefined => {
    if (!placementActive.value) {
      return undefined;
    }
    return peekTargetOf(placementSpaceModel.value, placementMoveLevelNow.value, consoleState.boardSpaceId as SpaceId | undefined,
      shell.playerView.game.spaces);
  });

  /** What this cell pick actually PUTS DOWN — a tile, or a marker (a claim /
   *  a camp move). The key comes from the ONE prompt-copy source. */
  const placementKickerKey = computed((): string => {
    // The finale's pick names its PHASE («Конец партии»), not the generic «Размещение тайла».
    if (finalGreeneryPickPending.value || shell.finaleSessionEngaged) {
      return FINALE_KICKER;
    }
    return placementKicker(placementSpaceModel.value);
  });

  /**
   * WHAT this placement puts down — the dossier's identity input, read off
   * the one prompt resolver so all three placement sources (server prompt,
   * convert plants, a task's nested space) resolve the same way.
   */
  const placementShape = computed((): PlacementShape | undefined => {
    const prompt = placementSpaceModel.value;
    if (prompt === undefined) {
      // The finale's context stands without a prompt (the landing, another seat's answer): what lands is
      // still a greenery — the identity never blinks to nothing between two picks.
      return shell.finaleSessionEngaged ? {tileType: TileType.GREENERY} : undefined;
    }
    // A PARKED staged cell (the server's own marker) reads as one more
    // upcoming placement of THIS chain: while the interloper prompt (the
    // threshold bonus ocean) is being answered, the dossier's plan line
    // says the reserved placement is still coming — the same constant
    // line the two-ocean cards use, fed from the same pipeline.
    const parked = shell.playerView.stagedPlacementPending;
    const pinned = parked !== undefined && prompt.sourceCard !== parked.card ?
      [{tileType: stagedPinState.pin?.cardName === parked.card ? stagedPinState.pin?.tileType : undefined}] :
      [];
    const followUps = pinned.length > 0 ?
      [...(prompt.followUpPlacements ?? []), ...pinned] :
      prompt.followUpPlacements;
    return {
      // A MOVE names the tile by the cell in focus: what LANDS once a city
      // is lifted (a Capital arrives as a Capital, a stack's top tier as a
      // plain city), the focused city's own tile before that.
      tileType: moveFocusTile(placementRawSpaceModel.value, placementMoveState.from, consoleState.boardSpaceId as SpaceId | undefined) ??
        prompt.tileType,
      placementType: prompt.placementType,
      placementEffect: prompt.placementEffect,
      sourceCard: prompt.sourceCard,
      followUpPlacements: followUps,
    };
  });

  /**
   * The convert-plants exchange — the ONE placement whose price is an action
   * cost rather than a cell fact. Structural (the pending client pick), and
   * the amount is the live, Ecoline-adjusted price the server exposes.
   */
  const plantConversion = computed((): PlacementConversion | undefined => {
    // The FINALE's pick is the same exchange (8 plants → 1 greenery) — stated the same way in its dossier.
    if (shell.convertPlantsPending === undefined && !finalGreeneryPickPending.value && !shell.finaleSessionEngaged) {
      return undefined;
    }
    return {amount: shell.thisPlayer.plantsNeededForGreenery, icon: 'plants'};
  });

  /**
   * THE PRICE OF A GREENERY BOUGHT WITH PLANTS (PL-306) — the dossier's own exchange (`plantConversion`, the live
   * `plantsNeededForGreenery`), handed to the conversion pickers' arm: the price leaves the plants row for the cell
   * and the greenery grows out of it. ONE source for the formula the player reads and the token they watch.
   */
  const plantExchangePrice = computed((): {resource: string, amount: number} | undefined => {
    const conversion = plantConversion.value;
    return conversion === undefined ? undefined : {resource: conversion.icon, amount: conversion.amount};
  });

  const placementTitle = computed((): string => {
    const t = placementSpaceModel.value?.title;
    if (t === undefined) {
      return '';
    }
    return typeof t === 'string' ? translateText(t) : translateMessage(t);
  });

  /** The focused TRACK marker's explanation — the SAME already-translated
   *  rows the premium ScaleTooltip shows (one source, no drift). */
  const trackInfo = computed((): ScaleTooltipContent | null => {
    return consoleState.trackMarker !== undefined ? scaleTooltipState.content : null;
  });

  /** P27c: the owning SCALE's own hover-overview (name + current value +
   *  description — mirrors ArcScale.overviewContent), shown in the panel
   *  UNDER the focused bonus so the scale hover is never lost on pad. */
  const trackScaleOverview = computed((): {titleKey: string, nounKey: string, valueText: string, descriptionKey: string} | null => {
    if (consoleState.trackMarker === undefined) {
      return null;
    }
    const accent = scaleTooltipState.content?.accent;
    if (accent === undefined) {
      return null;
    }
    const theme = ARC_SCALE_THEMES[accent];
    const value = accent === 'temperature' ? shell.game.temperature :
      accent === 'oxygen' ? shell.game.oxygenLevel :
        accent === 'venus' ? shell.game.venusScaleLevel :
          shell.game.oceans;
    return {
      titleKey: theme.title,
      nounKey: theme.noun,
      valueText: accent === 'oceans' ? `${value}/${getGlobalParameterMaximums(shell.game.gameOptions.boardName).oceans}` : `${value}${theme.unit}`,
      descriptionKey: theme.description,
    };
  });

  /** TR67: the CARD that put the inspected cell's tile there (the server's portrait) — what X opens. */
  const inspectedCellSourceCard = computed((): CardName | undefined => {
    return consoleState.inspecting ? shell.selectedCellInfo?.portrait?.sourceCard : undefined;
  });

  /** The placement flow's world-moved signal (see its watcher). */
  const placementWorldVersion = computed((): string => {
    return gameStateVersion(shell.playerView);
  });

  /**
   * MAY A BOARD BEAT PLAY RIGHT NOW — the board-beat park's injected
   * verdict («полевой пакет ждёт видимую доску»). True only on the plain
   * board home: no workspace screen or sheet, no yielded placement (its own
   * story owns the board), no full-bleed reveal. A PARKED stack passes on
   * purpose — «свернуть» is precisely the player going to look at the
   * board, and the drain playing there is the story they came for; the
   * restore then finds the scales already telling the truth.
   *
   * ⚠️ COVERAGE FACTS ONLY — never a reveal-derived term. This verdict
   * feeds `boardBeatParksReveal`, which `rawDrawnRevealPending` (and so
   * `consoleRevealMode`) subtracts; a reveal term here would close the
   * cycle. A concurrent reveal is sequenced by the drain's own quiet wait
   * and the one-batch-per-frame law, not by this predicate.
   */
  const boardBeatsWatchable = computed((): boolean => {
    // An engaged Planet Focus (and the arcs' return beat) counts as a
    // COVERED board — the arcs are receded/condensing, so a scale is
    // unreadable by construction. This term is what makes the park the
    // ONE owner of the display freeze: a commit landing mid-focus seeds
    // it, and the watchable edge fires exactly when the exit has seated
    // the instruments back (the old beat's own timing). A YIELDED stack
    // deliberately does NOT cover the board any more: the yield-gap after
    // a placement resolves (stack aside, board fully visible, focus
    // landed) is precisely where the scale story must play BEFORE the
    // workspace takes the screen back; the live-placement half of the old
    // term is carried by `!placementActive`.
    return consoleState.section === 'board' &&
      consoleState.sheet === undefined &&
      !shell.workspaceScreenUp &&
      !placementActive.value &&
      // …and no sitting on its way up (the soft gates): the pass that ran the law is applied over the board home,
      // and the law's scales wait for the sitting's own world beat (`sittingRise.ts`).
      !sittingRiseOwed() &&
      // …and the camera at rest, or landing with the instruments already readable: the scale story starts WITH the
      // pullback (the tile language, W6), never after the landing's whole tail.
      planetFocusStoryReady();
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function onConvertPlantsSpacePicked(spaceResponse: {type: 'space', spaceId: string}): void {
    const found = shell.convertPlantsPending;
    shell.convertPlantsPending = undefined;
    if (found === undefined || found.path.length === 0) {
      return;
    }
    armBoardBonusIfCardCell(spaceResponse.spaceId);
    shell.submit(wrapPath(found.path, spaceResponse));
  }

  /**
   * The placed cell prints a card-draw bonus and its cover is on the
   * board → ARM the "card bonus lifts off the cell" cinematic BEFORE the
   * submit (the cover separates while the server resolves; the arriving
   * tile-source reveal is then staged instead of popping instantly). A
   * cell without the visual source (no icon in the DOM) never arms —
   * the standard reveal flow stays untouched.
   *
   * The SERVER's `placementEffect` gates it: a 'marker' pick (Land Claim /
   * an Arcadian community / the nomads' FIRST placement) grants NOTHING —
   * lifting the cover would promise a draw the commit never makes — and a
   * 'bonus-only' pick (the nomads MOVE) DOES draw, but its cover
   * separates at the move scene's own pre-lift beat (the arriving module
   * displaces the cell), so the scene arms it itself.
   */
  function armBoardBonusIfCardCell(spaceId: string, placementEffect?: PlacementEffect): void {
    // A confirm mid-Planet-Focus-growth settles the board FIRST — this is
    // the earliest cell-anchor measurement of the commit chain (the cover
    // icon rect), and it must never read a still-moving hex. Runs before
    // the DRAW_CARD guard on purpose: armTilePlacement (the next
    // measurer) is only reached through the same submit.
    snapPlanetFocusSettled();
    if (placementEffect !== undefined && placementEffect !== 'tile') {
      return;
    }
    const space = shell.playerView.game.spaces.find((s) => s.id === spaceId);
    if (space === undefined || !space.bonus.includes(SpaceBonus.DRAW_CARD)) {
      return;
    }
    const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(spaceId) : spaceId;
    const icon = document.querySelector(`.board-space[data_space_id="${esc}"] .board-space-bonus--card`);
    if (icon === null) {
      return;
    }
    armBoardCardBonus({kind: 'board-cell', spaceId});
  }

  function ownCancelPlacement(): void {
    if (taskSpacePending.value !== undefined && finalGreeneryPickPending.value) {
      deferFinalGreenery();
      return;
    }
    if (taskSpacePending.value !== undefined) {
      // A task's nested board pick: nothing committed — return to the task.
      taskSpacePending.value = undefined;
      finalGreeneryPickPending.value = false;
      return;
    }
    if (shell.convertPlantsPending !== undefined) {
      // Client-side picker: nothing committed — just drop it.
      shell.convertPlantsPending = undefined;
      return;
    }
    if (stagedPlayActive()) {
      // STAGED PLAY: nothing committed — restore the composer whole.
      shell.cancelStagedPlay();
      return;
    }
    // A placement raised by the STD-PROJECTS flow: the cancel's response is
    // what REOPENS the folded workspace on the very row the player left
    // (the flow's reconciler) — mark the leg so it reads as a return.
    if (stdProjectsFlowLive()) {
      requestStdProjectCancel();
    }
    cancelPlacement();
  }

  /**
   * A YIELDED STACK RETURNS ONLY OVER A QUIET BOARD. `placementActive`
   * falls the moment the space prompt resolves — but the placement's own
   * post-commit story (the tile hero, the printed-bonus wave, the Ares
   * payouts, the cell's card-bonus lift) plays AFTER that, on the very
   * board the workspace stood aside FOR. Resumed on the raw falling edge,
   * the track took the screen back UNDER its own placement's still-flying
   * rewards. Same gate as the endgame open; the synchronous fast path
   * keeps every non-cinematic resolution (and every existing flow) on the
   * old timing. A CHAINED second placement re-arms the yield (its rising
   * edge), so a pending wait stands down (`alive`) and the next falling
   * edge schedules its own return.
   */
  /**
   * DRAIN THE BOARD-BEAT PARK over a quiet, watchable board (see
   * `boardBeatPark.ts`). The third consumer of `waitBoardSceneQuiet`, on
   * the same terms as the two below: synchronous fast path on a quiet
   * board, bounded wait otherwise, conditions re-checked at resolution.
   */
  function drainBoardBeats(): void {
    if (!boardBeatParkPending() || !boardBeatsWatchable.value) {
      return;
    }
    // The drain's full gate: the board's own cinematics (settling) AND the
    // scale story's read admission (no reveal above the board, no cards in
    // transit — the old planet-focus beat's list). A transient cinematic is
    // bounded by the shared cap; a reveal standing for the player is waited
    // out (see below). The ledger's heartbeat re-asks if an edge is missed.
    const blocked = () => scaleStorySceneSettling() || scaleStoryReadBlocked.value;
    if (!blocked()) {
      drainBoardBeatsIfDue();
      return;
    }
    if (boardBeatDrainWaitArmed) {
      return;
    }
    boardBeatDrainWaitArmed = true;
    void waitConsoleQuiet(blocked, {alive: () => boardBeatsWatchable.value, who: 'board-beat-drain'})
      .then(() => {
        boardBeatDrainWaitArmed = false;
        // A reveal STANDING for the player is not a wedged story: it ends on the player's take, and the scales'
        // story belongs to the board that take uncovers (PL-489 — drained past the cap, the oxygen step's TR token
        // was born on a marker UNDER the received-cards scene and flew over it). The ledger's re-drive asks again
        // once the reveal is gone; the park's own 30 s safety still bounds the whole wait.
        if (shell.rawAdmissionSignals.revealOpen) {
          return;
        }
        drainBoardBeatsIfDue();
      });
  }

  function resumeYieldedStackOverQuietBoard(): void {
    if (!stackYieldedToBoard()) {
      return;
    }
    // THE PRELUDE CHAIN (PL-1467): the hand comes back for what the flow still owes it — a batch its claim owns, a
    // card pick, a payment, a colony — and NEVER into an empty workspace: owed nothing, the flow finishes on the
    // board (the yielded stack dropped, the claim released). A batch the claim owns is the RETURN's own content, so
    // the handoff does not wait for it (it would wait for the very surface it is about to stand up).
    if (preludePlayChainState.live) {
      if (!preludeChainOwesHand(shell.playerView)) {
        discardYieldedStack();
        releaseWorkspaceOutcome('prelude-chain-finished-on-board');
        endPreludePlayChain();
        return;
      }
      const chainSettling = () => screenHandoffOwed({ignoreReasons: ['animation'], ownedReveal: workspaceClaimsRevealSource});
      if (!chainSettling()) {
        shell.resumeStackFromBoardAndSettle();
        return;
      }
      void waitConsoleQuiet(chainSettling, {
        who: 'stack-return',
        alive: () => stackYieldedToBoard() && !placementActive.value,
        maxMs: STACK_RETURN_MAX_MS,
      }).then(() => {
        if (stackYieldedToBoard() && !placementActive.value) {
          shell.resumeStackFromBoardAndSettle();
        }
      });
      return;
    }
    // `boardStorySettling` (not merely the scene): the return must also
    // wait out an OWED SCALE STORY — the placement's own parameter change
    // parked behind the focused stage. Resumed on the raw scene edge, the
    // workspace re-covered the board one beat before the glide and the
    // story died behind it («вышел из зума — анимации шкал потерялись»).
    // The park's drain runs in this very yield-gap (the stack is aside,
    // the board watchable), so the wait resolves on the story's own end;
    // the shared 8 s cap bounds a wedged story to seconds, never the flow.
    //
    // …AND ANOTHER SEAT'S TILE OWED TO THIS BOARD (RX38, D11): the seats go
    // in turn, so the response to the viewer's own placement routinely
    // carries the NEXT seat's tile too (the bot's city, placed by its own
    // primitive the moment the viewer answered). Resumed over it, the sitting
    // re-covered the board the landing was waiting for — the tile then hung
    // on its 20 s board wait and appeared with no flight. The frame stays
    // aside until it has landed (the viewer's own card first: the landing
    // waits out the reveal standing over the board).
    // …AND EVERYTHING THE PLAYER IS STILL OWED ON THE BOARD (state delivery, 2026-10-28 — the owner's photo: the
    // city of Mars First Budget drew a card, and the sitting came back OVER the card's reveal): the return is a
    // screen-taking transition and asks the director — a reveal not taken, a card on its way into the dock, tokens
    // in the air, the board's story, a foreign landing. NOT the animation holds: the sitting's own reward holds are
    // seeded for the beat the returning section plays (a return that waited for them would wait for itself).
    const settling = () => screenHandoffOwed({ignoreReasons: ['animation']});
    if (!settling()) {
      shell.resumeStackFromBoardAndSettle();
      return;
    }
    void waitConsoleQuiet(settling, {
      who: 'board-beat-settle',
      alive: () => stackYieldedToBoard() && !placementActive.value,
      maxMs: STACK_RETURN_MAX_MS,
    }).then(() => {
      if (!stackYieldedToBoard() || placementActive.value) {
        return;
      }
      // A landing still OWED is not a wedged story (PL-489's law): it waits for the viewer's own story — the card the
      // ruling party dealt, its take, its flight into the dock — and the frame waits for the landing, re-armed past
      // the shared cap. Bounded all the same: the landing's own board wait ends it (`BOARD_WAIT_MAX_MS`).
      if (remoteLandingOwed()) {
        resumeYieldedStackOverQuietBoard();
        return;
      }
      shell.resumeStackFromBoardAndSettle();
    });
  }

  function onTaskSpacePick(payload: {index: number, spacePrompt: PlayerInputModel}): void {
    taskSpacePending.value = payload;
    goBoardHome();
  }

  /**
   * The FINALE's placement branch. Same board hand-off as every other nested
   * `SelectSpace`, plus a marker: this screen must stay down for the WHOLE
   * commit (see `finalGreeneryCommitting`), not just while the pick is out.
   */
  function onFinalGreenerySpacePick(payload: {index: number, spacePrompt: PlayerInputModel}): void {
    finalGreeneryPickPending.value = true;
    onTaskSpacePick(payload);
  }

  /**
   * THE FINALE TAKES THE BOARD (PL-295): the placement branch goes straight to the board pick — on the announce's
   * A, on the way back from a minimize and after every landing. There is no dialog in between.
   */
  function openFinalGreeneryOnBoard(): void {
    const vm = finalGreeneryVm.value;
    const wf = shell.playerView.waitingFor;
    if (vm === undefined || wf?.type !== 'or' || taskSpacePending.value !== undefined) {
      return;
    }
    const spacePrompt = (wf as {options: Array<PlayerInputModel>}).options[vm.placeIndex];
    if (spacePrompt === undefined) {
      return;
    }
    // Under a law that REPLACES the greenery (RX35, decision Р2) the placing branch is a plain OPTION: the plants
    // buy data, no cell is asked — the press answers the branch, and the law's own «where» follows as the next
    // prompt (the shared picker, the plate's scene).
    if (vm.diverted !== undefined) {
      shell.submit({type: 'or', index: vm.placeIndex, response: {type: 'option'}});
      return;
    }
    // THE SESSION RISES with the first pick (and returns from a minimize with the next): one context from here on.
    enterFinaleSession();
    onFinalGreenerySpacePick({index: vm.placeIndex, spacePrompt});
  }

  /** B on the finale: MINIMIZE — the pick is dropped (nothing was sent), the board home's plate brings it back. */
  function deferFinalGreenery(): void {
    cancelHoldConfirm(FINALE_FINISH_HOLD);
    taskSpacePending.value = undefined;
    finalGreeneryPickPending.value = false;
    setQuestionAside('finale');
    // …and the SESSION folds with it (PL-303): the context hides, the camera lets go, the plate offers the way back.
    collapseFinaleSession();
  }

  /** RT down on the finale: the irreversible stop arms the shared hold; letting go is a safe cancel. */
  function beginFinalGreeneryFinish(): void {
    beginHoldConfirm(FINALE_FINISH_HOLD, () => finishFinalGreenery(), 'triggerR');
  }

  /**
   * The hold completed: THE PLAYER'S GAME ENDS — the «I am done» branch, answered. The board pick (nothing sent)
   * is dropped first and the loop is held off until the answer lands, so the board cannot re-enter placement on
   * the prompt the answer is about to retire.
   */
  function finishFinalGreenery(): void {
    const vm = finalGreeneryRawVm.value;
    if (vm === undefined) {
      return;
    }
    taskSpacePending.value = undefined;
    finalGreeneryPickPending.value = false;
    finalGreeneryCommitting.value = true;
    shell.submit(orOptionResponse(vm.stopIndex));
  }

  function onTaskSpacePicked(spaceResponse: {type: 'space', spaceId: string}): void {
    const pending = taskSpacePending.value;
    taskSpacePending.value = undefined;
    if (pending === undefined) {
      return;
    }
    // Committed: hold the finale down until the answer lands (and the
    // placement hero has taken the foreground).
    finalGreeneryCommitting.value = finalGreeneryPickPending.value;
    finalGreeneryPickPending.value = false;
    takeUpQuestion('answered');
    armBoardBonusIfCardCell(spaceResponse.spaceId,
      pending.spacePrompt.type === 'space' ? pending.spacePrompt.placementEffect : undefined);
    shell.submit(orWrappedResponse(pending.index, spaceResponse));
  }

  /**
   * The staged HANDOFF to the board: the batch parks, the workspace steps
   * aside (yield FIRST — the `placementActive` rising edge then finds the
   * stack already aside via the `boardYielded` fast path and never
   * goBoardHome's the frames away), and the composer leaves; B on the board
   * brings everything back through `cancelStagedPlay`.
   */
  function enterStagedPlacement(arm: StagedPlayArm): void {
    arm.yieldedStack = yieldStackForStagedPlay();
    armStagedPlay(arm);
    shell.pendingPlayCard = undefined;
  }

  /**
   * The ACTION flow's staged entry (ДЕЙСТВИЯ КАРТ → a placement-bearing
   * branch): same store, same board half, same B — only the restore differs
   * (the action composer re-seats via `consoleCardActionsUi.stagedReturn`).
   */
  function onCardActionsStagedPlacement(payload: {batch: ReadonlyArray<unknown>, staged: StagedPlacementModel, cardName: CardName, nodeIndex: number, composerDraft: unknown}): void {
    const arm: StagedPlayArm = {
      flow: 'action',
      cardName: payload.cardName,
      isEvent: false,
      batch: payload.batch,
      target: {kind: 'cell', placement: payload.staged},
      draws: 0,
      deckCheck: false,
      actionRestore: {cardName: payload.cardName, nodeIndex: payload.nodeIndex, composer: payload.composerDraft},
      yieldedStack: false,
    };
    enterStagedPlacement(arm);
  }

  /** The notification's «Отменить размещение» CTA (server-cancellable). */
  function onNotificationCancel(): void {
    ownCancelPlacement();
  }

  /**
   * X mid-placement — the card that is placing this tile, fullscreen. The
   * viewer names its role, and the board is never unmounted: the cursor,
   * the highlighted cells and the panel's facts are exactly as they were
   * when it closes.
   */
  /**
   * TR67 «КЛЕТКА — ОДНО ДОСЬЕ»: X in the board inspection opens the face of the card that put the focused tile there
   * — the dossier's own «Поставлено» chip is the origin; the inspection stands under the viewer untouched (cursor,
   * dossier, marks). A cell with no such card refuses with its reason (the bar already says it).
   */
  function inspectCellSource(): void {
    const name = inspectedCellSourceCard.value;
    if (name === undefined) {
      shell.showNotice('No card placed this tile');
      return;
    }
    openConsoleCardZoom([{name}], 0, undefined, undefined, {
      statusLabel: 'Placed by',
      origin: {
        kind: 'physical',
        resolve: () => document.querySelector<HTMLElement>('.con-context [data-cell-source]') ?? null,
      },
    });
  }

  function inspectPlacementSource(): void {
    const name = placementSourceCard.value;
    const resolution = placementSourceResolution.value;
    if (name === undefined && resolution === undefined) {
      return;
    }
    // A RESOLUTION placed this tile: its own inspector (party column, own
    // rules, standing), lifted out of the dossier's source plate.
    const entries = resolution !== undefined ? [resolutionZoomEntry(resolution)] : [{name: name as CardName}];
    openConsoleCardZoom(entries, 0, undefined, undefined, {
      statusLabel: 'Source',
      origin: {
        kind: 'physical',
        resolve: () => document.querySelector<HTMLElement>('.con-context .con-src') ?? null,
      },
    });
  }

  // A task's nested SelectSpace branch answered ON THE BOARD (final greenery,
  // the WGT ocean): the host / gov-support / production-loss surfaces are all
  // unmounted for its lifetime while `waitingFor` stays the OrOptions — the
  // board is the serving surface and the detector has no DOM node to match it
  // by. Mirror it, or the amber guard covers a working placement (~2 s in).
  function whenTaskSpacePendingChanges(pending: {index: number, spacePrompt: PlayerInputModel} | undefined): void {
    setConsoleTaskSpacePlacement(pending !== undefined);
  }

  /**
   * THE BOARD BECAME WATCHABLE — drain the board-beat park (the held scale
   * story, then the parked bonus batch). The drain itself re-checks
   * watchability at every step, so a workspace re-opened mid-edge simply
   * re-parks; a busy board (a tile hero, a payout wave) is waited out by
   * the same bounded gate the endgame open and the yielded-stack return
   * ride (`waitBoardSceneQuiet`).
   */
  function whenBoardBeatsWatchableChanges(watchable: boolean): void {
    if (watchable) {
      // THE RE-ENTRY FAST-SYNC ORDER (mechanism E): freshness first — the
      // stories must play against TRUE data, and a wake consumed while
      // the board was covered is a debt this edge repays (the guarded
      // check compares cursors server-side, so a false positive costs one
      // WAIT round trip); then the park's drain; then one ledger pass so
      // any owed story whose stage just opened plays NOW, not a beat
      // later.
      if (serverAheadOfView(shell.playerView.game)) {
        waitForUpdate(true);
      }
      drainBoardBeats();
      settlePresentationDue();
    }
  }

  /** The first action's party step has come DUE (the banner pick, the delegate grant): the Parliament opens as its scene step. */
  /** …its crumb: «КАРТЫ В РУКЕ › <карта> › ОЧЕРЁДНОСТЬ» — the stage handed up to the chain's host frame. */
  function whenChainPlacementOrderEmbeddedChanges(now: boolean): void {
    if (now) {
      setWorkspaceFrameStage(preludePlayChainState.host, 'Order');
    }
  }

  // Mirror the PLACEMENT verdict into the module so the board binder —
  // which mounts the legacy SelectSpace (its `mounted()` paints the
  // `.board-space--available` hex highlight) and teleports the PlacementBanner
  // to <body>, both keyed off `waitingFor` alone — holds them for exactly the
  // same window. Without it the hexes light up under the reveal modal while
  // every other placement affordance is correctly held.
  function whenPlacementHeldChanges(held: boolean): void {
    setConsolePlacementHeld(held);
  }

  /** …and the SEE-THROUGH follows the focused candidate (TR47): one writer of the cell's `--peek` class. */
  function whenPlacementPeekTargetChanges(peek: PlacementPeek | undefined): void {
    setPlacementPeek(peek);
  }

  // Server-driven placement pulls the player to the board (§10: a
  // board-target step changes the active section, the frame persists).
  /** See `placementTakesBoardForLanding` — the board is uncovered for the landing the placement waits for. */
  function whenPlacementTakesBoardForLandingChanges(now: boolean): void {
    if (!now) {
      return;
    }
    if (!yieldStackToBoard() && !(preludeChainYieldsToBoard() && yieldStackForStagedPlay())) {
      goBoardHome();
    }
    closeConsoleLayers();
  }

  /** PL-1840 — the cover is LATCHED for this prompt on the candidate's rising edge (see `boardStoryCoverCandidate`). */
  function latchBoardStoryCover(): void {
    boardStoryCoverFor.value = shell.promptPresenceIdentity;
    noteTransferTrail('board-story:cover', {prompt: boardStoryCoverFor.value});
  }

  /**
   * THE COVER IS LATCHED, THEN THE CAMERA IS TOLD — ONE REACTION, its order written here (ONE MUTATION — ONE REACTION).
   *
   * They were two rows of the shell's table: «the candidate rose → latch the cover» and «the camera's target changed →
   * enter / exit». The latch exists to keep the camera's own exit from dropping the story it was released for — so it
   * must be set BEFORE the camera moves. As two watchers that order was the scheduler's: a queued job runs its getter
   * when its turn comes, the camera's turn came first, its exit raised the `planet-focus` hold, the candidate fell —
   * and the latch's job found «false, as before» and never ran its body. The story dropped, the camera came back in,
   * its hold let go, the candidate rose again: a flush that never ended, the page frozen for good (the Palladin action
   * at −2 °C — `console-palladin-shipping` E; CI of 2026-11-14 — the main thread silent for 492 s; the trace: 90
   * camera flips with the latch empty and not ONE run of its watcher).
   *
   * As one reaction there is no such turn to lose: whenever the camera is told that its target fell for a covered
   * story, the candidate stands in that very evaluation — it is what made the target fall — and the cover is latched
   * first. `planetFocusOrder` is both facts in one value (bit 0 the candidate, bit 1 the target).
   */
  function whenPlanetFocusOrderChanges(now: number, was: number | undefined): void {
    const before = was ?? 0;
    if ((now & 1) !== 0 && (before & 1) === 0) {
      latchBoardStoryCover();
    }
    if ((now & 2) !== (before & 2)) {
      whenPlanetFocusTargetChanges((now & 2) !== 0);
    }
  }

  /** …and let go once the story is told (the park owes nothing) or the server asks something else. */
  function whenBoardStoryCoverOwedChanges(owed: boolean): void {
    if (!owed) {
      boardStoryCoverFor.value = '';
    }
  }

  /** See `placementTakesBoardForStory` — the board is uncovered for the scale story the placement waits for (PL-1840). */
  function whenPlacementTakesBoardForStoryChanges(now: boolean): void {
    if (!now) {
      return;
    }
    noteTransferTrail('board-story:take-board', {waitingFor: shell.playerView.waitingFor?.type});
    if (!yieldStackToBoard() && !(preludeChainYieldsToBoard() && yieldStackForStagedPlay())) {
      goBoardHome();
    }
    closeConsoleLayers();
  }

  /** WATCH `placementActive` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenPlacementActiveChanges(now: boolean): void {
    placementLiveLatch.value = now;
    if (now) {
      // THE BOARD NEEDS THE SCREEN — but that is not «this flow is over».
      // A root that declares `yieldsToBoard` steps ASIDE and comes back at
      // the same depth (`consoleWorkspaceStack` § YIELDED TO THE BOARD);
      // everything else finishes the way it always has. The Hydronetwork is
      // the case that made the difference visible: its stage-7 repeat can
      // copy an action whose target is a SPACE, and unwinding the track there
      // ended the player's walk on the board with its reward wave unplayed
      // and its result unread.
      // …and the HAND hosting a prelude a pick played (PL-1467): its board step is a step of the flow — the hand
      // steps aside at the same depth and comes back if the flow still owes it something (`preludePlayChain.ts`).
      if (!yieldStackToBoard() && !(preludeChainYieldsToBoard() && yieldStackForStagedPlay())) {
        goBoardHome();
      }
      closeConsoleLayers();
    } else {
      // …and the board's business is done. A no-op unless this very placement
      // is what took the screen — the player's own «свернуть» park is a
      // different stack and is never touched here. The return itself is an
      // AUTOMATIC transition, so it waits out the placement's own
      // post-commit story first (see the method).
      resumeYieldedStackOverQuietBoard();
      // The sitting's door to the board closes with the placement (the next tile waits for its own press).
      consoleParliamentUi.boardDoorOpen = false;
    }
    // P20: the R3 inspect-all toggle never outlives its placement.
    consoleState.freeRoam = false;
    // P27: placement OWNS the board navigation — the inspection modes
    // yield (entering AND leaving placement land on a clean board home).
    consoleState.inspecting = false;
    consoleState.scaleInspecting = false;
    consoleState.trackMarker = undefined;
    // The two-phase confirm flow: a fresh placement starts at NAVIGATE
    // (arming the entry hold-gate when the opening press is still down);
    // leaving placement clears every transient phase.
    if (now) {
      enterPlacementFlow();
    } else {
      resetPlacementFlow();
    }
    // …and a MOVE's lifted city belongs to the placement it was lifted in.
    resetPlacementMove();
  }

  /**
   * A MOVE's LEVEL CHANGE (Turmoil Redux TR14): the cursor follows the city.
   * Lifted → it lands on the city's FIRST destination in the server's own
   * order (clockwise from the east) — a focus, never a choice: the lock is
   * still two presses away. Put down → it returns to the city, so «another
   * city» starts from the one just held. Pad and mouse take this one path.
   */
  function whenPlacementMoveFromChanges(now: SpaceId | undefined, before: SpaceId | undefined): void {
    const target = now !== undefined ? moveFirstDestination(placementRawSpaceModel.value, now) : before;
    if (target === undefined || !placementActive.value) {
      return;
    }
    const board = shell.surfaces.at<ExposedOf<typeof ConsoleBoardSection>>('boardSection');
    if (board?.focusSpace(target) !== true) {
      consoleState.boardSpaceId = target;
    }
  }

  /**
   * THE OFFER MOVED under a lifted city (a live move prompt re-read after an
   * off-turn update): a city the prompt no longer lets move is put down — a
   * stale lift may never offer destinations.
   */
  function whenPlacementRawSpaceModelChanges(raw: SelectSpaceModel | undefined): void {
    if (placementMoveState.from !== undefined && moveSourceOf(raw, placementMoveState.from) === undefined) {
      resetPlacementMove();
    }
  }

  /**
   * THE WORLD MOVED under a standing placement (the server's own change
   * counters — the same pair every cache keys on). Three honest cases:
   *  - a commit succeeded straight into a CHAINED second placement (no
   *    cinematic hold flipped `placementActive` off) — the new prompt is a
   *    new decision, the flow returns to navigation;
   *  - an off-turn update landed while the player holds a LOCK — the lock
   *    survives only if its cell is still a legal landing spot (an
   *    opponent's concurrent ocean can occupy it);
   *  - anything else — no phase to protect, nothing to do.
   * A REFUSED commit never changes the version, so the rollback path
   * (`rollbackPlacementCommit` in the transport's abort battery) stays the
   * one owner of that transition.
   */
  function whenPlacementWorldVersionChanges(): void {
    // A PARKED PIN resolves first — it mirrors the server's own
    // `stagedPlacementPending`. Landed (the drain auto-placed the pinned
    // cell) → the seal wave is free to fly from the tile; dropped (our own
    // sourceCard prompt is standing live — the cell was invalidated and the
    // placement is being re-asked) → release the held rewards honestly.
    const pin = stagedPinState.pin;
    if (pin !== undefined && shell.playerView.stagedPlacementPending?.card !== pin.cardName) {
      const wf = shell.playerView.waitingFor;
      if (wf?.type === 'space' && wf.sourceCard === pin.cardName) {
        resolveStagedPinDropped();
      } else {
        resolveStagedPinLanded();
      }
    }
    // STAGED PLAY next — its lifecycle rides the same version signal.
    // A committed staged play landing IS the version move: the play is
    // real, the flow ends on the board (the yielded frames are dropped,
    // never resumed — D-decision), and whatever the response carries next
    // (a chained second placement, a follow-up prompt, the reveal) is
    // served by its own ordinary routing. A version move under an UNSENT
    // staged play voids its preview instead.
    //
    // …and «landed» has a THIRD honest shape now: the response says the
    // cell is PARKED behind an interloper prompt (a threshold bonus ocean
    // jumped the queue). The commit is just as real — the stack is still
    // discarded — but the presentation arms move onto the PIN, which the
    // block above resolves on a later version move.
    if (stagedVoteOf(stagedPlayState.arm) !== undefined) {
      // A STAGED VOTE rides the same signal with its own three outcomes
      // (LANDED · RE-ASKED · PARKED) — see `settleStagedVote`.
      shell.reconcileStagedVoteWorldMove();
    } else if (stagedColonyOf(stagedPlayState.arm) !== undefined) {
      // …and a STAGED COLONY (TR07) the same three — see `settleStagedColony`.
      shell.reconcileStagedColonyWorldMove();
    } else if (stagedPlayActive()) {
      if (stagedPlayState.committing) {
        const arm = stagedPlayState.arm;
        const parked = shell.playerView.stagedPlacementPending;
        if (arm !== undefined && parked !== undefined && parked.card === arm.cardName) {
          beginStagedPin({
            cardName: arm.cardName, spaceId: parked.spaceId, tileType: stagedPlacementOf(arm)?.tileType,
            // A parked MOVE holds the cell the city leaves too (the server's own word).
            ...(parked.movedFrom !== undefined ? {movedFrom: parked.movedFrom} : {}),
          });
        }
        // …UNLESS THE PLAY OWES A SECOND DOOR (T03 Cultural Metropolis — `cardGrantHost.ts`): the answer raised this
        // card's own live delegate grant, so the flow is not over — it stays aside, comes back over the quiet board
        // (`resumeYieldedStackOverQuietBoard`, the placement's falling edge) and hosts the vote as its next step.
        if (!(arm?.flow === 'play' && cardGrantOwedTo(shell.playerView.waitingFor, yieldedStackCards()))) {
          discardYieldedStack();
        }
        // A card played THROUGH A LAW (RX36): its stage was yielded and is dropped with the stack — nothing of it is
        // kept (the composed play, the landing, the stage's own drafts it kept while it was only aside).
        if (arm?.flow === 'law') {
          endLawPlayLanding();
          clearLawPlayDraft();
        }
        if (!workspaceFrameKnown('card-actions')) {
          consoleCardActionsUi.draft = undefined;
        }
        clearStagedPlay();
      } else {
        shell.reconcileStagedPlayWorldMove();
      }
    }
    // A LIVE colony pick that moved the chosen tile's track (TR07's live door — a re-ask, a reload, a door
    // outside the staged boundary): the answer carried the move, the stage it was confirmed on plays it. The
    // follow-up stays live through it (`colonyFollowUpLive`), so the frame hands back only once it has landed.
    if (stagedColonyOf(stagedPlayState.arm) === undefined && colonyTrackMoveFlow.owed !== undefined) {
      void playOwedColonyTrackMove();
    }
    const phase = placementFlowState.phase;
    if (!placementActive.value || phase === 'navigate') {
      return;
    }
    if (phase === 'committing') {
      resetPlacementFlow();
      // The commit landed straight into a CHAINED placement — a new decision; nothing stays lifted.
      resetPlacementMove();
      return;
    }
    void shell.$nextTick(() => {
      if (placementFlowState.phase !== 'locked') {
        return;
      }
      const id = placementFlowState.lockedSpaceId;
      const el = id !== undefined ? document.querySelector(`[data_space_id="${id}"]`) : null;
      if (el === null || !el.classList.contains('board-space--available')) {
        unlockPlacementCell();
      }
    });
  }

  /**
   * PLANET FOCUS driver. Rising edge: the board becomes the stage (arcs
   * + off-Mars flanks recede, the planet expands, the four global-param
   * readouts freeze at their displayed values). Falling edge: the field's
   * whole story is over (pick resolved/cancelled, hero landed, field
   * rewards paid) — the exit transition returns the interface, and only
   * then may the scales move (the beat watcher below). planetFocus.ts
   * owns the phase machine; a mid-exit re-claim is a native reversal.
   */
  function whenPlanetFocusTargetChanges(now: boolean): void {
    if (now) {
      enterPlanetFocus();
    } else if (planetFocusState.mode !== 'ceremony') {
      // The ceremony's camera (TR70) is the scene's to exit — a placement target falling mid-scene lets it be.
      beginPlanetFocusExit();
    }
  }

  /**
   * The terraformed scene's END (TR70): a placement target that rose while the scene owned the camera (the mode
   * never took the target's enter — `enterPlanetFocus` is a no-op on an engaged camera) gets its own focus now;
   * a target that fell meanwhile gets the exit the ceremony's mode deferred.
   */
  function whenTerraformedSceneStatePhaseChanges(now: string): void {
    if (now !== 'idle') {
      return;
    }
    if (planetFocusTarget.value && !isPlanetFocusEngaged()) {
      enterPlanetFocus();
    } else if (!planetFocusTarget.value && isPlanetFocusEngaged() && planetFocusState.mode !== 'ceremony') {
      beginPlanetFocusExit();
    }
  }

  /**
   * THE FINALE TAKES THE BOARD whenever it stands open with no pick out (PL-295): the announce's A, the return
   * from a minimize, the next greenery after a landing (the commit hold `finalGreeneryCommitting` keeps it off
   * until the answer has landed and the landing hero holds the foreground). `post`: the admission it rides is
   * settled by then, and the board binder sees the prompt the pick answers.
   */
  function whenFinalGreeneryActiveChanges(on: boolean): void {
    if (on) {
      openFinalGreeneryOnBoard();
    }
  }

  /**
   * The finale's placement round-trip is over — the view-apply reaction says so on every applied view. Released a
   * TICK late on purpose: the placement hero is armed by this very response, and the one frame between «the answer
   * landed» and «the hero holds the foreground» is exactly the frame the screen used to blink in.
   */
  function releaseFinaleCommitAfterAnswer(): void {
    if (finalGreeneryCommitting.value) {
      void nextTick(() => {
        finalGreeneryCommitting.value = false;
      });
    }
  }

  return {
    releaseFinaleCommitAfterAnswer,
    placementLiveLatch,
    boardStoryCoverFor,
    taskSpacePending,
    finalGreeneryPickPending,
    finalGreeneryCommitting,
    tilePlacementHolds,
    nomadMoveHolds,
    finalGreeneryVm,
    finalGreeneryRawVm,
    finalGreeneryActive,
    remoteLandingBeforePlacement,
    placementTakesBoardForLanding,
    placementTakesBoardForStory,
    boardStoryBeforePlacement,
    boardStoryCoverCandidate,
    planetFocusOrder,
    boardStoryCoverOwed,
    boardInPlainViewForStory,
    placementHeldForBoardStory,
    scaleBonusOwesStory,
    chainPlacementOrderEmbedded,
    taskSpacePrompt,
    boardSpaceIds,
    placementHeld,
    placementActive,
    placementCancellable,
    placementChosenTarget,
    placementSourceView,
    placementSourceCard,
    placementSourceResolution,
    placementSourceInspectable,
    placementSpaceModel,
    placementRawSpaceModel,
    placementMoveLevelNow,
    placementMoveFamilyNow,
    placementMoveFrom,
    placementStaged,
    placementStagedPlate,
    placementStagedBar,
    planetFocusTarget,
    scaleStoryReadBlocked,
    placementPeekTarget,
    placementKickerKey,
    placementShape,
    plantConversion,
    plantExchangePrice,
    placementTitle,
    trackInfo,
    trackScaleOverview,
    inspectedCellSourceCard,
    placementWorldVersion,
    boardBeatsWatchable,
    onConvertPlantsSpacePicked,
    armBoardBonusIfCardCell,
    cancelPlacement: ownCancelPlacement,
    drainBoardBeats,
    resumeYieldedStackOverQuietBoard,
    onTaskSpacePick,
    onFinalGreenerySpacePick,
    openFinalGreeneryOnBoard,
    deferFinalGreenery,
    beginFinalGreeneryFinish,
    finishFinalGreenery,
    onTaskSpacePicked,
    enterStagedPlacement,
    onCardActionsStagedPlacement,
    onNotificationCancel,
    inspectCellSource,
    inspectPlacementSource,
    whenTaskSpacePendingChanges,
    whenBoardBeatsWatchableChanges,
    whenChainPlacementOrderEmbeddedChanges,
    whenPlacementHeldChanges,
    whenPlacementPeekTargetChanges,
    whenPlacementTakesBoardForLandingChanges,
    whenBoardStoryCoverOwedChanges,
    whenPlacementTakesBoardForStoryChanges,
    whenPlacementActiveChanges,
    whenPlacementMoveFromChanges,
    whenPlacementRawSpaceModelChanges,
    whenPlacementWorldVersionChanges,
    whenPlanetFocusOrderChanges,
    whenTerraformedSceneStatePhaseChanges,
    whenFinalGreeneryActiveChanges,
  };
}

export type PlacementController = ReturnType<typeof createPlacementController>;
