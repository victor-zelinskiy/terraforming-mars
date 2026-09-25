import {IPlayer} from '../../IPlayer';
import {InequalityRequirement} from './InequalityRequirement';
import {RequirementType} from '../../../common/cards/RequirementType';

/**
 * Evaluate whether the number of city tiles on Mars is at least (or at most) a given value.
 *
 * Can apply to a single player's tiles or all tiles.
 */
export class CitiesRequirement extends InequalityRequirement {
  public readonly type = RequirementType.CITIES;
  public override getScore(player: IPlayer): number {
    // A QUANTITY of cities: a stacked city (Skyscrapers) counts every tier.
    return player.game.board.countCities(this.all ? undefined : player);
  }
}
