/*
 * placementRenderState — module-level reactive bridge between the active
 * board-input placement prompt and the board cell renderers.
 *
 * Why a module store: ConsoleBoardInput.vue (mounted as the player input) and
 * BoardSpace.vue / MoonSpace.vue (mounted as part of the board) are siblings
 * with no shared props, yet they have to agree on how an occupied placement
 * TARGET is drawn. ConsoleBoardInput.vue already bridges them by raw DOM class
 * manipulation (it adds `.board-space--available`); for the tile-graphic
 * decision we use a reactive store instead, the same pattern the fork uses
 * for `placementLockState` / `boardCellHighlight`.
 *
 * `hiddenTiles` holds the space ids whose tile is being physically REMOVED
 * RIGHT NOW (KaguyaTech, LunarMineUrbanization — "remove one of yours, place
 * this there"). Such a cell renders WITHOUT its tile graphic and WITH its
 * placement bonus — i.e. as the emptied hex it has just become — and the
 * generic placement chrome is silenced on it (BoardSpaceTile.refreshPlacement
 * reads this store directly), so no impact ring can flash over an apparently
 * empty cell.
 *
 * ⚠️ ONE OWNER, and it is the CINEMATIC: `consoleTilePlacement`'s departure
 * beat opens the window as the doomed tile's proxy takes over and closes it in
 * the same synchronous turn the replacement paints. It used to be the PROMPT
 * (ConsoleBoardInput on mount → unmount), which hid the tile for the whole
 * pick: every candidate greenery became an identical bare hex, so the player
 * chose among objects they could not see, and the uncovering — the card's own
 * "gain placement bonuses as usual" — was spent before the card acted. What a
 * cell is worth during the pick is the placement dossier's job. Every OTHER
 * occupied target keeps its tile visible at all times (St. Joseph's cathedral
 * overlay, picking an ocean to remove, placing over a hazard, …) — the base
 * tile is information.
 */

import {reactive} from 'vue';
import {SpaceId} from '@/common/Types';

type PlacementRenderState = {
  hiddenTiles: ReadonlySet<SpaceId>;
  // BRD-3 (docs/PERFORMANCE_AUDIT.md): a reactive mirror of "`.board-space--available`
  // currently exists on the board". ConsoleBoardInput is the ONLY source of that class
  // (bulk-added in `animateSpaces`, bulk-removed in `disableAnimation`), so it
  // sets this flag at those exact points. Board.vue's `placementActive()` and
  // BoardCellInfoPopover read it INSTEAD of a `document.querySelector` on every
  // mouseover (a full-DOM scan on the hot hover path).
  highlightActive: boolean;
};

export const placementRenderState: PlacementRenderState = reactive({
  hiddenTiles: new Set<SpaceId>(),
  highlightActive: false,
});

/** Set by ConsoleBoardInput when it adds/removes the `.board-space--available`
 *  highlight set, so hover handlers can read placement-mode reactively. */
export function setPlacementHighlightActive(active: boolean): void {
  if (placementRenderState.highlightActive !== active) {
    placementRenderState.highlightActive = active;
  }
}

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
