import {IProjectCard} from '../IProjectCard';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {Card} from '../Card';
import {CardRenderer} from '../render/CardRenderer';
import {ActionEffect, ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class CommunityServices extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 13,
      name: CardName.COMMUNITY_SERVICES,
      type: CardType.AUTOMATED,
      victoryPoints: 1,

      metadata: {
        cardNumber: 'C04',
        description: 'Increase your M€ production 1 step per CARD WITH NO TAGS, including this.',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => {
            pb.megacredits(1);
          }).slash().noTags();
        }),
      },
    });
  }

  // Shared by `bespokePlay` and the on-play preview (1 M€ prod per no-tag card,
  // incl. this) so the previewed gain can't drift from what's applied.
  private megacreditProductionGain(player: IPlayer): number {
    return player.tags.numberOfCardsWithNoTags() + 1;
  }

  public override bespokePlay(player: IPlayer) {
    player.production.add(Resource.MEGACREDITS, this.megacreditProductionGain(player), {log: true});
    return undefined;
  }

  // The COUNTED play — the raise with what it counted (the cards with no tags,
  // this one included): the hand tile's plate, the composer's chip and its
  // «ПОЧЕМУ» are this one reading.
  public countedPlayForecast(player: IPlayer): ReadonlyArray<ActionEffect> {
    const cards = this.megacreditProductionGain(player);
    return [actionPreviews.counted(actionPreviews.productionChange(player, Resource.MEGACREDITS, cards), {count: cards, label: 'Cards with no tags'})];
  }

  // The on-play preview: a FIXED, computable M€ production raise — show it as a
  // `current → resulting` chip in the play modal. No choice, so no steps.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, this.countedPlayForecast(player));
  }
}
