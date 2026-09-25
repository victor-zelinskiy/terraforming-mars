import {IAward} from './IAward';
import {IPlayer} from '../IPlayer';
import {TileType} from '../../common/TileType';
import {Board} from '../boards/Board';
import {sum} from '../../common/utils/utils';

export class Landlord implements IAward {
  public readonly name = 'Landlord';
  public readonly description = 'Own the most tiles';
  public getScore(player: IPlayer): number {
    // A QUANTITY of TILES: a stacked city (Skyscrapers) is as many tiles as
    // it has tiers — the sum of the stacks, not the count of the cells.
    const marsSpaceCount = sum(player.game.board.spaces
      .filter(Board.hasRealTile)
      .filter(Board.ownedBy(player))
      .filter((space) =>
        // Don't simplifiy this to "space.tile?.tileType !== TileType.OCEAN" because that will make
        // Land Claim a valid space for Landlord.
        space.tile?.tileType !== TileType.OCEAN && space.player === player)
      .map(Board.tiersOf));

    const moonSpaces = player.game.moonData?.moon.spaces ?? [];
    const moonSpaceCount = moonSpaces
      .filter(Board.hasRealTile)
      .filter(Board.ownedBy(player)).length;

    return marsSpaceCount + moonSpaceCount;
  }
}
