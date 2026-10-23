import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';

export class CulturalMetropolis extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.CULTURAL_METROPOLIS,
      tags: [Tag.CITY, Tag.BUILDING],
      cost: 20,

      // Wholly declarative (T03 — adapted to Turmoil Redux in place): the city cell is the
      // Executor's, and the two delegates go through the political FACADE — availability is
      // `delegatesInReserve`, the placement `politics.placeDelegates` (Redux: both on ONE
      // resolution of the voting area, from the reserve; classic: upstream's
      // `SendDelegateToArea {count: 2}`).
      behavior: {
        production: {energy: -1, megacredits: 3},
        city: {},
        turmoil: {sendDelegates: {count: 2}},
      },

      requirements: {party: PartyName.UNITY},
      metadata: {
        cardNumber: 'T03',
        description: 'Requires that Unity is ruling or that you have 2 delegates there. Decrease your energy production 1 step and increase your M€ production 3 steps. Place a city tile. Place 2 delegates in 1 party.',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => {
            pb.minus().energy(1).br;
            pb.plus().megacredits(3);
          }).city().delegates(2);
        }),
      },
    });
  }
}
