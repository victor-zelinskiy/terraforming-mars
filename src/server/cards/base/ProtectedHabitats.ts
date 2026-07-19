import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {CardResource} from '../../../common/CardResource';

export class ProtectedHabitats extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.PROTECTED_HABITATS,
      cost: 5,

      metadata: {

        infoText: [

          {kind: 'effect', text: 'Your plants, animals and microbes are protected from removal by other players.', tokens: ['protection']},

        ],
        cardNumber: '173',
        renderData: CardRenderer.builder((b) => {
          b.protection().br;
          b.plants(1).resource(CardResource.ANIMAL).resource(CardResource.MICROBE);
        }),
      },
    });
  }
}
