import {Colony} from './Colony';
import {Resource} from '../../common/Resource';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';

export class Callisto extends Colony {
  constructor() {
    super({
      name: ColonyName.CALLISTO,
      // The tile's printed flavour line (the physical colony tile, under the
      // name) — the console dossier's archive entry. English IS the i18n key.
      lore: 'Close to Mercury in size, this Jupiter moon consists of 40% ice and 60% rock.',
      build: {
        description: 'Gain 1 energy production',
        type: ColonyBenefit.GAIN_PRODUCTION,
        resource: Resource.ENERGY,
      },
      trade: {
        description: 'Gain n energy',
        type: ColonyBenefit.GAIN_RESOURCES,
        quantity: [0, 2, 3, 5, 7, 10, 13],
        resource: Resource.ENERGY,
      },
      colony: {
        description: 'Gain 3 energy',
        type: ColonyBenefit.GAIN_RESOURCES,
        quantity: 3,
        resource: Resource.ENERGY,
      },
    });
  }
}
