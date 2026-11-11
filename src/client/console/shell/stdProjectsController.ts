/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE STDPROJECTS CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed, ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {Payment} from '@/common/inputs/Payment';
import {SelectCardModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {SubmitTicket} from '@/client/console/transport/gameTransport';
import {InputResponse} from '@/common/inputs/InputResponse';
import {buildStandardProjectPaymentModel, hasUsableStandardProjectAlternativeResources, standardProjectPaymentTitle} from '@/client/components/payment/paymentModelUtils';
import ConsoleStdProjectsScreen from '@/client/components/console/ConsoleStdProjectsScreen.vue';
import {buildStdProjectItems, StdProjectItem} from '@/client/console/consoleQuickModel';
import {ConsoleHandEntry} from '@/client/components/console/consoleHandSectionTypes';
import {enterWorkspace, goBoardHome, popWorkspaceFrame, setWorkspaceFramePhase, setWorkspaceFrameStage, setWorkspaceFrameSubject, workspaceFrameHasNested, workspaceFrameMounted, workspaceFramePhase, workspaceFrameHost, workspaceFrameKnown, workspaceFrameParked, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {beginStdProjectSubmit, markStdProjectCommit, markStdProjectTarget, resetStdProjectsFlow, stdProjectsFlow, stdProjectsFlowLive, stdProjectsFramePhase} from '@/client/console/consoleStdProjects';
import {STDP_HOLD_MS, armStdProjectCommit, releaseStdProjectCommit} from '@/client/console/consoleStdProjectCommit';
import {ConsoleTask, taskFor} from '@/client/console/consoleTaskRouter';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {armPatentSale, isPatentSaleActive} from '@/client/console/patentSale/consolePatentSale';
import {patentSaleAnswers} from '@/client/console/patentSale/patentSaleAnswers';
import {PatentSaleModel} from '@/common/models/PatentSaleModel';
import {consoleState, closeConsoleLayers, stepIndex} from '@/client/console/consoleRouter';
import {offTurnReason} from '@/client/console/offTurnReason';
import {findSellPatentsAction, findStandardProjectsAction, wrapPath} from '@/client/console/turnIntents';
import {translateTextWithParams} from '@/client/directives/i18n';
import {motionMs} from '@/client/components/motion/motionTokens';
import {PendingClientPayment, PendingClientPick} from '@/client/console/shell/shellShared';
import type {SeatController} from '@/client/console/shell/seatController';
import type {NoticeController} from '@/client/console/shell/noticeController';
import {useFlowScope} from '@/client/console/session/useFlowScope';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type StdProjectsPort = {
  $refs: Record<string, unknown>,
  actionBlockedReason: UnwrapRef<SeatController['actionBlockedReason']>,
  awaitingInput: UnwrapRef<SeatController['awaitingInput']>,
  readonly cardsTotalCount: number,
  readonly colonyResolutionLive: boolean,
  concludeWorkspaceFlow(kind: WorkspaceFrameKind, servedPromptHolds?: boolean): boolean,
  game: UnwrapRef<SeatController['game']>,
  readonly handEntries: ReadonlyArray<ConsoleHandEntry>,
  myTurn: UnwrapRef<SeatController['myTurn']>,
  openHandWithReveal(opts?: {keepTask?: boolean, overlay?: boolean}): Promise<void>,
  /** WRITTEN here. */ pendingClientPayment: PendingClientPayment | undefined,
  /** WRITTEN here. */ pendingClientPick: PendingClientPick | undefined,
  readonly placementActive: boolean,
  readonly playerView: PlayerViewModel,
  readonly shellTask: ConsoleTask | undefined,
  showNotice: UnwrapRef<NoticeController['showNotice']>,
  submit(response: unknown): SubmitTicket,
  submitBatch(responses: ReadonlyArray<unknown>, promptId?: number): SubmitTicket,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
  viewerPassed: UnwrapRef<SeatController['viewerPassed']>,
};

export function createStdProjectsController(shell: StdProjectsPort) {
  // The controller's own scope (architecture v2 — PLAN §10 · C1): it ends with the shell, and its timers with it.
  const flow = useFlowScope('std-projects-controller');
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The standard projects' terminal commit is HOSTING the Venus bonus its step earned (P89 · EE). */
  const stdpVenusStep = ref(false);
  /** The standard project's captured «where» answer, waiting for the project's own submit. */
  const stdProjectPickResponse = ref(undefined as InputResponse | undefined);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * The standard projects HOST the bonus their terminal project's step earned: the frame stands and its flow is the
   * submit the bonus answers (or the hold already taken). Structural — never only the reconcile's flag, which is set
   * a watcher AFTER the computeds that admit the band: read late, the band rose on its own for that flush.
   */
  const stdpHostsVenusBonus = computed((): boolean => {
    return shell.playerView.waitingFor?.venusBonusPrompt !== undefined && workspaceFrameMounted('standard-projects') &&
      (stdpVenusStep.value || stdProjectsFlow.state === 'submitting');
  });

  /** The std-projects source: the TOP-LEVEL prompt (EstablishedMethods) or the action menu. */
  const standardProjectsAction = computed((): {path: ReadonlyArray<number>, input: SelectProjectCardToPlayModel} | undefined => {
    const task = shell.shellTask;
    if (task?.kind === 'projectCard' && task.mode === 'standardProject' && shell.playerView.waitingFor?.type === 'projectCard') {
      return {path: [], input: shell.playerView.waitingFor as SelectProjectCardToPlayModel};
    }
    return findStandardProjectsAction(shell.playerView.waitingFor);
  });

  // In sale mode every NON-hosted hand card is sellable (SRR-hosted cards
  // can't be sold) — the target set for L3 select-all / unselect-all.
  const saleSellableNames = computed((): ReadonlyArray<string> => {
    return shell.handEntries.filter((e) => !e.robot).map((e) => e.card.name);
  });

  const saleAllSelected = computed((): boolean => {
    const names = saleSellableNames.value;
    return names.length > 0 && names.every((n) => consoleState.sale.selected.includes(n));
  });

  /** The premium Standard-Projects screen rows (Patent sale included).
   *  FROZEN for the span of a submit: the live rows derive from `waitingFor`,
   *  which moves on with the response — without the freeze the browse grid
   *  re-renders EMPTY under the flow's own beat (the deck-pick precedent). */
  /** THE PATENT SALE's rate on its prompt (`SelectCardModel.patentSale`) — the sale is found by this marker. */
  const salePatentModel = computed((): PatentSaleModel | undefined => {
    return findSellPatentsAction(shell.playerView.waitingFor)?.model;
  });

  const stdProjectItems = computed((): Array<StdProjectItem> => {
    const frozen = stdProjectsFlow.frozenItems;
    if (frozen !== undefined && stdProjectsFlowLive()) {
      return [...frozen];
    }
    return buildStdProjectItems({
      cards: standardProjectsAction.value?.input.cards ?? [],
      blockedReason: shell.actionBlockedReason,
      myTurn: shell.myTurn,
      awaitingInput: shell.awaitingInput,
      passed: shell.viewerPassed,
      myMegacredits: shell.thisPlayer.megacredits,
      sellAvailable: salePatentModel.value !== undefined,
      sellModel: salePatentModel.value,
      cardsInHand: shell.cardsTotalCount,
      sellOncePerGeneration: shell.game.gameOptions.fastModeOption,
      sellExhausted: shell.thisPlayer.patentSalesThisGeneration > 0,
    });
  });

  /**
   * A step of the STD-PROJECTS flow is standing inside the workspace — a
   * nested frame (the colony pick, the sale's hand) or the embedded payment
   * host (which teleports without a frame of its own). The screen's browse
   * layer parks on this; the ONE derivation, so the two can never disagree.
   */
  const stdpStepUp = computed((): boolean => {
    if (!workspaceFrameMounted('standard-projects')) {
      return false;
    }
    return workspaceFrameHasNested('standard-projects') ||
      shell.pendingClientPayment !== undefined || shell.pendingClientPick?.host === 'standard-projects' ||
      stdpHostsVenusBonus.value;
  });

  /**
   * The SPATIAL PRE-SELECT hint (§9): while the player browses the std
   * projects, the HUD readout the FOCUSED project would move carries a
   * quiet ring. Browse only (never during a beat), and never for a maxed
   * parameter — the honest chip already says «no effect», and ringing a
   * dial that will not move would be the lie the preview rules forbid.
   */
  /**
   * THE FACTS A CONCLUSION IS MADE OF, as one value to watch.
   *
   * A committed std-projects flow ends when its STEP lets go — and a step
   * unmounts on its own schedule (the colony's payout settles a second
   * after the server has moved on), so the response watcher is NOT enough:
   * the parent list stood on screen, committed and empty, for as long as
   * nothing else happened. Watching the ingredients means the ending is
   * re-asked exactly when one of them changes, and `concludeWorkspaceFlow`
   * stays the ONE place that decides.
   */
  const stdpConclusionSignal = computed((): string => {
    if (!workspaceFrameKnown('standard-projects')) {
      return '';
    }
    const task = taskFor(shell.playerView);
    return [
      workspaceFramePhase('standard-projects') ?? '',
      workspaceFrameHasNested('standard-projects') ? 'nested' : '',
      // (This workspace claims no outcome of its own — a std project's own
      // artifacts belong to the STEP that produced them, whose claim is
      // covered by `nested` + the colony resolution below.)
      workspaceOutcomeState.stage,
      task?.kind ?? '',
      workspaceFrameParked('standard-projects') ? 'parked' : '',
      shell.colonyResolutionLive ? 'colony-resolution' : '',
      shell.placementActive ? 'placement' : '',
    ].join('|');
  });

  const stdpGhostParam = computed((): 'temperature' | 'oxygen' | 'oceans' | 'venus' | undefined => {
    if (!workspaceFrameMounted('standard-projects') || stdpStepUp.value ||
        workspaceFramePhase('standard-projects') !== 'browse') {
      return undefined;
    }
    const focused = stdProjectItems.value[consoleState.sheetIndex];
    for (const e of focused?.preview?.effects ?? []) {
      if ((e.icon === 'temperature' || e.icon === 'oxygen' || e.icon === 'venus' || e.icon === 'oceans') &&
          e.current !== e.resulting) {
        return e.icon as 'temperature' | 'oxygen' | 'oceans' | 'venus';
      }
    }
    return undefined;
  });

  /** B on the MANDATORY std-project prompt minimizes (amber chip), else closes. */
  const stdBackLabel = computed((): string => {
    return shell.shellTask?.kind === 'projectCard' && shell.shellTask.mode === 'standardProject' ?
      'Minimize' : 'Close';
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** A on the Standard-Projects premium screen (P27) — use / sell. */
  function activateStdItem(item: StdProjectItem | undefined): void {
    if (item === undefined) {
      return;
    }
    if (shell.actionBlockedReason !== '') {
      shell.showNotice(shell.actionBlockedReason);
      return;
    }
    if (!item.available) {
      // The deficit reason carries params — pre-translate for the notice.
      const reason = item.reason !== '' ?
        translateTextWithParams(item.reason, [...(item.reasonParams ?? [])]) :
        'Unavailable right now';
      shell.showNotice(reason);
      return;
    }
    if (item.key === 'sell-patents') {
      // Patent sale — the hand carousel's SALE mode, hosted as a STEP of
      // this very flow: the workspace descends («› ПРОДАЖА ПАТЕНТОВ»), the
      // hand teleports into its zone, B folds back to the same row with
      // nothing sold. Nothing reaches the server until the sale confirms.
      consoleState.sale.active = true;
      consoleState.sale.selected = [];
      if (workspaceFrameMounted('standard-projects')) {
        armStdpStepOrigin();
        setWorkspaceFrameSubject('standard-projects', 'Patent sale');
        setWorkspaceFramePhase('standard-projects', 'configure');
        // The sale picks FROM the hand: the hand opens physically (dock → album), as every hand pick does.
        void shell.openHandWithReveal({keepTask: true});
        // The crumb's tail is the HAND STEP's own stage name, handed up:
        // «СТАНДАРТНЫЕ ПРОЕКТЫ › ПРОДАЖА ПАТЕНТОВ › ВЫБОР КАРТ».
        setWorkspaceFrameStage('hand', 'Card selection');
        consoleState.handIndex = 0;
      } else {
        // No workspace standing (a degenerate entry) — the lateral fallback.
        enterWorkspace('hand');
      }
      return;
    }
    if (item.cardName !== undefined) {
      useStandardProject(item.cardName);
    }
  }

  function useStandardProject(cardName: CardName): void {
    const action = standardProjectsAction.value;
    const card = action?.input.cards.find((c) => c.name === cardName);
    if (action === undefined || card === undefined || card.isDisabled === true) {
      return;
    }
    const cost = card.calculatedCost ?? 0;
    // A REPLACED UNIT'S «WHERE» (RX35): the project's preview promised a pick — the shared picker stands up in the
    // workspace's own step zone («› ВЫБОР»), its answer waits for the project's submit and rides its batch.
    const where = (card.standardProjectPreview?.steps ?? []).find((s) => s.kind === 'input' && s.input.type === 'card');
    if (where !== undefined && where.kind === 'input' && stdProjectPickResponse.value === undefined) {
      if (workspaceFrameMounted('standard-projects')) {
        armStdpStepOrigin();
        setWorkspaceFrameSubject('standard-projects', cardName);
        setWorkspaceFrameStage('standard-projects', 'Choice');
        setWorkspaceFramePhase('standard-projects', 'configure');
      }
      shell.pendingClientPick = {
        host: 'standard-projects',
        input: where.input as SelectCardModel,
        address: where.for,
        zone: '.con-stdp [data-embed-slot="stdp-step"]',
        onAnswer: (response) => {
          stdProjectPickResponse.value = response;
          useStandardProject(cardName);
        },
        onCancel: () => {
          if (workspaceFrameMounted('standard-projects')) {
            rollbackStdProjectFlow();
          }
        },
      };
      return;
    }
    if (hasUsableStandardProjectAlternativeResources(shell.thisPlayer, card, action.input.paymentOptions ?? {})) {
      // T3 → North Star: the alt-resource payment is a STEP of this flow —
      // the task host (promptOverride) teleports into the workspace's own
      // zone («› ОПЛАТА»), the browse layer parks, B cancels back to the
      // same row with nothing committed. The workspace never closes.
      const title = standardProjectPaymentTitle(cardName);
      if (workspaceFrameMounted('standard-projects')) {
        armStdpStepOrigin();
        setWorkspaceFrameSubject('standard-projects', cardName);
        setWorkspaceFrameStage('standard-projects', 'Payment');
        setWorkspaceFramePhase('standard-projects', 'configure');
      }
      shell.pendingClientPayment = {
        cardName,
        input: buildStandardProjectPaymentModel(shell.playerView, action.input, card, title, cost),
      };
      return;
    }
    submitStandardProjectPayment(cardName, Payment.of({megacredits: cost}));
  }

  /**
   * THE ONE SUBMIT of the standard-projects flow (plain M€ and the payment
   * step both funnel here). The workspace does NOT close: the frame enters
   * its `executing` beat (input absorbed by phase — a double press cannot
   * exist), the rows freeze, and the RESPONSE decides what the flow is —
   * a nested target step (pay-on-commit), a terminal committed beat, or an
   * honest fold for a follow-up this workspace has no surface for
   * (`reconcileStdProjectsFlow`). A lost response rolls back via the safety.
   */
  function submitStandardProjectPayment(cardName: CardName, payment: Payment): void {
    const action = standardProjectsAction.value;
    if (action === undefined) {
      return;
    }
    if (workspaceFrameMounted('standard-projects')) {
      beginStdProjectSubmit(cardName, stdProjectItems.value, consoleState.sheetIndex,
        `${shell.game.gameAge}|${shell.game.undoCount}`);
      // THE COMMIT PHRASE STARTS ON THE PRESS, not on the answer: the row's
      // tactile response owes nothing to the network, and arming here (in
      // the same synchronous turn as the submit) is what lets a fast
      // response find the phrase already running. A project that turns out
      // to need a TARGET releases it again — the gold belongs to a move
      // that is finished, and only a terminal project's is.
      armStdProjectCommit(cardName);
      setWorkspaceFrameSubject('standard-projects', cardName);
      setWorkspaceFrameStage('standard-projects', '');
      setWorkspaceFramePhase('standard-projects', stdProjectsFramePhase('submitting'));
      armStdProjectSafety();
    } else {
      // Degenerate entry (no workspace standing) — the legacy close-first path.
      closeConsoleLayers();
    }
    // The project's own response — and, after it, the «where» its preview pre-collected (RX35): ONE batch.
    const head = wrapPath(action.path, {type: 'projectCard' as const, card: cardName, payment});
    const tail = stdProjectPickResponse.value;
    stdProjectPickResponse.value = undefined;
    if (tail !== undefined) {
      shell.submitBatch([head, tail]);
    } else {
      shell.submit(head);
    }
  }

  /**
   * A submit whose response never lands must not strand the player inside a
   * sealed `executing` beat: roll the flow back to browse and say so. The
   * fingerprint (flow still submitting for the SAME card) keeps a late
   * response from being clobbered — mirrors `armMaFocusSafety`.
   */
  function armStdProjectSafety(): void {
    const card = stdProjectsFlow.card;
    flow.after(12_000, 'a standard project\'s answer (safety)', () => {
      // …never while the response DID land and the project hosts its Venus bonus (P89 · EE): the player is reading
      // a live question, not waiting on a lost submit.
      if (stdProjectsFlow.state === 'submitting' && stdProjectsFlow.card === card && !stdpVenusStep.value) {
        rollbackStdProjectFlow();
        shell.showNotice('Unavailable right now');
      }
    });
  }

  /** Arm the std-projects DESCEND phrase from the focused row (the screen
   *  owns the rect; a stale/missing arm degrades to a plain surface). */
  function armStdpStepOrigin(): void {
    ((shell.$refs.stdpScreen ?? undefined) as InstanceType<typeof ConsoleStdProjectsScreen> | undefined)?.armStepOrigin();
  }

  /** A refused/lost submit — the flow returns to its reversible browse layer. */
  function rollbackStdProjectFlow(): void {
    resetStdProjectsFlow();
    if (workspaceFrameMounted('standard-projects')) {
      setWorkspaceFrameSubject('standard-projects', '');
      setWorkspaceFrameStage('standard-projects', '');
      setWorkspaceFramePhase('standard-projects', 'browse');
    }
  }

  /**
   * THE FLOW'S OWN RECONCILER — one place that answers «the server replied;
   * what is this flow now?» (runs from the playerView watcher, before the
   * generic identity block). The response, not a client guess, decides:
   *  · a colony/space follow-up → a NESTED TARGET STEP (pay-on-commit,
   *    still reversible — B cancels server-side for free);
   *  · the action menu again → a TERMINAL COMMIT (short committed beat,
   *    then the workspace closes);
   *  · anything else → an honest fold (this workspace has no surface for
   *    it; the prompt routes to its own home, exactly as before).
   * The cancel legs live here too: the response to a placement/colony
   * cancel is what folds the step back (or reopens the folded workspace)
   * onto the very row the player left.
   */
  function reconcileStdProjectsFlow(): void {
    if (!stdProjectsFlowLive()) {
      return;
    }
    const task = taskFor(shell.playerView);
    if (stdProjectsFlow.state === 'submitting') {
      // THE RESPONSE IS THE WATCHER'S OWN EXISTENCE. This runs from the
      // `playerView` watcher, which fires only when a NEW view arrives — so
      // being here at all, in `submitting`, IS the answer. A value gate
      // (`gameAge|undoCount`) looked safer and was strictly worse: those
      // counters do not have to move for a standard project, so the gate
      // silently swallowed the colony answer and the flow stayed
      // `submitting` — a later cancel then arrived at the branch below and
      // was celebrated as a TERMINAL COMMIT.
      if (stdProjectsFlow.cancelRequested) {
        // Answered by a CANCEL (the player pressed B before the follow-up
        // stood up): nothing was spent — return to the browse layer.
        rollbackStdProjectFlow();
        return;
      }
      if (task?.kind === 'colony') {
        // openColoniesForPrompt (the shellTask auto-open below) hosts it as
        // a step of this frame; the flow is still reversible.
        // The commit phrase was armed on the press — release it: this move
        // is NOT finished, and the root list must not flash gold at a
        // project whose target has not been chosen yet.
        releaseStdProjectCommit();
        markStdProjectTarget();
        if (workspaceFrameMounted('standard-projects')) {
          setWorkspaceFramePhase('standard-projects', stdProjectsFramePhase('target'));
        }
        return;
      }
      if (task?.kind === 'space' || shell.placementActive) {
        // The board serves the placement (the placement watcher already
        // folded the frames — the board IS the step). The excursion draft
        // is what brings a cancel back to this very row.
        releaseStdProjectCommit(); // …and no gold: the move is not finished
        markStdProjectTarget();
        return;
      }
      if (task === undefined || task.kind === 'actionMenu') {
        // TERMINAL SUCCESS — the world has changed (the HUD ticks its own
        // delta chips); the row states the commit, then the flow closes.
        playStdProjectCommitBeat();
        return;
      }
      // THE VENUS BONUS the project's step earned (Air Scrapping on the alternative board — P89 · EE): the
      // project's own next stage, hosted in `stdp-step` («СТАНДАРТНЫЕ ПРОЕКТЫ › ОЧИСТКА ВОЗДУХА › БОНУС ВЕНЕРЫ»);
      // the decision is live (B collapses, never a stalled «executing» beat); its answer's response ends the
      // project through the terminal beat above.
      if (task.kind === 'venusBonus' && workspaceFrameMounted('standard-projects')) {
        stdpVenusStep.value = true;
        setWorkspaceFramePhase('standard-projects', 'committed');
        return;
      }
      // A follow-up this workspace has no surface for (a Moon placement, a
      // Collusion party pick, the maxed-oceans Whales redirect): fold
      // honestly and let the prompt route to its own home.
      releaseStdProjectCommit();
      resetStdProjectsFlow();
      if (workspaceFrameMounted('standard-projects')) {
        goBoardHome();
        closeConsoleLayers();
      }
      return;
    }
    if (stdProjectsFlow.state === 'target') {
      // The COLONY step's cancel leg: the cancel response restored the
      // action menu — fold the step back to the same browse row (nothing
      // spent, focus untouched). The colony COMMIT leg needs nothing here:
      // the build's own completion signal closes the whole flow
      // (onColonyFlowComplete), and mid-payout guards live there.
      if (stdProjectsFlow.cancelRequested && task?.kind !== 'colony' && task?.kind !== 'space' &&
          !shell.placementActive) {
        if (workspaceFrameHost('colonies') === 'standard-projects') {
          // The step's own frame goes with the demand that raised it.
          popWorkspaceFrame();
        }
        if (workspaceFrameMounted('standard-projects')) {
          rollbackStdProjectFlow();
          return;
        }
        // The PLACEMENT cancel leg: the workspace was folded for the board —
        // reopen it on the very row the player left (a RESUME via the
        // module draft, never a re-homed fresh open).
        const draft = stdProjectsFlow.boardExcursion;
        resetStdProjectsFlow();
        if (draft !== undefined && standardProjectsAction.value !== undefined) {
          enterWorkspace('standard-projects');
          consoleState.sheetIndex = stepIndex(draft.sheetIndex, 0, stdProjectItems.value.length);
        }
        return;
      }
      // The placement COMMITTED (a space answered, the flow moved past it):
      // the tile hero + bonuses play on the board; nothing returns to the
      // list — the flow is spent the moment the server moved on.
      if (stdProjectsFlow.boardExcursion !== undefined && !workspaceFrameMounted('standard-projects') &&
          !stdProjectsFlow.cancelRequested && task?.kind !== 'space' && !shell.placementActive) {
        resetStdProjectsFlow();
      }
      return;
    }
    // state === 'commit' — the beat timer owns the close.
  }

  /**
   * The TERMINAL commit's closing half. By the time this runs the gold has
   * already swept (the `WaitingFor` gate ran it and released the world's
   * change at its peak — that is why the delta chips are landing right now,
   * on the crest, and not before the player saw the row fix).
   *
   * All that remains is the READ: the committed gold holds for a beat, then
   * the flow leaves through its ONE guarded conclusion. The workspace can
   * therefore never close before the commit is legible, and the length is
   * the phrase's own (`stdProjectCommitBeatMs`), not a number typed here.
   */
  function playStdProjectCommitBeat(): void {
    stdpVenusStep.value = false;
    markStdProjectCommit();
    if (workspaceFrameMounted('standard-projects')) {
      setWorkspaceFramePhase('standard-projects', stdProjectsFramePhase('commit'));
    }
    flow.after(Math.max(motionMs(STDP_HOLD_MS), 1), 'the committed standard project\'s read', () => {
      if (stdProjectsFlow.state !== 'commit') {
        return;
      }
      releaseStdProjectCommit();
      endStdProjectsFlow();
    });
  }

  /**
   * THE FLOW IS OVER — the ONE exit of this workspace, whichever ending
   * reached it (a terminal beat, a colony's own payout, a placement that
   * committed). It routes through the shared guarded conclusion, so a
   * hold — a step still standing, a live outcome, an owned prompt, a park —
   * postpones the ending instead of tearing a result off the screen; the
   * `stdpConclusionSignal` watcher re-asks as those holds fall.
   */
  function endStdProjectsFlow(): void {
    // CONCLUDE FIRST, RESET ON DISMISS. A held conclusion (a step still
    // standing inside — the Redux Venus's delegate vote after the build) is
    // re-asked by the `stdpConclusionSignal` watcher when that step lets
    // go, and that watcher reads `stdProjectsFlowLive()` first: a record
    // reset here left the flow idle, the re-ask returned early, and the
    // finished project stood in its browse list for good.
    if (shell.concludeWorkspaceFlow('standard-projects')) {
      resetStdProjectsFlow();
    }
  }

  function confirmSale(): void {
    const picked = consoleState.sale.selected;
    if (picked.length === 0 || isPatentSaleActive()) {
      return; // the terminal owns the moment — never a double submit
    }
    const action = findSellPatentsAction(shell.playerView.waitingFor);
    if (action === undefined) {
      shell.showNotice(offTurnReason(shell.awaitingInput, shell.viewerPassed));
      return;
    }
    const cards = [...picked] as Array<CardName>;
    // PREMIUM PATENT SALE: ARM the trade-terminal scene FIRST — the sold
    // cards' live hand-slot rects are captured in this same synchronous
    // turn (the hand is still on screen) — THEN submit. The sale UI stays
    // up while the cards flip + gather; the `patentSaleState.phase`
    // watcher closes it when the stack enters the terminal, and the
    // WaitingFor `holdingForPatentSale` gate blocks the commit (new M€ /
    // delta chip) until the payout chip lands on the resource rail.
    // Desktop is unaffected (never arms).
    // The server's RATE: the project's M€ per card and the table's answers (TR46's data into its capsule,
    // Martian Fiber's M€ after it) — the terminal stands the answering cards up and flies each answer.
    armPatentSale({
      cards,
      payoutPerCard: action.model.megacreditsPerCard,
      answers: patentSaleAnswers(action.model, cards.length),
      capsuleOf: (name) => shell.thisPlayer.tableau.find((c) => c.name === name)?.resources ?? 0,
    });
    // Hosted as a step of the STD-PROJECTS flow: the commit is on the wire —
    // the frame crosses into its transient beat (crumb amber, B absorbed by
    // phase). The sale scene's own phases drive the rest; 'failed' rolls
    // this back beside the picks it preserves.
    if (workspaceFrameHost('hand') === 'standard-projects') {
      setWorkspaceFramePhase('standard-projects', 'executing');
    }
    shell.submit(wrapPath(action.path, {type: 'card' as const, cards}));
  }

  /** P15: the sale pick flip, shared by the section's A and the viewer. */
  function toggleSalePick(name: string): void {
    const at = consoleState.sale.selected.indexOf(name);
    if (at === -1) {
      consoleState.sale.selected.push(name);
    } else {
      consoleState.sale.selected.splice(at, 1);
    }
  }

  /** L3 in the sell-patents multi-select: select ALL sellable cards, or clear
   *  the selection if they're already all picked. */
  function toggleSelectAllSale(): void {
    const names = saleSellableNames.value;
    if (names.length === 0) {
      return;
    }
    consoleState.sale.selected = saleAllSelected.value ? [] : [...names];
  }

  /**
   * THE EMBEDDED OUTCOME'S LIFECYCLE, in one place.
   *
   * Rising edge → the zone is filled: mark it presenting (the workspace
   * drops its «Drawing cards…» beat for the real content).
   *
   * Falling edge → the flow is OVER: the batch was taken, or the pick (and
   * its payment) submitted and the server asked for nothing more. Release
   * the claim — that release is the SINGLE signal the workspace folds on, so
   * there is exactly one place that decides when an embedded outcome ends,
   * whichever kind it was.
   *
   * Deferred by a tick: one response can retire the pick and raise its
   * payment in the same flush, and reading the edge mid-flush would fold the
   * workspace between the two halves of one decision.
   */
  /**
   * A COMMITTED std-projects flow ends when everything inside it lets go.
   * The signal changes on each of those releases, so the guarded conclusion
   * is re-asked precisely then — and never in a poll.
   */
  function whenStdpConclusionSignalChanges(): void {
    if (!stdProjectsFlowLive() || !workspaceFrameMounted('standard-projects')) {
      return;
    }
    // ONLY the STEP's atomic commit. Two phases are deliberately NOT
    // endings here, and both cost a bug to learn:
    //  · `executing` — the round trip. `isCommitted` answers true for it,
    //    and concluding there closed the workspace mid-submit, so the
    //    follow-up it had just asked for opened as a lateral screen with no
    //    parent — the very shape this migration removes.
    //  · `completing` — the TERMINAL beat, which owns its own dismissal
    //    (the player must be able to READ the committed row). Ending it
    //    from here swallowed the beat entirely.
    if (workspaceFramePhase('standard-projects') !== 'committed') {
      return;
    }
    // …and the Venus bonus the project's step earned (P89 · EE) is the project's own step: held until the answer's
    // response plays the terminal beat (`stdpVenusStep` falls only there).
    if (workspaceFrameHasNested('standard-projects') || shell.colonyResolutionLive ||
        shell.placementActive || stdpVenusStep.value || stdpHostsVenusBonus.value) {
      return; // a step / its payout is still owed — the conclusion holds
    }
    endStdProjectsFlow();
  }

  /**
   * A terminal standard project was REFUSED (server error / network). The
   * commit phrase has already unwound itself; the FLOW has to follow, or the
   * workspace would sit in its sealed `executing` beat with B dead and the
   * rows frozen. Returning to `browse` is the same rollback a lost response
   * gets — the row is immediately usable again and the reason is stated by
   * the existing alert/status path.
   */
  function whenStdProjectCommitStateAbortNonceChanges(): void {
    if (stdProjectsFlowLive()) {
      rollbackStdProjectFlow();
    }
  }

  return {
    stdpVenusStep,
    stdProjectPickResponse,
    stdpHostsVenusBonus,
    standardProjectsAction,
    saleSellableNames,
    saleAllSelected,
    salePatentModel,
    stdProjectItems,
    stdpStepUp,
    stdpConclusionSignal,
    stdpGhostParam,
    stdBackLabel,
    activateStdItem,
    useStandardProject,
    submitStandardProjectPayment,
    armStdProjectSafety,
    armStdpStepOrigin,
    rollbackStdProjectFlow,
    reconcileStdProjectsFlow,
    playStdProjectCommitBeat,
    endStdProjectsFlow,
    confirmSale,
    toggleSalePick,
    toggleSelectAllSale,
    whenStdpConclusionSignalChanges,
    whenStdProjectCommitStateAbortNonceChanges,
  };
}

export type StdProjectsController = ReturnType<typeof createStdProjectsController>;
