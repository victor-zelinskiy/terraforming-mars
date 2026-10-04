import {CardName} from '../cards/CardName';
import {Color} from '../Color';
import {TileType} from '../TileType';
import {SpaceId} from '../Types';
import {PlacementIllegalSpace} from '../inputs/PlacementIllegalReason';

/*
 * A TILE MOVES FROM ONE CELL TO ANOTHER (Turmoil Redux TR14 Re-settlement —
 * «remove a city tile you own on Mars and place it in an adjacent
 * non-reserved space»). The shared vocabulary of the move: what the prompt
 * offers, what the event states, what the remote stage is told.
 *
 * ONE QUESTION, ONE ANSWER: the prompt (`SelectSpaceModel.tileMove`) offers
 * every city that may move TOGETHER with the cells each may move to, and the
 * answer names both cells at once (`SelectSpaceResponse.movedFrom`) — the
 * state «the city is lifted, the cell is not chosen» does not exist on the
 * server. The client derives nothing: neither «is it my city» nor «is this
 * cell adjacent» — both lists are the server's.
 */

/** ONE city that may move, and where to. */
export type TileMoveSourceModel = {
  /** The cell the city stands on. */
  from: SpaceId;
  /** The tile standing on that cell (the BASE of a stack — a Capital stays a Capital underneath). */
  tileType: TileType;
  /** The card recorded on the tile (the Capital's own card, a city placed by a named card). */
  card?: CardName;
  /** How many city tiles stand on the cell (a Skyscrapers stack; 1 for an ordinary city). */
  tiers: number;
  /**
   * WHAT LANDS on the destination: the tile itself for a single city (a
   * Capital arrives as a Capital), a plain CITY for the top tier of a stack —
   * even over a Capital. The reticle's projection and the landing proxy draw
   * this; the client never infers it from `tiers`.
   */
  arrives: TileType;
  /** The cells this city may move to — adjacent, non-reserved, affordable. Never empty. */
  to: ReadonlyArray<SpaceId>;
  /**
   * The cells the PROMPT offers (to a sibling city) that THIS city cannot
   * reach, each with its reason. Every other cell's reason is the prompt's
   * own `illegalSpaces` — a cell illegal for every city reads the same
   * whichever city is lifted, so it is stated once.
   */
  illegal?: ReadonlyArray<PlacementIllegalSpace>;
};

/**
 * The marker of a MOVE prompt. `sources` and `disabledSources` together are
 * EVERY city of the player's on Mars — a city with nowhere to go is listed
 * with its ONE reason, never hidden — so every other cell is, by the server's
 * own exclusion, «not one of your cities on Mars».
 */
export type TileMovePromptModel = {
  sources: ReadonlyArray<TileMoveSourceModel>;
  disabledSources?: ReadonlyArray<PlacementIllegalSpace>;
};

/**
 * WHAT A `tile-moved` EVENT STATES (`EventImpact.tileMove`): the two cells,
 * the tile that travelled, the card it carries, and — when the source was a
 * stack — the height the cell was left at. A position fact, never a delta: a
 * moved tile is not a placed one (`tilesPlaced` does not grow).
 */
export type TileMoveFact = {
  from: SpaceId;
  to: SpaceId;
  tileType: TileType;
  card?: CardName;
  stack?: {before: number; after: number};
};

/**
 * ONE MOVE, for the board's remote stage (`GameModel.tileMoves`): the server's
 * word that the removal on `from` and the landing on `to` in this diff are ONE
 * relocation — played as one proxy carried across the shared edge, never as a
 * lift here and a drop from the supply there. Purely presentational (the
 * `AresAdjacencyGrantModel` precedent): a bounded ring, never serialized, each
 * client consuming a record once by `seq`. A restart loses the animation,
 * never the rule.
 */
export type TileMoveRecordModel = {
  /** Monotonic consumption key (derived from `gameAge`, restart-safe). */
  seq: number;
  from: SpaceId;
  to: SpaceId;
  /** What landed on `to`. */
  tileType: TileType;
  /** The owner whose tile travelled. */
  color: Color;
};
