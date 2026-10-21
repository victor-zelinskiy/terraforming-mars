import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {PartyName} from '../../../common/turmoil/PartyName';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {ICard} from '../ICard';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class GMOContract extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.GMO_CONTRACT,
      tags: [Tag.MICROBE, Tag.SCIENCE],
      cost: 3,

      requirements: {party: PartyName.GREENS},
      metadata: {
        description: 'Requires that Greens are ruling or that you have 2 delegates there.',
        cardNumber: 'T06',
        infoText: [{kind: 'effect-short', text: 'Plant, animal or microbe tag played: +2 M€ each'}],
        renderData: CardRenderer.builder((b) => {
          b.effect('Each time you play a plant, animal or microbe tag, including this, gain 2 M€.', (be) => {
            be.tag(Tag.ANIMAL).slash().tag(Tag.PLANT).slash().tag(Tag.MICROBE);
            be.startEffect.megacredits(2);
          });
        }),
      },
    });
  }

  public onNonCardTagAdded(player: IPlayer, tag: Tag): void {
    if (tag === Tag.PLANT) {
      player.defer(() => player.stock.add(Resource.MEGACREDITS, 2, {log: true}));
    }
  }

  public onCardPlayed(player: IPlayer, card: ICard): void {
    const amount = player.tags.cardTagCount(card, [Tag.ANIMAL, Tag.PLANT, Tag.MICROBE]);
    if (amount > 0) {
      player.defer(() => player.stock.add(Resource.MEGACREDITS, amount * 2, {log: true}));
    }
  }
  /**
   * Mirrors `onCardPlayed`: 2 M€ per matching tag (Decomposers' count), deferred
   * through `player.defer` at `Priority.DEFAULT` — after the card's own choices.
   * The card is a reactor of its own play («including this»), so its composer
   * forecasts the +2 of its own microbe tag.
   */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const tags = cardOwner.tags.cardTagCount(card, [Tag.ANIMAL, Tag.PLANT, Tag.MICROBE]);
    if (tags === 0) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'card-played'),
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, tags * 2)],
      'You play a card with an animal, plant or microbe tag', forecast.AFTER_CARD)];
  }
}
