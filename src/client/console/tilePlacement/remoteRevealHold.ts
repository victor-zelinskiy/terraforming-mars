/*
 * remoteRevealHold — the reveal gate of the console REMOTE tile-placement
 * scene (@console-shared: BoardSpace reads it, consoleRemotePlacement
 * writes it; empty on desktop, so the desktop board is byte-identical).
 *
 * A remote placement (another player's build, a MarsBot turn) COMMITS
 * synchronously — the game state is never held — but its tile must not be
 * SEEN before its proxy physically lands. A held space keeps rendering as
 * untouched (the tile art is suppressed via the existing
 * `board-space-tile--placement-cleared` mechanism, so the printed bonuses
 * stay visible) until the flight's touchdown releases it — the real tile
 * then paints frame-perfect under the settling proxy.
 *
 * Module-level reactive so the hold survives playerView commits and the
 * legacy-flag remount; keyed by space id (per the board's own vocabulary).
 */
import {reactive} from 'vue';

const held = reactive(new Set<string>());

/** Hide the space's committed tile until its flight lands. */
export function holdRemoteReveal(spaceId: string): void {
  held.add(spaceId);
}

/** The touchdown (or any degrade path): the committed tile becomes visible.
 *  Idempotent — releasing an un-held space is a no-op. */
export function releaseRemoteReveal(spaceId: string): void {
  held.delete(spaceId);
}

/** BoardSpace's render gate (ORed into its `placementCleared`). */
export function isRemoteRevealHeld(spaceId: string): boolean {
  return held.has(spaceId);
}

/** Abort / game-switch: every held tile becomes visible at once. */
export function clearRemoteRevealHolds(): void {
  held.clear();
}
