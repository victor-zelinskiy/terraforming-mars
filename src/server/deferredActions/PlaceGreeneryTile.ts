import {CanAffordOptions, IPlayer} from '../IPlayer';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {PlacementType} from '../boards/PlacementType';
import {Space} from '../boards/Space';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';
import {PlacementContext} from '../../common/models/PlayerInputModel';
import {CardName} from '../../common/cards/CardName';
import {TileType} from '../../common/TileType';

/**
 * THE CELLS A CARD'S GREENERY MAY GO TO — the engine's set for `on` with the
 * Red City exclusion: the ONE derivation `execute` asks, and the one a
 * bespoke greenery card's gate and its staged twin ask (Arboretum, TR21) —
 * so a card that keeps the placed cell never re-states the greenery rule.
 * `canAffordOptions` folds in the unpaid card's own cost (the staged play).
 */
export function greeneryTargets(player: IPlayer, on: PlacementType = 'greenery', canAffordOptions?: CanAffordOptions): ReadonlyArray<Space> {
  const board = player.game.board;
  return board.filterSpacesAroundRedCity(board.getAvailableSpacesForType(player, on, canAffordOptions));
}

export class PlaceGreeneryTile extends DeferredAction<Space | undefined> {
  constructor(
    player: IPlayer,
    private on: PlacementType = 'greenery',
    // Cancellability (pay-on-commit Greenery standard project) + the card that
    // asks (so the preview can include the card's own space-dependent effect).
    private options?: {placementContext?: PlacementContext, onCancel?: () => void, sourceCard?: CardName},
  ) {
    super(player, Priority.DEFAULT);
  }

  public execute() {
    const filtered = greeneryTargets(this.player, this.on);
    if (filtered.length === 0) {
      this.cb(undefined);
      return undefined;
    }

    return createMarsSelectSpace(this.player, this.getTitle(), filtered, {
      placementType: this.on,
      // The eligibility set (`on`) and the TILE can diverge: Protected Valley /
      // Mangrove place a GREENERY on an ocean-reserved cell. `placementType`
      // stays the eligibility kind (what makes those cells legal); `tileType`
      // names what is actually placed, so the preview reads the greenery's
      // effect (oxygen, its VP + adjacency, subject to hazard adjacency) — never
      // the ocean track it does NOT touch.
      tileType: TileType.GREENERY,
      sourceCard: this.options?.sourceCard,
      placementContext: this.options?.placementContext,
      onCancel: this.options?.onCancel,
    })
      .andThen((space) => {
        this.player.game.addGreenery(this.player, space);
        this.cb(space);
        return undefined;
      });
  }

  private getTitle() {
    switch (this.on) {
    case 'greenery': return 'Select space for greenery tile';
    case 'ocean': return 'Select space reserved for ocean to place greenery tile';
    default: throw new Error('unhandled type; ' + this.on);
    }
  }
}
