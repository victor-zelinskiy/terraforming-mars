import {CardName} from '../../../common/cards/CardName';
import {PRELUDE2_CARDS_HELD_BACK} from '../../../common/cards/prelude2Adaptation';

/**
 * PRELUDE 2 — the server's PREDICATE over the hold-back list. The list itself (the
 * worklist: two kinds of row, the contract of a row, how the scaffolding ends) lives in
 * `common/cards/prelude2Adaptation.ts`, because the premium scope reads it on both sides
 * (`common/cards/premiumScope.ts` — a card enters every premium guard the moment its row
 * leaves). Re-exported here for the server's readers.
 *
 * A dev may still force a held-back card onto a table through the guaranteed cards
 * (`customProjectCards` / `customPreludes` / `customCorporationsList`) — `GameCards` adds
 * those AFTER this filter, which is how a single card is tested in a game before its row
 * goes.
 *
 * Guard and worklist printer: `tests/cards/prelude2/Prelude2CardsHeldBack.spec.ts`.
 */
export {
  PRELUDE2_CARDS_TO_ADAPT_IN_PLACE,
  PRELUDE2_CARDS_AWAITING_REDUX_REPLACEMENT,
  PRELUDE2_CARDS_HELD_BACK,
} from '../../../common/cards/prelude2Adaptation';

/**
 * True when `cardName` must stay out of every deck because it is a Prelude 2 card not
 * yet adapted. A held-back card reaches a deck through the Prelude 2 manifest only, so
 * no option is read: whatever the table, the answer is the list.
 */
export function isPrelude2CardHeldBack(cardName: CardName): boolean {
  return PRELUDE2_CARDS_HELD_BACK.has(cardName);
}
