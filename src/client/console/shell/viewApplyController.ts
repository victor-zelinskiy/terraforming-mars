/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE VIEW-APPLY REACTION — what the shell does when a new `playerView` is applied (the body of the `playerView` row of
 * the watch table): the awaiting hand-off's resolve, the action commit's dismissal and fold, the reconcile of the
 * outcome claim and of the standard-projects flow, the clearing of every domain's «pending» latch, the task's re-open.
 *
 * Taken out of ConsoleShell.vue by scripts/shell-extract.mjs (architecture v2 — docs/claude/console/architecture-v2/
 * PLAN.md §5 · S6). ITS PORT IS THE FINDING: twelve rows are WRITTEN here without being owned — one reaction that
 * resets seven domains' latches on every view. Each of those rows is a latch that should end with its own flow (a
 * state of that flow's machine, a cleanup of its frame's scope); the reaction shrinks by rows as they do (S4 / S5).
 */
import type {UnwrapRef} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {discardWorkspacePark, goBoardHome, leaveWorkspace, popWorkspaceFrame, workspaceFrameHasNested, workspaceFrameMounted, workspaceFrameHost, parkServes, workspaceStackCollapsed} from '@/client/console/consoleWorkspaceStack';
import {refuteWithheldIntake} from '@/client/console/handDock/handDeliveryDirector';
import {observeDraftTransition} from '@/client/console/cardDeal/consoleDraftTray';
import {observeDraftWorkspace} from '@/client/console/draft/consoleDraftFlow';
import {noticeColonyTradeCommit} from '@/client/console/colonyTrade/consoleColonyTrade';
import {actionCentreLeavesOnPromptChange} from '@/client/console/actionCentreLeave';
import {taskFor} from '@/client/console/consoleTaskRouter';
import {commitGovScaleFocus} from '@/client/console/consoleGovScaleFocus';
import {workspaceOutcomeClaimed, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {noteBoardScaleAdvance} from '@/client/console/boardBeatPark';
import {noteBonusGainRows} from '@/client/console/startBonusGain';
import {isPatentSaleActive} from '@/client/console/patentSale/consolePatentSale';
import {consoleState, closeConsoleLayers, stepIndex, stepSelectable} from '@/client/console/consoleRouter';
import {isSurfaceAwaitingHandoff} from '@/client/console/surfaceMotion/surfaceMotionState';
import {cancelConsoleHandPick} from '@/client/console/consoleHandPick';
import {cancelConsoleRepeatPick} from '@/client/console/consoleRepeatPick';
import {cancelConsolePlayPick} from '@/client/console/consolePlayPick';
import {findSellPatentsAction, promptIdentityKey} from '@/client/console/turnIntents';
import {configureBoardInfo} from '@/client/components/board/boardInfoState';
import type {RouterController} from '@/client/console/shell/routerController';
import type {ColonyController} from '@/client/console/shell/colonyController';
import type {OutcomeController} from '@/client/console/shell/outcomeController';
import type {ConvertController} from '@/client/console/shell/convertController';
import type {RevealController} from '@/client/console/shell/revealController';
import type {PlacementController} from '@/client/console/shell/placementController';
import type {HandController} from '@/client/console/shell/handController';
import type {ParliamentController} from '@/client/console/shell/parliamentController';
import type {CellController} from '@/client/console/shell/cellController';
import type {PlayCardController} from '@/client/console/shell/playCardController';
import type {StdProjectsController} from '@/client/console/shell/stdProjectsController';
import type {CommandBarController} from '@/client/console/shell/commandBarController';
import type {SeatController} from '@/client/console/shell/seatController';
import {advanceQuestion} from '@/client/console/session/questionScope';
import {setQuestionAside, takeUpQuestion} from '@/client/console/setAside';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type ViewApplyPort = {
  $nextTick(fn?: () => void): Promise<void>,
  admits: UnwrapRef<RouterController['admits']>,
  // What the reaction READS of the latches it used to lower (the action centre's leave):
  commitFoldOwed: UnwrapRef<OutcomeController['commitFoldOwed']>,
  pendingCommitDismiss: UnwrapRef<OutcomeController['pendingCommitDismiss']>,
  // Each domain reconciles ITSELF on an applied view — the reaction is the ordered list of who is asked:
  questionChanged: UnwrapRef<RouterController['questionChanged']>,
  reconcileComposerSerial: UnwrapRef<PlayCardController['reconcileComposerSerial']>,
  reconcileConvertPlants: UnwrapRef<ConvertController['reconcileConvertPlants']>,
  reconcileRevealAck: UnwrapRef<RevealController['reconcileRevealAck']>,
  releaseFinaleCommitAfterAnswer: UnwrapRef<PlacementController['releaseFinaleCommitAfterAnswer']>,
  resolveAnsweredCommit: UnwrapRef<OutcomeController['resolveAnsweredCommit']>,
  coloniesForRail: UnwrapRef<ColonyController['coloniesForRail']>,
  game: UnwrapRef<SeatController['game']>,
  handEntries: UnwrapRef<HandController['handEntries']>,
  lawStepOwed: UnwrapRef<ParliamentController['lawStepOwed']>,
  loadCellPreview: UnwrapRef<CellController['loadCellPreview']>,
  openShellTaskSurface: UnwrapRef<RouterController['openShellTaskSurface']>,
  readonly playerView: PlayerViewModel,
  politicalPayoutOwed: UnwrapRef<ParliamentController['politicalPayoutOwed']>,
  reconcileStdProjectsFlow: UnwrapRef<StdProjectsController['reconcileStdProjectsFlow']>,
  reconcileWorkspaceOutcome: UnwrapRef<OutcomeController['reconcileWorkspaceOutcome']>,
  rollbackStdProjectFlow: UnwrapRef<StdProjectsController['rollbackStdProjectFlow']>,
  runCommitRewardWave: UnwrapRef<OutcomeController['runCommitRewardWave']>,
  sheetRows: UnwrapRef<CommandBarController['sheetRows']>,
  shellTask: UnwrapRef<RouterController['shellTask']>,
  stdProjectItems: UnwrapRef<StdProjectsController['stdProjectItems']>,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
};

export function createViewApplyController(shell: ViewApplyPort) {
  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  // A fresh playerView: reconfigure the board-info fetcher (facts may have
  // changed), clamp transient indices to the fresh lists.
  function whenPlayerViewChanges(newView: PlayerViewModel, oldView: PlayerViewModel | undefined): void {
    shell.releaseFinaleCommitAfterAnswer();
    shell.resolveAnsweredCommit(newView);
    // A GLOBAL PARAMETER MOVED WHILE THE BOARD WAS COVERED — hold the
    // presented value (and the scale-bonus claim map) for the board-beat
    // drain to release once the player can actually see the scales move.
    // Watchable views are a no-op by construction (the park's own law),
    // so every on-board flow keeps its exact historical timing.
    if (oldView !== undefined && oldView.id === newView.id) {
      noteBoardScaleAdvance(oldView.game, newView.game);
    }
    // WHAT THE «ФОРА» WINDOW STILL OWES — remembered from every view that
    // STATES it, which is only the bonus-window prompt itself. The
    // auto-resolve at the window's end is detected at the COMMIT (the
    // transport's seeder) and needs the pending set as it stood before it;
    // the always-mounted shell is the one observer that sees every view,
    // including the first one after a reload mid-window.
    noteBonusGainRows(newView);
    // Draft tray: mark a live pick beat answered, reconcile optimistic
    // state, and ARM the research-rise scene on the draft→buy
    // transition (pre-flush — the buy frame mounts already knowing).
    observeDraftTransition(oldView, newView);
    // The draft WORKSPACE's own latches (pick total / pass direction /
    // hydration cue) — beside the tray observer, same pre-flush timing.
    observeDraftWorkspace(oldView, newView);
    // A `payment` answer while flown cards are absent from the hand means
    // the server WITHHELD them behind that payment (the research buy /
    // reveal buy under Helion or Luna Trade Federation): tell the intake
    // NOW, so its target polls degrade at once instead of standing as a
    // stale `cardArrival` claim over the very prompt that releases the
    // cards — the deadlock the foreground watchdog reported as «Экран
    // завис» at the end of every Helion draft.
    refuteWithheldIntake(newView);
    // Colony-trade transaction: observe EVERY commit path. The staged
    // bot pipeline (a trade that ends the turn carries the bot's turns)
    // and a poll after a lost response bypass the transport's gated detect;
    // this fallback claims the manifest there and kicks the reward waves
    // exactly once after whichever commit carried it (idempotent).
    noticeColonyTradeCommit(newView);
    // A COLONIES claim has no awaiting handoff to ride — the trade
    // transaction owns its own pacing (`holdFocusStage`), so it never
    // arms `surfaceMotionState.awaiting` and the reconcile guarded by it
    // above is UNREACHABLE from here. Without this a claim that turned
    // out to have nothing to present (a card colony traded at a
    // zero-quantity position) would stand as an empty follow-up stage,
    // pinning `completeFlow`, until the 20 s claim backstop. The
    // reconcile itself only releases on POSITIVE evidence that the
    // outcome went elsewhere, so a real payout — whose reveal is already
    // readable by the `$nextTick` this defers to, or is still held by the
    // deck-draw scene it explicitly asks about — is never touched.
    if (workspaceOutcomeState.host === 'colonies') {
      shell.reconcileWorkspaceOutcome();
    }
    // Government Support scale-focus gate: if the last action was a WGT
    // parameter raise, HOLD the next modal for a beat so the board scale
    // glide (+ top-HUD delta chip) is seen in one focused place. Snap to
    // the board so that feedback is actually visible during the hold.
    if (commitGovScaleFocus()) {
      goBoardHome();
      closeConsoleLayers();
    }
    configureBoardInfo({
      participantId: shell.playerView.id,
      color: shell.thisPlayer.color,
      boardName: shell.game.gameOptions.boardName,
      players: shell.playerView.players,
    });
    // `configureBoardInfo` just dropped the fact caches because the board
    // may have moved under us (an opponent's tile landed while we choose) —
    // the focused cell's preview is stale for the same reason. The key is
    // unchanged, so the watcher won't fire: refetch here.
    shell.loadCellPreview();
    consoleState.handIndex = stepIndex(consoleState.handIndex, 0, shell.handEntries.length);
    consoleState.sheetIndex = consoleState.sheet === 'standardProjects' ?
      stepIndex(consoleState.sheetIndex, 0, shell.stdProjectItems.length) :
      stepSelectable(consoleState.sheetIndex, 0, shell.sheetRows.map((r) => r.kind !== 'header'));
    consoleState.colonyIndex = stepIndex(consoleState.colonyIndex, 0, shell.coloniesForRail.length);
    // (The trade window closing externally no longer force-closes
    // anything: the COLONY FOCUS STAGE is reactive — its CTA drops and
    // the verdict states the reason, an honest dossier, not a stale form.)
    shell.reconcileConvertPlants(shell.playerView, shell.thisPlayer.canConvertPlants === true);
    // The sell-patents window closed externally → drop the stale sale mode
    // (and fold the hand STEP it was standing in, if the std-projects flow
    // hosted one — a step whose mode died must not keep the descent).
    if (consoleState.sale.active && findSellPatentsAction(shell.playerView.waitingFor) === undefined) {
      consoleState.sale.active = false;
      consoleState.sale.selected = [];
      if (workspaceFrameHost('hand') === 'standard-projects' && !isPatentSaleActive()) {
        popWorkspaceFrame();
        shell.rollbackStdProjectFlow();
      }
    }
    // THE STD-PROJECTS FLOW answers its own round trip BEFORE the generic
    // prompt-identity reconciliation below: a terminal project's response
    // re-arrives on the SAME action-menu identity, so the identity block
    // alone would never see it.
    shell.reconcileStdProjectsFlow();
    shell.reconcileRevealAck(shell.playerView);
    // CTS: a NEW prompt identity resets the defer + stale nested picks.
    const key = promptIdentityKey(shell.playerView.waitingFor);
    if (shell.questionChanged(key)) {
      takeUpQuestion('question-changed');
      // …and a flow the player set aside is STALE the moment the server
      // asks for something else: restoring it would put them back inside a
      // decision that no longer exists.
      //
      // ⚠️ …UNLESS THE PARK ITSELF SERVES THE NEW PROMPT. The discard fires
      // on the ARRIVAL of a prompt, and a mid-chain flow changes prompts
      // repeatedly — the pick a claimed draw promised, the payment of a
      // pick-then-pay — so «something else» must mean «not this chain's
      // own next step». Discarding there threw the set-aside decision away
      // at the exact moment it became answerable, left the claim's host in
      // neither stack (the adoption net then orphan-released it), and the
      // prompt rose as a standalone band with no way back.
      {
        const nextTask = taskFor(shell.playerView);
        if (nextTask === undefined || !parkServes(nextTask.kind)) {
          discardWorkspacePark();
        }
      }
      // THE INVARIANT: `parked` non-empty ⇒ `deferred`. A phase-anchored
      // root SURVIVES that discard (the opening is not a flow — it IS the
      // phase), and `deferred` is the flag every way back is gated on:
      // `mandatoryDeferredActive` renders the restore card on it, B reads
      // that same computed, and `restoreWorkspaceStack` has exactly one
      // caller behind them. Clearing it with frames still parked leaves
      // them owned by nobody and reachable by nothing.
      if (workspaceStackCollapsed()) {
        setQuestionAside('chain');
      }
      // THE QUESTION THAT STOOD IS OVER — and everything that belonged to it ends HERE, with its scope
      // (`session/questionScope.ts`): the placement branch a task was sent to (`taskSpacePending`), the finale's
      // pick, a client payment and a client-hosted pick built for it, the standard project's pick response, the
      // native play composer. Each of those latches is declared with the question as its OWNER in its own
      // controller — two of them with the rule under which they outlive it (a pick whose receive scene still
      // plays, a composer under its landing scene). This reaction used to lower them one by one.
      advanceQuestion(key);
      // A client hand pick belongs to a composer whose prompt just moved
      // on — cancel it (idempotent; restores the section via the watcher).
      cancelConsoleHandPick();
      // Same for a repeat-action pick whose source composer's prompt moved on.
      cancelConsoleRepeatPick();
      // …and a law's play pick (RX36): its promise was made for the prompt that just moved on.
      cancelConsolePlayPick();
      // A NEW prompt resets the mandatory hand-SELECT picks + filter (they
      // survive a defer→resume of the SAME prompt, but never leak across
      // prompts). Cleared here rather than in closeConsoleLayers so the
      // defer→resume path keeps a multi-select's accumulated picks.
      consoleState.select.selected = [];
      consoleState.select.suitableOnly = true;
      // The card-action center is a VOLUNTARY surface — if the top prompt
      // moved off the action menu (a sub-prompt / another player's turn),
      // close it so its dedicated surface can't overlap another one. It
      // survives a 'first action' → 'next action' menu change (still the
      // action menu — same task kind).
      //
      // …EXCEPT when the new prompt is this workspace's OWN OUTCOME. The
      // rule above predates embedded outcomes and reads every non-menu
      // prompt as "someone else's", which is precisely why buying a
      // revealed card tore the workspace down and handed the prompt to a
      // standalone band: the player watched «ДЕЙСТВИЯ КАРТ» disappear and
      // an unrelated window take its place. A claimed prompt is not
      // another surface's — it is the next stage of the action the player
      // just confirmed HERE, so the workspace stays and hosts it.
      // A hosted STEP is the same fact for a SelectColony follow-up: the
      // workspace is standing around the colonies right now.
      //
      // …and never under its OWN COMMITTED PHRASE (T09 / BY — H6): an
      // action that ENDS the turn (every second one against MarsBot) moves
      // the prompt off the menu in the very flush that resolves its commit,
      // and leaving here unmounted the composer, killed the commit's motion
      // and flew the price into the printed icon of a card already gone.
      // While the commit's handoff stands the leave is the commit's own
      // fold, which waits for the surface to be clear of its tokens.
      if (actionCentreLeavesOnPromptChange({
        mounted: workspaceFrameMounted('card-actions'),
        menu: taskFor(shell.playerView)?.kind === 'actionMenu',
        outcomeClaimed: workspaceOutcomeClaimed(),
        nestedStep: workspaceFrameHasNested('card-actions'),
        lawStepOwed: shell.lawStepOwed,
        payoutOwed: shell.politicalPayoutOwed,
        commitOwnsSurface: isSurfaceAwaitingHandoff() || shell.commitFoldOwed || shell.pendingCommitDismiss !== undefined,
      })) {
        leaveWorkspace();
        consoleState.sheetIndex = 0;
      }
      // A shell-section task (T3/T4) auto-opens its serving surface —
      // unless something is still SET ASIDE (the invariant above). While a
      // park is owed, the restore card is the one door: auto-opening here
      // would stand a screen up beside a parked chain that already owns a
      // workspace of its own, and the first restore would then splice the
      // live stack away underneath the player with no close and no fold.
      // (`consoleForegroundBusy`'s auto-open is gated the same way.)
      //
      // …and it asks the DOOR's admission, not the section's. `shellTask` is
      // a PRESENCE computed: it deliberately waits for less than an opening
      // does (holding a live section for `card-arrival` would unmount the
      // stage a cinematic is playing on — see `followUp`). Response-driven
      // auto-opening is an OPENING, so a prompt that rides the same payload
      // as a still-running effect waits here; `consoleForegroundBusy`'s own
      // watcher opens it the moment that effect is finished.
      const shellTask = shell.shellTask;
      if (shellTask !== undefined && !consoleState.task.deferred && shell.admits('followUp')) {
        shell.openShellTaskSurface(shellTask);
      }
    }
    shell.reconcileComposerSerial(newView);
  }

  return {
    whenPlayerViewChanges,
  };
}

export type ViewApplyController = ReturnType<typeof createViewApplyController>;
