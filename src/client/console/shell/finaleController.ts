/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE FINALE CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {FinalePanelModel, FinaleStage, FinalGreeneryViewModel, finaleQueue, finaleStageOf, finaleStock, finaleWaitingOn, finaleYieldKey, finalGreeneryBank} from '@/client/console/finalGreenery/finalGreeneryModel';
import {finaleSessionState} from '@/client/console/finalGreenery/finalGreenerySession';
import {consoleEndgameUi, noteConsoleEndgameLivePhase, resetConsoleEndgame} from '@/client/console/endgame/consoleEndgameState';
import {sealLiveGameSurfaces} from '@/client/console/endgame/consoleEndgameSeal';
import {closePhaseRoot, phaseRootAnywhere, enterWorkspace, workspaceFrameRenders, workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';
import {resetHandReveal} from '@/client/console/handDock/handRevealDirector';
import {Phase} from '@/common/Phase';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {liveWaitingSignal} from '@/client/components/overview/playerLabels';
import {screenHandoffOwed, waitScreenHandoff} from '@/client/console/screenHandoff';
import type {MaController} from '@/client/console/shell/maController';
import type {JournalController} from '@/client/console/shell/journalController';
import type {SeatController} from '@/client/console/shell/seatController';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type FinalePort = {
  /** WRITTEN here. */ dockHover: boolean,
  finalGreeneryCommitting: boolean,
  finalGreeneryPickPending: boolean,
  readonly finalGreeneryRawVm: FinalGreeneryViewModel | undefined,
  game: UnwrapRef<MaController['game']>,
  /** WRITTEN here. */ journalColonyInspect: UnwrapRef<JournalController['journalColonyInspect']>,
  /** WRITTEN here. */ playedOpen: boolean,
  readonly playerView: PlayerViewModel,
  taskSpacePending: {index: number, spacePrompt: PlayerInputModel} | undefined,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
  readonly waitingOnPlayers: ReadonlyArray<Color>,
};

export function createFinaleController(shell: FinalePort) {
  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * The dossier's FINALE block — the whole session long (PL-304): the stock as objects, the board's room when
   * it is what caps the count, the per-greenery yield, every seat's place in the phase, and in the wait stage
   * WHO the table waits on. Reads the public model, never the pick: it stands without a prompt.
   */
  const finalePanel = computed((): FinalePanelModel | undefined => {
    const stage = finaleStage.value;
    if (stage === undefined) {
      return undefined;
    }
    const stock = finaleStock(shell.thisPlayer.plants, shell.thisPlayer.plantsNeededForGreenery);
    const spaces = shell.finalGreeneryRawVm?.spaces;
    return {
      stage,
      plants: stock.plants,
      cost: stock.cost,
      bank: finalGreeneryBank(stock),
      freeCells: spaces !== undefined && spaces < stock.affordable ? spaces : undefined,
      yieldKey: finaleYieldKey(shell.game.parliament !== undefined, shell.finalGreeneryRawVm?.diverted !== undefined, shell.finalGreeneryRawVm?.ratingVetoed !== undefined),
      queue: finaleQueue(shell.playerView.players, shell.game.finalGreenery?.done ?? [], shell.thisPlayer.color, true),
      waitingOn: stage === 'wait' ?
        finaleWaitingOn(shell.playerView.players, shell.thisPlayer.color, liveWaitingSignal(shell.waitingOnPlayers)) :
        undefined,
    };
  });

  /**
   * THE FINALE SESSION (PL-303 / PL-304 — `finalGreenerySession.ts`): the player is IN the finale, from the
   * announce's A to the seat's end of the phase. Every reader that used to ask «is a placement on?» — the
   * dossier, Planet Focus, the command bar, the announce gate — asks THIS instead while it stands, so nothing
   * lets go between two greeneries or while another seat answers a triggered pick.
   *
   * A FOREIGN mandatory prompt for the viewer (their own Philares firing on another seat's landing) yields the
   * context: that decision's plate and surface stand exactly as anywhere else, and the context returns the
   * moment it is answered (the session itself never ends for it).
   */
  const finaleForeignPrompt = computed((): boolean => {
    const wf = shell.playerView.waitingFor;
    return wf !== undefined && wf.finalGreeneryPrompt === undefined;
  });

  const finaleSessionEngaged = computed((): boolean => {
    return finaleSessionState.active && !finaleSessionState.collapsed && !finaleForeignPrompt.value;
  });

  /** The player minimized the finale (B) — the board home's plate is the way back. */
  const finaleCollapsed = computed((): boolean => {
    return finaleSessionState.active && finaleSessionState.collapsed;
  });

  /** WHERE the context stands: the pick is out / a greenery is landing / another seat decides. */
  const finaleStage = computed((): FinaleStage | undefined => {
    if (!finaleSessionEngaged.value) {
      return undefined;
    }
    return finaleStageOf({
      pickOut: shell.finalGreeneryPickPending && shell.taskSpacePending !== undefined,
      promptStands: shell.finalGreeneryRawVm !== undefined,
      committing: shell.finalGreeneryCommitting,
    });
  });

  /**
   * The finale prompt is the SESSION's, never the generic host's: while the session lives, the host must not
   * serve it for the frame between a landing and the next pick (the «модалка мигает» of the field report).
   */
  const finalePromptOwned = computed((): boolean => {
    return finaleSessionState.active && shell.finalGreeneryRawVm !== undefined;
  });

  /**
   * THE SEAT'S FINALE IS OVER — the server's fact (`game.finalGreenery.done`), the END, or the phase gone from
   * the model altogether (an undo past it). The watcher ends the session on it; nothing else may.
   */
  const finaleOverForViewer = computed((): boolean => {
    if (!finaleSessionState.active) {
      return false;
    }
    const phase = shell.game.finalGreenery;
    return shell.game.phase === Phase.END ||
      (phase !== undefined && phase.done.includes(shell.thisPlayer.color)) ||
      (phase === undefined && shell.finalGreeneryRawVm === undefined);
  });

  /** Phase.END — the post-game scoring workspace's whole anchor. */
  const endgameFrameLive = computed((): boolean => {
    return shell.playerView.game.phase === Phase.END;
  });

  /** PRESENCE IS THE STACK (invariant 1) — the workspace's ONE v-if. */
  const endgameWorkspaceMounted = computed((): boolean => {
    return workspaceFrameRenders('endgame');
  });

  /** B = «Свернуть»: the scene is hidden, the final board is on show —
   *  the HUD comes back (`con-root--endgame` drops) and the workspace's
   *  own intent handler owns the road back. */
  const endgameCollapsed = computed((): boolean => {
    return consoleEndgameUi.collapsed;
  });

  /**
   * IS THE FINAL-SCORING STAGE ON SCREEN? The workspace scene — the
   * scoring ceremony and its internal «Обзор партии» analytics scene are
   * both faces of the SAME mounted stage owning the frame.
   *
   * FALSE while «Свернуть» has it hidden: the frame stays in the stack on
   * purpose (the ceremony resumes from the same beat, the state is intact),
   * but the player is inspecting the final BOARD, and every HUD policy keyed
   * on «is a workspace on the stage» has to answer no there. Written once
   * because it was answered twice: `con-root--endgame` read this state and
   * released the strip + player rail on the collapse, while the rail-replaced
   * policy read the STACK and kept the trophy gallery dark for the whole
   * post-game inspection.
   */
  const endgameStageUp = computed((): boolean => {
    return endgameWorkspaceMounted.value && !endgameCollapsed.value;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * THE END BOUNDARY WAITS FOR THE BOARD'S OWN STORY TO FINISH. Phase.END
   * rides the same response as the resolution of the game's last move, and
   * the board's post-commit half (the tile hero, the reward wave, the
   * cell's card-bonus lift, a remote landing) runs AFTER the view applies —
   * so sealing + `enterWorkspace('endgame')` on the raw rising edge stood
   * the finale up UNDER a still-flying board scene (the flight layers live
   * at z 11620–11670, the scoring scene at 11480). An automatic transition
   * has no press of the player's to honour, so it waits: the final
   * placement lands on a board the player can see, THEN the scoring scene
   * opens. The gate is animation flags ONLY (each self-bounded by its
   * owning module's safety ceiling) plus the shared cap — a stalled flight
   * costs seconds, never the finale — and the synchronous fast path keeps
   * a quiet board (and every reload into an ended game) byte-identical to
   * the old edge. The conditions are re-checked at the wait's resolution:
   * an undo can drop Phase.END mid-wait, and a second edge may have opened
   * the frame already.
   */
  function openEndgameWorkspaceOverQuietBoard(): void {
    const open = () => {
      if (!endgameFrameLive.value || workspaceFrameKnown('endgame')) {
        return;
      }
      sealLiveGameSurfaces();
      // The two surfaces this component owns as its OWN state (the seal
      // can only reach module-reactive ones).
      shell.playedOpen = false;
      shell.journalColonyInspect = undefined;
      shell.dockHover = false;
      // …and the HAND'S PRESENTATION. `handBodyCards` empties the layer
      // on the same frame, so an album that was open (bodies in
      // `shelf`/`packet`, an episode mid-timeline) would leave the pack
      // stuck in a foreign mode with no elements left to reconcile it.
      // Same call the sale-cancel / game-switch paths make.
      resetHandReveal();
      enterWorkspace('endgame', {anchor: {type: 'phase', phase: 'end'}});
    };
    // THE SCREEN IS HANDED OVER, not merely the board's story (state delivery, 2026-10-28 — `screenHandoff.ts`):
    // the game's LAST move routinely raises a parameter AND draws a card — the final greenery's cell pays a card
    // whose reveal, take and flight into the dock the finale used to open OVER. Everything the player is still
    // owed on the live screen finishes first (the board's story, a foreign landing, the reveal's take, the
    // intake, the tokens); bounded and named by the director.
    if (!screenHandoffOwed()) {
      open();
      return;
    }
    void waitScreenHandoff('endgame-open', {alive: () => endgameFrameLive.value}).then((outcome) => {
      if (outcome !== 'dead') {
        open();
      }
    });
  }

  /**
   * THE POST-GAME IS A PHASE ROOT (the start/draft pattern): Phase.END
   * stands the scoring workspace up; anything else marks «this load watched
   * the live game» — the ONE fact that decides whether reaching END plays
   * the ceremony (a finish the player was present for) or lands on the
   * settled result (a reload into an already-ended game must never replay
   * a reveal uninvited). The falling edge (an undo / admin rollback) tears
   * the frame down and resets the ceremony state completely.
   *
   * ⚠ THE RISING EDGE IS A TEARDOWN FIRST. Phase.END arrives from the POLL,
   * so whatever the player had open at that instant is still open — and the
   * scoring scene is one of the LOWEST layers in the shell (11480), under
   * the quick wheel, every sheet, Info Mode and the hand pack. The workspace
   * then consumes the whole pad, so none of them could be dismissed any
   * more: an open action wheel became a lid welded over the finale. ONE
   * named seal closes the live game down (`sealLiveGameSurfaces` + the two
   * surfaces this component owns itself) BEFORE the frame stands up, so the
   * post-game always starts from a screen somebody chose. Both halves live
   * in `openEndgameWorkspaceOverQuietBoard`, which additionally waits out
   * the board's own final animation before standing the frame up.
   */
  function whenEndgameFrameLiveChanges(live: boolean): void {
    if (live) {
      if (!workspaceFrameKnown('endgame')) {
        openEndgameWorkspaceOverQuietBoard();
      }
    } else {
      if (phaseRootAnywhere('endgame')) {
        closePhaseRoot('endgame');
        resetConsoleEndgame();
      }
      // AFTER the reset — the falling edge fires exactly once, and a
      // reset that wiped this note afterwards would turn the NEXT end of
      // the game (an undo, then finishing again) into a silent settle.
      noteConsoleEndgameLivePhase();
    }
  }

  return {
    finalePanel,
    finaleForeignPrompt,
    finaleSessionEngaged,
    finaleCollapsed,
    finaleStage,
    finalePromptOwned,
    finaleOverForViewer,
    endgameFrameLive,
    endgameWorkspaceMounted,
    endgameCollapsed,
    endgameStageUp,
    openEndgameWorkspaceOverQuietBoard,
    whenEndgameFrameLiveChanges,
  };
}

export type FinaleController = ReturnType<typeof createFinaleController>;
