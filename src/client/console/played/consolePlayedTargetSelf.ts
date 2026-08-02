/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SELF-TARGET LINK — the one channel between the selector's «Эта карта»
 * handle and the real source card standing in the workspace's hero slot.
 *
 * WHY A MODULE AND NOT A PROP. The source card is NOT inside the selector: it
 * belongs to the composer, one level up and on the other side of the screen.
 * The handle has to be able to light it up without either component owning the
 * other, and without the selector reaching into a parent's DOM. A tiny reactive
 * fact both sides read is the smallest honest coupling — the same shape the
 * console already uses for its other cross-surface links.
 *
 * WHAT IT REPLACES. The selector used to render the source card AGAIN, at full
 * size, as its own candidate: two copies of one physical object on one screen,
 * which is precisely the continuity this fork spends its whole motion budget
 * defending. Now there is one card, and the handle points at it.
 */
import {reactive} from 'vue';

export const playedTargetSelfState = reactive({
  /** The «Эта карта» handle currently holds the cursor. */
  focused: false,
  /** The source card is the CONFIRMED target. */
  locked: false,
});

export function setPlayedTargetSelfFocus(focused: boolean): void {
  playedTargetSelfState.focused = focused;
}

export function setPlayedTargetSelfLock(locked: boolean): void {
  playedTargetSelfState.locked = locked;
}

/** Step unmount / workspace teardown — the hero must never keep a target ring
 *  that belongs to a selector that is gone. */
export function resetPlayedTargetSelf(): void {
  playedTargetSelfState.focused = false;
  playedTargetSelfState.locked = false;
}
