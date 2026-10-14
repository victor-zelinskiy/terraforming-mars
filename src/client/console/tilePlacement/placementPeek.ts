/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SEE-THROUGH — «ПРОСВЕТ» (the owner's accent of 2026-10-14, Turmoil Redux
 * TR47 Ecological Experiment: «when hovering, the tile becomes TRANSPARENT and
 * the player sees WHAT is under it — the printed bonus or the other tile; work
 * this out for every case of choosing which tile to remove»).
 *
 * A picker whose answer LIFTS a piece off a cell — an ocean removal (RX33
 * Water Export, the Reds' action, Dry Deserts, TR47), the SOURCE level of a
 * move (TR39's ocean, TR14's city), a remove-and-replace (Kaguya Tech's
 * greenery, `hiddenTiles`) — used to draw the candidate under the cursor
 * exactly as it stands, and the reticle projected a SECOND object over it (an
 * ocean over the ocean). The player chose among tiles they could not see
 * through. Now the focused LEGAL candidate is seen through: the piece that
 * would leave goes translucent (its cube with it), what STAYS keeps its paint
 * (the city over its water, the lower tiers of a stack), and a bare cell's
 * printed bonus is painted under the translucent tile — the same icons an empty
 * cell shows. Nothing moves while the player aims (the dossier's law): the
 * see-through is a class, never a transition worth the eye.
 *
 * WHICH piece goes translucent is the pieces reading's (`cellPieces.piecesOf`
 * — the one reading both sides share): an OCEAN lift on a TR44 cell is the
 * water UNDER the city (`'under'`), everything else is the top piece. ONE
 * owner writes it (the shell, from the one prompt resolver and the board's
 * focused cell — `placementRenderState.setPlacementPeek`), the cell reads it,
 * and the dossier says the same thing in words (`uncoverFacts`,
 * «ОТКРОЕТСЯ»). Pure: no Vue, no DOM.
 */
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceId} from '@/common/Types';
import {TileType} from '@/common/TileType';
import {piecesOf} from '@/common/boards/cellPieces';
import {PlacementMoveLevel} from '@/client/console/tilePlacement/placementMove';

/** Which piece of the focused cell the pick would LIFT — the one the see-through dims. */
export type PeekPiece = 'top' | 'under';

export type PlacementPeek = {spaceId: SpaceId, piece: PeekPiece};

/** What the pick LIFTS, by the prompt's own markers: an ocean (wherever it lies on the cell) or the top piece. */
function liftedBy(prompt: SelectSpaceModel, moveLevel: PlacementMoveLevel | undefined, focused: SpaceId): 'ocean' | 'top' | undefined {
  const effect = prompt.placementEffect ?? 'tile';
  if (effect === 'remove') {
    return prompt.tileType === TileType.OCEAN ? 'ocean' : 'top';
  }
  if (effect === 'move') {
    if (moveLevel !== 'source') {
      return undefined;
    }
    return prompt.placementType === 'ocean-move' ? 'ocean' : 'top';
  }
  return (prompt.hiddenTiles ?? []).includes(focused) ? 'top' : undefined;
}

/**
 * THE SEE-THROUGH TARGET right now: the focused cell, when it is a LEGAL
 * candidate of a lifting pick and carries a piece to see through; else
 * nothing. A move's CELL level (where the lifted tile lands) peeks nothing —
 * the destination is read as a landing, and the source cell wears its own
 * «leaving from here» pose.
 */
export function peekTargetOf(
  prompt: SelectSpaceModel | undefined,
  moveLevel: PlacementMoveLevel | undefined,
  focused: SpaceId | undefined,
  spaces: ReadonlyArray<SpaceModel> | undefined,
): PlacementPeek | undefined {
  if (prompt === undefined || focused === undefined || !prompt.spaces.includes(focused)) {
    return undefined;
  }
  const lifted = liftedBy(prompt, moveLevel, focused);
  if (lifted === undefined) {
    return undefined;
  }
  const cell = spaces?.find((s) => s.id === focused);
  if (cell === undefined) {
    return undefined;
  }
  const pieces = piecesOf(cell);
  if (pieces.tile === undefined) {
    return undefined;
  }
  return {spaceId: focused, piece: lifted === 'ocean' && pieces.under === TileType.OCEAN ? 'under' : 'top'};
}
