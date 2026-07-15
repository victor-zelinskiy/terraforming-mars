import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {DecreaseAnyProduction} from '../../deferredActions/DecreaseAnyProduction';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {GainProduction} from '../../deferredActions/GainProduction';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class GreatEscarpmentConsortium extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.GREAT_ESCARPMENT_CONSORTIUM,
      cost: 6,

      requirements: {production: Resource.STEEL, count: 1},
      metadata: {
        cardNumber: '061',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => {
            pb.minus().steel(-1, {all}).br;
            pb.plus().steel(1);
          });
        }),
        description: 'Requires that you have steel production. Decrease any steel production 1 step and increase your own 1 step.',
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(
      new DecreaseAnyProduction(player, Resource.STEEL, {count: 1, stealing: true}));
    player.game.defer(new GainProduction(player, Resource.STEEL, {count: 1, log: true}));
    return undefined;
  }

  // A "+1 your steel production" chip + the SAME target picker the decrease
  // defers, so the player chooses WHOSE steel production to reduce in the modal.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const step = actionPreviews.targetStepOrWarning(player,
      actionPreviews.inputStep(
        new DecreaseAnyProduction(player, Resource.STEEL, {count: 1, stealing: true}).previewSelectPlayer()),
      'No production can be reduced.',
      {
        label: actionPreviews.SKIPPED_LABEL.reduceProduction,
        effect: actionPreviews.skippedAttackChip(Resource.STEEL, 1, 'production'),
      });
    return actionPreviews.playPreview(this, player, [actionPreviews.productionChange(player, Resource.STEEL, 1)], [step]);
  }
}
