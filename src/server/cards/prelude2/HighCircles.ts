import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {PreludeCard} from '../prelude/PreludeCard';
import {ICard} from '../ICard';

export class HighCircles extends PreludeCard implements ICard {
  constructor() {
    super({
      name: CardName.HIGH_CIRCLES,
      tags: [Tag.EARTH],

      // DECLARATIVE WHOLE (P51 · ledger FF), Turmoil Redux voice. The draw is the NAMED search «with a party
      // requirement» (`partyRequirement` — one descriptor with the reveal's head, its discard reasons, the composer's
      // chip and the card text; `hasPartyRequirement` is the one reading of the phrase). The two delegates go through
      // the political FACADE: both from the reserve onto ONE resolution of the voting area (`PlaceDelegatesOnResolution`
      // — never the enacted one; the rulebook's p.13 «Add delegates to a party → Add delegates to a resolution»). The
      // +1 influence is the Parliament's own ledger (`addInfluenceBonus` — the Agenda track + cards; 0 → 1 at the start,
      // read by the sitting's snapshot as P71's). Order: TR and the draw resolve at play, the grant is deferred — the
      // drawn card is already in hand when the player picks the resolution.
      behavior: {
        tr: 1,
        drawCard: {count: 1, partyRequirement: true},
        turmoil: {influenceBonus: 1, sendDelegates: {count: 2}},
      },

      metadata: {
        cardNumber: 'P51',
        renderData: CardRenderer.builder((b) => {
          b.tr(1).cards(1).asterix().delegates(2).br;
          b.effect('You have +1 influence.',
            (eb) => eb.startEffect.plus().influence({amount: 1}));
        }),
        description: 'Raise your TR 1 step and draw 1 card with a party requirement. Add 2 delegates to one resolution.',
        // The generator curates a grant that sits beside an influence bonus (the influence is the EFFECT frame's, read
        // off the render), so the on-play zone is authored — the three printed parts in their executed order, the
        // draw in the search's own sentence (`drawSearchSentence`).
        infoText: [
          {text: 'Gain 1 TR.', tokens: ['tr']},
          {text: 'Reveal cards from the project deck until you reveal a card with a party requirement. Take it into your hand and discard the rest.', tokens: ['cards']},
          {text: 'Add 2 delegates to one resolution.', tokens: ['delegates']},
        ],
      },
    });
  }
}
