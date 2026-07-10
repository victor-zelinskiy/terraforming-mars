import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IActionCard} from '../ICard';
import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {SelectAmount} from '../../inputs/SelectAmount';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class PowerInfrastructure extends Card implements IActionCard, IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.POWER_INFRASTRUCTURE,
      tags: [Tag.POWER, Tag.BUILDING],
      cost: 4,

      metadata: {
        cardNumber: '194',
        renderData: CardRenderer.builder((b) => {
          b.action('Spend any amount of energy and gain that amount of M€.', (eb) => {
            eb.text('x').energy(1).startAction.megacredits(1, {text: 'x'});
          });
        }),
      },
    });
  }
  public canAct(player: IPlayer): boolean {
    return player.energy > 0;
  }
  public actionUnavailableReason() {
    return actionReason.notEnoughEnergy();
  }
  // Choose X energy to spend (1..energy); gain X M€. The amount is the only
  // choice — the energy→M€ conversion is 1:1, shown via the stepper.
  public actionPreview(player: IPlayer) {
    return actionPreviews.singleBranch(this, player, [
      // The 1:1 energy → M€ conversion shown live in the stepper (spend X energy
      // → gain X M€), so the GAIN is never invisible.
      actionPreviews.amountStep('Select amount of energy to spend', 'Spend energy', 1, player.energy, {
        icon: Resource.ENERGY, result: {icon: 'megacredits', perUnit: 1},
      }),
    ]);
  }
  public action(player: IPlayer) {
    return new SelectAmount('Select amount of energy to spend', 'Spend energy', 1, player.energy)
      .andThen((amount) => {
        player.stock.deduct(Resource.ENERGY, amount);
        player.stock.add(Resource.MEGACREDITS, amount, {log: true});
        return undefined;
      });
  }
}
