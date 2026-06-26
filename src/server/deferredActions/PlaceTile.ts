import {IPlayer} from '../IPlayer';
import {Space} from '../boards/Space';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {PlacementType} from '../boards/PlacementType';
import {Tile} from '../Tile';
import {AdjacencyBonus} from '../ares/AdjacencyBonus';
import {Message} from '../../common/logs/Message';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';
import {PlacementIllegalReason} from '../../common/inputs/PlacementIllegalReason';

export class PlaceTile extends DeferredAction<Space> {
  constructor(
    player: IPlayer,
    private options: {
      tile: Tile,
      on: PlacementType | (() => ReadonlyArray<Space>),
      title: string | Message,
      adjacencyBonus?: AdjacencyBonus;
      // When `on` is a custom function, a card can still declare the base
      // placement terrain so generic per-cell reasons (occupied / ocean /
      // reserved) are derived, plus a `customReasoner` for its OWN rule.
      placementType?: PlacementType;
      customReasoner?: (space: Space) => PlacementIllegalReason | undefined;
    }) {
    super(player, Priority.DEFAULT);
  }

  public execute() {
    const game = this.player.game;
    const on = this.options.on;
    const availableSpaces =
      typeof on === 'string' ?
        game.board.getAvailableSpacesForType(this.player, on) :
        on();
    const title = this.options?.title;

    return createMarsSelectSpace(this.player, title, availableSpaces, {
      placementType: typeof on === 'string' ? on : this.options.placementType,
      customReasoner: this.options.customReasoner,
    })
      .andThen((space: Space) => {
        const tile: Tile = {...this.options.tile};
        if (this.options.on === 'upgradeable-ocean' || this.options.on === 'upgradeable-ocean-new-holland') {
          tile.covers = space.tile;
        }
        game.addTile(this.player, space, tile);
        space.adjacency = this.options.adjacencyBonus;
        this.cb(space);
        return undefined;
      });
  }
}
