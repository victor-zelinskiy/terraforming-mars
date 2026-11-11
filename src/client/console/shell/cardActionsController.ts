/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CARDACTIONS CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed, ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {SubmitTicket} from '@/client/console/transport/gameTransport';
import {WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {closeConsoleLayers} from '@/client/console/consoleRouter';
import {beginAwaitingHandoff, clearAwaitingHandoff, surfaceMotionState} from '@/client/console/surfaceMotion/surfaceMotionState';
import {AWAITING_SAFETY_MS} from '@/client/console/surfaceMotion/surfaceMotionModel';
import {surfaceLeaveHook} from '@/client/console/surfaceMotion/surfaceMotionDirector';
import {type LawPlayDetail} from '@/client/console/consolePlayPick';
import {armBlockadeExecution, beginBlockadeExecution, consumeBlockadeExecution, deltaBlockadeResponseOf} from '@/client/console/hydroFlow/deltaBlockadeEntry';
import type {WheelController} from '@/client/console/shell/wheelController';
import {useFlowScope} from '@/client/console/session/useFlowScope';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type CardActionsPort = {
  armLawPlayLanding(detail: LawPlayDetail | undefined): void,
  collapseWorkspace(): void,
  /** WRITTEN here. */ commitFoldOwed: boolean,
  concludeWorkspaceFlowOrOwe(kind: WorkspaceFrameKind, servedPromptHolds?: boolean): boolean,
  parliamentLeaveRelease: (() => void) | undefined,
  readonly playerView: PlayerViewModel,
  submitBatch(responses: ReadonlyArray<unknown>, promptId?: number): SubmitTicket,
  wheelCounts: UnwrapRef<WheelController['wheelCounts']>,
};

export function createCardActionsController(shell: CardActionsPort) {
  // The controller's own scope (architecture v2 — PLAN §10 · C1): it ends with the shell, and its timers with it.
  const flow = useFlowScope('card-actions-controller');
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** …and «Действия карт» is ending WITH its hosted Parliament step (TR15): the step rides `cardActionsLeaveHook`. */
  const cardActionsDissolveArmed = ref(false);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const actionsAvailableCount = computed((): number => {
    return shell.wheelCounts.cardActions;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function onCardActionsSubmitBatch(responses: ReadonlyArray<unknown>, lawPlay?: LawPlayDetail): void {
    // A LAW'S PLAY (RX36) composed in the card composer: its card's landing is armed before the batch.
    shell.armLawPlayLanding(lawPlay);
    // A DEPLOY (Modular Floodgates variant B) in the batch: remember whom,
    // so the flow's completion opens the Hydronetwork execution surface
    // instead of concluding to the board. A refused batch never completes,
    // so the arm simply expires.
    for (const r of responses) {
      const blockade = deltaBlockadeResponseOf(r);
      if (blockade !== undefined) {
        armBlockadeExecution(blockade.target, CardName.MODULAR_FLOODGATES);
        break;
      }
    }
    // AWAITING HANDOFF (surface motion): the composer's batch is COMMITTED.
    // The center + composer HOLD the stage until the server's answer picks
    // the next scene — closing them here used to blank the board for the
    // whole round-trip (the "confirm → bare board → reveal" gap). The
    // playerView watcher resolves: a reveal continues the scene as a PHASE
    // handoff (the source card FLIPs across), anything else dismisses; a
    // lost response expires via AWAITING_SAFETY_MS.
    // A NEW commit owes no earlier one's fold: a fold genuinely owed keeps the awaiting handoff standing and the pad
    // inert, so no press can reach here under it — a flag still raised now is a leftover, and it would make the
    // resolution above skip THIS commit (the rail half seeded, never flown, «Выполняется…» to its 6 s ceiling).
    shell.commitFoldOwed = false;
    beginAwaitingHandoff('action-composer', {
      gameAge: shell.playerView.game.gameAge,
      undoCount: shell.playerView.game.undoCount,
    });
    // Belt-and-braces expiry: a lost response / dead server can never
    // strand the held stage (the watcher's expiry needs a fresh view to
    // fire; this timer needs nothing). Fingerprinted by startedAt so a
    // newer awaiting is never clobbered.
    const startedAt = surfaceMotionState.awaiting?.startedAt;
    flow.after(AWAITING_SAFETY_MS + 250, 'the awaiting handoff\'s expiry', () => {
      if (surfaceMotionState.awaiting !== undefined && surfaceMotionState.awaiting.startedAt === startedAt) {
        clearAwaitingHandoff();
        closeConsoleLayers();
      }
    });
    shell.submitBatch(responses);
  }

  function onCardActionsClose(): void {
    closeConsoleLayers();
  }

  /**
   * B past the COMMIT BOUNDARY — collapse, not back. The workspace parks so
   * the board can be read; the committed decision keeps living inside it, at
   * full depth, and comes back untouched (same revealed card, same picks, no
   * replayed cinematic, no second trip to the server).
   */
  function onCardActionsCollapse(): void {
    shell.collapseWorkspace();
  }

  /**
   * «ДЕЙСТВИЯ КАРТ» reports its committed flow finished (the deck-check
   * verdict acknowledged, the outcome claim released). The workspace cannot
   * see the rest of the console, so the ending is decided here.
   */
  function onCardActionsFlowComplete(): void {
    // A committed DEPLOY does not conclude to the board: the Hydronetwork
    // opens as the execution surface (the fresh gate assembles in front of
    // the target's marker), and «Готово» resumes this very conclusion.
    const deploy = consumeBlockadeExecution();
    if (deploy !== undefined) {
      beginBlockadeExecution(deploy.target, deploy.source);
      return;
    }
    shell.concludeWorkspaceFlowOrOwe('card-actions');
  }

  /**
   * «ДЕЙСТВИЯ КАРТ»'s ONE LEAVE HOOK — the director's own leave, unchanged for every ordinary ending. Armed by
   * `endCardActionsWithHostedStep`, the hosted Parliament (teleported INTO this workspace's composer) rides the
   * same motion and is released when it ends.
   */
  function cardActionsLeaveHook(el: Element, done: () => void): void {
    const armed = cardActionsDissolveArmed.value;
    cardActionsDissolveArmed.value = false;
    if (!armed) {
      surfaceLeaveHook(el, done);
      return;
    }
    surfaceLeaveHook(el, () => {
      done();
      shell.parliamentLeaveRelease?.();
    });
  }

  return {
    cardActionsDissolveArmed,
    actionsAvailableCount,
    onCardActionsSubmitBatch,
    onCardActionsClose,
    onCardActionsCollapse,
    onCardActionsFlowComplete,
    cardActionsLeaveHook,
  };
}

export type CardActionsController = ReturnType<typeof createCardActionsController>;
