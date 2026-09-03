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
  /**
   * The placement covers an existing REAL tile. This mirrors the placed tile's
   * `covers` field, which is what the survey-family hooks test (`grantsBonusNow`
   * reads `space.tile?.covers`) — a hazard tile is REMOVED, never recorded as
   * covered, so it does not set this flag. For «does the commit suppress the
   * printed cell bonus» read {@link bonusesCovered} instead.
   */
  covering: boolean;
  /**
   * The commit will SKIP the cell's printed bonuses: mirrors `Game.addTile`'s
   * `coveringExistingTile` (`space.tile !== undefined` — a hazard counts; the
   * Ares rulebook says a hazard tile covers the area's printed bonuses) and the
   * identical branch in Mars Nomads' own move. Broader than {@link covering}.
   */
  bonusesCovered: boolean;
  countsAsCity: boolean;
  countsAsOcean: boolean;
  countsAsGreenery: boolean;
  /**
   * Whether a TILE actually lands on the cell. False for a marker-style prompt
   * (Mars Nomads moving its camp, Land Claim, an Arcadian Communities marker,
   * a St. Joseph cathedral): the cell is picked but no tile is placed, so
   * everything that keys off a placed tile — the Ares adjacency bonuses, the
   * endgame VP, the milestone/award tile counts, and every "when a tile is
   * placed" card effect — does NOT happen. The tabletop rule for Mars Nomads is
   * explicit about this ("Mining Guild and Philares cannot take advantage of
   * it", BGG 3154812), and the live path enforces it; without this flag the
   * preview could only promise otherwise.
   */
  placesTile: boolean;
  /**
   * Whether the cell's PLACEMENT BONUSES are granted (printed bonus + the ocean
   * adjacency M€). Independent of {@link placesTile}: a Mars Nomads move grants
   * them with no tile, while Land Claim places nothing AND grants nothing.
   */
  grantsPlacementBonus: boolean;
  /**
   * Whether the commit runs the `onTilePlaced` fan-out at all. A tile placement
   * does (`Game.addTile`), and so does a Mars Nomads camp move (its action
   * fires every hook with `space.tile === undefined` — the hooks self-gate);
   * a pure marker (`'marker'`: Land Claim, an Arcadian marker, the nomads'
   * first landing) fires nothing, so no trigger fact may be promised for it.
   */
  firesTileTriggers: boolean;
};
