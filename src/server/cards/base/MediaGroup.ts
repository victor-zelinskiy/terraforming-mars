import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {GainResourcesDeferred} from '../../deferredActions/GainResourcesDeferred';
import {Resource} from '../../../common/Resource';
import {ICard} from '../ICard';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class MediaGroup extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.MEDIA_GROUP,
      tags: [Tag.EARTH],
      cost: 6,

      metadata: {
        cardNumber: '109',
        renderData: CardRenderer.builder((b) => {
          b.effect('After you play an event card, you gain 3 M€.', (eb) => {
            eb.tag(Tag.EVENT).startEffect.megacredits(3);
          });
        }),
      },
    });
  }

  public onCardPlayed(player: IPlayer, card: ICard) {
    if (card.type === CardType.EVENT) {
      player.game.defer(new GainResourcesDeferred(player, Resource.MEGACREDITS, {count: 3, log: true}));
    }
  }
  /** Mirrors `onCardPlayed`: 3 M€ through `GainResourcesDeferred` — after the event's own choices. */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    if (card.type !== CardType.EVENT) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'card-played'),
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, 3)],
      'You play an event card', forecast.AFTER_CARD_GAIN)];
  }
}
