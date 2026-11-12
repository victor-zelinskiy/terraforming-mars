/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE DRAFT CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import {computed} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {SubmitTicket} from '@/client/console/transport/gameTransport';
import {closePhaseRoot, setWorkspaceFrameServes, workspaceFrameIndex, workspaceFrameMounted, workspaceFrameRenders, workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';
import {DRAFT_DEFAULT_SERVES, DRAFT_PAYMENT_SERVES, betweenGenResearchLive, draftClaimsPrompt, draftCompletionHolding, draftPaymentPending, resetDraftWorkspace} from '@/client/console/draft/consoleDraftFlow';
import {Phase} from '@/common/Phase';
import {ConsoleTask, taskFor} from '@/client/console/consoleTaskRouter';
import {consoleState} from '@/client/console/consoleRouter';
import {handoffPendingEntries} from '@/client/console/shell/shellFlowState';
import {takeUpQuestion} from '@/client/console/setAside';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type DraftPort = {
  readonly hostTask: ConsoleTask | undefined,
  parkWorkspaceStack(): void,
  readonly playerView: PlayerViewModel,
  submit(response: unknown): SubmitTicket,
};

export function createDraftController(shell: DraftPort) {
  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** OPTIONAL draft re-pick — the fork shows a calm "waiting for the other
   *  players" banner instead of offering to change the pick (desktop parity). */
  const draftWaitActive = computed((): boolean => {
    return taskFor(shell.playerView)?.kind === 'draftWait';
  });

  /** The persistent draft tray lives through the WHOLE draft (picks +
   *  waits) and stays for the research-rise handoff; it renders empty-
   *  invisible before the first pick and leaves once the draft resolves.
   *
   *  ONLY the pre-game INITIALDRAFTING flow now: the between-generations
   *  draft is served by the DRAFT WORKSPACE, whose shelf registers the
   *  same slot resolver — two surfaces, one tray brain. A parked frame
   *  counts (its way back is the deferred chip, never a popover). */
  const draftTrayMounted = computed((): boolean => {
    if (workspaceFrameKnown('draft')) {
      return false;
    }
    // The pre-game flow only. The between-generations beats (pick heroes,
    // the research rise, the wait) all belong to the WORKSPACE now — the
    // popover legs they used to justify are exactly what flashed a frozen
    // pile over the returning board after the workspace released.
    return shell.playerView.game.phase === Phase.INITIALDRAFTING;
  });

  /** The between-generations draft flow is ALIVE for this player — the
   *  frame-lifetime predicate (the completion beats extend it past the
   *  research answer). */
  const draftFrameLive = computed((): boolean => {
    return betweenGenResearchLive(shell.playerView) || draftCompletionHolding();
  });

  /** PRESENCE IS THE STACK (invariant 1) — the workspace's ONE v-if. */
  const draftWorkspaceMounted = computed((): boolean => {
    return workspaceFrameRenders('draft');
  });

  /**
   * The draft frame's runtime-earned `payment` serve (DRAFT_PAYMENT_SERVES —
   * the colony-resolution pattern): while the post-buy payment stands, the
   * draft workspace IS the surface serving it, and the leak detector /
   * foreground watchdog must count its rendered root as the DOM evidence.
   * The signal folds the frame's DEPTH in so a frame stood up AFTER the
   * prompt arrived (a reload straight into the Helion payment: announce →
   * A → enterWorkspace) still re-fires the idempotent handler — a bare
   * boolean watcher cannot fire true→true (the hydroBonusDoorSignal
   * precedent).
   */
  const draftPaymentServeSignal = computed((): string => {
    return [draftPaymentPending(shell.playerView), workspaceFrameIndex('draft')].join('|');
  });

  /** The prompt kinds the draft workspace presents NATIVELY — the standalone
   *  host must not rise for them while the frame stands. (The embedded
   *  post-buy PAYMENT deliberately stays host-served — teleported into the
   *  workspace's pay slot, same instance, same submit path.) */
  const draftClaimsTask = computed((): boolean => {
    // …and while its ENTRY IS OWED to the screen handoff (`draftClaimsPrompt`): the press was honoured, the plate is
    // gone, and the generic host's card browser must not fill the wait between the Parliament and the draft.
    return draftClaimsPrompt(taskFor(shell.playerView), {mounted: workspaceFrameMounted('draft'), entryOwed: handoffPendingEntries.has('draft')});
  });

  /** The workspace owns the pad exactly while it is the surface the player
   *  sees; `hostTask === undefined` yields it to the embedded payment and
   *  to the Underworld research choice (both host-served). */
  const draftWorkspaceOwnsPad = computed((): boolean => {
    return draftWorkspaceMounted.value && shell.hostTask === undefined &&
      !consoleState.task.deferred;
  });

  /** Cards already drafted this round (server-managed; cleared at endRound) —
   *  drawn as the desktop-style stack beside the draftWait banner. */
  const draftedCards = computed((): ReadonlyArray<CardModel> => {
    return shell.playerView.draftedCards ?? [];
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The draft workspace's submit — the same funnel, but NO layer closing:
   *  the workspace IS the layer and deliberately outlives its own prompt
   *  (the pick beat / purchase flights play past the answer). */
  function onDraftSubmit(response: unknown): void {
    takeUpQuestion('answered');
    shell.submit(response);
  }

  /** B in the draft workspace = MINIMIZE: park the whole stack atomically
   *  (frames aside + the deferred chip; restore returns the same depth). */
  function onDraftDefer(): void {
    shell.parkWorkspaceStack();
  }

  /**
   * THE START WORKSPACE'S FRAME. It stands while the opening serves it — or
   * while a step it is HOSTING is still unfinished, because an inner frame
   * can never outlive its host. That second half is why the predicate is a
   * computed and not a raw `startSceneServes` watcher: popping the hosted
   * hand makes it re-evaluate on its own, so nothing has to remember to
   * re-check the root afterwards.
   */
  /**
   * THE DRAFT WORKSPACE'S FRAME — the same lifecycle contract as the start
   * for its END: a PHASE-anchored root closed by its owner watcher
   * (`closeWorkspaceRoot`, never `goBoardHome` — that one protects a phase
   * root from steps inside it).
   *
   * The RISING edge deliberately opens NOTHING. The live draft flow derives
   * a pending MANDATORY ACTION instead (mandatoryFlowBeats → the gate): the
   * announcement waits out the ordinary-notification feed, and only the
   * player's explicit A (`openMandatoryAnnounce`) stands the frame up. That
   * is what stops the workspace from yanking the player out of whatever
   * they were reading the moment the phase flips. The falling edge is also
   * the pending action's INVALIDATION: a draft that stopped being live
   * before it was ever opened simply stops deriving — no empty transition.
   */
  function whenDraftFrameLiveChanges(live: boolean): void {
    if (!live) {
      closePhaseRoot('draft');
      // The per-generation latches + presentation memory reset with the
      // flow (the NEXT generation's draft starts clean).
      resetDraftWorkspace();
    }
  }

  // The runtime `payment` grant/revoke for the draft frame — idempotent,
  // re-fired on both the prompt edge and the frame's own (re)creation
  // (see draftPaymentServeSignal).
  function whenDraftPaymentServeSignalChanges(): void {
    if (!workspaceFrameMounted('draft')) {
      return;
    }
    setWorkspaceFrameServes('draft',
      draftPaymentPending(shell.playerView) ? DRAFT_PAYMENT_SERVES : DRAFT_DEFAULT_SERVES);
  }

  return {
    draftWaitActive,
    draftTrayMounted,
    draftFrameLive,
    draftWorkspaceMounted,
    draftPaymentServeSignal,
    draftClaimsTask,
    draftWorkspaceOwnsPad,
    draftedCards,
    onDraftSubmit,
    onDraftDefer,
    whenDraftFrameLiveChanges,
    whenDraftPaymentServeSignalChanges,
  };
}

export type DraftController = ReturnType<typeof createDraftController>;
