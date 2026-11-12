/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE QUESTION'S SCOPE (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §5 · S4).
 *
 * The server asks the player ONE thing at a time, and a good part of the console's state exists only for that one
 * question: the branch a task was sent to place, a payment built on the client, a pick a composer hosts, the play
 * composer itself, «set aside». Every one of them used to be a flag that the view-apply reaction lowered by hand when
 * it noticed the question's identity had changed — nineteen writes in one 450-line function, each a line that had to
 * be remembered, in a file that owned none of them.
 *
 * Now the question is a SCOPE of the flow tree — `question:<identity>#n`, a child of the session — and what belongs to
 * it is opened in it:
 *
 *   const taskSpacePending = scopedState('task-space-pending', undefined, questionScope);
 *
 * `advanceQuestion(key)` is the ONE edge: the reaction calls it when the identity it reads (`promptIdentityKey` — a
 * structural key, never a title: CLAUDE.md invariant 1) is no longer the one it saw last. The new question's scope is
 * opened FIRST and the old one ended after it — so a latch that declares it may outlive its question (a pick whose
 * receive scene still plays the answer) is re-homed under the NEW question and asked again when THAT one leaves,
 * exactly as the reaction used to re-check it on every change.
 *
 * It ends with its session like everything else of the tree: a question that stood when the game screen left does not
 * stand in the next game.
 */
import {FlowScope} from '@/client/console/kernel/flowScope';
import {consoleSessionScope} from '@/client/console/session/consoleSession';

let standing: {key: string, scope: FlowScope<'question'>} | undefined;

/** A short, log-safe form of the identity for the scope's label (the key itself may hold a translated title). */
function labelOf(key: string): string {
  return key === '' ? 'none' : key.split('|')[0].slice(0, 24);
}

function stands(): {key: string, scope: FlowScope<'question'>} | undefined {
  return standing !== undefined && standing.scope.ended === undefined ? standing : undefined;
}

/**
 * The scope of the question that stands — what a latch of the question names as its owner. Before the first view was
 * applied (and in a spec that applies none) it is the scope of «no question yet», which the first `advanceQuestion`
 * ends like any other.
 */
export function questionScope(): FlowScope<'question'> {
  const now = stands();
  if (now !== undefined) {
    return now.scope;
  }
  standing = {key: '', scope: consoleSessionScope().open('question', labelOf(''))};
  return standing.scope;
}

/**
 * THE QUESTION CHANGED — to `key`. The caller is the authority on that (the shell's router compares the identity of
 * every applied view with the last one it saw); this ends the question that stood, with everything opened in it, and
 * stands the next one.
 */
export function advanceQuestion(key: string): void {
  const was = stands();
  // The new question first: what outlives the old one is re-homed under it while the old one ends.
  standing = {key, scope: consoleSessionScope().open('question', labelOf(key))};
  was?.scope.end({how: 'done'});
}

/** The identity that stands (diagnostics; a spec). `undefined` — no question's scope is open. */
export function questionKeyStanding(): string | undefined {
  return stands()?.key;
}

/** Test seam: forget the standing question (its scope went with `resetFlowKernel()` / the session). */
export function resetQuestionScope(): void {
  const was = stands();
  standing = undefined;
  was?.scope.end({how: 'cancelled', reason: 'reset'});
}
