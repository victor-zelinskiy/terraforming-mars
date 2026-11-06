import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {CardType} from '../../../common/cards/CardType';
import {ICard} from '../../cards/ICard';
export class Philantropist extends BaseMilestone {
  constructor() {
    super(
      'Philantropist',
      'Have 5 cards with non-negative VP',
      5,
    );
  }

  /**
   * «A card with non-negative VP» as this milestone counts it — ONE predicate, read by the player's score and by
   * MarsBot's («As usual (5 cards with non-negative VP in played pile)», Adding Expansions p.13), so the two readings
   * cannot drift. (Upstream counts printed VP above 0 and leaves events out.)
   */
  public static counts(card: ICard): boolean {
    const victoryPoints = card.metadata.victoryPoints;
    if (card.type === CardType.EVENT) {
      return false;
    }
    if (victoryPoints === undefined) {
      return false;
    }
    if (typeof victoryPoints === 'number') {
      return victoryPoints > 0;
    } else {
      return victoryPoints.points > 0;
    }
  }

  public getScore(player: IPlayer): number {
    return player.tableau.filter((card) => Philantropist.counts(card)).length;
  }
}
