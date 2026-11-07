import {ALT_VENUS_MINIMUM_BONUS, MAX_VENUS_SCALE} from '../constants';
import {venusLevelAfterSteps, venusStepsBetween} from './venusScale';

/**
 * THE ALTERNATIVE BOARD PRINTS SEVEN CELLS on every track — the classic 18 … 30 (the finish the last) — and a longer
 * track keeps the count and STARTS LATER (the owner, 2026-11-07 — Amazonis Planitia's 33 % track: 24 · 26 · 28 · 30 · 31 ·
 * 32 · 33, the double bonus still at the very end; `docs/claude/amazonis-planitia-phase-1.md` § Alt Venus).
 */
export const ALT_VENUS_CELL_COUNT = venusStepsBetween(ALT_VENUS_MINIMUM_BONUS, MAX_VENUS_SCALE);

/** The level the alternative board's first cell is earned FROM on a track ending at `maxVenus` (16 % classic, 22 % on 33). */
export function altVenusMinimumFor(maxVenus: number = MAX_VENUS_SCALE): number {
  return venusLevelAfterSteps(maxVenus, -ALT_VENUS_CELL_COUNT);
}

/**
 * THE ALTERNATIVE VENUS BOARD'S BONUS FOR ONE RAISE (P89 · ledger EE) — the ONE arithmetic the engine pays by
 * (`Game.increaseVenusScaleLevel`) and every preview / door names in advance («› ДАЛЕЕ: БОНУС ВЕНЕРЫ»):
 *  · `standard` — one standard resource per STEP made into one of the board's seven cells (classic 16 → 18 … 28 → 30;
 *    on Amazonis Planitia's 33 % track 22 → 24 … 30 → 31 → 32 → 33 — `altVenusMinimumFor`);
 *  · `wild`     — the track's FINISH (30 %; the map's maximum — 33 % on Amazonis Planitia) adds one wild resource (a
 *    card resource or one more standard one).
 * `undefined` when the raise pays no bonus (below the first cell, no step left). `steps` is the REQUESTED number of
 * steps; the clamp at the map's maximum (`maxVenus`, default the classic 30 %) is applied here, exactly as the engine
 * clamps.
 */
export type AltVenusBonus = {standard: number, wild: boolean, from: number, to: number};

export function altVenusBonusFor(level: number, steps: number, maxVenus: number = MAX_VENUS_SCALE): AltVenusBonus | undefined {
  if (steps <= 0 || level >= maxVenus) {
    return undefined;
  }
  const made = Math.min(steps, venusStepsBetween(level, maxVenus));
  const to = venusLevelAfterSteps(level, made);
  const standard = Math.max(venusStepsBetween(Math.max(level, altVenusMinimumFor(maxVenus)), Math.min(to, maxVenus)), 0);
  const wild = to >= maxVenus;
  if (standard === 0 && !wild) {
    return undefined;
  }
  return {standard, wild, from: level, to};
}

/**
 * The Venus levels of the alternative board's seven resource CELLS on a track ending at `maxVenus` (18, 20 … 30; on a
 * 33 % track 24 … 30, 31, 32, 33). A cell is keyed `venus-<level>` on the board (the claims, the bonus-cell beat). The
 * last one is the finish (it also pays the wild).
 */
export function altVenusResourceCells(maxVenus: number = MAX_VENUS_SCALE): ReadonlyArray<number> {
  const cells: Array<number> = [];
  for (let level = venusLevelAfterSteps(altVenusMinimumFor(maxVenus), 1); level <= maxVenus; level = venusLevelAfterSteps(level, 1)) {
    cells.push(level);
  }
  return cells;
}
