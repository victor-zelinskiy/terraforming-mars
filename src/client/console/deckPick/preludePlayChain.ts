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
 *
 * THE HOST IS A PARAMETER (P45 Board of Directors · ledger ET): the pick that plays the prelude stands in the hand
 * (P91 WG Project) OR in «ДЕЙСТВИЯ КАРТ» (P45's action — the verdict after the reveal). Every reader asks the chain's
 * OWN host — the frame that steps aside for the board, the frame whose unmount ends the chain — never the hand by name.
 */
import {reactive} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {taskFor} from '@/client/console/consoleTaskRouter';
import {currentRevealEvent, pendingRevealEvents} from '@/client/components/drawnCards/drawnCardsState';
import {workspaceClaimsRevealSource} from '@/client/console/consoleWorkspaceOutcome';
import {stackYieldedToBoard, workspaceFrameDescended, workspaceFrameMounted} from '@/client/console/consoleWorkspaceStack';

/** The workspaces a prelude pick that PLAYS can stand in. */
export type PreludeChainHost = 'hand' | 'card-actions';

export const preludePlayChainState = reactive({
  live: false,
  card: '' as string,
  host: 'hand' as PreludeChainHost,
});

/** The pick played `card` (not a burn): its follow-ups are this chain's until its HOST's flow is over. */
export function beginPreludePlayChain(card: CardName, host: PreludeChainHost = 'hand'): void {
  preludePlayChainState.live = true;
  preludePlayChainState.card = card;
  preludePlayChainState.host = host;
}

export function endPreludePlayChain(): void {
  preludePlayChainState.live = false;
  preludePlayChainState.card = '';
  preludePlayChainState.host = 'hand';
}

/** Does a live chain stand in `host`? */
export function preludeChainOn(host: PreludeChainHost): boolean {
  return preludePlayChainState.live && preludePlayChainState.host === host;
}

/**
 * A placement now: the host steps aside instead of going home (the host carries the chain's play) — descended into the
 * play, or standing in browse with a step of the chain hosted in its zone (P58 · FS: Project Eden's «which tile next»
 * answered in the hand, the pick's descent long folded). Its return stays gated by `preludeChainOwesHand`.
 */
export function preludeChainYieldsToBoard(): boolean {
  return preludePlayChainState.live &&
    (workspaceFrameDescended(preludePlayChainState.host) || workspaceFrameMounted(preludePlayChainState.host));
}

/**
 * The play's claim survives the board step — it is a step of the flow, not its end. …and the chain's OWN steps between
 * its placements (P58 · FS — Project Eden's «which tile next», and the placement it asks before it is admitted to the
 * board): released there, the hand concluded on the answer and the next step stood as a band of its own.
 */
export function preludeChainHoldsClaim(placementActive: boolean, view?: PlayerViewModel): boolean {
  if (!preludePlayChainState.live) {
    return false;
  }
  if (placementActive || stackYieldedToBoard()) {
    return true;
  }
  const task = view === undefined ? undefined : taskFor(view);
  return task?.kind === 'space' || (task?.kind === 'choice' && task.flavor === 'placementOrder');
}

/** The task kinds the hand hosts as the play's own next stage (the play claim's kinds + the hosted colony step). */
const HAND_HOSTED_KINDS: ReadonlySet<string> = new Set(['deckSelect', 'cardSelect', 'payment', 'colony']);

/** After the board step: does the flow still owe the HAND something it hosts? */
export function preludeChainOwesHand(view: PlayerViewModel): boolean {
  const task = taskFor(view);
  if (task !== undefined && HAND_HOSTED_KINDS.has(task.kind)) {
    return true;
  }
  // P58 · FS — the played prelude's «which tile next» between its placements (Project Eden): a step of the play the
  // host stands in — the hand comes back for it, and for the discard the third tile hands it after (below).
  if (task?.kind === 'choice' && task.flavor === 'placementOrder') {
    return true;
  }
  // P55 · FN — the played prelude's OWN discard (Old Mining Colony: the colony first, then «discard 1 card»): a card
  // the server names as the asker, never a colony's bonus discard. The pick stands in the album the chain already
  // holds open, so the claim stays until it is answered.
  const discard = view.waitingFor?.discardPrompt;
  if (task?.kind === 'handSelect' && discard?.source?.kind === 'card' && discard.colonyBonus === undefined &&
      discard.colonyRepeat === undefined) {
    return true;
  }
  const standing = currentRevealEvent();
  if (standing !== undefined && workspaceClaimsRevealSource(standing.source)) {
    return true;
  }
  return pendingRevealEvents().some((entry) => workspaceClaimsRevealSource(entry.source));
}

/** Every applied view: a chain whose host is gone (and not merely aside for the board) is over. */
export function notePreludeChainView(): void {
  if (preludePlayChainState.live && !stackYieldedToBoard() && !workspaceFrameMounted(preludePlayChainState.host)) {
    endPreludePlayChain();
  }
}
