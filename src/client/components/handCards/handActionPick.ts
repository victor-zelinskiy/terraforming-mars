import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';

/**
 * RESULT BRIDGE for the "pick a card from hand" step of the card-action
 * confirmation flow. The flow is a round-trip across surfaces:
 *
 *   CardActionConfirmContent  ──@pick-card──▶  PlayerHome
 *        (still mounted,                          opens the КАРТЫ В РУКЕ overlay
 *         suppressed)                             in client-pick mode
 *                                                       │ player picks + confirms
 *                                                       ▼
 *   CardActionConfirmContent  ◀── watches ───  deliverActionPick(card)
 *        captures the card,                     (PlayerHome, on resolve)
 *        re-shows, enables ВЫПОЛНИТЬ
 *
 * The overlay can't hand a value straight back to the deep-in-the-tree confirm
 * modal, so PlayerHome writes the picked card here and the confirm modal watches
 * `epoch` (bumped on every delivery, so two picks of the SAME card still fire).
 * Module scope so it survives the `playerkey` remount, like the other overlay
 * states.
 */
export const handActionPickResult = reactive<{card: CardName | undefined, cards: ReadonlyArray<CardName>, epoch: number}>({
  card: undefined,
  // The FULL picked set — for a MULTI-select hand pick (Public Plans "reveal any
  // number of cards"). A single pick mirrors it as `[card]`, so a consumer can read
  // either `card` (single) or `cards` (multi). Bumped epoch fires the watcher.
  cards: [],
  epoch: 0,
});

/** PlayerHome delivers the (single) card chosen in the overlay back to the modal. */
export function deliverActionPick(card: CardName): void {
  handActionPickResult.card = card;
  handActionPickResult.cards = [card];
  handActionPickResult.epoch++;
}

/** PlayerHome delivers the WHOLE multi-select set back to the modal (Public Plans).
 *  Fires even for an empty set, so the modal captures "reveal 0 cards". */
export function deliverActionPickMulti(cards: ReadonlyArray<CardName>): void {
  handActionPickResult.card = cards[0];
  handActionPickResult.cards = [...cards];
  handActionPickResult.epoch++;
}
