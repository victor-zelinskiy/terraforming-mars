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
import * as divertedGate from '../../../parliament/divertedTerraformingGate';
import {TerraformingUnit} from '../../../parliament/resolutions/IResolution';

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
    // This is pricey because it forces calling canPlayOptions twice. Under a law that REPLACES the greenery (RX35)
    // no cell is needed: the tile is never seated (decision Р5).
    if (!divertedGate.divertsTerraforming(player) &&
        player.game.board.getAvailableSpacesForGreenery(player, this.canPlayOptions(player)).length === 0) {
      return false;
    }
    return super.canAct(player);
  }

  // Co-located with canAct so the reason can't drift when the gate changes.
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    if (!divertedGate.divertsTerraforming(player) &&
        player.game.board.getAvailableSpacesForGreenery(player, this.canPlayOptions(player)).length === 0) {
      return actionReason.placementReason('No space left for a greenery tile');
    }
    return undefined;
  }

  /**
   * THE UNIT this project's `tr` stands for under a replacing law (RX35): the GREENERY TILE — its oxygen is part of
   * the tile (`Game.addGreenery` raises it), so the project is ONE unit, never an oxygen step beside a tile.
   */
  public divertedTerraformingUnit(): TerraformingUnit {
    return {kind: 'tile', tile: 'greenery', count: 1};
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
    // …and none under a law that REPLACES the tile (RX35): no tile, no tile's rating.
    if (divertedGate.divertsTerraforming(player)) {
      return [];
    }
    return player.game.parliament !== undefined ? [preview.trGain(player, REDUX_GREENERY_TILE_TR)] : [];
  }

  // Co-located with the pay-on-commit override below — the same fact, declared: no cell under the replacing law.
  public standardProjectTarget(player: IPlayer): 'space' | undefined {
    return divertedGate.divertsTerraforming(player) ? undefined : 'space';
  }

  // Pay on commit: present a CANCELLABLE greenery placement FIRST; the cost +
  // oxygen/TR apply only once a space is chosen. Under the replacing law the
  // submit IS the commit: the price is paid and the tile step diverts itself.
  public override payAndExecute(player: IPlayer, payment: Payment): void {
    if (divertedGate.divertsTerraforming(player)) {
      super.payAndExecute(player, payment);
      return;
    }
    // The list is built with the SAME affordability basis the prompt filters by:
    // «beside your own tile, if possible» is decided over the cells the player
    // can actually PAY for. Built without it, a neighbour hazard affordable on
    // its own (16 M€ of 25) but not on top of the project (23 + 16) won the
    // adjacency test, was then filtered out, and the project silently
    // cancelled — while `canAct` (which asks with the cost) had offered it.
    const canAffordOptions = this.placementCanAffordOptions(player, payment);
    const spaces = player.game.board.getAvailableSpacesForType(player, 'greenery', canAffordOptions);
    player.game.defer(new StandardProjectPlacement(player, {
      placementType: 'greenery',
      title: 'Select space for greenery tile',
      spaces,
      canAffordOptions,
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
