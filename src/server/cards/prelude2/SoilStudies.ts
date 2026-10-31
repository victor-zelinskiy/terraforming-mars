import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {max} from '../Options';

export class SoilStudies extends Card {
  constructor() {
    super({
      name: CardName.SOIL_STUDIES,
      type: CardType.EVENT,
      tags: [Tag.MICROBE, Tag.PLANT],
      cost: 13,

      requirements: {temperature: -4, max},

      behavior: {
        stock: {
          plants: {
            tag: [Tag.VENUS, Tag.PLANT],
            colonies: {colonies: {}},
          },
        },
      },

      metadata: {
        cardNumber: 'P81',
        // The generator writes no block for a COUNTED stock gain (P75, PL-1158), so the one bonus is authored — with the
        // print's «including this one»: the hand's count already holds the card's own plant tag (`Counter`), and the
        // «РАСЧЁТ» strip names that share («в т.ч. эта карта 1»).
        infoText: [
          {text: 'Gain 1 plant for each Venus tag, plant tag (including this one) and colony you have.', tokens: ['plants']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.plants(1).slash().tag(Tag.VENUS).tag(Tag.PLANT).colonies(1).br;
        }),
        description: 'Requires that temperature is -4 °C or colder. Gain 1 plant for each Venus tag, plant tag (including this one) and colony you have.',
      },
    });
  }
}
