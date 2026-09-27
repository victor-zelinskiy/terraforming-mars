import {Colony} from './Colony';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';
import {CardResource} from '../../common/CardResource';

export class Enceladus extends Colony {
  public override isActive = false;
  constructor() {
    super({
      name: ColonyName.ENCELADUS,
      // The tile's printed flavour line (the physical colony tile, under the
      // name) — the console dossier's archive entry. English IS the i18n key.
      lore: 'This Saturn moon is relatively dense, compared to the other ice moons, and may have a liquid ocean underneath its surface.',
      cardResource: CardResource.MICROBE,
      build: {
        description: 'Add 3 microbes to ANY card',
        type: ColonyBenefit.ADD_RESOURCES_TO_CARD,
        quantity: [3, 3, 3],
      },
      trade: {
        description: 'Add n microbes to ANY card',
        type: ColonyBenefit.ADD_RESOURCES_TO_CARD,
        quantity: [0, 1, 2, 3, 4, 4, 5],
      },
      colony: {
        description: 'Add 1 microbe to ANY card',
        type: ColonyBenefit.ADD_RESOURCES_TO_CARD,
      },
    });
  }
}
