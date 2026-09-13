import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectCard} from '../../inputs/SelectCard';
import {SelectOption} from '../../inputs/SelectOption';
import {skip} from '../../inputs/optionMetadata';
import {cardEffect} from '../../inputs/choiceContext';
import {cardDiscard, discardForCards} from '../../inputs/discardPrompt';
import {CardName} from '../../../common/cards/CardName';
import {Priority} from '../../deferredActions/Priority';
import {CardRenderer} from '../render/CardRenderer';
import {ICard} from '../ICard';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastContext} from '../EffectForecastContext';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class MarsUniversity extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.MARS_UNIVERSITY,
      tags: [Tag.SCIENCE, Tag.BUILDING],
      cost: 8,
      victoryPoints: 1,

      metadata: {
        cardNumber: '073',
        infoText: [{kind: 'effect-short', text: 'Science tag: may swap a hand card for a new one'}],
        renderData: CardRenderer.builder((b) => {
          b.effect('When you play a science tag, including this, you may discard a card from hand to draw a card.', (eb) => {
            eb.tag(Tag.SCIENCE).startEffect.minus().cards(1).nbsp.plus().cards(1);
          });
        }),
      },
    });
  }

  public onCardPlayed(player: IPlayer, card: ICard) {
    const scienceTags = player.tags.cardTagCount(card, Tag.SCIENCE);
    this.onScienceTagAdded(player, scienceTags);
  }
  /**
   * Mirrors `onCardPlayed` + `onScienceTagAdded`: one QUESTION per science tag
   * (discard a card to draw one, or do nothing), asked at
   * `Priority.DISCARD_AND_DRAW` — after the card's own choices. The live
   * prompt is skipped with an empty hand; at forecast time the played card is
   * still in that hand, so the hand AFTER the play is what decides.
   */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard, ctx: EffectForecastContext): ReadonlyArray<EffectForecastFact> {
    const scienceTags = cardOwner.tags.cardTagCount(card, Tag.SCIENCE);
    if (scienceTags === 0) {
      return [];
    }
    const source = forecast.sourceOf(this, cardOwner, 'card-played');
    const fromHand = ctx.operation === 'play' && cardOwner.cardsInHand.some((c) => c.name === card.name);
    const handAfter = cardOwner.cardsInHand.length - (fromHand ? 1 : 0);
    const facts: Array<EffectForecastFact> = [];
    for (let i = 0; i < scienceTags; i++) {
      if (handAfter === 0) {
        facts.push(forecast.skipped(source,
          [{direction: 'cost', icon: 'cards', amount: 1}, actionPreviews.drawGain(1)],
          'No other card in hand to discard',
          {id: `science-${i}`, reasonTag: Tag.SCIENCE}));
        continue;
      }
      facts.push(forecast.asks(source,
        [{direction: 'cost', icon: 'cards', amount: 1}, actionPreviews.drawGain(1)],
        [{label: 'Do nothing', effects: []}],
        forecast.tagReason(Tag.SCIENCE),
        {id: `science-${i}`, reasonTag: Tag.SCIENCE, sequence: Priority.DISCARD_AND_DRAW, timing: 'after-card'}));
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
        // No card to discard
        if (player.cardsInHand.length === 0) {
          return undefined;
        }
        return new OrOptions(
          new SelectCard('Select a card to discard', 'Discard', player.cardsInHand)
            // The pick is a DISCARD, not a generic card choice: the marker sends
            // it to the console's hand overlay in discard mode (with the card
            // it buys back shown as the exchange) instead of a flat grid.
            .markDiscardPrompt(cardDiscard(this, {min: 1, max: 1}, {exchange: discardForCards(1)}))
            .andThen(([card]) => {
              player.game.log('${0} is using their ${1} effect to draw a card by discarding a card.', (b) => b.player(player).card(this));
              player.discardCardFromHand(card, {log: true});
              player.drawCard();
              return undefined;
            }),
          new SelectOption('Do nothing').withMetadata(skip()),
        ).markChoiceContext(cardEffect(this, 'You played a science tag.', 'optional-effect'));
      },
      Priority.DISCARD_AND_DRAW);
    }
    return undefined;
  }
}
