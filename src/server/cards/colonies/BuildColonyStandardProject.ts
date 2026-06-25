import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {StandardProjectCard} from '../StandardProjectCard';
import {BuildColony} from '../../deferredActions/BuildColony';
import {Payment} from '../../../common/inputs/Payment';
import {cancellablePlacement} from '../../inputs/placementContext';

export class BuildColonyStandardProject extends StandardProjectCard {
  constructor() {
    super({
      name: CardName.BUILD_COLONY_STANDARD_PROJECT,
      cost: 17,
      metadata: {
        cardNumber: 'SP5',
        renderData: CardRenderer.builder((b) =>
          b.standardProject('Spend 17 M€ to place a colony.', (eb) => {
            eb.megacredits(17).startAction.colonies();
          }),
        ),
      },
    });
  }

  public override canAct(player: IPlayer): boolean {
    const canPlayOptions = this.canPlayOptions(player);
    return super.canAct(player) &&
      player.colonies.getPlayableColonies(/* allowDuplicate= */ false, canPlayOptions).length > 0;
  }

  // Legacy committed path.
  actionEssence(player: IPlayer): void {
    player.game.defer(new BuildColony(player));
  }

  // Pay on commit: present a CANCELLABLE colony selection FIRST; the 17 M€ cost +
  // the colony placement (bonuses / triggers) apply only once a colony is chosen.
  // Cancelling before then spends nothing, builds nothing, and returns the player
  // to the action menu without consuming the action.
  public override payAndExecute(player: IPlayer, payment: Payment): void {
    // Pre-filter the colony list with the project cost accounted for. Because pay
    // happens on commit, the list is computed BEFORE the 17 M€ is spent — so we
    // must pass `canPlayOptions` (which includes the cost) to exclude colonies the
    // player could afford now but NOT after paying (e.g. a TR-costed colony under
    // Reds). Mirrors the old "pay first, then compute the list" affordability.
    const colonies = player.colonies.getPlayableColonies(/* allowDuplicate= */ false, this.canPlayOptions(player));
    player.game.defer(new BuildColony(player, {
      colonies,
      placementContext: cancellablePlacement({kind: 'colony'}),
      onCancel: () => {
        player.pendingPlacementCancelled = true;
      },
      commit: (_colony, place) => this.commitInScope(player, () => {
        this.commitCost(player, payment);
        place();
      }),
    }));
  }
}
