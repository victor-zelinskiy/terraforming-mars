/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE START CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed, ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {blockingAnimationHoldCount} from '@/client/components/presentation/animationHold';
import ConsoleParliamentSection from '@/client/components/console/ConsoleParliamentSection.vue';
import {agendaWalkFlow} from '@/client/console/parliament/agendaWalk';
import {neutralRallyFlow} from '@/client/console/parliament/neutralRally';
import {HostedParliamentStepKind, hostedStepLiveIn, hostedStepOwedTo, startHostedStepToEnter, startPreludeGrantOf} from '@/client/console/parliament/hostedParliamentStep';
import {ConsoleRevealMode} from '@/client/components/console/consoleRevealOverlayTypes';
import {workspaceHostYieldsScene, pushWorkspaceFrame, setWorkspaceFramePhase, setWorkspaceFrameStage, workspaceFrameHasNested, workspaceFrameMounted, workspaceFrameHost, workspaceFrameKnown, workspaceHostForStep, workspaceStackState, stackServes} from '@/client/console/consoleWorkspaceStack';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {isHandDeliveryActive} from '@/client/console/handDock/handDeliveryDirector';
import {Phase} from '@/common/Phase';
import {CardType} from '@/common/cards/CardType';
import {consoleStartState, startAwaitingOthers, startCorporationPlayed, startDeferredSummary, startHeroPlaying, startSceneHeld} from '@/client/console/consoleStartState';
import {boardExcursionActive, boardExcursionQuiet, engageBoardExcursion, releaseBoardExcursion} from '@/client/console/boardExcursion';
import {bonusActionInStartFlow, bonusActionOnBoard} from '@/client/console/bonusAction';
import {firstActionOwed} from '@/client/console/startFirstAction';
import {isResourceTransferActive} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {ConsoleTask, taskFor, promptOutranksStartScene, SCENE_KINDS, corpFirstActionInStartFlow, startStepDiscardOf, startPlacementOrderOf, AGENDA_WALK_STEP_STAGE, NEUTRAL_RALLY_STEP_STAGE, firstActionPartyStep} from '@/client/console/consoleTaskRouter';
import {ConsoleTaskSummary} from '@/client/console/consoleTaskSummary';
import {sceneTransitionInputLocked} from '@/client/console/loadingScreenState';
import {govScaleFocusState} from '@/client/console/consoleGovScaleFocus';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {isBoardCardBonusActive} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {cardReactionState} from '@/client/console/cardReaction/cardReactionStage';
import {getCard} from '@/client/cards/ClientCardManifest';
import {consoleState} from '@/client/console/consoleRouter';
import {isConsoleHandPickActive} from '@/client/console/consoleHandPick';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {isMandatoryGateHeld} from '@/client/console/consoleMandatoryGate';
import {START_STRAND_CONFIRM_MS, START_STRAND_YIELD_MS, startStranded, startYieldsForHeldPlacement} from '@/client/console/startServing';
import {ActualStartOwner, START_SHADOW_CONFIRM_MS, START_SHADOW_HELD_MS, StartOwner, StartShadowFinding, actualStartOwner, expectedStartOwner, recordStartShadowFinding, startShadowInScope, startShadowLog, startShadowVerdict} from '@/client/console/startDirector';
import {isActionMenuTitle} from '@/common/inputs/actionMenuTitles';
import {AdmissionSignals, PromptSurface, promptAdmissionBlock} from '@/client/console/consolePromptAdmission';
import type {ConvertController} from '@/client/console/shell/convertController';
import type {MaController} from '@/client/console/shell/maController';
import type {SupervisorController} from '@/client/console/supervisor/supervisorController';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type StartPort = {
  $nextTick(fn?: () => void): Promise<void>,
  $refs: Record<string, unknown>,
  readonly activeTaskSummary: ConsoleTaskSummary | undefined,
  readonly admissionSignals: AdmissionSignals,
  admits(surface: PromptSurface): boolean,
  readonly colonyEmbedActive: boolean,
  readonly consoleRevealMode: ConsoleRevealMode | undefined,
  convertPlantsPending: UnwrapRef<ConvertController['convertPlantsPending']>,
  readonly deckPickServing: boolean,
  game: UnwrapRef<MaController['game']>,
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
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** THE START WATCHDOG (`startServing.ts`): a strand the heal could not end hands its question to the shell's own
   *  surfaces (the scene yields) until the prompt changes; the two timers are the confirm and the heal's grace. */
  const startStrandYield = ref(false);
  const startStrandTimer = ref(undefined as number | undefined);
  const startStrandPrompt = ref(undefined as number | undefined);
  /** THE START SHADOW (`startDirector.ts`, phase 0): the confirm timer of a disagreement / a long hold. */
  const startShadowTimer = ref(undefined as number | undefined);
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
    return startTask.value !== undefined || startSceneHeld() || startHeroPlaying() ||
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
    const serves = consoleStartState.serves === 'step' && task !== undefined && !stackServes(task.kind) &&
      startPlacementOrderOf(shell.playerView) === undefined ? 'none' : consoleStartState.serves;
    return startSceneMounted.value && !startStrandYield.value && startStranded({
      serves,
      promptLive: wf !== undefined && wf.optional !== true,
      // A STORY never stands for a question (the liveness law): only a BLOCKING hold is a beat in flight — a
      // notification-only one (the scale-step rating waiting for a board the start covers) masked the field's
      // empty start of 2026-10-31.
      servedElsewhere: !startSceneVisible.value || startPromptSurfaceStands.value || shell.placementActive ||
        isConsoleHandPickActive() || consoleState.task.deferred || blockingAnimationHoldCount() > 0 ||
        isMandatoryGateHeld(),
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
    });
    const held = wf === undefined ? undefined :
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
    if (!workspaceFrameKnown('start') && workspaceOutcomeState.host !== undefined &&
        workspaceOutcomeState.host !== 'start' && workspaceOutcomeState.sourceCard !== '' &&
        workspaceFrameKnown(workspaceOutcomeState.host)) {
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
    if (firstActionOwed(shell.playerView) && shell.playerView.waitingFor === undefined) {
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
        requestAnimationFrame(confirm);
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
    consoleState.task.deferred = false;
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
    const section = (shell.$refs.parliamentSection ?? undefined) as InstanceType<typeof ConsoleParliamentSection> | undefined;
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
   * THE START WATCHDOG (the reliability iteration of 2026-10-28, `startServing.ts`): a scene serving NOTHING while
   * the server asks is confirmed after `START_STRAND_CONFIRM_MS`, NAMED (`[start-stranded]` — the live prompt, the
   * placement's admission block, the scene's own stage machine and blockers: the one line a field export needs) and
   * HEALED by the scene's own phrases (`healStrand`); a strand that outlives the heal's grace hands the question to
   * the shell's surfaces (`startStrandYield`) — the player is never left in front of an empty start.
   */
  function whenStartStrandedNowChanges(now: boolean): void {
    window.clearTimeout(startStrandTimer.value);
    startStrandTimer.value = undefined;
    if (!now) {
      return;
    }
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
        diag: diag ?? null,
      }));
    };
    startStrandTimer.value = window.setTimeout(() => {
      startStrandTimer.value = undefined;
      if (!startStrandedNow.value) {
        return;
      }
      const scene = (shell.$refs.startScene ?? undefined) as {healStrand?: () => string} | undefined;
      const sceneHeal = scene?.healStrand?.() ?? 'no-scene';
      // …and a step of the start that nothing hosts any more is re-opened through the router's own door (R15).
      const healed = sceneHeal === 'nothing-to-heal' || sceneHeal === 'no-scene' ? shell.reopenStartStep() || sceneHeal : sceneHeal;
      report('confirmed', {heal: healed});
      startStrandTimer.value = window.setTimeout(() => {
        startStrandTimer.value = undefined;
        if (!startStrandedNow.value) {
          return;
        }
        report('yielded to the shell (the heal did not end it)', {heal: healed});
        startStrandPrompt.value = shell.playerView.waitingFor?.promptId;
        startStrandYield.value = true;
      }, START_STRAND_YIELD_MS);
    }, START_STRAND_CONFIRM_MS);
  }

  /**
   * THE START SHADOW's judge (phase 0): a disagreement between the server's one question and the latch machinery is
   * a FINDING once it has stood `START_SHADOW_CONFIRM_MS` unchanged with the prompt admitted; a prompt held behind an
   * admission block for `START_SHADOW_HELD_MS` is one too. Logged once per (kind, owners, prompt) — never acted on.
   */
  function whenStartShadowSigChanges(sig: string): void {
    window.clearTimeout(startShadowTimer.value);
    startShadowTimer.value = undefined;
    const s = startShadowNow.value;
    // The boot curtain is not the start: nothing is mounted under it yet (the field's «wizard → game» 5.5 s after
    // the page loaded, 2026-10-31 22:14).
    if (!startShadowInScope(s.expected, s.actual) || sceneTransitionInputLocked()) {
      return;
    }
    startShadowLog.judged++;
    const verdict = startShadowVerdict(s.expected, s.actual, s.held);
    if (verdict === 'agree') {
      return;
    }
    const held = verdict === 'held';
    startShadowTimer.value = window.setTimeout(() => {
      startShadowTimer.value = undefined;
      if (startShadowSig.value !== sig) {
        return;
      }
      const finding: StartShadowFinding = {
        kind: held ? 'held-long' : 'disagree', expected: s.expected, actual: s.actual, block: s.held,
        prompt: s.prompt, at: Math.round(performance.now()),
      };
      if (!recordStartShadowFinding(finding)) {
        return;
      }
      const diag = (window as unknown as {__conStartDiag?: () => unknown}).__conStartDiag?.();
      console.warn(`[start-shadow] ${finding.kind} — expected «${s.expected}», on screen «${s.actual}»` +
        `${held ? ` (held by «${s.held}»)` : ''} for «${s.prompt}»`, JSON.stringify({
        ...finding,
        serves: consoleStartState.serves ?? null,
        firstAct: consoleStartState.firstAct.stage,
        frames: workspaceStackState.frames.map((f) => `${f.kind}:${f.phase}`),
        diag: diag ?? null,
      }));
      // PHASE 1 — THE SHADOW ACTS: a confirmed finding is cured through the existing doors (`startDirectorCure`).
      shell.runStartDirectorCure(finding, 'shadow');
    }, held ? START_SHADOW_HELD_MS : START_SHADOW_CONFIRM_MS);
  }

  /** The question the strand was yielded for is answered (or replaced): the start takes its screen back. */
  function whenPlayerViewWaitingForPromptIdChanges(id: number | undefined): void {
    if (startStrandYield.value && id !== startStrandPrompt.value) {
      startStrandYield.value = false;
      startStrandPrompt.value = undefined;
    }
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
    startStrandTimer,
    startStrandPrompt,
    startShadowTimer,
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
