import {expect} from 'chai';
import {altVenusBonusFor, altVenusResourceCells} from '../../../src/common/venus/altVenusBonus';

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

  // Amazonis Planitia (track to 33 %, 1 % steps above 30) — the owner's rule 2026-11-06: a step = a resource, the wild
  // on the map's maximum.
  const amazonis: ReadonlyArray<[number, number, ReturnType<typeof altVenusBonusFor>]> = [
    [28, 1, {standard: 1, wild: false, from: 28, to: 30}],
    [28, 2, {standard: 2, wild: false, from: 28, to: 31}],
    [30, 1, {standard: 1, wild: false, from: 30, to: 31}],
    [31, 3, {standard: 2, wild: true, from: 31, to: 33}],
    [32, 1, {standard: 1, wild: true, from: 32, to: 33}],
    [33, 1, undefined],
    [14, 12, {standard: 10, wild: true, from: 14, to: 33}],
  ];
  for (const [level, steps, want] of amazonis) {
    it(`Amazonis Planitia: ${level} % + ${steps} step(s) → ${JSON.stringify(want)}`, () => {
      expect(altVenusBonusFor(level, steps, 33)).deep.eq(want);
    });
  }

  it('the resource cells follow the track', () => {
    expect(altVenusResourceCells()).deep.eq([18, 20, 22, 24, 26, 28, 30]);
    expect(altVenusResourceCells(33)).deep.eq([18, 20, 22, 24, 26, 28, 30, 31, 32, 33]);
  });
});
