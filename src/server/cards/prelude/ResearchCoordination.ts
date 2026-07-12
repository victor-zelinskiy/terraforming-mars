import {CardType} from '../../../common/cards/CardType';
import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';

export class ResearchCoordination extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.RESEARCH_COORDINATION,
      tags: [Tag.WILD],
      cost: 4,

      metadata: {
        cardNumber: 'P40',
        description: 'After being played, when you perform an action, the wild tag counts as any tag of your choice.',
        // A passive rule ABOUT the printed WILD tag — a `note` (renders as «ОСОБОЕ
        // ПРАВИЛО») anchored to the tag cluster, not an isolated «ПРИ РОЗЫГРЫШЕ».
        infoText: [
          {kind: 'note', text: 'When you perform an action, the wild tag counts as any tag of your choice.', tokens: ['tags']},
        ],
      },
    });
  }
}
