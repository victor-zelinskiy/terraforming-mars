/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE OUTCOME CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed, ref, onBeforeUnmount, onMounted} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {intakeBatchSources} from '@/common/models/CardDrawRevealModel';
import {ConsoleHandEntry} from '@/client/components/console/consoleHandSectionTypes';
import {ConsoleColonyPick} from '@/client/components/console/consoleColoniesSectionTypes';
import {hostedStepLiveIn, hostedStepOwedTo} from '@/client/console/parliament/hostedParliamentStep';
import {closeWorkspaceRoot, stackYieldedToBoard, handFrameToQuestion, frameServing, goBoardHome, popWorkspaceFrame, pushWorkspaceFrame, setWorkspaceFramePhase, workspaceFrameDescended, workspaceFrameHasNested, workspaceFrameIndex, workspaceFramePhase, workspaceStackTop, workspaceFrameStage, workspaceFrameAnchor, workspaceFrameHost, workspaceFrameKnown, workspaceFrameParked, workspaceHostForStep, workspaceFrameOffStage, workspaceSceneHidden, workspaceSceneOnStage, FrameAnchor, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {workspaceConclusionFor} from '@/client/console/consoleWorkspaceFlow';
import {openFrameQuestionDoor} from '@/client/console/frameQuestionDoor';
import {colonyTradeEntryLocked} from '@/client/console/colonyTrade/colonyTradeEntry';
import {colonyTradeClaimsReveal} from '@/client/console/colonyTrade/consoleColonyTrade';
import {isPlayedHeroActive, finishStagedPlayedLanding} from '@/client/console/played/consolePlayedHero';
import {closeColonyFocus} from '@/client/console/consoleColoniesModel';
import {consolePlayCardUi, releaseConsolePlayCardCommands, restoreConsolePlayCardCommands} from '@/client/console/consolePlayCardUi';
import {consoleActionComposerUi, resetConsoleActionComposerUi} from '@/client/console/consoleActionComposerUi';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {currentRevealEvent, drawnCardsState, serverRevealConsumed} from '@/client/components/drawnCards/drawnCardsState';
import {ConsoleTask, TaskKind, taskFor, followUpStepStage, DELEGATE_GRANT_STEP_STAGE, AGENDA_WALK_STEP_STAGE, AGENDA_WALK_SEAT_STEP_STAGE, NEUTRAL_RALLY_STEP_STAGE} from '@/client/console/consoleTaskRouter';
import {chairmanQuestFlow} from '@/client/console/parliament/consoleChairmanQuest';
import {cardGrantOwedTo} from '@/client/console/cardGrantHost';
import {isHydroMarkerActive, hydroTraversalPending} from '@/client/console/hydroMarker/consoleHydroMarker';
import {questionKeepsFrame} from '@/client/console/shellTaskSurface';
import {endPreludePlayChain, preludeChainHoldsClaim, preludePlayChainState} from '@/client/console/deckPick/preludePlayChain';
import {workspaceClaimsColonyRevealBatch, workspaceClaimsDrawRevealBatch, workspaceClaimsRevealBatch, workspaceClaimsDeckCheck, workspaceClaimsPick, workspaceOutcomeClaimed, markWorkspaceOutcomeAnswerIn, markWorkspaceOutcomePresenting, outcomeHostConcludesFlow, releaseWorkspaceOutcome, retainWorkspaceOutcomeForNextBatch, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {boardBeatParkPending} from '@/client/console/boardBeatPark';
import {PARLIAMENT_DRAW_ZONE} from '@/client/console/parliament/parliamentDraw';
import {colonyBonusPayoutLive} from '@/client/console/colonyLedger/colonyBonusPayout';
import {isPlayOutcomeHost, playOwesTargetPick} from '@/client/console/played/consolePlayOutcomeClaim';
import {boardCardBonusClaimsReveal} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {applyOutcomeAdoption, outcomeAdoptionHost, resolveOutcomeAdoption, sameAdoptionDecision, OutcomeAdoptionDecision} from '@/client/console/consoleOutcomeAdoption';
import {deckDrawHolds} from '@/client/console/deckDraw/consoleDeckDraw';
import {ResourceTransferSpec, TOUCHDOWN_TICK_GAP_MS, touchdownTickAt} from '@/client/console/resourceTransfer/resourceTransferModel';
import {runResourceTransfers, releasePanelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ActionCommitPlan, actionCommitHolding, releaseActionCommit} from '@/client/console/consoleActionCommit';
import {consoleState, closeConsoleLayers} from '@/client/console/consoleRouter';
import {clearLawPlayDraft, endLawPlayLanding} from '@/client/console/consolePlayPick';
import {conclusionRefusal} from '@/client/console/shell/shellFlowState';
import {motionMs} from '@/client/components/motion/motionTokens';
import {PromptSurface} from '@/client/console/consolePromptAdmission';
import {stagedPlayState, stagedHostedTarget, armStagedPlay} from '@/client/console/stagedPlay';
import type {StagedPlayArm} from '@/client/console/stagedPlay';
import {PendingPlayCard, STAGED_VOTE_RELEASE_MS, PARLIAMENT_LEAVE_NET_MS} from '@/client/console/shell/shellShared';
import type {ParliamentController} from '@/client/console/shell/parliamentController';
import type {CardActionsController} from '@/client/console/shell/cardActionsController';
import type {ColonyController} from '@/client/console/shell/colonyController';
import type {RevealController} from '@/client/console/shell/revealController';
import type {SupervisorController} from '@/client/console/supervisor/supervisorController';
import type {PlacementController} from '@/client/console/shell/placementController';
import type {StdProjectsController} from '@/client/console/shell/stdProjectsController';
import {ConclusionReask, oweConclusion, registerConclusionOwePort, withdrawConclusionOwe, owedConclusionFactsKey, reaskMovedConclusions} from '@/client/console/workspaceConclusionOwe';

/** PL-127: the composer's unfold is over by then — the warm mount of a declared hosted step lands in the reading pause. */
const PARLIAMENT_WARM_SETTLE_MS = 450;

/**
 * WHICH PROMPTS A CARD PLAY'S CLAIM ANSWERS FOR — the card questions its own
 * draw raises: the pick over the cards it turned over (`deckSelect` is the
 * DRAW & SELECT surface, `cardSelect` the buy/keep browser) and the payment
 * that finishes a buy (pick-then-pay is ONE decision).
 *
 * Everything else the same response may carry — a placement, an OrOptions
 * branch, a resource pick, a discard from hand — is the play's ordinary
 * follow-up and keeps its own surface, so the claim must let go of it.
 *
 * The one addition is not a KIND but a shape: a MARKED optional effect
 * (`effectDecisionBelongsToWorkspace`) is a `choice` like any other, and only
 * the server's `choiceContext` tells it apart from the branch pick beside it —
 * which is why it is asked as a predicate at the call site rather than added to
 * this set.
 */
const PLAY_CLAIMED_TASK_KINDS: ReadonlySet<TaskKind> =
  new Set<TaskKind>(['deckSelect', 'cardSelect', 'payment']);

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type OutcomePort = {
  $nextTick(fn?: () => void): Promise<void>,
  $refs: Record<string, unknown>,
  admits(surface: PromptSurface): boolean,
  armPartyDiscardStep: UnwrapRef<ParliamentController['armPartyDiscardStep']>,
  /** WRITTEN here. */ cardActionsDissolveArmed: UnwrapRef<CardActionsController['cardActionsDissolveArmed']>,
  /** WRITTEN here. */ coloniesLeaveNet: UnwrapRef<ColonyController['coloniesLeaveNet']>,
  /** WRITTEN here. */ coloniesLeaving: UnwrapRef<ColonyController['coloniesLeaving']>,
  /** WRITTEN here. */ colonyEmbedLatch: UnwrapRef<ColonyController['colonyEmbedLatch']>,
  colonyEmbedTarget: UnwrapRef<ColonyController['colonyEmbedTarget']>,
  colonyPick: UnwrapRef<ColonyController['colonyPick']>,
  /** WRITTEN here. */ colonyPickLatch: UnwrapRef<ColonyController['colonyPickLatch']>,
  colonyResolutionLive: UnwrapRef<ColonyController['colonyResolutionLive']>,
  /** WRITTEN here. */ colonyResolutionReleaseOwed: UnwrapRef<ColonyController['colonyResolutionReleaseOwed']>,
  continueLedgerPayoutAfterTake: UnwrapRef<ParliamentController['continueLedgerPayoutAfterTake']>,
  readonly deadPhaseAnchors: ReadonlyArray<string>,
  deckPickActive: UnwrapRef<RevealController['deckPickActive']>,
  deckPickBelongsToWorkspace: UnwrapRef<RevealController['deckPickBelongsToWorkspace']>,
  deckPickEmbedTarget: UnwrapRef<RevealController['deckPickEmbedTarget']>,
  dismissedRevealKey: UnwrapRef<RevealController['dismissedRevealKey']>,
  readonly effectDecisionBelongsToWorkspace: boolean,
  readonly effectDecisionEmbedTarget: string | undefined,
  endPlayCardFlow(): void,
  forceRecoverStuckWorkspace: UnwrapRef<SupervisorController['forceRecoverStuckWorkspace']>,
  /** WRITTEN here. */ handDissolveArmed: boolean,
  handEffectStageOn(): void,
  readonly handEntries: ReadonlyArray<ConsoleHandEntry>,
  readonly hostServesPrompt: boolean,
  readonly hostTask: ConsoleTask | undefined,
  lastLivenessAccepting: UnwrapRef<SupervisorController['lastLivenessAccepting']>,
  lawStepOwed: UnwrapRef<ParliamentController['lawStepOwed']>,
  ledgerPayoutClaimed: UnwrapRef<ParliamentController['ledgerPayoutClaimed']>,
  parliamentLeaveRelease: UnwrapRef<ParliamentController['parliamentLeaveRelease']>,
  /** WRITTEN here. */ parliamentWarmArmed: UnwrapRef<ParliamentController['parliamentWarmArmed']>,
  /** WRITTEN here. */ parliamentWarmTimer: UnwrapRef<ParliamentController['parliamentWarmTimer']>,
  partyDiscardStepOwed: UnwrapRef<ParliamentController['partyDiscardStepOwed']>,
  /** WRITTEN here. */ pendingPlayCard: PendingPlayCard | undefined,
  placementActive: UnwrapRef<PlacementController['placementActive']>,
  readonly playEffectOwed: boolean,
  readonly playerView: PlayerViewModel,
  politicalDiscardOwed: UnwrapRef<ParliamentController['politicalDiscardOwed']>,
  politicalPayoutOwed: UnwrapRef<ParliamentController['politicalPayoutOwed']>,
  rawDrawnRevealPending: UnwrapRef<RevealController['rawDrawnRevealPending']>,
  releaseColoniesLeave: UnwrapRef<ColonyController['releaseColoniesLeave']>,
  releasePlayComposerUnderStep(): Promise<void>,
  revealEmbedTarget: UnwrapRef<RevealController['revealEmbedTarget']>,
  revealOverlayMode: UnwrapRef<RevealController['revealOverlayMode']>,
  revealParliamentLatch: UnwrapRef<ParliamentController['revealParliamentLatch']>,
  sittingHostsVenusBonus: UnwrapRef<ParliamentController['sittingHostsVenusBonus']>,
  stdpHostsVenusBonus: UnwrapRef<StdProjectsController['stdpHostsVenusBonus']>,
  stuckWorkspaceIsGhost: UnwrapRef<SupervisorController['stuckWorkspaceIsGhost']>,
  readonly taskBelongsToWorkspace: boolean,
  readonly taskEmbedTarget: string | undefined,
  readonly venusBonusBelongsToWorkspace: boolean,
  readonly venusBonusEmbedTarget: string | undefined,
};

export function createOutcomeController(shell: OutcomePort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The held conclusion's question door already named (`<kind>|<promptId>|<result>`) — one line per standing. */
  const questionDoorLogged = ref('');
  /** The last guarded conclusion handed its frame to the frame's own question (`openHeldFrameQuestionDoor`) — '' = no. */
  const questionDoorServedKind = ref('' as WorkspaceFrameKind | '');
  /**
   * A dismiss deferred behind the ACTION COMMIT's minimum readable beat
   * (a fast server answer must not cut the activation short). Executed
   * by the `commitHolding` falling-edge watcher — the motion's own
   * settle releases it, never a timer.
   */
  const pendingCommitDismiss = ref(undefined as (() => void) | undefined);
  /**
   * The ACTION COMMIT has been resolved and its workspace's fold is OWED to
   * the phrase in the air (a capsule timeline — `consoleActionCommitRail`):
   * the awaiting handoff stays up meanwhile, and this keeps a later view from
   * resolving it a second time. Cleared by the fold itself.
   */
  const commitFoldOwed = ref(false);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The composer's declaration (PL-127): the card in the composer whose play will host a Parliament step. */
  const hostedStepDeclaredCard = computed((): string => {
    return shell.pendingPlayCard !== undefined ? consolePlayCardUi.hostedStepDeclared : '';
  });

  /** The ACTION COMMIT's minimum readable beat is still owed (the
   *  deferred-dismiss gate — see `pendingCommitDismiss`). */
  const commitHolding = computed((): boolean => {
    return actionCommitHolding();
  });

  /** Something is (or is about to be) re-homed into the workspace's zone. */
  const workspaceOutcomeEmbedded = computed((): boolean => {
    // «ПРИЁМКА»: a batch re-homed into the PARLIAMENT's draw stage is nobody's workspace outcome — its rise must not
    // mark a claim presenting, its fall must not end one (a card's walk in the hand: the play's claim stands beside it).
    return (shell.revealEmbedTarget !== undefined && shell.revealEmbedTarget !== PARLIAMENT_DRAW_ZONE) ||
      shell.taskEmbedTarget !== undefined ||
      // The DRAW & SELECT surface is re-homed by the same claim; leaving it
      // out would arm both failure modes at once — the 20 s backstop would
      // still be live under a decision the player is reading, and the claim
      // would never be released when the flow ends, so the hosting workspace
      // would never come back around its source card.
      shell.deckPickEmbedTarget !== undefined ||
      // …and the EFFECT DECISION a play's own triggered card raised. Same
      // claim, same zone, same two failure modes if it were left out.
      shell.effectDecisionEmbedTarget !== undefined ||
      // …and the alternative Venus board's BONUS the press's step earned (P89 · EE) — an outcome claim's only.
      (shell.venusBonusEmbedTarget !== undefined && !shell.stdpHostsVenusBonus && !shell.sittingHostsVenusBonus);
  });

  /**
   * THE CARD PLAY WORKSPACE is holding what a play produced (the drawn batch,
   * the pick it raised). The play's ending is re-asked off its falling edge:
   * the take never round-trips the server, so no view change will conclude
   * the flow for us, and an optimistic claim that turns out to host nothing
   * is released by the reconciler — both of those are «the play is over now»
   * and neither is a response.
   */
  const handOutcomeLive = computed((): boolean => {
    return workspaceOutcomeState.host === 'hand' && workspaceOutcomeClaimed();
  });

  /**
   * THE ANSWER EXISTS — deliberately independent of whether it may be SHOWN
   * yet. The execution beat turns its card over on this, so it must not be
   * gated on the beat that consumes it (which would deadlock: the beat waits
   * for the answer, the answer waits for the beat).
   */
  const workspaceOutcomeAnswerArrived = computed((): boolean => {
    if (!workspaceOutcomeClaimed()) {
      return false;
    }
    return shell.taskBelongsToWorkspace ||
      (shell.rawDrawnRevealPending && workspaceClaimsDrawRevealBatch(currentRevealEvent()));
  });

  // ── THE SERVING PROBE — «is the claim answering for something LIVE?» ──
  /**
   * THE CLAIM IS SERVING A PROMPT: the raw `waitingFor` names a question of a
   * kind the claim admits. Read off RAW facts ONLY — the router's task, the
   * server's own `lastReveal`, the structural effect decision — never an
   * admission-gated computed (`hostTask`, `deckPickActive`, `hydroFollowUpLive`):
   * a presentation hold, an announce gate or a card-arrival flight makes every
   * gated read blink false mid-decision, and that blink is exactly what used
   * to release the claim and fold the workspace under an open pick.
   *
   * This is the play-host law («read the RAW prompt, never "the gate is
   * holding something"», the reconciler's own doc) stated once, for every
   * host, and registered as the release funnel's guard
   * (`setWorkspaceOutcomeServingProbe`).
   */
  const workspaceOutcomePromptServed = computed((): boolean => {
    if (!workspaceOutcomeClaimed()) {
      return false;
    }
    // A follow-up card question of the claimed activation: the pick this
    // press raised, and the payment that finishes it (pick-then-pay is one
    // decision). Same kind set the reconciler's play arm reads.
    const task = taskFor(shell.playerView);
    if (task !== undefined && workspaceClaimsPick() &&
        PLAY_CLAIMED_TASK_KINDS.has(task.kind)) {
      return true;
    }
    // The optional effect the press woke up — structural on both sides.
    if (shell.effectDecisionBelongsToWorkspace) {
      return true;
    }
    // …and the Venus bonus the press's step earned (P89 · EE): the server's marker on the raw prompt + the claim.
    if (shell.venusBonusBelongsToWorkspace) {
      return true;
    }
    // An UNACKNOWLEDGED deck-check verdict the claim owns: `lastReveal` is
    // server state until the player's next input, and the «ОК» sets the
    // dismissal marker BEFORE releasing — so an acked verdict stops serving
    // in the same synchronous turn its release is asked in.
    const lr = shell.playerView.lastReveal;
    if (lr !== undefined && workspaceClaimsDeckCheck(lr.action) &&
        `${lr.action}|${lr.revealed.name}` !== shell.dismissedRevealKey) {
      return true;
    }
    return false;
  });

  /**
   * THE CLAIM IS SERVING A BATCH: cards the server drew for the viewer that
   * they have not finished taking. Both witnesses on purpose — the client's
   * pending flag blinks false by design during the deal / closing beats,
   * while the server's own unconsumed reveal queue is race-proof evidence
   * available a full cinematic before the client can render anything.
   */
  const workspaceOutcomeBatchServed = computed((): boolean => {
    if (!workspaceOutcomeClaimed()) {
      return false;
    }
    // The server witness counts only batches the viewer has NOT consumed
    // — AND only batches this claim actually ANSWERS FOR, judged by each
    // reveal's OWN source. The ack is fire-and-forget and deliberately
    // does not apply its response, so the applied view lists a fully-taken
    // batch until the next poll/input — a stale echo, not evidence of
    // anything owed (see `serverRevealConsumed`). And presence alone is a
    // strict superset of ownership: judged by the CURRENT store event's
    // source (which is `undefined` the moment the last batch dismisses —
    // and an unattributed source reads as ours by design), a FOREIGN
    // batch's echo wedged the funnel shut for the 20 s claim backstop. A
    // batch the store has not reconciled yet is still outstanding by
    // construction, and a PARKED batch (a remote bonus behind its
    // announce, a board-beat park — both subtracted from
    // `rawDrawnRevealPending` upstream) stays outstanding too: it is
    // undismissed.
    if (shell.playerView.cardDrawReveals.some((r) =>
      !serverRevealConsumed(r.id) && workspaceClaimsRevealBatch(r))) {
      return true;
    }
    return shell.rawDrawnRevealPending &&
      workspaceClaimsRevealBatch(currentRevealEvent());
  });

  /** The funnel's registered probe: serving = a live prompt OR a live batch.
   *  (The take paths release with `force` — the consumed artifact is the
   *  licence — so this never wedges a finished flow open.) */
  const workspaceOutcomeServingNow = computed((): boolean => {
    // …and a claim that IS a live ledger payout's (TR23): it spans the whole
    // payout — the gaps between a row's take and its discard, and between two
    // pairs, hold nothing the two halves above can see, yet the next batch of
    // the same press is on its way. The payout's own end (`done`) lifts it.
    return workspaceOutcomePromptServed.value || workspaceOutcomeBatchServed.value || shell.ledgerPayoutClaimed;
  });

  /**
   * THE ADOPTION VERDICT for the pending drawn batch (`consoleOutcomeAdoption`
   * — the net under the claim system): re-home a claim whose host frame is
   * gone, late-claim an unowned batch for the workspace the player is inside,
   * release an orphan nobody can host. Pure over the shell's own signals;
   * applied by the `outcomeAdoptionDecision` watcher post-flush.
   */
  const outcomeAdoptionDecision = computed((): OutcomeAdoptionDecision => {
    const ev = currentRevealEvent();
    const source = ev?.source;
    const claimHost = workspaceOutcomeState.host;
    return resolveOutcomeAdoption({
      pending: ev !== undefined && shell.rawDrawnRevealPending,
      source,
      claimLive: workspaceOutcomeClaimed(),
      claimHost,
      claimHostKnown: claimHost !== undefined && workspaceFrameKnown(claimHost),
      claimMatchesBatch: workspaceClaimsRevealBatch(ev),
      boardSceneOwns: boardCardBonusClaimsReveal(source),
      tradeSceneOwns: colonyTradeClaimsReveal(source),
      adoptionHost: outcomeAdoptionHost(),
      claimServesLivePrompt: workspaceOutcomePromptServed.value,
    });
  });

  /**
   * The batch is about to be adopted — hold its presentation for the one
   * flush the post-watcher needs, so the standalone band never mounts for a
   * frame and then teleports (the modal-then-embed flash). Falls by itself:
   * the applied claim/re-home/release makes the decision resolve to 'none'.
   */
  const outcomeAdoptionPending = computed((): boolean => {
    return outcomeAdoptionDecision.value.kind !== 'none';
  });

  /**
   * A STEP THIS FLOW OWES IS NOT ON SCREEN YET — the door above is holding it
   * back while the previous effect of the same press finishes.
   *
   * THE THIRD FORM OF «a host does not fold under what it carries». The first
   * is a step STANDING inside it (`workspaceFrameHasNested`), the second is an
   * outcome still MOVING (`handOutcomeLive`), and this is one still OWED —
   * without it the take folded the hand's descent and concluded its workspace,
   * and the colony grid then opened as a lateral screen: one press, two
   * unrelated places. Read by the conclusion (`owed-step`), by the descent's
   * fold guard and by the crumb, which names the coming step rather than
   * stepping backwards for the gap.
   *
   * `frameServing` covers the PARK too: a chain the player set aside already
   * has a home for this prompt, so nothing is owed.
   */
  const followUpStepOwed = computed((): boolean => {
    const task = taskFor(shell.playerView);
    // With the prompt itself: a step-shaped follow-up may be one by its
    // MARKER (the delegate grant's `votePrompt`), not only by its kind.
    return task !== undefined && followUpStepStage(task.kind, shell.playerView.waitingFor) !== undefined &&
      !consoleState.task.deferred && frameServing(task.kind) === undefined &&
      !shell.admits('followUp');
  });

  /** The crumb tail an OWED step already carries (see `followUpStepOwed`). */
  const followUpStepStageKey = computed((): string => {
    return (followUpStepOwed.value ? followUpStepStage(taskFor(shell.playerView)?.kind, shell.playerView.waitingFor) : undefined) ?? '';
  });

  /**
   * THE FACTS OF THE CONCLUSIONS THAT ARE OWED — what the shell's `owedConclusionFacts` row watches (`''` while nothing
   * is owed: the row is inert for the whole ordinary life of the console). Built by the owed runs' module from
   * `conclusionFactsKey` below — the SAME object the decision is made from, never a second list of its ingredients.
   */
  const owedConclusionFacts = computed((): string => {
    return owedConclusionFactsKey();
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * The flow is FINISHED and its result is airborne — fold the WHOLE
   * workspace, atomically (sheet closed + the composer's command contract
   * reset in the same frame — the iteration-16 half-collapse rule). A take
   * never round-trips the server, so no view change will close the sheet
   * for us; without this the workspace sat over the board while the intake
   * aimed at a covered dock («workspace не закрывается» — the receive bug).
   * Idempotent: the buy path reaches it twice (detach + complete).
   *
   * WHICH workspace is the CLAIM's own host, never a hard-coded kind: the
   * two sites that call this used to name «card-actions» outright and skip
   * the two hosts that end differently (`host !== 'colonies' && …`), so a
   * NEW host either concluded somebody else's workspace or nobody's — which
   * is exactly what left the card-play workspace standing over a board it
   * had already handed its cards to. `outcomeHostConcludesFlow` is that
   * question asked once, exhaustively, in the claim's own module:
   *  · the COLONY section IS the surface, and its transaction finishes on
   *    the browse grid the embed zone just handed back;
   *  · the HYDRO track concludes through its own result stage.
   */
  function foldWorkspaceAfterResult(host = workspaceOutcomeState.host): void {
    if (outcomeHostConcludesFlow(host) && host !== undefined) {
      // A card PLAY's frame `serves` are registry defaults, not rights this
      // flow earned — see `concludeWorkspaceFlow`.
      concludeWorkspaceFlowOrOwe(host, host !== 'hand');
    }
  }

  /**
   * THE FACTS A CONCLUSION IS DECIDED BY — ONE object, read here and nowhere else: `concludeWorkspaceFlow` hands it to
   * the policy (`workspaceConclusionFor`), and the owed run wakes on its key (`conclusionFactsKey`). A hold the
   * decision gains is, by that, a fact the wake has — the hand-written signal list that had to be kept in step with
   * this object (and lost a term every few weeks) is gone. Pure: reads, never writes.
   */
  function conclusionFacts(kind: WorkspaceFrameKind, servedPromptHolds: boolean) {
    // MY claim, never «somebody holds one»: a foreign host's live outcome
    // says nothing about whether THIS flow is finished.
    const mine = workspaceOutcomeState.host === kind && workspaceOutcomeClaimed();
    const task = taskFor(shell.playerView);
    return {
      nested: workspaceFrameHasNested(kind),
      // …and a step this flow OWES but has not been handed yet: the door is
      // held behind the effect that arrived with it, and THIS workspace is the
      // host it will teleport into (`workspaceHostForStep` is the same lookup
      // `openColoniesForPrompt` will make). Concluding here would drop the
      // player on the board and then throw the second effect at them as a
      // screen of its own.
      // …and a WALK this hand owes (TR04): promised by the play's preview and
      // not yet played — the record on its way, or the landing ritual still
      // telling its story before the Parliament takes the zone.
      owedStep: (followUpStepOwed.value && workspaceHostForStep() === kind) || (kind === 'hand' && hostedStepOwedTo('hand')) ||
        // …and the discard a party's action owes to the card composer that committed it (the one-framework door).
        (kind === 'card-actions' && shell.politicalDiscardOwed),
      // …and a walk PLAYING inside it: the marker moving, a chip in the air, the read.
      // …and a LEDGER still paying inside it (TR23 — «all your colony bonuses»):
      // the rows in turn, a take, a discard, the read — the flow's own body.
      // …and a PARTY DISCARD'S PAYOUT (the Reds): awaited from the submit (the transport took the prompt down, so the
      // discard's `owed-step` let go and the conclusion owed since the draw's take FIRED — the box's stack trace:
      // `closeWorkspaceRoot:card-actions` before the answer) or held on the rail until its wave has flown.
      // …and «ПРЕДСЕДАТЕЛЬСТВО» playing in the Parliament (the office and the step play AFTER the gate's answer — the
      // vote that closed the quest went on into it in place, ledger HC: its earlier ending must not take the beats down).
      outcomeLive: mine || (kind === 'hand' && hostedStepLiveIn('hand')) || (kind === 'parliament' && chairmanQuestFlow.live) ||
        (kind === 'card-actions' && (colonyBonusPayoutLive() || shell.politicalPayoutOwed)),
      // The second half of a pick-then-pay and a DRAW & SELECT still standing
      // in our zone are both this activation, still being answered — and so
      // is any prompt this FRAME earned the right to serve.
      //
      // …EARNED being the word. `servedPromptHolds: false` is for a flow whose
      // frame carries REGISTRY DEFAULTS instead (the hand's `projectCard` /
      // `handSelect`): a discard the played card just forced is not this
      // play's outcome, and holding the workspace for it would stand the
      // flow around a PARKED browse layer — the picker the prompt needs,
      // invisible behind a finished stage.
      ownsPrompt: (mine && (shell.taskBelongsToWorkspace || shell.deckPickBelongsToWorkspace || shell.venusBonusBelongsToWorkspace)) ||
        (servedPromptHolds && task !== undefined && frameServing(task.kind)?.kind === kind) ||
        // THE ENACTED LAW'S ACTION still owes a step (Turmoil Redux, RX36): its card landing in the stage, or the live
        // play pick a bill with a payment of its own raised after it — neither a prompt this frame «serves» by registry.
        (kind === 'card-actions' && shell.lawStepOwed),
      parked: workspaceFrameParked(kind),
      // …and a frame off the live stack in any other way (aside for the board): a flow never finishes where nobody
      // sees it — owed, re-asked on the frame's return (the owed run wakes on this very object — `conclusionFactsKey`).
      offStage: workspaceFrameOffStage(kind),
    };
  }

  /**
   * …and its KEY, for the owed run (`workspaceConclusionOwe.ts`): the facts above, plus what the claim's RECONCILE
   * reads to let a claim go with no response behind it (its stage, whether it serves, the board-beat park) — a re-ask
   * reconciles first, so those moving is a reason to ask again even while the verdict would still be «hold». And the
   * three ways a debt simply ends: the frame is on no stack, a NEW claim of this host owns the ending, the flow was
   * handed to its own question.
   */
  function conclusionFactsKey(kind: WorkspaceFrameKind, servedPromptHolds: boolean): string {
    if (!workspaceFrameKnown(kind) && !workspaceFrameOffStage(kind)) {
      return 'gone';
    }
    const mine = workspaceOutcomeState.host === kind && workspaceOutcomeClaimed();
    return JSON.stringify([
      conclusionFacts(kind, servedPromptHolds),
      mine ? workspaceOutcomeState.stage : '',
      workspaceOutcomeServingNow.value,
      boardBeatParkPending(),
      questionDoorServedKind.value === kind,
    ]);
  }

  /**
   * THE END OF A COMMITTED FLOW — ONE function, EVERY ending.
   *
   * A card activation can finish in four different places, one per result
   * flavour, and each of them used to conclude itself:
   *
   *   · a plain reward           → the awaiting resolve's `finishDismiss`;
   *   · a drawn batch taken      → `onEmbeddedDrawnComplete` / `…Detached`;
   *   · a deck-check verdict «ОК»→ the workspace's own `onRevealAck`;
   *   · a purchase answered      → the claim's release (`embed-fell`).
   *
   * The first two closed the workspace; the last two folded back to the
   * ДЕЙСТВИЯ КАРТ browse grid — so «Поиск жизни» ended by putting the player
   * back in the list, staring at the action they had just performed, now
   * greyed «Активирована». Same question, four answers, two of them wrong,
   * and the only thing deciding which one a player got was whether that
   * action's result happened to be embeddable.
   *
   * So the ending is one call now, and the DECISION is the pure policy
   * (`workspaceConclusionFor`): past the commit boundary the workspace is not
   * a place to come back to — it leaves and the player lands on the board —
   * UNLESS the flow still owes something INSIDE it. That last part is the
   * whole reason this is guarded rather than a bare close: a workspace is ONE
   * FLOW, and a flow routinely outlives the stage that produced its first
   * result (a purchase raises its payment, a colony step stands inside the
   * activation that opened it, a batch is still in the air).
   *
   * SYNCHRONOUS on purpose. Every caller that needs a tick already defers
   * (the claim's falling edge, the embed's, the reconciler's), and the two
   * result-flight sites must fold in the SAME frame the card detaches — a
   * tick of daylight there leaves a dead frame over a finished decision while
   * the intake aims at a still-covered dock.
   */
  function concludeWorkspaceFlow(kind: WorkspaceFrameKind, servedPromptHolds = true): boolean {
    // The door's word is per KIND (wait-graph inventory W3): another kind's conclusion never clears it.
    if (questionDoorServedKind.value === kind) {
      questionDoorServedKind.value = '';
    }
    // Gone = on no stack at all. A frame standing ASIDE for the board is NOT gone: it comes back at the same depth, and
    // reporting it «ended» closed nothing and let it return to a finished flow (the hidden-scene class — `off-stage`).
    if (!workspaceFrameKnown(kind) && !workspaceFrameOffStage(kind)) {
      return true; // already gone (a second, idempotent report) — nothing to end
    }
    const task = taskFor(shell.playerView);
    const conclusion = workspaceConclusionFor(conclusionFacts(kind, servedPromptHolds));
    if (conclusion.verdict === 'hold') {
      conclusionRefusal.last = {kind, reason: conclusion.reason, at: Date.now()};
      if (conclusion.reason === 'owned-prompt') {
        openHeldFrameQuestionDoor(kind);
      }
      return false;
    }
    conclusionRefusal.last = undefined;
    resetConsoleActionComposerUi();
    // THE QUESTION KEEPS ITS SURFACE (`shellTaskSurface.ts` law 2). The flow is over, but the server already asks the
    // next thing ON this frame — a prelude WG Project dealt (Eccentric Sponsor, Ecology Experts) asks «play a card
    // from your hand» while the play's own conclusion is still owed. Closing here left the prompt seated on a surface
    // that no longer existed (the stranded guard over the board); the frame instead hands its browse layer to the
    // question, and a chain it ran ends with the flow.
    if (questionKeepsFrame({
      task,
      kind,
      deferred: consoleState.task.deferred,
      hosted: workspaceFrameHost(kind) !== undefined,
      phaseRoot: workspaceFrameAnchor(kind)?.type === 'phase',
    }) && workspaceStackTop()?.kind === kind) {
      handFrameToQuestion(kind);
      if (preludePlayChainState.live && preludePlayChainState.host === kind) {
        endPreludePlayChain();
      }
      if (kind === 'hand') {
        const firstPlayable = shell.handEntries.findIndex((e) => e.playable);
        consoleState.handIndex = firstPlayable !== -1 ? firstPlayable : 0;
      }
      return true;
    }
    // The workspace goes and takes everything standing in it. `closeConsoleLayers`
    // is what clears the transient shell state that rode with it (quick
    // selector, sale mode, sheet cursor) and pops the sheet-shaped frames;
    // `closeWorkspaceRoot` is the honest verb for a kind that is not one.
    //
    // …EXCEPT a PHASE-ANCHORED root (the start workspace IS the opening).
    // Such a frame is not part of anybody's flow, so a flow that ran INSIDE
    // it — a corporation's play, a prelude's — can never be what ends it:
    // `goBoardHome` drops everything the flow stood up and leaves the phase
    // alone, which is the same rule it already states for a placement
    // excursion mid-deployment.
    // …and a LOCKED-ENTRY TRADE hosted by another workspace (a card's or a party's door): the trade IS the whole
    // move, its host's browse list has nothing left to offer for it — the same landing `onColonyFlowComplete`
    // gives one with nothing owed, never a fold back into the list the player came from.
    if (workspaceFrameAnchor(kind)?.type === 'phase' ||
        (kind === 'colonies' && workspaceFrameIndex('colonies') > 0 && colonyTradeEntryLocked())) {
      goBoardHome();
    } else {
      closeWorkspaceRoot(kind);
    }
    closeConsoleLayers();
    return true;
  }

  /**
   * A CONCLUSION HELD FOR THE FRAME'S OWN QUESTION IS A HAND-OVER (`frameQuestionDoor.ts`, ledger HC — the chairman
   * quest riding the vote's answer stood 8 s on a finished vote nobody could leave): the frame standing on screen at
   * the top of the stack is asked to serve the standing question in place. Only a live, on-stage, un-deferred top
   * frame — a parked / aside / hosted one has its own way back. Named once per prompt.
   */
  function openHeldFrameQuestionDoor(kind: WorkspaceFrameKind): void {
    if (workspaceStackTop()?.kind !== kind || !workspaceSceneOnStage(kind) || consoleState.task.deferred) {
      return;
    }
    const result = openFrameQuestionDoor(kind);
    if (result === 'served') {
      // The flow did not end — it goes on into its question: whatever ending was asked is no longer OWED.
      questionDoorServedKind.value = kind;
    }
    const key = `${kind}|${shell.playerView.waitingFor?.promptId ?? ''}|${result}`;
    if (questionDoorLogged.value !== key) {
      questionDoorLogged.value = key;
      const asked = taskFor(shell.playerView)?.kind ?? '';
      // Named quietly: `no-door` / `refused` are the common, honest cases (a hand / a composer that already PRESENTS
      // its pick-then-pay); a hold that then stands with nothing served is the liveness arbiter's to name.
      console.info(`[workspace-question] «${kind}» holds for its own question (${asked}) — ${result === 'served' ? 'served in place' : result === 'no-door' ? 'no door' : 'its door has nothing to open'}`);
    }
  }

  /**
   * CONCLUDE, AND IF REFUSED — OWE IT. The callers of a flow's ending fire exactly once (the last card's take, a
   * flow-complete report), while the conclusion legitimately holds on TRANSIENT witnesses (a serving echo, a mid-flush
   * blink, a parked batch). A one-shot meeting a transient refusal is how a finished workspace stood
   * committed-and-empty until something unrelated happened; the owed ending is a RUN in the frame's own scope
   * (`workspaceConclusionOwe.ts`) that asks again the moment the decision's facts move — and takes itself away with
   * the frame.
   */
  function concludeWorkspaceFlowOrOwe(kind: WorkspaceFrameKind, servedPromptHolds = true): boolean {
    const done = concludeWorkspaceFlow(kind, servedPromptHolds);
    if (done || questionDoorServedKind.value === kind) {
      // Concluded — or HANDED TO ITS QUESTION (ledger HC): the flow goes on in place and the question's own flow
      // reports its own ending. An owe kept here concluded the Parliament the instant the gate was answered, under
      // the chairmanship's beats (the e2e of the field lock, 2026-11-08).
      withdrawConclusionOwe(kind);
      return done;
    }
    // REFUSED: the ending is OWED — a run in this frame's scope (`workspaceConclusionOwe.ts`), woken by the decision's
    // own facts. A re-owe of the same frame is the same debt (its clock is kept).
    oweConclusion(kind, servedPromptHolds);
    return false;
  }

  /**
   * ASK AN OWED CONCLUSION AGAIN (the owed run's `reask` — on its facts moving, on its cadence, from a recovery door).
   * Idempotent and safe: it re-reconciles a claim (releasing one that now answers for nothing — the funnel still
   * guards a serving claim) and re-asks the ONE guarded conclusion (which holds honestly for a real nested step /
   * owned prompt / park).
   */
  function reaskConclusion(kind: WorkspaceFrameKind, servedPromptHolds: boolean): ConclusionReask {
    if (!workspaceFrameKnown(kind) && !workspaceFrameOffStage(kind)) {
      return 'done';
    }
    // A NEW claim armed for the same host: a fresh flow owns its ending.
    if (workspaceOutcomeState.host === kind && workspaceOutcomeState.stage === 'awaiting') {
      return 'done';
    }
    // A claim is released only by the reconciler, which runs on RESPONSES — but what makes it releasable (the
    // board-beat park draining, a beat settling) can arise with no response. Reconcile is HOST-AWARE (its own «ours»
    // arms keep a colony / hydro claim alive through a genuine resolution), so running it for ANY host is safe — it
    // releases only a non-serving, non-owned claim.
    if (workspaceOutcomeState.host === kind && workspaceOutcomeClaimed()) {
      reconcileWorkspaceOutcome();
    }
    if (concludeWorkspaceFlow(kind, servedPromptHolds)) {
      return 'done';
    }
    return questionDoorServedKind.value === kind ? 'handed' : 'held';
  }

  /** The frame is the registry home of the live (non-optional) question and the screen accepts input (liveness). */
  function frameServesLiveQuestion(kind: WorkspaceFrameKind): boolean {
    const wf = shell.playerView.waitingFor;
    const task = taskFor(shell.playerView);
    return wf !== undefined && wf.optional !== true && task !== undefined && frameServing(task.kind)?.kind === kind && shell.lastLivenessAccepting;
  }

  /** Is this anchor PROVABLY over? (registered into the stack — its return doors and prunes ask it). */
  function frameAnchorIsDead(anchor: FrameAnchor): boolean {
    return anchor.type === 'phase' && shell.deadPhaseAnchors.includes(anchor.phase);
  }

  /**
   * THE RESULT HAS LEFT THE WORKSPACE — the card is now an independent
   * object on an app-level flight layer (or the exit layer, for a refusal),
   * standing over where it was. From this frame the workspace owns nothing
   * the player still needs, so it may fold.
   *
   * Releasing the claim HERE is what makes the two overlap: the card lifts,
   * the frame collapses under it, the board and the hand dock come back —
   * and only then does the intake's own slot polling find the dock's REAL
   * geometry and finish the flight. Folding earlier would take the card down
   * with the DOM; folding later would leave a dead frame sitting over a
   * finished decision, and the flight would have to aim at a dock that is
   * still hidden (or at a guessed rect, which this flow forbids).
   */
  function onWorkspaceResultDetached(): void {
    // «ПРИЁМКА»: the same law at the take's staged seam (it fires FIRST for a single card).
    if (shell.revealParliamentLatch) {
      return;
    }
    const host = workspaceOutcomeState.host;
    // The colony RESOLUTION's claim spans every batch — same law as the
    // drawn-complete arm above.
    if (host === 'colonies' && shell.colonyResolutionLive) {
      return;
    }
    // …and a LEDGER PAYOUT's (TR23) — both ends of the take must hold.
    if (shell.ledgerPayoutClaimed) {
      shell.continueLedgerPayoutAfterTake();
      return;
    }
    // …and so does a play chain still owing its EFFECT DECISION (this fires
    // at the intake's staged seam, BEFORE `drawn-complete` — both ends of
    // the take must hold, or the first one folds the workspace under it).
    if (shell.playEffectOwed) {
      shell.handEffectStageOn();
      return;
    }
    // A PARTY ACTION'S DRAW (the Reds — Turmoil Redux): the take consumes
    // the batch, and the flow goes on INSIDE this workspace — its next step
    // is the mandatory discard (`armPartyDiscardStep`), so the workspace is
    // not folded and nothing is owed to the conclusion yet.
    if (shell.partyDiscardStepOwed) {
      releaseWorkspaceOutcome('result-detached', {force: true});
      shell.armPartyDiscardStep();
      return;
    }
    // ONE PRESS, SEVERAL BATCHES OF ONE CARD — a PLAY that pays «all your
    // colony bonuses» (Productive Outpost: Miranda's card, then Pluto's; each
    // batch names the card that paid it, `via`): the claim re-arms for the
    // queued sibling instead of folding under it — `drawn-complete`'s own law
    // («THE CHAIN HAS ANOTHER BATCH QUEUED»), stated at this seam too, which
    // fires FIRST for a single-card take. Judged by the sibling's own source,
    // never by «some batch exists»: a foreign delivery keeps its own surface.
    const taken = currentRevealEvent()?.id;
    const sibling = drawnCardsState.events.find((e) =>
      e.id !== taken && !e.dismissed && e.cards.length - e.takenIndices.size > 0 &&
      e.source?.type === 'colony' && e.source.via !== undefined && workspaceClaimsColonyRevealBatch(e));
    if (sibling !== undefined) {
      retainWorkspaceOutcomeForNextBatch(sibling.cards.length);
      return;
    }
    // …and ONE PRESS, TWO REACTIONS THAT DRAW (2026-10-15 — «Конференция на Олимпе» «remove to draw» + «Марсианский
    // университет»'s discard chosen before the press, both in the play's ONE response): the second batch is the
    // play chain's own next stage — a card of the viewer's OWN table drew it — never a standalone band over the board
    // after the workspace folded. A batch a card of another seat (or no card) sent keeps its own surface.
    if (isPlayOutcomeHost(host)) {
      const own = new Set(shell.playerView.thisPlayer.tableau.map((c) => c.name as string));
      const chained = drawnCardsState.events.find((e) =>
        e.id !== taken && !e.dismissed && e.cards.length - e.takenIndices.size > 0 &&
        intakeBatchSources(e).some((source) => source?.type === 'card' && own.has(source.cardName)));
      if (chained !== undefined) {
        retainWorkspaceOutcomeForNextBatch(chained.cards.length);
        return;
      }
      // …and the play's own «where?» after its draw (TRP9 Medical Institute, PL-1117 — this seam fires FIRST, before
      // `drawn-complete`, so both ends of the take must hold): the claim stays AS IT IS for the target pick standing in
      // `waitingFor`, which then stands in this host's zone; the reconciler releases it once the pick is answered.
      if (playOwesTargetPick(shell.playerView.waitingFor)) {
        return;
      }
    }
    // FORCED — same licence as `drawn-complete`: the result's detach is the
    // take, and the batch's own tail must not refuse it.
    releaseWorkspaceOutcome('result-detached', {force: true});
    foldWorkspaceAfterResult(host);
  }

  /**
   * The ACTION COMMIT's reward wave: the resources the activated mechanic
   * printed MATERIALIZE at their own icons and fly to the rail rows; each
   * counter ticks exactly at its chip's touchdown (the panel reward hold),
   * the delta chip riding that honest transition. One existing framework end
   * to end — specs, arcs, aggregation, layer, reduced motion all come from the
   * resource-transfer system.
   *
   * THE ORIGINS ARE OBJECTS (T06 «оба конца живые»): the plan carries the
   * printed icon ELEMENTS, re-measured at each token's birth — never the
   * points of the press, which described a pose the composer may have left —
   * and the workspace folds only once EVERY token has LEFT its icon (the
   * resolved promise: the run's own `onLeft`, bounded by the caller). A
   * staggered wave used to be born over a composer already dissolving under it.
   */
  function runCommitRewardWave(plan: ActionCommitPlan): Promise<void> {
    if (plan.specs.length === 0) {
      return Promise.resolve();
    }
    let leave: () => void = () => {};
    const left = new Promise<void>((resolve) => {
      leave = resolve;
    });
    // The wave's net releases ITS OWN rows only: a blanket clear here once
    // dropped every other hold on the rail with it — the rail half of the
    // same commit (its TR still in the air) included.
    const pending = new Set(plan.specs);
    // A token whose destination the folding workspace still covers (PL-165) is born on its printed icon, waits in
    // the app-level layer while the workspace folds UNDER it, and lands once the destination is painted — its row
    // is released by its OWN touchdown, never by this run's net (the run resolves at its pop).
    const detached = new Set<ResourceTransferSpec>();
    // THE TICK CADENCE (the shared touchdown rule — `TOUCHDOWN_TICK_GAP_MS`): two tokens of one wave landing in one
    // frame (P68's «2x [M€]» — a token per card thrown, born on one icon) never read as one jump «18 → 22»; each tick
    // stands its gap, in a TASK of its own (two releases in one task are one render).
    const tickGap = consoleReducedMotionActive() ? 0 : motionMs(TOUCHDOWN_TICK_GAP_MS);
    let lastTick = -Infinity;
    const tickAt = (apply: () => void) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      lastTick = touchdownTickAt(now, lastTick, tickGap);
      if (lastTick <= now) {
        apply();
      } else {
        window.setTimeout(apply, lastTick - now);
      }
    };
    void runResourceTransfers({
      specs: plan.specs,
      origins: plan.origins,
      source: plan.source !== undefined ? {end: plan.source} : {point: plan.sourcePoint},
      arrival: 'auto',
      detachCovered: true,
      onLeft: () => leave(),
      onDetach: (spec) => detached.add(spec),
      onArrive: (spec) => {
        if (pending.delete(spec)) {
          tickAt(() => releasePanelRewardHold(spec));
        }
      },
    }).finally(() => {
      leave();
      pending.forEach((spec) => {
        if (!detached.has(spec)) {
          releasePanelRewardHold(spec);
          pending.delete(spec);
        }
      });
    });
    return left;
  }

  /**
   * SETTLE the claim once the response has actually been applied.
   *
   * The awaiting resolve holds the workspace open on the strength of the
   * claim alone, because at that point the artifact is not readable yet. A
   * tick later it is: if the action produced something the workspace hosts
   * (a batch, a card pick), the claim has done its job and stays; if it
   * produced nothing embeddable — the branch promised cards but the outcome
   * was, say, a placement, or the server simply asked nothing — the claim is
   * dropped immediately, which folds the workspace exactly as an unclaimed
   * action would have.
   *
   * Without this the 20 s safety timer would be the only way out, and the
   * player would sit in a stage with nothing in it.
   */
  function reconcileWorkspaceOutcome(): void {
    void shell.$nextTick(() => {
      if (workspaceOutcomeState.sourceCard === '') {
        return;
      }
      // POSITIVE evidence only. "Nothing is embedded YET" is not evidence —
      // a prompt routes through the admission gate and a draw reconciles
      // through `drawnCardsState`, both of which can trail this tick, and
      // releasing on that guess is exactly how the buy prompt escaped into
      // its own band. So: keep the claim while anything is (or is about to
      // be) ours, and let it go only when the server has demonstrably asked
      // for something else — or for nothing.
      const task = taskFor(shell.playerView);
      const ours = workspaceOutcomeEmbedded.value ||
        // The prompt IS ours — whether or not its slot has appeared yet.
        // This is the arm that was missing: readiness was being read as
        // ownership, so a slot that had not mounted on this exact tick was
        // taken to mean "the outcome went elsewhere", the claim dropped, the
        // workspace folded and the standalone band took the prompt.
        shell.taskBelongsToWorkspace ||
        // A PENDING BATCH is ours only when the claim answers for ITS
        // source. Presence alone kept the claim alive for a batch with its
        // own presenter — a Venus-scale draw riding the same response held
        // the play's workspace open (live-outcome) while the batch waited
        // for that very workspace to leave, which is a deadlock by
        // construction. (An unattributed batch still reads as ours —
        // `workspaceClaimsDrawReveal(undefined)` — so Celestic's trail
        // window keeps its claim.)
        (shell.rawDrawnRevealPending &&
          workspaceClaimsRevealBatch(currentRevealEvent())) ||
        deckDrawHolds() ||
        consoleActionComposerUi.revealClaim !== '' ||
        // …and while the SERVER is holding a VERDICT this claim owns. Same
        // shape as the reveal arms above and the same reason: the artifact
        // exists long before it can be RE-HOMED. A play's own hero scene
        // («сначала карта сыграна») stands between the answer and the moment
        // the verdict may present, so at this tick there is nothing embedded
        // to see — and reading that as «the outcome went elsewhere» dropped
        // the claim of a repeated action's verdict, which then opened as a
        // full-bleed modal over the workspace that had just produced it.
        workspaceClaimsDeckCheck(shell.playerView.lastReveal?.action) ||
        // ⚠️ DELIBERATELY NO «the first-action STAGE is still running» arm.
        // One stood here (for Celestic's trail window — the batch arrives a
        // beat after the answer), but the stage itself waits on the CLAIM
        // (`embedActive` → `firstActionChainQuiet` → `firstActionLeaveDue`),
        // so claim and stage held EACH OTHER and only the 20 s claim backstop
        // broke the loop: a first action with nothing card-shaped in its
        // answer (Arcadian's marker claim — space, then the action menu)
        // left the workspace standing on an EMPTY «ПЕРВОЕ ДЕЙСТВИЕ» stage,
        // swallowing the pad for twenty seconds. The trail window is covered
        // by the POSITIVE evidence arms around this spot — the server-held
        // reveal below (`cardDrawReveals` rides the very answer that resolves
        // a draw), the client-side pending batch (`rawDrawnRevealPending`),
        // the live deal (`deckDrawHolds`) and the claimed prompt kinds — and
        // a prompt the claim can never host must release it even mid-stage:
        // that release is exactly what lets the stage finish and the
        // workspace conclude.
        // …and, generally, while the SERVER still holds an unconsumed
        // reveal for us: that is positive evidence of an artifact on its
        // way, available a full cinematic before the client can render it.
        //
        // EVERY play host, not just the start. A play's chain can put a
        // whole DECISION between the press and the cards («Марсианский
        // университет»: answer the effect → discard → only THEN is a card
        // drawn), so the batch arrives on a later response than the claim —
        // and at that tick the client has nothing rendered yet while the
        // server plainly does.
        //
        // …judged per reveal's OWN source, by the same rule as the pending
        // batch above: an unconsumed FOREIGN reveal (a Venus-scale draw, a
        // tile bonus) is not evidence this play's outcome is on its way —
        // holding for it deadlocked against the board-beat park, which
        // releases that batch only after this very workspace concludes.
        (isPlayOutcomeHost(workspaceOutcomeState.host) &&
          shell.playerView.cardDrawReveals.some((r) =>
            !serverRevealConsumed(r.id) && workspaceClaimsRevealBatch(r))) ||
        // The COLONY claim spans its whole resolution — the mandatory bonus
        // discard is a handSelect the workspace itself hosts, never «the
        // server asked for something else».
        (workspaceOutcomeState.host === 'colonies' && shell.colonyResolutionLive) ||
        // The LEDGER claim spans the card's whole payout (TR23): a row's batch
        // parked for its turn, the discard between a pair's halves, the next
        // pair on its way — none of it is «the server asked for something else».
        shell.ledgerPayoutClaimed ||
        // The PRELUDE CHAIN's board step (PL-1467): a placement the prelude asks is a step of the play, not «the
        // server asked for something else» — the claim waits for what the flow owes after it.
        (isPlayOutcomeHost(workspaceOutcomeState.host) && preludeChainHoldsClaim(shell.placementActive, shell.playerView)) ||
        // The HYDRO claim spans the advance's own resolution: the marker
        // gate delays the view (nothing is «asked» until the token locks),
        // the deck pick's closing beats outlive its prompt, and a PARKED
        // follow-up (deferred / collapsed) still owns its restore.
        (workspaceOutcomeState.host === 'hydro' &&
          (isHydroMarkerActive() || hydroTraversalPending() || shell.deckPickActive ||
            // …set aside by ANY way off screen — the stack's one answer (a park, the deferred plate, aside for the board).
            workspaceSceneHidden('hydro'))) ||
        (isPlayOutcomeHost(workspaceOutcomeState.host) ?
          // A PLAY CLAIM IS ABOUT CARDS. Read the RAW prompt, never «the gate
          // is holding something»: the play's own cinematic holds the task
          // host for its whole length, so during a play EVERY prompt looks
          // held — and «held» would then keep the claim alive for a prompt it
          // can never host (a placement, an OrOptions branch, a resource
          // pick), which are the play's ordinary follow-ups and route
          // normally. The workspace would stand open around them until the
          // 20 s backstop. What IS ours is a card question: the pick this
          // play raised, and the payment that finishes it.
          //
          // …plus the one question that is NOT about cards and is
          // unmistakably this press's own: the optional EFFECT a card of the
          // player's woke up («Марсианский университет» answering the science
          // tag they just played). Structural on both sides — the server's
          // `choiceContext` marker, and a shape this console can actually
          // present — so an ordinary un-hostable OrOptions branch still
          // releases the claim exactly as before.
          PLAY_CLAIMED_TASK_KINDS.has(task?.kind as TaskKind) ||
            shell.effectDecisionBelongsToWorkspace || shell.venusBonusBelongsToWorkspace :
          // The prompt exists but the gate is still holding it: it may yet be
          // ours once it opens — but only a prompt of a kind THIS claim can
          // host (`workspaceOutcomePromptServed`, read off the RAW prompt: a
          // card pick / payment for a `pick` claim, the woken effect for an
          // `effect` one). Any held prompt used to count, so a colony build's
          // `pick` claim — its card target pre-collected with the colony, so
          // no pick would ever come — was kept for Mars University's question
          // held behind the build's cinematic: the colony step stood
          // «awaiting» over the question and the university's card arrived in
          // a fullscreen viewer over a colony stage (the field report of
          // 2026-10-14).
          (shell.hostServesPrompt && shell.hostTask === undefined && workspaceOutcomePromptServed.value));
      if (ours) {
        return;
      }
      // A prompt the workspace does not host (a placement, an OrOptions
      // branch, a resource pick) IS the demonstration that this action's
      // outcome lives elsewhere.
      releaseWorkspaceOutcome('reconcile');
    });
  }

  /**
   * THE ONE STAGED HANDOFF TO A STEP OF THE HAND (the vote's Parliament, TR03;
   * the colonies, TR07). The batch parks, the step's frame is pushed INTO the
   * hand's own stage zone (the one section instance, embedded), and the
   * landing scene LETS GO where it stands: the composer and the landed card's
   * proxy dissolve while the step's entrance surfaces out of the same rect
   * (release → unfold → reveal, never a swap). Only once the old surface is
   * fully gone is the composer unmounted — the hand's frame keeps its subject
   * (the card) and its zone the whole time, so the crumb never loses the
   * card's name. Input is absorbed by the landing transaction until then.
   */
  async function enterStagedHostedStep(arm: StagedPlayArm, frame: Parameters<typeof pushWorkspaceFrame>[0]): Promise<void> {
    armStagedPlay(arm);
    if (arm.flow === 'law') {
      // A CARD PLAYED THROUGH A LAW (RX36): the step stands INSIDE the law's stage — the party composer's own layer
      // (`action-parliament` / `action-colonies`), published by the composer itself — and that stage never unmounts:
      // B gives the slot back as it was. The receiving stage the ritual landed on lets go in place (the composer
      // hides it while a step stands) and the landed card's proxy dissolves with it, while the step rises out of the
      // same rect. The decision now standing is the step's — reversible again.
      setWorkspaceFramePhase('card-actions', 'configure');
      pushWorkspaceFrame(frame);
      const proxy = typeof document === 'undefined' ? null : document.querySelector('.con-played-hero__proxy');
      if (proxy instanceof HTMLElement && !consoleReducedMotionActive() && typeof proxy.animate === 'function') {
        await proxy.animate([{opacity: 1}, {opacity: 0}], {duration: motionMs(STAGED_VOTE_RELEASE_MS), easing: 'ease-out', fill: 'forwards'})
          .finished.catch(() => undefined);
      }
      void finishStagedPlayedLanding();
      return;
    }
    if (arm.flow === 'action') {
      // A CARD ACTION's step (TR15 — the staged action vote): the ACTION COMPOSER is the host's own step zone
      // (`[data-embed-slot="action-parliament"]`, a layer of its decision column). It stays MOUNTED under the
      // step — B returns to the very variant, every capture intact — and RELEASES its setup in place itself
      // the moment the step is pushed (its `parliamentStepOn` edge), while the Parliament rises out of the same
      // rect by its own CSS entry. No ritual precedes it (an action lands no card), so nothing else lets go.
      pushWorkspaceFrame(frame);
      return;
    }
    // The descent is REVERSIBLE again (the ceremony set `executing`): the
    // decision now standing is the step's, and B walks back from it.
    setWorkspaceFramePhase('hand', 'configure');
    pushWorkspaceFrame(frame);
    // RELEASE: what stands in the zone is the landing scene — the composer's
    // «Разыграно» stage (its setup let go at the press) and the landed card's
    // proxy above it. Both let go IN PLACE, together, while the Parliament
    // rises out of the same rect (its own entry, `.con-parl--embedded`).
    // …and the composer lets go of the BAR at the start of its fade (PL-084): the bar reads the step's own
    // contract from this frame, never the composer's verbs over a frame past the commit. Only a STANDING
    // composer lets go — its unmount is what clears the flag, so a release with nobody to unmount would latch.
    if (shell.pendingPlayCard !== undefined) {
      releaseConsolePlayCardCommands();
    }
    const composer = ((shell.$refs.playConfirm ?? undefined) as {$refs?: {rootEl?: unknown}} | undefined)?.$refs?.rootEl;
    const proxy = typeof document === 'undefined' ? null : document.querySelector('.con-played-hero__proxy');
    const fades = [composer, proxy].flatMap((el) =>
      el instanceof HTMLElement && !consoleReducedMotionActive() && typeof el.animate === 'function' ?
        [el.animate([{opacity: 1}, {opacity: 0}], {duration: motionMs(STAGED_VOTE_RELEASE_MS), easing: 'ease-out', fill: 'forwards'})] : []);
    await Promise.all(fades.map((fade) => fade.finished.catch(() => undefined)));
    // THE COMPOSER GOES BEFORE THE SCENE'S OWN FINISH. To a composer still
    // mounted the scene ending with no outcome reads as a REFUSAL, and its
    // setup re-materializes — for a frame, under the vote it just handed the
    // screen to. Unmounted first, there is nobody left to roll back. (The
    // store is reactive — it holds a PROXY of `arm`, so «still ours» is asked
    // by what the arm is, never by identity; B cannot have fired — the
    // transaction absorbed input — but a world move may have voided the
    // staged preview meanwhile.)
    if (stagedHostedTarget() && stagedPlayState.arm?.cardName === arm.cardName &&
        shell.pendingPlayCard?.cardName === arm.cardName) {
      shell.pendingPlayCard = undefined;
      await shell.$nextTick();
    } else {
      // The door closed under the release (the staged preview was voided and
      // `cancelStagedPlay` handed the screen back): the composer stays, so it
      // may not stay faded — and its verbs read on the bar again.
      fades.forEach((fade) => fade.cancel());
      restoreConsolePlayCardCommands();
    }
    void finishStagedPlayedLanding();
  }

  /**
   * THE HOSTED WALK — «КАРЬЕРА» (Turmoil Redux TR04). An ORDINARY play's
   * answer carried the marker's walk; the landing scene has told its story;
   * the Parliament is pushed INTO the hand's own zone as a SHOW step (no
   * question, no serve — an `always` anchor: it leaves by its own hand) and
   * its section opens the walk pose off the owed record. RELEASE as the
   * staged vote's (law 22): the landing scene and the landed card's proxy
   * let go IN PLACE while the Parliament rises out of the same rect; the
   * composer is unmounted once the fade is done. The frame is a BEAT
   * (`executing`) — input is absorbed for the walk's length, a second A is
   * impossible by construction, and B is not offered (a hidden section
   * cannot measure its rows, and «honestly late» would be worse than three
   * seconds of waiting). The flow ends by its own hand:
   * `onParliamentFlowComplete('walk')` takes the step and the hand down as
   * ONE surface. An outcome, never a door: nothing here is submitted.
   */
  /** The hosted step's frame already stands on the hand (entered from the commit, or the late road) — never twice. */
  /**
   * THE PLAY'S LIVE GRANT IS DUE IN THE HAND (P72 · CZ): the answer to THIS play asks the vote (a grant given by the
   * card the hand is playing), the hand's descent stands, no Parliament is up yet and the flow is not aside for the
   * board (T03 comes back to it over the quiet board — `resumeStackFromBoardAndSettle`).
   */
  function liveGrantStepDue(): boolean {
    const card = shell.pendingPlayCard?.cardName;
    return card !== undefined && cardGrantOwedTo(shell.playerView.waitingFor, [card]) && workspaceFrameDescended('hand') &&
      !workspaceFrameKnown('parliament') && !stackYieldedToBoard();
  }

  /** The vote step a play's live grant pushed into the hand stands (P72 · CZ) — its own completion ends the play. */
  function liveGrantStepEntered(): boolean {
    return workspaceFrameHost('parliament') === 'hand' && workspaceFrameAnchor('parliament')?.type === 'prompt' &&
      shell.playerView.waitingFor?.votePrompt?.source === 'grant';
  }

  /**
   * THE PLAY'S LIVE GRANT RISES FROM THE COMMIT (P72 · CZ — the PL-120 entrance, generalized): the frame the task
   * router would push once the landing's read were over is pushed NOW, as the card docks — the same frame (stage,
   * phase, serves, prompt anchor: the router then finds it standing and does nothing), the composer and the proxy
   * letting go in place under it. Warmed by the composer's declaration (PL-127), the section is UNVEILED, not mounted.
   */
  async function enterLiveGrantStep(): Promise<void> {
    if (!liveGrantStepDue()) {
      return;
    }
    const wf = shell.playerView.waitingFor;
    consoleState.task.deferred = false;
    setWorkspaceFramePhase('hand', 'committed');
    pushWorkspaceFrame({
      kind: 'parliament', subject: '', stage: followUpStepStage('party', wf) ?? DELEGATE_GRANT_STEP_STAGE, phase: 'committed',
      serves: ['party'], anchor: {type: 'prompt', promptType: 'party'},
    });
    await shell.releasePlayComposerUnderStep();
  }

  function hostedStepEntered(): boolean {
    const stage = workspaceFrameKnown('parliament') ? workspaceFrameStage('parliament') : '';
    return workspaceFrameHost('parliament') === 'hand' &&
      (stage === AGENDA_WALK_STEP_STAGE || stage === AGENDA_WALK_SEAT_STEP_STAGE || stage === NEUTRAL_RALLY_STEP_STAGE);
  }

  /**
   * A PARLIAMENT STEP HOSTED BY «ДЕЙСТВИЯ КАРТ» IS OVER (TR15 — the staged action vote's cube has landed, its
   * answer is parked, or a live door it became has been answered), and with it the ACTION it was a step of. A
   * finished action LEAVES — the one guarded conclusion takes the whole stack, never a fold back to the
   * composer it was confirmed in. When the conclusion takes the workspace, the two leave as ONE surface: the
   * Parliament rides the workspace's own dissolve (`cardActionsLeaveHook`), its release handed to the end of
   * it. When the conclusion HOLDS (something of the action is still owed), the step lets go in place and the
   * owed conclusion re-fires when the hold falls.
   */
  function endCardActionsWithHostedStep(): void {
    // The commit beat's plan belongs to this action; no awaiting handoff will consume it.
    releaseActionCommit();
    const top = workspaceStackTop();
    // (…or a COLONY step — a card played through a law, RX36, whose door was its colony.)
    if (top !== undefined && (top.kind === 'parliament' || top.kind === 'colonies') && workspaceFrameHost(top.kind) === 'card-actions') {
      popWorkspaceFrame();
    }
    // A law's play (RX36) keeps nothing past its end — the landing, the composed play. Idempotent for an action's.
    endLawPlayLanding();
    clearLawPlayDraft();
    concludeWorkspaceFlowOrOwe('card-actions');
    shell.cardActionsDissolveArmed = !workspaceFrameKnown('card-actions');
    // The hook consumes the flag inside the flush that drops the workspace; a flush that never called it may not
    // leave the flag — or the step's handed-over release — behind.
    void shell.$nextTick(() => {
      if (shell.cardActionsDissolveArmed) {
        shell.cardActionsDissolveArmed = false;
        shell.parliamentLeaveRelease?.();
      }
    });
  }

  /**
   * A PARLIAMENT STEP HOSTED BY THE HAND IS OVER, and with it the play it was
   * a step of. The step pops, the play's one guarded ending is asked — and
   * when that ending takes the hand too (nothing of the play is still owed),
   * the two leave as ONE surface: the hand's dissolve is armed and the hosted
   * Parliament rides it (`handLeaveHook`). When the hand is HELD (the play
   * drew cards, a triggered effect asks) nothing is armed: the step lets go
   * in place, inside the zone the outcome is arriving into.
   */
  function endHandWithHostedStep(colonyPick?: ConsoleColonyPick): void {
    // The hosted STEP (the Parliament's vote / walk, the staged colony's grid) pops first — it is the top frame.
    const top = workspaceStackTop();
    const hosted = top !== undefined && (top.kind === 'parliament' || top.kind === 'colonies') &&
      workspaceFrameHost(top.kind) === 'hand' ? top.kind : undefined;
    if (hosted === 'colonies') {
      // LATCHED before the pop: the zone and the pick the step stood on (see `coloniesLeaving`) — the pick as the
      // caller read it BEFORE clearing the store it lives in, when it did.
      shell.colonyEmbedLatch = shell.colonyEmbedTarget ?? '';
      shell.colonyPickLatch = colonyPick ?? shell.colonyPick;
    }
    if (hosted !== undefined) {
      popWorkspaceFrame();
    }
    shell.endPlayCardFlow();
    shell.handDissolveArmed = !workspaceFrameKnown('hand');
    if (hosted === 'colonies') {
      if (shell.handDissolveArmed && shell.colonyEmbedLatch !== '') {
        // The hand leaves: the colonies ride its dissolve, mounted in its zone, released by its own leave.
        shell.coloniesLeaving = true;
        window.clearTimeout(shell.coloniesLeaveNet);
        shell.coloniesLeaveNet = window.setTimeout(() => shell.releaseColoniesLeave(), PARLIAMENT_LEAVE_NET_MS);
      } else {
        // The hand HOLDS (the play still owes something): the step lets go in place.
        shell.colonyEmbedLatch = '';
        shell.colonyPickLatch = undefined;
        closeColonyFocus();
      }
    }
    // The hook consumes the flag inside the flush that drops the section; a
    // flush that never called it (no section stood) may not leave the flag —
    // or the step's handed-over release — behind.
    void shell.$nextTick(() => {
      if (shell.handDissolveArmed) {
        shell.handDissolveArmed = false;
        shell.parliamentLeaveRelease?.();
        shell.releaseColoniesLeave();
      }
    });
  }

  /** The ACTION COMMIT settled — run the dismiss it was holding back. */
  function whenCommitHoldingChanges(now: boolean, was: boolean): void {
    if (was && !now && pendingCommitDismiss.value !== undefined) {
      const run = pendingCommitDismiss.value;
      pendingCommitDismiss.value = undefined;
      run();
    }
  }

  /**
   * THE ADOPTION NET APPLIES ITSELF. POST-flush on purpose: the decision can
   * only become non-'none' when the stack / claim / batch state settles, and
   * the application (a claim write, a re-home, a release) must land after the
   * frame that raised it has rendered — the presentation hold
   * (`outcomeAdoptionPending`) covers exactly this one-flush gap. Applying is
   * idempotent: the write makes the decision resolve back to 'none'.
   */
  function whenOutcomeAdoptionDecisionChanges(decision: OutcomeAdoptionDecision): void {
    if (decision.kind === 'none') {
      return;
    }
    // ONE SETTLED FLUSH OF AGREEMENT before anything destructive. The
    // decision reads the stack mid-transition, and a one-flush
    // `workspaceFrameKnown` gap (a frame popped and re-pushed inside one
    // navigation, a park racing a truncation, the immediate first call
    // running before the restore paths) must never move or kill a live
    // claim. The presentation hold (`outcomeAdoptionPending`) rides the
    // computed, so the batch stays held through the confirm tick — never
    // the standalone band for a frame and an embedded stage the next.
    void shell.$nextTick(() => {
      const confirmed = outcomeAdoptionDecision.value;
      if (sameAdoptionDecision(confirmed, decision)) {
        applyOutcomeAdoption(confirmed);
      }
    });
  }

  /**
   * THE DEFERRED CLOSING RELEASE (see `colonyResolutionReleaseOwed`). The
   * funnel refused the resolution-end release while its evidence still
   * stood; the evidence falling is exactly the moment the refusal's reason
   * is gone, so the owed release executes HERE — re-checked against the
   * live state (the resolution may have legitimately risen again, another
   * flow may have claimed) so a stale intent can never release a claim
   * that has moved on.
   */
  function whenWorkspaceOutcomeServingNowChanges(serving: boolean): void {
    if (serving || !shell.colonyResolutionReleaseOwed) {
      return;
    }
    shell.colonyResolutionReleaseOwed = false;
    if (workspaceOutcomeState.host === 'colonies' && !shell.colonyResolutionLive) {
      releaseWorkspaceOutcome('resolution-end-deferred');
    }
  }

  /** WATCH `hostedStepDeclaredCard` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenHostedStepDeclaredCardChanges(card: string): void {
    window.clearTimeout(shell.parliamentWarmTimer);
    shell.parliamentWarmTimer = undefined;
    if (card === '') {
      shell.parliamentWarmArmed = false;
      return;
    }
    shell.parliamentWarmTimer = window.setTimeout(() => {
      shell.parliamentWarmTimer = undefined;
      shell.parliamentWarmArmed = hostedStepDeclaredCard.value === card;
    }, motionMs(PARLIAMENT_WARM_SETTLE_MS));
  }

  /** Publish the answer the moment it exists — the beat flips its card on it. */
  function whenWorkspaceOutcomeAnswerArrivedChanges(arrived: boolean): void {
    if (arrived) {
      markWorkspaceOutcomeAnswerIn();
    }
  }

  /**
   * THE PLAY'S OUTCOME IS OVER (every card taken, the pick answered — or the
   * claim turned out to host nothing at all): re-ask the play's ending, which
   * held for exactly this while the cards were on screen.
   *
   * Deferred by a tick: the take releases the claim in the same frame the
   * card detaches onto the flight layer, and the ending must land AFTER that
   * patch — the intake then measures a dock the folding workspace has already
   * uncovered. While the hero scene is still running there is nothing to
   * re-ask (its own closing beat owns the ending).
   */
  function whenHandOutcomeLiveChanges(live: boolean, was: boolean): void {
    if (live || !was || isPlayedHeroActive()) {
      return;
    }
    void shell.$nextTick(() => {
      if (!handOutcomeLive.value && !isPlayedHeroActive()) {
        shell.endPlayCardFlow();
      }
    });
  }

  /** WATCH `workspaceOutcomeEmbedded` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenWorkspaceOutcomeEmbeddedChanges(embedded: boolean, was: boolean): void {
    if (embedded) {
      markWorkspaceOutcomePresenting();
      // THE HANDOFF, for a CARD PLAY: its landing scene («Разыграно») held
      // the stage while the drawn cards were still coming off the deck — one
      // surface stays until the next one is actually there, never a blank
      // frame in between. The composer that carried it lets go on the
      // TABLEAU'S OWN schedule (`playComposerReleasable` below), so what is
      // being relieved dissolves instead of being cut out from under itself.
      if (workspaceOutcomeState.host === 'hand' && !isPlayedHeroActive()) {
        // …and the frame stops being a BEAT and becomes a decision about the
        // move's result: `executing` absorbs input by design (a double submit
        // must be impossible while the server has the move), which is exactly
        // wrong once the cards are on screen waiting to be taken.
        //
        // …unless what arrived is a VERDICT, which is not a decision at all:
        // nothing is chosen, owed or continued after it, so the phase is
        // TERMINAL and B is not on offer (consoleWorkspaceFlow 'verdict').
        if (workspaceFramePhase('hand') === 'executing') {
          setWorkspaceFramePhase('hand', shell.revealOverlayMode === 'result' ? 'verdict' : 'committed');
        }
      }
      return;
    }
    if (!was) {
      return;
    }
    // A COLONY RESOLUTION between two of its legs (the batch was collected,
    // the mandatory discard / the next bonus cycle / the track reset is still
    // owed): the claim is the flow's ownership and stays — its release
    // belongs to the resolution's own falling edge, never to one leg's end.
    if (workspaceOutcomeState.host === 'colonies' && shell.colonyResolutionLive) {
      return;
    }
    // …and a HYDRO TRAVERSAL between two of its stops is the same shape:
    // the deck pick's answer is IN FLIGHT (its embedded surface fell on the
    // submit), the leg plan still stands, and the drained batch tail's own
    // artifacts — a repeated action's draw — arrive on that very response.
    // Released in that window, the claim was gone by the time the batch
    // landed and the full-bleed band rose over the track (the e2e's exact
    // catch). The claim is the CHAIN's ownership; the flow's own completion
    // (finalize / abort) is what ends it.
    if (workspaceOutcomeState.host === 'hydro' &&
        (hydroTraversalPending() || isHydroMarkerActive())) {
      return;
    }
    // …and «FELL» IS NOT «BEING ANSWERED ELSEWHERE IN THIS SAME WORKSPACE».
    // The optional effect a play triggered hands the screen to the workspace's
    // OWN shelf for its discard: the decision surface unmounts by design (the
    // hand IS the picker) and the discard cinematic then holds every task
    // surface closed for its whole length, so the zone is empty for both. The
    // prompt is still ours and still unanswered — read off the RAW prompt, so
    // no admission gate can make «held» look like «gone». Without this the
    // claim was released mid-pick, the flow concluded under the player, and
    // the card their discard bought arrived over an empty board.
    //
    // GENERALIZED to every prompt the claim serves (`workspaceOutcomePromptServed`
    // — the pick, the payment, the effect, the unacked verdict): «the zone is
    // empty this flush» is a rendering fact, «the server is still asking us»
    // is the ownership fact, and only the second one may end a claim.
    if (workspaceOutcomePromptServed.value) {
      return;
    }
    void shell.$nextTick(() => {
      // COLLAPSED is not FINISHED. Deferring the prompt unmounts its host, so
      // the embed goes false — but the decision is still outstanding and the
      // player is coming back to it. Releasing here would drop the claim,
      // fold the workspace, and hand the prompt back to a standalone band the
      // moment it was restored: the collapse would silently become a close.
      //
      // MY host, not «somebody is parked». The claim names its own host, and
      // the global flag answered for whoever happened to be minimized: a park
      // belonging to another flow skipped this release forever — and
      // `markWorkspaceOutcomePresenting` has already disarmed the 20 s
      // backstop, so the orphaned claim then suppresses the standalone
      // presenter and the drawn cards show NOWHERE.
      const host = workspaceOutcomeState.host;
      if (host !== undefined && workspaceFrameParked(host)) {
        return;
      }
      // …AND «FELL» IS NOT «STILL COMING». A drawn batch legitimately has
      // no embedded surface for the whole DEAL: the reveal is withheld
      // while the cards are physically coming off the deck
      // (`rawDrawnRevealPending` is false by design while `deckDrawHolds`),
      // so the teleport target disappears mid-flight and comes back when
      // the reveal assembles. Releasing in that window drops the claim of a
      // batch that is on its way — and the batch then arrives with nobody
      // to host it, opening a full-bleed modal over the still-standing
      // workspace (Celestic's first action: the deck deals for ~8 s).
      // The server's own unconsumed reveal is the authoritative «it is
      // coming», available long before the client can render it.
      if (deckDrawHolds() || shell.rawDrawnRevealPending ||
          shell.playerView.cardDrawReveals.length > 0) {
        return;
      }
      // …nor while the play still owes its «where?» after its draw (TRP9, PL-1117): between the reveal leaving and
      // the pick's admission (the task host is gated by the take's own holds) nothing is embedded for a beat, and that
      // beat is not «fell».
      if (isPlayOutcomeHost(workspaceOutcomeState.host) && playOwesTargetPick(shell.playerView.waitingFor)) {
        return;
      }
      if (!workspaceOutcomeEmbedded.value && workspaceOutcomeState.stage === 'presenting') {
        releaseWorkspaceOutcome('embed-fell');
      }
    });
  }

  /**
   * WATCH `owedConclusionFacts` — the facts of an owed conclusion moved: every debt whose facts differ from the ones it
   * was last refused with is asked again (`workspaceConclusionOwe.ts`).
   */
  function whenOwedConclusionFactsChanges(): void {
    reaskMovedConclusions();
  }

  // ── lifecycle ────────────────────────────────────────────────────────────────────────────────────────────────────
  // THE OWED CONCLUSION'S RUN asks THIS controller how an ending is decided and made (`workspaceConclusionOwe.ts`).
  onMounted(() => {
    registerConclusionOwePort({
      facts: conclusionFactsKey,
      reask: reaskConclusion,
      // The cadence stays out of the player's own time: a nested step being answered, a parked flow, a claim serving
      // a prompt or a batch on screen (PL-292 — the heal could only re-ask a held conclusion every half second and
      // print a lie into the field log).
      cadenceApplies: (kind) => workspaceFrameKnown(kind) && !workspaceFrameHasNested(kind) && !workspaceFrameParked(kind) &&
        !workspaceOutcomeServingNow.value,
      ghost: (kind) => shell.stuckWorkspaceIsGhost(kind),
      force: (kind, owedForMs) => shell.forceRecoverStuckWorkspace(kind, undefined, owedForMs),
    });
  });
  onBeforeUnmount(() => registerConclusionOwePort(undefined));

  return {
    owedConclusionFacts,
    whenOwedConclusionFactsChanges,
    questionDoorLogged,
    questionDoorServedKind,
    pendingCommitDismiss,
    commitFoldOwed,
    hostedStepDeclaredCard,
    commitHolding,
    workspaceOutcomeEmbedded,
    handOutcomeLive,
    workspaceOutcomeAnswerArrived,
    workspaceOutcomePromptServed,
    workspaceOutcomeBatchServed,
    workspaceOutcomeServingNow,
    outcomeAdoptionDecision,
    outcomeAdoptionPending,
    followUpStepOwed,
    followUpStepStageKey,
    foldWorkspaceAfterResult,
    concludeWorkspaceFlow,
    openHeldFrameQuestionDoor,
    concludeWorkspaceFlowOrOwe,
    reaskConclusion,
    frameServesLiveQuestion,
    frameAnchorIsDead,
    onWorkspaceResultDetached,
    runCommitRewardWave,
    reconcileWorkspaceOutcome,
    enterStagedHostedStep,
    liveGrantStepDue,
    liveGrantStepEntered,
    enterLiveGrantStep,
    hostedStepEntered,
    endCardActionsWithHostedStep,
    endHandWithHostedStep,
    whenCommitHoldingChanges,
    whenOutcomeAdoptionDecisionChanges,
    whenWorkspaceOutcomeServingNowChanges,
    whenHostedStepDeclaredCardChanges,
    whenWorkspaceOutcomeAnswerArrivedChanges,
    whenHandOutcomeLiveChanges,
    whenWorkspaceOutcomeEmbeddedChanges,
  };
}

export type OutcomeController = ReturnType<typeof createOutcomeController>;
