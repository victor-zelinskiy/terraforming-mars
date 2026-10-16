import {CardType} from '../../../common/cards/CardType';
import {IProjectCard} from '../IProjectCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {all} from '../Options';
import {ICard} from '../ICard';

export class DetectiveTVSeries extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.DETECTIVE_TV_SERIES,
      type: CardType.ACTIVE,
      cost: 5,
      tags: [Tag.EARTH],

      metadata: {
        cardNumber: 'U091',
        renderData: CardRenderer.builder((b) => {
          b.effect('Whenever ANY player plays a crime tag, you gain 2 MC.', (ab) => {
            ab.tag(Tag.CRIME, {all}).startEffect.megacredits(2);
          });
        }),
      },
    });
  }

  onCardPlayedByAnyPlayer(thisCardOwner: IPlayer, card: ICard) {
    const count = card.tags.filter((tag) => tag === Tag.CRIME).length;
    // `from` names THIS card — the owner's (TR59): `fromToEventSource` stamps the recipient as the source's
    // owner, so the played card here read «ВАША КАРТА ‹карта актора›». The played card is the trigger.
    thisCardOwner.stock.add(Resource.MEGACREDITS, 2 * count, {log: true, from: {card: this}});
    return undefined;
  }
}
