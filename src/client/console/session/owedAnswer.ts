/*
 * @console-shared LIVE — console native stands on this file.
 *
 * AN ANSWER SOMEBODY WAITS FOR HAS AN OWNER (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §11 · S6:
 * the resolver mailbox, retired).
 *
 * A scene hands the transport a promise and keeps its `resolve` in a module variable; a pick keeps its caller's
 * callback the same way. Written as `let runResolve: (() => void) | undefined`, that variable is a MAILBOX with no
 * owner: every exit path of the module must remember to call it (or whoever awaits it waits for ever — the commit
 * gate behind a scene that aborted on a path nobody listed), nothing says that an answer is owed or for how long, and
 * a game screen that leaves does not end it.
 *
 * `owedAnswer(label, options?)` is that variable with the three things it lacked:
 *
 *   const gate = owedAnswer('patent-sale:gate', {orphaned: () => []});
 *   return new Promise<void>((resolve) => { gate.arm(resolve); … });      // an answer is owed — step:owed:patent-sale:gate#12
 *   gate.settle();                                                         // given once; a second call gives nothing
 *
 *  · it has an OWNER (`owner()` — a run's scope, a frame's; the session that stands when nothing is named), and when
 *    that owner ends under a standing answer the debt is CLOSED: released with what `orphaned()` says («let it go» —
 *    the form of every promise somebody awaits), or dropped when there is nothing honest to answer with (a pick whose
 *    caller left with the screen). An answer cannot stay owed past what it belongs to;
 *  · it is VISIBLE: while owed it is a `step` scope of the flow tree — the tree dump, the field heartbeat's digest and
 *    `window.__conFlow()` name it with its age;
 *  · it is given ONCE: `settle` stands the debt down BEFORE it calls, so an answer that re-enters its own module finds
 *    nothing owed.
 *
 * The verbs are the mailbox's own idioms, so a conversion changes no order of effects:
 *
 *   x = fn            →  x.arm(fn)          (a standing one is replaced, uncalled — as an overwritten variable was)
 *   x !== undefined   →  x.armed
 *   x?.(a, b)         →  x.settle(a, b)
 *   x = undefined     →  x.drop()
 *   x === fn          →  x.owes(fn)
 *   const r = x; x = undefined; …cleanup…; r?.(a)   →   const r = x.take(); …cleanup…; r?.(a)
 *
 * Give it the NARROWEST owner that is true (`() => run.scope`): then the awaiting side is released by EVERY ending of
 * that run at once, and no exit path has to remember it.
 */
import {FlowScope} from '@/client/console/kernel/flowScope';
import {consoleSessionScope} from '@/client/console/session/consoleSession';

export type OwedAnswerOptions<A extends ReadonlyArray<unknown>> = {
  /** Whose the debt is (default: the session that stands when it is armed). An ended / absent owner falls to the session. */
  owner?: () => FlowScope | undefined,
  /**
   * The owner ended while the answer was still owed: what to answer WITH. Return the arguments to release the waiting
   * side (`() => []` for a promise's `resolve`); leave it out to DROP the debt — nobody is called.
   */
  orphaned?: () => A | undefined,
};

export type OwedAnswer<A extends ReadonlyArray<unknown> = []> = {
  /** An answer is owed: `answer` is to be called once. One still standing is replaced, uncalled. */
  arm(answer: (...args: A) => void): void,
  /** Is an answer owed? Plain read. */
  readonly armed: boolean,
  /** Is THIS the answer owed — the one a caller armed and may withdraw without touching a later one? */
  owes(answer: (...args: A) => void): boolean,
  /** Give the answer — once — and stand down. `false`: nothing was owed, nobody was called. */
  settle(...args: A): boolean,
  /** Stand down WITHOUT answering (the waiting side withdrew, or is answered another way). */
  drop(): void,
  /** Stand down and hand the answer to the caller, to give after its own cleanup. `undefined`: nothing was owed. */
  take(): ((...args: A) => void) | undefined,
};

export function owedAnswer<A extends ReadonlyArray<unknown> = []>(label: string, options: OwedAnswerOptions<A> = {}): OwedAnswer<A> {
  let owed: ((...args: A) => void) | undefined = undefined;
  let standing: FlowScope<'step'> | undefined = undefined;

  const take = (): ((...args: A) => void) | undefined => {
    const answer = owed;
    const scope = standing;
    owed = undefined;
    standing = undefined; // first: the scope's end below then knows the module stood it down itself
    scope?.end();
    return answer;
  };

  return {
    arm(answer) {
      take();
      const session = consoleSessionScope();
      const named = options.owner?.();
      const scope = (named !== undefined && named.ended === undefined ? named : session).open('step', `owed:${label}`);
      owed = answer;
      standing = scope;
      // THE OWNER ENDED UNDER A STANDING DEBT: it is closed — nobody had to remember.
      scope.defer(() => {
        if (standing !== scope) {
          return;
        }
        standing = undefined;
        owed = undefined;
        let release: A | undefined = undefined;
        try {
          release = options.orphaned?.();
        } catch (error) {
          console.warn(`[flow] ${scope.id} — its «orphaned» answer threw`, error);
        }
        if (release !== undefined) {
          answer(...release);
        }
      });
    },
    get armed() {
      return owed !== undefined;
    },
    owes: (answer) => owed === answer,
    settle(...args) {
      const answer = take();
      if (answer === undefined) {
        return false;
      }
      answer(...args);
      return true;
    },
    drop() {
      take();
    },
    take,
  };
}
