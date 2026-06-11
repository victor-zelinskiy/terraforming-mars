import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';

/**
 * RESULT BRIDGE for "pick a target card on the РАЗЫГРАНО (played-cards) board" —
 * the >3-candidate card-target picker hosted by the play / action-confirm modals.
 * Mirrors `handActionPick` (the КАРТЫ В РУКЕ twin):
 *
 *   HandCardPaymentContent /        ──@pick-played-card──▶  PlayerHome
 *   CardActionConfirmContent              (suppressed)         opens РАЗЫГРАНО in
 *        (still mounted, suppressed)                           pick mode
 *                                                                   │ player clicks a card
 *                                                                   ▼
 *   …Content  ◀── watches epoch ───  deliverPlayedCardActionPick(card)
 *        captures the card, re-shows                      (resolve → PlayerHome)
 *
 * The overlay can't hand a value straight back to the deep-in-the-tree modal, so
 * PlayerHome writes the picked card here and the modal watches `epoch` (bumped on
 * every delivery, so two picks of the SAME card still fire). Module scope so it
 * survives the `playerkey` remount, like the other overlay states.
 */
export const playedCardActionPickResult = reactive<{card: CardName | undefined, epoch: number}>({
  card: undefined,
  epoch: 0,
});

/** PlayerHome delivers the card chosen on the РАЗЫГРАНО board back to the modal. */
export function deliverPlayedCardActionPick(card: CardName): void {
  playedCardActionPickResult.card = card;
  playedCardActionPickResult.epoch++;
}
