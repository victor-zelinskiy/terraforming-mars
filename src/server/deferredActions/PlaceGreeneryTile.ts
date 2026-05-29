import {IPlayer} from '../IPlayer';
import {SelectSpace} from '../inputs/SelectSpace';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {PlacementType} from '../boards/PlacementType';
import {Space} from '../boards/Space';

export class PlaceGreeneryTile extends DeferredAction<Space | undefined> {
  constructor(
    player: IPlayer,
    private on: PlacementType = 'greenery',
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

    const illegalSpaces = board.computeIllegalReasons(this.player, this.on, filtered);
    return new SelectSpace(this.getTitle(), filtered, illegalSpaces)
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
