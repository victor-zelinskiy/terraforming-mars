import {CardModel} from '@/common/models/CardModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';

/**
 * What's blocking a hand card from being played right now. Three distinct
 * states, because "can't act on this card" has two very different causes that
 * deserve very different UI:
 *
 *   'none'  — playable RIGHT NOW. Active РАЗЫГРАТЬ button.
 *
 *   'soft'  — playable by the game RULES, but it simply isn't the player's
 *             action window (not their turn, or mid a mandatory sub-action —
 *             "finish your current action first"). This is NOT a requirement
 *             failure, so it must never read as "НЕДОСТУПНА": the card stays
 *             bright (no dim, no badge), the button stays РАЗЫГРАТЬ but
 *             disabled, the hover is a single calm one-liner (not a
 *             requirements list), and the card is NOT counted as unavailable.
 *
 *   'rules' — genuinely unplayable by the game rules (cost, requirements,
 *             tile placement, targets, bespoke rules…). The full "НЕДОСТУПНА"
 *             treatment: dimmed card + "Cannot play" badge + the requirements
 *             popover, and counted in the unavailable total.
 *
 * The "playable now" gate is authoritative: a card is `'none'` ONLY when it's
 * the player's action window (`turnAvailable`) AND the server's action menu
 * lists it (`serverPlayable`) — this mirrors the menu exactly so the button
 * can never offer an illegal play.
 *
 * The rule REASONS are produced authoritatively on the server (see
 * `src/server/models/unplayableReasons.ts`) and ride along on the card model
 * as `card.unplayableReasons`. Their presence is what separates a 'rules'
 * block from a 'soft' one: a card that meets every rule carries no server
 * reasons, so when it still can't be played it's only the turn/phase window
 * stopping it.
 */
export type HandCardBlock = 'none' | 'soft' | 'rules';

export type HandCardPlayState = {
  /** Convenience for `block === 'none'` — the card can be played right now. */
  playable: boolean;
  block: HandCardBlock;
  /** Requirements list — populated ONLY for the 'rules' block. */
  reasons: ReadonlyArray<UnplayableReason>;
  /** Single short reason for the 'soft' block (undefined otherwise). */
  softReason: UnplayableReason | undefined;
};

export function computeHandCardPlayState(
  card: CardModel,
  turnAvailable: boolean,
  serverPlayable: boolean,
  awaitingInput: boolean,
): HandCardPlayState {
  if (turnAvailable && serverPlayable) {
    return {playable: true, block: 'none', reasons: [], softReason: undefined};
  }
  const serverReasons = card.unplayableReasons ?? [];
  if (serverReasons.length > 0) {
    // Genuinely unplayable by the rules — independent of whose turn it is.
    return {playable: false, block: 'rules', reasons: serverReasons, softReason: undefined};
  }
  // The card meets every rule; it just isn't the player's window to play it.
  // It's this player's turn (the server is waiting on them) but mid-way
  // through another mandatory step (e.g. placing a tile) → finish that first.
  // Otherwise it's simply another player's turn. Either way this is a SOFT
  // block — not a requirement failure — so it gets a calm disabled button + a
  // simple one-line hover, never the НЕДОСТУПНА treatment, and isn't counted
  // as unavailable.
  const softReason: UnplayableReason = awaitingInput ?
    {type: 'phase', message: 'Finish your current action first'} :
    {type: 'turn', message: 'Not your turn right now'};
  return {playable: false, block: 'soft', reasons: [], softReason};
}
