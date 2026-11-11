/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE HYDRO CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed, ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import type {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {intakeBatchSources} from '@/common/models/CardDrawRevealModel';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {submitInput, SubmitTicket} from '@/client/console/transport/gameTransport';
import {InputResponse} from '@/common/inputs/InputResponse';
import {deckPickState} from '@/client/console/deckPick/consoleDeckPick';
import {ConsoleRevealMode} from '@/client/components/console/consoleRevealOverlayTypes';
import ConsolePlayCardConfirm from '@/client/components/console/ConsolePlayCardConfirm.vue';
import {enterWorkspace, goBoardHome, leaveWorkspace, popWorkspaceFrame, pushWorkspaceFrame, setWorkspaceFramePhase, setWorkspaceFrameServes, workspaceFrameHasNested, workspaceFrameIndex, workspaceFramePhase, workspaceStackTop, workspaceFrameKnown, workspaceStackCollapsed, workspaceSceneOnStage, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {isCommitted} from '@/client/console/consoleWorkspaceFlow';
import {hydroBonusAdvancePlan, hydroBonusDoorAction, hydroBonusOffer} from '@/client/console/hydroFlow/hydroBonusOffer';
import {HYDRO_STAGES} from '@/client/components/hydronetwork/hydroStages';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {ConsoleTask, TaskKind} from '@/client/console/consoleTaskRouter';
import {promptSourceView} from '@/client/console/promptSource';
import {orOptionResponse} from '@/client/console/taskResponses';
import {armHydroMarker, armHydroMarkerTraversal, abortHydroMarker, isHydroMarkerActive, hydroMarkerState, hydroRewardHoldOwed, hydroRewardWaveActive, HydroMarkerLegPlan, hydroActiveStepSourceCard, hydroPlanDeclaresSource, hydroStepQueuedFor, hydroTraversalPaused, hydroTraversalPending, resumeHydroMarkerTraversal, hydroParkedForeignStop} from '@/client/console/hydroMarker/consoleHydroMarker';
import {HydroResolutionKind, HydroTraversalSegmentRecord, advanceHydroCommitPhase, beginHydroCommit, hydroCeremonyOwed, hydroFlowSetAside, hydroFlowState, hydroResolutionBusyOf, hydroWorkspacePhase, isHydroCeremonyActive, resetHydroFlow, resolutionKindFor, rollbackHydroCommit, setHydroRepeatBridge} from '@/client/console/hydroFlow/consoleHydroFlow';
import {ShellTaskDestination} from '@/client/console/shellTaskSurface';
import {workspaceClaimsRevealSource, workspaceOutcomeClaimed, claimWorkspaceOutcome, markWorkspaceOutcomeBeatDone, releaseWorkspaceOutcome, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import type {WorkspaceOutcomeKind, WorkspaceOutcomeScope} from '@/client/console/consoleWorkspaceOutcome';
import {ResourceTransferSpec, mergeTransferSpecs} from '@/client/console/resourceTransfer/resourceTransferModel';
import type {DeltaMovementBonusProjection} from '@/common/models/DeltaTrackPreviewModel';
import {movementBonusTransfers, withMovementBonusOnLastLeg} from '@/client/console/hydroFlow/hydroMovementBonus';
import {resetCardResourceLandings} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {commitRewardSpecs} from '@/client/console/consoleActionCommit';
import {hydroNetworkState, resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import type {HydroDeltaLine} from '@/client/components/hydronetwork/hydroReward';
import {buildRewardView, HydroPlayerSnapshot} from '@/client/components/hydronetwork/hydroReward';
import {Tag} from '@/common/cards/Tag';
import {hydroRewardTransfers} from '@/client/console/hydroMarker/hydroRewardTransfers';
import type {DeltaEspionageProjectionModel} from '@/common/models/DeltaEspionageModel';
import type {DeltaStageAnswer} from '@/common/inputs/InputResponse';
import {consoleHydroUi} from '@/client/console/consoleHydroState';
import {consoleState} from '@/client/console/consoleRouter';
import {actionPreviewMap, branchOutcomeClaimPlan, previewBranchByIndex} from '@/client/console/actionPreviewStore';
import {gameStateVersion} from '@/client/console/gameStateVersion';
import {enterConsoleRepeatPick, ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {hydroAdvanceBatch, hydroAdvanceResponses, hydroAdvanceTail, HydroAdvancePayload} from '@/client/console/consoleHydroAdvance';
import {cardDeltaAdvanceCard, cardDeltaAdvanceOffer, deltaAdvanceEntryState, deltaAdvancePrefix} from '@/client/console/hydroFlow/deltaAdvanceEntry';
import {DeltaRewardDraft, DeltaRewardPickRequest, cancelDeltaRewardPick, deltaRewardPickState, isDeltaRewardPickActive, resolveDeltaRewardPick} from '@/client/console/hydroFlow/deltaRewardEntry';
import {DeltaEspionageDraft, DeltaEspionagePickRequest, cancelDeltaEspionagePick, deltaEspionagePickState, deltaEspionageStepResponse, enterDeltaEspionagePick, isDeltaEspionagePickActive, resolveDeltaEspionagePick} from '@/client/console/hydroFlow/deltaEspionageEntry';
import type {DeltaEspionageInputModel} from '@/common/models/PlayerInputModel';
import {DeltaBlockadeDraft, DeltaBlockadePickRequest, blockadeExecutionState, cancelDeltaBlockadePick, deltaBlockadePickState, deltaBlockadeStepResponse, endBlockadeExecution, enterDeltaBlockadePick, isBlockadeExecutionActive, isDeltaBlockadePickActive, resolveDeltaBlockadePick} from '@/client/console/hydroFlow/deltaBlockadeEntry';
import type {DeltaBlockadeInputModel} from '@/common/models/PlayerInputModel';
import {offTurnReason} from '@/client/console/offTurnReason';
import {findHydroActionPath, optionResponseForPath, findPerformActionCard} from '@/client/console/turnIntents';
import {motionMs} from '@/client/components/motion/motionTokens';
import {PromptSurface} from '@/client/console/consolePromptAdmission';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {PendingPlayCard} from '@/client/console/shell/shellShared';
import type {SeatController} from '@/client/console/shell/seatController';
import type {NoticeController} from '@/client/console/shell/noticeController';

/** The hydro RESULT stage's read hold — long enough for the route + reward
 *  lines, skippable by A/B (both land in `finishHydroFlow`). */
const HYDRO_RESULT_HOLD_MS = 2400;

/**
 * The ARMED mark of the result's read hold (`hydroResultTimer`). The hold itself is a timer of the controller's own
 * scope (`cancelHydroResult`); the ref only says «armed» to its readers (the stuck-flow probe, the doors below). Never
 * a timer id — negative on purpose, so the shell's teardown, which still hands it to `clearTimeout`, clears nothing.
 */
const HYDRO_RESULT_ARMED = -1;

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type HydroPort = {
  $nextTick(fn?: () => void): Promise<void>,
  $refs: Record<string, unknown>,
  admits(surface: PromptSurface): boolean,
  awaitingInput: UnwrapRef<SeatController['awaitingInput']>,
  readonly cardArrivalBusy: boolean,
  concludeWorkspaceFlowOrOwe(kind: WorkspaceFrameKind, servedPromptHolds?: boolean): boolean,
  readonly consoleRevealMode: ConsoleRevealMode | undefined,
  readonly deckPickActive: boolean,
  deferShellTask(destination: ShellTaskDestination): void,
  readonly hostTask: ConsoleTask | undefined,
  pendingPlayCard: PendingPlayCard | undefined,
  readonly playerView: PlayerViewModel,
  readonly repeatPickActive: boolean,
  showNotice: UnwrapRef<NoticeController['showNotice']>,
  submitBatch(responses: ReadonlyArray<unknown>, promptId?: number): SubmitTicket,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
  viewerPassed: UnwrapRef<SeatController['viewerPassed']>,
  readonly workspaceOutcomePromptServed: boolean,
  readonly workspaceOutcomeServingNow: boolean,
};

export function createHydroController(shell: HydroPort) {
  // The controller's own scope (architecture v2 — PLAN §10 · C1): it ends with the shell, and the result's read hold
  // with it.
  const flow = useFlowScope('hydro-controller');
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The hydro flow-close truth witnesses' uninstaller (presentationLedger). */
  const offHydroWitnesses = ref(undefined as (() => void) | undefined);
  /** The hydro result stage's read hold (A/B skip it): `HYDRO_RESULT_ARMED` while it stands, `undefined` at rest —
   *  the timer itself is `flow`'s (`cancelHydroResult`). */
  const hydroResultTimer = ref(undefined as number | undefined);
  let cancelHydroResult: () => void = () => {};
  /** The Hydronetwork was opened BY a card's bonus offer (not by the
   *  player), so answering it hands the screen back. */
  const hydroBonusBorrowed = ref(false);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * The stage-reward pick is OUT (reactive read of the bridge state). While
   * it stands the hydro section must SHOW even though a pick bridge is
   * active: a REPEAT-mode composer's landing pre-select opens the track
   * OVER the repeat browser (the deepest descent owns the screen), and the
   * generic «hide hydro behind a pick bridge» v-show would blank the very
   * surface the player just descended into.
   */
  const deltaRewardPickOut = computed((): boolean => {
    return deltaRewardPickState.active;
  });

  /**
   * ANY Hydronetwork pick/execution INSTRUMENT is out — the track must
   * SHOW even while a pick bridge hides its sources (the deepest descent
   * owns the screen). ONE computed over all four doors, so a new
   * instrument cannot be forgotten in the v-show: the carve-out used to
   * name only the reward pick, and a blockade pick standing over a repeat
   * browser rendered a hidden track under a live command bar.
   */
  const hydroInstrumentOut = computed((): boolean => {
    return deltaRewardPickState.active || isDeltaBlockadePickActive() ||
      isDeltaEspionagePickActive() || isBlockadeExecutionActive();
  });

  /**
   * A HYDRO frame stands OVER the hand (the espionage target pick / the
   * espionage execution). The two sections are flex siblings of one
   * `.con-main` row — rendered together they split it in half — so the
   * covered hand yields the row for exactly as long as the cover stands.
   */
  const handCoveredByHydro = computed((): boolean => {
    const hand = workspaceFrameIndex('hand');
    return hand !== -1 && workspaceFrameIndex('hydro') > hand;
  });

  /** A Corporate Espionage EXECUTION stands — its falling edge with the play's prompt still standing is a refusal. */
  const espionageExecutionStanding = computed((): boolean => {
    return hydroFlowState.commit?.espionage !== undefined;
  });

  // ── the HYDRO workspace flow (post-commit continuation) ──────────────
  /**
   * A follow-up DECISION of the committed advance is standing — the flow's
   * `resolving` beat becomes the collapsible `committed` phase. Any viewer
   * prompt during a hydro commit IS the advance's own chain (the batch is
   * replayed sequentially; nothing else can interleave a demand).
   */
  const hydroFollowUpLive = computed((): boolean => {
    if (hydroFlowState.commit === undefined) {
      return false;
    }
    if (shell.deckPickActive) {
      return true;
    }
    // THE OWNERSHIP FACT, read RAW. `deckPickActive` above is an
    // admission-gated rendering predicate: any `host` block (a bot-turn
    // presentation hold, an announce gate, a card-arrival flight, a foreign
    // reveal) blinks it false while the pick prompt is still unanswered —
    // and that blink used to read as «the follow-up is over», walk the flow
    // to its result stage and close the workspace under an open pick, the
    // prompt then falling to the standalone band. A prompt the claim serves
    // IS the advance's own chain, whatever the gates are doing this frame
    // (deliberately the PROMPT half only: a batch QUEUED for a later stage
    // must stay invisible here — see the queued-reveal deadlock below).
    if (workspaceOutcomeState.host === 'hydro' && shell.workspaceOutcomePromptServed) {
      return true;
    }
    // A stage-gated task needs no term here: `admits('host')` already refuses
    // it (the `stage-gate` block), so `hostTask` is undefined for it.
    if (shell.hostTask !== undefined && !consoleState.task.deferred) {
      return true;
    }
    // …AND A PROMPT THE COPIED ACTION RAISED THAT NO SURFACE TERM CAN SEE.
    // A `space` prompt is served by the ALWAYS-MOUNTED board, so `hostTask`
    // is undefined for it, there is no reveal and no nested frame — every
    // term above is blind to it. The stage-7 reuse whose repeated action
    // ends in a TILE (Mars Nomads' MOVE) therefore read as «the follow-up is
    // over» the instant the board lit up: the flow walked to its result
    // stage while the player was still choosing a hex, spent the result
    // hold behind the covered workspace, finished itself — and the track
    // came back to its ordinary browse view, the movement's own summary
    // never played (`console-hydro-copied-tile`).
    //
    // The SERVER'S OWN STAMP is the witness (`copiedActionSource`, set from
    // the live copied-action event scope for EVERY prompt a copy raises), and
    // the queued gate is what keeps it from deadlocking the walk: a prompt
    // stamped for a stage the marker has not reached yet is the CONTENT of a
    // later stop, exactly as a queued reveal is.
    if (shell.playerView.waitingFor?.copiedActionSource !== undefined &&
        !hydroQueuedPromptForLaterStep.value) {
      return true;
    }
    if (shell.consoleRevealMode !== undefined) {
      return true;
    }
    // …and a batch the server has DRAWN for the viewer that they have not
    // TAKEN yet — even while the deal / closing-beat holds keep it from
    // presenting (`rawDrawnRevealPending` blinks false exactly there, and
    // the deck pick's own falling edge lands in that very window). The
    // unconsumed queue is the evidence that never blinks; it empties at
    // the take. Without this term the traversal RESUMED over the repeat's
    // still-unpresented draw, finalized, and the result flip retracted the
    // zone the batch was about to embed in — a claimed reveal held forever.
    //
    // ⚠️ …BUT A BATCH THE TRAVERSAL ITSELF IS QUEUEING IS NOT A FOLLOW-UP OF
    // THE CURRENT STOP — it is the CONTENT OF A STAGE THE MARKER HAS NOT
    // REACHED, and counting it here is a deadlock: the walk that has to reach
    // stage 7 was blocked by stage 7's own batch, so the only way to make
    // progress was to present that batch over the stage-5 scene. That is
    // exactly the frame in `20260831011413_1.jpg`. The gate (which is derived
    // from the plan the shell itself armed) is what breaks the cycle: queued
    // ⇒ invisible to this predicate ⇒ the traversal resumes ⇒ the marker
    // arrives ⇒ the step activates ⇒ the batch stops being queued and
    // presents, inside its own stage.
    if (hydroQueuedRevealForLaterStep.value) {
      return false;
    }
    // ⚠️ OWNERSHIP-SCOPED, never presence (the source law). «A batch
    // exists» is a strict superset of «a batch of OURS exists», and the two
    // diverge exactly on the batches with their own presenters: an
    // out-of-band delivery (another player's / the bot's effect drawing FOR
    // the viewer — the notification-correlated arrival), a board-born
    // reward parked behind this very workspace. Counted here, a foreign
    // batch held the flow's close gate while its own presentation waited
    // for the workspace to leave — a deadlock only some unrelated 20–30 s
    // safety broke, which read on screen as «финальный экран завис и потом
    // сам прошёл». The same read also gates the traversal RESUME
    // (`hydroTraversalResumeReady`), so an unscoped term froze a parked
    // walk for as long as the foreign batch stood.
    const pendingBatch = currentRevealEvent();
    if (pendingBatch !== undefined && intakeBatchSources(pendingBatch).some((source) => hydroOwnsRevealBatch(source))) {
      return true;
    }
    // A hosted step (a repeated trade's colony frame) still standing.
    return workspaceFrameHasNested('hydro');
  });

  /**
   * ── THE STAGE-BOUND ACTIVATION GATE, read (hydroStepAdmission) ─────────
   *
   * A Hydronetwork traversal resolves on the SERVER atomically — one request
   * walks every crossed stage — while it PRESENTS as a walk. The gap is real
   * and by design, so the client owns the question the server cannot answer:
   * «whose step is this surface?». A surface attributed to a card the standing
   * plan promised to a stage the marker has NOT physically settled on is
   * QUEUED: it may not present, may not take focus, and is not the current
   * stop's live follow-up.
   *
   * Structural, never textual: the plan carries the pre-selected `CardName`
   * (`HydroMarkerLegPlan.sourceCard`), the server attributes the batch
   * (`CardDrawRevealSource {type:'card'}`) and the prompt (`choiceContext`)
   * to the card that RAN, and those two names are what match.
   */
  const hydroQueuedRevealForLaterStep = computed((): boolean => {
    const ev = currentRevealEvent();
    return ev !== undefined && hydroStepQueuedFor(ev.source);
  });

  /**
   * …the same gate for a PROMPT the copied action raises (a target pick, a
   * resource placement) — the generalization the contract asks for: the family
   * is «what a copied card action produces», not «a draw».
   *
   * Read off the RAW `waitingFor`, never off `activeConsoleTask`: admission is
   * what that computed is DERIVED from, so asking it here would be a cycle.
   */
  const hydroQueuedPromptForLaterStep = computed((): boolean => {
    // THE SERVER'S OWN STAMP FIRST. `copiedActionSource` is put on the prompt
    // by `Player.setWaitingFor` from the live copied-action event scope, so it
    // is present for EVERY prompt a copied action raises — including the ones
    // no card ever marked, which is exactly the hole this closes: a repeated
    // colony trade raises a bare `SelectColony` with no `choiceContext` at all,
    // so the source-view read below saw nothing and the colonies screen was
    // free to open while the marker was still walking.
    const stamped = shell.playerView.waitingFor?.copiedActionSource;
    if (stamped !== undefined && hydroStepQueuedFor(stamped)) {
      return true;
    }
    const card = promptSourceView(shell.playerView.waitingFor)?.card;
    return card !== undefined && hydroStepQueuedFor(card);
  });

  /** The card whose action the ACTIVE traversal step repeats — the source
   *  context the workspace stands beside the copied action's own prompt. */
  const hydroActiveStepSource = computed((): CardName | undefined => {
    return hydroActiveStepSourceCard();
  });

  /** The viewer's committed track position — the SERVER truth the flow's
   *  recovery net keys on (a degraded glide must not hang the commit). */
  const hydroViewerTrackPosition = computed((): number => {
    return shell.thisPlayer.deltaProject?.position ?? 0;
  });

  /**
   * The RESOLUTION is still physically happening: the marker glide, the
   * reward chips in flight (or still held for their flight), a follow-up
   * decision, the ceremony. Its falling edge — never a timeout — is what
   * advances the flow to the result stage.
   */
  /** The hydro frame is on the stack (reactive — the frames array): its RETURN from a park / a yield is an edge. */
  /**
   * THE HYDRONETWORK'S SCENE IS ON STAGE — its frame on the live stack and nothing hiding it (`workspaceSceneOnStage`).
   * The RISING EDGE is the frame's RETURN, whichever door brought it back (the board's resume, the restore card, a
   * deferral lifted): the one edge on which the flow re-reads its phase and re-asks its conclusion.
   */
  const hydroFrameStands = computed((): boolean => {
    return workspaceSceneOnStage('hydro');
  });

  const hydroResolutionBusy = computed((): boolean => {
    // The predicate itself is pure + spec'd (`hydroResolutionBusyOf`): its
    // FALLING EDGE is what lets the flow reach its result stage, and the
    // result stage is the only door to closing the workspace. A signal
    // missing from it is a workspace that closes over its own animation.
    return hydroResolutionBusyOf({
      committed: hydroFlowState.commit !== undefined,
      markerGliding: isHydroMarkerActive(),
      // THE FLOW'S OWN reward work only (never the global panel hold / transfer facts): a foreign scene's hold — another
      // seat's tile paying the viewer, parked for a board THIS workspace covers — made the resolution busy for as long
      // as the landing waited, and the landing waited for this workspace to leave (the owner's freeze, 2026-10-31).
      rewardHeld: hydroRewardHoldOwed(),
      transfersFlying: hydroRewardWaveActive(),
      ceremony: isHydroCeremonyActive(),
      followUpInteractive: hydroFollowUpLive.value,
      // A multi-leg traversal plan (Delta Surge) holds the flow through its
      // pauses too — its own completion is the only thing that drops it.
      traversalPending: hydroTraversalPending(),
      // …and the TAKEN CARD'S FLIGHT to the dock: `consoleRevealMode` ends
      // a tick after the take press, ~a second before the card physically
      // lands — the delivery flights are the only signal that spans it.
      intakeFlying: shell.cardArrivalBusy,
      // A terminal landing owes its CULMINATION from the commit until the
      // ceremony has finished presenting — the summary may never be skipped
      // by the gap between the marker's settle and the ceremony's start.
      ceremonyOwed: hydroCeremonyOwed(),
    });
  });

  /**
   * THE TRAVERSAL MAY GLIDE ON — the parked sequence's stop has fully
   * resolved: no live follow-up, the deck pick's own closing beats done,
   * the taken card PHYSICALLY LANDED in the dock (the delivery flights are
   * the one signal that survives to the landing), and the workspace
   * actually on screen (a park is never a completion). The watcher below
   * resumes on the rising edge; re-evaluated on restore too, because every
   * term is reactive.
   */
  const hydroTraversalResumeReady = computed((): boolean => {
    return hydroTraversalPaused() &&
      // A FOREIGN prompt stop (the espionage target's own decision) waits
      // for the SERVER's evidence, never for the local screen going quiet —
      // its resume is the owner-position watcher's, and it alone.
      !hydroParkedForeignStop() &&
      hydroFlowState.commit !== undefined &&
      !hydroFollowUpLive.value &&
      !shell.cardArrivalBusy &&
      deckPickState.phase === 'idle' && !deckPickState.committing &&
      !consoleState.task.deferred &&
      !workspaceStackCollapsed();
  });

  /** An embedded DRAWN-CARDS batch owns the hydro stage right now — the
   *  section's immersive pose covers it exactly as it covers the deck pick
   *  (the cards are the primary content; the columns dissolve). */
  const hydroRevealEmbedded = computed((): boolean => {
    return shell.consoleRevealMode === 'drawn' &&
      workspaceOutcomeState.host === 'hydro' &&
      workspaceOutcomeState.embedSlot !== '';
  });

  /**
   * A CARD-GRANTED BONUS MOVE on the track — read STRUCTURALLY off the
   * server's own `deltaBonusPrompt` marker, never off an option title.
   */
  const hydroBonusOfferRaw = computed((): ReturnType<typeof hydroBonusOffer> => {
    return hydroBonusOffer(shell.playerView.waitingFor);
  });

  /**
   * …AND ITS DOOR. `followUp` is the family for a screen OPENED for a prompt
   * that arrived beside an effect the player is still working through — which
   * is exactly this case: the placement that granted the move routinely draws
   * a card in the SAME response, and the drawn-cards reveal must be finished
   * («processed» = every card TAKEN) before the track is put on screen.
   * Without this the offer stood under a live reveal, both from one placement.
   */
  const hydroBonusOfferLive = computed((): boolean => {
    return hydroBonusOfferRaw.value !== undefined && shell.admits('followUp');
  });

  /**
   * A MOVE THE PLAYER CHOSE inside a card's own action (Storm Surge Barrier's
   * advance mode) — the SECOND provenance of the same offer, and the one with
   * NOTHING on the wire: the entry lock is client state until the workspace's
   * own confirm sends the card's whole batch.
   *
   * No admission gate, deliberately: an offer the player WALKED to has no
   * arriving effect to wait out, and there is no prompt to hold back.
   */
  /** The REWARD-ONLY pick bridge (Dutch Mountains) — the request the hydro
   *  section presents in reward-select mode while the bridge stands. */
  const hydroRewardOffer = computed((): DeltaRewardPickRequest | undefined => {
    return deltaRewardPickState.active ? deltaRewardPickState.request : undefined;
  });

  /** The ESPIONAGE target-pick bridge (Corporate Espionage) — the request
   *  the hydro section presents in target-selection mode. */
  const hydroEspionageOffer = computed((): DeltaEspionagePickRequest | undefined => {
    return deltaEspionagePickState.active ? deltaEspionagePickState.request : undefined;
  });

  /** The BLOCKADE target-pick bridge (Modular Floodgates, DP11) — the
   *  request the hydro section presents in blockade-selection mode. */
  const hydroBlockadeOffer = computed((): DeltaBlockadePickRequest | undefined => {
    return deltaBlockadePickState.active ? deltaBlockadePickState.request : undefined;
  });

  /** The committed DEPLOY's execution surface — the track as the scene the
   *  fresh gate assembles on (see deltaBlockadeEntry's execution half). */
  const hydroBlockadeExecution = computed((): {target: Color, source: CardName} | undefined => {
    const s = blockadeExecutionState;
    return s.active && s.target !== undefined && s.source !== undefined ?
      {target: s.target, source: s.source} : undefined;
  });

  /** The STANDALONE blockade ask (a refused/stale batch answer, a
   *  reconnect) — the raw top-level prompt, structural off its own type. */
  const blockadePromptRaw = computed((): DeltaBlockadeInputModel | undefined => {
    const wf = shell.playerView.waitingFor;
    return wf?.type === 'deltaBlockade' ? wf as DeltaBlockadeInputModel : undefined;
  });

  /** The door's own edge: the ask stands and nothing serves it yet (the
   *  espionage-door contract — an unrelated live flow keeps it shut). */
  const blockadePromptDoorSignal = computed((): boolean => {
    if (blockadePromptRaw.value === undefined || isDeltaBlockadePickActive()) {
      return false;
    }
    return hydroFlowState.commit === undefined && !isHydroMarkerActive();
  });

  /** The STANDALONE espionage ask (a refused/stale batch answer, a
   *  reconnect) — the raw top-level prompt, structural off its own type. */
  const espionagePromptRaw = computed((): DeltaEspionageInputModel | undefined => {
    const wf = shell.playerView.waitingFor;
    return wf?.type === 'deltaEspionage' ? wf as DeltaEspionageInputModel : undefined;
  });

  /** The door's own edge: the ask stands and nothing serves it yet. A
   *  STANDING espionage commit beside the ask means the server REFUSED the
   *  batch answer (stale target) while the presentation was already armed —
   *  the handler rolls that presentation back before opening the door. */
  const espionagePromptDoorSignal = computed((): boolean => {
    if (espionagePromptRaw.value === undefined || isDeltaEspionagePickActive()) {
      return false;
    }
    // Openable now: no hydro presentation stands — or the one standing is
    // the espionage's OWN refused optimistic execution (rolled back by the
    // handler). An unrelated live flow keeps the door shut until it ends,
    // and the commit's fall re-evaluates this computed.
    return hydroFlowState.commit?.espionage !== undefined ||
      (hydroFlowState.commit === undefined && !isHydroMarkerActive());
  });

  /** The bridge's frame is alive (a PARKED one included) — the falling edge
   *  cancels the pick so the composer never waits on a dead bridge. */
  const hydroRewardFrameLive = computed((): boolean => {
    return workspaceFrameKnown('hydro');
  });

  const hydroCardOffer = computed((): ReturnType<typeof cardDeltaAdvanceOffer> => {
    return cardDeltaAdvanceOffer();
  });

  /** Does a hydro frame (live or parked) still exist to carry the entry? */
  const cardDeltaEntryFrameLive = computed((): boolean => {
    return workspaceFrameKnown('hydro');
  });

  /**
   * OPEN vs QUEUE. An ocean placed while the player was ALREADY on the track
   * must not tear the workspace down and rebuild it — the offer joins the
   * flow it is already in. Policy lives in the pure module.
   */
  /**
   * THE OFFER IS OVER — a computed SIGNAL of everything the hand-back waits
   * for, so the return fires on whichever of them settles last (the answer's
   * response, a reward step closing, a follow-up ending).
   */
  const hydroBonusReturnSignal = computed((): string => {
    return [
      hydroBonusOfferRaw.value === undefined,
      hydroFlowState.step === undefined,
      hydroFlowState.commit === undefined,
      !workspaceFrameHasNested('hydro'),
      !hydroFollowUpLive.value,
    ].join('|');
  });

  const hydroBonusDoor = computed((): ReturnType<typeof hydroBonusDoorAction> => {
    return hydroBonusDoorAction({
      offerLive: hydroBonusOfferLive.value,
      frameKnown: workspaceFrameKnown('hydro'),
    });
  });

  /**
   * THE DOOR'S DECISION **AND THE FRAME IT MUST BE APPLIED TO**.
   *
   * The action alone is not enough to watch, and both gaps stranded a live
   * prompt:
   *  - A RELOAD with the offer already on the wire evaluates the action as
   *    `open` on the FIRST computation and never changes it, so a change
   *    watcher never runs — the workspace never opened, the leak detector
   *    (rightly) reported «STRANDED PROMPT: waitingFor "or"», and the amber
   *    guard was the only thing on screen. The mount edge is asked from
   *    `mounted()`, never with `immediate` (that runs at SETUP, before the
   *    first render).
   *  - OPENING «ГИДРОСЕТЬ» FROM THE WHEEL while the offer is parked keeps the
   *    action at `queue` (a parked frame is still «known»), yet creates a
   *    BRAND-NEW live frame that has not earned its `serves` — so the screen
   *    the player is standing in did not count as the prompt's home, and the
   *    top chip flashed for attention at somebody standing on the decision.
   *
   * The frame's depth is therefore part of the signal, and the handler is
   * idempotent so any number of edges is harmless.
   */
  const hydroBonusDoorSignal = computed((): string => {
    return [hydroBonusDoor.value, workspaceFrameIndex('hydro')].join('|');
  });

  const hydroActionAvailable = computed((): boolean => {
    return findHydroActionPath(shell.playerView.waitingFor) !== undefined;
  });

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
  const hydroCacheKey = computed((): string => {
    return gameStateVersion(shell.playerView);
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * The hydro stage-7 pick (reuse-a-blue-action) — the ДЕЙСТВИЯ КАРТ
   * surface in REPEAT mode: the SAME premium browser + composer Viron /
   * Проверка проекта use (full dossier, filters, honest reasons, EVERY
   * pre-select of the chosen action composed in place). A PRE-SELECT: the
   * resolve writes the plan (hydroNetworkState.selectedCard + the composed
   * tail), the marker does not move, and the player returns to the hydro
   * summary to commit deliberately. (Stage 9 lives in the workspace's own
   * embedded target step now — the flat pick sheet is gone.)
   */
  function openHydroRepeatPick(): void {
    const preview = hydroNetworkState.previewColor === shell.thisPlayer.color ?
      hydroNetworkState.preview : undefined;
    const candidates = preview?.reuseActionCards ?? [];
    if (candidates.length === 0 || shell.repeatPickActive) {
      shell.showNotice('Unavailable right now');
      return;
    }
    // A «change» re-open pre-focuses the previous pick; the filter the player
    // relaxed during THIS operation is kept (fresh open resets it — the
    // bridge scopes the default to the operation).
    const previous = consoleHydroUi.repeatResult;
    const prior = previous !== undefined && previous.chosenCard === hydroNetworkState.selectedCard ?
      {chosenCard: previous.chosenCard, nodeIndex: previous.nodeIndex} : undefined;
    setHydroRepeatBridge(true);
    // THE HANDOFF: the hydro workspace releases FIRST and the nested scene
    // opens on its settle — one surface leaves, the next arrives. (Opening
    // straight away is what stacked one workspace over the other, the
    // parent still lit underneath.) The return half rides the bridge's own
    // falling edge, out of the exact pose the release left behind.
    // The ORDERED RESOURCE PLAN's verdict: candidates no payment
    // composition of this move can feed are greyed WITH the reason —
    // a promise the plan cannot keep is never offered as pickable.
    const planDisabled = consoleHydroUi.repeatDisabled;
    const disabledNames = new Set(planDisabled.map((d) => d.name));
    const openBridge = (): void => {
      enterConsoleRepeatPick({
        title: 'Use a blue card action that has already been used this generation',
        buttonLabel: 'Take action',
        candidates: candidates.filter((c) => !disabledNames.has(c)),
        disabled: planDisabled,
        // The fork presents the Hydronetwork as a systemic module — the
        // breadcrumb names IT, never the lore «Delta Project» card.
        source: {kicker: 'Mars Hydronetwork', card: CardName.DELTA_PROJECT, label: 'Mars Hydronetwork'},
        prior,
      }, (result) => {
        // A PLAN write (never a submit): the shared brain keeps the card, the
        // console layer keeps the composition. The player lands back on the
        // hydro summary — «Укрепить» stays THEIR deliberate press.
        hydroNetworkState.selectedCard = result.chosenCard;
        consoleHydroUi.repeatResult = result;
        setHydroRepeatBridge(false);
      }, () => {
        setHydroRepeatBridge(false);
      });
    };
    // NO POSE-AND-HEAL HANDOFF. The step is a FRAME now: the track wears
    // `--yielded` for exactly as long as that frame stands inside it (derived
    // state — it cannot survive the pick), and the browser's own entrance
    // carries the arrival. The old release tween dimmed the track's layers to
    // 12 % and depended on a return tween to undo it; a return that did not
    // land left the workspace on screen and dead, which is precisely what B
    // out of the pick used to produce.
    openBridge();
  }

  // ── hydro advance (mirrors PlayerHome.submitHydroAdvance; the stage-7
  //    COMPOSED repeat appends the ProjInsp/Viron-parity batch tail) ─────
  /**
   * THE OFFER IS OVER — return to the flow the player came from.
   *
   * A prompt-anchored frame hands the screen back when its prompt is gone;
   * this is that hand-back, and it is deliberately keyed on the RAW offer
   * rather than the admitted one (the door's own gate falls first while the
   * answer is in flight). It waits for the move's own consequences: a reward
   * step still open, a commit beat, a follow-up the track raised — the same
   * «nothing is still owed» the shared conclusion asks.
   */
  function hydroBonusReturn(): void {
    if (!hydroBonusBorrowed.value || hydroBonusOfferRaw.value !== undefined) {
      return;
    }
    if (hydroFlowState.step !== undefined || hydroFlowState.commit !== undefined ||
        workspaceFrameHasNested('hydro') || hydroFollowUpLive.value) {
      return; // the move is still resolving — its own ending will come here
    }
    // …and a LIVE HYDRO CLAIM is the move still resolving even with the
    // flow record already reset (`hydroFollowUpLive` short-circuits false
    // on `commit === undefined`): its outcome — a pick, a batch — still
    // needs this workspace's zone. `goBoardHome` here popped the frame
    // under it and the prompt fell to the standalone band.
    if (workspaceOutcomeState.host === 'hydro' && workspaceOutcomeClaimed()) {
      return;
    }
    hydroBonusBorrowed.value = false;
    setWorkspaceFrameServes('hydro', []);
    goBoardHome();
  }

  function syncHydroBonusDoor(): void {
    const action = hydroBonusDoor.value;
    if (action === 'none') {
      return;
    }
    if (action === 'open') {
      shell.deferShellTask('hydro');
      enterWorkspace('hydro', {anchor: {type: 'prompt', promptType: 'or'}});
      // REMEMBER that WE opened it. The offer is a visit the player did not
      // ask for, so answering it must hand the screen back — but a player who
      // was ALREADY on the track (the `queue` case) keeps their own screen.
      hydroBonusBorrowed.value = true;
    }
    // IDEMPOTENT, and re-asserted on every edge: a frame that was stood up
    // by the wheel (or restored from the park) must ALSO earn the serve, or
    // the screen the player is looking at is not the prompt's home as far as
    // the leak detector, the chip beacon and `frameServing` are concerned.
    setWorkspaceFrameServes('hydro', ['choice']);
  }

  /**
   * ANSWER a card-granted bonus move. ONE call, the ordinary submit funnel —
   * the index is the SERVER's own (`deltaBonusPrompt.advanceIndex` /
   * `.skipIndex`), so the console never depends on the option order it sees.
   */
  function submitHydroBonus(payload: {
    take: boolean, index: number, rewardChoice: number | undefined,
    selectedCard?: CardName, repeat?: ConsoleRepeatPickResult,
    fromPosition?: number, toPosition?: number, spend?: number,
    rewards?: ReadonlyArray<ResourceTransferSpec>,
    resultLines?: ReadonlyArray<HydroDeltaLine>, vp?: number, stageNameKey?: string,
    movementBonuses?: ReadonlyArray<DeltaMovementBonusProjection>,
    sourceCard?: CardName,
    targetBefore?: number,
  }): void {
    // The flow owns the moment from the first press — a second one (a double
    // tap, a held button, a raced click) finds a standing commit / an armed
    // marker and does nothing. Identical guard to `submitHydroAdvance`,
    // because the double-submit it prevents is identical.
    if (isHydroMarkerActive() || hydroFlowState.commit !== undefined) {
      return;
    }
    // ONE batch, and literally the SAME TAIL the standard advance sends
    // (`hydroAdvanceTail`): the offer's own answer, then everything the
    // LANDED STAGE defers — the reward choice (pos 1/2) and the card pick
    // (pos 7's composed repeat / pos 9's animal target). The two ways onto
    // the track differ only in how the move is authorised; from the landing
    // on they are the same server code, so they are the same batch. A bonus
    // move that omitted this tail is how the stage-7 pick arrived AFTER the
    // commit, as a standalone legacy card browser.
    const responses: Array<unknown> = [
      orOptionResponse(payload.index),
      ...(payload.take ? hydroAdvanceTail({
        spend: 0, // the prefix is the offer's own index, never a spend step
        rewardChoice: payload.rewardChoice,
        selectedCard: payload.selectedCard,
        repeat: payload.repeat,
      }) : []),
    ];
    // TAKING IS AN ADVANCE, so it opens the ADVANCE's presentation — the very
    // same one «Укрепить гидросеть» opens. The player must not be able to
    // tell a bonus move from a paid one by watching it: the marker glides,
    // the landed stage pays out through the reward wave, the counters tick on
    // touchdown and the result stage holds. Without this the answer went
    // straight onto the wire, the workspace had nothing to wait for and
    // closed on the spot — the move happened entirely off screen.
    if (payload.take) {
      const to = payload.toPosition ?? 0;
      const plan = hydroBonusAdvancePlan(HYDRO_STAGES[to]);
      beginHydroAdvancePresentation({
        kind: resolutionKindFor(to, {
          composedRepeat: payload.repeat !== undefined,
          selectedCard: payload.selectedCard,
        }),
        fromPosition: payload.fromPosition ?? 0,
        toPosition: to,
        spend: payload.spend ?? 0,
        spendSteel: 0,
        rewardChoice: payload.rewardChoice,
        selectedCard: payload.selectedCard,
        composedRepeat: payload.repeat !== undefined,
        targetBefore: payload.targetBefore,
        rewardLines: payload.resultLines ?? [],
        movementBonuses: payload.movementBonuses,
        vp: payload.vp,
        stageNameKey: payload.stageNameKey ?? '',
        rewards: payload.rewards ?? [],
        sourceCard: payload.sourceCard,
        // The workspace pre-collects everything it can ask for (the reward
        // choice, the repeat, the animal target — all on the offer's own
        // window). What is left is what the pre-collection cannot reach: the
        // pos-5 draw, and the inputs a REPEATED action raises once it runs.
        // Those must EMBED here rather than rise as a band over the
        // workspace that caused them.
        serves: plan.serves,
        claimDraw: plan.claimsDraw ? plan.drawCount : 0,
        repeat: payload.repeat,
      });
    }
    if (responses.length === 1) {
      submitInput(responses[0] as InputResponse);
    } else {
      shell.submitBatch(responses);
    }
  }

  /**
   * THE PLAYER LEFT FOR THE TRACK — the door's own half of the handoff.
   *
   * Nothing is submitted here (the entry lock and the frame are already up);
   * the track's plan is simply reset so the step opens on the SERVER's own
   * destination rather than on whatever the player was studying the last time
   * they visited the workspace by hand. The seating itself is the section's
   * (`seatPlanOnOffer`, keyed on the offer's identity) — one implementation
   * for both provenances.
   */
  function onCardActionsDeltaStep(): void {
    resetHydroPlan();
    consoleHydroUi.repeatResult = undefined;
    resetHydroFlow();
  }

  /**
   * THE ONE ATOMIC COMMIT of a card's Hydronetwork move.
   *
   * ONE batch, and literally the SAME TAIL the standard advance sends: the
   * card-action PREFIX (activate pick + branch pick — re-resolved from the
   * LIVE `waitingFor`, so a refreshed view cannot address a stale menu), then
   * `{deltaProject, amount}`, then everything the LANDED stage defers. The
   * server therefore marks the card used, charges its energy and moves the
   * marker in one response — there is no reachable state where one of the
   * three happened without the others.
   *
   * And from the presentation's seat this IS the standard advance: the same
   * `beginHydroAdvancePresentation`, so the marker glides, the landed stage
   * pays out through the reward wave and the result stage holds. The player
   * must not be able to tell a card's move from their own by watching it.
   */
  function submitHydroCardAdvance(payload: {
    rewardChoice: number | undefined, selectedCard?: CardName,
    /** The landed stage's target reward was CONSCIOUSLY declined — the same
     *  contract the player's own advance carries. */
    waiveTarget?: boolean,
    repeat?: ConsoleRepeatPickResult, steps: number,
    fromPosition: number, toPosition: number, spend: number,
    rewards?: ReadonlyArray<ResourceTransferSpec>,
    resultLines?: ReadonlyArray<HydroDeltaLine>, vp?: number, stageNameKey?: string,
    movementBonuses?: ReadonlyArray<DeltaMovementBonusProjection>,
    sourceCard?: CardName,
    targetBefore?: number,
  }): void {
    // The flow owns the moment from the first press — identical guard to
    // `submitHydroAdvance`, because the double submit it prevents is the same.
    if (isHydroMarkerActive() || hydroFlowState.commit !== undefined) {
      return;
    }
    const card = cardDeltaAdvanceCard();
    const perform = findPerformActionCard(shell.playerView.waitingFor);
    if (card === '' || perform === undefined) {
      // The action is no longer on the table (the view moved under the draft).
      // Say so and leave the entry standing — the player's own B is the exit.
      shell.showNotice(offTurnReason(shell.awaitingInput, shell.viewerPassed));
      return;
    }
    const responses = hydroAdvanceBatch(
      deltaAdvancePrefix(perform.path, card, deltaAdvanceEntryState.branchIndex),
      payload.steps,
      {
        spend: payload.spend,
        rewardChoice: payload.rewardChoice,
        selectedCard: payload.selectedCard,
        waiveTarget: payload.waiveTarget,
        repeat: payload.repeat,
        // The landing — the single-landing answer's address on the move step.
        toPosition: payload.toPosition,
      });
    const to = payload.toPosition;
    // A WAIVED move owes no follow-up (the batch declined the pick), so the
    // frame must not arm to serve one — same rule as the player's own
    // advance. The pos-5 draw is not waivable and is unaffected.
    const plan = payload.waiveTarget === true ?
      {serves: [] as ReadonlyArray<TaskKind>, claimsDraw: false, drawCount: 0} :
      hydroBonusAdvancePlan(HYDRO_STAGES[to]);
    beginHydroAdvancePresentation({
      kind: resolutionKindFor(to, {
        composedRepeat: payload.repeat !== undefined,
        selectedCard: payload.selectedCard,
      }),
      fromPosition: payload.fromPosition,
      toPosition: to,
      spend: payload.spend,
      // A card move's toll is energy-only — Delta Works never applies here.
      spendSteel: 0,
      rewardChoice: payload.rewardChoice,
      selectedCard: payload.selectedCard,
      waivedTarget: payload.waiveTarget === true,
      composedRepeat: payload.repeat !== undefined,
      targetBefore: payload.targetBefore,
      rewardLines: payload.resultLines ?? [],
      movementBonuses: payload.movementBonuses,
      vp: payload.vp,
      stageNameKey: payload.stageNameKey ?? '',
      rewards: payload.rewards ?? [],
      sourceCard: payload.sourceCard,
      // What the pre-collection cannot reach: the pos-5 draw and the inputs a
      // REPEATED action raises once it runs. Those EMBED here rather than
      // rising as a band over the workspace that caused them.
      serves: plan.serves,
      claimDraw: plan.claimsDraw ? plan.drawCount : 0,
      repeat: payload.repeat,
    });
    shell.submitBatch(responses);
  }

  /**
   * THE ONE PRESENTATION OPENING OF A TRACK ADVANCE — the commit record, the
   * embedded-outcome claim, the frame's serving contract and the ARMED marker
   * glide, in that order, all BEFORE anything reaches the wire.
   *
   * Shared by the player's own «Укрепить гидросеть» and by a card-granted
   * bonus move, because the two must be indistinguishable to watch. The
   * ordering is load-bearing:
   *  - the commit record FREEZES the decision (route, reward lines, the
   *    landed stage's name) while the live model still describes the move —
   *    a tick later it describes the NEXT one;
   *  - the claim + `serves` are raised SYNCHRONOUSLY, so a follow-up the
   *    response carries finds a host already standing;
   *  - `armHydroMarker` starts the client-side glide and closes the input
   *    gate in the same synchronous block as the submit — which is what makes
   *    a double press impossible by construction, and what gives the
   *    transport's `detectHydroMarker` a gate to hold the commit behind.
   */
  function beginHydroAdvancePresentation(payload: {
    kind: HydroResolutionKind, fromPosition: number, toPosition: number, spend: number,
    spendSteel?: number,
    rewardChoice: number | undefined, selectedCard: CardName | undefined,
    waivedTarget?: boolean,
    composedRepeat: boolean, targetBefore: number | undefined,
    rewardLines: ReadonlyArray<HydroDeltaLine>, vp: number | undefined, stageNameKey: string,
    rewards: ReadonlyArray<ResourceTransferSpec>,
    /** The move's PASSIVE half (Social Heating's heat) — server-authored,
     *  frozen with the rest of the result. Its wave rides the MARKER's own
     *  arrival at the destination, because the movement is what earned it. */
    movementBonuses?: ReadonlyArray<DeltaMovementBonusProjection>,
    sourceCard?: CardName, skippedCount?: number,
    serves?: ReadonlyArray<TaskKind>, claimDraw?: number,
    /** WIDER SERVICE for the one claim: a traversal whose deck stop is
     *  followed by a composed repeat gets the UNION of both stages' kinds
     *  (the repeat's outcomes arrive in the very response that answers the
     *  deck pick — the drain runs inside that request — so the standing
     *  claim is the only one that can serve them). Scope 'chain' with it:
     *  the copied action's effects arrive attributed to the running Delta
     *  Project scope, and its verdict to the chosen card. */
    claimKinds?: ReadonlyArray<WorkspaceOutcomeKind>,
    claimScope?: WorkspaceOutcomeScope,
    /** The COMPOSED repeat pick — its reward specs become the repeat stop's
     *  closing wave, whatever door the move came through. */
    repeat?: ConsoleRepeatPickResult,
    traversal?: ReadonlyArray<HydroTraversalSegmentRecord>, modifierCard?: CardName,
  }): void {
    // THE REPEATED ACTION'S OWN REWARD SPECS — the ONE extraction every
    // activation door uses (`commitRewardSpecs` → `extractPlayRewards`,
    // server-computed preview amounts, pre-selected targets included).
    // Flown from the stop's cell at the RESUME, after the whole
    // presentation (reveal, picks, the hand intake) has finished —
    // counters release per touchdown, one language with the ДЕЙСТВИЯ КАРТ
    // commit and the card play. A traversal's composed pick rides
    // `consoleHydroUi.repeatResult` (`composedRepeat` on the segment is
    // the build-time match witness); the three door payloads carry theirs.
    const repeatPick = payload.repeat ??
      (payload.traversal?.some((s) => s.kind === 'repeat' && s.composedRepeat === true) === true ?
        consoleHydroUi.repeatResult : undefined);
    const repeatSpecs = repeatPick !== undefined ?
      commitRewardSpecs(repeatPick.chosenCard,
        previewBranchByIndex(actionPreviewMap().get(repeatPick.chosenCard), repeatPick.composed.branchIndex),
        {...repeatPick.composed.stepResponses}) :
      [];
    const traversal = payload.traversal !== undefined && repeatSpecs.length > 0 ?
      payload.traversal.map((s) => s.kind === 'repeat' ? {...s, transfers: repeatSpecs} : s) :
      payload.traversal;
    // A single-step repeat's rewards are the ACTION's own specs — the
    // one-leg stop plan below flies them as its closing wave.
    const baseRewards = payload.kind === 'repeat' && repeatSpecs.length > 0 ?
      repeatSpecs : (payload.rewards ?? []);
    // THE MOVEMENT'S OWN WAVE. A passive movement bonus (Social Heating's
    // heat) is caused by the MARKER TRAVELLING, not by the landed stage — so
    // it joins the arrival wave of the DESTINATION instead of opening a scene
    // of its own: nothing is paid before the token has moved, a long
    // traversal delivers ONE aggregate at its end rather than a chip per
    // crossed cell, and the source is named in the result rows the plan panel
    // already promised.
    const movementSpecs = movementBonusTransfers(payload.movementBonuses);
    const rewards = movementSpecs.length > 0 ?
      mergeTransferSpecs([...baseRewards, ...movementSpecs]) : baseRewards;
    beginHydroCommit({
      kind: payload.kind,
      fromPosition: payload.fromPosition,
      toPosition: payload.toPosition,
      spend: payload.spend,
      spendSteel: payload.spendSteel ?? 0,
      rewardChoice: payload.rewardChoice,
      selectedCard: payload.selectedCard,
      waivedTarget: payload.waivedTarget === true,
      composedRepeat: payload.composedRepeat,
      targetBefore: payload.targetBefore,
      rewardLines: payload.rewardLines,
      movementBonuses: payload.movementBonuses,
      vp: payload.vp,
      stageNameKey: payload.stageNameKey,
      // The context column keeps the granting card / the omission count
      // through the commit and the result — frozen here, with the rest.
      sourceCard: payload.sourceCard,
      skippedCount: payload.skippedCount,
      traversal,
      modifierCard: payload.modifierCard,
    });
    if ((payload.claimDraw ?? 0) > 0) {
      claimWorkspaceOutcome('hydro', CardName.DELTA_PROJECT,
        payload.claimKinds ?? ['draw', 'pick'], 0, payload.claimDraw ?? 0,
        payload.claimScope ?? 'card');
    } else if (repeatPick !== undefined) {
      // A door that promises no stage draw can still carry a COMPOSED
      // REPEAT — the reuse-action stage reached through the BONUS OFFER or
      // the CARD-MOVE door, whose `hydroBonusAdvancePlan` honestly answers
      // `claimsDraw: false` for that stage. The player's own advance door
      // derives the copy's claim at its call site and the espionage
      // execution has its own block; these two doors forwarded `repeat`
      // with NO claim at all, so a copied «Центр ИИ» draw rose as the
      // standalone band over the track (the exact Viron/ДЕЙСТВИЯ КАРТ hole,
      // 2026-09-05). One fallback in the ONE presentation funnel covers
      // every door: kinds from the CHOSEN card's cached preview branch,
      // scope 'chain' — the server attributes the copied effects to the
      // card that RAN. (For the player's own door this re-arms the very
      // claim its call site just raised — same derivation, same tick,
      // harmless by construction.)
      const {kinds, expectedCards} = branchOutcomeClaimPlan(
        actionPreviewMap().get(repeatPick.chosenCard), repeatPick.composed.branchIndex);
      if (kinds.length > 0) {
        claimWorkspaceOutcome('hydro', repeatPick.chosenCard, kinds,
          repeatPick.nodeIndex, expectedCards, 'chain');
      }
    }
    if (payload.serves !== undefined && payload.serves.length > 0) {
      setWorkspaceFrameServes('hydro', payload.serves);
    }
    if (payload.kind === 'card-resource' ||
        payload.traversal?.some((s) => s.kind === 'card-resource') === true) {
      // The presented target's counter ticks off the framework's own
      // touchdown tally — a payout ARMS by resetting it.
      resetCardResourceLandings();
    }
    // PREMIUM MARKER ADVANCE: ARM the glide (client-side) FIRST — the
    // transport's `holdingForHydroMarker` gate BLOCKS the commit (delta
    // chips / new position) until the token LOCKS IN — then the caller
    // submits. The flow advances off the marker watcher. A TRAVERSAL arms
    // the whole ordered leg plan instead: single-cell hops, per-cell waves,
    // interactive stops — one sequence, the same gate on its first leg.
    if (traversal !== undefined && traversal.length > 0) {
      armHydroMarkerTraversal(payload.fromPosition, withMovementBonusOnLastLeg(traversal.map((s): HydroMarkerLegPlan => ({
        position: s.position,
        transfers: s.transfers,
        stop: s.kind === 'deck-draw' ? 'deck-draw' : s.kind === 'repeat' ? 'repeat' : undefined,
        excluded: s.kind === 'excluded' ? true : undefined,
        // THE STEP'S OWNERSHIP KEY. The pre-selected card is the invocation
        // PLAN, and the plan is not the execution: the server resolves the
        // whole traversal inside one request (the parked batch tail drains in
        // the very response that answers the stage-5 deck pick), so the copied
        // action's drawn batch is on the wire while the marker still stands
        // two cells back. Naming the card here is what lets the admission gate
        // hold that batch for the step that owes it — see `hydroStepAdmission`.
        sourceCard: s.kind === 'repeat' ? s.selectedCard : undefined,
      })), payload.movementBonuses), shell.thisPlayer.color);
    } else if (payload.kind === 'repeat') {
      // A SINGLE-STEP repeat is a ONE-LEG stop plan: the same barrier the
      // traversal uses — the marker locks on the stage, the action's whole
      // presentation (reveal, picks, the hand intake) runs to completion,
      // and only the RESUME plays the action's own reward wave and lets the
      // flow reach its result. Every door (own advance, bonus, card entry)
      // gets the identical sequence.
      armHydroMarkerTraversal(payload.fromPosition, [{
        position: payload.toPosition,
        transfers: rewards,
        answers: movementSpecs,
        stop: 'repeat',
        sourceCard: payload.selectedCard,
      }], shell.thisPlayer.color);
    } else {
      armHydroMarker(payload.fromPosition, payload.toPosition, shell.thisPlayer.color, rewards, movementSpecs);
    }
    syncHydroFramePhase();
  }

  /**
   * THE ESPIONAGE EXECUTION (Corporate Espionage, DP10) — the commit's
   * re-entry into the Hydronetwork workspace, now in execution mode. One
   * multi-actor marker plan carries the printed order: the TARGET's marker
   * physically retreats first (their own colour, their own cells), their
   * landing commits (a compact line — or the flow PARKS on their
   * interactive decision and resumes on the server's own evidence), and
   * only then the OWNER's marker advances with the full existing landing
   * presentation — reward waves, the embedded deck pick, the composed
   * repeat, the terminal VP ceremony, the result summary.
   *
   * Armed BEFORE the submit (the transport gate holds the view on the
   * first leg — the standard hydro contract), off the SERVER's projection
   * and nothing else.
   */
  function beginEspionageExecution(espionage: {projection: DeltaEspionageProjectionModel, target?: Color, ownerAnswer?: DeltaStageAnswer}): void {
    const proj = espionage.projection;
    const owner = proj.owner;
    const targetEntry = espionage.target !== undefined ?
      proj.targets.find((t) => t.color === espionage.target) : undefined;
    // The workspace descends over the play setup — the same overlay door
    // the target pick used, now committed from birth.
    pushWorkspaceFrame({
      kind: 'hydro', subject: '', stage: 'Execution', phase: 'executing',
      serves: [], anchor: {type: 'always'}, overlay: true,
    });

    const ownerAnswer = espionage.ownerAnswer;
    const ownerStage = HYDRO_STAGES[owner.toPosition];
    const p = shell.playerView.thisPlayer;
    const snapshot: HydroPlayerSnapshot = {
      steel: p.steel, plants: p.plants, titanium: p.titanium, energy: p.energy, heat: p.heat, megacredits: p.megacredits,
      prod: {
        megacredits: p.megacreditProduction, steel: p.steelProduction, titanium: p.titaniumProduction,
        plants: p.plantProduction, energy: p.energyProduction, heat: p.heatProduction,
      },
      plantTags: p.tags[Tag.PLANT] ?? 0,
      jovianTags: p.tags[Tag.JOVIAN] ?? 0,
    };
    const animalTarget = owner.reward.kind === 'card-resource' ? ownerAnswer?.selectedCard : undefined;
    const animalCurrent = animalTarget !== undefined ?
      (p.tableau.find((c) => c.name === animalTarget)?.resources ?? 0) : undefined;
    // The owner's landing through the ONE reward view every arrival renders
    // — same lines, same chips, same follow-up vocabulary.
    const view = buildRewardView({
      stage: ownerStage, snapshot,
      rewardChoice: ownerAnswer?.rewardChoice,
      animalTargetCurrent: animalCurrent,
      animalTargetCardName: animalTarget,
    });
    const composedRepeat = (ownerAnswer?.repeatResponses?.length ?? 0) > 0;
    const kind = resolutionKindFor(owner.toPosition, {composedRepeat, selectedCard: ownerAnswer?.selectedCard});
    // Does the TARGET's landing owe THEIR OWN decision? Structural, off the
    // projection: a choice stage, a draw, a live repeat or animal pick. A
    // void clause (the bot's Solo rule) is never interactive.
    const tr = targetEntry?.reward;
    const targetInteractive = targetEntry !== undefined && targetEntry.rewardSkipped === undefined && tr !== undefined &&
      (tr.kind === 'choice' || tr.kind === 'draw' ||
        (tr.kind === 'repeat-action' && tr.candidates > 0) ||
        (tr.kind === 'card-resource' && tr.candidates > 0));

    beginHydroCommit({
      kind,
      fromPosition: owner.fromPosition,
      toPosition: owner.toPosition,
      spend: 0,
      spendSteel: 0,
      rewardChoice: ownerAnswer?.rewardChoice,
      selectedCard: ownerAnswer?.selectedCard,
      composedRepeat,
      targetBefore: animalCurrent,
      rewardLines: view.lines,
      movementBonuses: owner.movementBonuses,
      vp: ownerStage?.vp,
      stageNameKey: ownerStage?.nameKey ?? '',
      sourceCard: CardName.CORPORATE_ESPIONAGE,
      espionage: {
        ...(targetEntry !== undefined && targetEntry.toPosition !== undefined ? {
          target: {
            color: targetEntry.color,
            from: targetEntry.fromPosition,
            to: targetEntry.toPosition,
            ...(targetEntry.reward !== undefined ? {reward: targetEntry.reward} : {}),
            ...(targetEntry.rewardSkipped !== undefined ? {rewardSkipped: targetEntry.rewardSkipped} : {}),
            ...(targetInteractive ? {interactive: true} : {}),
          },
        } : {}),
        ...(owner.waivedTag !== undefined ? {waivedTag: owner.waivedTag} : {}),
      },
    });
    // The owner's landing follow-ups present INSIDE this workspace — the
    // same serves/claims the standard advance raises for the same stage.
    const plan = ownerStage !== undefined ? hydroBonusAdvancePlan(ownerStage) : undefined;
    if (plan !== undefined && plan.serves.length > 0) {
      setWorkspaceFrameServes('hydro', plan.serves);
    }
    if (plan?.claimsDraw === true) {
      claimWorkspaceOutcome('hydro', CardName.DELTA_PROJECT, ['draw', 'pick'], 0, plan.drawCount, 'card');
    } else if (kind === 'repeat' && composedRepeat && ownerAnswer?.selectedCard !== undefined) {
      // The composed repeat's outcome kinds, derived from its cached
      // preview branch (the hydro traversal's exact derivation).
      const repeatPick = consoleHydroUi.repeatResult;
      if (repeatPick !== undefined && repeatPick.chosenCard === ownerAnswer.selectedCard) {
        const {kinds, expectedCards} = branchOutcomeClaimPlan(
          actionPreviewMap().get(repeatPick.chosenCard), repeatPick.composed.branchIndex);
        if (kinds.length > 0) {
          claimWorkspaceOutcome('hydro', CardName.DELTA_PROJECT, kinds, 0, expectedCards, 'chain');
        }
      }
    }
    if (kind === 'card-resource') {
      resetCardResourceLandings();
    }

    // THE MULTI-ACTOR PLAN: the target's retreat leg first (their colour,
    // their cells, a readable handoff beat — or a prompt park when their
    // landing owes them a decision), then the owner's advance with the
    // landing's own stop semantics.
    const legs: Array<HydroMarkerLegPlan> = [];
    if (targetEntry !== undefined && targetEntry.toPosition !== undefined) {
      legs.push({
        position: targetEntry.toPosition,
        fromOverride: targetEntry.fromPosition,
        color: targetEntry.color,
        foreign: true,
        transfers: [],
        ...(targetInteractive ? {stop: 'prompt' as const} : {beatMs: 700}),
      });
    }
    legs.push({
      position: owner.toPosition,
      fromOverride: owner.fromPosition,
      transfers: hydroRewardTransfers(view),
      ...(kind === 'deck-draw' ? {stop: 'deck-draw' as const} : {}),
      ...(kind === 'repeat' ? {stop: 'repeat' as const, sourceCard: ownerAnswer?.selectedCard} : {}),
    });
    armHydroMarkerTraversal(owner.fromPosition,
      withMovementBonusOnLastLeg(legs, owner.movementBonuses), shell.thisPlayer.color);
    syncHydroFramePhase();
  }

  function submitHydroAdvance(payload: {
    spend: number,
    /** The Delta Works steel share of the price (energy is the remainder). */
    steelSpend?: number,
    /** The Modular Floodgates steel share (the protected pool, dialed). */
    cardSteelSpend?: number,
    rewardChoice: number | undefined, selectedCard?: CardName,
    /** The landed stage's target reward was CONSCIOUSLY declined (the warned
     *  second press) — rides the batch, and owes no follow-up. */
    waiveTarget?: boolean,
    repeat?: ConsoleRepeatPickResult, fromPosition: number, toPosition: number,
    rewards?: ReadonlyArray<ResourceTransferSpec>,
    resultLines?: ReadonlyArray<HydroDeltaLine>, vp?: number,
    movementBonuses?: ReadonlyArray<DeltaMovementBonusProjection>,
    stageNameKey?: string, kind?: HydroResolutionKind,
    skippedCount?: number, targetBefore?: number,
    /** The MULTI-REWARD traversal (Delta Surge): ordered batch answers,
     *  per-position declines, the presentation segments, the modifier. */
    traversalAnswers?: HydroAdvancePayload['traversalAnswers'],
    waivedSteps?: ReadonlyArray<number>,
    /** The declared resource plan — rides the move step; the server's
     *  atomic pre-commit gate re-walks the ordered projection against it. */
    plannedActions?: HydroAdvancePayload['plannedActions'],
    plannedChoices?: HydroAdvancePayload['plannedChoices'],
    traversal?: ReadonlyArray<HydroTraversalSegmentRecord>,
    modifierCard?: CardName,
  }): void {
    const path = findHydroActionPath(shell.playerView.waitingFor);
    if (path === undefined || isHydroMarkerActive() || hydroFlowState.commit !== undefined) {
      return; // guard a double-confirm: the flow owns the moment
    }
    const responses = hydroAdvanceResponses(optionResponseForPath(path), payload);
    const kind: HydroResolutionKind = payload.kind ?? 'plain';
    // The landed stage's CARD payout presents INSIDE the workspace — the
    // claim is raised synchronously at submit (the North-Star embedded
    // outcome), and the follow-up prompt is what the parked frame serves.
    let serves: ReadonlyArray<TaskKind> = [];
    let claimDraw = 0;
    let claimKinds: ReadonlyArray<WorkspaceOutcomeKind> | undefined;
    let claimScope: WorkspaceOutcomeScope | undefined;
    if (payload.traversal !== undefined) {
      // A TRAVERSAL claims ITS WHOLE CHAIN AT SUBMIT. The repeat's outcome
      // kinds are derived from the composed pick's cached preview branch
      // (structural, never a card table); with a deck stop on the path they
      // UNION into the deck claim — the parked batch tail drains INSIDE the
      // request that answers the deck pick, so the repeat's drawn cards /
      // verdict land while that claim is the one standing, and a narrow
      // ['draw','pick'] claim handed them to the fullscreen viewer. Without
      // a deck stop the repeat claims for itself, same as a landing repeat.
      const hasDeck = payload.traversal.some((s) => s.kind === 'deck-draw');
      const seg = payload.traversal.find((s) => s.kind === 'repeat');
      const repeat = consoleHydroUi.repeatResult;
      let repeatKinds: ReadonlyArray<WorkspaceOutcomeKind> = [];
      let repeatExpected = 0;
      if (seg !== undefined && repeat !== undefined && repeat.chosenCard === seg.selectedCard) {
        const plan = branchOutcomeClaimPlan(
          actionPreviewMap().get(repeat.chosenCard), repeat.composed.branchIndex);
        repeatKinds = plan.kinds;
        repeatExpected = plan.expectedCards;
      }
      if (hasDeck) {
        claimDraw = 4;
        serves = ['deckSelect'];
        // SCOPE 'chain' rides on the REPEAT'S PRESENCE alone — attribution
        // is a fact of the chain (the server names the card whose action
        // ran), not of what the cached preview happened to promise; a
        // preview miss must degrade the KINDS, never the scope, or the
        // repeat's draw arrives named «Development Center» against a
        // 'card'-scoped «Delta Project» claim and goes standalone.
        if (seg !== undefined) {
          claimScope = 'chain';
        }
        if (repeatKinds.length > 0) {
          claimKinds = [...new Set<WorkspaceOutcomeKind>(['draw', 'pick', ...repeatKinds])];
        }
      } else if (repeatKinds.length > 0 && seg !== undefined && repeat !== undefined) {
        // SCOPE 'chain' — same reason as the landing repeat's claim below.
        claimWorkspaceOutcome('hydro', repeat.chosenCard, repeatKinds,
          repeat.nodeIndex, repeatExpected, 'chain');
      }
      if (seg !== undefined) {
        serves = [...new Set<TaskKind>([...serves,
          'deckSelect', 'cardSelect', 'payment', 'choice', 'amount', 'resource', 'player'])];
      }
      // A CONSUMED plan can still degrade PER STAGE (a target gone stale
      // mid-walk, a choice the server re-frames): the fallback prompt is a
      // runtime follow-up of THIS move and must EMBED here — a traversal
      // whose only ask was an animal target otherwise armed no serves at
      // all, and the fallback rose as a standalone band over the track.
      if (payload.traversal.some((s) => s.kind === 'card-resource' || s.rewardChoice !== undefined ||
          s.selectedCard !== undefined)) {
        serves = [...new Set<TaskKind>([...serves, 'cardSelect', 'choice'])];
      }
    } else if (kind === 'deck-draw') {
      claimDraw = 4;
      serves = ['deckSelect'];
    } else if (kind === 'repeat' && payload.repeat === undefined) {
      // A BARE pick (no composed responses): the repeated action's own
      // inputs — and the RUNTIME fallback selector, should the pick have
      // diverged unpredictably — arrive as follow-ups and must EMBED here,
      // never rise as a standalone band over the move that asked.
      serves = ['deckSelect', 'cardSelect', 'payment', 'choice', 'amount', 'resource', 'player'];
    } else if (kind === 'repeat' && payload.repeat !== undefined) {
      // The repeated action's own draws/picks/VERDICT embed exactly like a
      // direct activation's would — kinds derived from its cached preview
      // branch (structural, never a card table); a cache miss degrades to
      // the ADOPTION net (`consoleOutcomeAdoption`). `deck-check` is here
      // for the same reason the other two are: the copy is this workspace's
      // move, so what it turns over is this workspace's result — «ГИДРОСЕТЬ ›
      // ПОИСКИ ЖИЗНИ › РЕЗУЛЬТАТ ВСКРЫТИЯ», not a full-bleed modal over the
      // track that produced it.
      const {kinds, expectedCards} = branchOutcomeClaimPlan(
        actionPreviewMap().get(payload.repeat.chosenCard), payload.repeat.composed.branchIndex);
      if (kinds.length > 0) {
        // SCOPE 'chain': the server attributes a copied action's effects to
        // the scope that RAN it (the Delta Project advance), not to the
        // card the player pressed — a bespoke draw with no source of its
        // own therefore arrives named «Delta Project», and a card-scoped
        // claim missed it: the one-card batch went headless and the GLOBAL
        // fullscreen viewer opened over the track (the play claim's exact
        // precedent, `consolePlayOutcomeClaim`).
        claimWorkspaceOutcome('hydro', payload.repeat.chosenCard, kinds,
          payload.repeat.nodeIndex, expectedCards, 'chain');
      }
      serves = ['deckSelect', 'cardSelect', 'payment', 'choice', 'amount', 'resource', 'player'];
    }
    // …AND WHATEVER THE PLAYER DID NOT PRE-COLLECT. Advancing without
    // stopping to configure the landed stage's reward is a legal move, and
    // the SERVER then defers the same SelectCard — which must EMBED in this
    // workspace rather than rise as a band over the move that caused it.
    // Same plan the card-granted offer uses, keyed on the stage's own
    // `followUp`; unioned, so a pre-collected path loses nothing.
    //
    // A WAIVED move owes nothing: the batch declined the pick, so the server
    // defers no prompt and the frame must not arm to serve one — a `serves`
    // set standing for a question that never arrives is a workspace waiting
    // on an event that cannot happen.
    if (payload.traversal === undefined &&
        payload.selectedCard === undefined && payload.waiveTarget !== true) {
      const owed = hydroBonusAdvancePlan(HYDRO_STAGES[payload.toPosition]);
      serves = [...new Set<TaskKind>([...serves, ...owed.serves])];
      claimDraw = claimDraw > 0 ? claimDraw : (owed.claimsDraw ? owed.drawCount : 0);
    }
    beginHydroAdvancePresentation({
      kind,
      fromPosition: payload.fromPosition,
      toPosition: payload.toPosition,
      spend: payload.spend,
      // Every steel the move takes — stock and Floodgates alike — reads as
      // steel on the route; the journal names the Floodgates' share.
      spendSteel: (payload.steelSpend ?? 0) + (payload.cardSteelSpend ?? 0),
      rewardChoice: payload.rewardChoice,
      selectedCard: payload.selectedCard,
      waivedTarget: payload.waiveTarget === true,
      composedRepeat: payload.repeat !== undefined ||
        payload.traversalAnswers?.some((a) => a.repeat !== undefined) === true,
      targetBefore: payload.targetBefore,
      rewardLines: payload.resultLines ?? [],
      movementBonuses: payload.movementBonuses,
      vp: payload.vp,
      stageNameKey: payload.stageNameKey ?? '',
      rewards: payload.rewards ?? [],
      skippedCount: payload.skippedCount,
      serves,
      claimDraw,
      claimKinds,
      claimScope,
      repeat: payload.repeat,
      traversal: payload.traversal,
      modifierCard: payload.modifierCard,
    });
    shell.submitBatch(responses);
  }

  /** The reward-only pick resolved — hand the draft back to the composer
   *  (the bridge pops its own frame; the composer captures the response). */
  function onHydroRewardPicked(draft: DeltaRewardDraft): void {
    resolveDeltaRewardPick(draft);
  }

  function onHydroEspionagePicked(draft: DeltaEspionageDraft): void {
    resolveDeltaEspionagePick(draft);
  }

  function onHydroBlockadePicked(draft: DeltaBlockadeDraft): void {
    resolveDeltaBlockadePick(draft);
  }

  /** B / close from the hydro section: a live reward-pick bridge returns to
   *  the composer with the old draft kept; every other provenance keeps the
   *  ordinary lateral leave. */
  function onHydroClose(): void {
    if (isDeltaRewardPickActive()) {
      cancelDeltaRewardPick();
      return;
    }
    if (isDeltaEspionagePickActive()) {
      // The standalone-prompt door is a MANDATORY server demand with no
      // composer beneath — B refuses out loud instead of cancelling into
      // a stranded prompt.
      if (deltaEspionagePickState.request?.mandatory === true) {
        shell.showNotice('The target selection is required');
        return;
      }
      cancelDeltaEspionagePick();
      return;
    }
    if (isDeltaBlockadePickActive()) {
      // The standalone-prompt door is a MANDATORY server demand with no
      // composer beneath — B refuses out loud instead of cancelling into
      // a stranded prompt.
      if (deltaBlockadePickState.request?.mandatory === true) {
        shell.showNotice('The target selection is required');
        return;
      }
      cancelDeltaBlockadePick();
      return;
    }
    // The DEPLOY execution surface ends here (A «Готово» and B alike): the
    // blockade is committed server state — the held card-actions conclusion
    // resumes and the flow leaves.
    if (isBlockadeExecutionActive()) {
      endBlockadeExecution();
      shell.concludeWorkspaceFlowOrOwe('card-actions');
      return;
    }
    leaveWorkspace();
  }

  /**
   * THE RESOLUTION IS QUIET AND VISIBLE — walk the committed move on to its
   * result stage (the terminal summary, and the only door to closing).
   *
   * Asked from THREE edges, all of them the same question, because any one
   * of them alone drops the case the others cover: the busy signal's own
   * falling edge, the stack's RESTORE and the deferred task's restore. A
   * park is not completion, but it is also not a cancellation — the answer
   * is «ask again when the player is back», never «forget this one».
   */
  function settleHydroResolution(): void {
    // …AND A FRAME STANDING ASIDE FOR THE BOARD is not on screen either (CI 2026-11-05, `console-hydro-copied-tile`):
    // the stage-7 copy's placement YIELDS the stack, the placement's answer drops the last busy term, and the yield's
    // return waits for what the board still owes (`screenHandoffOwed` — tokens in the air) — so the result was walked
    // to and its read hold spent behind the board, and the frame came back wearing the `executing` it left with (the
    // beat-stall guard tore it down 10 s later). `hydroFlowSetAside` is the one «hidden stage» answer (a park, a
    // deferred task, a yield); the frame's return re-asks (`hydroFrameStands`).
    if (hydroFlowSetAside() || hydroResolutionBusy.value) {
      return;
    }
    const c = hydroFlowState.commit;
    // A ceremony landing rides the SAME edge as every other resolution: the
    // culmination is a busy term of its own (`ceremonyOwed` — released only
    // by the ceremony's completion), so this fires strictly AFTER it. The
    // summary is the mandatory terminal stage of every movement — the
    // ceremony is the beat before it, never a substitute ending.
    if (c !== undefined && c.phase === 'resolving') {
      advanceHydroCommitPhase('result');
    }
  }

  /**
   * Is a drawn batch the COMMITTED ADVANCE's own? Two witnesses, both
   * structural: the claim (raised at the submit for a stage draw, retained
   * across a chain's batches) judged by the server's own source, and the
   * standing plan's declared steps (the walk's own ledger — a claim can
   * lawfully be between homes for a flush while the plan stands for the
   * whole traversal). An unattributed source reads as ours through the
   * claim, by the same design the release funnel documents.
   */
  function hydroOwnsRevealBatch(source: CardDrawRevealSource | undefined): boolean {
    if (workspaceOutcomeState.host === 'hydro' && workspaceClaimsRevealSource(source)) {
      return true;
    }
    return hydroPlanDeclaresSource(source);
  }

  /**
   * THE STUCK-FLOW WITNESS'S DOOR (`hydro-flow-stuck`, consoleHydroFlow):
   * re-ask the stage's own settle when `resolving` went quiet with no edge
   * left, re-arm the result read hold when its timer died. Idempotent —
   * both doors re-check everything themselves, so a heal can never cut a
   * genuine wait short.
   */
  function driveHydroFlowStuck(): void {
    const c = hydroFlowState.commit;
    if (c === undefined) {
      return;
    }
    if (c.phase === 'resolving') {
      settleHydroResolution();
      return;
    }
    if (c.phase === 'result' && hydroResultTimer.value === undefined) {
      hydroResultTimer.value = HYDRO_RESULT_ARMED;
      cancelHydroResult = flow.after(motionMs(HYDRO_RESULT_HOLD_MS), 'the hydro result\'s read hold (re-armed by the stuck-flow witness)', () => {
        hydroResultTimer.value = undefined;
        finishHydroFlow();
      });
    }
  }

  /** The flow is over (result read / skipped) — reset and go home. */
  function finishHydroFlow(): void {
    if (hydroResultTimer.value !== undefined) {
      cancelHydroResult();
      hydroResultTimer.value = undefined;
    }
    if (hydroFlowState.commit === undefined) {
      return;
    }
    // A FLOW IS NOT OVER WHILE ITS CLAIM IS STILL SERVING — the same
    // «nothing inside is still owed» law every guarded conclusion asks.
    // The `hydroFollowUpLive` ownership term keeps the flow out of the
    // result stage while a prompt stands, so reaching here mid-serve means
    // a signal blinked: retry on the result hold's own cadence instead of
    // tearing the workspace out from under an open decision (the release
    // funnel would refuse the claim's end, but `goBoardHome` below would
    // still destroy the frame — the prompt's zone — with the claim alive).
    if (workspaceOutcomeState.host === 'hydro' && shell.workspaceOutcomeServingNow) {
      hydroResultTimer.value = HYDRO_RESULT_ARMED;
      cancelHydroResult = flow.after(motionMs(HYDRO_RESULT_HOLD_MS), 'the hydro result\'s read hold (the claim still serves — a retry)', () => {
        hydroResultTimer.value = undefined;
        finishHydroFlow();
      });
      return;
    }
    if (workspaceOutcomeState.host === 'hydro') {
      releaseWorkspaceOutcome('hydro-flow-complete');
    }
    setWorkspaceFrameServes('hydro', []);
    resetHydroFlow();
    resetHydroPlan();
    consoleHydroUi.repeatResult = undefined;
    if (consoleState.section === 'hydro') {
      goBoardHome();
    }
  }

  /** Mirror the flow's phase onto the FRAME — B's verb and the input gate
   *  read the stack, never a hydro-private flag. */
  function syncHydroFramePhase(): void {
    if (workspaceFrameIndex('hydro') >= 0) {
      setWorkspaceFramePhase('hydro', hydroWorkspacePhase(hydroFollowUpLive.value));
    }
  }

  // MARKER ADVANCE lifecycle: the glide IS the flow's `moving` beat. On the
  // falling edge with a genuine LOCK (settled on the committed destination)
  // the flow advances to `resolving` — the landed stage may now pay out
  // (the reward wave / the embedded deck pick / the ceremony). An abort
  // (server refusal — the transport's error paths roll the flow back beside
  // abortHydroMarker) never advances: settledPosition stays foreign.
  function whenHydroMarkerStateActiveChanges(active: boolean): void {
    if (active) {
      return;
    }
    const c = hydroFlowState.commit;
    if (c === undefined || c.phase !== 'moving') {
      return;
    }
    // A genuine LOCK on the committed destination, or a DEGRADED glide over
    // a commit the SERVER already applied (the view's position is the
    // truth) — both advance; a refusal has already rolled the flow back
    // beside abortHydroMarker, so neither branch fires for it.
    const settled = hydroMarkerState.settledPosition === c.toPosition;
    const committed = (shell.thisPlayer.deltaProject?.position ?? -1) === c.toPosition;
    if (settled || committed) {
      advanceHydroCommitPhase('resolving');
      // The glide WAS the execution beat: an embedded follow-up (the deck
      // pick) may mount now that the token has physically locked in.
      if (workspaceOutcomeClaimed() && workspaceOutcomeState.host === 'hydro') {
        markWorkspaceOutcomeBeatDone();
      }
    }
  }

  // The RESOLUTION's own completion signal — reward chips landed, the
  // follow-up answered, the presentation settled. Never a hardcoded
  // timeout: the result stage waits for the LAST physical event.
  // ⚠ A PARK is not completion: a deferred follow-up makes every busy
  // signal false while the decision still stands — the collapsed flow
  // waits for the restore, never walks itself to the result.
  function whenHydroResolutionBusyChanges(busy: boolean): void {
    if (busy) {
      return;
    }
    settleHydroResolution();
  }

  // …the THIRD restore door: a frame back from standing aside for the board (`resumeStackFromBoard` — several callers)
  // re-reads its phase (a phase written while it was away was dropped — `syncHydroFramePhase` writes only a frame on
  // the stack) and re-asks the settle its absence refused.
  function whenHydroFrameStandsChanges(stands: boolean): void {
    if (stands) {
      syncHydroFramePhase();
      void shell.$nextTick(() => settleHydroResolution());
    }
  }

  // The result stage holds READABLE, then the flow completes on its own —
  // A/B skip the hold through the same door (`finishHydroFlow`).
  function whenHydroFlowCommitPhaseChanges(phase: string | undefined): void {
    if (hydroResultTimer.value !== undefined) {
      cancelHydroResult();
      hydroResultTimer.value = undefined;
    }
    if (phase === 'result') {
      hydroResultTimer.value = HYDRO_RESULT_ARMED;
      cancelHydroResult = flow.after(motionMs(HYDRO_RESULT_HOLD_MS), 'the hydro result\'s read hold', () => {
        hydroResultTimer.value = undefined;
        finishHydroFlow();
      });
    }
    syncHydroFramePhase();
  }

  /** WATCH `hydroFollowUpLive` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenHydroFollowUpLiveChanges(): void {
    syncHydroFramePhase();
  }

  /** WATCH `hydroFlow.step` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenHydroFlowStepChanges(): void {
    syncHydroFramePhase();
  }

  /** WATCH `hydroFlow.repeatBridge` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenHydroFlowRepeatBridgeChanges(): void {
    syncHydroFramePhase();
  }

  // The reward-pick bridge (Dutch Mountains) dies with its frame the same
  // way: a stack unwound by somebody else must return the composer its
  // cancel, or it waits forever on a browser that is no longer rendered.
  function whenHydroRewardFrameLiveChanges(live: boolean): void {
    if (!live && isDeltaRewardPickActive()) {
      cancelDeltaRewardPick();
    }
    if (!live && isDeltaEspionagePickActive()) {
      cancelDeltaEspionagePick();
    }
  }

  /**
   * THE ESPIONAGE EXECUTION WAS REFUSED — the transport's abort battery rolled the hydro commit back, and the server
   * still holds the very prompt the play was composed on (a refusal keeps the serial — `Player.process`). The play
   * did not happen: the execution frame leaves, the descent is configurable again and the composer's commit re-arms
   * — the landing scene's `failed` for the one play that arms none. An ACCEPTED execution ends with the serial
   * moved (the composer released by then — `playComposerOutlived`) and never acts here.
   */
  function whenEspionageExecutionStandingChanges(standing: boolean, was: boolean): void {
    const pending = shell.pendingPlayCard;
    if (standing || !was || pending?.promptId === undefined || pending.promptId !== shell.playerView.waitingFor?.promptId) {
      return;
    }
    if (workspaceStackTop()?.kind === 'hydro' && handCoveredByHydro.value) {
      popWorkspaceFrame();
    }
    if (isCommitted(workspaceFramePhase('hand') ?? 'browse')) {
      setWorkspaceFramePhase('hand', 'configure');
    }
    ((shell.$refs.playConfirm ?? undefined) as InstanceType<typeof ConsolePlayCardConfirm> | undefined)?.resetSubmitting?.();
  }

  // THE RECOVERY NET: the SERVER phase drives the flow when the glide
  // degraded (an expired arm on a slow answer never fires the marker's own
  // falling edge with the view already moved). Position committed while the
  // record still says `moving` → advance; visuals fast-forward honestly.
  function whenHydroViewerTrackPositionChanges(pos: number): void {
    const c = hydroFlowState.commit;
    // THE ESPIONAGE BARRIER RELEASES ON SERVER EVIDENCE: the flow parked on
    // the TARGET's own interactive landing, and the one fact that proves
    // their decision resolved is the OWNER's committed advance arriving in
    // a later response. The resume then plays the owner's leg in full —
    // glide, wave, ceremony — exactly as if the answer had been instant.
    if (c !== undefined && pos === c.toPosition && hydroParkedForeignStop()) {
      resumeHydroMarkerTraversal();
      return;
    }
    if (c !== undefined && c.phase === 'moving' && pos === c.toPosition &&
        !isHydroMarkerActive() && !hydroTraversalPending()) {
      advanceHydroCommitPhase('resolving');
      if (workspaceOutcomeClaimed() && workspaceOutcomeState.host === 'hydro') {
        markWorkspaceOutcomeBeatDone();
      }
    }
  }

  // THE TRAVERSAL RESUMES on its stop's own completion signal — the deck
  // pick's closing beats done (cards in the dock, the clear finished), the
  // repeated action's follow-up chain quiet, the workspace actually on
  // screen. Never a timeout; a park holds it and the restore re-fires the
  // computed. (The composed repeat's outcomes need no claim here: they
  // arrive in the response that answers the stop — the drained tail runs
  // inside that request — so the SUBMIT-time claim, widened over both
  // stages, is the one that serves them; a claim raised at this edge only
  // ever described a batch already taken, and its un-arrived `draw` froze
  // the input gate for the backstop's whole length.)
  function whenHydroTraversalResumeReadyChanges(ready: boolean): void {
    if (!ready) {
      return;
    }
    resumeHydroMarkerTraversal();
  }

  /** The offer is over — hand the screen back once the move it started has
   *  finished resolving (see `hydroBonusReturn`). */
  function whenHydroBonusReturnSignalChanges(): void {
    hydroBonusReturn();
  }

  /**
   * THE DOOR, once the admission policy lets the offer through.
   *
   * `prompt` anchor: this frame exists ONLY to answer that offer, so it hands
   * the screen back when the offer is gone — unlike the player's own visit,
   * which stays. `serves` is EARNED here for the span of the offer (the
   * registry keeps `hydro.serves` empty on purpose), so a hydro screen idling
   * at its browse layer can never mask an unrelated stranded choice.
   */
  function whenHydroBonusDoorSignalChanges(): void {
    syncHydroBonusDoor();
  }

  /**
   * THE STANDALONE ESPIONAGE DOOR (a refused/stale batch answer, a
   * reconnect): the ask is served by the SAME workspace pick the composer
   * uses — mandatory (B refuses out loud; there is no composer to cancel
   * back to), the resolve submits the one wire answer directly. With NO
   * legal target the pick auto-answers: the no-target response is the only
   * legal answer (the server validates it), and an empty selector must
   * never open.
   */
  function whenEspionagePromptDoorSignalChanges(open: boolean): void {
    if (!open) {
      return;
    }
    const raw = espionagePromptRaw.value;
    if (raw === undefined) {
      return;
    }
    // A REFUSED batch answer with the presentation already armed: the
    // server kept the ask (nothing moved), so the client's optimistic
    // execution rolls back CLEANLY — the marker plan dies, the commit
    // record falls, the frame's phase returns to configure — and the ask
    // is then served fresh. Never a half-played choreography over a
    // world that did not move.
    if (hydroFlowState.commit?.espionage !== undefined) {
      abortHydroMarker();
      rollbackHydroCommit();
    }
    const projection = raw.projection;
    if (!projection.hasLegalTarget) {
      submitInput(deltaEspionageStepResponse(projection, undefined) as InputResponse);
      return;
    }
    shell.deferShellTask('hydro');
    enterDeltaEspionagePick({
      source: projection.source,
      projection,
      mandatory: true,
    }, (draft) => {
      submitInput(deltaEspionageStepResponse(projection, draft.target) as InputResponse);
    });
    setWorkspaceFrameServes('hydro', ['choice']);
  }

  /**
   * THE STANDALONE BLOCKADE DOOR (Modular Floodgates — a refused/stale
   * batch answer, a reconnect): the ask is served by the SAME workspace
   * pick the composer uses — mandatory (B refuses out loud; there is no
   * composer to cancel back to), the resolve submits the one wire answer
   * directly. Unlike the espionage ask there is no no-target fallback:
   * the input only ever stands with a legal target.
   */
  function whenBlockadePromptDoorSignalChanges(open: boolean): void {
    if (!open) {
      return;
    }
    const raw = blockadePromptRaw.value;
    if (raw === undefined) {
      return;
    }
    const projection = raw.projection;
    shell.deferShellTask('hydro');
    enterDeltaBlockadePick({
      source: projection.source,
      projection,
      mandatory: true,
    }, (draft) => {
      submitInput(deltaBlockadeStepResponse(projection, draft.target) as InputResponse);
    });
    setWorkspaceFrameServes('hydro', ['choice']);
  }

  return {
    offHydroWitnesses,
    hydroResultTimer,
    hydroBonusBorrowed,
    deltaRewardPickOut,
    hydroInstrumentOut,
    handCoveredByHydro,
    espionageExecutionStanding,
    hydroFollowUpLive,
    hydroQueuedRevealForLaterStep,
    hydroQueuedPromptForLaterStep,
    hydroActiveStepSource,
    hydroViewerTrackPosition,
    hydroFrameStands,
    hydroResolutionBusy,
    hydroTraversalResumeReady,
    hydroRevealEmbedded,
    hydroBonusOfferRaw,
    hydroBonusOfferLive,
    hydroRewardOffer,
    hydroEspionageOffer,
    hydroBlockadeOffer,
    hydroBlockadeExecution,
    blockadePromptRaw,
    blockadePromptDoorSignal,
    espionagePromptRaw,
    espionagePromptDoorSignal,
    hydroRewardFrameLive,
    hydroCardOffer,
    cardDeltaEntryFrameLive,
    hydroBonusReturnSignal,
    hydroBonusDoor,
    hydroBonusDoorSignal,
    hydroActionAvailable,
    hydroCacheKey,
    openHydroRepeatPick,
    hydroBonusReturn,
    syncHydroBonusDoor,
    submitHydroBonus,
    onCardActionsDeltaStep,
    submitHydroCardAdvance,
    beginHydroAdvancePresentation,
    beginEspionageExecution,
    submitHydroAdvance,
    onHydroRewardPicked,
    onHydroEspionagePicked,
    onHydroBlockadePicked,
    onHydroClose,
    settleHydroResolution,
    hydroOwnsRevealBatch,
    driveHydroFlowStuck,
    finishHydroFlow,
    syncHydroFramePhase,
    whenHydroMarkerStateActiveChanges,
    whenHydroResolutionBusyChanges,
    whenHydroFrameStandsChanges,
    whenHydroFlowCommitPhaseChanges,
    whenHydroFollowUpLiveChanges,
    whenHydroFlowStepChanges,
    whenHydroFlowRepeatBridgeChanges,
    whenHydroRewardFrameLiveChanges,
    whenEspionageExecutionStandingChanges,
    whenHydroViewerTrackPositionChanges,
    whenHydroTraversalResumeReadyChanges,
    whenHydroBonusReturnSignalChanges,
    whenHydroBonusDoorSignalChanges,
    whenEspionagePromptDoorSignalChanges,
    whenBlockadePromptDoorSignalChanges,
  };
}

export type HydroController = ReturnType<typeof createHydroController>;
