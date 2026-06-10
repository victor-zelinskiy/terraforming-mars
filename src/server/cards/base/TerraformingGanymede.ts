import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class TerraformingGanymede extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.TERRAFORMING_GANYMEDE,
      tags: [Tag.JOVIAN, Tag.SPACE],
      cost: 33,
      victoryPoints: 2,

      metadata: {
        cardNumber: '197',
        renderData: CardRenderer.builder((b) => {
          b.tr(1).slash().tag(Tag.JOVIAN);
        }),
        description: 'Raise your TR 1 step for each Jovian tag you have, including this.',
      },
    });
  }

  public computeTr(player: IPlayer) {
    return {tr: 1 + player.tags.count(Tag.JOVIAN)};
  }

  public override bespokePlay(player: IPlayer) {
    player.increaseTerraformRating(this.computeTr(player).tr, {log: true});
    return undefined;
  }

  // The on-play preview: a FIXED, computable TR raise (1 per Jovian tag, incl. this)
  // — show it as a chip in the play modal. No choice, so no steps.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [
      actionPreviews.trGain(player, this.computeTr(player).tr),
    ]);
  }
}
