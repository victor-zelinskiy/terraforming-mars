/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SUBMIT'S LIFECYCLE — one machine per press that reaches the server (architecture v2, lifecycle 4;
 * docs/claude/console/architecture-v2/PLAN.md §2.2).
 *
 *   sending ──ANSWERED──▶ presenting ──PRESENTED──▶ applied
 *      │                      │  ├────STAGED─────▶ staged      (the MarsBot pipeline commits the view)
 *      ├──REFUSED──▶ refused  │  ├────RELEASE────▶ abandoned   (the supervisor: its gates never let go)
 *      ├──FAILED───▶ failed   │  └──after (the presentation's ceiling)──▶ abandoned
 *      └──after (the server's silence)──▶ silent
 *
 * WHY A MACHINE. The funnel was a boolean (`isServerSideRequestInProgress`) raised before a `fetch` and lowered in its
 * `finally`, with a promise chain of nineteen awaited scenes in between. Three field classes lived in that shape:
 *  · a request the network lost held the flag for the rest of the session (cured by a separate ceiling module);
 *  · a scene that never resolved held it too — «the answer arrived; its gates never let go» (cured by the liveness
 *    ladder's rung 22, twelve seconds later, which then let the hung chain apply a stale view if it ever woke);
 *  · a second press while it stood was dropped with a console line (inventory R11).
 * Here both waits are STATES with a bound of their own, the release is an event the machine takes (and the chain that
 * was waiting is over — it can no longer apply anything), and a submit that cannot be taken is a typed refusal in the
 * caller's hand (`gameTransport.SubmitTicket`).
 *
 * The machine is pure protocol: what a state DOES (the fetch, the gates, the unwind) is the transport's, keyed on the
 * transitions it observes. Bounds are the existing ceilings, re-expressed.
 */
import {setup} from 'xstate';

/** The server did not answer at all (no response headers) for this long — the request is cancelled and SAID. A minute:
 *  far above any honest answer (a move is processed in milliseconds; a bot's turn is paced AFTER the answer), far below
 *  a player giving up and reloading. */
export const SUBMIT_NO_RESPONSE_MS = 60_000;

/**
 * The presentation's own ceiling — from the answer to the applied view. Every gate inside it is bounded by itself
 * (`gameTransport.gate`), and a wedge is normally cut much sooner by the supervisor's `RELEASE`; this is the state's
 * structural bound: a submit can not stand `presenting` for ever, whatever else fails. Far above the longest honest
 * presentation (a generation scene with its conversion and income, a walk of the Career).
 */
export const SUBMIT_PRESENT_MAX_MS = 120_000;

export type SubmitEvent =
  /** The response's headers are in and it is OK — the presentation starts. */
  | {type: 'ANSWERED'}
  /** The server refused the move (4xx / an unexpected status). */
  | {type: 'REFUSED'}
  /** The request failed on the network. */
  | {type: 'FAILED'}
  /** Every gate has played and the view is applied. */
  | {type: 'PRESENTED'}
  /** The staged MarsBot pipeline took the commit (it applies the view with the bot's last turn). */
  | {type: 'STAGED'}
  /** The supervisor: the answer arrived and its gates never let go — the submit is over, the truth is re-fetched. */
  | {type: 'RELEASE'};

/** How a submit ended. */
export type SubmitStatus = 'applied' | 'staged' | 'refused' | 'failed' | 'silent' | 'abandoned';

export const SUBMIT_STATUSES: ReadonlyArray<SubmitStatus> = ['applied', 'staged', 'refused', 'failed', 'silent', 'abandoned'];

export const submitMachine = setup({
  types: {events: {} as SubmitEvent},
  delays: {
    SILENCE: SUBMIT_NO_RESPONSE_MS,
    PRESENT_MAX: SUBMIT_PRESENT_MAX_MS,
  },
}).createMachine({
  id: 'submit',
  initial: 'sending',
  states: {
    sending: {
      tags: ['beat'],
      meta: {waitsOn: 'the server\'s answer'},
      on: {
        ANSWERED: 'presenting',
        REFUSED: 'refused',
        FAILED: 'failed',
      },
      // ONLY the silence before the server's answer: a slow scene after it is never timed here.
      after: {SILENCE: 'silent'},
    },
    presenting: {
      tags: ['beat'],
      meta: {waitsOn: 'its cinematic gates, then the view\'s apply'},
      on: {
        PRESENTED: 'applied',
        STAGED: 'staged',
        // The chain that presents the answer threw (outside a gate — a gate's own failure is contained by its scope).
        FAILED: 'failed',
        RELEASE: 'abandoned',
      },
      after: {PRESENT_MAX: 'abandoned'},
    },
    applied: {type: 'final'},
    staged: {type: 'final'},
    refused: {type: 'final'},
    failed: {type: 'final'},
    silent: {type: 'final'},
    abandoned: {type: 'final'},
  },
});

/** The sample events the law's explorer drives the machine by. */
export const SUBMIT_SAMPLE_EVENTS: ReadonlyArray<SubmitEvent> = [
  {type: 'ANSWERED'}, {type: 'REFUSED'}, {type: 'FAILED'}, {type: 'PRESENTED'}, {type: 'STAGED'}, {type: 'RELEASE'},
];
