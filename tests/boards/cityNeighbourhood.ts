import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {SpaceType} from '../../src/common/boards/SpaceType';

/**
 * A city NEIGHBOURHOOD on the board, found by sweeping rather than by a
 * remembered cell id: `own` (an interior land cell), `shared` (beside `own`
 * and beside `foreign`), `foreign` (NOT beside `own`) and `foreignOnly`
 * (beside `foreign`, NOT beside `own`) — every one of them free plain land.
 * The specs of the «city ignoring other placement restrictions» rule
 * (TR16 Administration District) seat one player's city on `own` and
 * another player's on `foreign`.
 */
export type CityNeighbourhood = {own: Space, shared: Space, foreign: Space, foreignOnly: Space};

export function cityNeighbourhood(game: IGame): CityNeighbourhood {
  const board = game.board;
  const free = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined && s.id !== board.noctisCitySpaceId;
  const besides = (a: Space, b: Space) => board.getAdjacentSpaces(a).some((n) => n.id === b.id);
  for (const own of board.spaces) {
    if (!free(own) || board.getAdjacentSpaces(own).length !== 6 || !board.getAdjacentSpaces(own).every(free)) {
      continue;
    }
    for (const shared of board.getAdjacentSpaces(own)) {
      for (const foreign of board.getAdjacentSpaces(shared)) {
        if (!free(foreign) || foreign.id === own.id || besides(foreign, own)) {
          continue;
        }
        const foreignOnly = board.getAdjacentSpaces(foreign).find((s) => free(s) && s.id !== own.id && !besides(s, own));
        if (foreignOnly !== undefined) {
          return {own, shared, foreign, foreignOnly};
        }
      }
    }
  }
  throw new Error('no city neighbourhood on this board');
}
