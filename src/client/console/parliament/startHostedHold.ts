import type {WaitTarget} from '@/client/console/waitGraph/waitGraphModel';

/**
 * WHAT HOLDS THE START'S HOSTED STEP FROM OPENING (the wait graph, Э4 — the bottle's games 105 and 117 of the cards
 * axis, 2026-11-28: Scientists Campaign and Greens Campaign played in one opening, and at twelve seconds the graph filed
 * `wait-graph/overdue/flow:rally` over a rally the start had not opened yet). The start opens a rally or a walk owed to
 * it at its FOLLOW-UP DOOR (`startController.startHostedStepDue`): the start the top frame, no question set aside, the
 * follow-up family admitted, no card reaction playing — and the opening's own presentations stand in front of it: the
 * second prelude's hero, the bought cards flying into the hand, the reveal of a draw the PLAYER takes. The rally's node
 * called all of that «the start opens the rally pose — 12 s», a bound over the player's take.
 *
 * The rally's and the walk's nodes therefore DELEGATE, as a held conclusion does (`CONCLUSION_HOLD_EDGE` ·
 * `follow-up`): while something holds the door they wait on THAT node — the admission's (its bound by its block; a
 * reveal is the player's), the frame standing above, the question set aside — and only an owed step nothing holds is
 * the R9 orphan on their own clock. The supervisor publishes those nodes and answers the question (the one module that
 * reads the shell's gates); a node id it names is one it publishes in the same tick.
 */
let holder: () => WaitTarget | undefined = () => undefined;

/** The supervisor's answer while it runs (its stop restores «nothing holds»). */
export function setStartHostedStepHolder(fn: () => WaitTarget | undefined): () => void {
  holder = fn;
  return () => {
    if (holder === fn) {
      holder = () => undefined;
    }
  };
}

/** What holds the start's hosted step NOW — a node of the graph, the player, a motion — or undefined (nothing: it is owed now). */
export function startHostedStepHeldBy(): WaitTarget | undefined {
  return holder();
}
