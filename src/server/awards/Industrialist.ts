import {IAward} from './IAward';
import {IPlayer} from '../IPlayer';

export class Industrialist implements IAward {
  public readonly name = 'Industrialist';
  public readonly description = 'Have most steel and energy';
  public getScore(player: IPlayer): number {
    // Steel stored on Modular Floodgates (DP11) «counts as on your player
    // board», so the award's steel count includes it.
    const steel = player.steel + player.getSpendable('floodgateSteel');
    if (player.game.isDoneWithFinalProduction()) {
      return steel + player.energy;
    } else {
      return steel + player.production.steel + player.production.energy;
    }
  }
}
