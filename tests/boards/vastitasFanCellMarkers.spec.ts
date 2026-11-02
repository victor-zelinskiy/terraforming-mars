import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceId} from '../../src/common/Types';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {SeededRandom} from '../../src/common/utils/Random';
import {VastitasBorealisBoard} from '../../src/server/boards/VastitasBorealisBoard';
import {LEGENDS} from '../../src/client/components/Legends';
import {SPECIAL_CELL_INFO, getSpecialCellInfo} from '../../src/client/components/board/specialCellInfo';

/**
 * VASTITAS BOREALIS, THE FAN MAP — its premium markers are pinned to the cells that EARN them, read off the server
 * board itself (the Nova board's guard, applied to the older map): every volcanic cell carries a named marker and
 * every volcano marker sits on a volcanic cell; the North Pole marker sits on the printed TEMPERATURE_4MC bonus;
 * no legacy SVG caption is left for this map; and no marker of the Nova board leaks onto it.
 */
describe('Vastitas Borealis (fan map) — the cell markers sit on the cells that earn them', () => {
  const board = VastitasBorealisBoard.newInstance(DEFAULT_GAME_OPTIONS, new SeededRandom(0));
  const markers = SPECIAL_CELL_INFO.filter((m) => m.boardName === BoardName.VASTITAS_BOREALIS);
  const space = (id: SpaceId) => board.getSpaceOrThrow(id);

  it('every volcanic cell is named, and every volcano marker is on a volcanic cell', () => {
    const volcanic = board.spaces.filter((s) => s.volcanic === true).map((s) => s.id).sort();
    expect(volcanic).deep.eq(['07', '12', '21', '22']);
    for (const id of volcanic) {
      expect(getSpecialCellInfo(id, BoardName.VASTITAS_BOREALIS), `volcano ${id}`).is.not.undefined;
    }
    const named = ['Elysium Mons', 'Alba Fossae', 'Ceranius Fossae', 'Alba Mons'];
    for (const title of named) {
      const marker = markers.find((m) => m.title === title);
      expect(marker, title).is.not.undefined;
      expect(space(marker!.spaceId).volcanic, `${title} on ${marker!.spaceId}`).is.true;
    }
  });

  it('the North Pole marker sits on the printed TEMPERATURE_4MC bonus — the map\'s one special cell', () => {
    const pole = markers.find((m) => m.title === 'North Pole');
    expect(pole).is.not.undefined;
    expect(space(pole!.spaceId).bonus).to.include(SpaceBonus.TEMPERATURE_4MC);
    expect(board.spaces.filter((s) => s.bonus.includes(SpaceBonus.TEMPERATURE_4MC)).map((s) => s.id)).deep.eq([pole!.spaceId]);
    // The pole is FIXED (`doNotShuffleLastSpace`): the marker id survives a shuffled map too.
    const shuffled = VastitasBorealisBoard.newInstance({...DEFAULT_GAME_OPTIONS, shuffleMapOption: true}, new SeededRandom(7));
    expect(shuffled.getSpaceOrThrow(pole!.spaceId).bonus).to.include(SpaceBonus.TEMPERATURE_4MC);
  });

  it('exactly five markers — four volcanoes and the pole — and no Viking site (this map prints no delegate)', () => {
    expect(markers.map((m) => m.title).sort()).deep.eq(['Alba Fossae', 'Alba Mons', 'Ceranius Fossae', 'Elysium Mons', 'North Pole']);
    expect(board.spaces.some((s) => s.bonus.includes(SpaceBonus.DELEGATE))).is.false;
  });

  it('no legacy SVG caption is left for this map', () => {
    expect(LEGENDS[BoardName.VASTITAS_BOREALIS]).deep.eq([]);
  });

  it('no marker of the Nova board leaks onto the fan map, and vice versa', () => {
    for (const m of SPECIAL_CELL_INFO.filter((m) => m.boardName === BoardName.VASTITAS_BOREALIS_NOVA)) {
      expect(getSpecialCellInfo(m.spaceId, BoardName.VASTITAS_BOREALIS)?.id, m.id).not.eq(m.id);
    }
    for (const m of markers) {
      expect(getSpecialCellInfo(m.spaceId, BoardName.VASTITAS_BOREALIS_NOVA)?.id, m.id).not.eq(m.id);
    }
  });
});
