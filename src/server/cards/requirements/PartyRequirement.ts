import {PartyName} from '../../../common/turmoil/PartyName';
import {IPlayer} from '../../IPlayer';
import {CardRequirement} from './CardRequirement';
import {RequirementType} from '../../../common/cards/RequirementType';


/**
 * Evaluate whether a player can satisfy a party requirement — through the
 * political facade, so ONE predicate serves both engines:
 *
 * - classic Turmoil: the party rules, or the player is allied to it (Mars
 *   Frontier Alliance), or it holds two of the player's delegates;
 * - Turmoil Redux: the party rules, or the player has two delegates on its
 *   resolution in the voting area. A card-GRANTED party effect never counts
 *   (rulebook FAQ p.19).
 *
 * Without a political engine no party requirement is ever met.
 */
export class PartyRequirement extends CardRequirement {
  public readonly type = RequirementType.PARTY;
  constructor(public readonly party: PartyName) {
    super();
  }

  public satisfies(player: IPlayer): boolean {
    return player.game.politics?.satisfiesPartyRequirement(player, this.party) === true;
  }
}
