import {CorporationCard} from './CorporationCard';
import {Tag} from '../../../common/cards/Tag';
import {ICard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {Resource} from '../../../common/Resource';
import {ICorporationCard} from './ICorporationCard';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class InterplanetaryCinematics extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.INTERPLANETARY_CINEMATICS,
      tags: [Tag.BUILDING],
      startingMegaCredits: 30,

      behavior: {
        stock: {steel: 20},
      },

      metadata: {
        cardNumber: 'R19',
        description: 'You start with 20 steel and 30 M€.',
        renderData: CardRenderer.builder((b) => {
          b.br.br.br;
          b.megacredits(30).nbsp.steel(20, {digit});
          b.corpBox('effect', (ce) => {
            ce.effect('Each time you play an event, you gain 2 M€.', (eb) => {
              eb.tag(Tag.EVENT).startEffect.megacredits(2);
            });
          });
        }),
      },
    });
  }
  public onCardPlayed(player: IPlayer, card: ICard) {
    if (card.type === CardType.EVENT) {
      player.stock.add(Resource.MEGACREDITS, 2, {log: true, from: {card: this}});
    }
  }
  /** Mirrors `onCardPlayed`: an event pays 2 M€ at once. */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    if (card.type !== CardType.EVENT) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'card-played'),
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, 2)],
      'You play an event card')];
  }
}
