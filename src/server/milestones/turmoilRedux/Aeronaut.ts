import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';

/**
 * Turmoil Redux — «Aeronaut»: have a combined 4 fighter or mech resources across your cards.
 *
 * The score is the ENGINE's own count of each resource on the player's cards (`getResourceCount` — Farmer's reading):
 * fighters (base: Security Fleet, …; Redux: Arwind Inc., Civilian Spacefighters, …) plus mechs (Redux: EVA Mechs,
 * Cargo Mechs, …), summed. Mechs exist only under Redux, hence the module.
 */
export class Aeronaut extends BaseMilestone {
  public readonly cardResourceCount = [CardResource.FIGHTER, CardResource.MECH];
  constructor() {
    super(
      'Aeronaut',
      'Have a combined 4 fighter or mech resources across your cards',
      4);
  }

  public getScore(player: IPlayer): number {
    return player.getResourceCount(CardResource.FIGHTER) + player.getResourceCount(CardResource.MECH);
  }
}
