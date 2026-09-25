import {BaseMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';

export class Mayor extends BaseMilestone {
  constructor() {
    super(
      'Mayor',
      'Own 3 city tiles',
      3);
  }
  public getScore(player: IPlayer): number {
    // A QUANTITY of cities: a stacked city (Skyscrapers) counts every tier.
    return player.game.board.countCities(player);
  }
}
