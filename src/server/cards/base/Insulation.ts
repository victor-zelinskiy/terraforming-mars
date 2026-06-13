import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {SelectAmount} from '../../inputs/SelectAmount';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class Insulation extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.INSULATION,
      cost: 2,

      metadata: {
        cardNumber: '152',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => {
            pb.text('-X').heat(1).nbsp.text('+').megacredits(1, {text: 'x'});
          });
        }),
        description: 'Decrease your heat production any number of steps and increase your M€ production the same number of steps.',
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer) {
    return player.production.heat >= 1;
  }

  // The conversion hint (heat production → M€ production) drives the modern
  // stepper's rich composition + live per-side production preview.
  private static readonly CONVERSION = {from: 'heat', to: 'megacredits', fromScope: 'production', toScope: 'production'} as const;

  public override bespokePlay(player: IPlayer) {
    return new SelectAmount('Select amount of heat production to decrease', 'Decrease', 1, player.production.heat, undefined,
      {icon: 'heat', conversion: Insulation.CONVERSION})
      .andThen((amount) => {
        player.production.add(Resource.HEAT, -amount, {log: true});
        player.production.add(Resource.MEGACREDITS, amount, {log: true});
        return undefined;
      });
  }

  // The on-play preview: the SAME amount stepper `bespokePlay` builds, so the
  // player dials how much heat production → M€ production inside the play modal.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const step = actionPreviews.amountStep('Select amount of heat production to decrease', 'Decrease', 1, player.production.heat,
      {icon: 'heat', conversion: Insulation.CONVERSION});
    return actionPreviews.playPreview(this, player, [], [step]);
  }
}
