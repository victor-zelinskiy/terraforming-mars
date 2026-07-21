/*
 * CONSOLE NOTIFICATION X-HOLD — press-and-HOLD tracking for a transient
 * toast's DETAIL action (the compact AI-turn card's «Осмотреть ход»).
 *
 * WHY hold, not press: X is the console-wide «Осмотреть» verb (open a card
 * fullscreen etc.). A visible toast must not steal that verb from the screen
 * beneath — so a single TAP falls through to the surface (the shell replays
 * the press on the release edge) and only a HOLD ≥ NOTIF_HOLD_MS fires the
 * toast's own detail action.
 *
 * Tap vs hold is reliable in the current input core:
 *  - gamepad: gamepadPollModel emits edge-detected press AND release intents;
 *  - keyboard: consoleKeyBridge synthesizes the release from keyup (keydown
 *    repeats are already filtered by keyboardConsoleIntent).
 *
 * The DURATION is deliberately FIXED (not motionMs-scaled) — input cadence is
 * ergonomics, not visual choreography (the gamepadPollModel NAV_REPEAT rule);
 * ConsoleNotificationCard takes the SAME constant as its inline fill-animation
 * duration, so the visual progress and the input timer cannot drift.
 *
 * Reactive module state (mirrors journalState etc.) because the card is
 * mounted by the App-level NotificationLayer while the INPUT lives in
 * ConsoleShell — the two share this one source of truth.
 */

import {reactive} from 'vue';

/** The press-and-hold threshold, ms (fixed — see the header). */
export const NOTIF_HOLD_MS = 500;

export const notifHoldState = reactive({
  /** Notification id whose X-hold is currently filling (undefined = idle). */
  noteId: undefined as string | undefined,
});

let timer: ReturnType<typeof setTimeout> | undefined;
/** A completed hold's trailing release edge is consumed exactly once. */
let pendingReleaseConsume = false;

/**
 * Start tracking a hold for `noteId`; `onFire` runs once when the threshold
 * elapses without a cancel. A new begin supersedes any in-flight hold.
 * `delayMs` is a test seam — production callers use the default.
 */
export function beginNotifHold(noteId: string, onFire: () => void, delayMs: number = NOTIF_HOLD_MS): void {
  cancelNotifHold();
  pendingReleaseConsume = false;
  notifHoldState.noteId = noteId;
  timer = setTimeout(() => {
    timer = undefined;
    notifHoldState.noteId = undefined;
    pendingReleaseConsume = true;
    onFire();
  }, delayMs);
}

/**
 * Abort an in-flight hold. Returns true when a hold WAS in flight — i.e. the
 * release that triggered the cancel was a TAP (the shell replays it to the
 * surface beneath), false when there was nothing to cancel (or the hold had
 * already fired).
 */
export function cancelNotifHold(): boolean {
  const wasHolding = notifHoldState.noteId !== undefined;
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  notifHoldState.noteId = undefined;
  return wasHolding;
}

/** The X-hold on the given card is currently filling. */
export function notifHoldActiveFor(noteId: string): boolean {
  return notifHoldState.noteId === noteId;
}

/**
 * The release edge that ends a COMPLETED hold belongs to the hold system —
 * the shell consumes it (once) instead of routing it anywhere.
 */
export function consumeNotifHoldRelease(): boolean {
  if (pendingReleaseConsume) {
    pendingReleaseConsume = false;
    return true;
  }
  return false;
}

/** Game-switch / shell-unmount boundary — never leak a timer or a stale consume. */
export function resetNotifHold(): void {
  cancelNotifHold();
  pendingReleaseConsume = false;
}
