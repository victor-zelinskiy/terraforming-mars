import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {StandardProjectCard} from '../StandardProjectCard';
import {BuildColony} from '../../deferredActions/BuildColony';
import {Payment} from '../../../common/inputs/Payment';
import {cancellablePlacement} from '../../inputs/placementContext';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';

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

  /**
   * Co-located with `canAct` so the reason can't drift when the gate changes.
   * "No open colony slot" is invisible to the client (colony contents aren't a
   * player stat), so without this the screen could only say "unavailable right
   * now" — or guess "not enough M€" at a player holding 510 M€.
   */
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    const options = this.canPlayOptions(player);
    if (player.colonies.getPlayableColonies(/* allowDuplicate= */ false, options).length > 0) {
      // A colony IS available — the block is the payment, which the shared
      // explainer names with the exact deficit.
      return undefined;
    }
    return this.colonyBlocker(player);
  }

  /**
   * Why NO colony accepts a build right now. Classifies every in-play tile with
   * the same checks, in the same order, as `Colonies.getPlayableColonies` — so
   * each colony lands in exactly one bucket and the counts are exact. Names ONE
   * cause when a single cause explains every tile; otherwise it reports the
   * inventory (a fact, not an "X or Y" the player has to guess between).
   */
  private colonyBlocker(player: IPlayer): UnplayableReason {
    const colonies = player.game.colonies;
    let inactive = 0;
    let full = 0;
    let owned = 0;
    let unaffordableTr = 0;
    for (const colony of colonies) {
      if (colony.isActive === false) {
        inactive++;
      } else if (colony.isFull()) {
        full++;
      } else if (colony.colonies.includes(player.id)) {
        owned++;
      } else {
        // Every other rejection in getPlayableColonies is a TR-affordability one
        // (Venus / Europa raise a global parameter, Leavitt raises TR) — i.e. the
        // Reds tax on the raise, which the player can't pay after the 17 M€.
        unaffordableTr++;
      }
    }
    if (colonies.length === 0) {
      return {type: 'target', message: 'There are no colony tiles in play'};
    }
    if (unaffordableTr > 0) {
      return {type: 'megacredits', message: 'Cannot afford the TR increase to build on the remaining colonies'};
    }
    if (full === colonies.length) {
      return {type: 'target', message: 'Every colony tile is full', current: full};
    }
    if (owned === colonies.length) {
      return {type: 'target', message: 'You already have a colony on every colony tile', current: owned};
    }
    if (inactive === colonies.length) {
      return {type: 'target', message: 'No colony tile is active yet', current: inactive};
    }
    if (inactive === 0) {
      return {
        type: 'target',
        message: 'No colony has a free slot for you: ${0} full, ${1} already yours',
        params: [String(full), String(owned)],
      };
    }
    return {
      type: 'target',
      message: 'No colony tile is open to you: ${0} blocked, ${1} not active yet',
      params: [String(full + owned), String(inactive)],
    };
  }

  // Legacy committed path.
  actionEssence(player: IPlayer): void {
    player.game.defer(new BuildColony(player));
  }

  // Co-located with the pay-on-commit override below — the same fact, declared.
  public standardProjectTarget(_player: IPlayer): 'colony' {
    return 'colony';
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
