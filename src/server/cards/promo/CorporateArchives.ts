import {Tag} from '../../../common/cards/Tag';
import {PreludeCard} from '../prelude/PreludeCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';

export class CorporateArchives extends PreludeCard {
  constructor() {
    super({
      name: CardName.CORPORATE_ARCHIVES,
      tags: [Tag.SCIENCE],

      behavior: {
        drawCard: {count: 7, keep: 2},
        stock: {megacredits: 13},
      },

      metadata: {

        infoText: [

          {text: 'Look at the top 7 cards of the deck: take 2 of them into your hand, discard the rest.', tokens: ['text']},

          {text: 'Gain 13 M€.', tokens: ['megacredits']},

        ],
        cardNumber: 'X39',
        description: 'Gain 13 M€.',
        renderData: CardRenderer.builder((b) => {
          b.text('Look at the top 7 cards from the deck. Take 2 of them into hand and discard the other 5.', Size.SMALL, true);
          b.br;
          b.megacredits(13);
        }),
      },
    });
  }
}
