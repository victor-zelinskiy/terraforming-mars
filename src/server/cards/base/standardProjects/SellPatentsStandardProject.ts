import {IPlayer} from '../../../IPlayer';
import {Resource} from '../../../../common/Resource';
import {CardName} from '../../../../common/cards/CardName';
import {CardRenderer} from '../../render/CardRenderer';
import {StandardProjectCard} from '../../StandardProjectCard';
import {SelectCard} from '../../../inputs/SelectCard';
import {IProjectCard} from '../../IProjectCard';

export class SellPatentsStandardProject extends StandardProjectCard {
  constructor() {
    super({
      name: CardName.SELL_PATENTS_STANDARD_PROJECT,
      cost: 0,
      metadata: {
        cardNumber: 'SP8',
        renderData: CardRenderer.builder((b) =>
          b.standardProject('Discard any number of cards to gain that amount of M€.', (eb) => {
            eb.text('X').cards(1).startAction.megacredits(1, {text: 'x'});
          }),
        ),
      },
    });
  }

  public override canAct(player: IPlayer): boolean {
    return player.cardsInHand.length > 0;
  }

  actionEssence(): void {
    // no-op
  }

  public action(player: IPlayer): SelectCard<IProjectCard> {
    return new SelectCard(
      'Sell patents',
      'Sell',
      player.cardsInHand,
      {max: player.cardsInHand.length, played: false})
      .andThen((cards) => {
        // stock.add (NOT `player.megaCredits +=`) so the +M€ from selling patents is
        // recorded as a GameEvent and appears in the journal / notifications.
        player.stock.add(Resource.MEGACREDITS, cards.length);
        cards.forEach((card) => player.discardCardFromHand(card));
        this.projectPlayed(player);
        player.game.log('${0} sold ${1} patents', (b) => b.player(player).number(cards.length));
        return undefined;
      });
  }
}
