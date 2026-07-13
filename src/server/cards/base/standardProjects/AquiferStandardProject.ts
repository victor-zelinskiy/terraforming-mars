import {IPlayer} from '../../../IPlayer';
import {CardName} from '../../../../common/cards/CardName';
import {CardRenderer} from '../../render/CardRenderer';
import {PlaceOceanTile} from '../../../deferredActions/PlaceOceanTile';
import {StandardProjectPlacement} from '../../../deferredActions/StandardProjectPlacement';
import {Priority} from '../../../deferredActions/Priority';
import {StandardProjectCard} from '../../StandardProjectCard';
import {Payment} from '../../../../common/inputs/Payment';

export class AquiferStandardProject extends StandardProjectCard {
  constructor() {
    super({
      name: CardName.AQUIFER_STANDARD_PROJECT,
      cost: 18,
      tr: {oceans: 1},
      metadata: {
        cardNumber: 'SP2',
        renderData: CardRenderer.builder((b) =>
          b.standardProject('Spend 18 M€ to place an ocean tile.', (eb) => {
            eb.megacredits(18).startAction.oceans(1);
          })),
      },
    });
  }

  public override canPayWith(player: IPlayer) {
    if (player.tableau.has(CardName.KUIPER_COOPERATIVE)) {
      return {kuiperAsteroids: true};
    } else {
      return {};
    }
  }

  public override canAct(player: IPlayer): boolean {
    if (!player.game.canAddOcean()) {
      this.addWarning('maxoceans');
    }
    return super.canAct(player);
  }

  // Legacy committed path.
  actionEssence(player: IPlayer): void {
    player.game.defer(new PlaceOceanTile(player));
  }

  // Pay on commit: present a CANCELLABLE ocean placement FIRST; the cost + TR
  // apply only once a space is chosen. When oceans are maxed there is no
  // placement to cancel (a degenerate stall, possibly redirected to Whales) —
  // fall back to the committed legacy path which pays up front and lets
  // PlaceOceanTile resolve the Whales / no-op.
  public override payAndExecute(player: IPlayer, payment: Payment): void {
    if (!player.game.canAddOcean()) {
      super.payAndExecute(player, payment);
      return;
    }
    const spaces = player.game.board.getAvailableSpacesForType(player, 'ocean');
    player.game.defer(new StandardProjectPlacement(player, {
      placementType: 'ocean',
      title: 'Select space for ocean tile',
      spaces,
      priority: Priority.PLACE_OCEAN_TILE,
      commit: (space) => this.commitInScope(player, () => {
        player.game.addOcean(player, space);
        this.commitCost(player, payment);
      }),
    }));
  }
}
