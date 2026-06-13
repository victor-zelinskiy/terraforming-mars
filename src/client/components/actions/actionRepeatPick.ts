import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';

/**
 * RESULT BRIDGE for "pick an ACTION to repeat on the ДЕЙСТВИЯ overlay" — the
 * >3-candidate repeat-action picker (ProjectInspection / Viron) hosted by the
 * play / action-confirm modals. Mirrors `playedCardActionPick` / `handActionPick`:
 *
 *   HandCardPaymentContent /        ──@pick-action──▶  PlayerHome
 *   CardActionConfirmContent              (suppressed)     opens ДЕЙСТВИЯ in
 *        (still mounted, suppressed)                       pick mode
 *                                                                │ player clicks an action
 *                                                                ▼
 *   …Content  ◀── watches epoch ───  deliverActionRepeatPick(card)
 *        captures the card → @repeat-action            (resolve → PlayerHome)
 *
 * The overlay can't hand a value straight back to the deep-in-the-tree modal, so
 * PlayerHome writes the picked action card here and the modal watches `epoch`
 * (bumped on every delivery, so two picks of the SAME card still fire). Module
 * scope so it survives the `playerkey` remount, like the other overlay states.
 */
export const actionRepeatPickResult = reactive<{card: CardName | undefined, epoch: number}>({
  card: undefined,
  epoch: 0,
});

/** PlayerHome delivers the action chosen on the ДЕЙСТВИЯ overlay back to the modal. */
export function deliverActionRepeatPick(card: CardName): void {
  actionRepeatPickResult.card = card;
  actionRepeatPickResult.epoch++;
}
