import {Colony} from './Colony';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';
import {Resource} from '../../common/Resource';

export class Ceres extends Colony {
  constructor() {
    super({
      name: ColonyName.CERES,
      // The tile's printed flavour line (the physical colony tile, under the
      // name) — the console dossier's archive entry. English IS the i18n key.
      lore: 'This dwarf planet, composed of rock and ice, is estimated to compose 30% of the entire asteroid belt mass.',
      build: {
        description: 'Gain 1 steel production',
        type: ColonyBenefit.GAIN_PRODUCTION,
        resource: Resource.STEEL,
      },
      trade: {
        description: 'Gain n steel',
        type: ColonyBenefit.GAIN_RESOURCES,
        quantity: [1, 2, 3, 4, 6, 8, 10],
        resource: Resource.STEEL,
      },
      colony: {
        description: 'Gain 2 steel',
        type: ColonyBenefit.GAIN_RESOURCES,
        quantity: 2,
        resource: Resource.STEEL,
      },
    });
  }
}
