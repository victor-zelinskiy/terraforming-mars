import * as constants from '../../../common/constants';
import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {Card} from '../Card';
import {CardRenderer} from '../render/CardRenderer';
import {Resource} from '../../../common/Resource';
import {IActionCard} from '../ICard';
import * as actionPreviews from '../actionPreviews';
import {futilityOf, zeroYield} from '../actionFutilities';

// Note: Floyd Continuum comes from the Dutch international open.
// https://boardgamegeek.com/thread/3120204/dutch-open-terraformingmars-international-4th-tour

export class FloydContinuum extends Card implements IProjectCard, IActionCard {
  constructor() {
    super({
      cost: 4,
      name: CardName.FLOYD_CONTINUUM,
      tags: [Tag.SCIENCE],
      type: CardType.ACTIVE,

      metadata: {
        cardNumber: 'X-1',
        infoText: [{kind: 'action-short', text: '3 M€ per completed parameter'}],
        renderData: CardRenderer.builder((b) => {
          b.action('Gain 3 M€ per completed terraforming parameter.', (eb) => {
            eb.empty().startAction.megacredits(3).slash().oceans(1).oxygen(1).temperature(1).asterix();
          });
        }),
      },
    });
  }

  public canAct() {
    return true;
  }

  /** The completed terraforming parameters — one count for the preview, the verdict and the action. */
  private completedParameters(player: IPlayer): number {
    const game = player.game;
    let count = 0;
    if (game.getTemperature() === constants.MAX_TEMPERATURE) {
      count++;
    }
    if (game.getOxygenLevel() === constants.MAX_OXYGEN_LEVEL) {
      count++;
    }
    if (!game.canAddOcean()) {
      count++;
    }
    if (game.getVenusScaleLevel() === constants.MAX_VENUS_SCALE) {
      count++;
    }
    return count;
  }

  public actionPreview(player: IPlayer) {
    return actionPreviews.singleBranch(this, player, [], [
      actionPreviews.stockGain(player, Resource.MEGACREDITS, 3 * this.completedParameters(player)),
    ]);
  }

  /** NO EFFECT (`models/actionFutility.ts`): no parameter completed yet — the action pays 0 M€. */
  public actionFutility(player: IPlayer) {
    return futilityOf(this.completedParameters(player) === 0 ? zeroYield() : undefined);
  }

  public action(player: IPlayer) {
    player.stock.add(Resource.MEGACREDITS, 3 * this.completedParameters(player), {log: true});
    return undefined;
  }
}
