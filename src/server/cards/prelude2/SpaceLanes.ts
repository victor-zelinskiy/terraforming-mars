import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {PreludeCard} from '../prelude/PreludeCard';

export class SpaceLanes extends PreludeCard {
  constructor() {
    super({
      name: CardName.SPACE_LANES,
      tags: [Tag.SPACE],

      // PER TAG (`Card.getCardDiscount`: `per` absent → amount × the card's count of the tag): a Jovian + Earth card
      // is 4 M€ cheaper. The print draws Jovian, Earth and Venus; Mars is a LIVE planet tag in this fork (the Turmoil
      // Redux / Prelude 2 cards carry it) and the rule says «a planet tag», so it is counted and the face shows it —
      // the P85 Summit Logistics precedent (`docs/claude/prelude2-cards-progress.md` § P85, the owner's decision 2).
      cardDiscount: [
        {tag: Tag.JOVIAN, amount: 2},
        {tag: Tag.EARTH, amount: 2},
        {tag: Tag.VENUS, amount: 2},
        {tag: Tag.MARS, amount: 2},
      ],

      behavior: {
        stock: {titanium: 3},
      },

      metadata: {
        cardNumber: 'P62',
        description: 'Gain 3 titanium.',
        // The printed rule is over the 52-char caption budget (`tests/cards/effectCaption.spec.ts`).
        infoText: [{kind: 'effect-short', text: 'Planet tags cost 2 M€ less each'}],
        renderData: CardRenderer.builder((b) => {
          b.effect('When you play a Jovian, Earth, Venus or Mars tag, you pay 2 M€ less for it.', (eb) => {
            eb.tag(Tag.JOVIAN).tag(Tag.EARTH).tag(Tag.VENUS).tag(Tag.MARS).startEffect.megacredits(-2);
          });
          b.br;
          b.titanium(3);
        }),
      },
    });
  }
}
