import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {Size} from '../../../common/cards/render/Size';
import {Card} from '../Card';
import {CardRenderer} from '../render/CardRenderer';

export class MicrogravityNutrition extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 11,
      tags: [Tag.MICROBE, Tag.PLANT],
      name: CardName.MICROGRAVITY_NUTRITION,
      type: CardType.AUTOMATED,
      victoryPoints: 1,

      // A counted production over the player's own colony cubes — the declaration Ecology Research makes, so the
      // preview, the hand plate and «РАСЧЁТ» read the same server count (`Counter` — THE ONE reading of colonies).
      behavior: {
        production: {megacredits: {colonies: {colonies: {}}}},
      },

      metadata: {
        description: 'Increase your M€ production 1 step for each colony you have.',
        cardNumber: 'P79',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.megacredits(1).slash().colonies(1, {size: Size.SMALL})).br;
        }),
      },
    });
  }
}
