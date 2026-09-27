import {IPlayer} from '../../../IPlayer';
import {CardName} from '../../../../common/cards/CardName';
import {CardRenderer} from '../../render/CardRenderer';
import {StandardProjectCard} from '../../StandardProjectCard';
import {PlaceGreeneryTile} from '../../../deferredActions/PlaceGreeneryTile';
import {StandardProjectPlacement} from '../../../deferredActions/StandardProjectPlacement';
import {Payment} from '../../../../common/inputs/Payment';
import * as actionReason from '../../actionReasons';
import * as preview from '../../actionPreviews';
import {UnplayableReason} from '../../../../common/cards/UnplayableReason';
import {ActionEffect} from '../../../../common/models/ActionPreviewModel';
import {REDUX_GREENERY_TILE_TR} from '../../../../common/parliament/winnerReward';

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

  // Co-located with canAct so the reason can't drift when the gate changes.
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    if (player.game.board.getAvailableSpacesForGreenery(player, this.canPlayOptions(player)).length === 0) {
      return actionReason.placementReason('No space left for a greenery tile');
    }
    return undefined;
  }

  // Legacy committed path.
  actionEssence(player: IPlayer): void {
    player.game.defer(new PlaceGreeneryTile(player));
  }

  // Turmoil Redux — the greenery revision (rulebook p.3): the TILE itself pays
  // 1 TR on top of the oxygen step, the same constant `ParliamentHandler
  // .onGreeneryPlaced` pays at the commit. Without it the row promised only the
  // oxygen chip, and with oxygen maxed read «no effect» while the project still
  // paid 1 TR. Co-located with `payAndExecute` below, like the city's production.
  public standardProjectPreviewEffects(player: IPlayer): ReadonlyArray<ActionEffect> {
    return player.game.parliament !== undefined ? [preview.trGain(player, REDUX_GREENERY_TILE_TR)] : [];
  }

  // Co-located with the pay-on-commit override below — the same fact, declared.
  public standardProjectTarget(_player: IPlayer): 'space' {
    return 'space';
  }

  // Pay on commit: present a CANCELLABLE greenery placement FIRST; the cost +
  // oxygen/TR apply only once a space is chosen.
  public override payAndExecute(player: IPlayer, payment: Payment): void {
    const spaces = player.game.board.getAvailableSpacesForType(player, 'greenery');
    player.game.defer(new StandardProjectPlacement(player, {
      placementType: 'greenery',
      title: 'Select space for greenery tile',
      spaces,
      canAffordOptions: this.placementCanAffordOptions(player, payment),
      commit: (space) => this.commitInScope(player, () => {
        // Charge BEFORE placing — see CityStandardProject for why the order is
        // load-bearing (the tile's own costs must be measured against what is
        // left once the project is paid for).
        this.commitCost(player, payment);
        player.game.addGreenery(player, space);
      }),
    }));
  }
}
