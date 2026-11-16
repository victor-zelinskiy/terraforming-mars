/**
 * THE GAME STATE MATERIALIZES ONCE — the bars' entrance is the prep → ceremony SWAP, never a re-mount of the scene.
 *
 * The start scene leaves and comes back INSIDE one opening — the bonus window («Фора») hands the whole screen to the
 * board, a minimize → restore re-creates the component — while the player rail and the top strip STAND on the board
 * between. Its mount re-adds `con-start-ceremony`, and the entrance keyframes keyed on that class (`console.less` §
 * GAME STATE MATERIALIZATION) replayed: the rail the player had just been reading went to opacity 0 and slid in again
 * — a blink of the whole chrome on every return — and the landing zone of «Фора»'s auto-resolved M€ was unpainted at
 * the moment the wave measured it, so on a slow frame the token degraded to a bare tick (CI 43884064237,
 * `console-bonus-action-handoff`; the witness read the rail at opacity 0 on every return).
 *
 * The entrance belongs to the moment the bars first come into existence for this SEAT (the player id — one per seat and
 * game, so a later game, a rematch or another seat materializes its own; no session reset to order against an
 * unmount). A mount DECIDES once, at its set-up, whether the bars already stood (`startBarsStoodBeforeMount`) — never
 * mid-life, where adding the «stood» class would cut a materialization that is running.
 */
import {sessionState} from '@/client/console/session/consoleSession';

let stoodFor: string | undefined;

/** Did the bars already STAND for this seat? Read once, at a scene's set-up, for that mount's whole life. */
export function startBarsStoodBeforeMount(seat: string): boolean {
  return stoodFor === seat;
}

/** The bars are up for this seat — the ceremony materialized them (they stay up on the board behind a scene that left). */
export function noteStartBarsStood(seat: string): void {
  stoodFor = seat;
}

/** Spec / session reset. */
export function resetStartBarsStood(): void {
  stoodFor = undefined;
}

// THE GAME SCREEN LEAVES: the record goes with it (the number is its place in the session's ordered pass). The seat key
// still guards the order — a leaving scene's last sync after this pass names a seat no later screen has.
sessionState('start-bars-stood', resetStartBarsStood, 392);
