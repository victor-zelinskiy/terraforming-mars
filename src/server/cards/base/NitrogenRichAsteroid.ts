import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class NitrogenRichAsteroid extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.NITROGEN_RICH_ASTEROID,
      tags: [Tag.SPACE],
      cost: 31,

      behavior: {
        global: {temperature: 1},
        tr: 2,
      },

      metadata: {

        // Order MUST follow the render (row 0 = plant production, row 1 = TR +
        // temperature); the player reads sequence from the card top-to-bottom.
        infoText: [
          {text: 'Increase your plant production 1 step, or 4 steps if you have at least 3 plant tags.', tokens: ['production(']},
          {text: 'Raise your terraform rating 2 steps.', tokens: ['tr']},
          {text: 'Raise the temperature 1 step.', tokens: ['temperature']},
        ],
        cardNumber: '037',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => {
            pb.plants(1).nbsp.or().br;
            pb.tag(Tag.PLANT, {amount: 3, digit}).colon().nbsp.plants(4, {digit});
          }).br;
          b.tr(2).temperature(1);
        }),
        description: 'Raise your terraforming rating 2 steps and temperature 1 step. Increase your plant production 1 step, or 4 steps if you have 3 plant tags.',
      },
    });
  }

  // The plant production raise (1, or 4 with ≥3 plant tags) lives in bespokePlay,
  // NOT in `behavior` (which only carries the temperature + TR). Shared with the
  // preview so the chip can't drift from what's applied.
  private plantProductionGain(player: IPlayer): number {
    return player.tags.count(Tag.PLANT) < 3 ? 1 : 4;
  }

  public override bespokePlay(player: IPlayer) {
    player.production.add(Resource.PLANTS, this.plantProductionGain(player), {log: true});
    return undefined;
  }

  // The on-play preview: `playPreview` auto-includes the declarative chips
  // (temperature + TR), and we add the bespoke plant-production raise so the modal
  // shows the FULL on-play result, not just the part the behavior DSL covers.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [
      actionPreviews.productionChange(player, Resource.PLANTS, this.plantProductionGain(player)),
    ]);
  }
}
