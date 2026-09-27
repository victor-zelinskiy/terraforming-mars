import {Colony} from './Colony';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';
import {Resource} from '../../common/Resource';

export class Luna extends Colony {
  constructor() {
    super({
      name: ColonyName.LUNA,
      // The tile's printed flavour line (the physical colony tile, under the
      // name) — the console dossier's archive entry. English IS the i18n key.
      lore: 'Our own moon is the natural gate between the riches of Earth and the solar system beyond.',
      build: {
        description: 'Gain 2 M€ production',
        type: ColonyBenefit.GAIN_PRODUCTION,
        quantity: [2, 2, 2],
        resource: Resource.MEGACREDITS,
      },
      trade: {
        description: 'Gain n M€',
        type: ColonyBenefit.GAIN_RESOURCES,
        quantity: [1, 2, 4, 7, 10, 13, 17],
        resource: Resource.MEGACREDITS,
      },
      colony: {
        description: 'Gain 2 M€',
        type: ColonyBenefit.GAIN_RESOURCES,
        quantity: 2,
        resource: Resource.MEGACREDITS,
      },
    });
  }
}
