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
import {SpaceBonus} from '@/common/boards/SpaceBonus';

/** Which piece of the peeked cell the pick would lift — the one drawn translucent (`placementPeek.ts`). */
export type PlacementPeekPiece = 'top' | 'under';

type PlacementRenderState = {
  hiddenTiles: ReadonlySet<SpaceId>;
  /**
   * THE SEE-THROUGH («ПРОСВЕТ», TR47): the focused LEGAL candidate of a pick
   * that LIFTS a piece (an ocean removal, a move's source level, a
   * remove-and-replace) is seen through — the piece that would leave goes
   * translucent, what stays keeps its paint, a bare cell's printed bonus is
   * painted under it. ONE owner: the shell, from its one prompt resolver and
   * the board's focused cell (`peekTargetOf`); undefined = nothing peeked.
   * Unlike `hiddenTiles` nothing is removed from the picture — the player
   * still chooses among tiles they can see.
   */
  peek: {spaceId: SpaceId, piece: PlacementPeekPiece} | undefined;
  // BRD-3 (docs/PERFORMANCE_AUDIT.md): a reactive mirror of "`.board-space--available`
  // currently exists on the board". ConsoleBoardInput is the ONLY source of that class
  // (bulk-added in `animateSpaces`, bulk-removed in `disableAnimation`), so it
  // sets this flag at those exact points. Board.vue's `placementActive()` and
  // BoardCellInfoPopover read it INSTEAD of a `document.querySelector` on every
  // mouseover (a full-DOM scan on the hot hover path).
  highlightActive: boolean;
  /**
   * THE CELL'S REWARD, ON THE CELL (P74 Frontier Town — the owner's «награда клетки — на самой клетке»): while a
   * MULTIPLIED placement stands (the prompt's `printedBonusTimes` — the SERVER's whole count, the law's repeat
   * included), every legal candidate that prints a bonus wears «×N» at its bonus cluster. ONE writer: the board
   * binder (`ConsoleBoardInput`), set with the legal grid and cleared with it. Read by `BoardSpace` as an ATTRIBUTE
   * (`data-bonus-times`) + an absolutely placed mark — never a class (the focus ring and the availability are
   * written imperatively on the same element).
   */
  bonusTimes: {times: number, spaces: ReadonlySet<SpaceId>} | undefined;
};

export const placementRenderState: PlacementRenderState = reactive({
  hiddenTiles: new Set<SpaceId>(),
  peek: undefined,
  highlightActive: false,
  bonusTimes: undefined,
});

/**
 * The cells a multiplied placement marks «×N»: the legal ones that print a bonus (a restricted cell's marker is no
 * bonus). Pure — the server's `times` is taken as it is; undefined when there is nothing to mark.
 */
export function bonusTimesMarks(
  times: number | undefined,
  legal: ReadonlyArray<SpaceId>,
  bonusOf: (spaceId: SpaceId) => ReadonlyArray<SpaceBonus> | undefined,
): {times: number, spaces: ReadonlySet<SpaceId>} | undefined {
  if (times === undefined || times <= 1) {
    return undefined;
  }
  const spaces = new Set(legal.filter((id) => (bonusOf(id) ?? []).some((b) => b !== SpaceBonus._RESTRICTED)));
  return spaces.size > 0 ? {times, spaces} : undefined;
}

/** The binder's one write of the «×N» marks (undefined clears them). */
export function setPlacementBonusTimes(marks: {times: number, spaces: ReadonlySet<SpaceId>} | undefined): void {
  const current = placementRenderState.bonusTimes;
  if (current === marks || (current !== undefined && marks !== undefined && current.times === marks.times &&
      current.spaces.size === marks.spaces.size && [...marks.spaces].every((id) => current.spaces.has(id)))) {
    return;
  }
  placementRenderState.bonusTimes = marks;
}

/** The cell's «×N» (undefined = no mark). */
export function bonusTimesAt(spaceId: SpaceId): number | undefined {
  const marks = placementRenderState.bonusTimes;
  return marks !== undefined && marks.spaces.has(spaceId) ? marks.times : undefined;
}

/** The shell's one write of the see-through target (undefined clears it). */
export function setPlacementPeek(peek: {spaceId: SpaceId, piece: PlacementPeekPiece} | undefined): void {
  const current = placementRenderState.peek;
  if (current?.spaceId === peek?.spaceId && current?.piece === peek?.piece) {
    return;
  }
  placementRenderState.peek = peek;
}

/** The cell's render gate: which of its pieces is seen through right now (undefined = none). */
export function peekPieceAt(spaceId: SpaceId): PlacementPeekPiece | undefined {
  const peek = placementRenderState.peek;
  return peek !== undefined && peek.spaceId === spaceId ? peek.piece : undefined;
}

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
