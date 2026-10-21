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

/** The tags the contract pays for — the hook's count and the forecast's parts read the same list. */
const GMO_TAGS = [Tag.ANIMAL, Tag.PLANT, Tag.MICROBE];

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
    const amount = player.tags.cardTagCount(card, GMO_TAGS);
    if (amount > 0) {
      player.defer(() => player.stock.add(Resource.MEGACREDITS, amount * 2, {log: true}));
    }
  }
  /**
   * Mirrors `onCardPlayed`: 2 M€ per matching tag (Decomposers' count), deferred
   * through `player.defer` at `Priority.DEFAULT` — after the card's own choices.
   * ONE FACT PER MATCHING PRINTED TAG (Mars University's science shape): each
   * tag pays its own 2 M€ and names itself (`reasonTag`), so the play scene
   * births each answer on the tag of the landed card that woke it. The card is
   * a reactor of its own play («including this»), so its composer forecasts
   * the +2 of its own microbe tag.
   */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const count = cardOwner.tags.cardTagCount(card, GMO_TAGS);
    if (count === 0) {
      return [];
    }
    const source = forecast.sourceOf(this, cardOwner, 'card-played');
    const printed = card.tags.filter((tag) => GMO_TAGS.includes(tag));
    // The hook's own count decides the total; the printed tags are its parts (always equal for these three tags).
    const parts = printed.length === count ? printed : [undefined];
    return parts.map((tag, i) => forecast.exact(source,
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, tag === undefined ? count * 2 : 2)],
      tag === undefined ? 'You play a card with an animal, plant or microbe tag' : forecast.tagReason(tag),
      {...forecast.AFTER_CARD, id: `gmo-${i}`, ...(tag !== undefined ? {reasonTag: tag} : {})}));
  }
}
