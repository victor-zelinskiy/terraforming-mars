import {IPlayer} from '../IPlayer';
import {SkippedEffectFact} from '../../common/events/EventImpact';
import type {SkippedEffect} from '../cards/actionPreviews';

/**
 * NO SILENT LOSS — THE LIVE HALF.
 *
 * The play preview already warns BEFORE the commit that an effect will be
 * skipped (`actionPreviews.warningNote` / `targetStepOrWarning` with a
 * `SKIPPED_LABEL`). Once the play goes ahead, the step that finds no holder /
 * no target calls THIS, with the same description, so the loss is named
 * AFTER the fact too:
 *  - the structured `effect-skipped` event, under the live scope — the
 *    journal draws it as its own row of the play's chain and the other
 *    players' notification names it (`impact.skipped`);
 *  - one typed log line, for every reader of the text log (`log: false` for a
 *    caller that writes a more specific line of its own — the Ares adjacency
 *    bonus).
 *
 * Only the step that OWNS the effect calls it — the live `execute()` of a
 * queued step, or a card's own `bespokePlay`. A composer that borrows a
 * step's prompt (Virus, Corporate Theft) decides for itself whether ITS
 * effect was skipped, and a preview never calls it (read-only).
 */
export function recordSkippedEffect(player: IPlayer, reason: string, skipped: SkippedEffect, opts: {log?: boolean} = {}): void {
  const fact = skippedFact(reason, skipped);
  player.game.events.recordEffectSkipped(player, fact);
  if (opts.log !== false) {
    player.game.log('${0} — effect skipped: ${1} (${2})', (b) => b.player(player).string(fact.label).string(reason));
  }
}

/** The persisted form of a preview's `SkippedEffect` — a plain i18n label, the cause, the bare magnitude. */
function skippedFact(reason: string, skipped: SkippedEffect): SkippedEffectFact {
  const label = typeof skipped.label === 'string' ? skipped.label : skipped.label.message;
  const e = skipped.effect;
  return {
    label,
    reason,
    ...(e === undefined ? {} : {effect: {direction: e.direction, icon: e.icon, amount: e.amount, ...(e.note === undefined ? {} : {note: e.note})}}),
  };
}
