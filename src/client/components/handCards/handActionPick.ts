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
export const handActionPickResult = reactive<{card: CardName | undefined, epoch: number}>({
  card: undefined,
  epoch: 0,
});

/** PlayerHome delivers the card chosen in the overlay back to the confirm modal. */
export function deliverActionPick(card: CardName): void {
  handActionPickResult.card = card;
  handActionPickResult.epoch++;
}
