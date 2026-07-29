import {TileType} from '../../common/TileType';
import {BoardPlacementKind} from '../../common/boards/BoardInformationFacts';

/**
 * What the two co-located placement hooks (`ICard.placementPreview` — the card
 * that PLACES — and `ICard.tilePlacedPreview` — a card that REACTS) are told
 * about the tile that is ABOUT to be placed.
 *
 * The `countsAs*` flags are precomputed on purpose. A hook must NEVER ask
 * `Board.isCitySpace(space)` the way the live `onTilePlaced` does: at preview
 * time the tile is not on the board yet, so every such check answers about the
 * cell's CURRENT content and silently reports "nothing happens". Read the flag
 * instead — it is derived from the same `CITY_TILES`/`OCEAN_TILES`/
 * `GREENERY_TILES` sets the live path consults after placement.
 */
export type PlacementPreviewContext = {
  /** The eligibility kind of the prompt (`city` / `ocean` / `land` / …). */
  kind: BoardPlacementKind;
  /** The concrete tile, when the prompt names it. */
  tileType?: TileType;
  /** A remove-and-replace placement — the cell's current tile is cleared first. */
  cleared: boolean;
  /** The placement covers an existing REAL tile (so no printed cell bonus). */
  covering: boolean;
  countsAsCity: boolean;
  countsAsOcean: boolean;
  countsAsGreenery: boolean;
};
