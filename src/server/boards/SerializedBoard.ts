import {AdjacencyBonus} from '../ares/AdjacencyBonus';
import {Tile} from '../Tile';
import {PlayerId} from '../../common/Types';
import {SpaceBonus} from '../../common/boards/SpaceBonus';
import {SpaceType} from '../../common/boards/SpaceType';
import {SpaceId} from '../../common/Types';
import {UndergroundResourceToken} from '../../common/underworld/UndergroundResourceToken';

export interface SerializedBoard {
  spaces: Array<SerializedSpace>;
}

export interface SerializedSpace {
  id: SpaceId;
  spaceType: SpaceType;
  volcanic?: true;
  tile?: Tile;
  player?: PlayerId;
  bonus: Array<SpaceBonus>;
  adjacency?: AdjacencyBonus,
  x: number;
  y: number;
  undergroundResources?: UndergroundResourceToken;
  excavator?: PlayerId;
  coOwner?: PlayerId;
  /** The city stack's height (Skyscrapers) — written only from 2 up; absent = 1 (every save before the field). */
  stackHeight?: number;
}
