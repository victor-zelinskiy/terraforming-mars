import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {Space} from '../boards/Space';
import {RunNTimes} from '../deferredActions/RunNTimes';
import {SpaceType} from '../../common/boards/SpaceType';
import {LogHelper} from '../LogHelper';
import {AresHazards} from '../ares/AresHazards';
import {TileType} from '../../common/TileType';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';

export class ErodeSpacesDeferred extends RunNTimes<Space> {
  constructor(player: IPlayer, count: number) {
    super(player, count);
  }

  protected run(): PlayerInput | undefined {
    const game = this.player.game;

    const spaces: Set<Space> = new Set();
    for (const hazardTile of game.board.getHazards()) {
      for (const space of game.board.getAdjacentSpaces(hazardTile)) {
        if (space.spaceType === SpaceType.LAND && space.tile === undefined) {
          spaces.add(space);
        }
      }
    }

    if (spaces.size === 0) {
      return undefined;
    }

    // Land cells adjacent to existing hazards are the legal set. Cells
    // failing the adjacency filter fall through to generic 'unavailable';
    // niche-enough card path that adding a dedicated 'not-adjacent-to-
    // hazard' enum isn't worth the surface-area cost.
    return createMarsSelectSpace(this.player, this.createTitle('Select space to erode'), Array.from(spaces), {
      placementType: 'land',
    })
      .andThen((space) => {
        AresHazards.putHazardAt(this.player.game, space, TileType.EROSION_MILD);
        LogHelper.logBoardTileAction(this.player, space, 'space', 'eroded');
        game.grantSpaceBonuses(this.player, space);
        return this.next();
      });
  }
}
