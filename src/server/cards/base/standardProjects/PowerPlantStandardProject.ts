import {IPlayer} from '../../../IPlayer';
import {CardName} from '../../../../common/cards/CardName';
import {CardRenderer} from '../../render/CardRenderer';
import {StandardProjectCard} from '../../StandardProjectCard';
import {Resource} from '../../../../common/Resource';
import {ActionEffect} from '../../../../common/models/ActionPreviewModel';
import * as preview from '../../actionPreviews';

export class PowerPlantStandardProject extends StandardProjectCard {
  constructor() {
    super({
      name: CardName.POWER_PLANT_STANDARD_PROJECT,
      cost: 11,
      metadata: {
        cardNumber: 'SP7',
        renderData: CardRenderer.builder((b) =>
          b.standardProject('Spend 11 M€ to increase your energy production 1 step.', (eb) => {
            eb.megacredits(11).startAction.production((pb) => {
              pb.energy(1);
            });
          }),
        ),
      },
    });
  }

  actionEssence(player: IPlayer): void {
    player.production.add(Resource.ENERGY, 1);
  }

  // Co-located with actionEssence so the chip can't drift from the effect.
  public standardProjectPreviewEffects(player: IPlayer): ReadonlyArray<ActionEffect> {
    return [preview.productionChange(player, Resource.ENERGY, 1)];
  }
}
