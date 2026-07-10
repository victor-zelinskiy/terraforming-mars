import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {CardType} from '../../../common/cards/CardType';
import {IActionCard} from '../ICard';
import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {SelectCardDeferred} from '../../deferredActions/SelectCardDeferred';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {LogHelper} from '../../LogHelper';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as actionPreviews from '../actionPreviews';

export class BioengineeringEnclosure extends Card implements IProjectCard, IActionCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.BIOENGINEERING_ENCLOSURE,
      tags: [Tag.ANIMAL],
      cost: 7,
      resourceType: CardResource.ANIMAL,
      protectedResources: true,

      behavior: {
        addResources: 2,
      },

      requirements: {tag: Tag.SCIENCE},
      metadata: {
        description: 'Requires 1 science tag to play. Add 2 animals to this card. OTHERS MAY NOT REMOVE ANIMALS FROM THIS CARD.',
        cardNumber: 'A01',
        renderData: CardRenderer.builder((b) => {
          b.action('Remove 1 animal from THIS card to add 1 animal to ANOTHER card.', (eb) => {
            eb.resource(CardResource.ANIMAL).asterix().startAction.resource(CardResource.ANIMAL).asterix();
          }).br;
          b.resource(CardResource.ANIMAL, 2);
        }),
      },
    });
  }

  private availableCards(player: IPlayer) {
    return player.getResourceCards(this.resourceType).filter((card) => card.name !== this.name);
  }

  public canAct(player: IPlayer): boolean {
    return this.resourceCount > 0 && this.availableCards(player).length > 0;
  }

  // Co-located reason (next to `canAct`) for the ДЕЙСТВИЯ overlay's "why can't I
  // activate" popover. Name the ONE concrete blocker, never an "X or Y" combo.
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.resourceCount === 0) {
      return {type: 'count', message: 'No animals on this card to move'};
    }
    if (this.availableCards(player).length === 0) {
      return {type: 'target', message: 'No other card to receive an animal'};
    }
    return undefined;
  }

  // Remove 1 animal from THIS card (cost chip) → add 1 to ANOTHER card, chosen in
  // the confirm modal / composer (never a bare confirm). Mirrors action()'s
  // SelectCardDeferred over `availableCards`.
  public actionPreview(player: IPlayer) {
    const available = this.canAct(player);
    return actionPreviews.singleBranch(this, player, available ? [
      actionPreviews.selectCardStep(player, 'Select card to add 1 animal', 'Add animal', this.availableCards(player), {
        amount: 1,
      }),
    ] : [], [
      actionPreviews.cardCost(this, 1),
    ], {unavailableReason: this.actionUnavailableReason(player)});
  }

  public action(player: IPlayer) {
    player.game.defer(
      new SelectCardDeferred(
        player,
        this.availableCards(player),
        {
          title: 'Select card to add 1 animal',
          buttonLabel: 'Add animal',
        },
      ))
      .andThen((card) => {
        this.resourceCount--;
        player.addResourceTo(card, 1);
        LogHelper.logMoveResource(player, CardResource.ANIMAL, this, card);
      });
    return undefined;
  }
}
