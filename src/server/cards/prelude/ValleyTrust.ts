import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {CorporationCard} from '../corporation/CorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {PreludesExpansion} from '../../preludes/PreludesExpansion';
import {ICorporationCard} from '../corporation/ICorporationCard';
import * as actionPreviews from '../actionPreviews';

export class ValleyTrust extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.VALLEY_TRUST,
      tags: [Tag.EARTH],
      startingMegaCredits: 37,
      initialActionText: 'Draw 3 Prelude cards, and play one of them',

      cardDiscount: {tag: Tag.SCIENCE, amount: 2},
      metadata: {
        cardNumber: 'R34',
        description: 'You start with 37 M€. As your first action, draw 3 Prelude cards, and play one of them. Discard the other two.',
        infoText: [
          {text: 'As your first action, draw 3 Prelude cards and play one of them, discarding the other two.', tokens: ['prelude']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br.br;
          b.megacredits(37).nbsp.prelude().asterix();
          b.corpBox('effect', (ce) => {
            ce.effect('When you play a science tag, you pay 2M€ less for it.', (eb) => {
              eb.tag(Tag.SCIENCE).startEffect.megacredits(-2);
            });
          });
        }),
      },
    });
  }

  // TODO(kberg): find a way to feed warnings for initialAction.
  public override initialAction(player: IPlayer) {
    const game = player.game;
    const cards = game.preludeDeck.drawN(game, 3);
    return PreludesExpansion.selectPreludeToPlay(player, cards, 'discard');
  }

  // The 3 preludes are drawn only when the action RESOLVES — nothing exists to
  // pre-collect, and a "+3 cards" chip would overstate a keep-1-of-3 pick. An
  // honest note tells the player exactly what confirming starts.
  public firstActionPreview() {
    return actionPreviews.firstActionBranch(this, [], [
      actionPreviews.noteStep('generic', 'After confirming, draw 3 Prelude cards and choose one to play; the other two are discarded.'),
    ]);
  }
}
