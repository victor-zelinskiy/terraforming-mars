import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SeededRandom} from '../../src/common/utils/Random';
import {Board} from '../../src/server/boards/Board';
import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {GameSetup} from '../../src/server/GameSetup';

/**
 * ONE REGION, TWO READINGS — and they never disagree where both are read. The milestones / awards score through the
 * board's own geometry (`board.isSouthern` / `isPolar` / `isEquatorial`, upstream b79b41c674 — it holds on the
 * eleven-row Amazonis Planitia); MarsBot's map profiles keep the nine-row statics (`Board.isSouthernRegion` …). On
 * every nine-row board the two are the same predicate.
 */
describe('board regions — the geometry and the nine-row statics agree', () => {
  for (const name of Object.values(BoardName)) {
    const board = GameSetup.newBoard({...DEFAULT_GAME_OPTIONS, boardName: name, shuffleMapOption: false}, new SeededRandom(1));
    if (board.bottomRow !== 8) {
      continue;
    }
    it(`${name}: south / polar / equatorial read the same rows`, () => {
      for (const space of board.spaces.filter((s) => s.spaceType !== SpaceType.COLONY)) {
        expect(board.isSouthern(space), `${space.id} south`).eq(Board.isSouthernRegion(space));
        expect(board.isPolar(space), `${space.id} polar`).eq(Board.isPolarRegion(space));
        expect(board.isEquatorial(space), `${space.id} equatorial`).eq(Board.isEquatorialRegion(space));
      }
    });
  }

  it('the eleven-row Amazonis Planitia scores its own rows', () => {
    const board = GameSetup.newBoard({...DEFAULT_GAME_OPTIONS, boardName: BoardName.AMAZONIS_PLANITIA, shuffleMapOption: false}, new SeededRandom(1));
    expect(board.bottomRow).eq(10);
    expect(board.equatorRow).eq(5);
    const rows = (predicate: (s: typeof board.spaces[number]) => boolean) =>
      [...new Set(board.spaces.filter((s) => s.spaceType !== SpaceType.COLONY && predicate(s)).map((s) => s.y))].sort((a, b) => a - b);
    expect(rows((s) => board.isSouthern(s))).deep.eq([6, 7, 8, 9, 10]);
    expect(rows((s) => board.isPolar(s))).deep.eq([9, 10]);
    expect(rows((s) => board.isEquatorial(s))).deep.eq([4, 5, 6]);
  });
});
