import {IPlayer} from '../IPlayer';
import {Space} from '../boards/Space';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {PlacementType} from '../boards/PlacementType';
import {Message} from '../../common/logs/Message';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';
import {PlacementIllegalReason} from '../../common/inputs/PlacementIllegalReason';

export class PlaceCityTile extends DeferredAction<Space | undefined> {
  constructor(
    player: IPlayer,
    private options?: {
      on?: PlacementType,
      title?: string | Message,
      spaces?: ReadonlyArray<Space>,
      // Card-specific per-cell reason for cells excluded by a custom `spaces`
      // filter (e.g. UrbanizedArea's "2+ adjacent cities", LavaTube's volcanic).
      customReasoner?: (space: Space) => PlacementIllegalReason | undefined,
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
    return createMarsSelectSpace(this.player, title, spaces, {placementType: type, customReasoner: this.options?.customReasoner})
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
