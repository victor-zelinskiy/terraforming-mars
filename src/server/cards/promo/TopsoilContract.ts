import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardRenderer} from '../render/CardRenderer';
import {ICard} from '../ICard';
import {CardResource} from '../../../common/CardResource';
import {Resource} from '../../../common/Resource';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastGrant} from '../EffectForecastContext';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class TopsoilContract extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.TOPSOIL_CONTRACT,
      tags: [Tag.MICROBE, Tag.EARTH],
      cost: 8,

      behavior: {
        stock: {plants: 3},
      },

      metadata: {
        cardNumber: 'X30',
        renderData: CardRenderer.builder((b) => {
          b.effect('When you gain a microbe to ANY CARD, also gain 1 M€.', (eb) => {
            eb.resource(CardResource.MICROBE).asterix().startEffect.megacredits(1);
          }).br;
          b.plants(3);
        }),
        description: 'Gain 3 plants.',
      },
    });
  }

  public onResourceAdded(player: IPlayer, card: ICard, count: number) {
    if (card.resourceType === CardResource.MICROBE) {
      player.stock.add(Resource.MEGACREDITS, count, {log: true});
    }
  }
  /** Mirrors `onResourceAdded`: 1 M€ per microbe gained on any of the owner's cards, at once. */
  public grantForecast(cardOwner: IPlayer, _activePlayer: IPlayer, grant: EffectForecastGrant): ReadonlyArray<EffectForecastFact> {
    if (grant.kind !== 'cardResource' || grant.resource !== CardResource.MICROBE || grant.amount <= 0) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'resource-added'),
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, grant.amount)],
      'You gain a microbe on a card')];
  }
}
