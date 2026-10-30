import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';

export class EnvoysFromVenus extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.ENVOYS_FROM_VENUS,
      cost: 1,
      tags: [Tag.VENUS],
      requirements: {tag: Tag.VENUS, count: 3},

      behavior: {
        turmoil: {sendDelegates: {count: 2}},
      },

      metadata: {
        cardNumber: 'P72',
        // Redux voice: «in 1 party» is «on ONE resolution of the voting area» — the political FACADE places both
        // cubes from the reserve through the shared grant step (`PlaceDelegatesOnResolution`, which never offers the
        // enacted law). The scan prints no asterisk: the classic footnote it pointed at does not exist under Redux.
        // The line is the generator's own `mech:turmoil.delegates` sentence (P83's shape).
        renderData: CardRenderer.builder((b) => b.delegates(2)),
        description: 'Requires 3 Venus tags. Add 2 delegates to one resolution.',
      },
    });
  }
}
