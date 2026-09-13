import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {Priority} from '../../deferredActions/Priority';
import {CardRenderer} from '../render/CardRenderer';
import {ICard} from '../ICard';
import {addResourceToCard, removeResourceFromCard, chip} from '../../inputs/optionMetadata';
import {cardEffect} from '../../inputs/choiceContext';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class OlympusConference extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.OLYMPUS_CONFERENCE,
      tags: [Tag.SCIENCE, Tag.EARTH, Tag.BUILDING],
      cost: 10,
      resourceType: CardResource.SCIENCE,
      victoryPoints: 1,

      metadata: {

        infoText: [

          {kind: 'effect', text: 'When you play a science tag, including this, either add a science resource to this card, or remove a science resource from it to draw a card.', tokens: ['tag-science']},

          {kind: 'effect-short', text: 'Science tag: add science here, or spend it to draw'},

        ],
        cardNumber: '185',
        renderData: CardRenderer.builder((b) => {
          b.tag(Tag.SCIENCE).colon().resource(CardResource.SCIENCE).br;
          b.or().br;
          b.minus().resource(CardResource.SCIENCE).plus().cards(1);
        }),
        description: 'When you play a science tag, including this, either add a science resource to this card, or remove a science resource from this card to draw a card.',
      },
    });
  }


  public onCardPlayed(player: IPlayer, card: ICard) {
    const scienceTags = player.tags.cardTagCount(card, Tag.SCIENCE);
    this.onScienceTagAdded(player, scienceTags);
  }
  /**
   * Mirrors `onCardPlayed` + `onScienceTagAdded`: per science tag, the SAME
   * test the deferred callback makes — at ZERO science the resource is added
   * without a question, at one or more the player is ASKED (remove one to
   * draw, or add one), at `Priority.OLYMPUS_CONFERENCE` — before the card's
   * own choices. Two tags are walked in order: the first may add silently and
   * the second then asks, exactly as the two lazy callbacks resolve.
   */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const scienceTags = cardOwner.tags.cardTagCount(card, Tag.SCIENCE);
    if (scienceTags === 0) {
      return [];
    }
    const source = forecast.sourceOf(this, cardOwner, 'card-played');
    const facts: Array<EffectForecastFact> = [];
    let stored = this.resourceCount;
    for (let i = 0; i < scienceTags; i++) {
      if (stored === 0) {
        facts.push(forecast.exact(source,
          [{...actionPreviews.cardGain(this, 1), current: stored, resulting: stored + 1}],
          'You play a card with a ${0} tag',
          {id: `science-${i}`, reasonTag: Tag.SCIENCE, sequence: Priority.OLYMPUS_CONFERENCE, timing: 'before-card-choices'}));
        stored++;
        continue;
      }
      facts.push(forecast.asks(source,
        [{...actionPreviews.cardCost(this, 1), current: stored, resulting: stored - 1}, actionPreviews.drawGain(1)],
        [{label: 'Add a science resource to this card', effects: [{...actionPreviews.cardGain(this, 1), current: stored, resulting: stored + 1}]}],
        'You play a card with a ${0} tag',
        {id: `science-${i}`, reasonTag: Tag.SCIENCE, sequence: Priority.OLYMPUS_CONFERENCE}));
    }
    return facts;
  }
  public onNonCardTagAdded(player: IPlayer, tag: Tag) {
    if (tag === Tag.SCIENCE) {
      this.onScienceTagAdded(player, 1);
    }
  }
  public onScienceTagAdded(player: IPlayer, count: number) {
    for (let i = 0; i < count; i++) {
      player.defer(() => {
        // Can't remove a resource
        if (this.resourceCount === 0) {
          player.addResourceTo(this, {log: true});
          return undefined;
        }
        return new OrOptions(
          new SelectOption('Remove a science resource from this card to draw a card', 'Remove resource')
            .withMetadata({...removeResourceFromCard(CardResource.SCIENCE), effects: [chip('gain', 'cards', 1)]})
            .andThen(() => {
              player.removeResourceFrom(this, 1, {log: false});
              player.game.log('${0} removed a resource from ${1} to draw a card', (b) => b.player(player).card(this));
              player.drawCard();
              return undefined;
            }),
          new SelectOption('Add a science resource to this card', 'Add resource')
            .withMetadata(addResourceToCard(CardResource.SCIENCE))
            .andThen(() => {
              player.addResourceTo(this, {log: true});
              return undefined;
            }),
        ).setTitle('Select an option for Olympus Conference')
          .markChoiceContext(cardEffect(this, 'A science tag was played.', 'effect-choice'));
      },
      Priority.OLYMPUS_CONFERENCE); // Unshift that deferred action
    }
    return undefined;
  }
}
