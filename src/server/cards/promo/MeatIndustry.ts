import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../ICard';
import {CardResource} from '../../../common/CardResource';
import {Resource} from '../../../common/Resource';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastGrant} from '../EffectForecastContext';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class MeatIndustry extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.MEAT_INDUSTRY,
      tags: [Tag.BUILDING],
      cost: 5,

      metadata: {
        cardNumber: 'X25',
        renderData: CardRenderer.builder((b) => {
          b.effect('When you gain an animal to ANY CARD, gain 2 M€.', (eb) => {
            eb.resource(CardResource.ANIMAL).asterix().startEffect.megacredits(2);
          });
        }),
      },
    });
  }

  public onResourceAdded(player: IPlayer, card: ICard, count: number) {
    if (card.resourceType === CardResource.ANIMAL) {
      player.stock.add(Resource.MEGACREDITS, count * 2, {log: true});
    }
  }
  /** Mirrors `onResourceAdded`: 2 M€ per animal gained on any of the owner's cards, at once. */
  public grantForecast(cardOwner: IPlayer, _activePlayer: IPlayer, grant: EffectForecastGrant): ReadonlyArray<EffectForecastFact> {
    if (grant.kind !== 'cardResource' || grant.resource !== CardResource.ANIMAL || grant.amount <= 0) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'resource-added'),
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, grant.amount * 2)],
      'You gain an animal on a card')];
  }
}
