import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';

export class JovianEnvoys extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.JOVIAN_ENVOYS,
      cost: 2,
      requirements: {tag: Tag.JOVIAN, count: 2},

      behavior: {
        turmoil: {sendDelegates: {count: 2}},
      },

      metadata: {
        cardNumber: 'P77',
        // P72's twin: under Redux «in 1 party» is «on ONE resolution of the voting area» — the shared grant step
        // (`PlaceDelegatesOnResolution`) never offers the enacted law. The scan prints no asterisk (the classic
        // footnote it pointed at does not exist under Redux) and no tag of the card's own.
        renderData: CardRenderer.builder((b) => b.delegates(2)),
        description: 'Requires 2 Jovian tags. Add 2 delegates to one resolution.',
      },
    });
  }
}
