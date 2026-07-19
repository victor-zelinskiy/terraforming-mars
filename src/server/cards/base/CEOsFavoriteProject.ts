import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';

export class CEOsFavoriteProject extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.CEOS_FAVORITE_PROJECT,
      cost: 1,

      behavior: {
        addResourcesToAnyCard: {
          count: 1,
          min: 1,
          mustHaveCard: true,
          robotCards: true,
        },
      },

      metadata: {

        infoText: [

          {text: 'Add 1 resource to a card with at least 1 resource on it.', tokens: ['wild']},

        ],
        cardNumber: '149',
        renderData: CardRenderer.builder((b) => b.wild(1)),
      },
    });
  }
}
