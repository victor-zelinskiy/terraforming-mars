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
 * An OCEAN COVER (Ocean City and family) is held WITH the tile it landed
 * on: the hold carries the PREVIOUS tile type, and BoardSpaceTile keeps
 * painting that water until the touchdown — a blank hex would erase an
 * ocean that is still physically there.
 *
 * Module-level reactive so the hold survives playerView commits and the
 * legacy-flag remount; keyed by space id (per the board's own vocabulary).
 */
import {reactive} from 'vue';
import {TileType} from '@/common/TileType';

const held = reactive(new Map<string, TileType | undefined>());

/** Hide the space's committed tile until its flight lands. `prevTileType`
 *  (an ocean being covered) keeps painting in its place meanwhile. */
export function holdRemoteReveal(spaceId: string, prevTileType?: TileType): void {
  held.set(spaceId, prevTileType);
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

/** The tile a HELD space should keep painting (the covered ocean), or
 *  undefined for an ordinary fresh placement (blank hex + printed bonuses). */
export function heldPrevTileOf(spaceId: string): TileType | undefined {
  return held.get(spaceId);
}

/** Abort / game-switch: every held tile becomes visible at once. */
export function clearRemoteRevealHolds(): void {
  held.clear();
}
