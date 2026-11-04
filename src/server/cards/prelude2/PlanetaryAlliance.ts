import {PreludeCard} from '../prelude/PreludeCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';

export class PlanetaryAlliance extends PreludeCard {
  constructor() {
    super({
      name: CardName.PLANETARY_ALLIANCE,
      tags: [Tag.EARTH, Tag.JOVIAN, Tag.VENUS],

      // Two NAMED searches of one play, in the printed order — a list of draws, so the card stays declarative (the
      // gate on the summed count, a chip per search, one batch with two segments, each with its own rule).
      behavior: {
        tr: 2,
        drawCard: [{count: 1, tag: Tag.JOVIAN}, {count: 1, tag: Tag.VENUS}],
      },

      metadata: {
        cardNumber: 'P56',
        renderData: CardRenderer.builder((b) => {
          b.tr(2).cards(1, {secondaryTag: Tag.JOVIAN}).cards(1, {secondaryTag: Tag.VENUS});
        }),
        description: 'Raise your TR 2 steps. Draw 1 Jovian card and 1 Venus card.',
      },
    });
  }
}
