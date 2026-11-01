import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';

export class VenusAllies extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.VENUS_ALLIES,
      tags: [Tag.VENUS, Tag.SPACE],
      cost: 30,
      victoryPoints: 2,

      behavior: {
        global: {venus: 2},
        stock: {
          megacredits: {
            colonies: {colonies: {}},
            each: 4,
          },
        },
      },

      metadata: {
        cardNumber: 'P87',
        // The generator writes no block for a COUNTED stock gain (P75, PL-1158), so both bonuses are authored — the
        // colony count is the same term P68 / P79 read («Ваши колонии: N»).
        infoText: [
          {text: 'Raise Venus 2 steps.', tokens: ['venus']},
          {text: 'Gain 4 M€ per colony you have.', tokens: ['megacredits']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.venus(2).megacredits(4).slash().colonies();
        }),
        description: 'Raise Venus 2 steps. Gain 4 M€ per colony you have.',
      },
    });
  }
}
