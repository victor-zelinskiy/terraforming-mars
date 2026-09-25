import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';

export class Constructor implements IAward {
  public readonly name = 'Constructor';
  public readonly description = 'Have the most Colonies and Cities combined';

  public getScore(player: IPlayer): number {
    // A QUANTITY of cities: a stacked city (Skyscrapers) counts every tier.
    return player.getColoniesCount() + player.game.board.countCities(player);
  }
}
