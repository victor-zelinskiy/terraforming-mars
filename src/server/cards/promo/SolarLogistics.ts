import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';
import {all} from '../Options';
import {IProjectCard} from '../IProjectCard';
import {ICard} from '../ICard';
import {ExternalDrawIntake} from '../../deferredActions/ExternalDrawIntake';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class SolarLogistics extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.SOLAR_LOGISTICS,
      cost: 20,
      tags: [Tag.EARTH, Tag.SPACE],

      behavior: {
        stock: {titanium: 2},
      },
      victoryPoints: 1,
      cardDiscount: {tag: Tag.EARTH, amount: 2},

      metadata: {
        cardNumber: 'X63',
        renderData: CardRenderer.builder((b) => {
          b.effect('When you play an Earth tag, you pay 2 M€ less.',
            (eb) => eb.tag(Tag.EARTH).startEffect.megacredits(-2));
          b.br;
          b.effect('When any player plays a space event, draw a card.',
            (eb) => eb.tag(Tag.SPACE, {all}).tag(Tag.EVENT, {all}).startEffect.cards(1));
          b.br;
          b.titanium(2);
        }),
        description: 'Gain 2 titanium.',
      },
    });
  }

  public onCardPlayedByAnyPlayer(thisCardOwner: IPlayer, card: ICard, activePlayer: IPlayer) {
    if (card.type === CardType.EVENT && card.tags.includes(Tag.SPACE)) {
      // The REAL execution context decides the presentation, never a name
      // check: our own space event keeps the ordinary draw (the play flow the
      // owner is inside claims it), while a FOREIGN trigger — another human's
      // play or a MarsBot card resolution — routes through the mandatory
      // external-draw intake, so the card never lands in an unwatched hand.
      if (activePlayer !== thisCardOwner) {
        ExternalDrawIntake.grant(thisCardOwner, 1, {
          effectCard: this,
          effectCardOwner: 'you',
          initiator: activePlayer,
          triggerCard: card,
        });
      } else {
        thisCardOwner.drawCard(1);
      }
    }
    return undefined;
  }

  /**
   * Mirrors `onCardPlayedByAnyPlayer`: a SPACE EVENT draws the OWNER one card
   * at once — through the mandatory intake when somebody else played it. The
   * two «almost» cases are stated as `no` facts. (The Earth-tag discount is a
   * DISCOUNT — the forecast engine reports it off `getCardCostBreakdown`.)
   */
  public cardPlayedForecast(cardOwner: IPlayer, activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const source = forecast.sourceOf(this, cardOwner, 'card-played-by-any');
    const recipient = forecast.recipientOf(activePlayer, cardOwner);
    const isEvent = card.type === CardType.EVENT;
    const hasSpace = card.tags.includes(Tag.SPACE);
    if (isEvent && hasSpace) {
      return [forecast.exact(source, [actionPreviews.drawGain(1)], 'Any player plays a space event', {
        reasonTag: Tag.SPACE,
        recipient,
        note: activePlayer.id === cardOwner.id ? undefined : 'Delivered through the card intake prompt',
      })];
    }
    if (hasSpace) {
      return [forecast.no(source, 'The card is not an event', {reasonTag: Tag.SPACE, recipient})];
    }
    if (isEvent) {
      return [forecast.no(source, 'The event has no space tag', {reasonTag: Tag.SPACE, recipient})];
    }
    return [];
  }
}

