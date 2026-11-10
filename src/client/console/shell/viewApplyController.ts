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
import {promptReceiveState} from '@/client/console/cardReceive/promptReceive';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {discardWorkspacePark, goBoardHome, leaveWorkspace, popWorkspaceFrame, workspaceFrameHasNested, workspaceFrameMounted, workspaceFrameHost, parkServes, workspaceStackCollapsed} from '@/client/console/consoleWorkspaceStack';
import {refuteWithheldIntake} from '@/client/console/handDock/handDeliveryDirector';
import {observeDraftTransition} from '@/client/console/cardDeal/consoleDraftTray';
import {observeDraftWorkspace} from '@/client/console/draft/consoleDraftFlow';
import {noticeColonyTradeCommit} from '@/client/console/colonyTrade/consoleColonyTrade';
import {isPlayedHeroActive, playedHeroState} from '@/client/console/played/consolePlayedHero';
import {surfaceClear, surfaceHoldsTokens} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {actionCentreLeavesOnPromptChange} from '@/client/console/actionCentreLeave';
import {consoleActionComposerUi} from '@/client/console/consoleActionComposerUi';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {taskFor} from '@/client/console/consoleTaskRouter';
import {commitGovScaleFocus} from '@/client/console/consoleGovScaleFocus';
import {workspaceClaimsDrawRevealBatch, workspaceOutcomeClaimed, markWorkspaceOutcomeAnswerIn, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {noteBoardScaleAdvance} from '@/client/console/boardBeatPark';
import {colonyBonusPayoutArmed} from '@/client/console/colonyLedger/colonyBonusPayout';
import {isPlayOutcomeHost} from '@/client/console/played/consolePlayOutcomeClaim';
import {playComposerOutlived} from '@/client/console/played/playComposerLifetime';
import {noteBonusGainRows} from '@/client/console/startBonusGain';
import {isPatentSaleActive} from '@/client/console/patentSale/consolePatentSale';
import {beginPanelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {actionCommitHolding, consumeActionCommitPlan, releaseActionCommit} from '@/client/console/consoleActionCommit';
import {actionCommitRailState, flyActionCommitRail} from '@/client/console/consoleActionCommitRail';
import {consoleState, closeConsoleLayers, stepIndex, stepSelectable} from '@/client/console/consoleRouter';
import {clearAwaitingHandoff, isSurfaceAwaitingHandoff, captureSurfaceDeparture, surfaceMotionState} from '@/client/console/surfaceMotion/surfaceMotionState';
import {resolveAwaiting} from '@/client/console/surfaceMotion/surfaceMotionModel';
import {cancelConsoleHandPick} from '@/client/console/consoleHandPick';
import {cancelConsoleRepeatPick} from '@/client/console/consoleRepeatPick';
import {cancelConsolePlayPick, lawPlayLandingOf} from '@/client/console/consolePlayPick';
import {beginBlockadeExecution, consumeBlockadeExecution} from '@/client/console/hydroFlow/deltaBlockadeEntry';
import {findConvertPlantsOption, findSellPatentsAction, promptIdentityKey} from '@/client/console/turnIntents';
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

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type ViewApplyPort = {
  $nextTick(fn?: () => void): Promise<void>,
  admits: UnwrapRef<RouterController['admits']>,
  coloniesForRail: UnwrapRef<ColonyController['coloniesForRail']>,
  /** WRITTEN here. */ commitFoldOwed: UnwrapRef<OutcomeController['commitFoldOwed']>,
  /** WRITTEN here. */ convertPlantsPending: UnwrapRef<ConvertController['convertPlantsPending']>,
  /** WRITTEN here. */ dismissedRevealKey: UnwrapRef<RevealController['dismissedRevealKey']>,
  /** WRITTEN here. */ finalGreeneryCommitting: UnwrapRef<PlacementController['finalGreeneryCommitting']>,
  /** WRITTEN here. */ finalGreeneryPickPending: UnwrapRef<PlacementController['finalGreeneryPickPending']>,
  game: UnwrapRef<SeatController['game']>,
  handEntries: UnwrapRef<HandController['handEntries']>,
  /** WRITTEN here. */ lastTaskKey: UnwrapRef<RouterController['lastTaskKey']>,
  /** WRITTEN here. */ lawPlayFold: UnwrapRef<ParliamentController['lawPlayFold']>,
  lawStepOwed: UnwrapRef<ParliamentController['lawStepOwed']>,
  loadCellPreview: UnwrapRef<CellController['loadCellPreview']>,
  openShellTaskSurface: UnwrapRef<RouterController['openShellTaskSurface']>,
  /** WRITTEN here. */ pendingClientPayment: UnwrapRef<PlayCardController['pendingClientPayment']>,
  /** WRITTEN here. */ pendingClientPick: UnwrapRef<PlayCardController['pendingClientPick']>,
  /** WRITTEN here. */ pendingCommitDismiss: UnwrapRef<OutcomeController['pendingCommitDismiss']>,
  /** WRITTEN here. */ pendingPlayCard: UnwrapRef<PlayCardController['pendingPlayCard']>,
  readonly playerView: PlayerViewModel,
  politicalPayoutOwed: UnwrapRef<ParliamentController['politicalPayoutOwed']>,
  reconcileStdProjectsFlow: UnwrapRef<StdProjectsController['reconcileStdProjectsFlow']>,
  reconcileWorkspaceOutcome: UnwrapRef<OutcomeController['reconcileWorkspaceOutcome']>,
  rollbackStdProjectFlow: UnwrapRef<StdProjectsController['rollbackStdProjectFlow']>,
  runCommitRewardWave: UnwrapRef<OutcomeController['runCommitRewardWave']>,
  sheetRows: UnwrapRef<CommandBarController['sheetRows']>,
  shellTask: UnwrapRef<RouterController['shellTask']>,
  stdProjectItems: UnwrapRef<StdProjectsController['stdProjectItems']>,
  /** WRITTEN here. */ stdProjectPickResponse: UnwrapRef<StdProjectsController['stdProjectPickResponse']>,
  /** WRITTEN here. */ taskSpacePending: UnwrapRef<PlacementController['taskSpacePending']>,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
};

export function createViewApplyController(shell: ViewApplyPort) {
  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  // A fresh playerView: reconfigure the board-info fetcher (facts may have
  // changed), clamp transient indices to the fresh lists.
  function whenPlayerViewChanges(newView: PlayerViewModel, oldView: PlayerViewModel | undefined): void {
    // The finale's placement round-trip is over. Released a TICK late on
    // purpose: the placement hero is armed by this very response, and the
    // one frame between "the answer landed" and "the hero holds the
    // foreground" is exactly the frame the screen used to blink in.
    if (shell.finalGreeneryCommitting) {
      void shell.$nextTick(() => {
        shell.finalGreeneryCommitting = false;
      });
    }
    // SURFACE MOTION — resolve the awaiting handoff (the composer held
    // the stage through the submit round-trip). PRE-FLUSH on purpose:
    // the DOM is still the OLD tree, so the departing composer can be
    // measured HERE for the incoming reveal's anchored FLIP; the close +
    // the reveal's mount then land in the SAME patch — no blank frame.
    // THE SERVER ANSWERED. This is the one place that is true BY
    // DEFINITION on a fresh response, so the execution beat's flip is
    // released from here rather than from a computed chain
    // (`hostTask` → `taskBelongsToWorkspace`), which depends on the
    // admission gate and can settle a tick or more later — long enough for
    // the beat to sit face-down waiting on a flag that had no reason to
    // arrive, and to time out on its backstop instead of flipping.
    if (workspaceOutcomeClaimed()) {
      markWorkspaceOutcomeAnswerIn();
      // …AND SETTLE AN OPTIMISTIC CLAIM AGAINST WHAT ACTUALLY CAME BACK. A
      // card PLAY claims before knowing what it produces, deliberately —
      // a triggered effect (Point Luna's Earth tag) draws cards no preview
      // can advertise, so «claim and release if unused» is the only way to
      // catch them. This is the other half of that bargain: a tick later
      // the artifact is readable, and a claim that hosts nothing is dropped
      // instead of expiring on its 20 s backstop — twenty seconds in which
      // its workspace cannot conclude and the player stands in a stage with
      // nothing in it. It releases only on POSITIVE evidence that the
      // outcome went elsewhere, so a real one is never touched. The other
      // hosts claim structurally and settle through their own paths (the
      // action's awaiting handoff, the colony's own call above).
      if (isPlayOutcomeHost(workspaceOutcomeState.host)) {
        shell.reconcileWorkspaceOutcome();
      }
    }
    const awaiting = surfaceMotionState.awaiting;
    // A commit whose phrase still owes its fold (a capsule timeline in the
    // air) has ALREADY been resolved — a later view must not resolve it again.
    if (awaiting !== undefined && !shell.commitFoldOwed) {
      const lr = newView.lastReveal;
      const resolution = resolveAwaiting(awaiting, {
        gameAge: newView.game.gameAge,
        undoCount: newView.game.undoCount,
        revealArrived: lr !== undefined && `${lr.action}|${lr.revealed.name}` !== shell.dismissedRevealKey,
      }, typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (resolution.kind !== 'hold') {
        // An outcome CLAIMED by an open workspace stays IN-FRAME: the
        // workspace keeps the scene and presents it as its own next phase,
        // so neither the close nor the standalone-overlay phase swap runs.
        //  · deck-check — «Действия карт › Результат вскрытия»;
        //  · draw       — «Действия карт › Добор карт», the embedded reveal.
        // The DRAW arm is deliberately NOT gated on `resolution.kind`: a
        // plain draw resolves as an ordinary dismiss (there is no reveal
        // marker to make it a phase), and that dismiss is exactly what used
        // to blank the workspace and hand the batch to the full-bleed band.
        // A LIVE claim also holds the surface. At this pre-flush moment the
        // artifact may not be readable yet (`drawnCardsState` reconciles on
        // the new view, and a follow-up prompt only routes after the patch),
        // so the claim itself is the verdict and `reconcileWorkspaceOutcome`
        // settles it a tick later — closing here on a guess is what handed
        // the batch to the full-bleed band in the first place.
        const claimedInFrame = resolution.kind === 'step' ||
          (resolution.kind === 'phase' &&
          consoleActionComposerUi.revealClaim !== '' &&
          lr !== undefined && lr.action === consoleActionComposerUi.revealClaim) ||
          workspaceClaimsDrawRevealBatch(currentRevealEvent()) ||
          workspaceOutcomeState.sourceCard !== '' ||
          // A SelectColony follow-up standing INSIDE the action workspace:
          // the composer stays and hosts the colonies step — dismissing it
          // here would tear down the very frame the step lands in.
          workspaceFrameHasNested('card-actions') ||
          // «THE LEDGER PAYS» (TR23): the action's whole result is its ledger
          // paying row by row IN the composer — a payout of plain gains
          // raises no claim at all, so the armed payout is the verdict.
          colonyBonusPayoutArmed();
        if (claimedInFrame) {
          clearAwaitingHandoff();
          // A SPEND off the card before a hosted result (PL-201 — TR46's
          // «all the data → the deck», TR02's 3 data): its token leaves the
          // capsule on its own beat (the half was seeded against the views in
          // the apply block; nothing seeded → nothing flies). The release
          // below leaves a half in the air flying — its chain releases it.
          const claimedSurface = document.querySelector(`[data-motion-surface="${awaiting.from}"]`) ?? document.querySelector('.con-cardactions');
          const claimedRail = flyActionCommitRail(consumeActionCommitPlan(), claimedSurface);
          // The workspace's own stages carry the outcome from here — the
          // commit beat's job is done, its plan unused (a draw's reward
          // is the cards themselves).
          releaseActionCommit();
          // …and the claim's SETTLE waits for the rail half's tokens to
          // leave the surface (T09 / BY — H3): a claim nothing turned out
          // to host is released there and the workspace concludes — a
          // conclusion in this flush folded it under the spend still
          // flying off its capsule. Nothing on the surface → at once, as
          // before.
          if (claimedRail.holdsSurface || surfaceHoldsTokens(claimedSurface)) {
            void claimedRail.foldable.then(() => surfaceClear(claimedSurface)).then(() => shell.reconcileWorkspaceOutcome());
          } else {
            shell.reconcileWorkspaceOutcome();
          }
        } else {
          // ── ACTION COMMIT resolution (non-embedded results). The rail
          //    freezes NOW — pre-flush, before this view commits — so a
          //    counter can never tick ahead of the chips about to fly
          //    out of the action graphic (the reward wave's contract).
          const commitPlan = consumeActionCommitPlan();
          if (commitPlan !== undefined && commitPlan.specs.length > 0) {
            beginPanelRewardHold(commitPlan.specs);
          }
          const finishDismiss = () => {
            // The wave FIRST (chips are born over the still-standing
            // icons), then the workspace folds UNDER them — the result
            // outlives the surface that produced it.
            const waveLeft = commitPlan !== undefined ? shell.runCommitRewardWave(commitPlan) : Promise.resolve();
            // A committed DEPLOY (Modular Floodgates variant B) does not
            // dismiss to the board: the Hydronetwork opens as the
            // execution surface OVER the committed stage (the fresh gate
            // assembles in front of the target's marker), and «Готово»
            // resumes the ordinary conclusion. One-shot, armed at the
            // submit — every other commit takes the ordinary dismissal.
            const deploy = consumeBlockadeExecution();
            if (deploy !== undefined) {
              // The commit is handed to the execution surface — its fold is no longer owed (what `fold()` says
              // for every other ending). Left raised, every LATER commit of the session skipped its resolution
              // above: the rail half stood seeded until its 6 s ceiling, «Выполняется…» with it (the field log
              // of 2026-10-28 — Atmo Collectors / Jupiter Floating Station after a blockade).
              shell.commitFoldOwed = false;
              clearAwaitingHandoff();
              releaseActionCommit();
              beginBlockadeExecution(deploy.target, deploy.source);
              return;
            }
            // THE RAIL HALF (PL-001 for actions): a direct TR's token is
            // born on its printed icon and the workspace folds under it; a
            // capsule TIMELINE (TR28) keeps the workspace while the card is
            // still a target or a source of a token, and folds under the
            // last one; a TABLE'S ANSWER flying from the composer's
            // «Сработает» chip keeps it until the token has left the chip
            // (PL-220) — the flight says which (`consoleActionCommitRail.ts`).
            // THE SURFACE the commit's tokens are born on and land on — the
            // one the fold takes away (its motion surface; the action band).
            const surfaceEl = document.querySelector(`[data-motion-surface="${awaiting.from}"]`) ?? document.querySelector('.con-cardactions');
            const rail = flyActionCommitRail(commitPlan, surfaceEl);
            const fold = () => {
              shell.commitFoldOwed = false;
              // Capture the departing composer UNCONDITIONALLY — the incoming
              // surface consumes it only when the pair is phase-linked
              // (departureUsable), so a reveal FLIPs the source card while a
              // follow-up task host (a Helion payment, an OrOptions branch)
              // enters as the continuation of the same activation.
              captureSurfaceDeparture(awaiting.from,
                document.querySelector(`[data-motion-surface="${awaiting.from}"]`));
              clearAwaitingHandoff();
              closeConsoleLayers();
              releaseActionCommit();
            };
            // THE LAW OF THE FOLD (T06 → T09 / BY): the surface folds when
            // it is neither the SOURCE nor the DESTINATION of a token in the
            // air — the wave's tokens born on its printed icons, the rail
            // half's price drawn INTO its printed cost icon, a result landing
            // on its capsule. The wave and the chain say when their tokens
            // have STARTED (`waveLeft` · `rail.foldable`); the engine,
            // which knows both ends of each as objects, says when the
            // surface is clear of them (`surfaceClear`). Never a clock,
            // never a departure alone — a price LEAVES the rail and is still
            // flying into this surface.
            const tokensAway = (): Promise<void> => Promise.all([rail.foldable, waveLeft]).then(() => surfaceClear(surfaceEl));
            if (rail.holdsSurface && actionCommitRailState.phase === 'flying') {
              // The awaiting handoff stays up (the pad stays inert — the
              // phrase cannot be cut by a press) and a view arriving
              // mid-phrase must not resolve it a second time.
              shell.commitFoldOwed = true;
              void tokensAway().then(fold);
            } else if (lawPlayLandingOf() !== undefined && isPlayedHeroActive()) {
              // THE LAW'S CARD IS LANDING IN THIS STAGE (PL-726): the fold waits for the scene to tell its story —
              // the scene's own `closing` runs it (`playedHeroState.phase` watcher), the workspace dissolving with
              // the landed tableau inside it. The pad stays inert meanwhile, as for any owed fold.
              shell.commitFoldOwed = true;
              shell.lawPlayFold = fold;
            } else if ((commitPlan !== undefined && commitPlan.specs.length > 0 && !consoleReducedMotionActive()) || surfaceHoldsTokens(surfaceEl)) {
              // The wave, or a single link of the rail (a plain TR born on
              // its printed icon): the surface stands until the tokens have
              // left it — one pop, told by the tokens.
              shell.commitFoldOwed = true;
              void tokensAway().then(fold);
            } else {
              fold();
            }
          };
          // A fast server must not cut the minimum readable commit: the
          // dismiss waits for the beat's settle (never a timer — the
          // motion's own completion releases it; a dead stage releases
          // through the beat's short backstop).
          if (actionCommitHolding()) {
            // THE COMMIT IS RESOLVED ONCE (T09 / BY — H5b): the fold is owed
            // from THIS moment, not from the beat's settle. Left open, a
            // second view in the beat (the bot's «active» broadcast, a poll
            // behind the answer, the bot's own turn) resolved the handoff
            // again, found the plan already consumed and OVERWROTE this
            // dismissal with one that carried no plan: the workspace folded
            // at the beat's end and the seeded rail half was never flown.
            shell.commitFoldOwed = true;
            shell.pendingCommitDismiss = finishDismiss;
          } else {
            finishDismiss();
          }
        }
      }
    }
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
    // A resolved convert-plants prompt (server moved on) drops the local picker.
    if (shell.convertPlantsPending !== undefined &&
        findConvertPlantsOption(shell.playerView.waitingFor, shell.thisPlayer.canConvertPlants === true) === undefined) {
      shell.convertPlantsPending = undefined;
    }
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
    // T6: the server cleared the reveal result → the ack marker is stale.
    if (shell.playerView.lastReveal === undefined && shell.dismissedRevealKey !== '') {
      shell.dismissedRevealKey = '';
    }
    // CTS: a NEW prompt identity resets the defer + stale nested picks.
    const key = promptIdentityKey(shell.playerView.waitingFor);
    if (key !== shell.lastTaskKey) {
      shell.lastTaskKey = key;
      consoleState.task.deferred = false;
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
        consoleState.task.deferred = true;
      }
      shell.taskSpacePending = undefined;
      shell.finalGreeneryPickPending = false;
      // A client payment built for a prompt that moved on is stale — and so is a client-hosted pick.
      shell.pendingClientPayment = undefined;
      // …unless the pick was ANSWERED and its receive scene is still owed (RX35): the commit that moved the prompt
      // on IS the answer the scene plays, and the scene's end — a tick after this commit — is what lets it leave.
      if (!(shell.pendingClientPick?.answered === true && promptReceiveState.card !== undefined)) {
        shell.pendingClientPick = undefined;
      }
      shell.stdProjectPickResponse = undefined;
      // Same for the native play confirm (its playAction path moved on) —
      // EXCEPT mid workspace landing scene: the prompt change IS the
      // commit of the very play this composer hosts, and its embedded
      // tableau must live until the fold (the 'closing' teardown owns the
      // clear there). An abandoned composer with no armed transaction
      // still clears here as before.
      if (!(isPlayedHeroActive() && playedHeroState.host === 'workspace')) {
        shell.pendingPlayCard = undefined;
      }
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
    // …AND THE PLAY COMPOSER ANSWERS ONE PROMPT, named by its SERIAL. The key above is «type | title», and once
    // every other seat has passed (or in any solo game) every action menu reads «Take your next action»: an
    // ACCEPTED play left its composer standing on the same key, and the espionage — the one play no landing scene
    // owns — posted itself a second time from under the Hydronetwork («Unknown card name Corporate Espionage»,
    // 2026-10-23); with the flow over, `goBoardHome` stood the same composer up again as a band. A moved serial
    // is the server's own word; a landing scene or the play's outcome still owning the composer keeps it.
    if (playComposerOutlived({
      composedFor: shell.pendingPlayCard?.promptId,
      live: newView.waitingFor?.promptId,
      heroOwns: isPlayedHeroActive(),
      outcomeOwns: isPlayOutcomeHost(workspaceOutcomeState.host) && workspaceOutcomeClaimed(),
    })) {
      shell.pendingPlayCard = undefined;
    }
  }

  return {
    whenPlayerViewChanges,
  };
}

export type ViewApplyController = ReturnType<typeof createViewApplyController>;
