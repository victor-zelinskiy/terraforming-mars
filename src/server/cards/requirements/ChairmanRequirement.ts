import {IPlayer} from '../../IPlayer';
import {CardRequirement} from './CardRequirement';
import {RequirementType} from '../../../common/cards/RequirementType';

/**
 * Evaluates whether a player is the chairman (through the political facade —
 * the classic chairman or the Turmoil Redux chairman's seat).
 */
export class ChairmanRequirement extends CardRequirement {
  public readonly type = RequirementType.CHAIRMAN;
  constructor() {
    super({count: 1});
  }
  public satisfies(player: IPlayer) : boolean {
    return player.game.politics?.isChairman(player) === true;
  }
}
