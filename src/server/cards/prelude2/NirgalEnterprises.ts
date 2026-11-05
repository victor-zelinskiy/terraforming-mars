import {CorporationCard} from '../corporation/CorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class NirgalEnterprises extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.NIRGAL_ENTERPRISES,
      tags: [Tag.POWER, Tag.PLANT, Tag.BUILDING],
      startingMegaCredits: 30,

      behavior: {
        production: {energy: 1, plants: 1, steel: 1},
      },

      metadata: {
        cardNumber: 'PC01', // Renumber
        renderData: CardRenderer.builder((b) => {
          b.br.br.br.br;
          b.megacredits(30).production((pb) => pb.energy(1).plants(1).steel(1)).br;
          b.effect('AWARDS AND MILESTONES ALWAYS COST 0 M€ FOR YOU.', (eb) => {
            // The effect in ICONS, in the scan's order (PC01 — upstream's TODO resolved): the award and the milestone
            // marks the bot twin C42's face prints, slashed — «either of them» — costing a printed 0 M€.
            eb.award().slash().milestone().startEffect.megacredits(1, {text: '0'});
          });
        }),
        description: 'You start with 30 M€. Increase your energy, plant, and steel production 1 step each.',
      },
    });
  }
}
