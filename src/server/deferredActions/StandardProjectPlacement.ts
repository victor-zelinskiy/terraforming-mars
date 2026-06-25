import {IPlayer} from '../IPlayer';
import {Space} from '../boards/Space';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {PlacementType} from '../boards/PlacementType';
import {Message} from '../../common/logs/Message';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';
import {cancellablePlacement} from '../inputs/placementContext';

/**
 * A CANCELLABLE, PAY-ON-COMMIT tile placement for the placement-bearing standard
 * projects (City / Greenery / Aquifer). It presents the space selection FIRST;
 * only once the player commits a space does `commit(space)` run (which opens the
 * analytics scope, places the tile, charges the player, and applies the
 * project's extra effects). Cancelling before that flags the player's action as
 * cancelled (`pendingPlacementCancelled`) and runs `commit` NOT at all — so no
 * resources are spent, no tile is placed, no journal/notification root is
 * emitted, and the player returns to the action menu without losing the action.
 *
 * `commit` is a closure (not the card) to avoid a deferredActions → cards import
 * cycle; the card opens its own `beginAction` scope inside it.
 */
export class StandardProjectPlacement extends DeferredAction<undefined> {
  constructor(
    player: IPlayer,
    private opts: {
      placementType: PlacementType,
      title: string | Message,
      spaces: ReadonlyArray<Space>,
      priority?: Priority,
      commit: (space: Space) => void,
    }) {
    super(player, opts.priority ?? Priority.DEFAULT);
  }

  public execute() {
    if (this.opts.spaces.length === 0) {
      // Guarded by each project's canAct; nothing to place.
      return undefined;
    }
    return createMarsSelectSpace(this.player, this.opts.title, this.opts.spaces, {
      placementType: this.opts.placementType,
      placementContext: cancellablePlacement({kind: 'standardProject'}),
      onCancel: () => {
        this.player.pendingPlacementCancelled = true;
      },
    }).andThen((space) => {
      this.opts.commit(space);
      return undefined;
    });
  }
}
