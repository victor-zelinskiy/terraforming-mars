import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {ICorporationCard} from './ICorporationCard';
import {CorporationCard} from './CorporationCard';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {ICard} from '../ICard';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class SaturnSystems extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.SATURN_SYSTEMS,
      tags: [Tag.JOVIAN],
      startingMegaCredits: 42,

      behavior: {
        production: {titanium: 1},
      },

      metadata: {
        cardNumber: 'R03',
        infoText: [{kind: 'effect-short', text: 'Any Jovian tag: +1 M€ production'}],
        description: 'You start with 1 titanium production and 42 M€.',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.production((pb) => pb.titanium(1)).nbsp.megacredits(42);
          b.corpBox('effect', (ce) => {
            ce.effect('Each time any Jovian tag is put into play, including this, increase your M€ production 1 step.', (eb) => {
              eb.tag(Tag.JOVIAN, {all}).startEffect.production((pb) => pb.megacredits(1));
            });
          });
        }),
      },
    });
  }

  public onCardPlayedByAnyPlayer(thisCardOwner: IPlayer, card: ICard) {
    const count = thisCardOwner.tags.cardTagCount(card, Tag.JOVIAN);
    thisCardOwner.production.add(Resource.MEGACREDITS, count, {log: true, from: {card: this}});
  }
  /** Mirrors `onCardPlayedByAnyPlayer`: +1 M€ production per Jovian tag, for the OWNER, whoever plays it. */
  public cardPlayedForecast(cardOwner: IPlayer, activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const count = cardOwner.tags.cardTagCount(card, Tag.JOVIAN);
    if (count === 0) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'card-played-by-any'),
      [actionPreviews.productionChange(cardOwner, Resource.MEGACREDITS, count)],
      forecast.anyPlayerTagReason(Tag.JOVIAN),
      {reasonTag: Tag.JOVIAN, recipient: forecast.recipientOf(activePlayer, cardOwner)})];
  }

  public onNonCardTagAddedByAnyPlayer(cardOwner: IPlayer, tag: Tag) {
    if (tag === Tag.JOVIAN) {
      cardOwner.production.add(Resource.MEGACREDITS, 1, {log: true, from: {card: this}});
    }
  }
}
