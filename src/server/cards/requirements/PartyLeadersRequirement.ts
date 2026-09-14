import {IPlayer} from '../../IPlayer';
import {InequalityRequirement} from './InequalityRequirement';
import {RequirementType} from '../../../common/cards/RequirementType';

/**
 * Evaluate whether the number of parties a player leads is at least (or at
 * most) a given value — classic party leaders, or (Turmoil Redux) the
 * resolutions the player leads in the voting area (rulebook p.14).
 */
export class PartyLeadersRequirement extends InequalityRequirement {
  public readonly type = RequirementType.PARTY_LEADERS;
  public override getScore(player: IPlayer): number {
    return player.game.politics?.partiesLedBy(player) ?? 0;
  }
}
