/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE TRACK'S SECOND DOOR — a Hydronetwork move entered from a CARD ACTION.
 *
 * «Хочу продвинуться по Гидросети» and «хочу использовать Storm Surge Barrier»
 * are two ways of starting the SAME move, and after the door they must be one
 * flow: one workspace, one destination preview, one pre-select, one commit, one
 * resolution. What is allowed to differ is only the entry CONTEXT — which is
 * what this module is. It is the exact sibling of `colonyTrade/colonyTradeEntry`,
 * for the exact same reason.
 *
 * IT EXISTS BECAUSE THE ALTERNATIVE CANNOT SATISFY THE FLOW AT ALL. Submitting
 * the card action first and then answering a track prompt would mark the card
 * used at the branch pick (`playActionCard` stamps `actionsThisGeneration`
 * synchronously), so by the time the destination is on screen the action is
 * spent and B has nothing to go back to. So the card entry submits NOTHING: it
 * walks the player into the workspace the console already owns, carrying the
 * SERVER's own verdict on the move, and the one confirm at the end sends the
 * whole thing — card pick, branch pick, the `{deltaProject, amount}` step and
 * the landed stage's pre-collected answers — as ONE batch.
 *
 * WHAT IS STORED, AND WHY EACH FIELD. `card` + `branchIndex` are the ADDRESS of
 * the move inside the card's own action tree (the branch's runtime `OrOptions`
 * index the server assigned in the preview; `-1` when that card had a single
 * available variant and the server collapses it). `offer` is the SERVER's
 * description of the move — position, destination, price — never re-derived
 * here. The `performPath` is deliberately NOT stored: it is re-resolved from the
 * LIVE `waitingFor` at commit time, so a view refresh between the door and the
 * confirm cannot make the batch address a stale menu.
 *
 * Everything here is pure or plain reactive state — no DOM, no Vue components —
 * so it runs under the server test runner.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import type {DeltaAdvanceOffer} from '@/common/models/DeltaBonusPromptModel';
import {buildActionBatch} from '@/client/console/consoleActionComposer';

export type DeltaAdvanceEntryState = {
  /** The card whose action opened this move. `''` = no card entry stands. */
  card: CardName | '';
  /** The branch's runtime `OrOptions` index, or `-1` when the server
   *  auto-resolves the card's lone available variant (no branch wrapper). */
  branchIndex: number;
  /** The server's own verdict on the move the branch would make. */
  offer: DeltaAdvanceOffer | undefined;
};

export const deltaAdvanceEntryState: DeltaAdvanceEntryState =
  reactive({card: '', branchIndex: -1, offer: undefined});

/** The player pressed «Открыть Гидросеть» on a card's advance branch. */
export function beginCardDeltaAdvance(card: CardName, branchIndex: number, offer: DeltaAdvanceOffer): void {
  deltaAdvanceEntryState.card = card;
  deltaAdvanceEntryState.branchIndex = branchIndex;
  deltaAdvanceEntryState.offer = offer;
}

/** The entry is over — B walked out, or the move committed and concluded. */
export function clearCardDeltaAdvance(): void {
  deltaAdvanceEntryState.card = '';
  deltaAdvanceEntryState.branchIndex = -1;
  deltaAdvanceEntryState.offer = undefined;
}

/** The card this move was entered from, `''` for the ordinary track entry. */
export function cardDeltaAdvanceCard(): CardName | '' {
  return deltaAdvanceEntryState.card;
}

/** The move on offer, or `undefined` when no card entry stands. */
export function cardDeltaAdvanceOffer(): DeltaAdvanceOffer | undefined {
  return deltaAdvanceEntryState.card === '' ? undefined : deltaAdvanceEntryState.offer;
}

/**
 * THE BATCH PREFIX of a card-entry commit: the card-action responses that must
 * land BEFORE the `{deltaProject, amount}` step — the wrapped activate pick and,
 * when the card offered a real choice, the branch pick.
 *
 * Deliberately the SAME `buildActionBatch` every other blue-card commit goes
 * through: a second, similar assembler is exactly how one server contract ends
 * up with two batch shapes. `branchIndex < 0` means the server collapsed the
 * card's lone available variant, so no branch wrapper is emitted at all (and
 * `PlayerInputBatch.reconcileBatchResponse` owns the remaining wrap/no-wrap
 * ambiguity, as it does for every other card).
 */
export function deltaAdvancePrefix(
  performPath: ReadonlyArray<number>,
  card: CardName,
  branchIndex: number,
): Array<unknown> {
  return buildActionBatch({
    performPath,
    cardName: card,
    branchIndex,
    preResponses: [],
    optionResponse: undefined,
    stepResponses: [],
  });
}
