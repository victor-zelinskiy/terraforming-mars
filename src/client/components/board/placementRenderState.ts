/*
 * placementRenderState — module-level reactive bridge between the active
 * SelectSpace placement prompt and the board cell renderers.
 *
 * Why a module store: SelectSpace.vue (mounted as the player input) and
 * BoardSpace.vue / MoonSpace.vue (mounted as part of the board) are siblings
 * with no shared props, yet they have to agree on how an occupied placement
 * TARGET is drawn. SelectSpace.vue already bridges them by raw DOM class
 * manipulation (it adds `.board-space--available`); for the tile-graphic
 * decision we use a reactive store instead, the same pattern the fork uses
 * for `placementLockState` / `boardCellHighlight`.
 *
 * `hiddenTiles` holds the space ids whose CURRENT tile will be physically
 * removed before the new tile is placed (KaguyaTech, LunarMineUrbanization).
 * The board renders those cells WITHOUT the doomed tile graphic and WITH the
 * placement bonus, so the player sees what they'll gain. Every OTHER occupied
 * target keeps its tile visible (St. Joseph's cathedral overlay, picking an
 * ocean to remove, placing over a hazard, …) — the base tile is information.
 *
 * SelectSpace.vue populates this from `SelectSpaceModel.hiddenTiles` on mount
 * and clears it on unmount, so the store reflects exactly the current prompt.
 */

import {reactive} from 'vue';
import {SpaceId} from '@/common/Types';

type PlacementRenderState = {
  hiddenTiles: ReadonlySet<SpaceId>;
};

export const placementRenderState: PlacementRenderState = reactive({
  hiddenTiles: new Set<SpaceId>(),
});

export function setPlacementHiddenTiles(ids: ReadonlyArray<SpaceId> | undefined): void {
  placementRenderState.hiddenTiles = new Set(ids ?? []);
}

export function clearPlacementHiddenTiles(): void {
  if (placementRenderState.hiddenTiles.size > 0) {
    placementRenderState.hiddenTiles = new Set<SpaceId>();
  }
}

/** True when the given cell's existing tile is to be hidden during the
 *  current placement (a remove-and-replace target). */
export function isPlacementCleared(spaceId: SpaceId): boolean {
  return placementRenderState.hiddenTiles.has(spaceId);
}
