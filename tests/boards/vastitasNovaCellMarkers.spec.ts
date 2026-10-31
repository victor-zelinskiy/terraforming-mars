import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceId} from '../../src/common/Types';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {SeededRandom} from '../../src/common/utils/Random';
import {VastitasBorealisNovaBoard} from '../../src/server/boards/VastitasBorealisNovaBoard';
import {SPECIAL_CELL_INFO, getSpecialCellInfo} from '../../src/client/components/board/specialCellInfo';

/**
 * VASTITAS BOREALIS NOVA — the hover markers that replaced the legacy SVG labels are pinned to the cells that
 * EARN them, read off the server board itself: every volcanic cell carries a named marker, the two Viking markers
 * sit on the printed DELEGATE bonus, the North Pole on the printed TEMPERATURE_4MC bonus. A marker id moved by one
 * row would otherwise name the wrong hex in silence.
 */
describe('Vastitas Borealis Nova — the cell markers sit on the cells that earn them', () => {
  const board = VastitasBorealisNovaBoard.newInstance(DEFAULT_GAME_OPTIONS, new SeededRandom(0));
  const markers = SPECIAL_CELL_INFO.filter((m) => m.boardName === BoardName.VASTITAS_BOREALIS_NOVA);
  const space = (id: SpaceId) => board.getSpaceOrThrow(id);

  it('every volcanic cell is named, and every volcano marker is on a volcanic cell', () => {
    const volcanic = board.spaces.filter((s) => s.volcanic === true).map((s) => s.id).sort();
    expect(volcanic).has.length(4);
    for (const id of volcanic) {
      expect(getSpecialCellInfo(id, BoardName.VASTITAS_BOREALIS_NOVA), `volcano ${id}`).is.not.undefined;
    }
    const named = ['Hecates Tholus', 'Elysium Mons', 'Alba Mons', 'Uranius Tholus'];
    for (const title of named) {
      const marker = markers.find((m) => m.title === title);
      expect(marker, title).is.not.undefined;
      expect(space(marker!.spaceId).volcanic, `${title} on ${marker!.spaceId}`).is.true;
    }
  });

  it('the two Viking markers sit on the printed DELEGATE bonus', () => {
    const vikings = markers.filter((m) => m.title.startsWith('Viking'));
    expect(vikings).has.length(2);
    for (const marker of vikings) {
      expect(space(marker.spaceId).bonus, marker.title).to.include(SpaceBonus.DELEGATE);
    }
    expect(board.spaces.filter((s) => s.bonus.includes(SpaceBonus.DELEGATE)).map((s) => s.id).sort())
      .deep.eq(vikings.map((m) => m.spaceId).sort());
  });

  it('the North Pole marker sits on the printed TEMPERATURE_4MC bonus', () => {
    const pole = markers.find((m) => m.title === 'North Pole');
    expect(pole).is.not.undefined;
    expect(space(pole!.spaceId).bonus).to.include(SpaceBonus.TEMPERATURE_4MC);
  });

  it('no marker of the older fan map leaks onto the Nova board', () => {
    for (const m of SPECIAL_CELL_INFO.filter((m) => m.boardName === BoardName.VASTITAS_BOREALIS)) {
      expect(getSpecialCellInfo(m.spaceId, BoardName.VASTITAS_BOREALIS_NOVA)?.id).not.eq(m.id);
    }
  });
});
