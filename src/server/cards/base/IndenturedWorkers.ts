import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IProjectCard} from '../IProjectCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';

export class IndenturedWorkers extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.INDENTURED_WORKERS,
      cost: 0,
      victoryPoints: -1,
      // A ONE-PLAY discount: the next card played this generation (TR49 class).
      cardDiscount: {amount: 8, nextCardOnly: true},

      metadata: {
        cardNumber: '195',
        renderData: CardRenderer.builder((b) => {
          b.text('next card', Size.SMALL, true).colon().megacredits(-8);
        }),
        description: 'The next card you play this generation costs 8 M€ less.',
      },
    });
  }
}
