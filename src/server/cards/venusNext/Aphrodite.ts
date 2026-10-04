import {CorporationCard} from '../corporation/CorporationCard';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {GlobalParameter} from '../../../common/GlobalParameter';
import {GlobalParameterRaise} from '../GlobalParameterRaise';
import {EffectForecastGrant} from '../EffectForecastContext';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {recordScaleStepReward} from '../scaleStepReward';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class Aphrodite extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.APHRODITE,
      tags: [Tag.PLANT, Tag.VENUS],
      startingMegaCredits: 47,

      behavior: {
        production: {plants: 1},
      },

      metadata: {
        cardNumber: 'R01',
        description: 'You start with 1 plant production and 47 M€.',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.production((pb) => pb.plants(1)).nbsp.megacredits(47);
          b.corpBox('effect', (ce) => {
            ce.effect('Whenever Venus is terraformed 1 step, you gain 2 M€.', (eb) => {
              eb.venus(1, {all}).startEffect.megacredits(2);
            });
          });
        }),
      },
    });
  }

  /**
   * «Whenever Venus is terraformed 1 step» — by ANY player, MarsBot, the World
   * Government or a resolution's world move (RX12 Gas Export): the engine's
   * one dispatcher (`Game.globalParameterRaised`) calls this outside the reward
   * gate, at the position the corporation's engine special case used to hold.
   * The BOT's own Aphrodite (C28) is not a card and keeps its own dispatcher
   * (`AutomaCorporations.onVenusIncreased`).
   */
  public onGlobalParameterRaised(cardOwner: IPlayer, raise: GlobalParameterRaise): void {
    if (raise.parameter !== GlobalParameter.VENUS) {
      return;
    }
    const amount = 2 * raise.steps;
    cardOwner.stock.add(Resource.MEGACREDITS, amount, {log: true, from: {card: this}});
    recordScaleStepReward(cardOwner, this, raise, {kind: 'stock', resource: Resource.MEGACREDITS, amount});
  }

  /** The forecast twin of `onGlobalParameterRaised`: a Venus raise (its STEPS) pays 2 M€ per step, whoever raises. */
  public grantForecast(cardOwner: IPlayer, _activePlayer: IPlayer, grant: EffectForecastGrant): ReadonlyArray<EffectForecastFact> {
    if (grant.kind !== 'global' || grant.parameter !== GlobalParameter.VENUS || grant.steps <= 0) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'global-parameter'),
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, 2 * grant.steps)],
      'Venus is terraformed a step')];
  }
}
