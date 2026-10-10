import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';
import {Space} from '../../boards/Space';
import {MarsBoard} from '../../boards/MarsBoard';
import {hazardSeverity} from '../../../common/AresTileType';

// Is this exactly the same as Edgedancer?
export class Suburbian implements IAward {
  public readonly name = 'Suburbian';
  public readonly description = 'Most tiles on areas along the edges of the map';
  /**
   * «An area along the edge of the map» as this award counts it — ONE predicate, read by the player's score and by
   * MarsBot's Corporate Competition helper («a greenery on the edge of the map», Adding Expansions p.16). Since upstream
   * 94c7c9d663 it is the board's own geometry (`MarsBoard.isEdge`), so it holds on the eleven-row board too.
   */
  public static onEdge(board: MarsBoard, space: Space): boolean {
    return board.isEdge(space);
  }

  public getScore(player: IPlayer): number {
    return player.game.board.getEdges().filter((space) => {
      if (space.tile === undefined || hazardSeverity(space.tile.tileType) !== 'none') {
        return false;
      }
      return space.player === player;
    }).length;
  }
}
