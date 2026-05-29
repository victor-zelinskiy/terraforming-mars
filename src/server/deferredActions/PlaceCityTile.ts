import {IPlayer} from '../IPlayer';
import {SelectSpace} from '../inputs/SelectSpace';
import {Space} from '../boards/Space';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {PlacementType} from '../boards/PlacementType';
import {Message} from '../../common/logs/Message';

export class PlaceCityTile extends DeferredAction<Space | undefined> {
  constructor(
    player: IPlayer,
    private options?: {
      on?: PlacementType,
      title?: string | Message,
      spaces?: ReadonlyArray<Space>,
    }) {
    super(player, Priority.DEFAULT);
  }

  public execute() {
    const type = this.options?.on || 'city';
    const spaces = this.options?.spaces || this.player.game.board.getAvailableSpacesForType(this.player, type);
    const title = this.options?.title ?? this.getTitle(type);

    if (spaces.length === 0) {
      this.cb(undefined);
      return undefined;
    }
    // See SelectSpace + PlacementIllegalReason: illegalSpaces drives the
    // client's native tooltip + `not-allowed` cursor on dimmed cells.
    const illegalSpaces = this.player.game.board.computeIllegalReasons(this.player, type, spaces);
    return new SelectSpace(title, spaces, illegalSpaces)
      .andThen((space) => {
        this.player.game.addCity(this.player, space);
        this.cb(space);
        return undefined;
      });
  }

  private getTitle(type: PlacementType) {
    switch (type) {
    case 'city': return 'Select space for city tile';
    case 'isolated': return 'Select place next to no other tile for city';
    // case '': return 'Select space reserved for ocean to place greenery tile';
    default: throw new Error('unhandled type; ' + type);
    }
  }
}
