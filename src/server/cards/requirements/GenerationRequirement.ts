import {RequirementType} from '../../../common/cards/RequirementType';
import {IPlayer} from '../../IPlayer';
import {InequalityRequirement} from './InequalityRequirement';

/**
 * «This can only be played during generation N or later» (Turmoil Redux —
 * TR10 Fringe Colony prints «GEN 4+» in the MIN plate).
 *
 * The score is the game's own clock (`game.generation`) — nobody's stock and
 * nobody's tableau, so it is the same number for every player and no card can
 * raise it. The `max` form («N or earlier») is the same comparison turned
 * around; no card prints it yet.
 */
export class GenerationRequirement extends InequalityRequirement {
  public readonly type = RequirementType.GENERATION;
  public getScore(player: IPlayer): number {
    return player.game.generation;
  }
}
