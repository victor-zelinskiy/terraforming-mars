import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {vpProgressView} from '@/client/components/actions/actionVpProgress';

describe('vpProgressView', () => {
  it('Tardigrades (1 VP / 4 microbes): 2 → 3 reads 2/4 → 3/4, no VP earned', () => {
    const v = vpProgressView(CardName.TARDIGRADES, 2, 3);
    expect(v.applicable).is.true;
    expect(v.per).eq(4);
    expect(v.filledBefore).eq(2);
    expect(v.filledAfter).eq(3);
    expect(v.beforeVp).eq(0);
    expect(v.afterVp).eq(0);
    expect(v.crossed).is.false;
  });

  it('crossing a threshold lands on a FULL bar (3 → 4 = 3/4 → 4/4, +1 VP)', () => {
    const v = vpProgressView(CardName.TARDIGRADES, 3, 4);
    expect(v.filledBefore).eq(3);
    expect(v.filledAfter).eq(4); // full ("reached"), not an empty 0/4
    expect(v.beforeVp).eq(0);
    expect(v.afterVp).eq(1);
    expect(v.crossed).is.true;
  });

  it('after a threshold the next fill restarts from 0 (4 → 5 = 0/4 → 1/4)', () => {
    const v = vpProgressView(CardName.TARDIGRADES, 4, 5);
    expect(v.filledBefore).eq(0);
    expect(v.filledAfter).eq(1);
    expect(v.beforeVp).eq(1);
    expect(v.afterVp).eq(1);
    expect(v.crossed).is.false;
  });

  it('Ants (1 VP / 2 microbes): per is 2, 1 → 2 earns a VP and fills the bar', () => {
    const v = vpProgressView(CardName.ANTS, 1, 2);
    expect(v.applicable).is.true;
    expect(v.per).eq(2);
    expect(v.crossed).is.true;
    expect(v.filledAfter).eq(2);
    expect(v.afterVp).eq(1);
  });
});
