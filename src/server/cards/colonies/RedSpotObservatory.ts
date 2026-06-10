import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class RedSpotObservatory extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 17,
      tags: [Tag.JOVIAN, Tag.SCIENCE],
      name: CardName.RED_SPOT_OBSERVATORY,
      type: CardType.ACTIVE,
      resourceType: CardResource.FLOATER,
      victoryPoints: 2,

      behavior: {
        drawCard: 2,
      },

      requirements: {tag: Tag.SCIENCE, count: 3},
      metadata: {
        cardNumber: 'C32',
        renderData: CardRenderer.builder((b) => {
          b.action('Add 1 floater to this card, or spend 1 floater here to draw a card.', (eb) => {
            eb.empty().arrow().resource(CardResource.FLOATER).or();
            eb.resource(CardResource.FLOATER).startAction.cards(1);
          }).br;
          b.cards(2);
        }),
        description: {
          text: 'Requires 3 science tags. Draw 2 cards.',
          align: 'left',
        },
      },
    });
  }


  public canAct(): boolean {
    return true;
  }

  // Branch order MUST match action(): spend-to-draw first, add second.
  public actionPreview(_player: IPlayer) {
    return actionPreviews.orBranches(this, [
      {
        available: this.resourceCount >= 1,
        title: 'Remove 1 floater on this card to draw a card',
        effects: [actionPreviews.cardCost(this, 1), actionPreviews.drawGain(1)],
        unavailableReason: actionReason.noResourcesHere(),
      },
      {
        available: true,
        title: 'Add 1 floater on this card',
        effects: [actionPreviews.cardGain(this, 1)],
      },
    ]);
  }

  public action(player: IPlayer) {
    if (this.resourceCount < 1) {
      player.addResourceTo(this, 1);
      return undefined;
    }

    const opts = [];

    const addResource = new SelectOption('Add 1 floater on this card', 'Add floater').andThen(() => this.addResource(player));
    const spendResource = new SelectOption('Remove 1 floater on this card to draw a card', 'Remove floater').andThen(() => this.spendResource(player));

    opts.push(spendResource);
    opts.push(addResource);

    return new OrOptions(...opts);
  }

  private addResource(player: IPlayer) {
    player.addResourceTo(this, 1);
    return undefined;
  }

  private spendResource(player: IPlayer) {
    this.resourceCount--;
    player.drawCard();
    return undefined;
  }
}
