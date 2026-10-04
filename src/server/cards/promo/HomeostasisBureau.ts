import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {Tag} from '../../../common/cards/Tag';
import {GlobalParameter} from '../../../common/GlobalParameter';
import {EffectForecastGrant} from '../EffectForecastContext';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class HomeostasisBureau extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.HOMEOSTASIS_BUREAU,
      cost: 16,
      tags: [Tag.BUILDING],

      behavior: {
        production: {heat: 2},
      },

      metadata: {
        cardNumber: 'X57',
        renderData: CardRenderer.builder((b) => {
          b.effect('When you raise the temperature, gain 3 M€.', (eb) => eb.temperature(1).startEffect.megacredits(3));
          b.br;
          b.production((b) => b.heat(2));
        }),
        description: 'Increase your heat production 2 steps.',
      },
    });
  }

  onGlobalParameterIncrease?(player: IPlayer, parameter: GlobalParameter, steps: number) {
    if (parameter === GlobalParameter.TEMPERATURE) {
      player.stock.add(Resource.MEGACREDITS, 3 * steps, {log: true});
    }
  }

  /** The forecast twin of `onGlobalParameterIncrease`: YOUR temperature raise (its STEPS) pays 3 M€ per step. */
  public grantForecast(cardOwner: IPlayer, _activePlayer: IPlayer, grant: EffectForecastGrant): ReadonlyArray<EffectForecastFact> {
    if (grant.kind !== 'global' || grant.parameter !== GlobalParameter.TEMPERATURE || grant.steps <= 0) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'global-parameter'),
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, 3 * grant.steps)],
      'You raise the temperature')];
  }
}
