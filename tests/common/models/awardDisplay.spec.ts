import {expect} from 'chai';
import {awardLeaders} from '@/common/models/awardDisplay';
import {AwardScore} from '@/common/models/FundedAwardModel';
import type {Color} from '@/common/Color';

/**
 * The single shared award-leader derivation used by the console-native list,
 * the desktop plaque marker and the tooltips — so they can never disagree.
 */
describe('awardDisplay.awardLeaders', () => {
  const s = (color: Color, score: number): AwardScore => ({color, score});

  it('returns the single top scorer', () => {
    expect(awardLeaders([s('red', 5), s('blue', 2), s('green', 3)]))
      .to.deep.eq([{color: 'red', score: 5}]);
  });

  it('returns EVERY player tied at the top (multi-way tie)', () => {
    const leaders = awardLeaders([s('red', 4), s('blue', 4), s('green', 1)]);
    expect(leaders).to.deep.eq([{color: 'red', score: 4}, {color: 'blue', score: 4}]);
  });

  it('preserves the input player order among tied leaders', () => {
    const leaders = awardLeaders([s('green', 4), s('red', 4)]);
    expect(leaders.map((l) => l.color)).to.deep.eq(['green', 'red']);
  });

  it('is empty when the top score is 0 (no meaningful leader yet)', () => {
    expect(awardLeaders([s('red', 0), s('blue', 0)])).to.deep.eq([]);
  });

  it('is empty for no scores', () => {
    expect(awardLeaders([])).to.deep.eq([]);
  });

  it('ignores negative scores as non-leading', () => {
    expect(awardLeaders([s('red', -1), s('blue', 0)])).to.deep.eq([]);
  });
});
