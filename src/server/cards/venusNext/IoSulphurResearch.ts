import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {digit} from '../Options';
import {IProjectCard} from '../IProjectCard';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class IoSulphurResearch extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.IO_SULPHUR_RESEARCH,
      type: CardType.AUTOMATED,
      tags: [Tag.SCIENCE, Tag.JOVIAN],
      cost: 17,

      victoryPoints: 2,

      metadata: {
        cardNumber: '232',
        renderData: CardRenderer.builder((b) => {
          b.cards(1).br;
          b.or().br;
          b.tag(Tag.VENUS, {amount: 3, digit}).colon().cards(3);
        }),
        description: 'Draw 1 card, or draw 3 if you have at least 3 Venus tags.',
      },
    });
  }

  // Shared by `bespokePlay` and the on-play preview (3 cards with ≥3 Venus tags,
  // else 1) so the previewed draw count can't drift from what's drawn.
  private cardsToDraw(player: IPlayer): number {
    return player.tags.count(Tag.VENUS) >= 3 ? 3 : 1;
  }

  public override bespokePlay(player: IPlayer) {
    player.drawCard(this.cardsToDraw(player));
    return undefined;
  }

  // The on-play preview: the draw count is FIXED at play time (the Venus-tag
  // threshold is already met or not) — show it as a "+N draw" chip in the play
  // modal. No choice, so no steps.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [
      actionPreviews.drawGain(this.cardsToDraw(player)),
    ]);
  }
}
