import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';

export class Metropolist implements IAward {
  public readonly name = 'Metropolist';
  public readonly description = 'Own the most cities';
  public getScore(player: IPlayer): number {
    // A QUANTITY of cities: a stacked city (Skyscrapers) counts every tier.
    return player.game.board.countCities(player);
  }
}
