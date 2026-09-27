import {Colony} from './Colony';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';
import {CardResource} from '../../common/CardResource';

export class Titan extends Colony {
  public override isActive = false;
  constructor() {
    super({
      name: ColonyName.TITAN,
      // The tile's printed flavour line (the physical colony tile, under the
      // name) — the console dossier's archive entry. English IS the i18n key.
      lore: 'The largest moon of Saturn has a dense atmosphere and liquid oceans of methane.',
      cardResource: CardResource.FLOATER,
      build: {
        description: 'Add 3 floaters to ANY card',
        type: ColonyBenefit.ADD_RESOURCES_TO_CARD,
        quantity: [3, 3, 3],
      },
      trade: {
        description: 'Add n floaters to ANY card',
        type: ColonyBenefit.ADD_RESOURCES_TO_CARD,
        quantity: [0, 1, 1, 2, 3, 3, 4],
      },
      colony: {
        description: 'Add 1 floater to ANY card',
        type: ColonyBenefit.ADD_RESOURCES_TO_CARD,
      },
    });
  }
}
