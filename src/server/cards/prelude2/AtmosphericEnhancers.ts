import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {PreludeCard} from '../prelude/PreludeCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';
import {TRSource} from '../../../common/cards/TRSource';
import {digit} from '../Options';
import {AltSecondaryTag} from '../../../common/cards/render/AltSecondaryTag';

export class AtmosphericEnhancers extends PreludeCard {
  constructor() {
    super({
      name: CardName.ATMOSPHERIC_ENHANCERS,
      tags: [Tag.VENUS],

      // DECLARATIVE WHOLE (P44 · ledger EQ): the three printed rows are the `or`'s titled branches — the live prompt
      // carries each branch's `current → resulting` (the Executor's option metadata) and the console asks the choice
      // BEFORE the press («ВАРИАНТ»); the draw is the NAMED search («со значком аэростата» — `floaterIcon`), so the
      // reveal, the journal and the card's text name its rule. The draw runs at play, before the choice is answered —
      // the order the bespoke draw always had.
      behavior: {
        or: {
          behaviors: [
            {global: {temperature: 2}, title: 'Raise temperature 2 steps'},
            {global: {oxygen: 2}, title: 'Raise oxygen 2 steps'},
            {global: {venus: 2}, title: 'Raise Venus 2 steps'},
          ],
        },
        drawCard: {count: 2, floaterIcon: true},
      },

      metadata: {
        cardNumber: 'P44',
        renderData: CardRenderer.builder((b) => {
          b.temperature(2, {digit}).slash().oxygen(2, {digit}).br.slash().venus(2, {digit}).br;
          b.cards(2, {secondaryTag: AltSecondaryTag.FLOATER});
        }),
        description: 'Raise the temperature 2 steps, or the oxygen level 2 steps, or the Venus scale 2 steps. Draw 2 cards with a floater icon.',
        infoText: [
          {text: 'Raise the temperature 2 steps, or the oxygen level 2 steps, or the Venus scale 2 steps.', tokens: ['temperature', 'oxygen', 'venus']},
          {text: 'Reveal cards from the project deck until you reveal 2 cards with a floater icon. Take them into your hand and discard the rest.', tokens: ['cards']},
        ],
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions) {
    function adjusted(trSource: TRSource) {
      return {...canAffordOptions, tr: trSource};
    }
    return (
      player.canAfford(adjusted({oxygen: 2})) ||
      player.canAfford(adjusted({temperature: 2})) ||
      player.canAfford(adjusted({venus: 2}))
    );
  }
}
