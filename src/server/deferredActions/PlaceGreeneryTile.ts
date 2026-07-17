import {IPlayer} from '../IPlayer';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {PlacementType} from '../boards/PlacementType';
import {Space} from '../boards/Space';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';
import {PlacementContext} from '../../common/models/PlayerInputModel';
import {TileType} from '../../common/TileType';

export class PlaceGreeneryTile extends DeferredAction<Space | undefined> {
  constructor(
    player: IPlayer,
    private on: PlacementType = 'greenery',
    // Cancellability (pay-on-commit Greenery standard project).
    private options?: {placementContext?: PlacementContext, onCancel?: () => void},
  ) {
    super(player, Priority.DEFAULT);
  }

  public execute() {
    const board = this.player.game.board;
    const spacesForType = board.getAvailableSpacesForType(this.player, this.on);
    const filtered = board.filterSpacesAroundRedCity(spacesForType);
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
