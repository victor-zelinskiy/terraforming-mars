import {SpaceBonus} from '../../common/boards/SpaceBonus';
import {SpaceType} from '../../common/boards/SpaceType';
import {Tile} from '../Tile';
import {AdjacencyBonus} from '../ares/AdjacencyBonus';
import {SpaceId} from '../../common/Types';
import {IPlayer} from '../IPlayer';
import {UndergroundResourceToken} from '../../common/underworld/UndergroundResourceToken';

export type Space = {
  /** The unique ID of this space*/
  readonly id: SpaceId;
  /** The x-coordinate of this space, or -1 if it is not the main board (e.g. colony) */
  readonly x: number;
  /** The y-coordinate of this space, or -1 if it is not the main board (e.g. colony) */
  readonly y: number;

  /** The type of space: ocean, space colony, etc. */
  spaceType: SpaceType;

  /** When true, this is a volcanic space. */
  volcanic?: boolean;

  /** The tile placed on top of the space. Could be a hazard tile. */
  tile?: Tile;
  /**
   * THE STACK (Turmoil Redux — Skyscrapers, RX20): how many CITY tiles stand
   * on this cell, one on top of the other. Absent = one (every ordinary
   * cell); present only from 2 up, and only on a city the same owner built
   * a tier onto. The tiers are identical objects of ONE owner — the cell keeps
   * its one `tile` (a Capital stays a Capital underneath) and counts its
   * height here, never a second tile list. Read through `Board.tiersOf` /
   * `Board.cityTiersOf`; a QUANTITY of cities sums it (`MarsBoard.countCities`),
   * a PREDICATE about the cell («is this a city», «is it next to a city») never
   * looks at it. An old save without the field reads as height 1.
   */
  stackHeight?: number;
  /** The player who owns this tile. Will show a token, even the neutral player */
  player?: IPlayer;
  /** The bonuses granted to a player for placing a tile on this space. */
  bonus: Array<SpaceBonus>;
  /** The bonuses granted to players when placing tiles NEXT TO this space. */
  adjacency?: AdjacencyBonus,

  /** Optional underworld expansion resource token. */
  undergroundResources?: UndergroundResourceToken;
  /** Optional underworld player who excavated at this space. */
  excavator?: IPlayer;

  /** This tile's co-owner. Used for The Moon's Hostile Takeover card. */
  coOwner?: IPlayer;
}
