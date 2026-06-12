import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';
import {SelectCard} from '../../inputs/SelectCard';
import {ICard} from '../ICard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class VenusianPlants extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.VENUSIAN_PLANTS,
      cost: 13,
      tags: [Tag.VENUS, Tag.PLANT],

      requirements: {venus: 16},
      victoryPoints: 1,

      behavior: {
        global: {venus: 1},
      },

      metadata: {
        cardNumber: '261',
        renderData: CardRenderer.builder((b) => {
          b.venus(1).br.br; // intentional double br
          b.resource(CardResource.MICROBE, {secondaryTag: Tag.VENUS}).nbsp;
          b.or().nbsp.resource(CardResource.ANIMAL, {secondaryTag: Tag.VENUS});
        }),
        description: {
          text: 'Requires Venus 16%. Raise Venus 1 step. Add 1 microbe or 1 animal to ANOTHER VENUS CARD',
          align: 'left',
        },
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    const cards = this.getResCards(player);
    if (cards.length === 0) {
      return undefined;
    }

    // Per the fork's no-autoselect principle, ALWAYS ask which card receives the
    // resource — even when only one Venus card is eligible.
    return new SelectCard(
      'Select card to add 1 resource',
      'Add resource',
      cards)
      .andThen(([card]) => {
        player.addResourceTo(card, {log: true});
        return undefined;
      });
  }

  public getResCards(player: IPlayer): ICard[] {
    let resourceCards = player.getResourceCards(CardResource.MICROBE);
    resourceCards = resourceCards.concat(player.getResourceCards(CardResource.ANIMAL));
    return resourceCards.filter((card) => card.tags.includes(Tag.VENUS));
  }

  // The on-play preview: the declarative venus chip + the SAME SelectCard target
  // picker `bespokePlay` builds, so the player picks WHERE the resource goes
  // inside the play modal. Per the no-autoselect principle the picker shows
  // whenever there's at least one eligible card (even a single candidate).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const cards = this.getResCards(player);
    const step = cards.length >= 1 ?
      actionPreviews.selectCardStep(player, 'Select card to add 1 resource', 'Add resource', cards, {amount: 1}) :
      undefined;
    return actionPreviews.playPreview(this, player, [], [step]);
  }
}
