import {BoardName} from '../../common/boards/BoardName';
import {BoardLayoutSpace, BoardLayouts} from '../../common/boards/BoardLayout';
import {SpaceType} from '../../common/boards/SpaceType';
import {SeededRandom} from '../../common/utils/Random';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../game/GameOptions';
import {GameSetup} from '../GameSetup';

/**
 * Builds the static board-layout export (see `common/boards/BoardLayout.ts`)
 * from the REAL board classes. Deterministic by construction: the layout is
 * the unshuffled printed board (`shuffleMapOption: false`), so the rng is
 * never consulted.
 *
 * Called by `make:cards` (export_card_rendering.ts) to write
 * `src/genfiles/boardLayouts.json`, and by its guard spec — one source, so
 * an upstream board change regenerates the client picture on the next build
 * and the spec pins the generator's shape.
 */
export function buildBoardLayouts(): BoardLayouts {
  const layouts: Partial<BoardLayouts> = {};
  for (const name of Object.values(BoardName)) {
    layouts[name] = buildBoardLayout(name);
  }
  return layouts as BoardLayouts;
}

export function buildBoardLayout(name: BoardName): ReadonlyArray<BoardLayoutSpace> {
  const options: GameOptions = {
    ...DEFAULT_GAME_OPTIONS,
    boardName: name,
    shuffleMapOption: false,
  };
  const board = GameSetup.newBoard(options, new SeededRandom(1));
  const out: Array<BoardLayoutSpace> = [];
  for (const space of board.spaces) {
    // Colony spaces (Ganymede, Phobos, …) sit off-grid at x=-1 and are not
    // part of the Mars silhouette.
    if (space.spaceType === SpaceType.COLONY || space.x < 0) {
      continue;
    }
    const entry: BoardLayoutSpace = {
      x: space.x,
      y: space.y,
      t: space.spaceType,
      b: [...space.bonus],
    };
    if (space.volcanic === true) {
      entry.v = true;
    }
    out.push(entry);
  }
  return out;
}
