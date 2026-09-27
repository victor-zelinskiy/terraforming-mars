import {Colony} from './Colony';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';

export class Pluto extends Colony {
  constructor() {
    super({
      name: ColonyName.PLUTO,
      // The tile's printed flavour line (the physical colony tile, under the
      // name) — the console dossier's archive entry. English IS the i18n key.
      lore: 'This dwarf planet and its companion Charon wander the space between Neptune and the Kuiper belt.',
      build: {
        description: 'Draw 2 cards',
        type: ColonyBenefit.DRAW_CARDS,
        quantity: [2, 2, 2],
      },
      trade: {
        description: 'Draw n cards',
        type: ColonyBenefit.DRAW_CARDS,
        quantity: [0, 1, 2, 2, 3, 3, 4],
      },
      colony: {
        description: 'Draw 1 card and then discard 1 card',
        type: ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE,
      },
    });
  }
}
