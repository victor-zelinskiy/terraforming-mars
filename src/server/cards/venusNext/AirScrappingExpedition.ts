import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';
import {SelectCard} from '../../inputs/SelectCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {IProjectCard} from '../IProjectCard';
import {ICard} from '../ICard';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class AirScrappingExpedition extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.AIR_SCRAPPING_EXPEDITION,
      type: CardType.EVENT,
      tags: [Tag.VENUS],
      cost: 13,

      behavior: {
        global: {venus: 1},
      },

      metadata: {
        cardNumber: '215',
        description: 'Raise Venus 1 step. Add 3 floaters to ANY Venus CARD.',
        renderData: CardRenderer.builder((b) => {
          b.venus(1).resource(CardResource.FLOATER, {amount: 3, secondaryTag: Tag.VENUS});
        }),
      },
    });
  }

  private floaterCards(player: IPlayer): ReadonlyArray<ICard> {
    return player.getResourceCards(CardResource.FLOATER)
      .filter((card) => card.tags.some((cardTag) => cardTag === Tag.VENUS));
  }

  public override bespokePlay(player: IPlayer) {
    const floaterCards = this.floaterCards(player);
    if (floaterCards.length === 0) {
      return undefined;
    }

    // Per the fork's no-autoselect principle, ALWAYS ask which card receives the
    // 3 floaters — even when only one Venus floater card is eligible.
    return new SelectCard('Select card to add 3 floaters', 'Add floaters', floaterCards)
      .andThen(([card]) => {
        player.addResourceTo(card, {qty: 3, log: true});
        return undefined;
      });
  }

  // The declarative venus chip + the SAME target picker `bespokePlay` builds, so
  // the 3 floaters' destination is chosen inside the play modal. Per the
  // no-autoselect principle the picker shows whenever there's at least one
  // eligible card (even a single candidate). With NO eligible Venus floater card
  // the 3 floaters can't land anywhere — so SUPPRESS the "+3 floaters" gain chip
  // (it would be a lie) and WARN instead (the no-silent-loss rule; the card is
  // still played for Venus +1).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const cards = this.floaterCards(player);
    const hasTarget = cards.length >= 1;
    const extraEffects = hasTarget ? [actionPreviews.cardResourceGain(CardResource.FLOATER, 3)] : [];
    const step = hasTarget ?
      actionPreviews.selectCardStep(player, 'Select card to add 3 floaters', 'Add floaters', cards, {amount: 3}) :
      actionPreviews.warningNote('No eligible card — this resource is not added.', CardResource.FLOATER);
    return actionPreviews.playPreview(this, player, extraEffects, [step]);
  }
}
