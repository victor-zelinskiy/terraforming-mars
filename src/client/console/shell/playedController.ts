/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PLAYED CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed, ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {SubmitTicket} from '@/client/console/transport/gameTransport';
import {dropHostedStepPromises, HostedParliamentStepKind, hostedStepLiveIn, hostedStepToEnter} from '@/client/console/parliament/hostedParliamentStep';
import ConsolePlayCardConfirm from '@/client/components/console/ConsolePlayCardConfirm.vue';
import {goBoardHome, leaveWorkspace, setWorkspaceFramePhase, workspaceFrameHasNested, workspaceFramePhase, workspaceFrameHost} from '@/client/console/consoleWorkspaceStack';
import {isCommitted} from '@/client/console/consoleWorkspaceFlow';
import {resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {playedHeroComposerView, playedHeroHolding, playedHeroState, skipPlayedHeroResult} from '@/client/console/played/consolePlayedHero';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';
import {corpActionOptionIndexFor, corporationCardNames, corpStatusFor, startFlowCorpPrompt} from '@/client/components/startGameFlow/startGameFlowState';
import {ShellTaskDestination} from '@/client/console/shellTaskSurface';
import {workspaceOutcomeClaimed, markWorkspaceOutcomeBeatDone} from '@/client/console/consoleWorkspaceOutcome';
import {consoleState, closeConsoleLayers} from '@/client/console/consoleRouter';
import {endLawPlayLanding, lawPlayLandingOf} from '@/client/console/consolePlayPick';
import {journalState} from '@/client/components/journal/journalState';
import {PendingPlayCard} from '@/client/console/shell/shellShared';
import type {JournalController} from '@/client/console/shell/journalController';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import type {SurfaceRegistry} from '@/client/console/shell/surfaceRegistry';
import {takeUpQuestion} from '@/client/console/setAside';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type PlayedPort = {
  surfaces: SurfaceRegistry,
  clearDepartingPlayCard(): void,
  closeJournal: UnwrapRef<JournalController['closeJournal']>,
  /** WRITTEN here. */ commitFoldOwed: boolean,
  deferShellTask(destination: ShellTaskDestination): void,
  /** WRITTEN here. */ departingPlayCard: CardName | undefined,
  endPlayCardFlow(): void,
  enterHostedParliamentStep(kind: HostedParliamentStepKind): Promise<void>,
  enterLiveGrantStep(): Promise<void>,
  hostedStepEntered(): boolean,
  journalHardBlocked: UnwrapRef<JournalController['journalHardBlocked']>,
  /** WRITTEN here. */ lawPlayFold: (() => void) | undefined,
  liveGrantStepDue(): boolean,
  liveGrantStepEntered(): boolean,
  /** WRITTEN here. */ pendingPlayCard: PendingPlayCard | undefined,
  readonly playerView: PlayerViewModel,
  readonly shellTask: ConsoleTask | undefined,
  submit(response: unknown): SubmitTicket,
};

export function createPlayedController(shell: PlayedPort) {
  // The controller's own scope (architecture v2 — PLAN §10 · C1): it ends with the shell, and its timers with it.
  const flow = useFlowScope('played-controller');
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The departing card's safety — its cancel (the scope owns the timer; re-armed only here, where the card is set). */
  let cancelDepartingSafety: () => void = () => {};
  /* (The COLONY EMBED LATCH and `colonyOpenedByPrompt` are gone: a
     SelectColony arriving inside a live flow PUSHES a colonies frame onto
     that flow's stack, and «who brought the player here» is the frame's own
     anchor. A latch existed only because ownership had to be remembered
     separately from presence.) */
  /** X on the board home — the «Разыграно» tableau overlay (view-only). */
  const playedOpen = ref(false);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The played-card hero scene owns the foreground (spec §13: a follow-up
   *  decision surfaces only after the landing + result beat complete). */
  const playedHeroHolds = computed((): boolean => {
    return playedHeroHolding();
  });

  /**
   * The DEDICATED first-action confirm modal is the SERVING SURFACE of the
   * corporation's mandatory first action — its presence is DERIVED from the
   * prompt, never opened imperatively (the open/close-race lesson from the
   * old «Разыграно» action mode). Deferring (B) hides it via the deferred
   * flag; answering it clears `shellTask` and the modal unmounts itself.
   * NOTE `shellTask` is suppressed while the hero scene / a reveal holds the
   * foreground, so the modal simply appears when the beat completes.
   */
  const corpFirstActionOpen = computed((): boolean => {
    return shell.shellTask?.kind === 'corpFirstAction' && !consoleState.task.deferred;
  });

  /** The overlay is up — as a manual browse, the hero stage, or a
   *  composer's TABLEAU PICK (the pick forces the table open over the
   *  hidden composer — consoleHandPick's played twin). */
  const playedTableVisible = computed((): boolean => {
    return playedOpen.value || playedHeroState.tableOpen;
  });

  /**
   * The corporations whose mandatory first action is live RIGHT NOW (>1 =
   * Merger's second corp). Empty when the prompt isn't up / is deferred.
   */
  const corpFirstActionNames = computed((): ReadonlyArray<CardName> => {
    if (!corpFirstActionOpen.value) {
      return [];
    }
    return corporationCardNames(shell.playerView)
      .filter((name) => corpStatusFor(shell.playerView, name) === 'ready');
  });

  /** The incoming card the «Разыграно» table reserves a slot for (hero). */
  const playedHeroIncoming = computed((): CardModel | undefined => {
    if (!playedHeroState.active || playedHeroState.card === undefined) {
      return undefined;
    }
    const p = playedHeroState.phase;
    if (p === 'armed' || p === 'shipping' || p === 'idle' || p === 'failed') {
      return undefined;
    }
    return {name: playedHeroState.card} as CardModel;
  });

  /** The landing in the hand has told its whole story — only its reading pause is left (P72 · CZ). */
  const playedHeroTold = computed((): boolean => {
    return playedHeroState.told && playedHeroState.host === 'workspace';
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The view the play composer reads — frozen on the confirmed one while an event pays before its lift (P84 · DK). */
  function ownPlayedHeroComposerView(): PlayerViewModel | undefined {
    return playedHeroComposerView();
  }

  // ── «Разыграно» — the played-cards tableau (X, board home only) ──────
  function openPlayedOverlay(): void {
    // Board-home-only by the caller's guards; mutually exclusive with the
    // journal (both replace the player's attention, never each other).
    if (journalState.open) {
      shell.closeJournal();
    }
    playedOpen.value = true;
  }

  function closePlayedOverlay(): void {
    playedOpen.value = false;
    resetConsolePlayedUi();
    // Focus returns to the board home — the board stays mounted (v-show)
    // with its own retained cursor state; nothing to restore explicitly.
  }

  /** A in the first-action modal: submit that corp's option of the
   *  corporationInitialAction OrOptions — byte-identical to the desktop
   *  start-flow submit. The action's follow-ups (a Tharsis city placement,
   *  Vitor's award pick …) arrive as native tasks; Merger's second
   *  first-action re-opens the modal with the remaining corp. */
  function onCorpFirstActionConfirm(name: CardName): void {
    const prompt = startFlowCorpPrompt(shell.playerView);
    const index = corpActionOptionIndexFor(prompt, name);
    if (prompt === undefined || index === -1) {
      return;
    }
    takeUpQuestion('answered');
    shell.submit({type: 'or', index, response: {type: 'option'}});
  }

  /** B in the first-action modal: the MANDATORY prompt is DEFERRED to the
   *  amber chip (B returns to it) — never just swallowed. */
  function onCorpFirstActionDefer(): void {
    shell.deferShellTask('board');
  }

  // A mandatory surface claimed the screen — the journal yields so the
  // task / placement / reveal is never hidden behind it (and never has
  // to share the pad with it).
  function whenJournalHardBlockedChanges(now: boolean): void {
    if (now && journalState.open) {
      journalState.open = false;
    }
    // The «Разыграно» overlay is the same family of board-home VIEW
    // surface — it yields to a mandatory surface identically. ONE honest
    // exception: while the hero scene owns it (the landing/result beat
    // completes first — the deferred close runs in the phase watcher
    // below). The corp first action has its OWN dedicated modal now, so a
    // stale browse always yields to a mandatory prompt.
    if (now && playedOpen.value && !playedHeroHolds.value) {
      closePlayedOverlay();
    }
  }

  /**
   * The played-card hero scene drives the SHELL-owned surfaces around the
   * flying card (the module owns the card; the shell owns the scenery):
   *  - 'lifting' (overlay host) → the composer closes UNDER the already-
   *    independent proxy (the hand slot stays held until the commit removes
   *    the card from the hand — the existing departingPlayCard mechanism);
   *  - 'closing' (workspace host) → the WORKSPACE FOLD: the card is docked
   *    on its pile, the result beat has played — the whole hand workspace
   *    (composer + embedded tableau + parked shelf) dissolves to the board
   *    in ONE leave. Never earlier: the workspace is the scene;
   *  - 'failed'  → the play was refused: the composer is still open —
   *    re-arm its CTA so the player can retry or cancel;
   *  - 'idle'    → transaction over: run the deferred hard-block close
   *    for a manually-open table (suppressed mid-scene above).
   */
  function whenPlayedHeroStatePhaseChanges(phase: string): void {
    // THE LAW'S CARD LANDED IN ITS STAGE (PL-726): the scene's ending is the LAW's flow ending — never the hand's
    // (`endPlayCardFlow` is the hand's). `closing` runs the owed fold (the workspace dissolves with the tableau in it,
    // the scene holding its close beat through it); a refusal drops the landing so the stage stands as it was.
    if (lawPlayLandingOf() !== undefined && (phase === 'closing' || phase === 'failed' || phase === 'idle')) {
      if (phase !== 'closing') {
        endLawPlayLanding();
      }
      const fold = shell.lawPlayFold;
      shell.lawPlayFold = undefined;
      if (fold !== undefined && phase !== 'failed') {
        fold();
      } else if (phase === 'failed') {
        shell.commitFoldOwed = false;
      }
      if (phase !== 'idle') {
        return;
      }
    }
    if (phase === 'idle' && shell.lawPlayFold !== undefined) {
      // Belt-and-braces: a scene that ended without `closing` still lets the owed fold run.
      const fold = shell.lawPlayFold;
      shell.lawPlayFold = undefined;
      fold();
    }
    if (phase === 'lifting' && playedHeroState.host !== 'workspace') {
      const pending = shell.pendingPlayCard;
      if (pending !== undefined) {
        shell.clearDepartingPlayCard();
        shell.departingPlayCard = pending.cardName;
        cancelDepartingSafety();
        cancelDepartingSafety = flow.after(6000, 'the departing card\'s safety', () => shell.clearDepartingPlayCard());
      }
      shell.pendingPlayCard = undefined;
      closeConsoleLayers();
      goBoardHome();
      return;
    }
    if (phase === 'closing' && playedHeroState.host === 'workspace') {
      // «КАРЬЕРА» / «ДЕЛЕГАТЫ»: the answer carried a record for THIS hand (the marker's walk — TR04; a rally of
      // neutral delegates — TR31) — the Parliament is pushed into the hand's own zone to play it, and the play's
      // ending waits for the step (`onParliamentFlowComplete('walk' | 'rally')`). It is normally ALREADY IN
      // (entered from the landing's commit — PL-120); this is the late road of a record that arrived after it.
      const hosted = hostedStepToEnter();
      if (hosted !== undefined) {
        void shell.enterHostedParliamentStep(hosted);
        return;
      }
      if (hostedStepLiveIn('hand') || shell.hostedStepEntered() || shell.liveGrantStepEntered()) {
        // The step is on screen and playing: its own completion ends the flow (`onParliamentFlowComplete`).
        return;
      }
      // The answer is in and carried no record (the track's end took every
      // step): nothing is owed any more.
      dropHostedStepPromises();
      // The landing scene has told its whole story — the play's ONE ending
      // decides what happens to the workspace around it (see
      // `endPlayCardFlow`: it may hold for a nested step, for the cards this
      // play drew, or for a flow the player parked).
      shell.endPlayCardFlow();
      return;
    }
    // THE EXECUTION BEAT of a claimed play, played out. The card has
    // physically left the hand, flown and landed on its pile — that IS the
    // «this action is happening» beat the claim withholds its surface for,
    // so it must be reported here. Left to the 2.6 s backstop instead, a
    // fast draw's reveal is still held when the deck scene starts flying its
    // cards at slots that do not exist yet, and the flight degrades.
    if (phase === 'committing' && playedHeroState.host === 'workspace' &&
        workspaceOutcomeClaimed()) {
      markWorkspaceOutcomeBeatDone();
    }
    // THE HOSTED STEP ENTERS FROM THE COMMIT (PL-120): a play whose answer carried a record for THIS hand (a walk
    // of the Agenda track — TR04 / TR37; a rally — TR31) does not read the landed tableau for a beat and then fold
    // into an empty zone before the Parliament rises — the story continues IN the step, so the step UNFOLDS out of
    // the landed card's rect the moment the card has docked (the composer and the proxy let go in place under it).
    // The landing scene's own reading pause is skipped (its remaining beats run under the risen step).
    if (phase === 'committing' && playedHeroState.host === 'workspace') {
      const hosted = hostedStepToEnter();
      if (hosted !== undefined) {
        skipPlayedHeroResult();
        void shell.enterHostedParliamentStep(hosted);
      }
    }
    if (phase === 'failed') {
      // A refused play walks nothing and rallies nobody: the promises are dropped with the move.
      dropHostedStepPromises();
      const composer = shell.surfaces.at<InstanceType<typeof ConsolePlayCardConfirm>>('playConfirm');
      composer?.resetSubmitting?.();
      // A refused move never happened: the descent goes back to configurable,
      // or B would stay dead and the crumb would keep claiming a commit.
      if (isCommitted(workspaceFramePhase('hand') ?? 'browse')) {
        setWorkspaceFramePhase('hand', 'configure');
      }
      return;
    }
    if (phase === 'idle' && shell.journalHardBlocked && playedOpen.value) {
      closePlayedOverlay();
    }
  }

  // The corp first-action confirm can surface AFTER a 'notification-only'
  // hold (the drawn-prelude card intake) releases — a path the reveal /
  // blocking `consoleForegroundBusy` transition above never covers. Make sure
  // the board is the section behind the modal whenever it finally opens, so a
  // later defer (B) reveals the board, not a stale hand / colonies view.
  function whenCorpFirstActionOpenChanges(open: boolean): void {
    if (open) {
      goBoardHome();
    }
  }

  /**
   * The composer's hosted-step declaration (PL-127): arm the warm mount one settle after it — the composer's
   * unfold (≈ 300 ms) must be over, so the mount's own layout lands in the reading pause and never in a motion.
   * A scheduling deferral, not a hold: nothing waits on it, and a declaration that ends clears it.
   */
  /**
   * THE PLAY'S LIVE GRANT RISES WHEN THE LANDING HAS TOLD ITS STORY (P72 · CZ — P83, P72, P77): the vote is the play's
   * next step, already asked by the answer — it rises from the landed card the moment the result's last token has
   * touched down (P83's order: the TR, the Greens' M€, THEN the vote), skipping only the reading pause: never after
   * that read over an emptied stage (PL-1167).
   */
  function whenPlayedHeroToldChanges(told: boolean): void {
    if (told && shell.liveGrantStepDue()) {
      skipPlayedHeroResult();
      void shell.enterLiveGrantStep();
    }
  }

  /**
   * THE SPONSOR STEP IS OVER when the project has physically LANDED — not
   * when the submit returned. The hero transaction is the honest completion
   * signal (it spans the request, the flight and the docking), so the frame
   * that held the hand in place through the prompt gap pops exactly here.
   * Whatever the project's own effects then ask for arrives as a normal task
   * and is served by the workspace it is already inside.
   *
   * …UNLESS the project that just landed still OWES an effect the step is
   * HOSTING (a SelectColony living one level deeper in the same teleport
   * chain). Landing is only HALF the signal; the nested frame's own falling
   * edge runs the pop instead. ONE form of that guard now, everywhere.
   */
  function whenPlayedHeroStateActiveChanges(active: boolean): void {
    if (active || workspaceFrameHost('hand') !== 'start' || workspaceFrameHasNested('hand')) {
      return;
    }
    if (!isCommitted(workspaceFramePhase('hand') ?? 'browse')) {
      return;
    }
    leaveWorkspace();
  }

  return {
    playedOpen,
    playedHeroHolds,
    corpFirstActionOpen,
    playedTableVisible,
    corpFirstActionNames,
    playedHeroIncoming,
    playedHeroTold,
    playedHeroComposerView: ownPlayedHeroComposerView,
    openPlayedOverlay,
    closePlayedOverlay,
    onCorpFirstActionConfirm,
    onCorpFirstActionDefer,
    whenJournalHardBlockedChanges,
    whenPlayedHeroStatePhaseChanges,
    whenCorpFirstActionOpenChanges,
    whenPlayedHeroToldChanges,
    whenPlayedHeroStateActiveChanges,
  };
}

export type PlayedController = ReturnType<typeof createPlayedController>;
