import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {SeededRandom} from '../../src/common/utils/Random';
import {HellasBoard} from '../../src/server/boards/HellasBoard';
import {UtopiaPlanitiaBoard} from '../../src/server/boards/UtopiaPlanitiaBoard';
import {LEGENDS} from '../../src/client/components/Legends';
import {SPECIAL_CELL_INFO, getSpecialCellInfo} from '../../src/client/components/board/specialCellInfo';

/**
 * HELLAS — its one special cell, the SOUTH POLE (the printed ocean bonus that costs 6 M€), carries a premium marker,
 * read off the server board itself: the marker sits on the only cell printing an OCEAN bonus, survives a shuffled map,
 * and is the map's only marker (Hellas prints no named locations). UTOPIA PLANITIA prints no special cell at all — no
 * volcano, no paid bonus, no reserved cell — so it carries none: a marker is earned by a cell, never invented.
 */
describe('Hellas — the South Pole marker sits on the cell that earns it', () => {
  const board = HellasBoard.newInstance(DEFAULT_GAME_OPTIONS, new SeededRandom(0));
  const markers = SPECIAL_CELL_INFO.filter((m) => m.boardName === BoardName.HELLAS);

  it('the only cell printing an ocean bonus is the South Pole, and it is marked', () => {
    const pole = board.spaces.filter((s) => s.bonus.includes(SpaceBonus.OCEAN)).map((s) => s.id);
    expect(pole).deep.eq([SpaceName.HELLAS_OCEAN_TILE]);
    const marker = getSpecialCellInfo(SpaceName.HELLAS_OCEAN_TILE, BoardName.HELLAS);
    expect(marker?.title).eq('South Pole');
    expect(marker?.description).contains('6 M€');
  });

  it('exactly one marker on the map, and it survives a shuffled board', () => {
    expect(markers.map((m) => m.id)).deep.eq(['hellas_south_pole']);
    const shuffled = HellasBoard.newInstance({...DEFAULT_GAME_OPTIONS, shuffleMapOption: true}, new SeededRandom(7));
    expect(shuffled.getSpaceOrThrow(SpaceName.HELLAS_OCEAN_TILE).bonus).to.include(SpaceBonus.OCEAN);
  });

  it('no legacy SVG caption and no other map\'s marker leaks onto Hellas', () => {
    expect(LEGENDS[BoardName.HELLAS]).deep.eq([]);
    for (const m of SPECIAL_CELL_INFO.filter((m) => m.boardName !== undefined && m.boardName !== BoardName.HELLAS)) {
      expect(getSpecialCellInfo(m.spaceId, BoardName.HELLAS)?.id, m.id).not.eq(m.id);
    }
  });
});

describe('Utopia Planitia — no cell earns a marker', () => {
  it('prints no volcano, no restricted cell and no paid / special bonus, so it carries no marker', () => {
    const board = UtopiaPlanitiaBoard.newInstance(DEFAULT_GAME_OPTIONS, new SeededRandom(0));
    const special = board.spaces.filter((s) => s.volcanic === true ||
      s.bonus.some((b) => b === SpaceBonus.OCEAN || b === SpaceBonus.TEMPERATURE_4MC || b === SpaceBonus.COLONY || b === SpaceBonus.DELEGATE));
    expect(special.map((s) => s.id)).deep.eq([]);
    expect(SPECIAL_CELL_INFO.filter((m) => m.boardName === BoardName.UTOPIA_PLANITIA)).deep.eq([]);
  });
});
