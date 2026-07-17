import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {CardResource} from '../../../common/CardResource';
import {ActiveCorporationCard} from '../corporation/CorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {AltSecondaryTag} from '../../../common/cards/render/AltSecondaryTag';
import {floaterCards} from './floaterCards';
import * as actionPreviews from '../actionPreviews';

export class Celestic extends ActiveCorporationCard {
  constructor() {
    super({
      name: CardName.CELESTIC,
      tags: [Tag.VENUS],
      startingMegaCredits: 42,
      resourceType: CardResource.FLOATER,
      initialActionText: 'Draw 2 cards with a floater icon on it',
      victoryPoints: {resourcesHere: {}, per: 3},

      action: {
        addResourcesToAnyCard: {
          type: CardResource.FLOATER,
          count: 1,
        },
      },

      metadata: {
        cardNumber: 'R05',
        // The action string bakes in «1 VP per 3 floaters»; split it — the VP
        // rule renders once from the countable shape, the action reads clean.
        description: 'You start with 42 M€. As your first action, reveal cards from the deck until you have revealed 2 cards with a floater icon on it. Take them into hand and discard the rest.',
        infoText: [
          {text: 'As your first action, reveal cards from the deck until you reveal 2 cards with a floater icon; take them into hand and discard the rest.', tokens: ['cards']},
          {kind: 'action', text: 'Add a floater to any card.', tokens: ['res-floater']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.megacredits(42).nbsp.cards(2, {secondaryTag: AltSecondaryTag.FLOATER});
          b.corpBox('action', (ce) => {
            ce.action('Add a floater to ANY card. 1 VP per 3 floaters on this card.', (eb) => {
              eb.empty().startAction.resource(CardResource.FLOATER).asterix();
            });
            ce.vSpace(); // to offset the description to the top a bit so it can be readable
          });
        }),
      },
    });
  }


  public override initialAction(player: IPlayer) {
    player.drawCard(2, {
      include: (card) => floaterCards.has(card.name) || card.resourceType === CardResource.FLOATER,
    });
    return undefined;
  }

  // A reveal-search that genuinely nets 2 cards to hand — the draw chip is
  // exact; the note explains the reveal mechanic (discards ride the log).
  public firstActionPreview() {
    return actionPreviews.firstActionBranch(this, [actionPreviews.drawGain(2)], [
      actionPreviews.noteStep('generic', 'Reveal cards from the deck until you find 2 cards with a floater icon — they go to your hand.'),
    ]);
  }
}
