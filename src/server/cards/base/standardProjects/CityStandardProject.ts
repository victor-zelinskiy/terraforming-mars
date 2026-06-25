import {IPlayer} from '../../../IPlayer';
import {CardName} from '../../../../common/cards/CardName';
import {CardRenderer} from '../../render/CardRenderer';
import {StandardProjectCard} from '../../StandardProjectCard';
import {PlaceCityTile} from '../../../deferredActions/PlaceCityTile';
import {StandardProjectPlacement} from '../../../deferredActions/StandardProjectPlacement';
import {Resource} from '../../../../common/Resource';
import {Payment} from '../../../../common/inputs/Payment';

export class CityStandardProject extends StandardProjectCard {
  constructor() {
    super({
      name: CardName.CITY_STANDARD_PROJECT,
      cost: 25,
      metadata: {
        cardNumber: 'SP4',
        renderData: CardRenderer.builder((b) =>
          b.standardProject('Spend 25 M€ to place a city tile and increase your M€ production 1 step.', (eb) => {
            eb.megacredits(25).startAction.city().production((pb) => {
              pb.megacredits(1);
            });
          }),
        ),
      },
    });
  }

  public override canPayWith(player: IPlayer) {
    if (player.tableau.get(CardName.PREFABRICATION_OF_HUMAN_HABITATS)) {
      return {steel: true};
    } else {
      return {};
    }
  }

  public override canAct(player: IPlayer): boolean {
    // This is pricey because it forces calling canPlayOptions twice.
    if (player.game.board.getAvailableSpacesForCity(player, this.canPlayOptions(player)).length === 0) {
      return false;
    }
    return super.canAct(player);
  }

  // Legacy committed path (kept for non-pay-on-commit callers / fallbacks).
  actionEssence(player: IPlayer): void {
    player.game.defer(new PlaceCityTile(player));
    player.production.add(Resource.MEGACREDITS, 1);
  }

  // Pay on commit: present a CANCELLABLE city placement FIRST; the M€ cost + M€
  // production apply only once a space is chosen. Cancelling before then spends
  // nothing, places nothing, and returns the player to the action menu.
  public override payAndExecute(player: IPlayer, payment: Payment): void {
    const spaces = player.game.board.getAvailableSpacesForType(player, 'city');
    player.game.defer(new StandardProjectPlacement(player, {
      placementType: 'city',
      title: 'Select space for city tile',
      spaces,
      commit: (space) => this.commitInScope(player, () => {
        player.game.addCity(player, space);
        this.commitCost(player, payment);
        player.production.add(Resource.MEGACREDITS, 1);
      }),
    }));
  }
}
