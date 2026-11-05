import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';

/**
 * Turmoil Redux — «Dataminer»: have 7 data resources across your cards.
 *
 * The score is the ENGINE's own count of data on the player's cards (`getResourceCount` — Farmer's / Aeronaut's
 * reading). Data is the Redux economy's science currency (the Scientists' party action, Diverted Research's
 * replacement unit, the Redux data cards), hence the module.
 */
export class Dataminer extends BaseMilestone {
  public readonly cardResourceCount = [CardResource.DATA];
  constructor() {
    super(
      'Dataminer',
      'Have 7 data resources across your cards',
      7);
  }

  public getScore(player: IPlayer): number {
    return player.getResourceCount(CardResource.DATA);
  }
}
