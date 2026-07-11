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
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';

export class Potatoes extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.POTATOES,
      tags: [Tag.PLANT],
      cost: 2,

      behavior: {
        production: {megacredits: 2},
      },

      metadata: {

        infoText: [

          {text: 'Lose 2 plants.', tokens: ['plants']},

          {text: 'Increase your M€ production 2 steps.', tokens: ['production(']},

        ],
        cardNumber: 'X28',
        renderData: CardRenderer.builder((b) => {
          b.minus().plants(2).nbsp.production((pb) => pb.megacredits(2));
        }),
        description: 'Lose 2 plants. Increase your M€ production 2 steps.',
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    const viralEnhancers = player.tableau.get(CardName.VIRAL_ENHANCERS);
    const hasEnoughPlants = player.plants >= 2 || player.plants >= 1 && viralEnhancers !== undefined;

    return hasEnoughPlants;
  }

  // The bespoke "lose 2 plants" cost isn't in `behavior`. Only surface it when
  // plants are actually the blocker (Viral Enhancers lowers the threshold to 1).
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    const viralEnhancers = player.tableau.has(CardName.VIRAL_ENHANCERS);
    if (player.plants >= 2 || (player.plants >= 1 && viralEnhancers)) {
      return undefined;
    }
    return reason.notEnoughPlants(player);
  }

  public override bespokePlay(player: IPlayer) {
    player.plants -= 2;
    return undefined;
  }

  // The on-play preview: `playPreview` auto-includes the declarative +2 M€
  // production chip; we add the bespoke 2-plant COST (`bespokePlay`'s
  // `player.plants -= 2`, not in `behavior`) so the modal shows the full trade.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [
      actionPreviews.stockCost(player, Resource.PLANTS, 2),
    ]);
  }
}
