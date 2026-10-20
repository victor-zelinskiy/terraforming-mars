/*
 * @console-shared LIVE — console native stands on this file.
 *
 * HOW MANY TIMES A LAW'S ACTION IS TAKEN — the one READING of the
 * declaration (Manufacturing Run RX37: «twice a generation; 3 times with 2 or
 * more influence»). Every surface that prints the count before the law is in
 * force (the vote panel, the inspector, «Полигон») or while it stands without a
 * live verdict reads it here, through the ONE function the server's limit is
 * read by (`actionUsesFor`) — a client never writes «1» or «2 / 3» for a law.
 *
 * Three lines, in the threshold language of Skyscrapers (RX20 — «on the line /
 * below the line», no new vocabulary):
 *   · RULE  — the printed count and its threshold («2 times a generation · 3 with influence 2+»);
 *   · SEAT  — what it is for THIS seat at its influence («for you: 3 times» / «for you: 2 times · 1 more influence for 3»);
 *   · WIN   — the vote's forecast: the winner's Agenda step can lift the seat over the line («if you win: 3 times»),
 *             present only when it changes the count.
 * A law that declares nothing (taken once a generation, the family's rule) has no reading here — its surfaces keep
 * the plain «once a generation» they already print.
 */
import {actionUsesFor, actionUsesStanding, ResolutionActionUses} from '@/common/parliament/actionUses';
import {AGENDA_TRACK, influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import type {Reading} from '@/client/console/readingText';

export type ActionUsesReading = {
  /** The printed count with its threshold — the same for every seat. */
  rule: Reading;
  /** The count for the reading's seat now (absent without a seat, or for another seat's reading). */
  seat?: Reading;
  /** The vote's forecast — only where the winner's Agenda step changes the count. */
  ifWin?: Reading;
  /** The seat's count now and after the win (the probes and the stand read the numbers, never the words). */
  uses?: number;
  usesIfWin?: number;
};

/** The seat a reading is for: its influence now and its Agenda marker (the winner's step is read from it). */
export type ActionUsesSeat = {influence: number, agenda: number};

/** The printed count, as a line — undefined for a law taken once a generation. */
export function actionUsesRule(uses: ResolutionActionUses | undefined): Reading | undefined {
  if (uses === undefined) {
    return undefined;
  }
  const raised = uses.atInfluence;
  return raised === undefined ?
    {label: '${0} times a generation', params: [String(uses.base)]} :
    {label: '${0} times a generation · ${1} with influence ${2}+', params: [String(uses.base), String(raised.uses), String(raised.influence)]};
}

/** The influence a seat would be paid at as the WINNER of the vote — its Agenda one step on, the rest of its influence kept. */
export function influenceIfWinning(seat: ActionUsesSeat): number {
  const step = Math.min(AGENDA_TRACK.length, Math.max(0, seat.agenda) + 1);
  return influenceAtAgenda(step) + Math.max(0, seat.influence - influenceAtAgenda(seat.agenda));
}

/**
 * The whole reading. `seat` undefined → the rule alone (a spectator, the inspector without a seat, another seat's
 * reading). `forecast` → add the win line when the win lifts the count.
 */
export function actionUsesReadingOf(uses: ResolutionActionUses | undefined, seat?: ActionUsesSeat, forecast = false): ActionUsesReading | undefined {
  const rule = actionUsesRule(uses);
  if (rule === undefined) {
    return undefined;
  }
  if (seat === undefined) {
    return {rule};
  }
  const now = actionUsesStanding(uses, seat.influence);
  const raised = uses?.atInfluence;
  const line: Reading = raised !== undefined && now.short !== undefined && now.short > 0 ?
    {label: 'For you: ${0} times · ${1} more influence for ${2}', params: [String(now.uses), String(now.short), String(raised.uses)]} :
    {label: 'For you: ${0} times a generation', params: [String(now.uses)]};
  const out: ActionUsesReading = {rule, seat: line, uses: now.uses};
  if (forecast) {
    const win = actionUsesFor(uses, influenceIfWinning(seat));
    if (win !== now.uses) {
      out.ifWin = {label: 'If you win: ${0} times a generation', params: [String(win)]};
      out.usesIfWin = win;
    }
  }
  return out;
}
