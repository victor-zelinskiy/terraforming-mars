import {IPlayer} from '../../../IPlayer';
import {CardName} from '../../../../common/cards/CardName';
import {CardRenderer} from '../../render/CardRenderer';
import {StandardProjectCard} from '../../StandardProjectCard';
import {PlaceGreeneryTile} from '../../../deferredActions/PlaceGreeneryTile';
import {StandardProjectPlacement} from '../../../deferredActions/StandardProjectPlacement';
import {Payment} from '../../../../common/inputs/Payment';

export class GreeneryStandardProject extends StandardProjectCard {
  constructor() {
    super({
      name: CardName.GREENERY_STANDARD_PROJECT,
      cost: 23,
      tr: {oxygen: 1},
      metadata: {
        cardNumber: 'SP6',
        renderData: CardRenderer.builder((b) =>
          b.standardProject('Spend 23 M€ to place a greenery tile and raise oxygen 1 step.', (eb) => {
            eb.megacredits(23).startAction.greenery();
          }),
        ),
      },
    });
  }

  public override canPayWith(player: IPlayer) {
    if (player.tableau.has(CardName.SOYLENT_SEEDLING_SYSTEMS)) {
      return {seeds: true};
    } else {
      return {};
    }
  }

  public override canAct(player: IPlayer): boolean {
    // This is pricey because it forces calling canPlayOptions twice.
    if (player.game.board.getAvailableSpacesForGreenery(player, this.canPlayOptions(player)).length === 0) {
      return false;
    }
    return super.canAct(player);
  }

  // Legacy committed path.
  actionEssence(player: IPlayer): void {
    player.game.defer(new PlaceGreeneryTile(player));
  }

  // Pay on commit: present a CANCELLABLE greenery placement FIRST; the cost +
  // oxygen/TR apply only once a space is chosen.
  public override payAndExecute(player: IPlayer, payment: Payment): void {
    const spaces = player.game.board.getAvailableSpacesForType(player, 'greenery');
    player.game.defer(new StandardProjectPlacement(player, {
      placementType: 'greenery',
      title: 'Select space for greenery tile',
      spaces,
      commit: (space) => this.commitInScope(player, () => {
        player.game.addGreenery(player, space);
        this.commitCost(player, payment);
      }),
    }));
  }
}
