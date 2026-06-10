import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Phase} from '../../../common/Phase';
import {ICard} from '../ICard';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class Decomposers extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.DECOMPOSERS,
      tags: [Tag.MICROBE],
      cost: 5,

      resourceType: CardResource.MICROBE,
      victoryPoints: {resourcesHere: {}, per: 3},
      requirements: {oxygen: 3},

      metadata: {
        cardNumber: '131',
        description: 'Requires 3% oxygen.',
        renderData: CardRenderer.builder((b) => {
          b.effect('When you play an animal, plant, or microbe tag, including this, add a microbe to this card.', (be) => {
            be.tag(Tag.ANIMAL).slash();
            be.tag(Tag.PLANT).slash();
            be.tag(Tag.MICROBE);
            be.startEffect.resource(CardResource.MICROBE);
          }).br;
          b.vpText('1 VP per 3 microbes on this card.');
        }),
      },
    });
  }
  public onCardPlayed(player: IPlayer, card: ICard): void {
    const qty = player.tags.cardTagCount(card, [Tag.ANIMAL, Tag.PLANT, Tag.MICROBE]);
    player.addResourceTo(this, {qty, log: true});
  }
  public onNonCardTagAdded(player: IPlayer, tag: Tag): void {
    if (tag === Tag.PLANT) {
      player.addResourceTo(this, {qty: 1, log: true});
    }
  }
  // The 2-microbe bonus only triggers when Decomposers is played during the
  // preludes phase immediately after Ecology Experts. Shared by `bespokePlay` and
  // the on-play preview so the chip can't drift from what's applied (0 in normal
  // hand play → no chip; 2 in the prelude path → a "+2 microbe" chip).
  private ecologyExpertsBonus(player: IPlayer): number {
    return (player.game.phase === Phase.PRELUDES && player.playedCards.last()?.name === CardName.ECOLOGY_EXPERTS) ? 2 : 0;
  }

  public override bespokePlay(player: IPlayer) {
    const bonus = this.ecologyExpertsBonus(player);
    if (bonus > 0) {
      player.addResourceTo(this, {qty: bonus, log: true});
    }
    return undefined;
  }

  // The on-play preview: the conditional Ecology-Experts bonus is computable at
  // play time — show the "+N microbe on this card" chip when it applies, nothing
  // otherwise. No choice, so no steps.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const bonus = this.ecologyExpertsBonus(player);
    return actionPreviews.playPreview(this, player, bonus > 0 ? [actionPreviews.cardGain(this, bonus)] : []);
  }
}
