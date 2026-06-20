import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceName} from '@/common/boards/SpaceName';
import {getSpecialCellInfo} from '@/client/components/board/specialCellInfo';

// Titles/descriptions are English source strings rendered through
// translateText() in SpecialCellInfoOverlay, so we assert the English keys.
describe('specialCellInfo', () => {
  it('scopes overlapping Mars space ids to the current board', () => {
    expect(getSpecialCellInfo('14', BoardName.THARSIS)?.title).eq('Ascraeus Mons');
    expect(getSpecialCellInfo('14', BoardName.ELYSIUM)?.title).eq('Elysium Mons');
  });

  it('keeps Tharsis-only cells off Elysium', () => {
    expect(getSpecialCellInfo(SpaceName.NOCTIS_CITY, BoardName.THARSIS)?.title).eq('Noctis City');
    expect(getSpecialCellInfo(SpaceName.NOCTIS_CITY, BoardName.ELYSIUM)).eq(undefined);
  });

  it('keeps global off-board cells available on every board', () => {
    expect(getSpecialCellInfo(SpaceName.GANYMEDE_COLONY, BoardName.THARSIS)?.title).eq('Ganymede Colony');
    expect(getSpecialCellInfo(SpaceName.GANYMEDE_COLONY, BoardName.ELYSIUM)?.title).eq('Ganymede Colony');
  });

  it('labels the named cells on Amazonis, Vastitas Borealis and Terra Cimmeria', () => {
    expect(getSpecialCellInfo('09', BoardName.AMAZONIS)?.title).eq('Albor Tholus');
    expect(getSpecialCellInfo('49', BoardName.AMAZONIS)?.title).eq('Ulysses Tholus');
    expect(getSpecialCellInfo('07', BoardName.VASTITAS_BOREALIS)?.title).eq('Elysium Mons');
    expect(getSpecialCellInfo('22', BoardName.VASTITAS_BOREALIS)?.title).eq('Alba Mons');
    expect(getSpecialCellInfo('27', BoardName.TERRA_CIMMERIA)?.title).eq('Apollinaris Mons');
    expect(getSpecialCellInfo('38', BoardName.TERRA_CIMMERIA)?.title).eq('Hadriacus Mons');
  });

  it('scopes the new map cells so overlapping ids do not leak across boards', () => {
    // Space id '21' is a different named cell on each board it appears on.
    expect(getSpecialCellInfo('21', BoardName.THARSIS)?.title).eq('Pavonis Mons');
    expect(getSpecialCellInfo('21', BoardName.VASTITAS_BOREALIS)?.title).eq('Ceranius Fossae');
    expect(getSpecialCellInfo('21', BoardName.TERRA_CIMMERIA)?.title).eq('Tyrrhenus Mons');
    // Terra Cimmeria reuses the same volcano cells (and names) as its Nova variant.
    expect(getSpecialCellInfo('21', BoardName.TERRA_CIMMERIA)?.title)
      .eq(getSpecialCellInfo('21', BoardName.TERRA_CIMMERIA_NOVA)?.title);
  });
});
