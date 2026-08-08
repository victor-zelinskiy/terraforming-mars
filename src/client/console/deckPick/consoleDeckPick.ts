/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE DRAW & SELECT FLOW — module state for «посмотри N карт колоды, оставь K».
 *
 * WHAT THIS OWNS, and why it is not just component state. `ConsoleDeckPick.vue`
 * is mounted for exactly as long as the prompt exists, and the prompt ends the
 * instant the answer reaches the server — which is the ONE moment the surface
 * must not disappear. The whole point of the flow is that the picked cards
 * physically travel to the hand dock and the rest are cleared away AFTERWARDS,
 * and both of those beats live entirely on the far side of the submit. So the
 * commit's lifetime is a MODULE fact, held here, read by the shell:
 *
 *     confirm → sending (picks fly to the dock) → clearing (rest tumble away)
 *             → release → the surface may finally unmount
 *
 * The same shape the final-greenery commit uses (`.claude/rules/console-ui.md`:
 * "a surface that hands a pick to an ALWAYS-MOUNTED host and unmounts must also
 * hold itself down across the SUBMIT round-trip"). Here the always-mounted host
 * is the hand dock.
 *
 * PURE of DOM and Vue components; only `reactive` — the shell's `v-if` and the
 * animation-hold supplier are render-time predicates, so a plain `let` would be
 * invisible to them (the session-freeze `handDeliveryDirector` documents).
 */

import {reactive} from 'vue';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';

/**
 * `idle`     — nothing running (the surface is not up, or it is waiting for a
 *              cinematic that another director owns — the hydro fan);
 * `dealing`  — the cards are physically coming off the deck into their slots;
 * `choosing` — the player's turn: focus, pick, confirm;
 * `sending`  — CONFIRMED. The picks are flying into the hand dock;
 * `clearing` — the picks have landed; the cards left behind are tumbling away.
 *
 * `sending` and `clearing` are BEATS, not destinations (consoleWorkspaceFlow's
 * distinction): input is absorbed and B does nothing, so a double submit is
 * impossible by construction rather than by a flag somebody remembers to check.
 */
export type DeckPickPhase = 'idle' | 'dealing' | 'choosing' | 'sending' | 'clearing';

export const deckPickState = reactive({
  phase: 'idle' as DeckPickPhase,
  /**
   * The submit has gone out and the outgoing beats are still owed. THE shell's
   * "keep this surface mounted" flag — `waitingFor` names the next prompt (or
   * nothing at all) long before the cards have reached the dock.
   */
  committing: false,
  /** How many cards the player kept — the clearing beat's copy reads it. */
  kept: 0,
});

/** Is the flow in one of its own animated beats? */
export function isDeckPickBusy(): boolean {
  return deckPickState.phase === 'sending' || deckPickState.phase === 'clearing';
}

/** THE mount gate the shell adds to its own: the prompt may already be gone. */
export function deckPickHolding(): boolean {
  return deckPickState.committing;
}

/**
 * NOTIFICATION-ONLY, deliberately. The flow's own surface is a mandatory
 * decision; a blocking hold would refuse to mount the very screen the beats
 * play on. What it must actually stop is a notification card sliding over the
 * cards mid-flight.
 */
registerAnimationHoldSupplier('deck-pick', isDeckPickBusy, {scope: 'notification-only'});

/** The cards are coming off the deck (or another director's cinematic is
 *  delivering them) — input stays shut until they have all landed. */
export function beginDeckPickDeal(): void {
  deckPickState.phase = 'dealing';
  deckPickState.committing = false;
  deckPickState.kept = 0;
}

/** Everything has landed and handed over — the player may act. */
export function beginDeckPickChoosing(): void {
  if (deckPickState.phase !== 'sending' && deckPickState.phase !== 'clearing') {
    deckPickState.phase = 'choosing';
  }
}

/**
 * CONFIRMED. Called SYNCHRONOUSLY with the submit — before the response can
 * land — so no frame exists in which the prompt is gone and the hold is not yet
 * up. `kept` rides along because the clearing beat's copy needs it after the
 * picks have already left the surface.
 */
export function beginDeckPickSend(kept: number): void {
  deckPickState.phase = 'sending';
  deckPickState.committing = true;
  deckPickState.kept = kept;
}

/** The picks are in the dock; the cards left behind may go. */
export function beginDeckPickClearing(): void {
  if (deckPickState.committing) {
    deckPickState.phase = 'clearing';
  }
}

/**
 * The last beat is over — the surface may unmount.
 *
 * A SERVER REFUSAL takes the same door: the flow rolls back to `choosing` (the
 * prompt is still live, so the surface is still mounted by the ordinary gate)
 * rather than leaving the player inside a beat that will never finish.
 */
export function endDeckPickCommit(): void {
  deckPickState.committing = false;
  deckPickState.phase = 'idle';
}

/** The submit was refused: give the screen back rather than stranding it. */
export function rollbackDeckPickCommit(): void {
  deckPickState.committing = false;
  deckPickState.kept = 0;
  deckPickState.phase = 'choosing';
}

/** Full reset (unmount / game switch / test cleanup). */
export function resetDeckPick(): void {
  deckPickState.phase = 'idle';
  deckPickState.committing = false;
  deckPickState.kept = 0;
}
