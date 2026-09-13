import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {ICard} from '../ICard';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class VenusianAnimals extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.VENUSIAN_ANIMALS,
      type: CardType.ACTIVE,
      tags: [Tag.VENUS, Tag.ANIMAL, Tag.SCIENCE],
      cost: 15,
      resourceType: CardResource.ANIMAL,
      victoryPoints: {resourcesHere: {}},

      requirements: {venus: 18},
      metadata: {
        cardNumber: '259',
        infoText: [{kind: 'effect-short', text: 'Science tag: add an animal here'}],
        renderData: CardRenderer.builder((b) => {
          b.effect('When you play a science tag, including this, add 1 animal to this card.', (eb)=> {
            eb.tag(Tag.SCIENCE).startEffect.resource(CardResource.ANIMAL);
          }).br;
          b.vpText('1 VP per animal on this card.');
        }),
        description: 'Requires Venus 18%',
      },
    });
  }
  public onCardPlayed(player: IPlayer, card: ICard): void {
    const qty = player.tags.cardTagCount(card, Tag.SCIENCE);
    player.addResourceTo(this, {qty, log: true});
  }
  /** Mirrors `onCardPlayed`: one animal per science tag, at once. */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const qty = cardOwner.tags.cardTagCount(card, Tag.SCIENCE);
    if (qty === 0) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'card-played'),
      [actionPreviews.cardGain(this, qty)],
      'You play a card with a ${0} tag', {reasonTag: Tag.SCIENCE})];
  }
  public onNonCardTagAdded(player: IPlayer, tag: Tag) {
    if (tag === Tag.SCIENCE) {
      player.addResourceTo(this, {qty: 1, log: true});
    }
  }
}
