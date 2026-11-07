import {expect} from 'chai';
import {ALT_VENUS_CELL_COUNT, altVenusBonusFor, altVenusMinimumFor, altVenusResourceCells} from '../../../src/common/venus/altVenusBonus';

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

  // Amazonis Planitia (track to 33 %, 1 % steps above 30) — the owner's rule 2026-11-07: the board's SEVEN cells, as many
  // as the classic board's, starting later (24 · 26 · 28 · 30 · 31 · 32 · 33), the wild on the map's maximum.
  const amazonis: ReadonlyArray<[number, number, ReturnType<typeof altVenusBonusFor>]> = [
    [16, 1, undefined],
    [20, 1, undefined],
    [20, 2, {standard: 1, wild: false, from: 20, to: 24}],
    [22, 1, {standard: 1, wild: false, from: 22, to: 24}],
    [28, 1, {standard: 1, wild: false, from: 28, to: 30}],
    [28, 2, {standard: 2, wild: false, from: 28, to: 31}],
    [30, 1, {standard: 1, wild: false, from: 30, to: 31}],
    [31, 3, {standard: 2, wild: true, from: 31, to: 33}],
    [32, 1, {standard: 1, wild: true, from: 32, to: 33}],
    [33, 1, undefined],
    [14, 12, {standard: 7, wild: true, from: 14, to: 33}],
  ];
  for (const [level, steps, want] of amazonis) {
    it(`Amazonis Planitia: ${level} % + ${steps} step(s) → ${JSON.stringify(want)}`, () => {
      expect(altVenusBonusFor(level, steps, 33)).deep.eq(want);
    });
  }

  it('every track prints the classic board\'s seven cells — a longer one starts later', () => {
    expect(ALT_VENUS_CELL_COUNT).eq(7);
    expect(altVenusResourceCells()).deep.eq([18, 20, 22, 24, 26, 28, 30]);
    expect(altVenusResourceCells(33)).deep.eq([24, 26, 28, 30, 31, 32, 33]);
    expect([altVenusMinimumFor(), altVenusMinimumFor(33)]).deep.eq([16, 22]);
  });
});
