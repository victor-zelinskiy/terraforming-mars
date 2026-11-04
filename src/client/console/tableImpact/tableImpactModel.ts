/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «WHOM THE PLAY HITS» — a play that hits the other seats WITHOUT a choice (P59 Recession: «EACH OPPONENT loses 5 M€
 * and 1 M€ production») shows its victims before the press (invariant 3), read off the server's read-only preview step
 * (`TableImpactStep`). Pure: the hosts ask what a branch's table zone holds; the numbers are the server's, verbatim
 * (`TargetImpactChange` — a MarsBot's track row included, never re-derived and never branched on here).
 */
import {ActionPreview, ActionPreviewBranch, TableImpactStep} from '@/common/models/ActionPreviewModel';
import {Color} from '@/common/Color';
import {TargetImpactChange} from '@/common/models/TargetImpactModel';

export type TableImpactRowView = {
  color: Color;
  /** The seat's display name (the host's players — a bot named as the table names it). */
  name: string;
  /** The server's rows, in the printed order. */
  changes: ReadonlyArray<TargetImpactChange>;
  /** The part of the attack the seat is spared — its icon, size and reason key (translated by the host). */
  spared?: {scope: 'production' | 'stock', icon: string, amount: number, reason: string};
};

export type TableImpactView = {
  /** The zone's head key («Opponents»). */
  title: string;
  rows: ReadonlyArray<TableImpactRowView>;
};

/** The table-impact step of a branch — undefined for every play that hits nobody without a choice. */
export function tableImpactStepOf(branch: ActionPreviewBranch | undefined): TableImpactStep | undefined {
  return branch?.steps.find((s): s is TableImpactStep => s.kind === 'tableImpact');
}

/** The same for a whole preview's branch `position` (a prelude with no choice: branch 0). */
export function tableImpactOfPreview(preview: ActionPreview | undefined, position = 0): TableImpactStep | undefined {
  return tableImpactStepOf(preview?.branches?.[position] ?? preview?.branches?.[0]);
}

/** The rows a host renders — every seat the server listed, named through `nameOf` (the host's player list). */
export function tableImpactView(step: TableImpactStep | undefined, nameOf: (color: Color) => string): TableImpactView | undefined {
  if (step === undefined || step.rows.length === 0) {
    return undefined;
  }
  const title = typeof step.title === 'string' ? step.title : step.title.message;
  return {
    title,
    rows: step.rows.map((r) => ({
      color: r.color,
      name: nameOf(r.color),
      changes: r.impact.changes,
      ...(r.skipped !== undefined ? {spared: r.skipped} : {}),
    })),
  };
}
