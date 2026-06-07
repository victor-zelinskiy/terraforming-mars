import {Tag} from '../../../common/cards/Tag';
import {ActionCard} from '../ActionCard';
import {CardType} from '../../../common/cards/CardType';
import {IProjectCard} from '../IProjectCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';

export class InventorsGuild extends ActionCard implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.INVENTORS_GUILD,
      tags: [Tag.SCIENCE],
      cost: 9,

      action: {
        drawCard: {count: 1, pay: true},
      },

      metadata: {
        cardNumber: '006',
        renderData: CardRenderer.builder((b) => {
          b.action('Look at the top card and either buy it or discard it', (eb) => eb.empty().startAction.cards(1));
        }),
      },
    });
  }
}
