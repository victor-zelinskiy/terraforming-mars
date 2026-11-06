import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';
import {ICard} from '../../cards/ICard';
import {CardType} from '../../../common/cards/CardType';
import {Tag} from '../../../common/cards/Tag';

export class Administrator implements IAward {
  public readonly name = 'Administrator';
  public readonly description = 'Have the most cards with no tags';

  /**
   * «A card with no tags» — ONE predicate, read by the player's count (`Tags.numberOfCardsWithNoTags`), by MarsBot's
   * played-pile count and by its Corporate Competition helper («reveal until a card without a tag», Adding Expansions
   * p.16). Wild tags are ignored (more untagged cards is always better); an event is never untagged — its Event tag is
   * implicit in its type.
   */
  public static untagged(card: Pick<ICard, 'type' | 'tags'>): boolean {
    return card.type !== CardType.EVENT && card.tags.every((tag) => tag === Tag.WILD);
  }

  public getScore(player: IPlayer): number {
    return player.tags.numberOfCardsWithNoTags();
  }
}
