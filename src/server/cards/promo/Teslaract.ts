import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IActionCard} from '../ICard';
import {Units} from '../../../common/Units';
import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class Teslaract extends Card implements IActionCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.TESLARACT,
      cost: 14,
      tags: [Tag.POWER, Tag.BUILDING],

      behavior: {
        tr: 1,
      },

      metadata: {
        cardNumber: 'X66',
        renderData: CardRenderer.builder((b) => {
          b.action('Spend 1 energy production to gain 1 plant production.',
            (ab) => ab.production((pb) => pb.energy(1)).startAction.production((pb) => pb.plants(1)));
          b.br;
          b.tr(1);
        }),
        description: 'Raise your TR 1 step.',
      },
    });
  }

  canAct(player: IPlayer): boolean {
    return player.production.energy > 0;
  }
  actionUnavailableReason() {
    return actionReason.noEnergyProduction();
  }

  public actionPreview(player: IPlayer) {
    return actionPreviews.singleBranch(this, player, [], [
      actionPreviews.productionChange(player, Resource.ENERGY, -1),
      actionPreviews.productionChange(player, Resource.PLANTS, 1),
    ]);
  }

  action(player: IPlayer): undefined {
    player.production.adjust(Units.of({energy: -1, plants: 1}));
    return undefined;
  }
}
