import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Resource} from '../../../common/Resource';
import {ICard} from '../ICard';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class OptimalAerobraking extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.OPTIMAL_AEROBRAKING,
      tags: [Tag.SPACE],
      cost: 7,

      metadata: {
        cardNumber: '031',
        infoText: [{kind: 'effect-short', text: 'Space event played: gain 3 M€ and 3 heat'}],
        renderData: CardRenderer.builder((b) => b.effect('When you play a space event, you gain 3 M€ and 3 heat.', (be) => {
          be.tag(Tag.SPACE).tag(Tag.EVENT).startEffect.megacredits(3).heat(3);
        })),
      },
    });
  }

  public onCardPlayed(player: IPlayer, card: ICard) {
    if (card.type === CardType.EVENT && card.tags.includes(Tag.SPACE)) {
      player.stock.add(Resource.MEGACREDITS, 3, {log: true, from: {card: this}});
      player.stock.add(Resource.HEAT, 3, {log: true, from: {card: this}});
    }
  }
  /**
   * Mirrors `onCardPlayed`: a SPACE EVENT pays 3 M€ + 3 heat at once. The two
   * «almost» cases (a space card that is not an event, an event without a
   * space tag) are stated as `no` facts — the tag matched, the condition did not.
   */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const source = forecast.sourceOf(this, cardOwner, 'card-played');
    const isEvent = card.type === CardType.EVENT;
    const hasSpace = card.tags.includes(Tag.SPACE);
    if (isEvent && hasSpace) {
      return [forecast.exact(source,
        [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, 3), actionPreviews.stockGain(cardOwner, Resource.HEAT, 3)],
        'You play a space event', {reasonTag: Tag.SPACE})];
    }
    if (hasSpace) {
      return [forecast.no(source, 'The card is not an event', {reasonTag: Tag.SPACE})];
    }
    if (isEvent) {
      return [forecast.no(source, 'The event has no space tag', {reasonTag: Tag.SPACE})];
    }
    return [];
  }
}
