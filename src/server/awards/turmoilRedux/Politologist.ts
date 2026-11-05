import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';
import {hasPartyRequirement} from '../../cards/requirements/partyRequirementCards';

/**
 * Turmoil Redux — «Politologist»: highest number of cards with a party requirement. (Event cards count.)
 *
 * «A card with a party requirement» has ONE reading — `hasPartyRequirement` (a requirement of the `party` kind, any
 * party; the chairman, party leaders, delegates on resolutions and influence are their own kinds). The cards are the
 * player's PLAYED ones: `playedCards` holds the events pile of the same tableau, so the printed «(Event cards count)»
 * is the plain count — preludes and corporations print no party requirement and never count.
 */
export class Politologist implements IAward {
  public readonly name = 'Politologist';
  public readonly description = 'Have the most cards with a party requirement. (Event cards count)';

  public getScore(player: IPlayer): number {
    return player.playedCards.filter(hasPartyRequirement).length;
  }
}
