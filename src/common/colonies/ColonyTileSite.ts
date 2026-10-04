import {CardName} from '../cards/CardName';
import {Color} from '../Color';
import {TileType} from '../TileType';
import {SpaceId} from '../Types';

/**
 * THE PICK PLACES A TILE ON THE CHOSEN COLONY TILE (Turmoil Redux TR22 Nova
 * City — «place a city ON A COLONY TILE in play») — the marker of a colony
 * pick (`SelectColonyModel.tileSite`) and the SERVER's projection of what the
 * pick does. Whichever colony tile is chosen, the same tile lands on the same
 * hosted cell, so one marker serves every candidate.
 *
 * The client draws the tile's ghost on every candidate, the «now → after» of
 * the count and the card's VP from this and computes none of it: how many
 * space cities the player owns and what the card will score are the engine's
 * `Counter` (the same read the score row is made of).
 */
export type ColonyTileSite = {
  /** The tile the pick places (a city). */
  tile: TileType;
  /** The hosted cell it lands on (`common/boards/hostedSpaces.ts`) — the cell every counter of cities reads. */
  space: SpaceId;
  /** Whose tile it is — the player answering the pick. */
  color: Color;
  /** The card whose tile it is (`tile.card`). */
  card: CardName;
  /** The player's OWN cities off Mars now, and once the tile has landed. */
  spaceCities: {before: number, after: number};
  /**
   * What the placing card scores the moment the tile lands — present when the
   * card's own VP rule counts the city it places (the play's VP projection,
   * `cardVictoryPointsAtPlay`). Absent for a card that scores nothing by it.
   */
  victoryPoints?: number;
};
