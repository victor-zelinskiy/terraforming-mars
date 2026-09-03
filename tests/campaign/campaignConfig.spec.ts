import {expect} from 'chai';
import {PLACE_BONUS_MC, PLACE_TITLES, TITLE_TABLE, bonusForPlace, titleForPlace} from '../../src/common/campaign/campaignConfig';

describe('campaignConfig', () => {
  it('approved Title Points: 15/10/5, chevrons stay visual rank 3/2/1', () => {
    expect(TITLE_TABLE.governor.titlePoints).eq(15);
    expect(TITLE_TABLE.administrator.titlePoints).eq(10);
    expect(TITLE_TABLE.prefect.titlePoints).eq(5);
    expect(TITLE_TABLE.governor.chevrons).eq(3);
    expect(TITLE_TABLE.administrator.chevrons).eq(2);
    expect(TITLE_TABLE.prefect.chevrons).eq(1);
  });

  it('2 participants: Governor and Administrator', () => {
    expect(titleForPlace(1, 2)).eq('governor');
    expect(titleForPlace(2, 2)).eq('administrator');
    expect(titleForPlace(3, 2)).eq(undefined);
  });

  it('3 participants: all three titles', () => {
    expect(titleForPlace(1, 3)).eq('governor');
    expect(titleForPlace(2, 3)).eq('administrator');
    expect(titleForPlace(3, 3)).eq('prefect');
  });

  it('4-5 participants: only the top three receive titles', () => {
    for (const seats of [4, 5]) {
      expect(titleForPlace(1, seats)).eq('governor');
      expect(titleForPlace(2, seats)).eq('administrator');
      expect(titleForPlace(3, seats)).eq('prefect');
      expect(titleForPlace(4, seats)).eq(undefined);
      expect(titleForPlace(5, seats)).eq(undefined);
    }
  });

  it('bonus ladder is 0/5/10/15/15 and clamps beyond the table', () => {
    expect(PLACE_BONUS_MC).deep.eq([0, 5, 10, 15, 15]);
    expect(bonusForPlace(1)).eq(0);
    expect(bonusForPlace(2)).eq(5);
    expect(bonusForPlace(3)).eq(10);
    expect(bonusForPlace(4)).eq(15);
    expect(bonusForPlace(5)).eq(15);
    expect(bonusForPlace(6)).eq(15);
  });

  it('every PLACE_TITLES row is consistent with its seat count', () => {
    for (const [seats, row] of Object.entries(PLACE_TITLES)) {
      expect(row.length).eq(Number(seats));
    }
  });
});
