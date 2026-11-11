/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SUPERVISOR — the console's ONE sampler (1 Hz) and what hangs off it: the liveness arbiter's tick and the shell's
 * rungs of its ladder, the wait graph's shell source and its recovery doors, the reapers (a frame of a phase that is
 * over, a stale free-turn frame), the forced recovery of a stuck workspace and the two directors' cures.
 *
 * Taken out of ConsoleShell.vue by scripts/shell-extract.mjs (architecture v2 — docs/claude/console/architecture-v2/
 * PLAN.md §5 · S1). THE PORT BELOW IS THE POINT OF THE SLICE: it is everything the supervisor reads of the shell, as a
 * list — every row is a fact some net samples because no owner ends it (PLAN §6 says which slice makes each row go).
 * The nets shrink by rows of this port; nothing may be added to it.
 */
import {ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {consoleCardActionsUi} from '@/client/console/consoleCardActions';
import {transportDiagFacts, transportState} from '@/client/console/transport/gameTransport';
import {presentationLedgerSnapshot} from '@/client/console/presentationLedger';
import {activeAnimationHoldLabels, AnimationHold, beginAnimationHold, blockingAnimationHoldCount, oldestAnimationHoldAgeMs} from '@/client/components/presentation/animationHold';
import {isTransientBeat, resetBeatStall, transientSurfaceBeats, WORKSPACE_BEAT_STALL_MS} from '@/client/console/workspaceBeatStall';
import {registerWaitRecovery, registerWaitSource, tickWaitGraph, waitGraphDigest, WaitNodeInput} from '@/client/console/waitGraph/waitGraph';
import {WaitTarget} from '@/client/console/waitGraph/waitGraphModel';
import {CONCLUSION_HOLD_EDGE, WAIT_ADMISSION_BOUND_MS} from '@/client/console/waitGraph/waitGraphShellBounds';
import {registerConstructionWaitSources} from '@/client/console/waitGraph/waitGraphSources';
import {observeStillHold, pageMoves, StillHoldState} from '@/client/console/waitGraph/motionWitness';
import {advanceLivenessRung, LIVENESS_STORY_GRACE_MS, LIVENESS_TRANSPORT_GRACE_MS, livenessStateSnapshot, registerLivenessRelease, resetLiveness, runLivenessRung, tickLiveness} from '@/client/console/consoleLiveness';
import {recordFieldHeartbeat} from '@/client/console/fieldRecorder';
import {observeStaleFreeTurn, StaleFreeTurnClock, staleFreeTurnClockInit, staleFreeTurnHeld} from '@/client/console/supervisor/staleFreeTurnClock';
import {inputEchoSnapshot} from '@/client/console/inputEcho';
import {ANIMATION_STALL_GRACE_MS} from '@/client/console/consoleForegroundWatchdog';
import {hostedStepLiveIn, hostedStepOwedTo} from '@/client/console/parliament/hostedParliamentStep';
import {ConsoleRevealMode} from '@/client/components/console/consoleRevealOverlayTypes';
import {closePhaseRoot, closeWorkspaceRoot, deadLiveFrames, pruneOffStageDeadFrames, collapseWorkspaceStack, stackYieldedToBoard, frameServing, goBoardHome, popWorkspaceFrame, workspaceFrameHasNested, workspaceStackTop, workspaceFrameAnchor, workspaceFrameKnown, workspaceFrameAnywhere, workspaceFrameParked, workspaceStackCollapsed, workspaceStackState, workspaceFrameOffStage, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {openFrameQuestionDoor} from '@/client/console/frameQuestionDoor';
import {Phase} from '@/common/Phase';
import {isPlayedHeroActive} from '@/client/console/played/consolePlayedHero';
import {consoleStartState, releaseStartScene} from '@/client/console/consoleStartState';
import {isResourceTransferActive} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {resetConsoleActionComposerUi} from '@/client/console/consoleActionComposerUi';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {ConsoleTask, taskFor} from '@/client/console/consoleTaskRouter';
import {leakDetectorState, runScreenCure} from '@/client/console/consoleLeakDetector';
import {ScreenCurePlan} from '@/client/console/screenDirector';
import {workspaceOutcomeClaimed, workspaceOutcomeBeatPending, claimWorkspaceOutcome, releaseWorkspaceOutcome, workspaceOutcomeState, workspaceOutcomeZone} from '@/client/console/consoleWorkspaceOutcome';
import {colonyBonusPayoutLive} from '@/client/console/colonyLedger/colonyBonusPayout';
import {releaseDiscardExchange} from '@/client/console/cardDiscard/discardExchangeBeat';
import {consoleState, closeConsoleLayers} from '@/client/console/consoleRouter';
import {isSurfaceAwaitingHandoff, surfaceMotionState} from '@/client/console/surfaceMotion/surfaceMotionState';
import {AWAITING_SAFETY_MS} from '@/client/console/surfaceMotion/surfaceMotionModel';
import {conclusionRefusal, handoffPendingEntries, OWED_CONCLUSION_FORCE_MS, OWED_CONCLUSION_GHOST_CONFIRM_MS} from '@/client/console/shell/shellFlowState';
import {promptIdentityKey} from '@/client/console/turnIntents';
import {MandatoryBeat, isMandatoryBeatPresented, forceMandatoryBeacon, isMandatoryBeaconForced, registerAnnounceDoor} from '@/client/console/consoleMandatoryGate';
import {ActualStartOwner, StartOwner, StartShadowFinding, startDirectorCure, startShadowInScope, startShadowVerdict} from '@/client/console/startDirector';
import {AdmissionSignals, PromptSurface, promptAdmissionBlock} from '@/client/console/consolePromptAdmission';
import {stagedPlayState} from '@/client/console/stagedPlay';
import {owedConclusions, reaskOwedConclusion, withdrawConclusionOwe} from '@/client/console/workspaceConclusionOwe';

/** How long an owed commit fold counts as «in flight» for the liveness arbiter (its tokens' 9 s fold ceiling + a beat). */
const COMMIT_FOLD_OWED_GRACE_MS = 12_000;

/** The wait graph's standing frame: the phase it is in and since when (a plain module holder — read only by the 1 Hz source). */
const waitSurfacePhase = {key: '', since: 0};

/** Since when blocking holds stood with NOTHING moving on the page (`motionWitness.ts`) — the graph's `stillMs`; read only by the 1 Hz tick. */
let pageStill: StillHoldState = {since: 0, named: false};

/**
 * THE CONTROL STAND'S DECLARED DEFECT (`?screenControl=1` only — `__conScreenControl.declareDefect(ms)`): until this
 * moment a positive control has taken a question's surface off the screen ON PURPOSE, so the liveness arbiter counts the
 * window as a NAMED thing in flight (`screen-control-defect`) instead of curing it — bounded, never longer than
 * `SCREEN_CONTROL_DEFECT_MAX_MS`. Read only by the 1 Hz liveness tick.
 */
let screenControlDefectUntil = 0;

const SCREEN_CONTROL_DEFECT_MAX_MS = 15_000;

/**
 * A FINISHED FRAME OVER THE FREE TURN LEAVES BY ITSELF after this long with nothing moving (`reapStaleFreeTurnFrame`).
 * Long enough that a player reading a result that asks nothing of them still has it; short enough that a wedged one is
 * a hiccup, not a freeze.
 */
const STALE_FREE_TURN_MS = 8_000;

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type SupervisorPort = {
  $nextTick(fn?: () => void): Promise<void>,
  $refs: Record<string, unknown>,
  readonly admissionSignals: AdmissionSignals,
  commitFoldOwed: boolean,
  concludeWorkspaceFlow(kind: WorkspaceFrameKind, servedPromptHolds?: boolean): boolean,
  readonly consoleRevealMode: ConsoleRevealMode | undefined,
  readonly deckPickActive: boolean,
  drainBoardBeats(): void,
  readonly followUpStepOwed: boolean,
  frameServesLiveQuestion(kind: WorkspaceFrameKind): boolean,
  readonly hostTask: ConsoleTask | undefined,
  readonly lawStepOwed: boolean,
  readonly mandatoryAnnounceVisible: boolean,
  readonly mandatoryBeat: MandatoryBeat | undefined,
  readonly mandatoryChipAttention: boolean,
  readonly mandatoryDeferredActive: boolean,
  readonly mandatoryGateHeld: boolean,
  readonly nativeCompositeTask: ConsoleTask | undefined,
  openShellTaskSurface(task: ConsoleTask): void,
  parliamentLeaving: boolean,
  readonly placementActive: boolean,
  readonly playerView: PlayerViewModel,
  readonly politicalDiscardOwed: boolean,
  readonly politicalPayoutOwed: boolean,
  reconcileWorkspaceOutcome(): void,
  restoreDeferredTask(): void,
  readonly startSceneMounted: boolean,
  readonly startShadowNow: {expected: StartOwner, actual: ActualStartOwner, held: string | undefined, prompt: string},
  /** WRITTEN here. */ startStrandPrompt: number | undefined,
  /** WRITTEN here. */ startStrandYield: boolean,
  readonly taskHeldForWorkspace: boolean,
  readonly taskHostRendered: boolean,
  readonly workspaceOutcomeServingNow: boolean,
  yieldAnnounceInCycle(): string,
};

export function createSupervisorController(shell: SupervisorPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The LIVENESS ARBITER's 1 Hz sampler (`consoleLiveness.ts`; the beat stall guard is one of its witnesses). */
  const beatStallTimer = ref(undefined as number | undefined);
  /** The shell's own rungs of the liveness ladder — unregistered with the shell. */
  const livenessRungStops = ref([] as Array<() => void>);
  /** The stale frame over the free turn whose HOLD was already named (`<kind>|<promptId>`) — one line per standing. */
  const staleFreeTurnKey = ref('');
  /** The reaper's own quiet clock (`staleFreeTurnClock.ts`) — never the arbiter's one-tick-old progress stamp alone. */
  let staleFreeTurnClock: StaleFreeTurnClock = staleFreeTurnClockInit(Date.now());
  /** The liveness arbiter's last `accepting` (a surface takes input for the live question) — read by the ghost gate. */
  const lastLivenessAccepting = ref(true);
  /** Consecutive 1 Hz passes a LIVE frame of a phase that is over has stood with no leave pending (`reapDeadPhaseFrames`). */
  const deadLiveFramePasses = ref(0);
  /** When the owed fold was first seen by the liveness tick (0 = none) — its in-flight credit is bounded. */
  const commitFoldOwedSince = ref(0);

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * IS A FINISHED-BUT-HELD WORKSPACE A GHOST — nothing the player could be
   * acting on stands inside it? The force-teardown's airtight safety gate:
   * every term here is «the player has something genuine to do / see», so
   * their conjunction being FALSE means the workspace is holding on a phantom.
   * The witness's continuous grace guarantees this held for the whole window,
   * never a one-flush blink.
   */
  function stuckWorkspaceIsGhost(kind: WorkspaceFrameKind): boolean {
    return !workspaceFrameHasNested(kind) &&
      !workspaceFrameParked(kind) &&
      // A frame AWAY for the board is waiting for the board, not a phantom — its return re-asks the conclusion.
      !workspaceFrameOffStage(kind) &&
      !shell.workspaceOutcomeServingNow && // no live prompt/batch it serves
      !shell.followUpStepOwed && // no second effect still owed a door
      !(kind === 'hand' && (hostedStepOwedTo('hand') || hostedStepLiveIn('hand'))) && // no walk / rally owed or playing (TR04 / TR31)
      // …and none of the card composer's OWN holds of the guarded conclusion: a party's discard still owed, its payout
      // awaited or held on the rail (its one flyer is this workspace — tearing it down stranded the wave), a colony
      // ledger still paying (TR23), the enacted law's step (RX36). The conclusion holds on each of them by name; a
      // ghost check that forgot one called a working flow a phantom (the Reds' payout, field 2026-10-24 / 25).
      !(kind === 'card-actions' && (shell.politicalDiscardOwed || shell.politicalPayoutOwed || colonyBonusPayoutLive() || shell.lawStepOwed)) &&
      !shell.placementActive &&
      shell.consoleRevealMode === undefined &&
      !currentRevealEvent() &&
      !isPlayedHeroActive() &&
      // …and a frame that SERVES the live question on a screen that ACCEPTS input is the player's place to answer it,
      // never a phantom (wait-graph inventory W1: the force tore down a hand serving the next `projectCard` at 10.5 s).
      !shell.frameServesLiveQuestion(kind);
  }

  /**
   * FORCE a proven-ghost workspace to board home — bypassing the guarded
   * conclusion's holds, because those holds are exactly the phantom keeping
   * it stuck. Releases the host's claim with force, drops the owed intent,
   * and NAMES everything it tore down (the leak-detector discipline: a
   * recovery that heals invisibly would have hidden this bug). This is a NET,
   * not a mechanism — every ordinary ending still routes through
   * `concludeWorkspaceFlow`; this only ever runs after the escalation grace.
   */
  function forceRecoverStuckWorkspace(kind: WorkspaceFrameKind, why?: string, owedForMs = 0): void {
    const refused = conclusionRefusal.last?.kind === kind ? conclusionRefusal.last.reason : 'unknown';
    console.warn(why ?? (
      `[workspace-stall] «${kind}» reported finished but could not dismiss for ` +
      `${Math.round(owedForMs / 1000)}s with nothing served — ` +
      `forcing teardown (held: ${refused})`));
    if (workspaceOutcomeState.host === kind) {
      releaseWorkspaceOutcome('workspace-stall-recovery', {force: true});
    }
    // …and what the torn-down workspace owned on the rail: a party discard's payout its composer will never fly now.
    if (kind === 'card-actions') {
      releaseDiscardExchange(consoleCardActionsUi.draft?.cardName, 'workspace-stall-recovery');
    }
    resetConsoleActionComposerUi();
    withdrawConclusionOwe(kind);
    if (workspaceFrameAnchor(kind)?.type === 'phase') {
      goBoardHome();
    } else {
      closeWorkspaceRoot(kind);
    }
    closeConsoleLayers();
    // The board is watchable again → drain any board-beat park that was
    // waiting behind this very workspace.
    void shell.$nextTick(() => shell.drainBoardBeats());
  }

  /**
   * THE LIVENESS ARBITER's sample (`consoleLiveness.ts`, 1 Hz) — the one invariant: the player can act, or something
   * is provably in flight. Every term is the console's own fact; the beat stall guard's verdict is one of the «not
   * accepting» witnesses, the leak detector's stranded verdict another.
   */
  /**
   * A FINISHED FRAME OVER THE FREE TURN LEAVES BY ITSELF — the automatic, silent half of «the player can always act»
   * (the owner, 2026-11-07: «чтобы для пользователя выглядело как будто зависания нет»). Every field lock of that week
   * had ONE shape: the server asked the player's ordinary turn (the action menu) while the screen stood on a frame PAST
   * its commit that does not serve that turn, with nothing in flight — the sitting's frame returned after its phase,
   * the chairman quest's run wedged in a beat, the unexplained 01:06. Such a frame owes the player nothing the stack
   * can name, so after `STALE_FREE_TURN_MS` with nothing moving it is concluded through the ONE guarded conclusion —
   * which still HOLDS for every named reason (a nested step, a step owed, a live outcome of its own: cards to take, a
   * verdict to read; a prompt it owns; a park; off stage), so a frame that is genuinely waiting for the player stays.
   * Never a frame of a phase (their life is the anchor rule's), never a question other than the free turn (the screen
   * director judges those); the quiet is the reaper's OWN clock (`staleFreeTurnClock.ts` — a new prompt restarts it in the
   * same tick, a hold waits a whole span again). A conclusion here means a flow did not end itself — named
   * (`[workspace-stale] concluded`, red in every e2e spec); a hold is named once too, as evidence.
   */
  function reapStaleFreeTurnFrame(inFlight: ReadonlyArray<string>): void {
    const wf = shell.playerView.waitingFor;
    const top = workspaceStackTop();
    const candidate = wf !== undefined && top !== undefined && taskFor(shell.playerView)?.kind === 'actionMenu' &&
      top.phase === 'committed' && top.anchor.type !== 'phase' && !top.serves.includes('actionMenu') &&
      !workspaceStackCollapsed() && !stackYieldedToBoard() && !shell.placementActive;
    // THE QUIET IS THE REAPER'S OWN CLOCK (`staleFreeTurnClock.ts`): a new question restarts it in this very tick (the
    // arbiter's progress stamp is one tick old here), anything in flight restarts it, and a HELD conclusion waits a
    // whole quiet span again — never «9 s quiet» on the tick the player's take asked the next prompt.
    const now = Date.now();
    const observed = observeStaleFreeTurn(staleFreeTurnClock, {
      now,
      key: candidate && top !== undefined && wf !== undefined ? `${top.kind}|${wf.promptId ?? ''}` : undefined,
      inFlight: inFlight.length > 0,
      progressAt: livenessStateSnapshot().progressAt,
    }, STALE_FREE_TURN_MS);
    staleFreeTurnClock = observed.clock;
    if (!candidate || !observed.due || top === undefined) {
      if (!candidate) {
        staleFreeTurnKey.value = '';
      }
      return;
    }
    const key = observed.clock.key;
    const quiet = Math.round(observed.quietMs / 1000);
    // A CLAIM WITH NOTHING TO PRESENT holds no conclusion (the field export of 2026-11-09: «hand» stood committed over the
    // free turn, held by `live-outcome`): the server asks the action menu, no drawn batch waits, nothing moves — the claim
    // answers for nothing on this screen. It is let go (forced — the funnel would call a claim on its own host serving),
    // and the ONE guarded conclusion is asked again below; a claim with a batch still to take is never touched here.
    if (workspaceOutcomeClaimed() && workspaceOutcomeState.host === top.kind && currentRevealEvent() === undefined) {
      shell.reconcileWorkspaceOutcome();
      if (workspaceOutcomeClaimed() && releaseWorkspaceOutcome('stale-free-turn', {force: true})) {
        console.warn(`[workspace-outcome] the claim of «${top.kind}» answered for nothing over the free turn ${quiet}s — released`);
      }
    }
    if (shell.concludeWorkspaceFlow(top.kind)) {
      console.warn(`[workspace-stale] concluded «${top.kind}» — it stood committed over the free turn ${quiet}s with ` +
        `nothing in flight (frames: ${workspaceStackState.frames.map((f) => f.kind + ':' + f.phase).join(';') || 'none'}); ` +
        'its flow did not end itself');
    } else {
      // HELD by the frame's own reason: the holder ends with its own edge — the next ask is a whole quiet span later
      // (law 3), and the hold is named ONCE per standing (`staleFreeTurnKey`), as evidence.
      staleFreeTurnClock = staleFreeTurnHeld(staleFreeTurnClock, now);
      if (staleFreeTurnKey.value !== key) {
        staleFreeTurnKey.value = key;
        console.warn(`[workspace-stale] «${top.kind}» stands committed over the free turn ${quiet}s with nothing in flight — ` +
          `held: ${conclusionRefusal.last?.kind === top.kind ? conclusionRefusal.last.reason : 'unknown'}`);
      }
    }
  }

  /**
   * THE ANCHOR RULE'S BACKSTOP (1 Hz, beside the arbiter): the off-stage homes are pruned again (a level, never an
   * edge), and a LIVE phase root whose phase is over — past its own leave — is closed by its phase's verb. A phase's
   * own leave keeps its frame for a bounded beat (the sitting's frozen results while the card it owes lands —
   * `handoffPendingEntries`; the section's own dissolve — `parliamentLeaving`), so a live dead frame is closed only
   * after three passes with no such leave pending. A close here means a lifecycle edge was missed: it is named.
   */
  function reapDeadPhaseFrames(): void {
    pruneOffStageDeadFrames();
    const dead = deadLiveFrames();
    if (dead.length === 0 || handoffPendingEntries.size > 0 || shell.parliamentLeaving) {
      deadLiveFramePasses.value = 0;
      return;
    }
    deadLiveFramePasses.value++;
    if (deadLiveFramePasses.value < 3) {
      return;
    }
    deadLiveFramePasses.value = 0;
    for (const kind of dead) {
      closePhaseRoot(kind);
    }
    closeConsoleLayers();
    console.warn(`[workspace-anchor] reaped a live frame of a phase that is over: ${dead.join(', ')} — ` +
      `asked: ${shell.playerView.waitingFor?.type ?? 'none'}; a lifecycle edge was missed`);
  }

  /**
   * THE SUPERVISOR STARTS WITH THE SHELL'S MOUNT (called from `mounted`, in the row it always stood in): the rungs
   * and the wait graph's sources are registered, and the one 1 Hz sampler of the console begins.
   */
  function startSupervisor(): void {
    registerLivenessRungs();
    beatStallTimer.value = window.setInterval(() => checkLiveness(), 1000);
  }

  /** …and ends with it: the sampler, every registration, the arbiter's and the beat guard's own state. */
  function stopSupervisor(): void {
    window.clearInterval(beatStallTimer.value);
    for (const stop of livenessRungStops.value) {
      stop();
    }
    livenessRungStops.value = [];
    resetBeatStall();
    resetLiveness();
  }

  /** The control stand declares a defect it put in on purpose (`__conScreenControl.declareDefect`): named, bounded; `0` ends it. */
  function declareScreenControlDefect(ms: number): void {
    screenControlDefectUntil = ms <= 0 ? 0 : Date.now() + Math.min(ms, SCREEN_CONTROL_DEFECT_MAX_MS);
  }

  function checkLiveness(): void {
    reapDeadPhaseFrames();
    const wf = shell.playerView.waitingFor;
    const beat = judgedTransientBeat();
    const inFlight: Array<string> = [];
    const transport = transportDiagFacts();
    if (transport?.requestInProgress === true) {
      // A request on the wire, or an answer whose gates still play — young; an old one is the transport rung's.
      const age = Date.now() - transportState.requestSince;
      if (!transportState.responseArrived || age < LIVENESS_TRANSPORT_GRACE_MS) {
        inFlight.push(`transport@${Math.round(age / 1000)}s`);
      }
    }
    if (surfaceMotionState.awaiting !== undefined && Date.now() - surfaceMotionState.awaiting.startedAt < AWAITING_SAFETY_MS + 500) {
      inFlight.push(`awaiting:${surfaceMotionState.awaiting.from}`);
    }
    // An owed fold is in flight only within its bound (wait-graph inventory R10): a fold that never runs must not hide a
    // stall from the arbiter until the next commit.
    if (shell.commitFoldOwed) {
      if (commitFoldOwedSince.value === 0) {
        commitFoldOwedSince.value = Date.now();
      }
      if (Date.now() - commitFoldOwedSince.value < COMMIT_FOLD_OWED_GRACE_MS) {
        inFlight.push('commit-fold-owed');
      }
    } else {
      commitFoldOwedSince.value = 0;
    }
    if (blockingAnimationHoldCount() > 0 && oldestAnimationHoldAgeMs() < ANIMATION_STALL_GRACE_MS) {
      inFlight.push(...activeAnimationHoldLabels().filter((l) => l.endsWith('[blocking]')));
    }
    // THE MOTION WITNESS (shadow): a blocking hold claims a story is playing — is anything on the page moving at all?
    // A hold that stood STILL is named once; the arbiter still counts it in flight until it is measured (`motionWitness.ts`).
    // Asked ONLY while a blocking hold stands (the one wait it judges): `getAnimations()` forces a style recalc, never
    // paid on a screen with nothing to judge.
    const blockingHeld = blockingAnimationHoldCount() > 0;
    const pageMoving = !blockingHeld || transport?.requestInProgress === true || pageMoves();
    const page = observeStillHold(pageStill, Date.now(), blockingHeld, pageMoving);
    pageStill = page.state;
    if (page.cross) {
      console.warn(`[liveness] still hold — ${activeAnimationHoldLabels().filter((l) => l.endsWith('[blocking]')).join(', ')} ` +
        `stand ${Math.round(page.stillMs / 1000)}s with nothing moving on the page — the wait graph judges them (dead end → hold-expire)`);
    }
    if (isResourceTransferActive()) {
      inFlight.push('resource-transfer');
    }
    if (Date.now() < screenControlDefectUntil) {
      inFlight.push('screen-control-defect');
    }
    for (const story of presentationLedgerSnapshot().stories) {
      if (story.ageMs < LIVENESS_STORY_GRACE_MS) {
        inFlight.push(`story:${story.id}`);
      }
    }
    reapStaleFreeTurnFrame(inFlight);
    const dom = (s: string) => document.querySelectorAll(s).length;
    const focused = document.querySelector('[class*="--focused"]');
    const signature = [
      wf === undefined ? 'none' : `${promptIdentityKey(wf)}#${wf.promptId ?? ''}`,
      workspaceStackState.frames.map((f) => f.kind + ':' + f.phase).join(';'),
      `${consoleState.section}/${consoleState.sheet ?? ''}`,
      [dom('.con-ws'), dom('.con-hand'), dom('.con-reveal'), dom('.con-task'), dom('.con-mandatory'), dom('.con-deckdraw'), dom('.con-zoom'), dom('.con-journal'), dom('.con-sys')].join(','),
      (document.querySelector('.con-cmdbar, .con-bar, [data-command-bar]')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
      focused === null ? '' : `${focused.className.toString().slice(0, 40)}:${(focused.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)}`,
      String(transport?.requestInProgress ?? false),
    ].join('|');
    // …and a screen standing on a frame of a phase that is OVER serves nothing, whatever its own handlers take (the
    // Parliament field lock of 2026-11-06 read `accepting: true` for three minutes over the next action menu).
    // (A phase's own bounded leave — the sitting's frozen results while its card lands, the section's dissolve — is
    // not that state: it is the hand-over the screen director names and bounds.)
    const standsOnDeadFrame = deadLiveFrames().length > 0 && handoffPendingEntries.size === 0 && !shell.parliamentLeaving;
    const accepting = beat === undefined && leakDetectorState.stranded === undefined && !isSurfaceAwaitingHandoff() &&
      !standsOnDeadFrame;
    // THE FIELD FLIGHT RECORDER's heartbeat (phase 2): what the arbiter sees, once a second, kept across a reload.
    recordFieldHeartbeat({
      prompt: wf === undefined ? '' : `${promptIdentityKey(wf)}#${wf.promptId ?? ''}`,
      accepting, inFlight,
      frames: workspaceStackState.frames.map((f) => `${f.kind}:${f.phase}`),
      section: `${consoleState.section}/${consoleState.sheet ?? ''}`,
      quietS: Math.round((Date.now() - livenessStateSnapshot().progressAt) / 1000),
      presses: livenessStateSnapshot().pressesSinceProgress,
      // What a wait waits FOR, and what the opening says it serves — the two facts the 2026-11-01 13:50 freeze lacked.
      block: wf === undefined ? '' : promptAdmissionBlock(wf.type === 'space' ? 'placement' : 'host', shell.admissionSignals) ?? '',
      start: shell.startSceneMounted ? consoleStartState.serves ?? '' : '',
      graph: waitGraphDigest(8),
    });
    // THE WAIT GRAPH (Э2 — a shadow): the same second's waits, judged structurally — a cycle, a dangling wait, a dead
    // end, an overdue one — logged `[wait-graph] …` once per confirmed finding; nothing is acted on yet.
    lastLivenessAccepting.value = accepting;
    tickWaitGraph({
      now: Date.now(), accepting,
      requestInFlight: transport?.requestInProgress === true,
      serverOwes: wf === undefined && shell.playerView.game.phase !== Phase.END,
      motionInFlight: inFlight.length > 0,
      // …and how long nothing has moved on the page: a blocking hold claiming a story while nothing plays is a dead end.
      stillMs: page.stillMs,
    });
    const verdict = tickLiveness({
      now: Date.now(),
      promptLive: wf !== undefined && wf.optional !== true,
      accepting,
      inFlight,
      // A / B on any device — an optional verb with nothing to do is an honest no-op, never a wedge; an accepting
      // screen is judged only by the A / B nobody took.
      presses: inputEchoSnapshot().verbPresses,
      dropped: inputEchoSnapshot().verbDropped,
      // …and a B a handler TOOK on a frame past its commit, the server asking the player and nothing in flight: B
      // collapses such a frame by contract (`backVerbFor('committed')`), so a taken B that moved nothing is a handler
      // swallowing the verb over a wedged flow (the chairman quest's leaked beat, the owner's field lock of 2026-11-07).
      backTaken: inputEchoSnapshot().backTaken,
      backJudged: backOwedOnStandingFrame(),
      // …and a transient beat owes its end even when nobody is asked (the two-campaign rally, ledger HC).
      beatOwed: beat !== undefined,
      stranded: leakDetectorState.stranded !== undefined,
      signature,
    });
    if (!verdict.stalled) {
      // The stall's END is evidence too: the field export reads the time-to-cure, not only that a cure ran.
      if (verdict.recovered !== undefined) {
        console.warn(`[liveness] recovered after ${Math.round(verdict.recovered.afterMs / 1000)}s, ${verdict.recovered.rungs} rung(s) run`);
      }
      return;
    }
    if (verdict.rung === undefined) {
      return;
    }
    // A rung with NOTHING to release costs no gap — the next one runs in the same tick, so the first rung that acts acts
    // at once (the Hi-Tech Lab field freeze: three empty rungs cost 6 s before the claim's own release was reached).
    let rungIndex = verdict.rung;
    const empties: Array<string> = [];
    let did = runLivenessRung(rungIndex);
    while (did !== undefined && did.endsWith('nothing to release')) {
      empties.push(did);
      rungIndex++;
      did = runLivenessRung(rungIndex);
    }
    if (rungIndex !== verdict.rung) {
      advanceLivenessRung(rungIndex + 1);
    }
    if (empties.length > 0) {
      did = did === undefined ? `${empties.join(' · ')} — the ladder is spent` : `${empties.join(' · ')} · ${did}`;
    }
    // …and the claim's own GATES (CI 2026-11-09, P88's max-0 purchase: «claim … awaiting, holds: none» named no cause):
    // the zone it publishes (and whether that node stands), the beat, the arrival — and what the host prompt did with it.
    const claim = workspaceOutcomeState.sourceCard === '' ? 'none' :
      `${workspaceOutcomeState.host}/${workspaceOutcomeState.sourceCard} [${workspaceOutcomeState.kinds.join(',')}] ${workspaceOutcomeState.stage}` +
      ` (zone ${workspaceOutcomeState.embedSlot === '' ? '-' : workspaceOutcomeZone() === '' ? 'unmounted' : 'up'}` +
      `, beat ${workspaceOutcomeBeatPending() ? 'pending' : 'done'}, arrival ${workspaceOutcomeState.arrivalDone ? 'done' : 'pending'}` +
      `, task ${shell.hostTask?.kind ?? (shell.nativeCompositeTask?.kind ?? '-')}${shell.taskHeldForWorkspace ? ' held' : ''}` +
      `${shell.taskHostRendered ? ' rendered' : ''}${shell.deckPickActive ? ' deckpick' : ''})`;
    console.warn(`[liveness] stall (${verdict.reason}): ${Math.round(verdict.quietMs / 1000)}s without progress, ${verdict.presses} presses; ` +
      `asked: ${wf?.type ?? 'none'}; beat: ${beat ?? 'none'}; stranded: ${leakDetectorState.stranded?.inputType ?? 'no'}; ` +
      `last in flight: ${verdict.lastInFlight.join(', ') || 'nothing'}; claim: ${claim}; holds: ${activeAnimationHoldLabels().join(', ') || 'none'} — ` +
      (did === undefined ? 'the ladder is spent' : `rung ${verdict.rung}: ${did}`));
    // NO NOTICE TO THE PLAYER (the owner, 2026-11-07: «чтобы для пользователя выглядело как будто зависания нет»):
    // the screen simply comes back. The line above is the evidence — the field log and every e2e spec read it.
  }

  /**
   * MUST B MOVE SOMETHING RIGHT NOW? The deepest live frame stands PAST ITS COMMIT (`committed` — B collapses it,
   * `backVerbFor`), on screen (no park, no yield, no placement owning the pad), and the server asks the player a
   * question. A `verdict` (B = none) and a transient beat (the pad absorbed by contract) are not judged here.
   */
  function backOwedOnStandingFrame(): boolean {
    const wf = shell.playerView.waitingFor;
    if (wf === undefined || wf.optional === true || workspaceStackCollapsed() || stackYieldedToBoard() || shell.placementActive) {
      return false;
    }
    if (workspaceStackTop()?.phase !== 'committed') {
      return false;
    }
    // A surface of its OWN standing over the frame takes B by its own contract (a reveal is taken with A, the
    // announce plate is answered, the viewer / journal / system menu own the pad): there B may honestly do nothing.
    return document.querySelector('.con-reveal, .con-mandatory, .con-zoom, .con-journal, .con-sys, .con-task, .con-stranded') === null;
  }

  /** The transient beat the arbiter judges (`workspaceBeatStall.ts`): the stack's TOP frame's (`<kind>:<phase>`), or
   *  the surface report of the kind that IS the top frame (card-actions derives its phase inside the component). */
  function judgedTransientBeat(): string | undefined {
    if (workspaceStackCollapsed() || stackYieldedToBoard() || shell.placementActive) {
      return undefined;
    }
    const top = workspaceStackTop();
    if (top === undefined) {
      return undefined;
    }
    if (isTransientBeat(top.phase)) {
      return `${top.kind}:${top.phase}`;
    }
    const reported = transientSurfaceBeats().find(([kind]) => kind === top.kind);
    return reported === undefined ? undefined : `${reported[0]}:${reported[1]}`;
  }

  /**
   * THE SHELL'S OWN RUNGS of the liveness ladder: a stalled transient beat is torn down through the one force path
   * (rank 25 — the beat stall guard's cure, now a rung), and the stack goes HOME as the last resort (rank 30 — the
   * mandatory plate re-announces whatever the server still asks; nothing of the game is lost, only the screen).
   */
  /**
   * THE START DIRECTOR'S CURE (phase 1 — `startDirectorCure`): `heal` runs the scene's own doors (the strand's
   * `healStrand`), and a door that opens nothing yields; `yield` hands the question to the shell's surfaces (the
   * strand's own yield, released on the next prompt). Named in the log under the shadow's prefix (the e2e harness
   * files it with the findings); idempotent — a cure that changes nothing reports nothing.
   */
  /**
   * A STEP OF THE START THAT NOTHING HOSTS ANY MORE (the monkey's wg2 table `field-start-sbp-triton`, 3/3 — inventory
   * R15): the server still asks the step's question (Ecology Experts' «play a card from your hand»), the start knows it
   * owes the step, but the step's own frame is gone and no new prompt edge comes to re-open it — a yield alone handed the
   * question to surfaces nobody opened (every liveness rung: «nothing to release»). The cure is the router's OWN door for
   * that question (`openShellTaskSurface` — for a play-from-hand it pushes the hand INTO the start again, the very road
   * the prompt took the first time), never while the player set the question aside (the restore card is their way back).
   */
  function reopenStartStep(): string {
    if (workspaceFrameHasNested('start')) {
      return '';
    }
    return reopenOrphanQuestion();
  }

  /**
   * THE QUESTION GETS ITS SURFACE BACK — the router's own door (`openShellTaskSurface`, the road the prompt took when it
   * arrived), for a live question no frame serves (or only the start's root, which hosts its steps in nested frames),
   * never while the player set it aside (the restore card is theirs) or a staged door owns the screen. Says what now
   * serves it ('' — nothing changed: the caller's net goes on).
   */
  function reopenOrphanQuestion(): string {
    const task = taskFor(shell.playerView);
    if (task === undefined || consoleState.task.deferred || stagedPlayState.arm !== undefined) {
      return '';
    }
    const serving = frameServing(task.kind);
    if (serving !== undefined && serving.kind !== 'start') {
      return '';
    }
    shell.openShellTaskSurface(task);
    const now = frameServing(task.kind);
    return now !== undefined && now.kind !== 'start' ? `reopened the «${task.kind}» question in «${now.kind}»` : '';
  }

  function runStartDirectorCure(finding: Pick<StartShadowFinding, 'kind' | 'expected' | 'actual'>, by: 'shadow' | 'liveness'): string {
    const cure = startDirectorCure(finding);
    if (cure === 'none' || !shell.startSceneMounted) {
      return '';
    }
    const yieldNow = (): string => {
      if (shell.startStrandYield) {
        return '';
      }
      shell.startStrandPrompt = shell.playerView.waitingFor?.promptId;
      shell.startStrandYield = true;
      return 'yielded';
    };
    let did = '';
    if (cure === 'release') {
      const scene = (shell.$refs.startScene ?? undefined) as {releaseByDirector?: () => string} | undefined;
      did = scene?.releaseByDirector?.() ?? '';
      if (did === '') {
        // No scene instance to ask (unmounted under a park) — the lifetime hold itself lets go.
        releaseStartScene();
        did = 'hold-released';
      }
      // A yield left by an earlier cure goes with it: the start is over, nothing is to be handed back.
      shell.startStrandYield = false;
      shell.startStrandPrompt = undefined;
    } else if (cure === 'heal') {
      const scene = (shell.$refs.startScene ?? undefined) as {healStrand?: () => string} | undefined;
      const healed = scene?.healStrand?.() ?? 'no-scene';
      did = healed === 'nothing-to-heal' || healed === 'no-scene' ? [healed, yieldNow()].filter((x) => x !== '').join(' → ') : healed;
    } else if (finding.expected === 'step' && finding.actual === 'none') {
      did = reopenStartStep() || yieldNow();
    } else {
      did = yieldNow();
    }
    if (did === '') {
      return '';
    }
    console.warn(`[start-shadow] cure «${cure}» by ${by} — expected «${finding.expected}», on screen «${finding.actual}»: ${did}`);
    return `${cure}: ${did}`;
  }

  /**
   * THE SCREEN DIRECTOR'S DOORS (step 4, prepared — `planScreenCure`): the detector plans, this executes an ARMED
   * plan through the doors that already stand a prompt up. Nothing is armed by default (`?screenCure=<verb,…>`).
   */
  function runScreenDirectorCure(plan: ScreenCurePlan): string {
    const task = taskFor(shell.playerView);
    if (task === undefined || plan.verb === 'none') {
      return '';
    }
    if (plan.verb === 'restore') {
      shell.restoreDeferredTask();
      return 'the parked chain restored';
    }
    if (plan.verb === 'announce') {
      // The ANNOUNCEMENT made visible — the chip's beacon, the existing reminder. Never the plate's A: the question
      // opens when the player chooses (the screen they stand in done, A on the plate), never over a draw they take.
      const beat = shell.mandatoryBeat;
      if (!shell.mandatoryGateHeld || beat === undefined || isMandatoryBeaconForced(beat)) {
        return '';
      }
      forceMandatoryBeacon(beat.key);
      return `the chip's beacon lit for «${task.kind}»`;
    }
    if (plan.verb === 'open') {
      shell.openShellTaskSurface(task);
      return `the router's door opened for «${task.kind}»`;
    }
    const then = plan.verb === 'yield' ? plan.then : undefined;
    const frames = workspaceStackState.frames.map((fr) => fr.kind).join(',');
    if (plan.door === 'goBoardHome') {
      goBoardHome();
    } else {
      closeConsoleLayers();
    }
    if (then !== undefined) {
      shell.openShellTaskSurface(task);
    }
    return `${plan.door} (was «${frames || 'no frame'}»)${then !== undefined ? ` → the router's door for «${task.kind}»` : ''}`;
  }

  /**
   * THE WAIT GRAPH's SHELL SOURCE (Э2 — a shadow; docs/claude/console/wait-graph.md): the waits the shell owns, read
   * off the state they already live in — the live question, the plate, «set aside», the standing frame, a held or
   * owed conclusion, a claim, the submit funnel, an admission block. Every edge names what the wait waits FOR, so a
   * mutual wait closes a cycle the graph sees the tick it stands (the chairman quest's field lock is
   * question → announce → surface → conclusion → question).
   */
  function shellWaitNodes(): Array<WaitNodeInput> {
    const out: Array<WaitNodeInput> = [];
    const wf = shell.playerView.waitingFor;
    const task = taskFor(shell.playerView);
    const top = workspaceStackTop();
    const signals = shell.admissionSignals;
    const beat = shell.mandatoryBeat;
    const questionId = wf === undefined || wf.optional === true ? undefined : `question:${task?.kind ?? wf.type}#${wf.promptId ?? ''}`;
    const announceId = shell.mandatoryGateHeld && beat !== undefined ? `announce:${beat.key}` : undefined;
    const deferredId = consoleState.task.deferred && wf !== undefined ? `deferred:${wf.promptId ?? ''}` : undefined;
    const owedNow = owedConclusions();
    const admission = (family: PromptSurface): string | undefined => {
      const block = promptAdmissionBlock(family, signals);
      if (block === undefined) {
        return undefined;
      }
      if (block === 'announce-gate') {
        return announceId;
      }
      const id = `admission:${family}:${block}`;
      out.push({
        id, family: 'admission', owner: 'consolePromptAdmission',
        targets: block === 'reveal' ? [{kind: 'player', what: 'take the revealed cards'}] : [{kind: 'motion', what: block}],
        ...(block === 'reveal' ? {} : {boundMs: WAIT_ADMISSION_BOUND_MS[block]}),
        detail: `${family} held by ${block}`,
      });
      return id;
    };
    // THE QUESTION — answered by a press on whatever serves it, or held by what holds it.
    if (questionId !== undefined) {
      const held = announceId ?? deferredId ?? admission(task?.kind === 'space' ? 'placement' : 'host');
      out.push({
        id: questionId, family: 'question', owner: 'server',
        targets: held !== undefined ? [{kind: 'node', id: held}] : [{kind: 'player', what: 'answer the question'}],
        // A question nothing holds is answered on its surface — its door opens that surface (a dead end: nothing accepts).
        ...(held === undefined ? {recovery: 'question-open'} : {}),
        detail: `${wf?.type ?? ''}${task !== undefined ? ` / ${task.kind}` : ''}`,
      });
    }
    // THE PLATE — the player's A on it, while it can be seen; else what hides it.
    if (announceId !== undefined) {
      const targets: Array<WaitTarget> = shell.mandatoryAnnounceVisible ? [{kind: 'player', what: 'A on the plate'}] :
        shell.mandatoryChipAttention ? [{kind: 'player', what: 'the chip\'s beacon → the board home'}] :
          top !== undefined ? [{kind: 'node', id: `surface:${top.kind}`}] :
            [{kind: 'motion', what: 'the first presentation'}];
      out.push({
        // (No bound here: the first presentation's bound is the announce machine's own state — `pending` → `late`.)
        id: announceId, family: 'announce', owner: 'consoleMandatoryGate', targets, recovery: 'announce-serve',
        detail: isMandatoryBeatPresented(beat) ? 'presented' : 'pending',
      });
    }
    // «SET ASIDE» — its way back is the restore card; with no card the wait points at nothing (dangling, A2).
    if (deferredId !== undefined) {
      out.push({
        id: deferredId, family: 'surface', owner: 'shell:deferred',
        targets: shell.mandatoryDeferredActive ? [{kind: 'player', what: 'the restore card'}] : [{kind: 'node', id: 'surface:restore-card'}],
        // No restore card (inventory A2) — the set-aside question has no way back: its door un-defers it and opens its surface.
        ...(shell.mandatoryDeferredActive ? {} : {recovery: 'deferred-restore'}),
      });
    }
    // THE STANDING FRAME — past its commit it waits for its ending, a transient beat for its motion; a reversible
    // frame (browse / configure) is the player's own time. EVERY top frame is a node: a plate or a nested step that
    // waits for «the frame to leave» points at a frame that IS there (the field export of 2026-11-08 read five false
    // `dangling … surface:card-actions — not there` while the player browsed «Действия карт» over a pending plate).
    if (top !== undefined) {
      const reversible = !isTransientBeat(top.phase) && top.phase !== 'committed';
      const targets: Array<WaitTarget> = owedNow.some((o) => o.kind === top.kind) ? [{kind: 'node', id: `conclusion:${top.kind}`}] :
        isTransientBeat(top.phase) ? [{kind: 'motion', what: `${top.kind}:${top.phase}`}] :
          questionId !== undefined && task !== undefined && frameServing(task.kind)?.kind === top.kind ? [{kind: 'node', id: questionId}] :
            reversible ? [{kind: 'player', what: 'the player browses — B leaves'}] :
              [{kind: 'player', what: 'B collapses / A continues'}];
      // The node's age is the age of THIS PHASE of the frame, never of the frame (a hand that stood `committed` and then
      // `executing` read 47 s of a 12 s beat — the monkey's wg2 `stratospheric-expedition-sole`): its id stays the frame's
      // (the plate and the conclusion point at it), its `since` is re-stamped at every phase change.
      const phaseKey = `${top.kind}:${top.phase}`;
      if (waitSurfacePhase.key !== phaseKey) {
        waitSurfacePhase.key = phaseKey;
        waitSurfacePhase.since = Date.now();
      }
      out.push({
        id: `surface:${top.kind}`, family: 'surface', owner: `workspace:${top.kind}`, targets, since: waitSurfacePhase.since,
        ...(isTransientBeat(top.phase) && !owedNow.some((o) => o.kind === top.kind) ? {boundMs: WORKSPACE_BEAT_STALL_MS} : {}),
        detail: top.phase,
      });
    }
    // A HELD / OWED CONCLUSION — by the reason it held on. One node per frame that owes (a debt is the frame's own
    // run now — `workspaceConclusionOwe.ts`; two workspaces owe independently).
    for (const owed of owedNow) {
      const reason = conclusionRefusal.last?.kind === owed.kind ? conclusionRefusal.last.reason : 'unknown';
      const claimed = workspaceOutcomeState.host === owed.kind && workspaceOutcomeClaimed();
      // The edge by the hold's REASON — one typed table (`CONCLUSION_HOLD_EDGE`, exhaustive: a new reason names its edge).
      const edge = (CONCLUSION_HOLD_EDGE as Partial<Record<string, string>>)[reason] ?? 'motion';
      const followUp = edge === 'follow-up' ? admission('followUp') : undefined;
      const targets: Array<WaitTarget> =
        edge === 'question' ? [{kind: 'node', id: questionId ?? 'question:none'}] :
          edge === 'nested' && top !== undefined && top.kind !== owed.kind ? [{kind: 'node', id: `surface:${top.kind}`}] :
            edge === 'claim' && claimed ? [{kind: 'node', id: `claim:${owed.kind}`}] :
              edge === 'follow-up' ? [followUp !== undefined ? {kind: 'node', id: followUp} : {kind: 'server', what: 'the follow-up step'}] :
                edge === 'player' ? [{kind: 'player', what: 'restore the parked flow'}] :
                  [{kind: 'motion', what: `held: ${reason}`}];
      out.push({
        id: `conclusion:${owed.kind}`, family: 'conclusion', owner: `workspace:${owed.kind}`, targets,
        since: owed.since,
        // A conclusion that DELEGATES its wait (a nested step, its claim, the question, the player's restore of a parked
        // flow) carries no clock of its own — the node it waits on does; only a motion edge is the conclusion's own
        // escalation. Bounded throughout, it read `overdue` behind a nested step the player was answering and behind a
        // minimized start nobody had restored yet (the monkey's wg2 pass: `red-lawyers-tr-first`, `pluto-settlements-2`).
        ...(targets[0]?.kind === 'motion' ? {boundMs: OWED_CONCLUSION_FORCE_MS + OWED_CONCLUSION_GHOST_CONFIRM_MS} : {}),
        recovery: 'workspace-conclusion', detail: reason,
      });
    }
    // A CLAIM — awaiting its answer (bounded by its safety), or presenting its outcome to the player.
    if (workspaceOutcomeClaimed()) {
      const awaiting = workspaceOutcomeState.stage === 'awaiting';
      // An answer already IN waits for its presentation (the reconciler's tick, the arrival), never for the server —
      // read as the server's, every optimistic play claim was a false `dead-end` (the field export of 2026-11-08).
      const answered = awaiting && workspaceOutcomeState.answerIn;
      // A claim whose HOST is gone waits on a surface that is not there — dangling (the Hi-Tech Lab field freeze).
      const hostGone = workspaceOutcomeState.host !== undefined && !workspaceFrameAnywhere(workspaceOutcomeState.host);
      out.push({
        id: `claim:${workspaceOutcomeState.host}`, family: 'claim', owner: 'consoleWorkspaceOutcome',
        targets: hostGone ? [{kind: 'node', id: `surface:${workspaceOutcomeState.host}`}] :
          answered ? [{kind: 'motion', what: 'the claimed outcome presents (or the reconciler lets it go)'}] :
            awaiting ? [{kind: 'server', what: 'the claimed answer'}] : [{kind: 'player', what: 'take the claimed outcome'}],
        ...(awaiting ? {boundMs: 20_000} : {}), recovery: 'workspace-outcome',
        detail: `${workspaceOutcomeState.sourceCard} [${workspaceOutcomeState.kinds.join(',')}] ${workspaceOutcomeState.stage}`,
      });
    }
    // THE SUBMIT FUNNEL — the wire, then the answer's own gates.
    if (transportState.requestInProgress) {
      out.push({
        id: 'transport:submit', family: 'transport', owner: 'gameTransport',
        targets: transportState.responseArrived ? [{kind: 'motion', what: 'the answer\'s cinematic gates'}] : [{kind: 'server', what: 'the answer'}],
        since: transportState.requestSince > 0 ? transportState.requestSince : undefined,
        boundMs: transportState.responseArrived ? LIVENESS_TRANSPORT_GRACE_MS : 60_000, recovery: 'transport-funnel',
      });
    }
    return out;
  }

  function registerLivenessRungs(): void {
    livenessRungStops.value = [
      registerWaitSource('shell', () => shellWaitNodes()),
      // …and the registries every presentation wait goes through — holds, ledger stories, the park — BY CONSTRUCTION (Э4).
      ...registerConstructionWaitSources(),
      // THE WAIT GRAPH's DOORS (Э3): what the shell's own waits yield through when a confirmed cycle names them — every
      // one an EXISTING path (the plate acknowledged where its question's surface already stands, the conclusion's
      // question door, the claim's forced release), never a press on the player's behalf.
      registerWaitRecovery('announce-serve', () => shell.yieldAnnounceInCycle()),
      // …and the same door for a plate whose FIRST PRESENTATION is overdue: the bound is the announce machine's own
      // (`consoleMandatoryAnnounce.ts` — `pending` is a beat), no longer the wait graph's `overdue` judgement.
      (() => {
        registerAnnounceDoor(() => {
          const did = shell.yieldAnnounceInCycle();
          if (did !== '') {
            console.warn(`[mandatory-gate] the plate's door — ${did}`);
          }
        });
        return () => registerAnnounceDoor(undefined);
      })(),
      registerWaitRecovery('workspace-conclusion', (node) => {
        const kind = node.id.slice('conclusion:'.length) as WorkspaceFrameKind;
        const result = openFrameQuestionDoor(kind);
        if (result === 'served') {
          reaskOwedConclusion(kind);
          return `«${kind}»'s question door opened the question in place`;
        }
        return '';
      }),
      registerWaitRecovery('workspace-outcome', () => (releaseWorkspaceOutcome('wait-graph', {force: true}) ? 'the claim released' : '')),
      // A QUESTION ASKED OF NOBODY (a dead end — nothing on screen accepts, nothing holds it, nothing in flight): the
      // router's own door for that question, the road it took when it arrived (R15 generalized — the start's step lost
      // to a B mid-open was its first field shape).
      registerWaitRecovery('question-open', () => reopenOrphanQuestion()),
      // «SET ASIDE» WITH NO WAY BACK (inventory A2 — no restore card: no minimizable live task, nothing parked, the start
      // not serving): the question is un-set-aside and its surface opened through the router — the player is handed the
      // decision they could not reach, never answered for.
      registerWaitRecovery('deferred-restore', () => {
        if (!consoleState.task.deferred || shell.mandatoryDeferredActive) {
          return '';
        }
        consoleState.task.deferred = false;
        const did = reopenOrphanQuestion();
        return did !== '' ? `un-set-aside — ${did}` : 'un-set-aside (the question stands for its plate)';
      }),
      // THE DEAD END's POSITIVE CONTROL (`?waitGraphControl=strand` — never in a game): `__conStrandQuestion()` takes the
      // frame that serves the live question off the stack WITHOUT setting it aside — the R15 shape on demand; the graph
      // must give the question its surface back by itself.
      ...(new URLSearchParams(window.location.search).get('waitGraphControl') === 'strand' ? ((): Array<() => void> => {
        (window as unknown as {__conStrandQuestion?: () => string}).__conStrandQuestion = () => {
          const task = taskFor(shell.playerView);
          const frame = task === undefined ? undefined : frameServing(task.kind);
          if (frame === undefined || workspaceStackTop()?.kind !== frame.kind) {
            return '';
          }
          popWorkspaceFrame();
          return frame.kind;
        };
        // …and THE ORPHANED CLAIM on demand (the Hi-Tech Lab freeze): a claim placed for a host that is nowhere.
        (window as unknown as {__conOrphanClaim?: () => boolean}).__conOrphanClaim = () => {
          if (workspaceOutcomeClaimed() || workspaceFrameKnown('card-actions')) {
            return false;
          }
          claimWorkspaceOutcome('card-actions', 'Hi-Tech Lab', ['draw', 'pick'], 0, 1, 'card');
          return true;
        };
        // …and THE STILL HOLD on demand (the motion witness's control): a blocking hold with nothing on the page moving.
        let still: AnimationHold | undefined;
        (window as unknown as {__conStillHold?: () => boolean}).__conStillHold = () => {
          still?.release();
          // The control's own recovery: a ceiling (or a rung) that ends the hold drops the handle — nothing else stood on it.
          still = beginAnimationHold('wait-graph-control:still', {maxHoldMs: 25_000, expire: () => {
            still = undefined;
          }});
          return true;
        };
        return [() => {
          still?.release();
          delete (window as unknown as {__conStrandQuestion?: unknown}).__conStrandQuestion;
          delete (window as unknown as {__conOrphanClaim?: unknown}).__conOrphanClaim;
          delete (window as unknown as {__conStillHold?: unknown}).__conStillHold;
        }];
      })() : []),
      // THE WAIT GRAPH's POSITIVE CONTROL (`?waitGraphControl=1` — never in a game): a mutual wait put in on purpose (the
      // chairman quest's field shape), so a stand proves the shadow sees, confirms and logs a cycle end to end.
      // Its plate carries a door (Э3): the graph breaks the planted cycle through it, and the cycle is gone after.
      ...(new URLSearchParams(window.location.search).get('waitGraphControl') === '1' ? ((): Array<() => void> => {
        const control = {broken: false};
        return [
          registerWaitSource('control', () => (control.broken ? [] : [
            {id: 'control:conclusion', family: 'conclusion', owner: 'control', targets: [{kind: 'node', id: 'control:question'}]},
            {id: 'control:question', family: 'question', owner: 'control', targets: [{kind: 'node', id: 'control:plate'}]},
            {id: 'control:plate', family: 'announce', owner: 'control', targets: [{kind: 'node', id: 'control:conclusion'}], recovery: 'control-door'},
          ] as Array<WaitNodeInput>)),
          registerWaitRecovery('control-door', () => {
            control.broken = true;
            return 'the planted plate yielded';
          }),
        ];
      })() : []),
      registerLivenessRelease({
        rank: 15,
        name: 'start-director',
        release: () => {
          // A standing DISAGREEMENT of the start shadow on a stalled screen — cured through the existing doors.
          const s = shell.startShadowNow;
          if (!startShadowInScope(s.expected, s.actual) || startShadowVerdict(s.expected, s.actual, s.held) !== 'disagree') {
            return '';
          }
          return runStartDirectorCure({kind: 'disagree', expected: s.expected, actual: s.actual}, 'liveness');
        },
      }),
      registerLivenessRelease({
        rank: 17,
        name: 'screen-director',
        // A CONFIRMED screen-shadow finding still standing on a stalled screen: its planned cure through the owner's
        // door — executed only when its verb is armed (step 4, prepared); the dry run names the plan and does nothing.
        release: () => runScreenCure('liveness'),
      }),
      registerLivenessRelease({
        rank: 25,
        name: 'workspace-beat',
        release: () => {
          const beat = judgedTransientBeat();
          if (beat === undefined) {
            return '';
          }
          const kind = beat.split(':')[0] as WorkspaceFrameKind;
          forceRecoverStuckWorkspace(kind, `[workspace-stall] beat «${beat}» torn down by the liveness arbiter`);
          return `tore down ${beat}`;
        },
      }),
      registerLivenessRelease({
        rank: 30,
        name: 'stack-home',
        release: () => {
          const away = workspaceStackState.frames.length > 0 || consoleState.section !== 'board' || consoleState.sheet !== undefined;
          if (!away) {
            return '';
          }
          const where = `${consoleState.section}/${consoleState.sheet ?? ''} [${workspaceStackState.frames.map((f) => f.kind).join(';')}]`;
          resetConsoleActionComposerUi();
          goBoardHome();
          closeConsoleLayers();
          return `home from ${where}`;
        },
      }),
      registerLivenessRelease({
        // THE PHASE ROOT THAT STAYED (2026-11-07): `goBoardHome` keeps a phase-anchored root by definition (it IS the
        // phase), so a sitting / draft / opening whose own surface went deaf survived every rung above. It is PARKED —
        // never closed: its phase still stands, the plate re-announces it, and the player's restore mounts the section
        // FRESH (its unmount kills whatever run was wedged). Nothing is answered for the player.
        rank: 31,
        name: 'phase-root-park',
        release: () => {
          const root = workspaceStackState.frames[0];
          if (root === undefined || root.anchor.type !== 'phase') {
            return '';
          }
          const kinds = workspaceStackState.frames.map((f) => f.kind).join(';');
          collapseWorkspaceStack();
          closeConsoleLayers();
          return `parked the phase root [${kinds}]`;
        },
      }),
    ];
  }

  return {
    beatStallTimer,
    livenessRungStops,
    staleFreeTurnKey,
    lastLivenessAccepting,
    deadLiveFramePasses,
    commitFoldOwedSince,
    stuckWorkspaceIsGhost,
    forceRecoverStuckWorkspace,
    reapStaleFreeTurnFrame,
    reapDeadPhaseFrames,
    startSupervisor,
    stopSupervisor,
    declareScreenControlDefect,
    checkLiveness,
    backOwedOnStandingFrame,
    judgedTransientBeat,
    reopenStartStep,
    reopenOrphanQuestion,
    runStartDirectorCure,
    runScreenDirectorCure,
    shellWaitNodes,
    registerLivenessRungs,
  };
}

export type SupervisorController = ReturnType<typeof createSupervisorController>;
