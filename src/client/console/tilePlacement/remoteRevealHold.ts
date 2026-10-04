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
import {Color} from '@/common/Color';
import {TileType} from '@/common/TileType';

const held = reactive(new Map<string, TileType | undefined>());
/** The OWNER the held previous tile keeps showing (a MOVE's source: the city
 *  that left stands there, cube and all, until its proxy takes it over). */
const heldColors = reactive(new Map<string, Color>());
/** A STACK's height as it stood before the commit (a MOVE off a stack: the
 *  cell keeps painting every tier until the proxy takes the top one). */
const heldStackHeights = reactive(new Map<string, number>());

/** Hide the space's committed tile until its flight lands. `prevTileType`
 *  (an ocean being covered) keeps painting in its place meanwhile — with
 *  `prevColor`, so does its owner cube. */
export function holdRemoteReveal(spaceId: string, prevTileType?: TileType, prevColor?: Color): void {
  held.set(spaceId, prevTileType);
  if (prevColor !== undefined) {
    heldColors.set(spaceId, prevColor);
  }
}

/** The touchdown (or any degrade path): the committed tile becomes visible.
 *  Idempotent — releasing an un-held space is a no-op. */
export function releaseRemoteReveal(spaceId: string): void {
  held.delete(spaceId);
  heldColors.delete(spaceId);
}

/** The owner cube a HELD space keeps showing (undefined = whatever the model says). */
export function heldPrevColorOf(spaceId: string): Color | undefined {
  return heldColors.get(spaceId);
}

/** Keep painting the stack at `height` (its height BEFORE the commit) until the scene releases it. */
export function holdStackHeight(spaceId: string, height: number): void {
  heldStackHeights.set(spaceId, height);
}

export function releaseStackHeight(spaceId: string): void {
  heldStackHeights.delete(spaceId);
}

export function heldStackHeightOf(spaceId: string): number | undefined {
  return heldStackHeights.get(spaceId);
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
  heldColors.clear();
  heldStackHeights.clear();
}

/*
 * THE VACATED CELL — a REMOVAL's one-shot settle (Water Export's ocean, the
 * Reds' action). Once the departure proxy has lifted the tile away, the bare
 * hex it left «оседает»: a short, quiet contact beat on THAT cell alone
 * (`board-space--vacated` — a CSS one-shot the cell renders), no neighbour
 * reacts, nothing is celebrated. Keyed by a nonce so the same cell can settle
 * again in a later generation; the board reads it, the scene writes it.
 */
const vacated = reactive(new Map<string, number>());
let vacatedNonce = 0;

/** The tile has lifted off `spaceId`: the cell plays its settle once. */
export function markCellVacated(spaceId: string): void {
  vacated.set(spaceId, ++vacatedNonce);
}

/** The settle's nonce for the cell (undefined = never vacated / already cleared). */
export function cellVacatedNonce(spaceId: string): number | undefined {
  return vacated.get(spaceId);
}

/** The settle ended (the cell's own `animationend`), or a teardown: the mark is gone. */
export function clearCellVacated(spaceId: string): void {
  vacated.delete(spaceId);
}
