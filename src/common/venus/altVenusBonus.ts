import {ALT_VENUS_MINIMUM_BONUS, MAX_VENUS_SCALE} from '../constants';
import {venusLevelAfterSteps, venusStepsBetween} from './venusScale';

/**
 * THE ALTERNATIVE VENUS BOARD'S BONUS FOR ONE RAISE (P89 · ledger EE) — the ONE arithmetic the engine pays by
 * (`Game.increaseVenusScaleLevel`) and every preview / door names in advance («› ДАЛЕЕ: БОНУС ВЕНЕРЫ»):
 *  · `standard` — one standard resource per STEP made at or above 16 % (the 16 → 18 … 28 → 30 cells — and on Amazonis
 *    Planitia's longer track the 1 % steps 30 → 31 → 32 → 33 too, one resource each);
 *  · `wild`     — the track's FINISH (30 %; the map's maximum — 33 % on Amazonis Planitia) adds one wild resource (a
 *    card resource or one more standard one).
 * The owner's rule for Amazonis Planitia (2026-11-06 — `docs/claude/amazonis-planitia-phase-1.md` § Alt Venus): «a step =
 * a resource, the wild on 33» — upstream's own arithmetic for the pair, the Alt Venus board kept compatible.
 * `undefined` when the raise pays no bonus (below 16 %, no step left). `steps` is the REQUESTED number of steps; the
 * clamp at the map's maximum (`maxVenus`, default the classic 30 %) is applied here, exactly as the engine clamps.
 */
export type AltVenusBonus = {standard: number, wild: boolean, from: number, to: number};

export function altVenusBonusFor(level: number, steps: number, maxVenus: number = MAX_VENUS_SCALE): AltVenusBonus | undefined {
  if (steps <= 0 || level >= maxVenus) {
    return undefined;
  }
  const made = Math.min(steps, venusStepsBetween(level, maxVenus));
  const to = venusLevelAfterSteps(level, made);
  const standard = Math.max(venusStepsBetween(Math.max(level, ALT_VENUS_MINIMUM_BONUS), Math.min(to, maxVenus)), 0);
  const wild = to >= maxVenus;
  if (standard === 0 && !wild) {
    return undefined;
  }
  return {standard, wild, from: level, to};
}

/**
 * The Venus levels of the alternative board's resource CELLS on a track ending at `maxVenus` — one per step from 16 %
 * (18, 20 … 30; on a 33 % track 31, 32, 33 as well). A cell is keyed `venus-<level>` on the board (the claims, the
 * bonus-cell beat). The last one is the finish (it also pays the wild).
 */
export function altVenusResourceCells(maxVenus: number = MAX_VENUS_SCALE): ReadonlyArray<number> {
  const cells: Array<number> = [];
  for (let level = venusLevelAfterSteps(ALT_VENUS_MINIMUM_BONUS, 1); level <= maxVenus; level = venusLevelAfterSteps(level, 1)) {
    cells.push(level);
  }
  return cells;
}
