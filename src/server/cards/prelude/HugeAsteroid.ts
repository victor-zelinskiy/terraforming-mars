import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {PreludeCard} from './PreludeCard';
import {CardName} from '../../../common/cards/CardName';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {cardSource} from '../../inputs/choiceContext';
import {CardRenderer} from '../render/CardRenderer';

export class HugeAsteroid extends PreludeCard {
  constructor() {
    super({
      name: CardName.HUGE_ASTEROID,

      startingMegacredits: -5,

      behavior: {
        global: {temperature: 3},
      },

      metadata: {

        infoText: [

          {text: 'Raise the temperature 3 steps.', tokens: ['temperature']},

          {text: 'Pay 5 M€.', tokens: ['megacredits']},

        ],
        cardNumber: 'P15',
        renderData: CardRenderer.builder((b) => {
          b.temperature(3).br;
          b.megacredits(-5);
        }),
        description: 'Increase temperature 3 steps. Pay 5 M€.',
      },
    });
  }
  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions) {
    // A price paid BEFORE this play (P45 Board of Directors' 12 M€) is held back: the 5 M€ come after it.
    return player.canAfford({...canAffordOptions, cost: canAffordOptions.cost + 5});
  }
  public override bespokePlay(player: IPlayer) {
    player.game.defer(new SelectPaymentDeferred(player, -this.startingMegaCredits, {cause: cardSource(this)}));
    return undefined;
  }
}
