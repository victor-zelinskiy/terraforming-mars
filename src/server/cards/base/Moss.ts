import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Resource} from '../../../common/Resource';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class Moss extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.MOSS,
      tags: [Tag.PLANT],
      cost: 4,

      behavior: {
        production: {plants: 1},
      },

      requirements: {oceans: 3},
      metadata: {
        cardNumber: '122',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.plants(1)).nbsp.minus().plants(1);
        }),
        description: 'Requires 3 ocean tiles and that you lose 1 plant. Increase your plant production 1 step.',
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    const hasViralEnhancers = player.tableau.get(CardName.VIRAL_ENHANCERS);
    const hasEnoughPlants = player.plants >= 1 || hasViralEnhancers !== undefined || player.tableau.has(CardName.MANUTECH);

    return hasEnoughPlants;
  }
  public override bespokePlay(player: IPlayer) {
    player.plants--;
    return undefined;
  }

  // The on-play preview: `playPreview` auto-includes the declarative +1 plant
  // production chip; we add the bespoke 1-plant COST (`bespokePlay`'s
  // `player.plants--`, not in `behavior`) so the modal shows the full trade.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [
      actionPreviews.stockCost(player, Resource.PLANTS, 1),
    ]);
  }
}

