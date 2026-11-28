/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A LATCH OF A PRESS IS THE SUBMIT's (FREEZE ZERO, stage 9 — docs/claude/console/freeze-zero/PLAN.md § 8; the family
 * of issues #119 · #170 · #171 · #172 · #175 · #177 · #207).
 *
 * A press that answers the server often RAISES something before its answer exists — «a commit is on its way»: the
 * surface it was pressed on steps down for the flight, the loop that would re-open it is held off. Written as a
 * `scopedState` of the session (or of the question) such a latch outlives the press that raised it: when the submit
 * does not land — the network lost it, the server refused it, no answer came, the funnel never took it — the move was
 * not made, the server asks the very same question, and NOTHING lowers the latch. Its release rode «the next applied
 * view», and the view re-fetched after a move that was not made is the same view: no edge ever comes. The screen then
 * holds its own question down for good — «Завершить свою партию» in the finale, twice in one CI pass and again on the
 * head (games 621 · 630 · 648): a stranded `or`, the plate's lease expired, the ladder spent, the page rebuilt.
 *
 * The cure of the two presses beside it had been an unwind each, declared by hand (`onPressUnlanded` — keyed on a
 * variable only its own press sets): an opt-in list, and the third press was not on it. So the law is the latch's
 * own, by construction:
 *
 *   const committing = pressState('final-greenery-committing', false);
 *   committing.value = true;          // raised for a press …
 *   shell.submit(response);           // … and BOUND to the submit that press makes (the transport announces every
 *                                     //     ticket synchronously — `onSubmitTicket`)
 *
 *  · the funnel did not take the press (`accepted: false`) → it falls at once: nothing was sent, nothing will come;
 *  · the submit ended WITHOUT the move — `refused` · `failed` · `silent` — → it falls at that end: the page's facts
 *    are a fresh page's, and whatever re-opens the surface (a level, a door) sees the latch down;
 *  · the submit ended `applied` → it falls (its view is applied; the module's own, earlier release is a no-op then);
 *  · `staged` · `abandoned` — the move WAS made and its view comes by another road (the staged pipeline, the
 *    re-fetch): the latch is left to the module's own release on that view, as before — falling under the OLD view
 *    would re-open a question already answered;
 *  · raised with NO submit made in the same task → it falls and says so (`[invariant] press-state:<label>`): an arm
 *    with no press is a latch nobody will ever lower.
 *
 * It is a `scopedState` for every reader and writer (a `Ref`; the tree names its raised span `step:<label>#n`; it
 * falls with its session), and it may still be lowered by hand — an unwind that also puts back what the press took
 * down (`onPressUnlanded`), the module's release on the answer's view. The binding is the floor under them: a latch
 * of a press cannot outlive the press.
 *
 * Guards: `tests/client/console/pressState.spec.ts`; the replay of the family —
 * `tests/client/bottle/replayStrandedAfterRefusedSubmit.bottle.ts` (every way the wire leaves the move unmade).
 */
import {customRef, toRaw} from 'vue';
import type {Ref} from 'vue';
import {sessionState} from '@/client/console/session/consoleSession';
import {scopedState} from '@/client/console/session/scopedState';
import {onSubmitTicket} from '@/client/console/transport/submitTicket';
import type {SubmitSettle} from '@/client/console/transport/submitTicket';
import {invariantBroken} from '@/client/diagnostics/invariant';

type PressLatch = {
  label: string,
  /** One raised span of the latch (a later raise is another press). */
  span: number,
  /** The submit this span is bound to — `undefined` while it waits for its press's ticket. */
  ticket: string | undefined,
  raised: () => boolean,
  fall: () => void,
};

/** Raised in this task and not yet bound: the next ticket the transport announces is their press's. */
const unbound = new Set<PressLatch>();
let sweepArmed = false;
/** The submits on the wire — taken by the funnel and not yet ended. */
const inFlight = new Set<string>();

/** The ends of a submit after which its view is still coming by another road — the latch stays the module's. */
const VIEW_STILL_COMING: ReadonlySet<SubmitSettle['status']> = new Set<SubmitSettle['status']>(['staged', 'abandoned']);

/**
 * IS AN ANSWER OF THE PLAYER's ON THE WIRE RIGHT NOW? — a submit the funnel took and that has not ended (it ends by
 * every road: `SubmitTicket.settled`). While one stands, the question it answers is HELD BY ITS SUBMIT: the press may
 * have taken its surface down for the flight, nothing else can be answered (the funnel is busy), and the wait is
 * bounded by the submit machine's own bounds (`SUBMIT_NO_RESPONSE_MS`, `SUBMIT_PRESENT_MAX_MS`). The ONE generic
 * reason behind every per-press «its answer is on the wire» row a judge used to keep by hand.
 */
export function submitInFlight(): boolean {
  return inFlight.size > 0;
}

// The game screen is leaving: nothing of a press outlives its session (the latches fall with their scopes).
sessionState('press-state', () => {
  unbound.clear();
  inFlight.clear();
  sweepArmed = false;
}, 668);

onSubmitTicket((ticket) => {
  if (ticket.accepted) {
    inFlight.add(ticket.id);
    void ticket.settled.then(() => inFlight.delete(ticket.id), () => inFlight.delete(ticket.id));
  }
  if (unbound.size === 0) {
    return;
  }
  const pressed = [...unbound];
  unbound.clear();
  for (const latch of pressed) {
    if (!latch.raised()) {
      continue;
    }
    if (!ticket.accepted) {
      // The funnel never took the press: nothing was sent, nothing will come.
      latch.fall();
      continue;
    }
    const span = latch.span;
    latch.ticket = ticket.id;
    const ended = (settle: SubmitSettle | undefined): void => {
      if (latch.span !== span || latch.ticket !== ticket.id) {
        return;
      }
      latch.ticket = undefined;
      if (settle !== undefined && VIEW_STILL_COMING.has(settle.status)) {
        return;
      }
      latch.fall();
    };
    void ticket.settled.then(ended, () => ended(undefined));
  }
});

/** An arm with no press: a latch raised in a task that made no submit is lowered at the task's end, and named. */
function sweepUnbound(): void {
  sweepArmed = false;
  const orphaned = [...unbound];
  unbound.clear();
  for (const latch of orphaned) {
    if (latch.raised() && latch.ticket === undefined) {
      invariantBroken(`press-state:${latch.label}`, 'raised for a press, and no submit was made in the same task — lowered: nothing would ever have lowered it');
      latch.fall();
    }
  }
}

/**
 * A latch a PRESS raises before its answer exists — `scopedState(label, rest)` whose every raised span is bound to
 * the submit that press makes, and cannot outlive it (the header has the law).
 */
export function pressState<T>(label: string, rest: T): Ref<T> {
  const inner = scopedState(label, rest);
  const isRaised = (): boolean => !Object.is(toRaw(inner.value), toRaw(rest));
  const latch: PressLatch = {
    label, span: 0, ticket: undefined, raised: isRaised,
    fall: () => {
      inner.value = rest;
    },
  };
  return customRef<T>((track, trigger) => ({
    get(): T {
      track();
      return inner.value;
    },
    set(next: T): void {
      const was = isRaised();
      inner.value = next;
      const now = isRaised();
      if (now && !was) {
        latch.span++;
        latch.ticket = undefined;
        unbound.add(latch);
        if (!sweepArmed) {
          sweepArmed = true;
          void Promise.resolve().then(sweepUnbound);
        }
      } else if (!now) {
        unbound.delete(latch);
        latch.ticket = undefined;
      }
      trigger();
    },
  }));
}
