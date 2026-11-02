import {ALT_VENUS_MINIMUM_BONUS, MAX_VENUS_SCALE} from '../constants';

/**
 * THE ALTERNATIVE VENUS BOARD'S BONUS FOR ONE RAISE (P89 · ledger EE) — the ONE arithmetic the engine pays by
 * (`Game.increaseVenusScaleLevel`) and every preview / door names in advance («› ДАЛЕЕ: БОНУС ВЕНЕРЫ»):
 *  · `standard` — one standard resource per step made at or above 16 % (the 16 → 18 … 28 → 30 cells);
 *  · `wild`     — the 30 % finish adds one wild resource (a card resource or one more standard one).
 * `undefined` when the raise pays no bonus (below 16 %, no step left). `steps` is the REQUESTED number of steps; the
 * clamp at 30 % is applied here, exactly as the engine clamps.
 */
export type AltVenusBonus = {standard: number, wild: boolean, from: number, to: number};

export function altVenusBonusFor(level: number, steps: number): AltVenusBonus | undefined {
  if (steps <= 0 || level >= MAX_VENUS_SCALE) {
    return undefined;
  }
  const made = Math.min(steps, (MAX_VENUS_SCALE - level) / 2);
  const to = level + made * 2;
  const standard = Math.max((Math.min(to, MAX_VENUS_SCALE) - Math.max(level, ALT_VENUS_MINIMUM_BONUS)) / 2, 0);
  const wild = to >= MAX_VENUS_SCALE;
  if (standard === 0 && !wild) {
    return undefined;
  }
  return {standard, wild, from: level, to};
}
