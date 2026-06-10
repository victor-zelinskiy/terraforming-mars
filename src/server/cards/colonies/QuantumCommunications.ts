import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {Size} from '../../../common/cards/render/Size';
import {all} from '../Options';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class QuantumCommunications extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 8,
      name: CardName.QUANTUM_COMMUNICATIONS,
      type: CardType.AUTOMATED,
      requirements: {tag: Tag.SCIENCE, count: 4},
      victoryPoints: 1,

      metadata: {
        cardNumber: 'C31',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => {
            pb.megacredits(1).slash().colonies(1, {size: Size.SMALL, all});
          });
        }),
        description: 'Requires 4 science tags. Increase your M€ production 1 step for each colony in play.',
      },
    });
  }

  // Shared by `bespokePlay` and the on-play preview (1 M€ prod per colony in play)
  // so the previewed gain can't drift from what's applied.
  private megacreditProductionGain(player: IPlayer): number {
    let coloniesCount = 0;
    player.game.colonies.forEach((colony) => {
      coloniesCount += colony.colonies.length;
    });
    return coloniesCount;
  }

  public override bespokePlay(player: IPlayer) {
    player.production.add(Resource.MEGACREDITS, this.megacreditProductionGain(player), {log: true});
    return undefined;
  }

  // The on-play preview: a FIXED, computable M€ production raise (1 per colony in
  // play) — show it as a `current → resulting` chip in the play modal. No choice.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [
      actionPreviews.productionChange(player, Resource.MEGACREDITS, this.megacreditProductionGain(player)),
    ]);
  }
}
