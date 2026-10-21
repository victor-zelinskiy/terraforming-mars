import {CardName} from '../../../common/cards/CardName';
import {GameOptions} from '../../game/GameOptions';
import {TURMOIL_CARDS_HELD_BACK_UNDER_REDUX} from '../../../common/cards/turmoilReduxAdaptation';

/**
 * CLASSIC TURMOIL CARDS UNDER TURMOIL REDUX — the server's PREDICATE over the hold-back
 * list. The list itself (the worklist: two groups of names, the contract of a row, how the
 * scaffolding ends) lives in `common/cards/turmoilReduxAdaptation.ts`, because the premium
 * scope reads it on both sides (`common/cards/premiumScope.ts` — a classic card enters every
 * premium guard the moment its row leaves). Re-exported here for the server's readers.
 *
 * A dev may still force a held-back card into a Redux game through the guaranteed cards
 * (`customProjectCards` / `customCorporationsList`) — `GameCards` adds those AFTER this
 * filter, which is how a single card is tested on a Redux table before its row goes.
 *
 * Guard and worklist printer: `tests/cards/turmoil/TurmoilCardsUnderRedux.spec.ts`.
 */
export {
  TURMOIL_CARDS_TO_ADAPT_IN_PLACE,
  TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT,
  TURMOIL_CARDS_HELD_BACK_UNDER_REDUX,
} from '../../../common/cards/turmoilReduxAdaptation';

/**
 * True when `cardName` must stay out of THIS game's decks because it is a classic
 * Turmoil card not yet adapted to the Mars Parliament. Answers only for a Redux table
 * without the classic engine (the only legal Redux configuration — `Game.newInstance`
 * refuses both at once); a classic Turmoil game deals every card of its manifest.
 */
export function isTurmoilCardHeldBackUnderRedux(cardName: CardName, gameOptions: GameOptions): boolean {
  if (gameOptions.turmoilReduxExpansion !== true || gameOptions.turmoilExtension === true) {
    return false;
  }
  return TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.has(cardName);
}
