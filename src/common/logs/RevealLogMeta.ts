import {CardName} from '../cards/CardName';

/**
 * A structured marker stamped on a LogMessage that PUBLICLY reveals / shows
 * cards (the card NAMES are already carried by the message's CARD/CARDS tokens).
 * Lets the premium journal + notification system detect a reveal WITHOUT parsing
 * the (translatable) message text, and tell a deck-reveal from a hand-show.
 *
 * The card names themselves stay in the message data (public log) — this only
 * adds the SEMANTICS (where from, what happened, which source card).
 */

/** Where the revealed cards came from. */
export type RevealOrigin = 'deck' | 'hand';

/** What happened to them afterwards. */
export type RevealResult = 'discarded' | 'shown' | 'kept' | 'revealed';

export type RevealLogMeta = {
  origin: RevealOrigin;
  result: RevealResult;
  /** The card / corp that caused the reveal (PublicPlans, SearchForLife, …). */
  source?: CardName;
};
