/*
 * CONSOLE PRODUCTION-LOSS MODEL — the PURE brain of the console-native
 * "reduce your production" surface (ConsoleProductionLoss.vue), the dedicated
 * premium replacement for the generic distribute lanes when an Ares
 * hazard-adjacency penalty (or a card attack) forces a production reduction.
 *
 * Mirrors consoleGovernmentSupport.ts: no Vue / DOM / i18n — it derives the
 * six production rows from the SAME `SelectProductionToLoseModel` the desktop
 * ModernProductionToLose reads (the component maps unit → icon / name / reason
 * i18n keys), so the two premium surfaces can't diverge. Unit-tested under the
 * server runner (tests/client/components/console/consoleProductionLoss.spec.ts).
 */

import {Units} from '@/common/Units';

/** Production rows in the resource-cluster display order (M€ first). */
export const PRODUCTION_UNITS: ReadonlyArray<keyof Units> =
  ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

/**
 * How many units of `unit` production can be expended. Mirrors the server's
 * `StockBase.canAdjust` floor (megacredit production down to -5, every other
 * resource to 0) and the desktop `ModernProductionToLose.maxFor`, so what the
 * UI offers and what the server accepts cannot diverge.
 */
export function expendableProduction(unit: keyof Units, production: number): number {
  return unit === 'megacredits' ? production + 5 : production;
}

export type ProductionLossRow = {
  unit: keyof Units;
  /** Current production (megacredits can be negative). */
  current: number;
  /** Max reducible from this row (the expendable amount, never below 0). */
  max: number;
  /** Nothing can be taken here — already at the production floor. */
  disabled: boolean;
  /** Set when the row can't absorb the FULL loss alone (0 < max < cost). */
  limitedTo?: number;
};

/**
 * The six production rows for a `cost`-unit loss, in cluster order. `units` is
 * the player's current production (`payProduction.units`), `cost` the number of
 * steps to shed (`payProduction.cost` — 1 or 2 for the Ares hazard case).
 */
export function buildProductionLossRows(units: Units, cost: number): Array<ProductionLossRow> {
  return PRODUCTION_UNITS.map((unit) => {
    const current = units[unit];
    const max = Math.max(0, expendableProduction(unit, current));
    const row: ProductionLossRow = {unit, current, max, disabled: max <= 0};
    if (max > 0 && max < cost) {
      row.limitedTo = max;
    }
    return row;
  });
}

/** The first selectable (non-disabled) row, or 0 if every row is disabled. */
export function firstSelectableIndex(rows: ReadonlyArray<ProductionLossRow>): number {
  const i = rows.findIndex((r) => !r.disabled);
  return i === -1 ? 0 : i;
}
