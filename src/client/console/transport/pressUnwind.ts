/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A PRESS THAT DID NOT LAND UNWINDS WHAT WAS ARMED FOR IT (architecture v2 —
 * docs/claude/console/architecture-v2/PLAN.md §5 · L1, §11).
 *
 * A press ARMS things before its answer exists: a scene that will play it (the tile's hero, the colony's cube, the
 * fleet), a commit beat, a pick's seal, a held row. When the server REFUSES the answer or the network loses it, the
 * move did not happen — every one of those must unwind with no trace, or it claims the NEXT answer as its own.
 *
 * That used to be a battery of twenty-five calls inside the transport (`abortAllConsoleTransactions`): a scene module
 * that was not on the list kept its arm after a refusal until its private safety fired, seconds later, over a world
 * that had not moved. Now a module that arms for a press DECLARES its unwind beside the arm itself:
 *
 *   onPressUnlanded('colony-build', abortColonyBuild, 250);
 *
 * and the transport says one thing on a refusal / a lost answer — `unwindUnlandedPress()`: every declared unwind, in
 * order, each on its own (one that throws is said and the pass goes on). The same form as the session's
 * `sessionState` / `leaveConsoleSession` — a list in somebody else's file became declarations beside their owners.
 *
 * `at` IS THE UNWIND'S PLACE IN THE PASS (lower first; the order is the battery's own — a trade recalls its fleet
 * before its reward transaction, a placement's hero before its two-phase flow). Two unwinds never share a place or a
 * label (`architectureDebt.spec`). An unwind is IDEMPOTENT and a no-op when nothing of its module is armed: it runs on
 * every unlanded press, whoever made it.
 *
 * No imports of the console on purpose: every scene module imports this file, and the transport imports them.
 */
/**
 * HOW the press did not land. `answered: false` — the move was NOT made as far as the page can know: the server
 * refused it, the network lost the request, or no answer came at all. `answered: true` — the server's answer ARRIVED
 * and could not be applied (it would not parse, the presenter threw): THE MOVE WAS MADE, and the truth is being
 * fetched again. A scene's arm unwinds either way (nothing of this press will play it); but what WAITS FOR THE ANSWER
 * — an awaiting hand-off, an outcome's claim — is rolled back only in the first case: in the second the answer is
 * still coming, by the re-fetch's road, and resolves them as any answer does.
 */
export type UnlandedPress = {answered: boolean};

type PressUnwind = {label: string, unwind: () => void, at: number, answerWaits: boolean};
const unwinds: Array<PressUnwind> = [];

/** Declare what a module unwinds when a press does not land (module scope, once). */
export function onPressUnlanded(label: string, unwind: () => void, at: number): void {
  declare({label, unwind, at, answerWaits: false});
}

/**
 * …and what WAITS FOR THE ANSWER (an awaiting hand-off, an outcome's claim): unwound only when no answer is coming
 * (`UnlandedPress.answered === false`). The same pass, the same order, the same rule of one label and one place.
 */
export function onPressUnanswered(label: string, unwind: () => void, at: number): void {
  declare({label, unwind, at, answerWaits: true});
}

function declare(entry: PressUnwind): void {
  // A module evaluated again (HMR, a spec's fresh bundle): its newest declaration stands.
  const standing = unwinds.findIndex((other) => other.label === entry.label);
  if (standing >= 0) {
    unwinds.splice(standing, 1);
  }
  unwinds.push(entry);
  unwinds.sort((a, b) => a.at - b.at);
}

/** The press did not land (refused, failed, lost — or answered unreadably): every declared unwind runs, in order, each on its own. */
export function unwindUnlandedPress(press: UnlandedPress = {answered: false}): void {
  for (const entry of [...unwinds]) {
    if (entry.answerWaits && press.answered) {
      continue;
    }
    try {
      entry.unwind();
    } catch (error) {
      console.warn(`[transport] the unwind «${entry.label}» threw after an unlanded press`, error);
    }
  }
}

/** The declared unwinds, in the order of the pass (diagnostics; a spec). */
export function declaredPressUnwinds(): Array<{label: string, at: number}> {
  return unwinds.map(({label, at}) => ({label, at}));
}
