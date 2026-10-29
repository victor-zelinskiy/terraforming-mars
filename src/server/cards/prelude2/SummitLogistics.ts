import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardType} from '../../../common/cards/CardType';

export class SummitLogistics extends Card {
  constructor() {
    super({
      name: CardName.SUMMIT_LOGISTICS,
      type: CardType.AUTOMATED,
      tags: [Tag.BUILDING, Tag.SPACE],
      cost: 10,

      requirements: {party: PartyName.SCIENTISTS},

      behavior: {
        stock: {
          megacredits: {
            tag: [Tag.JOVIAN, Tag.EARTH, Tag.VENUS, Tag.MARS],
            colonies: {colonies: {}},
          },
        },
        drawCard: 2,
      },

      metadata: {
        cardNumber: 'P85',
        // The print draws Jovian, Earth and Venus; Mars is a LIVE tag in this fork (eight Turmoil Redux cards carry it)
        // and the rule counts it (upstream's «fan expansion note»), so the face shows it too — the face says what is
        // counted (`docs/claude/prelude2-cards-progress.md` § P85, the owner's decision 2).
        infoText: [
          {text: 'Gain 1 M€ for each planet tag (Jovian, Earth, Venus or Mars) you have and for each colony you have.', tokens: ['megacredits']},
          {text: 'Draw 2 cards.', tokens: ['cards']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.megacredits(1).slash().tag(Tag.JOVIAN).tag(Tag.EARTH).tag(Tag.VENUS).tag(Tag.MARS).colonies(1);
          b.br;
          b.cards(2);
        }),
        description: 'Requires that Scientists are ruling or that you have 2 delegates there. ' +
          'Gain 1 M€ for each planet tag (Jovian, Earth, Venus or Mars) you have and for each colony you have. Draw 2 cards.',
      },
    });
  }
}
