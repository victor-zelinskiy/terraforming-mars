import {CanAffordOptions, IPlayer} from '../IPlayer';
import {Space} from '../boards/Space';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {PlacementType} from '../boards/PlacementType';
import {Message} from '../../common/logs/Message';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';
import {cancellablePlacement} from '../inputs/placementContext';
import {CardName} from '../../common/cards/CardName';
import {InputError} from '../inputs/InputError';

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
      // The standard project that asks. Everything this project does beyond the
      // tile itself happens inside `commit`, i.e. only AFTER the space is picked,
      // so the cell preview can explain it only through the card's co-located
      // `placementPreview` hook — which is reachable only when the prompt names
      // the card.
      sourceCard?: CardName,
      /**
       * What the player can still afford ON TOP of the project's own (not yet
       * charged) cost — see `StandardProjectCard.placementCanAffordOptions`.
       * Every target is filtered by it here, at prompt time, and re-checked at
       * commit time: pay-on-commit means the project's money is still in the
       * player's stock while the list is built, so without it a space whose
       * placement cost (Ares hazard removal, Hellas ocean, …) needs that very
       * money looks affordable, and the deferred placement payment then throws
       * AFTER the tile is placed.
       */
      canAffordOptions?: CanAffordOptions,
      commit: (space: Space) => void,
    }) {
    super(player, opts.priority ?? Priority.DEFAULT);
  }

  /** Targets whose own placement cost survives paying for the project itself. */
  private affordableSpaces(): ReadonlyArray<Space> {
    const board = this.player.game.board;
    return this.opts.spaces.filter((space) => board.canAfford(this.player, space, this.opts.canAffordOptions));
  }

  public execute() {
    if (this.opts.spaces.length === 0) {
      // Guarded by each project's canAct; nothing to place.
      return undefined;
    }
    const spaces = this.affordableSpaces();
    if (spaces.length === 0) {
      // Every target costs more than what is left after the project's own price.
      // Pay-on-commit means NOTHING has been spent yet, so this resolves exactly
      // like a cancel: the player keeps the money and the action rather than
      // being handed a prompt whose every answer would fail to pay.
      this.player.pendingPlacementCancelled = true;
      return undefined;
    }
    return createMarsSelectSpace(this.player, this.opts.title, spaces, {
      placementType: this.opts.placementType,
      sourceCard: this.opts.sourceCard,
      canAffordOptions: this.opts.canAffordOptions,
      // Explicit — the helper's `sourceCard`-derived default marker must NOT
      // replace the cancellable standard-project marker. It still NAMES the
      // project: the card is right there, and dropping it left every standard
      // placement on the board saying only «стандартный проект» when it could
      // say which one (and let the player open it).
      placementContext: cancellablePlacement({kind: 'standardProject', card: this.opts.sourceCard}),
      onCancel: () => {
        this.player.pendingPlacementCancelled = true;
      },
    }).andThen((space) => {
      // Defence in depth, and the reason `commit` may charge BEFORE it places:
      // the ONE affordability question is asked again here, before ANY mutation.
      // A commit that fails halfway is the worst outcome available — the tile is
      // seated, the hazard cleared, the money gone and the cost unpayable — so a
      // target that no longer survives the check is refused whole.
      if (!this.player.game.board.canAfford(this.player, space, this.opts.canAffordOptions)) {
        throw new InputError('You can no longer afford to place here');
      }
      this.opts.commit(space);
      return undefined;
    });
  }
}
