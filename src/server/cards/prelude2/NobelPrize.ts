import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {PreludeCard} from '../prelude/PreludeCard';
import {AltSecondaryTag} from '../../../common/cards/render/AltSecondaryTag';

export class NobelPrize extends PreludeCard {
  constructor() {
    super({
      name: CardName.NOBEL_PRIZE,
      tags: [Tag.WILD],
      victoryPoints: 2,

      // «Draw 2 cards with requirements» is a NAMED search (`hasRequirement` — any requirement of any kind), never an
      // opaque `include`: the reveal, the preview chip and the card text all name the rule.
      behavior: {
        stock: {megacredits: 5},
        drawCard: {count: 2, requirement: true},
      },

      metadata: {
        cardNumber: 'P54',
        renderData: CardRenderer.builder((b) => {
          b.megacredits(5).cards(2, {secondaryTag: AltSecondaryTag.REQ});
        }),
        description: 'Gain 5 M€. Draw 2 cards with requirements.',
      },
    });
  }
}
