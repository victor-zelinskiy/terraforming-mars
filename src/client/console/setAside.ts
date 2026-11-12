/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «SET ASIDE» IS A RECORD OF THE QUESTION (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §5 · S4).
 *
 * The player may set a question aside — B on a plate to read the board, a navigation away from its surface, a whole
 * chain of workspaces parked, the finale minimized — and come back to it. That used to be ONE boolean for the whole
 * console (`consoleState.task.deferred`) with thirty writers in thirteen files: five that raised it and twenty-five
 * that had to remember to lower it. It had no identity (nothing said WHAT was set aside, or for which question), no
 * owner (a flag left raised by a flow that ended some other way stood until something unrelated lowered it — «set
 * aside» over the very answer the player was looking at, for 45 minutes, in one field log), and no trail.
 *
 * Now it is a record — WHAT was set aside, and since when — owned by THE QUESTION'S SCOPE
 * (`session/questionScope.ts`):
 *
 *  · it ends with its question. When the server asks something else the record is gone with the scope — the write
 *    in the view-apply reaction is not needed to make that true;
 *  · …unless a PARK still stands (`parked ⇒ set aside`: a parked chain is reachable only through the restore card,
 *    and the card is drawn for this record) — then it is re-homed under the next question and asked again when that
 *    one leaves. The rule is declared here, once, instead of being re-asserted after every clear;
 *  · it is raised and lowered through TWO verbs that say why — `setQuestionAside(what)` · `takeUpQuestion(why)`.
 *    `consoleState.task.deferred` is a read-only projection of it: an assignment is a compile error.
 *
 * The scope it stands in is a row of every tree dump (`step:set-aside#n`, with its age) — «how long has this been set
 * aside» is no longer a question for the field log's timestamps.
 */
import {flowClock} from '@/client/console/kernel/flowClock';
import {questionScope} from '@/client/console/session/questionScope';
import {scopedState} from '@/client/console/session/scopedState';
import {workspaceStackCollapsed} from '@/client/console/consoleWorkspaceStack';

/** WHAT was set aside. */
export type SetAsideWhat =
  /** B on the question's own plate / task host — «свернуть», to read the board. */
  | 'question'
  /** A navigation away from the surface that serves it (`deferShellTask`). */
  | 'navigation'
  /** A whole chain of workspace frames, parked at full depth. */
  | 'chain'
  /** The final-greenery session, minimized. */
  | 'finale';

/** WHY it was taken up again. */
export type TakeUpWhy =
  /** The player answered: the response is on its way. */
  | 'answered'
  /** The player came back through a door of the record (the restore card, the plate's A). */
  | 'restored'
  /** The player stands on the surface that answers the question, whatever door brought them there. */
  | 'on-its-surface'
  /** The question's own step opened in its host (a hosted frame, a live step of a flow). */
  | 'step-opened'
  /** The server asks something else. */
  | 'question-changed'
  /** A net ended it (the endgame's seal, a recovery door). */
  | 'recovered';

export type SetAsideRecord = {what: SetAsideWhat, since: number};

const record = scopedState<SetAsideRecord | undefined>('set-aside', undefined, questionScope, {
  // PARKED ⇒ SET ASIDE: the parked chain outlives the question it was parked under (a phase-anchored root survives
  // the discard), and the restore card — the one way back to it — is drawn for this record.
  outlives: () => workspaceStackCollapsed(),
});

let lastTakenUp: {why: TakeUpWhy, at: number} | undefined;

/** Why the last record ended (diagnostics — `__conFlow()` names the standing one by its scope). */
export function lastQuestionTakenUp(): {why: TakeUpWhy, at: number} | undefined {
  return lastTakenUp;
}

/** Is a question set aside right now? (Reactive — the plate, the restore card and the shell's `v-if`s read it.) */
export function questionSetAside(): boolean {
  return record.value !== undefined;
}

/** The record itself (diagnostics; the restore card's wording). */
export function setAsideRecord(): SetAsideRecord | undefined {
  return record.value;
}

/** The player set the question aside. Raising a raised record only names the stronger reason. */
export function setQuestionAside(what: SetAsideWhat): void {
  const standing = record.value;
  if (standing === undefined) {
    record.value = {what, since: flowClock().now()};
  } else if (standing.what !== what && (what === 'chain' || what === 'finale')) {
    record.value = {what, since: standing.since};
  }
}

/** The question is taken up again. Nothing if nothing was set aside. */
export function takeUpQuestion(why: TakeUpWhy): void {
  if (record.value === undefined) {
    return;
  }
  record.value = undefined;
  lastTakenUp = {why, at: flowClock().now()};
}
