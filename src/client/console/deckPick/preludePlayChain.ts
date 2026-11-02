/*
 * @console-shared LIVE — console native stands on this file.
 *
 * PL-1467 · THE HAND YIELDS TO THE BOARD AND COMES BACK IF THE FLOW STILL OWES (P91 WG Project, decision 6).
 *
 * A prelude played out of the mid-game pick may ask a PLACEMENT (Early Settlement's city, Great Aquifer's two oceans,
 * Experimental Forest's greenery) — and may still owe something AFTER it (Experimental Forest: «search for 2 plant
 * cards»). The hand used to be sent home on the placement (`goBoardHome`): the board took the screen, and whatever the
 * prelude produced afterwards had no workspace — the found cards stood in a band of their own, the hand that made the
 * play long gone. While THIS chain stands:
 *
 *   · the placement makes the hand STEP ASIDE (the stack is parked for the board, at the same depth) and the play's
 *     claim is KEPT — the board step is a step of the flow, not the end of it;
 *   · when the board's work is over, the hand comes BACK only if the flow still owes it something it hosts — a batch
 *     the claim owns, a card pick, a payment, a colony (`preludeChainOwesHand`); owed nothing, the flow FINISHES ON THE
 *     BOARD (the yielded stack is dropped, the claim released) — never a return into an empty workspace.
 *
 * Gated to this chain on purpose: an ordinary play from the hand keeps its own road (a staged tile commits on the
 * board and ends there); the law is general, its first owner is the prelude a pick played.
 */
import {reactive} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {taskFor} from '@/client/console/consoleTaskRouter';
import {currentRevealEvent, pendingRevealEvents} from '@/client/components/drawnCards/drawnCardsState';
import {workspaceClaimsRevealSource} from '@/client/console/consoleWorkspaceOutcome';
import {stackYieldedToBoard, workspaceFrameDescended, workspaceFrameMounted} from '@/client/console/consoleWorkspaceStack';

export const preludePlayChainState = reactive({
  live: false,
  card: '' as string,
});

/** The pick played `card` (not a burn): its follow-ups are this chain's until the hand's flow is over. */
export function beginPreludePlayChain(card: CardName): void {
  preludePlayChainState.live = true;
  preludePlayChainState.card = card;
}

export function endPreludePlayChain(): void {
  preludePlayChainState.live = false;
  preludePlayChainState.card = '';
}

/** A placement now: the hand steps aside instead of going home (the hand hosts the chain's play). */
export function preludeChainYieldsToBoard(): boolean {
  return preludePlayChainState.live && workspaceFrameDescended('hand');
}

/** The play's claim survives the board step — it is a step of the flow, not its end. */
export function preludeChainHoldsClaim(placementActive: boolean): boolean {
  return preludePlayChainState.live && (placementActive || stackYieldedToBoard());
}

/** The task kinds the hand hosts as the play's own next stage (the play claim's kinds + the hosted colony step). */
const HAND_HOSTED_KINDS: ReadonlySet<string> = new Set(['deckSelect', 'cardSelect', 'payment', 'colony']);

/** After the board step: does the flow still owe the HAND something it hosts? */
export function preludeChainOwesHand(view: PlayerViewModel): boolean {
  const task = taskFor(view);
  if (task !== undefined && HAND_HOSTED_KINDS.has(task.kind)) {
    return true;
  }
  const standing = currentRevealEvent();
  if (standing !== undefined && workspaceClaimsRevealSource(standing.source)) {
    return true;
  }
  return pendingRevealEvents().some((entry) => workspaceClaimsRevealSource(entry.source));
}

/** Every applied view: a chain whose hand is gone (and not merely aside for the board) is over. */
export function notePreludeChainView(): void {
  if (preludePlayChainState.live && !stackYieldedToBoard() && !workspaceFrameMounted('hand')) {
    endPreludePlayChain();
  }
}
