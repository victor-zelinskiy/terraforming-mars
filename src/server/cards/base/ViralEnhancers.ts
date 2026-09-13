import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';

import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {CardRenderer} from '../render/CardRenderer';
import {message} from '../../logs/MessageBuilder';
import {addResourceToCard, chip} from '../../inputs/optionMetadata';
import {cardEffect} from '../../inputs/choiceContext';
import {ICard} from '../ICard';
import {Resource} from '../../../common/Resource';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class ViralEnhancers extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.VIRAL_ENHANCERS,
      tags: [Tag.SCIENCE, Tag.MICROBE],
      cost: 9,

      metadata: {

        infoText: [

          {kind: 'effect-short', text: 'Each such tag: gain a plant or add a resource'},

        ],
        cardNumber: '074',
        renderData: CardRenderer.builder((b) => {
          b.tag(Tag.PLANT).slash().tag(Tag.MICROBE).slash().tag(Tag.ANIMAL).br;
          b.effect('When you play a plant, microbe, or an animal tag, including this, gain 1 plant or add 1 resource to THAT CARD.', (eb) => {
            eb.empty().startEffect;
            eb.plants(1).slash().resource(CardResource.MICROBE).asterix().slash().resource(CardResource.ANIMAL).asterix();
          });
        }),
      },
    });
  }

  private addPlant(player: IPlayer, count: number) {
    player.stock.add(Resource.PLANTS, count, {log: true, from: {card: this}});
  }

  public onCardPlayed(player: IPlayer, card: ICard) {
    const resourceCount = player.tags.cardTagCount(card, [Tag.ANIMAL, Tag.PLANT, Tag.MICROBE]);
    if (resourceCount === 0) {
      return undefined;
    }

    if (card.resourceType !== CardResource.ANIMAL && card.resourceType !== CardResource.MICROBE) {
      this.addPlant(player, resourceCount);
      return undefined;
    }

    for (let i = 0; i < resourceCount; i++) {
      player.defer(
        () => new OrOptions(
          new SelectOption(message('Add resource to card ${0}', (b) => b.card(card)), 'Add resource')
            .withMetadata(addResourceToCard(card.resourceType ?? CardResource.MICROBE))
            .andThen(() => {
              player.addResourceTo(card, {log: true});
              return undefined;
            }),
          new SelectOption('Gain plant')
            .withMetadata({kind: 'resourceGain', effects: [chip('gain', 'plants', 1)]})
            .andThen(() => {
              this.addPlant(player, 1);
              return undefined;
            }),
        ).markChoiceContext(cardEffect(this, 'You played a plant, microbe, or animal tag.', 'effect-choice')),
      );
    }
    return undefined;
  }

  public onNonCardTagAdded(player: IPlayer, tag: Tag) {
    if (tag === Tag.PLANT) {
      this.addPlant(player, 1);
    }
  }

  /**
   * Mirrors `onCardPlayed`: a card that cannot hold animals / microbes pays
   * plants outright (one per tag, synchronously); a card that can hold them
   * ASKS per tag — a resource on THAT card, or a plant — deferred at
   * `Priority.DEFAULT` after the card's own action.
   */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const resourceCount = cardOwner.tags.cardTagCount(card, [Tag.ANIMAL, Tag.PLANT, Tag.MICROBE]);
    if (resourceCount === 0) {
      return [];
    }
    const source = forecast.sourceOf(this, cardOwner, 'card-played');
    const reason = 'You play a card with an animal, plant or microbe tag';
    if (card.resourceType !== CardResource.ANIMAL && card.resourceType !== CardResource.MICROBE) {
      return [forecast.exact(source, [actionPreviews.stockGain(cardOwner, Resource.PLANTS, resourceCount)], reason)];
    }
    const facts: Array<EffectForecastFact> = [];
    for (let i = 0; i < resourceCount; i++) {
      facts.push(forecast.asks(source,
        [{...actionPreviews.cardResourceGain(card.resourceType, 1), note: 'on the played card'}],
        [{label: 'Gain plant', effects: [actionPreviews.stockGain(cardOwner, Resource.PLANTS, 1)]}],
        reason, {id: `tag-${i}`, ...forecast.AFTER_CARD}));
    }
    return facts;
  }
}
