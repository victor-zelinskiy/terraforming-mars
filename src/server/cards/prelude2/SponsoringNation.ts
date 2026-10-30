import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {CardType} from '../../../common/cards/CardType';
import {Card} from '../Card';

export class SponsoringNation extends Card {
  constructor() {
    super({
      name: CardName.SPONSORING_NATION,
      type: CardType.AUTOMATED,
      tags: [Tag.EARTH],
      cost: 21,

      behavior: {
        tr: 3,
        turmoil: {sendDelegates: {count: 2}},
      },

      requirements: {tag: Tag.EARTH, count: 4},

      metadata: {
        cardNumber: 'P83',
        // Redux voice: the two delegates go through the political FACADE (`politics.placeDelegates`) — both from
        // the reserve onto ONE resolution of the voting area (T03's grant step); the classic table keeps upstream's
        // `SendDelegateToArea {count: 2}`. The line is the generator's own `mech:turmoil.delegates` sentence.
        description: 'Requires 4 Earth tags. Gain 3 TR. Add 2 delegates to one resolution.',
        renderData: CardRenderer.builder((b) => {
          b.tr(3).br.delegates(2);
        }),
      },
    });
  }
}
