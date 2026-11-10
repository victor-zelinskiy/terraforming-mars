/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SEAT CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed} from 'vue';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {isCardDiscardActive} from '@/client/console/cardDiscard/consoleCardDiscard';
import {armQuestionTable, clearSettlementTable, settlementTable} from '@/client/console/colonyTrade/settlementTable';
import {Phase} from '@/common/Phase';
import {generationPhaseOf} from '@/common/game/generationPhase';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';
import {closeWorkspaceOutcomeChain} from '@/client/console/consoleWorkspaceOutcome';
import {awaitingViewerInput, viewerHasPassed} from '@/client/console/offTurnReason';
import {hasTurn} from '@/client/console/turnIntents';
import {infoModeState} from '@/client/console/infoModeState';
import {actionLabelForPlayer, liveWaitingSignal} from '@/client/components/overview/playerLabels';
import type {StagedColonyModel, StagedVoteModel} from '@/common/models/ActionPreviewModel';
import type {MaController} from '@/client/console/shell/maController';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type SeatPort = {
  readonly endgameCollapsed: boolean,
  readonly endgameFrameLive: boolean,
  readonly endgameWorkspaceMounted: boolean,
  game: UnwrapRef<MaController['game']>,
  readonly mandatoryDeferredActive: boolean,
  readonly placementActive: boolean,
  readonly playerView: PlayerViewModel,
  readonly stagedColonyModel: StagedColonyModel | undefined,
  readonly stagedVoteModel: StagedVoteModel | undefined,
  readonly waitingOnPlayers: ReadonlyArray<Color>,
};

