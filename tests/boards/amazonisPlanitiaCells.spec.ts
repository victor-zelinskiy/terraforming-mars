import {expect} from 'chai';
import {AmazonisPlanitiaBoard} from '../../src/server/boards/AmazonisPlanitiaBoard';
import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {SeededRandom} from '../../src/common/utils/Random';
import {BoardName} from '../../src/common/boards/BoardName';
import {SPECIAL_CELL_INFO} from '../../src/client/components/board/specialCellInfo';

/**
 * AMAZONIS PLANITIA'S NAMED PLACES are hover markers (phase 1 — the board's printed names were never taken as a
 * picture): every volcanic cell of the board carries ONE marker with its printed name, and no other cell does.
 */
describe('Amazonis Planitia — the named volcanoes', () => {
  const board = AmazonisPlanitiaBoard.newInstance({...DEFAULT_GAME_OPTIONS, boardName: BoardName.AMAZONIS_PLANITIA}, new SeededRandom(1));
  const markers = SPECIAL_CELL_INFO.filter((info) => info.boardName === BoardName.AMAZONIS_PLANITIA);

  it('every volcanic cell wears its printed name, and nothing else is marked', () => {
    const volcanic = [...board.volcanicSpaceIds].sort();
    expect(markers.map((m) => m.spaceId).sort()).deep.eq(volcanic);
    const named = Object.fromEntries(markers.map((m) => [board.A9[m.spaceId as keyof typeof board.A9], m.title]));
    expect(named).deep.eq({
      'E1': 'Hecates Tholus',
      'H7': 'Olympus Mons',
      'H9': 'Ascraeus Mons',
      'J8': 'Pavonis Mons',
      'K7': 'Arsia Mons',
    });
  });
});
