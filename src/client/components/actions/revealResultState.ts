import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {ActionRevealDescriptor} from '@/common/models/ActionPreviewModel';

/**
 * Module-level state for the premium REVEAL-RESULT overlay (SearchForLife /
 * AsteroidDeflectionSystem). Lives at module scope — like journalState /
 * startGameFlowState — so it SURVIVES App.vue's `playerkey` remount of
 * <player-home> on every server response. Without that, the overlay would be torn
 * down by the very response that carries the reveal result.
 *
 * Set when the player confirms a reveal action (CardActionConfirmContent →
 * PlayerHome.onCardActionConfirm), BEFORE the confirm modal closes. The App-level
 * RevealResultOverlay then bridges the round-trip: it shows the `pending` reveal
 * slot immediately, then the `result` once `playerView.thisPlayer.lastReveal`
 * (matching `action`) arrives. The player closes it with «ОК» → `active = false`.
 *
 * `active` is the only show-gate, so a stale server `lastReveal` (already cleared
 * on the next input, but conceivably lingering for a frame) can never resurface.
 */
export const revealResultState = reactive<{
  active: boolean;
  /** The action card being revealed — matched against `lastReveal.action`. */
  action: CardName | undefined;
  /** The source card model (for the overlay's source pane), set on confirm. */
  cardName: CardName | undefined;
  /** The reveal descriptor (check + reward), for the pending/empty slot. */
  descriptor: ActionRevealDescriptor | undefined;
}>({
  active: false,
  action: undefined,
  cardName: undefined,
  descriptor: undefined,
});

/** Begin a reveal result cycle — called on confirm, before the modal closes. */
export function beginReveal(action: CardName, descriptor: ActionRevealDescriptor): void {
  revealResultState.active = true;
  revealResultState.action = action;
  revealResultState.cardName = action;
  revealResultState.descriptor = descriptor;
}

/** Dismiss the overlay (the «ОК» button). The server clears `lastReveal` on the
 *  player's next input regardless. */
export function dismissReveal(): void {
  revealResultState.active = false;
  revealResultState.action = undefined;
  revealResultState.cardName = undefined;
  revealResultState.descriptor = undefined;
}
