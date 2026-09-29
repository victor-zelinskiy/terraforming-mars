import {RequirementType} from '../../../common/cards/RequirementType';
import {IPlayer} from '../../IPlayer';
import {InequalityRequirement} from './InequalityRequirement';

/**
 * «Requires that you have at least N delegates on resolutions in the Voting
 * Area.» (Turmoil Redux — TR02 Political Science is the first card to print it.)
 *
 * The count is the player's OWN delegates standing on the resolutions of the
 * voting area — the three slots, whichever cards are dealt into them — and
 * nothing else: a delegate in the lobby, in the chairman's seat or in the
 * reserve is not «on a resolution». It is the very number the parliament info
 * panel prints as «On resolutions» (`ParliamentModel.onResolutions`), read
 * through the political facade (`PoliticalOps.delegatesOnResolutions`) so the
 * card never reaches into the ledger itself. Without a Mars Parliament (the
 * classic engine, or no political engine at all) the facade answers 0 and the
 * requirement is simply unmeetable — never a crash in a mixed-deck edge.
 */
export class DelegatesOnResolutionsRequirement extends InequalityRequirement {
  public readonly type = RequirementType.DELEGATES_ON_RESOLUTIONS;
  public getScore(player: IPlayer): number {
    return player.game.politics?.delegatesOnResolutions(player) ?? 0;
  }
}
