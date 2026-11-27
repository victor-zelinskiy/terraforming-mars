/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE START CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {computed, ref, watch} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {activeAnimationHoldLabels, blockingAnimationHoldCount} from '@/client/components/presentation/animationHold';
import {conclusionRefusal} from '@/client/console/shell/shellFlowState';
import ConsoleParliamentSection from '@/client/components/console/ConsoleParliamentSection.vue';
import {agendaWalkFlow} from '@/client/console/parliament/agendaWalk';
import {neutralRallyFlow} from '@/client/console/parliament/neutralRally';
import {HostedParliamentStepKind, hostedStepLiveIn, hostedStepOwedTo, startHostedStepToEnter, startPreludeGrantOf} from '@/client/console/parliament/hostedParliamentStep';
import {ConsoleRevealMode} from '@/client/components/console/consoleRevealOverlayTypes';
import {closeWorkspaceRoot, workspaceFrameIndex, workspaceFrameParked, hostCarriesPlayersLook, workspaceHostYieldsScene, pushWorkspaceFrame, setWorkspaceFramePhase, setWorkspaceFrameStage, workspaceFrameHasNested, workspaceFrameMounted, workspaceFrameHost, workspaceFrameKnown, workspaceHostForStep, workspaceStackState, stackServes} from '@/client/console/consoleWorkspaceStack';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {isHandDeliveryActive} from '@/client/console/handDock/handDeliveryDirector';
import {Phase} from '@/common/Phase';
import {CardType} from '@/common/cards/CardType';
import {consoleStartState, foldStartActStages, releaseStartScene, startAwaitingOthers, startCorporationPlayed, startDeferredSummary, startHeroPlaying, startSceneHeld} from '@/client/console/consoleStartState';
import {boardExcursionActive, boardExcursionQuiet, engageBoardExcursion, releaseBoardExcursion} from '@/client/console/boardExcursion';
import {bonusActionInStartFlow, bonusActionOnBoard, bonusActionOwed} from '@/client/console/bonusAction';
import {firstActionOwed} from '@/client/console/startFirstAction';
import {isInSurfaceResourceTransferActive, isResourceTransferActive} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {ConsoleTask, taskFor, promptOutranksStartScene, SCENE_KINDS, corpFirstActionInStartFlow, startStepDiscardOf, startPlacementOrderOf, AGENDA_WALK_STEP_STAGE, NEUTRAL_RALLY_STEP_STAGE, firstActionPartyStep} from '@/client/console/consoleTaskRouter';
import {ConsoleTaskSummary} from '@/client/console/consoleTaskSummary';
import {sceneTransitionInputLocked} from '@/client/console/loadingScreenState';
import {govScaleFocusState} from '@/client/console/consoleGovScaleFocus';
import {startReturnBehindOutcome, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {isBoardCardBonusActive} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {cardReactionState} from '@/client/console/cardReaction/cardReactionStage';
import {getCard} from '@/client/cards/ClientCardManifest';
import {consoleState} from '@/client/console/consoleRouter';
import {isConsoleHandPickActive} from '@/client/console/consoleHandPick';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {isMandatoryGateHeld} from '@/client/console/consoleMandatoryGate';
import {hostedStepServes, START_STRAND_DOOR_QUIET_FRAMES, START_STRAND_DOOR_QUIET_MS, startStranded, startYieldsForHeldPlacement} from '@/client/console/startServing';
import {levelDoorInit, observeLevelDoor} from '@/client/console/levelDoor';
import {handRevealState} from '@/client/console/handDock/handRevealState';
import {ActualStartOwner, START_LEVEL_DOOR_QUIET_FRAMES, START_LEVEL_DOOR_QUIET_MS, StartOwner, StartShadowFinding, startLevelDoorMay, actualStartOwner, expectedStartOwner, startDirectorCure, startShadowInScope, startShadowLog, startShadowVerdict} from '@/client/console/startDirector';
import {noteOpeningLook, noteOpeningSpan} from '@/client/console/servingOwnerMeasure';
import {flightsInTheAir} from '@/client/console/waitGraph/flightsInTheAir';
import {flowTreeDigest, waitTable} from '@/client/console/kernel/flowScope';
import {isActionMenuTitle} from '@/common/inputs/actionMenuTitles';
import {AdmissionSignals, PromptSurface, promptAdmissionBlock} from '@/client/console/consolePromptAdmission';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {whenPainted} from '@/client/console/session/sessionWaits';
import type {ConvertController} from '@/client/console/shell/convertController';
import type {SupervisorController} from '@/client/console/supervisor/supervisorController';
import type {SeatController} from '@/client/console/shell/seatController';
import type {SurfaceRegistry} from '@/client/console/shell/surfaceRegistry';
import {takeUpQuestion} from '@/client/console/setAside';
import {viewerHasPassed} from '@/client/console/offTurnReason';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type StartPort = {
  $nextTick(fn?: () => void): Promise<void>,
  whenHostedHandQuestionChanges(id: number | undefined): void,
  surfaces: SurfaceRegistry,
  readonly activeTaskSummary: ConsoleTaskSummary | undefined,
  readonly admissionSignals: AdmissionSignals,
  admits(surface: PromptSurface): boolean,
  readonly colonyEmbedActive: boolean,
  readonly consoleRevealMode: ConsoleRevealMode | undefined,
  convertPlantsPending: UnwrapRef<ConvertController['convertPlantsPending']>,
  readonly deckPickServing: boolean,
  game: UnwrapRef<SeatController['game']>,
  readonly nomadMoveHolds: boolean,
  readonly placementActive: boolean,
  readonly playerView: PlayerViewModel,
  reopenStartStep: UnwrapRef<SupervisorController['reopenStartStep']>,
  runStartDirectorCure: UnwrapRef<SupervisorController['runStartDirectorCure']>,
  readonly standalonePromptSurfaceStands: boolean,
  taskSpacePending: {index: number, spacePrompt: PlayerInputModel} | undefined,
  readonly tilePlacementHolds: boolean,
};

export function createStartController(shell: StartPort) {
  // The controller's own scope (architecture v2 — PLAN §10 · C1): it ends with the shell, and the watchdog's and the
  // shadow's timers with it.
  const flow = useFlowScope('start-controller');
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** THE YIELD (the strand's door, the director's cure): a question the scene's own doors could not serve goes to the
   *  shell's surfaces (the scene stops painting) until the prompt changes. */
  const startStrandYield = ref(false);
  const startStrandPrompt = ref(undefined as number | undefined);
  /** The DOOR track's frame-by-frame look (the opening's measure — stats only). */
  let cancelDoorLook: () => void = () => {};
  /** …and the STRAND-DOOR track's (what stands in flight under a strand — stats only). */
  let cancelStrandLook: () => void = () => {};
  /** The standing strand's run of quiet frames (the STRAND-FRAMES count — stats only). */
  const strandQuiet = {key: '', frames: 0, max: 0};
  /** The standing strand's cure (its two verbs, set while a strand stands — the door's look reads them here). */
  const strandCure: {heal: (by: 'level') => void, yieldToShell: (by: 'level') => void, healed: () => boolean} =
    {heal: () => {}, yieldToShell: () => {}, healed: () => false};
  /** Stale-release token of the start excursion's quiet re-check (the
   *  release is confirmed one tick + one frame later, so a one-flush
   *  hand-off between two chain signals can never slip through). */
  const excursionReleaseToken = ref(0);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * The pre-game INITIAL-SETUP window: the player has NO actual hand yet —
   * the `initialCards` wizard is live (incl. deferred / the submit in
   * flight), the initial draft is still dealing, or the viewer submitted
   * their picks and gen-1 research waits on the other players to submit
   * theirs. The hand dock's «КАРТЫ 0/0» would be a false readout for a
   * hand that does not exist, so the footer unmounts the dock AND its bay
   * for the whole window (see `handDockVisible`). The dock appears the
   * moment the game actually starts — the start ceremony's card delivery
   * (post-launch) is the first real hand content and needs the dock as its
   * landing target.
   *
   * ⚠️ GEN-1 RESEARCH IS A TABLE STATE, NEVER A PERSONAL ONE. The research
   * barrier holds that phase until the LAST seat has played and paid, so
   * `waitingFor === undefined` there means «my setup is in, the table's is
   * not» — and past the viewer's OWN corporation play that is the
   * deployment, hand and all. Reading the bare triple as «no hand yet»
   * hid the dock (`display:none`) at the exact frame the paid cards were
   * flying into it: `stableTargetRect` polled a zero-width rect for its
   * whole budget and the delivery landed nowhere. Solo vs MarsBot never
   * showed it (the bot pre-seeds `researchedPlayers`, so the window has
   * zero length) — it is a multiplayer-only bug, which is exactly why the
   * discriminator has to be the personal fact, not the phase.
   */
  const setupHandPending = computed((): boolean => {
    if (shell.playerView.waitingFor?.type === 'initialCards') {
      return true;
    }
    const phase = shell.game.phase;
    if (phase === Phase.INITIALDRAFTING) {
      return true;
    }
    return shell.game.generation === 1 && phase === Phase.RESEARCH &&
      shell.playerView.waitingFor === undefined &&
      !startCorporationPlayed(shell.playerView);
  });

  /** The T5 START SCENE task (initialCards wizard / start-sequence ceremony). */
  const startTask = computed((): ConsoleTask | undefined => {
    // A reveal overlay is a TOP-PRIORITY modal — it cannot be minimized and
    // must be finished (cards taken) before anything under it comes alive.
    // A draw earned by a prelude can arrive at the SAME time the server
    // raises the corporation's first mandatory action (a start-scene task):
    // the start scene must NOT mount / grab focus under the reveal. It
    // re-activates the instant the reveal closes (the consoleForegroundBusy
    // watcher opens the serving surface then).
    if (!shell.admits('scene')) {
      return undefined;
    }
    const task = taskFor(shell.playerView);
    if (task !== undefined && SCENE_KINDS.has(task.kind)) {
      // A SAFETY CATCH, never the routing (P91): the start scene is the opening's, generation 1 only. A start
      // marker past it is a server that forgot the mid-game prelude pick's own marker (`deckPickPrompt` mode
      // `play`) — raising the start workspace there would reset the stack over the hand that played the card.
      if (shell.playerView.game.generation > 1) {
        console.warn(`[start] scene kind outside generation 1: ${task.kind}`);
        return undefined;
      }
      return task;
    }
    // The corporation's mandatory FIRST ACTION is the start flow's own
    // final conditional stage: while the start flow is live it is a SCENE
    // task (the workspace's «ПЕРВОЕ ДЕЙСТВИЕ» stage serves it — the same
    // seamless grammar as the prelude plays), and it is exactly what lets
    // a reload mid-first-action restore the workspace instead of a modal.
    if (task?.kind === 'corpFirstAction' && corpFirstActionInStartFlow(shell.playerView)) {
      return task;
    }
    // (The old "keep the scene up for the client-staged corp-bonus reveal"
    // fallback is gone: the console retired the staged reveal — the
    // DEFERRED corporationPlay press + the hero landing carry that beat,
    // and the reveal never activates in console mode.)
    return undefined;
  });

  /**
   * THE OPENING's OWN QUESTION, HELD BEHIND A BEAT. `startTask` is admission-gated — under a reveal or a presentation
   * the scene takes no NEW question — and the lifetime hold is what was to span that gap. But the hold is module
   * state: a reload wipes it, and a start entered past its summary never raised it. Then, between a prelude's play
   * and the next «pick a prelude», the scene stood ON SCREEN with the server asking its own question and «served»
   * nothing: the pad was not its, and RT opened the board's wheel under the queue (the freeze gate, seed fz1 ·
   * `venus-l1-shade-start` — `pad-MISS:section:board`, the one-owner law's first red: issue #84). A start whose
   * FRAME STANDS keeps serving a start question that is merely held — it absorbs the press, exactly as under its
   * hold. Only while the frame stands: a held question never RAISES the scene (under a reveal it must not mount).
   */
  const startQuestionHeld = computed((): boolean => {
    if (shell.admits('scene') || !workspaceFrameKnown('start') || shell.playerView.game.generation > 1) {
      return false;
    }
    const task = taskFor(shell.playerView);
    return task !== undefined && SCENE_KINDS.has(task.kind);
  });

  /**
   * The Game Start Workspace SERVES — a live start prompt OR the workspace
   * LIFETIME HOLD (consoleStartState.hold). The hold spans the summary
   * commit and every prompt gap of the deployment: one root workspace from
   * the first corporation card to the settled start, never a close/open
   * between beats (the close mid-hero is exactly what stranded the
   * corporation card in the motion layer). Every presence-semantics site
   * (mount, input routing, prompt suppression, foreground lease) reads THIS,
   * never raw `startTask`.
   */
  /**
   * THE BONUS-ACTION TURN IS A TURN, and a turn belongs to the BOARD HOME.
   *
   * «Фора» grants two ORDINARY actions: the player may play a card, activate
   * one, build a standard project, claim a milestone, fund an award, convert
   * resources — and, with the Colonies expansion, TRADE. Every one of those
   * is a full board interaction the start workspace cannot host, and while it
   * kept claiming the screen the console fought the player for it: the hand
   * opened as a STEP teleported into the workspace's hidden zone (so the
   * cards were simply not there), and walking to «Колонии» DEFERRED the
   * workspace, after which `actionBlockedReason` refused every action with
   * «сначала завершите текущее действие» — about a decision the player had
   * been sent away to make.
   *
   * So for the window the workspace LETS GO completely: no frame, no host,
   * no deferred task, nothing to block anything. It comes back through the
   * ordinary `startFrameLive` door — with every bit of its module state
   * intact — when the LEDGER says the bonuses are spent.
   */
  const bonusTurnLive = computed((): boolean => {
    return consoleStartState.bonusAct.stage === 'onboard' &&
      bonusActionOnBoard(shell.playerView);
  });

  const startSceneServes = computed((): boolean => {
    // …and the ONE state in which it owns nothing at all (`bonusTurnLive`).
    if (bonusTurnLive.value) {
      return false;
    }
    // The FIRST-ACTION term covers the stage's WAIT — the corporation still
    // owes its opening move but the server currently asks nothing (another
    // player is moving), so there is neither a task nor (after a reload,
    // which wipes the module hold) a lifetime hold. The workspace is still
    // the serving surface of that wait: it owns the pad, the defer summary
    // and the frame exactly as during any other beat of the deployment.
    //
    // …AND IT OWNS AN OUTCOME. A workspace that CLAIMED a follow-up may not
    // stop serving before that follow-up has presented: the claim is what
    // makes the batch embeddable, so a frame that closes in the gap between
    // the answer and the cards coming off the deck takes the only host the
    // draw had with it — the batch then opens a standalone modal over
    // nothing (Celestic's first action, and any draw at all once a reload
    // has wiped the lifetime hold).
    // …and while a play the START armed is still running (P57 · FQ — `startHeroPlaying`): its own blocking holds
    // withdraw the task, and after a reload no lifetime hold stands behind it.
    // …and its OWN step between a prelude's placements (P58 · FS — «which tile next»): after a reload nothing else
    // says the scene serves it (no lifetime hold, no scene kind), and the step painted under a board-home bar.
    return startTask.value !== undefined || startQuestionHeld.value || startSceneHeld() || startHeroPlaying() ||
      startPlacementOrderOf(shell.playerView) !== undefined ||
      (corpFirstActionInStartFlow(shell.playerView) && firstActionOwed(shell.playerView)) ||
      // …and the same for an owed BONUS ACTION the player has NOT yet been
      // handed off for. The server stands on a plain action menu there, so
      // there is no start TASK to read, and after a reload there is no
      // lifetime hold either — but the workspace is still the surface that
      // has to ANNOUNCE the trip. Once the player confirms, `bonusTurnLive`
      // above short-circuits this whole computed to false.
      bonusActionInStartFlow(shell.playerView) ||
      // …AND WHILE ITS OWN STAGE MACHINE IS STILL RUNNING. This is the
      // durable form of «the workspace owns something»: the CLAIM is
      // transient by design (it is reconciled away the moment nothing looks
      // embeddable YET), so a frame whose life hangs off it dies in the gap
      // between «the ledger drained» and «the cards came off the deck» —
      // taking with it the only host that draw had, which is how Celestic's
      // first action ended up in a modal. The stage goes `idle` only
      // through `firstActionLeaveDue`, which already waits out that gap.
      consoleStartState.firstAct.stage !== 'idle' ||
      consoleStartState.bonusAct.stage !== 'idle' ||
      (workspaceOutcomeState.host === 'start' && workspaceOutcomeState.sourceCard !== '');
  });

  /**
   * WHICH TERM KEEPS THE START STANDING — the same terms as `startSceneServes` / `startFrameLive`, by NAME, for the
   * strand's measure only (it decides nothing). A start that serves nothing under the game's menu on a page with no
   * lifetime hold (the second seat of the box's duo `parliament`, cured by the opening's door on two heads running —
   * 2026-11-23) stood by ONE of these, and «settle: no hold» could not say which.
   */
  function startStandsBy(): string {
    const terms = [
      bonusTurnLive.value ? 'bonus turn — serves nothing' : '',
      startTask.value !== undefined ? `task ${startTask.value.kind}` : '',
      startQuestionHeld.value ? 'question held' : '',
      startSceneHeld() ? 'hold' : '',
      startHeroPlaying() ? 'hero playing' : '',
      startPlacementOrderOf(shell.playerView) !== undefined ? 'placement order' : '',
      corpFirstActionInStartFlow(shell.playerView) && firstActionOwed(shell.playerView) ? 'first action owed' : '',
      bonusActionInStartFlow(shell.playerView) ? 'bonus action in the flow' : '',
      consoleStartState.firstAct.stage !== 'idle' ? `first stage ${consoleStartState.firstAct.stage}` : '',
      consoleStartState.bonusAct.stage !== 'idle' ? `bonus stage ${consoleStartState.bonusAct.stage}` : '',
      workspaceOutcomeState.host === 'start' && workspaceOutcomeState.sourceCard !== '' ? `claim ${workspaceOutcomeState.stage}` : '',
      workspaceFrameHasNested('start') ? 'a nested frame' : '',
      hostedStepOwedTo('start') ? 'a step owed' : '',
      hostedStepLiveIn('start') ? 'a step live' : '',
    ].filter((term) => term !== '');
    return terms.length === 0 ? 'nothing' : terms.join('+');
  }

  /**
   * The workspace is on SCREEN. It SERVES through the whole start (above),
   * but it steps aside for the one interaction it cannot host: a BOARD
   * PLACEMENT. A start prelude that places a tile («Great Aquifer» — two
   * oceans) leaves the server waiting for a space while the board — with
   * its highlighted cells — is behind the workspace, and the workspace's
   * own status honestly has nothing to say («ожидаем других игроков»). The
   * board is an always-mounted host, so the yield IS the hand-off: the
   * scene hides while the placement stands and comes back by itself when
   * it resolves (collapse, never close — the lifetime hold is untouched,
   * so nothing about the deployment is lost).
   */
  const startSceneVisible = computed((): boolean => {
    // Everything that makes the scene STEP ASIDE lives here, never in the
    // mount: a board placement it cannot host, the WHOLE completion chain
    // of that placement (the excursion latch — commit flight, reward
    // transfers, the cell's bonus reveal, every follow-up prompt: the
    // workspace returns exactly ONCE, onto a settled frame), the WGT scale
    // glide, and a task the player minimized. All are «somebody else has
    // the screen» — a paint question. Unmounting on them retracted the
    // frame's embed slot too, so a step standing INSIDE the start (the
    // sponsor's hand) lost its teleport target and fell with it.
    // …and a nested full screen the start handed its scene to (the awards
    // step of Vitor's first action — `frameSteps: {awards: 'scene'}`): the
    // guest owns the pixels, the HEADER states the nesting, and the scene
    // comes back untouched when the step's frame pops.
    // …and a PROMPT SURFACE standing on its own (`standalonePromptSurfaceStands`
    // — a claimless band after a reload): the scene shares its layer and comes
    // later in the shell, so it would paint over the very question the server
    // is asking. A yield, never an unmount: the scene comes back untouched
    // when the band has been answered.
    // …and a SERVER PLACEMENT the start cannot host, held by a block that is the BOARD's (a foreign tile owed to it,
    // its scale story, the announcement — `startYieldsForHeldPlacement`): the scene used to stand over that wait
    // serving nothing (the field report of 2026-10-28 — Strategic Base Planning's city behind its colony), and the
    // foreign tile it waited for waited in turn for a board the scene covered.
    // …and a STRAND the watchdog could not heal (`startStrandYield`): the question goes to the shell's own surfaces.
    return startSceneMounted.value && !shell.placementActive &&
      !startExcursionHolds.value && !workspaceHostYieldsScene('start') &&
      !govScaleFocusState.holding && !consoleState.task.deferred &&
      !shell.standalonePromptSurfaceStands && !ownStartYieldsForHeldPlacement.value && !startStrandYield.value;
  });

  /** See `startSceneVisible` — the board's own wait never stands behind the start scene (`startServing.ts`). */
  const ownStartYieldsForHeldPlacement = computed((): boolean => {
    return startYieldsForHeldPlacement({
      placementAsked: shell.playerView.waitingFor?.type === 'space',
      placementLive: shell.placementActive,
      nestedStep: workspaceFrameHasNested('start'),
      block: shell.playerView.waitingFor?.type === 'space' ? promptAdmissionBlock('placement', shell.admissionSignals) : undefined,
    });
  });

  /**
   * THE START WATCHDOG'S INPUT (the reliability iteration of 2026-10-28): the scene is on screen, the server asks the
   * viewer something real, the scene serves NOTHING (`consoleStartState.serves === 'none'`) and nothing else stands
   * for the question — no task host, no live placement, no hand pick, no park, no moving beat (a hold is a bounded
   * beat; a stuck one outlives its ceiling and the strand surfaces then).
   */
  const startStrandedNow = computed((): boolean => {
    const wf = shell.playerView.waitingFor;
    const task = taskFor(shell.playerView);
    // A HOSTED STEP serves only the question a frame of it answers: a step left standing past its own prompt (a
    // colony grid after its build, the server already asking the prelude's city) serves nothing — it is a strand
    // dressed as a step.
    // …except the start's OWN step (P58 · FS — a prelude's «which tile next»): the scene itself is its surface.
    // …and a step IN TRANSIT is a beat (`hostedStepServes`): the hand on its own opening / gathering episode.
    const serves = hostedStepServes({
      serves: consoleStartState.serves,
      stepAnswers: task === undefined || stackServes(task.kind) || startPlacementOrderOf(shell.playerView) !== undefined,
      inTransit: handRevealState.phase === 'opening' || handRevealState.phase === 'closing',
      // …and THE PLAYER'S OWN LOOK is no step of the start's at all: it serves the player, who closes it.
      playersLook: hostCarriesPlayersLook('start'),
    });
    return startSceneMounted.value && !startStrandYield.value && startStranded({
      serves,
      promptLive: wf !== undefined && wf.optional !== true,
      // A STORY never stands for a question (the liveness law): only a BLOCKING hold is a beat in flight — a
      // notification-only one (the scale-step rating waiting for a board the start covers) masked the field's
      // empty start of 2026-10-31.
      servedElsewhere: !startSceneVisible.value || startPromptSurfaceStands.value || shell.placementActive ||
        isConsoleHandPickActive() || consoleState.task.deferred || blockingAnimationHoldCount() > 0 ||
        isMandatoryGateHeld() ||
        // THE TABLE IS ANSWERING: a card's reaction to what the start just did is on stage (or waits for the same
        // scenes a decision waits for), and the server's next question is held behind it BY DESIGN (the admission's
        // `table-answer`) — a beat in flight with its own bound (the chain's hold and its ceiling), not a start that
        // serves nothing. The gate's seed of the day, 2026-11-18 · `hydro-floodgates-mix`: Poseidon's first action
        // placed its colony, the corporation answered, and at 2.5 s the watchdog named «the start serves nothing
        // while the server asks «space»» over a reaction that was still being told.
        shell.admissionSignals.tableAnswer,
    });
  });

  /**
   * THE START SHADOW (`startDirector.ts`, phase 0 of «правда сервера → одно состояние → один владелец экрана»): who
   * MUST serve the screen by the server's one question, beside who the latch machinery actually put there. Read only
   * — nothing here changes the screen; a sustained disagreement is logged (`[start-shadow]`).
   */
  const startShadowNow = computed((): {expected: StartOwner, actual: ActualStartOwner, held: string | undefined, prompt: string} => {
    const wf = shell.playerView.waitingFor;
    const task = taskFor(shell.playerView);
    const title = wf?.title;
    const expected = expectedStartOwner({
      prompt: wf === undefined ? undefined : {
        type: wf.type,
        startKind: wf.startGamePrompt?.kind,
        bonusAction: wf.bonusActionPrompt !== undefined,
        actionMenu: wf.type === 'or' && isActionMenuTitle(typeof title === 'string' ? title : title?.message),
        task: task?.kind,
      },
      generation: shell.playerView.game.generation,
    });
    const actual = actualStartOwner({
      mounted: startSceneMounted.value,
      visible: startSceneVisible.value,
      serves: consoleStartState.serves,
      firstActStage: consoleStartState.firstAct.stage !== 'idle',
      placementLive: shell.placementActive,
      promptSurface: startPromptSurfaceStands.value || shell.standalonePromptSurfaceStands,
      strandYield: startStrandYield.value,
      parked: consoleState.task.deferred,
      stepInTransit: handRevealState.phase === 'opening' || handRevealState.phase === 'closing',
      playersLook: hostCarriesPlayersLook('start'),
      bonusTrip: bonusTurnLive.value,
    });
    // (…and THE OPENING THAT HAS NOT COME BACK YET is held by name: the workspace it lent the screen to still shows its
    // outcome — `startReturnBehindOutcome`, the answer the frame's own door reads. Unnamed, the shadow judged the
    // verdict the player was reading «expected the queue, on screen the game» for as long as they read it.)
    const behind = startReturnBehindOutcome();
    const held = wf === undefined ? undefined : behind !== undefined ? `outcome:${behind}` :
      (wf.type === 'space' ? promptAdmissionBlock('placement', shell.admissionSignals) : promptAdmissionBlock('host', shell.admissionSignals));
    const prompt = wf === undefined ? '—' :
      `${wf.type}:${wf.startGamePrompt?.kind ?? task?.kind ?? ''}#${wf.promptId ?? ''}`;
    return {expected, actual, held: held ?? undefined, prompt};
  });

  /** One string per judged state — the watcher fires on a CHANGE, never on a recompute that changed nothing. */
  const startShadowSig = computed((): string => {
    const s = startShadowNow.value;
    return `${s.expected}|${s.actual}|${s.held ?? ''}|${s.prompt}`;
  });

  /** MOUNTED ≠ VISIBLE. The scene owns the start's lifetime (its hold, its
   *  claims, its release beat), so it stays mounted through a yield and
   *  only stops painting — see the scene's `yielded` prop.
   *
   *  PRESENCE IS THE STACK AND NOTHING ELSE (invariant 1). Its own minimize
   *  goes through the park, so the frame answers that by itself; every other
   *  flag that used to sit here belonged to a DIFFERENT flow. */
  const startSceneMounted = computed((): boolean => {
    return workspaceFrameMounted('start');
  });

  /** The COMPLETION BARRIER's reactive face (startBoardExcursion): the scene
   *  yielded to a board placement and that placement's causal chain has not
   *  fully completed yet. */
  const startExcursionHolds = computed((): boolean => {
    return boardExcursionActive('start');
  });

  /** The barrier ENGAGES the moment the serving workspace yields to a board
   *  placement (the placement is the CAUSE; everything after it is chain). */
  const startExcursionEngage = computed((): boolean => {
    return startSceneServes.value && shell.placementActive;
  });

  /**
   * The placement chain is QUIET — every beat of `startExcursionQuiet`'s
   * contract answered from the same live signals the admission policy
   * trusts. Deliberately WITHOUT the global animation-hold registry and
   * WITHOUT the remote-placement scene: the barrier counts only the
   * viewer's own chain, so another player's cinematic can never wedge it.
   */
  const startExcursionQuietNow = computed((): boolean => {
    return boardExcursionQuiet({
      placementAsked: shell.playerView.waitingFor?.type === 'space' ||
        shell.convertPlantsPending !== undefined || shell.taskSpacePending !== undefined,
      tileHero: shell.tilePlacementHolds || shell.nomadMoveHolds,
      transfers: isResourceTransferActive(),
      boardBonus: isBoardCardBonusActive(),
      revealBusy: shell.consoleRevealMode !== undefined || currentRevealEvent() !== undefined,
      // Live intake flights only — NEVER `held`: withheld bought cards are
      // the PAY stage's business (they fly on the pay press, which needs
      // the scene back), not part of any placement chain.
      handIntake: isHandDeliveryActive() || handDeliveryState.flights.length > 0,
      // P58 · FS — the start's OWN step between its placements («which tile next») ends the board trip: it is the
      // workspace the excursion returns TO, never one more follow-up of the chain.
      followUpKind: startPlacementOrderOf(shell.playerView) !== undefined ? undefined : taskFor(shell.playerView)?.kind,
    });
  });

  /**
   * THE SCENE OWNS THE PAD AND THE BAR. Ownership follows the surface the
   * player SEES — never the lifetime hold, which stays true through the
   * whole deployment. Three consumers ask this ONE question (the bar's
   * context, the bar's commands, the input routing), so they can never
   * drift apart; the hosted steps were already excluded here, and the
   * YIELD to a board placement is the same rule one case further:
   *
   * the yield used to be paint-only (`startSceneVisible` + the scene's
   * `visibility: hidden`), so a start prelude that owes a tile hid the
   * workspace while the hidden scene kept the pad — its own press guard
   * returned, `onNav` walked the invisible queue, and the bar advertised
   * «A Разыграть · X Осмотреть · B Свернуть» over a live board. The board
   * is the always-mounted host of that placement; it must get the input.
   */
  const startSceneOwnsPad = computed((): boolean => {
    // …and never a scene that is not THERE. `startSceneServes` is the
    // lifetime hold, which outlives any single mount: with the frame gone the
    // routing still handed every intent to `$refs.startScene` and returned
    // «handled», so the pad went dead with a live command bar over it and
    // only a reload got out. Ownership follows presence, always.
    // …and never over a STEP it is hosting. A prelude that turns the deck
    // over («Корпоративные архивы») puts a real decision inside the scene's
    // own zone; leaving the pad with the scene there is what made the seven
    // cards unpickable while the bar still advertised «A РАЗЫГРАТЬ».
    // …and never over a SHEET-projecting workspace standing above the phase
    // root. EstablishedMethods' prelude prompt («сыграйте стандартный
    // проект») opens the std-projects workspace as a lateral frame OVER the
    // surviving start root — the deepest frame owns the pad (the stack's
    // own law). Without this term the scene swallowed every A over a served
    // prompt with a focused row and a live bar: four presses, zero submits.
    // …and never over a PROMPT SURFACE of its own (`startPromptSurfaceStands`)
    // — the general form of the three terms above, and the last hole in them.
    return startSceneVisible.value && startSceneServes.value &&
      !startSponsorEmbed.value && !shell.colonyEmbedActive && !shell.deckPickServing &&
      consoleState.sheet === undefined && !startPromptSurfaceStands.value;
  });

  /**
   * ANOTHER SURFACE IS SERVING THE SERVER'S PROMPT over (or inside) the start
   * workspace — so the workspace owns neither the pad nor the bar.
   *
   * The opening's lifetime hold spans every gap between beats, which is what
   * makes «the scene is up» say nothing about who is being asked. A prelude
   * with a price answered in an alternative currency (Helion's heat on
   * «Огромный астероид») raises a `SelectPayment` that teleports into the
   * workspace's OWN zone as its «› ОПЛАТА» stage; the scene kept the pad, so A
   * still read «РАЗЫГРАТЬ» on the queue behind the panel and LB/RB never
   * reached the heat lane. An exact, valid payment that could not be
   * confirmed — and the same for every other host-served family a prelude can
   * raise (`promptOutranksStartScene` states the whole class).
   *
   * ADMISSION-GATED on purpose, exactly like `hostTask` / `nativeCompositeTask`
   * are: during a hold nothing is mounted to hand the pad TO, and the press
   * must keep being absorbed by the scene rather than fall through to the
   * board standing behind it.
   */
  const startPromptSurfaceStands = computed((): boolean => {
    return shell.admits('host') && promptOutranksStartScene(shell.playerView);
  });

  /**
   * …AND IT IS DUE — the walk stands on that tile's row and the pair's card has
   * been taken (`payoutDiscardDue`). The server raises the discard with the
   * press's own answer, while rows ahead of it are still paying: OWED keeps it
   * from being announced or opened anywhere else, DUE is what opens the hand.
   */
  /**
   * THE FIRST ACTION'S PARTY STEP IS DUE — the first action's answer raised a Parliament question
   * (`firstActionPartyStep`: Septem Tribus:redux's `bannerPrompt`, The Deimos Group's delegate grant) while the START
   * workspace is the live host and no Parliament stands yet. The step opens on this signal's RISING edge (the
   * foreground's falling edge never comes: the first action's own submit is not a foreground beat).
   */
  const startPartyStepDue = computed((): boolean => {
    return firstActionPartyStep(shell.playerView.waitingFor) && workspaceHostForStep() === 'start' &&
      !workspaceFrameKnown('parliament') && !consoleState.task.deferred && shell.admits('followUp');
  });

  /**
   * THE START'S HOSTED PARLIAMENT STEP IS DUE — the kind it is (`''` when none): a Prelude's answer carried a record
   * owed to the START with no Parliament standing to play it in, and the opening still serves — a walk of the Agenda
   * track (TRP1 Lobbying Campaign: the grant asked nothing — an empty reserve — so the record rode the play's own
   * answer) or a campaign's rally into a party's Popular Support (TRP2 Unity Campaign and its sisters: the record
   * rode the answer to the play's own colony / city). The Parliament is pushed onto the start as its scene step to
   * play it («СТАРТ ПАРТИИ › … › КАРЬЕРА» / «› ДЕЛЕГАТЫ»); with a vote step still up a walk CONTINUES in that step
   * instead (`onParliamentFlowComplete`). `workspaceHostForStep() === 'start'` waits out the play's own steps (the
   * colonies frame of the campaign's colony pops first), and the step waits out a CARD REACTION still playing — the
   * table's answer to those steps (the ruling Greens paying for the Io colony's heat production) is the server's
   * EARLIER effect, and its charter card rising over the column would stand over the very plaques the rally's
   * cubes land on (the reaction's hold is notification-only, so `admits` does not see it). Rising edge, like the
   * party step's.
   */
  const startHostedStepDue = computed((): HostedParliamentStepKind | '' => {
    const kind = startHostedStepToEnter();
    return kind !== undefined && workspaceHostForStep() === 'start' && !consoleState.task.deferred && shell.admits('followUp') &&
      cardReactionState.phase === 'idle' ? kind : '';
  });

  /**
   * P55 · FN — A START PRELUDE'S OWN DISCARD IS A STEP OF THE START (`startStepDiscardOf` — Old Mining Colony's
   * «discard 1 card»): the start workspace that played the prelude hosts the hand INSIDE its body (`start ⊃ hand`,
   * the deployment released in place), so it is never announced (no plate, no beacon) — OWED keeps it from being
   * announced, DUE opens it.
   */
  const startDiscardStepOwed = computed((): boolean => {
    return taskFor(shell.playerView)?.kind === 'handSelect' && startStepDiscardOf(shell.playerView) !== undefined &&
      workspaceFrameKnown('start');
  });

  /**
   * …AND IT IS DUE once the start is the step's host again: the colony step the same play asked FIRST has left (its
   * story told — `dwellColonyFollowUp`: the build's tokens, one read; the stage gate held the discard till then), a
   * drawn batch it brought (Pluto's +2) has been taken (`followUp` waits for the reveal), and the hand is not open
   * already. Rising edge, like the party step's.
   */
  const startDiscardStepDue = computed((): boolean => {
    return startDiscardStepOwed.value && workspaceHostForStep() === 'start' && !workspaceFrameKnown('hand') &&
      !consoleState.task.deferred && shell.admits('followUp');
  });

  /**
   * «ЭПАТАЖНЫЙ СПОНСОР» — the hand stands as a STEP INSIDE another workspace.
   *
   * One frame lookup. It used to be forty lines that re-derived the claim
   * from server truth + a commit latch + a colony latch + a follow-up
   * predicate on every tick, and each of those terms was a separate way for
   * the claim to lapse under a card that was still flying. A frame does not
   * lapse: it is pushed when the step opens and popped when it is over.
   */
  const startSponsorEmbed = computed((): boolean => {
    return workspaceFrameHost('hand') === 'start';
  });

  /**
   * THE START WORKSPACE'S FRAME must stand while the opening SERVES it — or
   * while a step it is HOSTING is still unfinished, because an inner frame
   * can never outlive its host. The second half is why this is a computed and
   * not a raw `startSceneServes` watcher: popping the hosted hand makes it
   * re-evaluate on its own, so nothing has to remember to re-check the root.
   */
  const startFrameLive = computed((): boolean => {
    // A FOREIGN WORKSPACE'S OUTCOME IS STILL PRESENTING — the start must not
    // return YET. `enterWorkspace('start')` truncates the stack, and during
    // a bonus-action window («Фора» building a colony on Pluto) the response
    // that drains the ledger is the very one that carries the payout: the
    // re-entry destroyed the colonies frame under its live claim, the claim
    // stood with an empty zone until its 20 s backstop, and the batch then
    // rose as the standalone «Получены карты» band over the start workspace.
    // The claim's own release (the take, the reconciler, its backstop) is
    // what re-fires this computed — the hold is bounded by construction.
    // (`startReturnBehindOutcome` — the one answer; the question's facts read it too.)
    if (startReturnBehindOutcome() !== undefined) {
      return false;
    }
    if (startSceneServes.value || workspaceFrameHasNested('start')) {
      return true;
    }
    // A WALK THE START OWES OR PLAYS (TRP1 — the last Prelude's walk arrives in the very answer that ends the
    // opening's prompts): the step it is shown in is the start's, and an inner frame never outlives its host — the
    // root stands until the walk has been read (bounded by the walk's own hold; its release re-fires this).
    if (hostedStepOwedTo('start') || hostedStepLiveIn('start')) {
      return true;
    }
    // SERVER TRUTH, for the cases the module state cannot answer (a RELOAD
    // wipes the workspace's lifetime hold, so `startSceneServes` is false):
    //
    // 1. The corporation still OWES its mandatory first action and the
    //    start flow is live — the workspace's own final stage. This is what
    //    restores the first-action WAIT (the opponent is still moving, so
    //    there is no prompt at all to re-derive the frame from) and the
    //    ACTIVE stage alike, without ever falling back to a modal.
    if (corpFirstActionInStartFlow(shell.playerView) && firstActionOwed(shell.playerView)) {
      return true;
    }
    const task = taskFor(shell.playerView);
    // 1b. A starting corporation's FIRST ACTION that discards (PC05 Spire — «draw 4, then discard 3»): the ledger
    //     drained at the option take, so (1) no longer holds while the discard stands — the step stands the start
    //     back up around it after a reload (in the action phase, before the PRELUDES gate below).
    if (task?.kind === 'handSelect' && shell.game.phase !== Phase.PRELUDES && startStepDiscardOf(shell.playerView) !== undefined) {
      return true;
    }
    // 2. The PRELUDES phase IS the deployment, it survives a reload, and a
    //    play-from-hand raised in it can only be a prelude's effect
    //    (`PlayProjectCard`) — the same prompt would otherwise open a
    //    STANDALONE hand, throwing the player out of a flow they had not left.
    if (shell.game.phase !== Phase.PRELUDES) {
      return false;
    }
    // 3. A PRELUDE's own step (P55 · FN): its discard (`startStepDiscardOf`) and its colony pick (the build names
    //    its prelude on `choiceContext` — `Executor`'s `cause`, PL-1591) are steps of the start that played it — a
    //    reload mid-step stands the start back up around them (the P48 gap: the colony pick came back as a screen of
    //    its own, the discard as a plate over the board).
    if (task?.kind === 'handSelect' && startStepDiscardOf(shell.playerView) !== undefined) {
      return true;
    }
    // …and its «which tile next» (P58 · FS — `startPlacementOrderOf`): the order step between its placements stands
    // the start back up around it after a reload, never a band of the task host.
    if (startPlacementOrderOf(shell.playerView) !== undefined) {
      return true;
    }
    const source = shell.playerView.waitingFor?.choiceContext?.source;
    if (task?.kind === 'colony' && source?.kind === 'card' && source.card !== undefined &&
        getCard(source.card)?.type === CardType.PRELUDE) {
      return true;
    }
    // …and its DELEGATE GRANT (P60 · FW — Rise to Power's series, `startPreludeGrantOf`): a reload inside «2 / 3» stood
    // a Parliament of its own («ПАРЛАМЕНТ › ГОЛОСОВАНИЕ») — the start comes back and hosts the vote as its scene step.
    if (task?.kind === 'party' && startPreludeGrantOf(shell.playerView) !== undefined) {
      return true;
    }
    return task?.kind === 'projectCard' && task.mode === 'playFromHand';
  });

  /**
   * THE START's FRAME LEAVES BY LEVEL, NOT ONLY ON ITS EDGE. `startFrameLive` falling closes the frame — a row of the
   * shell's table, an EDGE (`whenStartFrameLiveChanges`). A frame of the start that comes onto the live stack AFTER
   * that edge — back from aside or from a park, or stood up again by a door that carried it — met no edge at all: it
   * stood past its commit with nothing holding it («stands by nothing», the strand's own word), serving nothing
   * under the game's menu, until the opening's door released it and named a defect (the second seat of `fz3` · duo ·
   * `parliament`: four walks of four on CI — run 45156087552 — and on the box on two heads). Whenever the frame
   * APPEARS on the live stack while the start is not live, it is closed at once — the same verb the edge runs. (The
   * edge keeps its own place in the tick; this reaction acts on the frame's appearance only.)
   */
  watch(() => workspaceFrameIndex('start') !== -1, (onStack) => {
    if (onStack && !startFrameLive.value) {
      closeWorkspaceRoot('start');
    }
  });

  /**
   * A STAGE NOBODY IS THERE TO RUN IS OVER BY THE SERVER's WORD. The opening's two stage machines (the corporation's
   * first action, the bonus actions) are MODULE state — they survive the scene's unmount — but what ENDS them is the
   * scene: its leave runs when the chain is quiet (`ConsoleStartScene.firstActionLeaveDue` — «the action menu is the
   * honest END: … holding the stage for it would leave the workspace standing for the rest of the game»). A scene
   * that is not mounted runs nothing. The start's minimize goes through the PARK: with its frame parked the scene is
   * gone, and if the opening's remaining questions are then answered where this page cannot see them (the same seat
   * on a second device or tab; a game the hub moved on) the stage stands at `performing` for good — and a stage that
   * is not at rest keeps the start SERVING (`startSceneServes`), so its frame stays the phase's root for the rest of
   * the game: every question after it stood stranded under «start:browse» until the arbiter parked the root again,
   * the pass read «сначала завершите текущее действие» with nothing to finish, and the draft of every generation was
   * opened by a cure. (The autopilot in the bottle, 2026-11-24 — game 50 of 49…72, run 45433101055: thirteen classes
   * of one incident — `liveness/stall/unserved/cardselect/start:browse/stranded`, `stranded-prompt`, `covered-prompt`,
   * `dead-end/surface:start`, the mandatory lease expired and quarantined, `band-APART` ×130 — issues #119…#132.)
   *
   * The rule, by LEVEL: a stage not at rest · the start's frame PARKED (a scene on the live stack runs its own leave,
   * and a frame not known at all is the bonus turn's «let go completely» — it comes back for its ending) · the
   * server's word that the opening is over for this seat (`openingOverByServer`) · no claim, no step of the start's
   * · and nothing presenting that could still be the stage's (a reveal, a hold, a delivery, a submit on the wire).
   * Then the stages fold (`foldStartActStages`), the start stops serving, its anchor is dead (`startAnchorDead`) and
   * the parked frame is pruned by the stack's own rule — at once, so the pass is no longer refused for «a decision
   * set aside» that nobody can return to. Confirmed off the flush — a tick and a frame — like every release of the
   * opening.
   */
  /**
   * THE SERVER's WORD THAT THE OPENING IS OVER FOR THIS SEAT — the scene's own «honest END», asked of the truth
   * alone: it asks the ACTION MENU (the one title the menu's check may read — it is never rewritten) that is not the
   * corporation's first action, with nothing of the opening on its ledgers (a first action, a bonus action, a
   * placement order); or the generation is past the first. A prelude's own placement or pick mid-opening is NOT it.
   */
  const openingOverByServer = computed((): boolean => {
    const view = shell.playerView;
    // THE GENERATION, OR THE SEAT's PASS, FIRST (CI's autopilot, game 333): a first action the seat passed over stays
    // on its ledger into every later generation — read before them, «owed» kept the opening alive for the rest of the
    // game (the draft over the start's frame, the director's cure by level). The opening is generation 1, unpassed.
    if (view.game.generation > 1 || !corpFirstActionInStartFlow(view)) {
      return true;
    }
    if (firstActionOwed(view) || bonusActionOwed(view) || startPlacementOrderOf(view) !== undefined) {
      return false;
    }
    const wf = view.waitingFor;
    const title = wf?.title;
    return wf !== undefined && wf.type === 'or' && wf.startGamePrompt === undefined &&
      isActionMenuTitle(typeof title === 'string' ? title : title?.message);
  });

  /**
   * THE START's ANCHOR IS DEAD (the stack's dead-anchor rule asks, through the shell's `deadPhaseAnchors`): the start
   * no longer lives AND the server has said the opening is over. A frame of the start still off stage then — parked
   * by the player's own minimize — has nothing left to come back to, and goes by the same rule as a parked draft or
   * sitting of a phase that ended. (Never on `startFrameLive` alone: between two questions of the opening it may
   * fall for a tick, and a parked root must survive that.)
   */
  const startAnchorDead = computed((): boolean => {
    return !startFrameLive.value && openingOverByServer.value;
  });

  /**
   * THE LIFETIME HOLD OF A SCENE THAT IS NOT THERE TO LET IT GO (#128 — CI's bottle game 285, read by the stack's trail:
   * the opening minimized, finished while parked, A «Вернуться» — `restoreWorkspaceStack start` — and a start serving
   * nothing stood until the start director's level door released it). The scene's hold is let go by its OWN release
   * beat, which a parked scene — unmounted — never plays; the hold then kept `startSceneServes` and with it
   * `startFrameLive`, so the anchor of an opening the server had ended never died and the park brought the start back.
   * A held scene whose frame is parked, the opening over by the server's word and nothing of it owed, lets its hold go:
   * the anchor dies, the park's dead-frame rule drops the frame, and the way back has nothing to bring back.
   */
  const startHoldOrphaned = computed((): boolean => {
    return startSceneHeld() && workspaceFrameParked('start') && openingOverByServer.value && startTask.value === undefined &&
      !startHeroPlaying() && !hostedStepOwedTo('start') && !hostedStepLiveIn('start') && !workspaceFrameHasNested('start') &&
      !(workspaceOutcomeState.host === 'start' && workspaceOutcomeState.sourceCard !== '');
  });
  watch(startHoldOrphaned, (orphaned) => {
    if (orphaned) {
      releaseStartScene();
    }
  });

  const startStagesOrphaned = computed((): boolean => {
    if (consoleStartState.firstAct.stage === 'idle' && consoleStartState.bonusAct.stage === 'idle') {
      return false;
    }
    if (!workspaceFrameParked('start') || !openingOverByServer.value) {
      return false;
    }
    if ((workspaceOutcomeState.host === 'start' && workspaceOutcomeState.sourceCard !== '') ||
        workspaceFrameHasNested('start') || hostedStepOwedTo('start') || hostedStepLiveIn('start')) {
      return false;
    }
    return !consoleStartState.firstAct.submitting && !startSceneHeld() && !startHeroPlaying() &&
      shell.admits('scene') && currentRevealEvent() === undefined && !isHandDeliveryActive() &&
      blockingAnimationHoldCount() === 0;
  });
  let orphanFoldToken = 0;
  watch(startStagesOrphaned, (orphaned) => {
    if (!orphaned) {
      return;
    }
    const token = ++orphanFoldToken;
    void shell.$nextTick(() => {
      const confirm = (): void => {
        if (token !== orphanFoldToken || !startStagesOrphaned.value) {
          return;
        }
        const stood = foldStartActStages();
        // (…A SEAT THAT PASSED ended its opening ITSELF — the pass closes the generation and, in the first, the opening
        // with it (`corpFirstActionInStartFlow`): the parked stage folding then is the pass's own end, never news from
        // elsewhere. CI's autopilot on `4f01936956`, game 407: B on the first action, LT, the pass.)
        if (viewerHasPassed(shell.playerView)) {
          return;
        }
        // (…and A FIRST ACTION THE PLAYER SUBMITTED, finished while they kept the opening folded — B over its follow-up,
        // the board's placement answered on the board — is that action's own end: the stage stood `performing`, the
        // server took its last answer, nothing of it is left to show. The box's lanes on `1bfeff8d9a`, game 2901.)
        if (stood.first === 'performing' && !firstActionOwed(shell.playerView)) {
          return;
        }
        console.warn(`[start-stage] the opening's stage (first action «${stood.first}», bonus «${stood.bonus}») folded by the server's word — ` +
          `its frame stood parked with no scene to run its leave, and the server asks «${shell.playerView.waitingFor?.type ?? 'nothing'}» of the game ` +
          `(generation ${shell.playerView.game.generation})`);
      };
      if (typeof requestAnimationFrame === 'function') {
        // A RELEASE of the opening: the frame, or shortly when none comes, or the shell's own end.
        void whenPainted(1, 50, flow).then(confirm);
      } else {
        confirm(); // server-runner / jsdom — no frame clock to wait on
      }
    });
  }, {immediate: true});

  /**
   * The MINIMIZED START's own copy — the start workspace is the one surface
   * that legitimately stands with NO live prompt (the table is still
   * confirming), so the shared task summary has nothing to say about it.
   * The keys come from the start's own pure model (never a literal here).
   */
  const startDeferSummary = computed((): {kickerKey: string, askKey: string, returnKey: string} | undefined => {
    if (shell.activeTaskSummary !== undefined || !startSceneServes.value) {
      return undefined;
    }
    if (startAwaitingOthers(shell.playerView)) {
      return startDeferredSummary('awaiting-table');
    }
    // The deployment's cards are through and the one thing left is the
    // corporation's first action, waiting for the player's turn — say so.
    // (…owed AS THE OPENING's: a seat that passed over it is not waiting for its turn to take it — `corpFirstActionInStartFlow`.)
    if (corpFirstActionInStartFlow(shell.playerView) && firstActionOwed(shell.playerView) && shell.playerView.waitingFor === undefined) {
      return startDeferredSummary('awaiting-first-action');
    }
    return startDeferredSummary('in-progress');
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * Confirm the start excursion's release OFF the synchronous flush: the
   * quiet condition is re-read after a tick + a frame, so a hand-off gap
   * between two chain signals (the tile transaction finishing in the same
   * response that stages the bonus reveal) can never release the barrier
   * mid-chain. Deterministic — a re-check of live state, never a duration.
   */
  function scheduleStartExcursionRelease(): void {
    const token = ++excursionReleaseToken.value;
    void shell.$nextTick(() => {
      const confirm = () => {
        if (token !== excursionReleaseToken.value) {
          return; // a newer beat superseded this check
        }
        if (boardExcursionActive() && startExcursionQuietNow.value) {
          releaseBoardExcursion();
        }
      };
      if (typeof requestAnimationFrame === 'function') {
        // A RELEASE (the excursion's barrier): the frame, or shortly when none comes, or the shell's own end.
        void whenPainted(1, 50, flow).then(confirm);
      } else {
        confirm(); // server-runner / jsdom — no frame clock to wait on
      }
    });
  }

  /**
   * THE START'S HOSTED STEP — a walk (TRP1 Lobbying Campaign — rule 3: the grant asked nothing, the record rode
   * the play's own answer) or a rally (TRP2 Unity Campaign — the support behind the colony): the Parliament is
   * pushed onto the START as its scene step (the start row's `frameSteps: {parliament: 'scene'}` — the same
   * handover as the first action's party step) AT THE RECORD'S OWN STAGE, and the section's own pose opens on the
   * owed record (`walkOwedSeq` / `rallyOwedSeq` — the immediate watchers read that stage). A beat (`executing`):
   * input is absorbed for the step's length, B is not offered. The step leaves by its own hand
   * (`onParliamentFlowComplete('walk' | 'rally')` → one level up).
   */
  function enterStartHostedStep(kind: HostedParliamentStepKind): void {
    const flow = kind === 'walk' ? agendaWalkFlow : neutralRallyFlow;
    const owed = flow.owed;
    if (owed === undefined || owed.host !== 'start' || flow.live || workspaceFrameKnown('parliament')) {
      return;
    }
    takeUpQuestion('step-opened');
    pushWorkspaceFrame({
      kind: 'parliament',
      subject: '',
      stage: kind === 'walk' ? AGENDA_WALK_STEP_STAGE : NEUTRAL_RALLY_STEP_STAGE,
      phase: 'executing',
      serves: [],
      anchor: {type: 'always'},
      sourceCard: owed.card ?? '',
    });
  }

  /**
   * THE START'S VOTE STEP CONTINUES INTO THE WALK (TRP1 — the printed order «delegates, then the Agenda step»):
   * the same section, one stage deeper — the frame's tail advances («ГОЛОСОВАНИЕ» → «КАРЬЕРА»), its phase is the
   * walk's beat, and the section opens the walk pose on the record it already holds. Never a close followed by an
   * open: the vote's cubes stay where they landed while the marker walks.
   */
  function continueStartWalkInPlace(): void {
    const owed = agendaWalkFlow.owed;
    if (owed === undefined || owed.host !== 'start' || agendaWalkFlow.live) {
      return;
    }
    setWorkspaceFrameStage('parliament', AGENDA_WALK_STEP_STAGE);
    setWorkspaceFramePhase('parliament', 'executing');
    const section = shell.surfaces.at<ExposedOf<typeof ConsoleParliamentSection>>('parliamentSection');
    void shell.$nextTick(() => {
      if (agendaWalkFlow.owed?.host === 'start' && !agendaWalkFlow.live) {
        section?.openWalkFlow();
      }
    });
  }

  /** The start's hosted step has come DUE (a Prelude's walk with no vote step to continue in, a campaign's rally): the Parliament opens as its scene step. */
  function whenStartHostedStepDueChanges(kind: HostedParliamentStepKind | ''): void {
    if (kind !== '') {
      enterStartHostedStep(kind);
    }
  }

  /**
   * A STRAND (the reliability iteration of 2026-10-28, `startServing.ts`): a scene serving NOTHING while the server
   * asks. It is NAMED (`[start-stranded]` — the live prompt, the placement's admission block, the scene's own stage
   * machine and blockers: the one line a field export needs) and HEALED by the scene's own phrases (`healStrand`); a
   * strand that still stands hands the question to the shell's surfaces (`startStrandYield`) — the player is never
   * left in front of an empty start. Both by LEVEL (`whenStartStrandedNowChanges` — the strand's door).
   */
  /** What is painted ON TOP at five points of the screen — the nearest console surface of each (diagnosis only). */
  function paintedSurfaces(): Array<string> {
    if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') {
      return [];
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const points: ReadonlyArray<readonly [number, number]> = [[0.5, 0.5], [0.25, 0.3], [0.75, 0.3], [0.25, 0.7], [0.75, 0.7]];
    return points.map(([x, y]) => {
      const el = document.elementFromPoint(Math.round(w * x), Math.round(h * y));
      const surface = el?.closest('.con-start, .con-ws, .con-colonies, .con-hand, .con-board, .con-root');
      const own = (surface ?? el)?.classList;
      return own === undefined || own.length === 0 ? (el?.tagName.toLowerCase() ?? 'nothing') : `.${own[0]}`;
    });
  }

  /** The strand as the opening's measure names it: the question, and the doors the heal would open now. */
  function strandKey(): string {
    const wf = shell.playerView.waitingFor;
    // (Read off the scene's own diagnostic probe — the measure adds no reach of its own into the scene.)
    const plan = (window as unknown as {__conStartDiag?: () => {strandPlan?: Array<string>}}).__conStartDiag?.().strandPlan ?? [];
    return `STRAND ${wf?.type ?? ''}:${wf?.startGamePrompt?.kind ?? taskFor(shell.playerView)?.kind ?? ''} · plan ${plan.join('+') || 'nothing'}`;
  }

  /** Why the scene serves nothing, read off its own probe (`__conStartDiag` — the measure adds no reach of its own). */
  function strandWhy(): string {
    type Diag = {
      mode?: string, flow?: string, ceremonyRevealed?: boolean, serves?: string, flowStage?: string,
      firstAct?: {stage?: string, entryDue?: boolean, nested?: boolean, panelShown?: boolean},
      bonusAct?: {stage?: string, entryDue?: boolean},
      seat?: {flight?: unknown, owner?: unknown},
      blockers?: Record<string, unknown>,
      settle?: {settled?: boolean, hold?: boolean, reaction?: string, embed?: string, firstOwed?: boolean, bonusOwed?: boolean, legacy?: boolean, deliveryHeld?: number},
    };
    const diag = (window as unknown as {__conStartDiag?: () => Diag}).__conStartDiag?.();
    if (diag === undefined) {
      return 'no scene';
    }
    // EVERY holder, not the first: «another prompt stands» is true of every strand under the game's menu, and as the
    // first of the list it hid whichever term really kept the deployment from settling (the box's strand of
    // `game > none`, 2026-11-23 — named «blocked by otherPromptStands» and nothing else). The settle's own terms too.
    const blockers = Object.entries(diag.blockers ?? {})
      .filter(([, v]) => v === true || (typeof v === 'number' && v > 0) || (Array.isArray(v) && v.length > 0))
      .map(([name]) => name);
    const settle = diag.settle ?? {};
    const unsettled = [
      settle.settled === true ? 'settled' : '',
      settle.hold === false ? 'no hold' : '',
      settle.reaction !== undefined && settle.reaction !== 'idle' ? `reaction ${settle.reaction}` : '',
      settle.embed !== undefined && settle.embed !== '' ? 'embed' : '',
      settle.firstOwed === true ? 'first owed' : '',
      settle.bonusOwed === true ? 'bonus owed' : '',
      settle.legacy === true ? 'legacy' : '',
      (settle.deliveryHeld ?? 0) > 0 ? 'delivery held' : '',
    ].filter((term) => term !== '');
    return `why ${diag.mode ?? ''}/${diag.flow ?? ''}/${diag.flowStage ?? ''}${diag.ceremonyRevealed === false ? ' unrevealed' : ''} · ` +
      `first ${diag.firstAct?.stage ?? ''}${diag.firstAct?.entryDue === true ? ' due' : ''}${diag.firstAct?.nested === true ? ' nested' : ''} · ` +
      `bonus ${diag.bonusAct?.stage ?? ''}${diag.bonusAct?.entryDue === true ? ' due' : ''} · seat ${String(diag.seat?.owner ?? 'free')}/${String(diag.seat?.flight ?? '')} · ` +
      `blocked by ${blockers.length === 0 ? 'nothing' : blockers.join('+')} · settle ${unsettled.length === 0 ? 'open' : unsettled.join('+')} · ` +
      `stands by ${startStandsBy()}`;
  }

  function whenStartStrandedNowChanges(now: boolean): void {
    cancelStrandLook();
    cancelStrandLook = () => {};
    strandCure.heal = () => {};
    strandCure.yieldToShell = () => {};
    strandCure.healed = () => false;
    // THE OPENING's MEASURE (stage 2b): a strand is a SPAN from its rise. Stats only.
    noteOpeningSpan('strand', now ? strandKey() : '', 'cleared', Date.now());
    if (!now) {
      noteOpeningSpan('strand-door', '', 'cleared', Date.now());
      // …AND HOW MANY PAINTED FRAMES IN A ROW IT STOOD QUIET — the door's own unit (a door counts frames: a machine
      // four times slower makes a mount's 200 ms into 800, and the same three frames). One count per strand.
      if (strandQuiet.key !== '') {
        noteOpeningSpan('strand-frames', `STRAND-FRAMES ${strandQuiet.key} · quiet ${Math.min(strandQuiet.max, 60)} frame(s) in a row`, 'cleared', Date.now());
        noteOpeningSpan('strand-frames', '', 'counted', Date.now());
        strandQuiet.key = '';
      }
      return;
    }
    // …AND WHAT IS IN FLIGHT UNDER IT, BY FRAME (the STRAND-DOOR track — what a level door of the watchdog's own cure
    // would have to wait out). The watchdog is not the director's twin: it reads a hosted step that does not answer
    // the asked question as serving NOTHING (`hostedStepServes` — «a strand dressed as a step»), where the director
    // reads `step` and has no cure — so its retirement is its OWN door by level, and that door's «quiet» has to be
    // read first: the suite stands 52 strands of «the game asks» up to 1.26 s, every one ending by itself (CI run
    // 45071347931), and nothing yet says how many frames of them were quiet. Stats only — nothing here acts.
    const stood = strandKey();
    strandQuiet.key = stood.replace(/^STRAND /, '');
    strandQuiet.frames = 0;
    strandQuiet.max = 0;
    let door = levelDoorInit();
    const look = (): void => {
      const flight = flightsInTheAir();
      strandQuiet.frames = flight === '' ? strandQuiet.frames + 1 : 0;
      strandQuiet.max = Math.max(strandQuiet.max, strandQuiet.frames);
      // THE STRAND's DOOR BY LEVEL: quiet for its bar → the heal; STILL a strand and quiet for the bar again → the
      // yield (a second state of the same strand, with its own one opening).
      // ONE STATE — ONE DOOR. A strand the DIRECTOR would cure (it reads the same screen as a disagreement its level
      // door may act on) is the opening's door's, on the same bar: this one does not stand for it at all. Its own
      // case is the one the director has no cure for — a hosted step that does not answer the asked question, read
      // `step` there and «nothing» here. (Until 2026-11-23 the two were kept apart by their bars alone — eight frames
      // against twelve — and on one bar both healed one strand in one frame.)
      const mine = !directorDoorOwnsNow();
      const seen = observeLevelDoor(door, {key: !mine ? undefined : strandCure.healed() ? `${stood} · healed` : stood, quiet: flight === '', now: Date.now()},
        {frames: START_STRAND_DOOR_QUIET_FRAMES, ms: START_STRAND_DOOR_QUIET_MS});
      door = seen.state;
      if (seen.open) {
        if (strandCure.healed()) {
          strandCure.yieldToShell('level');
        } else {
          strandCure.heal('level');
        }
      }
      // (A QUIET strand says WHY the scene serves nothing, in the scene's own words — its probe: the stage machines and
      // the first of the entry's blockers that holds. «Quiet for 184 ms under the first action's question, in nine
      // tests» named a wait nobody declared and nothing to find it by.)
      noteOpeningSpan('strand-door', `${stood.replace(/^STRAND/, 'STRAND-DOOR')} · ${flight === '' ? `QUIET{${strandWhy()} · ${standingDigest()}}` : `busy[${flight}]`}`, 'moved', Date.now());
    };
    look();
    cancelStrandLook = flow.everyFrame('the strand, measured by frame', look);
    const report = (stage: string, extra: Record<string, unknown> = {}): void => {
      const wf = shell.playerView.waitingFor;
      const diag = (window as unknown as {__conStartDiag?: () => unknown}).__conStartDiag?.();
      console.warn(`[start-stranded] ${stage} — the start serves nothing while the server asks «${wf?.type ?? ''}` +
        `${wf?.startGamePrompt !== undefined ? ':' + wf.startGamePrompt.kind : ''}»`, JSON.stringify({
        ...extra,
        task: taskFor(shell.playerView)?.kind ?? null,
        placementBlock: wf?.type === 'space' ? promptAdmissionBlock('placement', shell.admissionSignals) ?? null : null,
        hostBlock: promptAdmissionBlock('host', shell.admissionSignals) ?? null,
        frames: workspaceStackState.frames.map((f) => `${f.kind}:${f.phase}`),
        // (What the hosted step itself is doing — at rest, or on its own entry / leave.)
        hand: `${handRevealState.phase}/${consoleState.section}`,
        // WHOSE the frames above the start are, and WHAT THE PLAYER ACTUALLY SEES. `kind@anchor/standing`: `always` is
        // a layer the player walked into («the player goes to a screen» — it stands OVER the start, `overlay`),
        // `prompt` a step a flow opened for a question (`embed`). `painted`: the surface on top at the middle of the
        // screen and at its four quarters, read off the page. `fz3` · `duo` · `parliament` (8 walks of 8, 2026-11-18):
        // `start:committed` under `colonies:browse` with nothing in flight — and nothing in the line to tell the
        // player's own colony rail standing over a finished start (their wait) from a start painting over it (a dead
        // screen with the pad somewhere else).
        above: workspaceStackState.frames.slice(1).map((f) => `${f.kind}@${f.anchor.type}/${f.overlay ? 'overlay' : 'embed'}`),
        visible: startSceneVisible.value,
        painted: paintedSurfaces(),
        // …and what is still IN FLIGHT on a hosted workspace: a strand is «at rest» only when nothing of the step's own
        // is — its tokens (an in-surface wave holds the FEED only, so no blocking hold says it), any hold at all, and
        // the conclusion the frame was last refused (which workspace, by which named hold, how long ago). Evidence:
        // `fz3` · `duo` · `parliament`, 2026-11-18 — `start:committed` over `colonies:browse`, and nothing in the line
        // to tell a colony grid still paying its build from one left standing.
        transfers: `${isResourceTransferActive() ? 'wave' : ''}${isInSurfaceResourceTransferActive() ? ' in-surface' : ''}`.trim() || 'none',
        holds: [...activeAnimationHoldLabels()],
        refused: conclusionRefusal.last === undefined ? null :
          `${conclusionRefusal.last.kind}:${conclusionRefusal.last.reason} ${Math.round((Date.now() - conclusionRefusal.last.at) / 100) / 10}s ago`,
        diag: diag ?? null,
      }));
    };
    // THE CURE, IN ITS TWO VERBS — the scene's own doors (and the router's for a step nothing hosts any more: R15), then
    // the yield. Each runs once per strand, opened by the LEVEL DOOR (`startServing.START_STRAND_DOOR_*` — the strand
    // quiet for its bar). The watchdog's two timers that stood behind it (2.5 s + 2.5 s) are RETIRED: the same
    // predicate, the same cure, sooner — and what the door cannot reach (a strand that is never quiet) is bounded by
    // the flights it waits out, with the liveness arbiter's rung `start-director` behind (stage 2b → 7).
    let healedBy: string | undefined;
    let healed = '';
    let yielded = false;
    const heal = (by: 'level'): void => {
      if (healedBy !== undefined || !startStrandedNow.value) {
        return;
      }
      healedBy = by;
      const scene = shell.surfaces.at<{healStrand?: () => string}>('startScene');
      const sceneHeal = scene?.healStrand?.() ?? 'no-scene';
      healed = sceneHeal === 'nothing-to-heal' || sceneHeal === 'no-scene' ? shell.reopenStartStep() || sceneHeal : sceneHeal;
      report('confirmed', {heal: healed, by});
      noteOpeningSpan('strand', `${stood} · HEALED ${healed}`, 'confirmed', Date.now());
    };
    const yieldToShell = (by: 'level'): void => {
      if (yielded || healedBy === undefined || !startStrandedNow.value) {
        return;
      }
      yielded = true;
      report('yielded to the shell (the heal did not end it)', {heal: healed, by});
      noteOpeningSpan('strand', `${stood} · YIELDED`, 'the heal did not end it', Date.now());
      startStrandPrompt.value = shell.playerView.waitingFor?.promptId;
      startStrandYield.value = true;
    };
    strandCure.heal = heal;
    strandCure.yieldToShell = yieldToShell;
    strandCure.healed = () => healedBy !== undefined;
  }

  /**
   * THE START DIRECTOR's JUDGE — on every CHANGE of the judged state (`startShadowSig`): who must serve by the
   * server's one question beside who does, measured, and handed to the LEVEL DOOR (`measureDoor`). The shadow's own
   * confirm that used to follow — three seconds of a standing disagreement (ten of a held prompt), a `[start-shadow]`
   * finding, the cure «by shadow» — was a net behind the door and is RETIRED with the watchdog's timers (stage 2b →
   * 7): every state it cured is a door's now — the opening's (every cure, `game > shell` included), the conclusion's
   * and the strand's for a step standing under the game's menu — and a HELD prompt is its admission block's own node
   * of the wait graph. Behind the doors stands the liveness arbiter's rung `start-director`, unchanged.
   */
  /**
   * What stands, for the door's measure: the stack's frames, the kernel's own MOTION waits (a director's beat of
   * stillness — `span` — and the frames of a paint: waits the legacy graph holds no node for) and the kernel's tree,
   * ids folded (`#N`), bounded.
   */
  function standingDigest(): string {
    const frames = workspaceStackState.frames.map((f) => `${f.kind}:${f.phase}`).join(',') || 'no frame';
    const beats = [...new Set(waitTable().filter((row) => row.family === 'motion').map((row) => `${row.owner}:${row.what}`.replace(/[0-9]+/g, 'N')))];
    return `${frames} · beats[${beats.slice(0, 4).join('+')}] · ${flowTreeDigest(6).replace(/[0-9]+/g, 'N')}`.slice(0, 260);
  }

  /**
   * THE DOORS BY LEVEL, MEASURED (stage 2b ② — `servingOwnerMeasure`, the DOOR track): while the director would ACT
   * on what stands (`heal` · `yield` · `release`), what is in flight is read every frame. Stats only — nothing here
   * opens a door.
   */
  /** Does the DIRECTOR's level door own what stands right now — a judged disagreement it may act on? (A live read of
   *  the same pure functions the door is armed by: `whenStartShadowSigChanges`.) */
  function directorDoorOwnsNow(): boolean {
    const s = startShadowNow.value;
    if (!startShadowInScope(s.expected, s.actual) || sceneTransitionInputLocked()) {
      return false;
    }
    return startShadowVerdict(s.expected, s.actual, s.held) === 'disagree' &&
      startLevelDoorMay({kind: 'disagree', expected: s.expected, actual: s.actual});
  }

  function measureDoor(question: string, state: string, cure: string, ended: string, door?: Pick<StartShadowFinding, 'kind' | 'expected' | 'actual'>): void {
    cancelDoorLook();
    cancelDoorLook = () => {};
    if (cure === '' || cure === 'none') {
      noteOpeningSpan('door', '', ended, Date.now());
      return;
    }
    // THE LEVEL DOOR (`startDirector.START_LEVEL_DOOR_QUIET_FRAMES` ∧ `…_MS` — the family's bar, `levelDoor.ts`): the
    // director would act, and nothing has been in flight for that many painted frames and that long — the cure goes
    // through the doors that already exist, ONCE per standing state (a door that changed nothing leaves the state to
    // the liveness arbiter's rung, which names it).
    let level = levelDoorInit();
    const standing = `${question}|${state}|${cure}`;
    const look = (): void => {
      const flight = flightsInTheAir();
      // THE ONE STATE THE DOOR STAYS SHUT IN (`startLevelDoorMay` — a step standing on the start under the game's
      // menu) says WHAT STANDS while it is quiet: the stack's frames and the kernel's own tree. Whose time it is — a
      // result being read, a dwell nobody declared to the wait graph, a strand — is read off this, over the suite,
      // before `release` becomes a level there too.
      const quietWord = flight !== '' ? '' : door === undefined ? `QUIET{${standingDigest()}}` : 'QUIET';
      noteOpeningSpan('door', `DOOR ${question} · ${state} · ${cure} · ${flight === '' ? quietWord : `busy[${flight}]`}`, 'moved', Date.now());
      const seen = observeLevelDoor(level, {key: standing, quiet: flight === '', now: Date.now()},
        {frames: START_LEVEL_DOOR_QUIET_FRAMES, ms: START_LEVEL_DOOR_QUIET_MS});
      level = seen.state;
      if (seen.open && door !== undefined) {
        shell.runStartDirectorCure(door, 'level');
      }
    };
    look();
    cancelDoorLook = flow.everyFrame('the opening\'s doors, by level', look);
  }

  function whenStartShadowSigChanges(_sig: string): void {
    const s = startShadowNow.value;
    // The boot curtain is not the start: nothing is mounted under it yet (the field's «wizard → game» 5.5 s after
    // the page loaded, 2026-10-31 22:14).
    const question = s.prompt.replace(/#.*$/, '');
    if (!startShadowInScope(s.expected, s.actual) || sceneTransitionInputLocked()) {
      noteOpeningLook({question, expected: s.expected, actual: s.actual, verdict: 'out', cure: ''}, Date.now());
      measureDoor(question, '', '', 'out');
      return;
    }
    startShadowLog.judged++;
    const verdict = startShadowVerdict(s.expected, s.actual, s.held);
    // THE OPENING's MEASURE (stage 2b — `servingOwnerMeasure.noteOpeningLook`): every judged state, and what the
    // director would do about a disagreement AT ONCE. Stats only.
    noteOpeningLook({
      question, expected: s.expected, actual: s.actual, verdict,
      cure: verdict === 'held' ? s.held ?? '' : verdict === 'disagree' ? startDirectorCure({kind: 'disagree', expected: s.expected, actual: s.actual}) : '',
    }, Date.now());
    const disagreement = {kind: 'disagree' as const, expected: s.expected, actual: s.actual};
    measureDoor(question, `${s.expected}>${s.actual}`, verdict === 'disagree' ? startDirectorCure(disagreement) : '', `${verdict}:${s.expected}>${s.actual}`,
      verdict === 'disagree' && startLevelDoorMay(disagreement) ? disagreement : undefined);
  }

  /** The question the strand was yielded for is answered (or replaced): the start takes its screen back. */
  function whenPlayerViewWaitingForPromptIdChanges(id: number | undefined): void {
    if (startStrandYield.value && id !== startStrandPrompt.value) {
      startStrandYield.value = false;
      startStrandPrompt.value = undefined;
    }
    // …and the hosted hand step lives for its question (`handController` — CI #148): ONE reaction of the edge, in order.
    shell.whenHostedHandQuestionChanges(id);
  }

  /**
   * THE COMPLETION BARRIER of a start-flow board placement (see
   * startBoardExcursion.ts). ENGAGE is the rising edge of «the serving
   * workspace yielded to a placement»; the RELEASE is owned by the quiet
   * watcher below and is confirmed a tick + a frame later, so the one
   * moment two chain signals hand off (tile settle → reveal claim) can
   * never read as «the chain is over».
   */
  function whenStartExcursionEngageChanges(now: boolean): void {
    if (now) {
      engageBoardExcursion('start');
    }
  }

  /** WATCH `startExcursionQuietNow` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenStartExcursionQuietNowChanges(now: boolean): void {
    if (now && boardExcursionActive()) {
      scheduleStartExcursionRelease();
    }
  }

  return {
    startStrandYield,
    startStrandPrompt,
    excursionReleaseToken,
    setupHandPending,
    startTask,
    bonusTurnLive,
    startSceneServes,
    startSceneVisible,
    startYieldsForHeldPlacement: ownStartYieldsForHeldPlacement,
    startStrandedNow,
    startShadowNow,
    startShadowSig,
    startSceneMounted,
    startExcursionHolds,
    startExcursionEngage,
    startExcursionQuietNow,
    startSceneOwnsPad,
    startPromptSurfaceStands,
    startPartyStepDue,
    startHostedStepDue,
    startDiscardStepOwed,
    startDiscardStepDue,
    startSponsorEmbed,
    startFrameLive,
    startAnchorDead,
    startDeferSummary,
    scheduleStartExcursionRelease,
    enterStartHostedStep,
    continueStartWalkInPlace,
    whenStartHostedStepDueChanges,
    whenStartStrandedNowChanges,
    whenStartShadowSigChanges,
    whenPlayerViewWaitingForPromptIdChanges,
    whenStartExcursionEngageChanges,
    whenStartExcursionQuietNowChanges,
  };
}

export type StartController = ReturnType<typeof createStartController>;
