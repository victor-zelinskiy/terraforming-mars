import {IPlayer} from '../../../IPlayer';
import {CardName} from '../../../../common/cards/CardName';
import {CardRenderer} from '../../render/CardRenderer';
import {StandardProjectCard} from '../../StandardProjectCard';
import {PlaceCityTile} from '../../../deferredActions/PlaceCityTile';
import {StandardProjectPlacement} from '../../../deferredActions/StandardProjectPlacement';
import {Resource} from '../../../../common/Resource';
import {Payment} from '../../../../common/inputs/Payment';
import {BoardFact} from '../../../../common/boards/BoardInformationFacts';
import * as placementPreviews from '../../placementPreviews';
import * as actionReason from '../../actionReasons';
import * as preview from '../../actionPreviews';
import {UnplayableReason} from '../../../../common/cards/UnplayableReason';
import {ActionEffect} from '../../../../common/models/ActionPreviewModel';

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

  // Co-located with canAct so the reason can't drift when the gate changes.
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    if (player.game.board.getAvailableSpacesForCity(player, this.canPlayOptions(player)).length === 0) {
      return actionReason.placementReason('No space left for a city tile');
    }
    return undefined;
  }

  // Legacy committed path (kept for non-pay-on-commit callers / fallbacks).
  actionEssence(player: IPlayer): void {
    player.game.defer(new PlaceCityTile(player));
    player.production.add(Resource.MEGACREDITS, 1);
  }

  // Co-located with payAndExecute: the guaranteed production step the space
  // choice does NOT affect (the space-dependent part stays in placementPreview).
  public standardProjectPreviewEffects(player: IPlayer): ReadonlyArray<ActionEffect> {
    return [preview.productionChange(player, Resource.MEGACREDITS, 1)];
  }

  // Co-located with the pay-on-commit override below — the same fact, declared.
  public standardProjectTarget(_player: IPlayer): 'space' {
    return 'space';
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
      sourceCard: this.name,
      canAffordOptions: this.placementCanAffordOptions(player, payment),
      commit: (space) => this.commitInScope(player, () => {
        // Charge BEFORE placing, as the committed path always did: the placement
        // charges its own costs (Ares hazard removal, the Hellas ocean bonus, …)
        // against what is left, and a placement-time affordability check that
        // still saw the project's 25 M€ would approve a cost the player cannot
        // actually pay. The target list already guarantees this succeeds.
        this.commitCost(player, payment);
        player.game.addCity(player, space);
        player.production.add(Resource.MEGACREDITS, 1);
      }),
    }));
  }

  /**
   * The project's M€ production step is applied inside `commit(space)` — i.e.
   * only once a space is chosen — so the cell preview would otherwise show a bare
   * city tile and hide half of what 25 M€ actually buys.
   */
  public placementPreview(player: IPlayer): ReadonlyArray<BoardFact> {
    // No description: it would only restate the title, which already names the
    // project, while the chip carries the real `2 → 3 production` readout.
    return [placementPreviews.productionChange(player, this, Resource.MEGACREDITS, 1,
      'M€ production from the city project')];
  }
}
