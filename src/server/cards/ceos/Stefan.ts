import {CardName} from '../../../common/cards/CardName';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {CardRenderer} from '../render/CardRenderer';
import {CeoCard} from './CeoCard';
import {SelectCard} from '../../inputs/SelectCard';
import {cardDiscard, discardForMegacredits} from '../../inputs/discardPrompt';

export class Stefan extends CeoCard {
  constructor() {
    super({
      name: CardName.STEFAN,
      metadata: {
        cardNumber: 'L19',
        renderData: CardRenderer.builder((b) => {
          b.opgArrow().text('SELL').cards(1).colon().megacredits(3);
        }),
        description: 'Once per game, sell any number of cards from your hand for 3 M€ each.',
      },
    });
  }

  public override canAct(player: IPlayer): boolean {
    if (!super.canAct(player)) {
      return false;
    }
    return player.cardsInHand.length > 0;
  }


  public action(player: IPlayer): PlayerInput | undefined {
    this.isDisabled = true;
    return new SelectCard(
      'Sell patents',
      'Sell',
      player.cardsInHand,
      {min: 0, max: player.cardsInHand.length})
      // Mechanically a discard from hand that pays out — same surface, same
      // animation as every other discard; the prompt's own 'Sell' verb stands.
      .markDiscardPrompt(cardDiscard(this, {min: 0, max: player.cardsInHand.length}, {exchange: discardForMegacredits(3)}))
      .andThen((cards) => {
        player.megaCredits += cards.length * 3;

        cards.forEach((card) => {
          player.discardCardFromHand(card);
        });

        player.game.log('${0} sold ${1} patents', (b) => b.player(player).number(cards.length));
        return undefined;
      });
  }
}
