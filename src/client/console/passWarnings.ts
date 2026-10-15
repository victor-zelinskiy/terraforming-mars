/*
 * WHAT THE PASS LEAVES UNUSED — the pass confirm's list, pure (the owner's iteration of 2026-10-15).
 *
 * The pass warns about what the player is giving up for the rest of the generation; an action that would change
 * NOTHING (the server's «no effect» verdict — a heat conversion at the temperature's maximum, Water Splitting Plant
 * at 14 % oxygen, Search For Life holding its science) is no opportunity and must not be listed as one: it only sent
 * the player looking for a move that was not there. When nothing BUT such actions is left, the confirm says so in
 * one QUIET line (the owner's decision — «Остались только действия без эффекта: N»), without the warning's tone, and
 * the pass verb stays calm.
 *
 * Every fact is the server's (`PotentialActionsModel.futileCardActions`, the heat option's `metadata.futile`); this
 * module only decides what the list says. Unit-tested under the server runner: tests/console/passWarnings.spec.ts.
 */

/** The facts the pass confirm weighs — read by the shell, judged here. */
export type PassFacts = {
  /** Card + party actions the player could still take (every legal one). */
  cardActions: number;
  /** Of those, the ones that would change nothing right now. */
  futileCardActions: number;
  /** A colony trade is still possible (a free fleet and a way to pay). */
  trade: boolean;
  /** Plants can still become a greenery. */
  plants: boolean;
  /** The heat conversion: not offered · offered and worth it · offered and changing nothing. */
  heat: 'none' | 'useful' | 'futile';
  /** A Hydronetwork advance is still possible. */
  hydro: boolean;
};

/** One line of the list: an i18n key and, for a count, its number (already a string). */
export type PassLine = {key: string, count?: string};

export type PassWarnings = {
  /** What the pass leaves unused — the warning (the bar's «Пас» wears the danger ink while any stands). */
  lines: ReadonlyArray<PassLine>;
  /** Nothing of value is left, only actions with no effect: the ONE quiet line (never a warning). */
  quiet?: PassLine;
};

export function passWarnings(facts: PassFacts): PassWarnings {
  const lines: Array<PassLine> = [];
  const useful = Math.max(0, facts.cardActions - facts.futileCardActions);
  if (useful > 0) {
    lines.push({key: 'You still have unused available actions', count: String(useful)});
  }
  if (facts.trade) {
    lines.push({key: 'You still have a free trade fleet and can afford a colony trade'});
  }
  if (facts.plants) {
    lines.push({key: 'You can still convert plants into greenery'});
  }
  if (facts.heat === 'useful') {
    lines.push({key: 'You can still convert heat into temperature'});
  }
  if (facts.hydro) {
    lines.push({key: 'You can still advance the Hydronetwork this generation'});
  }
  const futile = Math.max(0, Math.min(facts.futileCardActions, facts.cardActions)) + (facts.heat === 'futile' ? 1 : 0);
  if (lines.length === 0 && futile > 0) {
    return {lines, quiet: {key: 'Only actions with no effect remain', count: String(futile)}};
  }
  return {lines};
}
