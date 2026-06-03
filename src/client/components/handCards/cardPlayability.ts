import {CardModel} from '@/common/models/CardModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';

/**
 * Final play-state for one hand card.
 *
 * The "playable now" gate is authoritative: a card is playable ONLY when it's
 * the player's action window (`turnAvailable`) AND the server's action menu
 * lists it (`serverPlayable`) — this mirrors the menu exactly so the button
 * can never offer an illegal play.
 *
 * The REASONS are now produced authoritatively on the server (see
 * `src/server/models/unplayableReasons.ts`) and ride along on the card model
 * as `card.unplayableReasons` — covering cost, requirements, tags,
 * production, tile placement, targets and bespoke rules. The only reason the
 * client adds itself is the action-window one: the server can't know whether
 * it's THIS viewer's turn when it serializes a card in isolation, so when the
 * card is intrinsically playable but it isn't the player's moment, we fall
 * back to a "not your turn" reason.
 */
export type HandCardPlayState = {
  playable: boolean;
  reasons: ReadonlyArray<UnplayableReason>;
};

export function computeHandCardPlayState(
  card: CardModel,
  turnAvailable: boolean,
  serverPlayable: boolean,
  awaitingInput: boolean,
): HandCardPlayState {
  if (turnAvailable && serverPlayable) {
    return {playable: true, reasons: []};
  }
  const serverReasons = card.unplayableReasons ?? [];
  if (serverReasons.length > 0) {
    return {playable: false, reasons: serverReasons};
  }
  // No intrinsic blocker from the server → the card itself is fine, it's just
  // not the player's window to play it (not their turn, or mid sub-action).
  // It's this player's turn (the server is waiting on them) but mid-way
  // through another mandatory step (e.g. placing a tile) → finish that first.
  // Otherwise it's simply another player's turn.
  if (awaitingInput) {
    return {playable: false, reasons: [{type: 'phase', message: 'Finish your current action first'}]};
  }
  return {playable: false, reasons: [{type: 'turn', message: 'Not your turn right now'}]};
}
