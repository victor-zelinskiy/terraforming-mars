import {IActionCard} from '../ICard';
import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {SelectCard} from '../../inputs/SelectCard';
import {ICard} from '../ICard';
import {CardRenderer} from '../render/CardRenderer';
import {ActionPreviewStep} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class MoholeLake extends Card implements IActionCard, IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.MOHOLE_LAKE,
      tags: [Tag.BUILDING],
      cost: 31,

      behavior: {
        stock: {plants: 3},
        global: {temperature: 1},
        ocean: {},
      },

      metadata: {
        cardNumber: 'X27',
        renderData: CardRenderer.builder((b) => {
          b.action('Add a microbe or animal to ANOTHER card.', (eb) => {
            eb.empty().startAction.resource(CardResource.MICROBE).asterix();
            eb.nbsp.or().nbsp.resource(CardResource.ANIMAL).asterix();
          }).br;
          b.plants(3).temperature(1).oceans(1);
        }),
        description: 'Gain 3 plants. Raise temperature 1 step, and place 1 ocean tile.',
      },
    });
  }

  public canAct(): boolean {
    return true;
  }

  private availableCards(player: IPlayer): ReadonlyArray<ICard> {
    return player.getResourceCards(CardResource.MICROBE).concat(player.getResourceCards(CardResource.ANIMAL));
  }

  // PRE-COLLECT the microbe-or-animal target card (the SAME `SelectCard` `action()`
  // builds) inside the confirmation modal. Per the fork's no-autoselect principle
  // the picker shows whenever at least one card can hold the resource (even a
  // single candidate), so the player always SEES which card receives it.
  public actionPreview(player: IPlayer) {
    const cards = this.availableCards(player);
    const steps: ReadonlyArray<ActionPreviewStep> = cards.length >= 1 ?
      [actionPreviews.selectCardStep(player, 'Select card to add microbe or animal', 'Add resource', cards, {amount: 1})] :
      [];
    return actionPreviews.singleBranch(this, player, steps);
  }

  public action(player: IPlayer) {
    const availableCards = this.availableCards(player);

    if (availableCards.length === 0) {
      return undefined;
    }

    // Per the no-autoselect principle, ALWAYS ask which card receives the resource
    // — even when only one card can hold a microbe/animal.
    return new SelectCard('Select card to add microbe or animal', 'Add resource', [...availableCards])
      .andThen(([card]) => {
        player.addResourceTo(card, {log: true});
        return undefined;
      });
  }
}
