import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {sum} from '../../../common/utils/utils';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class MediaArchives extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.MEDIA_ARCHIVES,
      tags: [Tag.EARTH],
      cost: 8,

      metadata: {
        cardNumber: '107',
        renderData: CardRenderer.builder((b) => {
          b.megacredits(1).slash().tag(Tag.EVENT, {all});
        }),
        description: 'Gain 1 M€ for each event EVER PLAYED by all players.',
      },
    });
  }

  // Shared by `bespokePlay` and the on-play preview (1 M€ per event ever played by
  // any player) so the previewed gain can't drift from what's applied.
  private megacreditGain(player: IPlayer): number {
    return sum(player.game.players.map((p) => p.getPlayedEventsCount()));
  }

  public override bespokePlay(player: IPlayer) {
    player.stock.add(Resource.MEGACREDITS, this.megacreditGain(player), {log: true});
    return undefined;
  }

  // The on-play preview: a FIXED, computable M€ gain — show it as a chip in the
  // play modal. No choice, so no steps.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [
      actionPreviews.stockGain(player, Resource.MEGACREDITS, this.megacreditGain(player)),
    ]);
  }
}
