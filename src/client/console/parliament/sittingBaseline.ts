/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SITTING'S BASELINE (Turmoil Redux, the soft gates —
 * docs/claude/console/parliament-soft-gates.md): what every detector of the
 * sitting's walk diffs a response against — the enactment's display holds,
 * the reward's wave, the Agenda bonus, the Career's walks, the table's
 * receipt, the world's move, a card's answer to the change of power.
 *
 * Since the soft gates the server runs the whole chain in ONE response (up to
 * the law's first ask, or to its end), so the view before it usually has NO
 * sitting at all: the action phase of the same generation, the table as it
 * stood. That view is a baseline too — an EMPTY sitting (nothing recorded,
 * the verdict not yet read). A first view (a reload) or a view of another
 * generation is none: there is nothing to move from, and the walk lands in
 * its final poses. Pure; types only.
 */
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentPhaseModel} from '@/common/models/ParliamentModel';

export function sittingBaselineOf(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): ParliamentPhaseModel | undefined {
  const now = after?.game.parliament?.phase;
  if (before === undefined || now === undefined) {
    return undefined;
  }
  const was = before.game.parliament?.phase;
  if (was !== undefined) {
    return was.generation === now.generation ? was : undefined;
  }
  if (before.game.generation !== now.generation) {
    return undefined;
  }
  return {generation: now.generation, final: now.final, step: 'winner'};
}
