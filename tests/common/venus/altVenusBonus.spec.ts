import {expect} from 'chai';
import {altVenusBonusFor} from '../../../src/common/venus/altVenusBonus';

/** P89 · EE — the alternative Venus board's bonus for one raise: ONE arithmetic for the engine and the previews. */
describe('altVenusBonusFor', () => {
  const cases: ReadonlyArray<[number, number, ReturnType<typeof altVenusBonusFor>]> = [
    [10, 1, undefined],
    [14, 1, undefined],
    [14, 2, {standard: 1, wild: false, from: 14, to: 18}],
    [16, 1, {standard: 1, wild: false, from: 16, to: 18}],
    [26, 3, {standard: 2, wild: true, from: 26, to: 30}],
    [28, 1, {standard: 1, wild: true, from: 28, to: 30}],
    [30, 1, undefined],
    [16, 0, undefined],
  ];
  for (const [level, steps, want] of cases) {
    it(`${level} % + ${steps} step(s) → ${JSON.stringify(want)}`, () => {
      expect(altVenusBonusFor(level, steps)).deep.eq(want);
    });
  }
});
