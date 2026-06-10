import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../../cards/render/CardRenderer';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class InterplanetaryTrade extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.INTERPLANETARY_TRADE,
      tags: [Tag.SPACE],
      cost: 27,
      victoryPoints: 1,

      metadata: {
        cardNumber: 'X05',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.megacredits(1));
          b.slash().diverseTag();
        }),
        description: 'Increase your M€ production 1 step per different tag you have in play, including this.',
      },
    });
  }

  // Shared by `bespokePlay` and the on-play preview so the previewed M€ production
  // gain can't drift from what the play actually applies.
  private megacreditProductionGain(player: IPlayer): number {
    return player.tags.distinctCount('default', Tag.SPACE);
  }

  public override bespokePlay(player: IPlayer) {
    player.production.add(Resource.MEGACREDITS, this.megacreditProductionGain(player), {log: true});
    return undefined;
  }

  // The on-play preview: the M€ production raise (1 per distinct tag in play) is a
  // FIXED, computable result — show it as a `current → resulting` chip in the play
  // modal instead of leaving the player to guess. No choice, so no steps.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [
      actionPreviews.productionChange(player, Resource.MEGACREDITS, this.megacreditProductionGain(player)),
    ]);
  }
}