export function createSeatController(shell: SeatPort) {
  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const thisPlayer = computed(() => {
    return shell.playerView.thisPlayer;
  });

  const myTurn = computed((): boolean => {
    return hasTurn(shell.playerView);
  });

  /** The server is waiting on the VIEWER at all — the free action menu OR a
   *  mandatory sub-decision (corp first action / forced reaction / placement /
   *  any deferred prompt). `myTurn` ⊂ this: when a mandatory prompt is pending
   *  `myTurn` is false but this stays true, so an off-turn reason reads
   *  «Сначала завершите текущее действие», not «Сейчас не ваш ход». */
  const awaitingInput = computed((): boolean => {
    return awaitingViewerInput(shell.playerView);
  });

  /** The viewer has passed this generation — every off-turn reason says so, never «not your turn» (class CT). */
  const viewerPassed = computed((): boolean => {
    return viewerHasPassed(shell.playerView);
  });

  /**
   * THE QUESTION TABLE'S FACTS as a VALUE key («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» Ф4, host 2): the batch a card's
   * question sealed (`pendingAnswer.kind === 'question'` — Mars University after the play's own draw), the next
   * batch of the same action root (the answer's draw), and whether the question still stands. The watcher arms /
   * advances / ends the table on it — pre-flush, like the colony marker's.
   */
  const questionTableKey = computed((): string => {
    const t = settlementTable;
    const events = drawnCardsState.events;
    const ask = [...events].reverse().find((e) => e.pendingAnswer?.kind === 'question' && e.pendingAnswer.draws === true &&
      e.pendingAnswer.card !== undefined && e.actionId !== undefined);
    const root = ask?.actionId ?? (t.kind === 'question' ? t.actionId : 0);
    const askBatch = ask?.id ?? t.askBatch;
    const askCard = ask?.pendingAnswer?.card ?? t.askCard;
    const next = root === 0 ? undefined : events.find((e) => !e.dismissed && e.actionId === root && e.id !== askBatch);
    const stands = root !== 0 && shell.playerView.waitingFor?.choiceContext?.source?.card === askCard;
    return `${ask?.id ?? 0}|${root}|${askCard}|${next?.id ?? 0}|${stands ? 1 : 0}|${isCardDiscardActive() ? 1 : 0}`;
  });

  /** Every card the viewer holds (incl. Self-Replicating-Robots hosts) — the
   *  ownership test that decides whether a nested pick is a HAND pick. */
  const viewerHandNames = computed((): ReadonlySet<string> => {
    return new Set<string>([
      ...shell.playerView.cardsInHand.map((c) => c.name),
      ...(shell.playerView.thisPlayer.selfReplicatingRobotsCards ?? []).map((c) => c.name),
    ]);
  });

  /**
   * THE GAME IS OVER — the one predicate every «this instrument belongs to
   * the live game» read shares (the hand pack, the action vocabulary, the
   * blocked reason). Same fact as `endgameFrameLive`; a separate NAME
   * because those readers are not asking about a workspace anchor.
   */
  const postGame = computed((): boolean => {
    return shell.endgameFrameLive;
  });

  /**
   * THE POST-GAME INSPECTION — the player collapsed the results (B) to walk
   * the final state. The console goes READ-ONLY FREE ROAM: the pad routes
   * through the ordinary chain (board + its two inspection modes, Journal,
   * «Разыграно», Information, the colonies and hydro screens), the action
   * vocabulary answers «партия завершена», and B at the board-home root is
   * the road back to the results.
   *
   * It exists because the alternative shipped: the workspace consumed the
   * whole pad for the WHOLE post-game, so «свернуть» opened a board the
   * player could look at and nothing else — a still image with one button.
   */
  const postGameInspection = computed((): boolean => {
    return shell.endgameWorkspaceMounted && shell.endgameCollapsed;
  });

  // ── MANDATORY ANNOUNCEMENT GATE (consoleMandatoryGate.ts) ────────────
  /**
   * The viewer's status is an OFF-TURN FORCED REACTION (not their own active
   * turn) — reuses the canonical player-status classifier so the gate and the
   * chip can never disagree. Gates the triggered host sub-prompts (an
   * opponent's card forcing a SelectPlayer / production loss); the viewer's
   * OWN turn continuations stay `turn` and open immediately.
   */
  /** The server asks the viewer NOTHING — the turn has left them (the end of their press's chain). */
  const viewerAskedNothing = computed((): boolean => {
    return shell.playerView.waitingFor === undefined;
  });

  /**
   * The server asks the viewer in the ACTION phase while ANOTHER seat is active — a reaction to that seat's move (a
   * rival's ocean waking the viewer's Neptunian Power Consultants), never a stage of the viewer's own press. Narrower
   * than the strip's «forcedaction» on purpose: that label also covers the political phase and the solar phase, where
   * nobody's turn is running and a law's live play from the hand legitimately hosts its own woken effect.
   */
  const viewerAskedOffTurn = computed((): boolean => {
    return shell.playerView.waitingFor !== undefined && generationPhaseOf(shell.game) === Phase.ACTION && thisPlayer.value?.isActive !== true;
  });

  const viewerForcedReaction = computed((): boolean => {
    const label = actionLabelForPlayer(shell.playerView, thisPlayer.value, liveWaitingSignal(shell.waitingOnPlayers));
    // The FINALE is a forced reaction for the gate's purposes: the player was idle through production, so its
    // first prompt is ANNOUNCED (a stray press must not land on the board); the chip names it by its own label.
    return label === 'forcedaction' || label === 'finalgreenery';
  });

  /**
   * WHY A NEW ACTION CANNOT BE STARTED RIGHT NOW — '' when it can.
   *
   * ONE answer for every «почему нельзя» on the board home, because there is
   * only ever one real reason to be there: a decision is already owed. It
   * covers both shapes — a live board PLACEMENT, and a mandatory prompt the
   * player MINIMIZED to go and look around.
   *
   * It has to OUTRANK each surface's own arithmetic. With the sponsor's
   * play-from-hand minimized, the basic-actions wheel read «недостаточно
   * растений» / «сейчас недоступно» / «доступно после первого действия»: every
   * line individually true, and together a lie about why the game will not
   * move. The player was told five wrong things instead of the one right one.
   */
  const actionBlockedReason = computed((): string => {
    // …and the one reason that outranks even that: there is no game left to
    // act in. The post-game inspection walks the same screens with the same
    // verbs on them, so every one of those verbs needs an honest answer —
    // «сейчас не ваш ход» would be arithmetic about a turn order that no
    // longer exists. Stated ONCE, here, so the LT wheel, the standard
    // projects and the board-home guards can never disagree.
    if (postGame.value) {
      return 'The game is over';
    }
    // …a STAGED VOTE is a decision still open exactly as a staged cell is (the
    // latter rides `placementActive`): one reason while either stands.
    return shell.placementActive || shell.mandatoryDeferredActive || shell.stagedVoteModel !== undefined ||
      shell.stagedColonyModel !== undefined ?
      'Finish your current action first' : '';
  });

  /**
   * The INSPECTED player of the Information Workspace — a VIEW-ONLY
   * context (never the acting/local player; gameplay code must never read
   * it). One source: infoModeState.playerColor; a vanished color (player
   * left / stale state) degrades to the viewer's own seat.
   */
  const inspectedPlayer = computed((): PublicPlayerModel => {
    const color = infoModeState.playerColor;
    return shell.playerView.players.find((p) => p.color === color) ?? thisPlayer.value;
  });

  /** A seat's display name for a parliament caption (the winner's recipient). */
  const parliamentSeatName = computed((): (color: Color) => string => {
    return (color: Color) => shell.playerView.players.find((p) => p.color === color)?.name ?? color;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * THE PRESS'S CHAIN IS OVER at either structural end — the server asks the viewer nothing (the turn left them), or
   * asks them in the action phase while another seat is active (another seat's chain — `viewerAskedOffTurn`). From there a standing claim keeps its artifacts (the drawn card still
   * landing) and admits no question (the field lock of 2026-11-02 — `closeWorkspaceOutcomeChain`).
   */
  function whenViewerAskedNothingChanges(none: boolean): void {
    if (none) {
      closeWorkspaceOutcomeChain('server-asks-nothing');
    }
  }

  /** WATCH `viewerAskedOffTurn` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenViewerAskedOffTurnChanges(offTurn: boolean): void {
    if (offTurn) {
      closeWorkspaceOutcomeChain('asked-off-turn');
    }
  }

  /**
   * THE QUESTION TABLE arms on the batch a question SEALED (index 0 — the place lies sealed beside the batch's
   * cards), advances when the answer's draw is on the wire (index 1 — the place's card turns), and ENDS when the
   * question is gone with nothing drawn for it (a decline) or its answer taken. Pre-flush: the deck layer's verdict
   * (a later job) already knows the answer's batch is the table's.
   */
  function whenQuestionTableKeyChanges(): void {
    const t = settlementTable;
    const events = drawnCardsState.events;
    // Only a question whose answer may DRAW lays a place (a colony pick, a target seal the batch without one).
    const ask = [...events].reverse().find((e) => e.pendingAnswer?.kind === 'question' && e.pendingAnswer.draws === true &&
      e.pendingAnswer.card !== undefined && e.actionId !== undefined);
    if (ask !== undefined && ask.actionId !== undefined && ask.pendingAnswer?.card !== undefined) {
      armQuestionTable(ask.actionId, ask.pendingAnswer.card, ask.id, 0);
      return;
    }
    if (t.nonce === 0 || t.kind !== 'question') {
      return;
    }
    const next = events.find((e) => !e.dismissed && e.actionId === t.actionId && e.id !== t.askBatch);
    if (next !== undefined) {
      armQuestionTable(t.actionId, t.askCard, t.askBatch, 1);
      return;
    }
    const stands = shell.playerView.waitingFor?.choiceContext?.source?.card === t.askCard;
    if (!stands && !isCardDiscardActive()) {
      clearSettlementTable();
    }
  }

  return {
    thisPlayer,
    myTurn,
    awaitingInput,
    viewerPassed,
    questionTableKey,
    viewerHandNames,
    postGame,
    postGameInspection,
    viewerAskedNothing,
    viewerAskedOffTurn,
    viewerForcedReaction,
    actionBlockedReason,
    inspectedPlayer,
    parliamentSeatName,
    whenViewerAskedNothingChanges,
    whenViewerAskedOffTurnChanges,
    whenQuestionTableKeyChanges,
  };
}

export type SeatController = ReturnType<typeof createSeatController>;
