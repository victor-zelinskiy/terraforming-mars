/*
 * THE FINALE SESSION — ONE CONTEXT FROM THE FIRST A TO THE LAST GREENERY (PL-303 / PL-304, the owner's field
 * report of 2026-10-14: «единый контекст размещения»).
 *
 * The finale used to be a chain of board PICKS: each pick came and went with its prompt, and everything that
 * reads «is a placement on?» — the right dossier, Planet Focus, the command bar — let go between two greeneries
 * and came back for the next one. The planet shrank and grew again around every landing (the focus exited while
 * the admission gate waited out the hero, then re-entered for the next pick), the dossier slid out and in, and
 * while ANOTHER seat answered a triggered pick (Philares' owner choosing a resource) the whole context vanished —
 * the player stood on a bare board with no sign of what they were in the middle of.
 *
 * This module is the one fact those readers stand on instead: the player is IN THE FINALE. It rises when the
 * player opens the finale (A on the announce, the way back from a minimize), survives every landing and every
 * prompt hand-off, and ends only when the server says the seat is done (`game.finalGreenery.done`) or the game
 * has ended. Inside it the context has three STAGES, derived by the shell from the server's facts, never kept
 * here: `pick` (the board pick is out), `landing` (a greenery is on its way — the next pick follows by itself),
 * `wait` (another seat holds a prompt; the context stands and says who).
 *
 * `collapsed` is the player's own «свернуть» (B): the context hides so they can read the board or their hand, and
 * the board home's plate is the one way back. A FOREIGN mandatory prompt for the viewer (their own Philares
 * firing on another seat's landing) yields the context too — derived in the shell, so the plate and the surface
 * of that decision stand exactly as they do anywhere else, and the context returns when it is answered.
 *
 * Reactive module state (the planetFocus.ts idiom): the shell drives it, every reader derives from it. No Vue
 * component, no DOM, no i18n. Unit-tested under the server runner.
 */

import {reactive} from 'vue';

export const finaleSessionState = reactive({
  /** The player entered the finale context — from the announce's A to the seat's end of the phase. */
  active: false,
  /** The player minimized it (B): the context hides, the board home's plate brings it back. */
  collapsed: false,
});

/** The player opened the finale (the announce's A / the way back): the context stands. */
export function enterFinaleSession(): void {
  finaleSessionState.active = true;
  finaleSessionState.collapsed = false;
}

/** B: the context hides; the session itself lives on (the plate offers the way back). */
export function collapseFinaleSession(): void {
  if (finaleSessionState.active) {
    finaleSessionState.collapsed = true;
  }
}

/** A on the plate: the context returns exactly as it stood. */
export function restoreFinaleSession(): void {
  if (finaleSessionState.active) {
    finaleSessionState.collapsed = false;
  }
}

/** The seat is done with the finale (the server's fact) or the game ended: the context leaves. */
export function endFinaleSession(): void {
  finaleSessionState.active = false;
  finaleSessionState.collapsed = false;
}

/** Shell unmount / game switch / tests. */
export function resetFinaleSession(): void {
  endFinaleSession();
}

/** The context STANDS: the session is on and the player has not minimized it. */
export function finaleSessionStanding(): boolean {
  return finaleSessionState.active && !finaleSessionState.collapsed;
}
