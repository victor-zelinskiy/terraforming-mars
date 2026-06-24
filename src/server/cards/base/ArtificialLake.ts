import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';

export class ArtificialLake extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.ARTIFICIAL_LAKE,
      tags: [Tag.BUILDING],
      cost: 15,
      victoryPoints: 1,

      behavior: {
        ocean: {on: 'land'},
      },

      requirements: {temperature: -6},
      metadata: {
        description: 'Requires -6 C or warmer. Place 1 ocean tile ON AN AREA NOT RESERVED FOR OCEAN.',
        cardNumber: '116',
        renderData: CardRenderer.builder((b) => b.oceans(1).asterix()),
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions) {
    // This is not covered in executor.
    if (!player.game.canAddOcean()) {
      return true;
    } // Card is playable, it just has no effect.
    return player.game.board.getAvailableSpacesOnLand(player, canAffordOptions).length > 0;
  }

  // The ocean-on-land placement isn't covered by the generic explainer (it checks
  // `behavior.tile`, not `behavior.ocean`). When oceans aren't maxed the only
  // residual blocker is "no land space" — name it.
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (player.game.canAddOcean() && player.game.board.getAvailableSpacesOnLand(player).length === 0) {
      return reason.placementReason('No space available for the tile');
    }
    return undefined;
  }
}
