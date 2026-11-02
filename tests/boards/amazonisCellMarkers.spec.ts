import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceId} from '../../src/common/Types';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {SeededRandom} from '../../src/common/utils/Random';
import {AmazonisBoard} from '../../src/server/boards/AmazonisBoard';
import {LEGENDS} from '../../src/client/components/Legends';
import {SPECIAL_CELL_INFO, getSpecialCellInfo} from '../../src/client/components/board/specialCellInfo';

/**
 * AMAZONIS PLANITIA, THE FAN MAP — its premium markers are pinned to the cells that EARN them, read off the server
 * board itself: every volcanic cell carries a named marker and every volcano marker sits on a volcanic cell; the
 * RESTRICTED centre carries the one marker that names its rule; no legacy SVG caption is left; no other map's
 * marker leaks onto it.
 */
describe('Amazonis Planitia — the cell markers sit on the cells that earn them', () => {
  const board = AmazonisBoard.newInstance(DEFAULT_GAME_OPTIONS, new SeededRandom(0));
  const markers = SPECIAL_CELL_INFO.filter((m) => m.boardName === BoardName.AMAZONIS);
  const space = (id: SpaceId) => board.getSpaceOrThrow(id);

  it('every volcanic cell is named, and every volcano marker is on a volcanic cell', () => {
    const volcanic = board.spaces.filter((s) => s.volcanic === true).map((s) => s.id).sort();
    expect(volcanic).deep.eq(['09', '35', '43', '49']);
    for (const id of volcanic) {
      expect(getSpecialCellInfo(id, BoardName.AMAZONIS), `volcano ${id}`).is.not.undefined;
    }
    for (const title of ['Albor Tholus', 'Anseris Mons', 'Pindus Mons', 'Ulysses Tholus']) {
      const marker = markers.find((m) => m.title === title);
      expect(marker, title).is.not.undefined;
      expect(space(marker!.spaceId).volcanic, `${title} on ${marker!.spaceId}`).is.true;
    }
  });

  it('the restricted centre carries the marker that names its rule — and it is the only restricted cell', () => {
    const restricted = board.spaces.filter((s) => s.spaceType === SpaceType.RESTRICTED).map((s) => s.id);
    expect(restricted).deep.eq(['33']);
    const marker = markers.find((m) => m.title === 'Restricted area');
    expect(marker).is.not.undefined;
    expect(marker!.spaceId).eq('33');
    expect(marker!.description).eq('No tiles can ever be placed on this space.');
    // Fixed (`doNotShuffleLastSpace`): the marker survives a shuffled map.
    const shuffled = AmazonisBoard.newInstance({...DEFAULT_GAME_OPTIONS, shuffleMapOption: true}, new SeededRandom(5));
    expect(shuffled.getSpaceOrThrow('33').spaceType).eq(SpaceType.RESTRICTED);
  });

  it('exactly five markers — four volcanoes and the centre', () => {
    expect(markers.map((m) => m.title).sort()).deep.eq(['Albor Tholus', 'Anseris Mons', 'Pindus Mons', 'Restricted area', 'Ulysses Tholus']);
  });

  it('no legacy SVG caption is left for this map', () => {
    expect(LEGENDS[BoardName.AMAZONIS]).deep.eq([]);
  });

  it('no marker of another map leaks onto Amazonis', () => {
    for (const m of SPECIAL_CELL_INFO.filter((m) => m.boardName !== undefined && m.boardName !== BoardName.AMAZONIS)) {
      expect(getSpecialCellInfo(m.spaceId, BoardName.AMAZONIS)?.id, m.id).not.eq(m.id);
    }
  });
});
