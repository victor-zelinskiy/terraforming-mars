import {ColonyName} from '../colonies/ColonyName';
import {Color} from '../Color';
import {CardName} from '../cards/CardName';
import {TileType} from '../TileType';
import {SpaceId} from '../Types';

/**
 * A TILE THAT LIES ON A COLONY TILE (Turmoil Redux TR22 Nova City — «place a
 * city ON A COLONY TILE»): the cell it stands on (a HOSTED cell of the
 * board's list — `common/boards/hostedSpaces.ts`), what it is, whose it is
 * and the card that placed it. Read by the server off the CELL
 * (`space.tile`, `space.player`); the colony tile only says where.
 */
export type ColonyTileOnTileModel = {
  spaceId: SpaceId;
  tileType: TileType;
  color: Color;
  card?: CardName;
};

export type ColonyModel = {
  colonies: Array<Color>;
  isActive: boolean;
  name: ColonyName;
  trackPosition: number;
  visitor: Color | undefined;
  /** What lies ON the tile besides cubes and a fleet (see {@link ColonyTileOnTileModel}). Absent when nothing does. */
  tiles?: ReadonlyArray<ColonyTileOnTileModel>;
}

export function simpleColonyModel(name: ColonyName): ColonyModel {
  return {
    colonies: [],
    isActive: false,
    name: name,
    trackPosition: 0,
    visitor: undefined,
  };
}

/**
 * A colony that REFUSES one player its trade right now, with the reason —
 * a rule of the COLONY about THIS player (the Turmoil Redux Pluto: «no card
 * of yours can hold the data this trade pays»), true whatever the turn or
 * the fleet count. Published per seat on `PublicPlayerModel.colonyTradeBlocks`
 * so every surface reads the server's verdict instead of guessing one; the
 * open trade prompt carries the same refusal as its `disabledColonies`.
 */
export type ColonyTradeBlockModel = {
  colony: ColonyName;
  /** English i18n key. */
  reason: string;
};
