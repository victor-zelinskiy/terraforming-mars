import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceName} from '@/common/boards/SpaceName';
import {getSpecialCellInfo} from '@/client/components/board/specialCellInfo';

describe('specialCellInfo', () => {
  it('scopes overlapping Mars space ids to the current board', () => {
    expect(getSpecialCellInfo('14', BoardName.THARSIS)?.title).eq('Гора Аскрийская');
    expect(getSpecialCellInfo('14', BoardName.ELYSIUM)?.title).eq('Гора Элизий');
  });

  it('keeps Tharsis-only cells off Elysium', () => {
    expect(getSpecialCellInfo(SpaceName.NOCTIS_CITY, BoardName.THARSIS)?.title).eq('Город Ночи');
    expect(getSpecialCellInfo(SpaceName.NOCTIS_CITY, BoardName.ELYSIUM)).eq(undefined);
  });

  it('keeps global off-board cells available on every board', () => {
    expect(getSpecialCellInfo(SpaceName.GANYMEDE_COLONY, BoardName.THARSIS)?.title).eq('Колония на Ганимеде');
    expect(getSpecialCellInfo(SpaceName.GANYMEDE_COLONY, BoardName.ELYSIUM)?.title).eq('Колония на Ганимеде');
  });
});
