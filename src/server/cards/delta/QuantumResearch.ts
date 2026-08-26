import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';

export class QuantumResearch extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.QUANTUM_RESEARCH,
      tags: [Tag.WILD],
      cost: 9,
      victoryPoints: 1,

      requirements: {tag: Tag.SCIENCE, count: 3},
      metadata: {
        cardNumber: 'DP02',
        renderData: CardRenderer.builder((b) => {
          b.effect('When you buy a card to hand, you pay 1 M€ less for it.', (eb) => {
            eb.cards(1).startEffect.megacredits(-1);
          });
        }),
        description: 'Requires 3 science tags.',
      },
    });
  }

  /**
   * The permanent effect. Summed with every other tableau modifier by
   * `Player.cardCost` (base 3 M€, Polyphemos 5, Terralabs 1) and floored at 0
   * there — this card only ever states its own −1, it never decides the final
   * price and never touches the cost of PLAYING a card.
   */
  public getCardPurchaseDiscount(): number {
    return 1;
  }
}
