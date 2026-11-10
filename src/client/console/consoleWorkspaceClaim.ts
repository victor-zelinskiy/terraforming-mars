/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE OUTCOME CLAIM'S LIFECYCLE AS A MACHINE (architecture v2, lifecycle 1; docs/claude/console/architecture-v2/PLAN.md
 * §2.2). `consoleWorkspaceOutcome.ts` says what a claim IS (whose artifact, which kinds, which zone) and stays the one
 * door every caller uses; this is what the claim does IN TIME.
 *
 * It used to be three module timers (`beatTimer` 2.6 s, `arrivalTimer` 5 s, `safetyTimer` 20 s) armed and cleared by
 * hand in nine functions, a release that re-armed its own safety when refused, and — after the Hi-Tech Lab freeze — a
 * fourth clock in the shell's 1 Hz tick that released a claim whose host frame was «known nowhere» (which then had to
 * learn the frame's third home). Here each of those waits is a STATE with its bound:
 *
 *   stage     awaiting ─PRESENTING─▶ presenting          «claimed, nothing came»: 20 s, then released — unless the claim
 *             │  ▲                    │ REFUSED            SERVES a live prompt / batch (`held`, re-asked every 20 s);
 *             ▼  │ RETAIN             ▼                    a release refused while presenting keeps re-asking the same way
 *             held                   presentingOwed
 *   beat      pending ─BEAT_DONE / 2.6 s─▶ over           the execution beat; REARM_BEAT (only while awaiting) restarts it
 *   arrival   closed ─ANSWER_IN / PRESENTING─▶ timed ─ARRIVAL_DONE / 5 s─▶ open     the input gate of a card outcome
 *   host      bound ─HOST_GONE─▶ orphaned ─1.5 s─▶ released                        a claim never outlives its host
 *
 * The HOST region is the structural half: the facade binds the claim to its host frame's SCOPE
 * (`workspaceFrameScope(host)` — one answer for the live stack, the park and aside for the board), so «the host is
 * known nowhere» is that scope's end, an event — never a sampled predicate that must list every home.
 *
 * `mayRelease` is the release funnel's serving guard (the facade provides it): a claim that serves and whose host
 * stands is never released by its own safety.
 */
import {assign, setup} from 'xstate';

/** «Claimed, and nothing ever came» — deliberately longer than the surface-motion awaiting safety (6 s). */
export const CLAIM_SAFETY_MS = 20_000;
/** The execution beat's backstop — short: a backstop is a failure path, and its length is what the player feels. */
export const CLAIM_BEAT_SAFETY_MS = 2600;
/** The arrival's backstop: the gate is a courtesy to the animation, never its hostage. */
export const CLAIM_ARRIVAL_SAFETY_MS = 5000;
/** How long a claim may stand with its host frame gone (a re-entry of the same workspace re-binds it inside this). */
export const CLAIM_HOST_GONE_GRACE_MS = 1500;

export type ClaimEvent =
  /** The server's answer exists (a drawn batch, a card prompt). */
  | {type: 'ANSWER_IN'}
  /** The execution beat played out. */
  | {type: 'BEAT_DONE'}
  /** The beat's deal starts later than the confirm — restart it (only while the claim still awaits). */
  | {type: 'REARM_BEAT'}
  /** The batch has landed, opened and handed over. */
  | {type: 'ARRIVAL_DONE'}
  /** The claimed artifact is on screen inside the workspace. */
  | {type: 'PRESENTING'}
  /** The chain has another batch queued — the same lease, a fresh arrival (`gated`: it arrives by flying). */
  | {type: 'RETAIN', gated: boolean}
  /** A release was asked for and refused (the claim serves) — it is re-asked at the safety's bound. */
  | {type: 'REFUSED'}
  /** The host frame's scope ended / the host is not standing. */
  | {type: 'HOST_GONE'}
  /** …a frame of the host's kind stands (again). */
  | {type: 'HOST_BACK'};
// (An explicit release is not an event: the facade ends the claim's SCOPE, and the machine stops with it.)

export type ClaimContext = {
  /** The mirror's `stage`. */
  stage: 'awaiting' | 'presenting',
  /** Which of its own bounds ended it: `claim-safety` · `host-gone` ('' while it lives). */
  ended: string,
  /** As claimed: a CARD outcome arrives by flying (its input gate starts shut). */
  gated: boolean,
  /** As claimed: a frame of its host stood. */
  hosted: boolean,
};

export const claimMachine = setup({
  types: {
    context: {} as ClaimContext,
    events: {} as ClaimEvent,
    input: {} as {gated: boolean, hosted: boolean},
  },
  delays: {
    SAFETY: CLAIM_SAFETY_MS,
    BEAT_SAFETY: CLAIM_BEAT_SAFETY_MS,
    ARRIVAL_SAFETY: CLAIM_ARRIVAL_SAFETY_MS,
    HOST_GONE_GRACE: CLAIM_HOST_GONE_GRACE_MS,
  },
  guards: {
    /** The release funnel's guard, provided by the facade (default: nothing serves). */
    mayRelease: () => true,
    awaiting: ({context}) => context.stage === 'awaiting',
    retainGated: ({event}) => event.type === 'RETAIN' && event.gated,
  },
  actions: {
    toAwaiting: assign({stage: 'awaiting' as const}),
    toPresenting: assign({stage: 'presenting' as const}),
    bySafety: assign({ended: 'claim-safety'}),
    byHost: assign({ended: 'host-gone'}),
  },
}).createMachine({
  id: 'claim',
  context: ({input}) => ({stage: 'awaiting', ended: '', gated: input.gated, hosted: input.hosted}),
  initial: 'live',
  states: {
    live: {
      type: 'parallel',
      states: {
        stage: {
          initial: 'awaiting',
          states: {
            awaiting: {
              tags: ['beat'],
              meta: {waitsOn: 'the answer — its artifact arriving in the workspace'},
              entry: 'toAwaiting',
              on: {
                PRESENTING: 'presenting',
                RETAIN: {target: 'awaiting', reenter: true},
                REFUSED: {target: 'awaiting', reenter: true},
              },
              after: {SAFETY: [{guard: 'mayRelease', target: '#claim.released', actions: 'bySafety'}, {target: 'held'}]},
            },
            // It SERVES: a live prompt of a claimed kind, or a pending batch it answers for, stands — the player's time.
            held: {
              tags: ['player'],
              meta: {accepts: 'the surface that serves the claimed prompt / batch'},
              on: {
                PRESENTING: 'presenting',
                RETAIN: 'awaiting',
                REFUSED: {target: 'held', reenter: true},
              },
              after: {SAFETY: [{guard: 'mayRelease', target: '#claim.released', actions: 'bySafety'}, {target: 'held', reenter: true}]},
            },
            presenting: {
              tags: ['player'],
              meta: {accepts: 'the embedded stage in the host\'s zone'},
              entry: 'toPresenting',
              on: {RETAIN: 'awaiting', REFUSED: 'presentingOwed'},
            },
            // A release was refused while it presents: «a refusal is a wait, never a wedge» — re-asked at the bound.
            presentingOwed: {
              tags: ['player'],
              meta: {accepts: 'the embedded stage in the host\'s zone'},
              on: {RETAIN: 'awaiting', REFUSED: {target: 'presentingOwed', reenter: true}},
              after: {SAFETY: [{guard: 'mayRelease', target: '#claim.released', actions: 'bySafety'}, {target: 'presentingOwed', reenter: true}]},
            },
          },
        },
        beat: {
          initial: 'pending',
          states: {
            pending: {
              tags: ['beat'],
              meta: {waitsOn: 'the execution beat\'s flight'},
              on: {BEAT_DONE: 'over', REARM_BEAT: {guard: 'awaiting', target: 'pending', reenter: true}},
              after: {BEAT_SAFETY: 'over'},
            },
            over: {tags: ['rest'], on: {REARM_BEAT: {guard: 'awaiting', target: 'pending'}}},
          },
        },
        arrival: {
          initial: 'seating',
          states: {
            seating: {tags: ['rest'], always: [{guard: ({context}) => context.gated, target: 'closed'}, {target: 'open'}]},
            open: {tags: ['rest'], on: {RETAIN: {guard: 'retainGated', target: 'closed'}}},
            // A card outcome arrives by flying: the input gate is shut until the batch has landed.
            closed: {
              tags: ['beat'],
              meta: {waitsOn: 'the answer'},
              on: {
                ANSWER_IN: 'timed',
                PRESENTING: 'timed',
                ARRIVAL_DONE: 'open',
                RETAIN: [{guard: 'retainGated', target: 'closed', reenter: true}, {target: 'open'}],
              },
              // The claim's own safety releases it long before; a gate that somehow outlived it opens.
              after: {SAFETY: 'open'},
            },
            timed: {
              tags: ['beat'],
              meta: {waitsOn: 'the batch\'s arrival — its flight and hand-over'},
              on: {
                // The flight cannot start before the surface it lands in exists: the backstop restarts from here.
                PRESENTING: {target: 'timed', reenter: true},
                ARRIVAL_DONE: 'open',
                RETAIN: [{guard: 'retainGated', target: 'closed'}, {target: 'open'}],
              },
              after: {ARRIVAL_SAFETY: 'open'},
            },
          },
        },
        host: {
          initial: 'seating',
          states: {
            seating: {tags: ['rest'], always: [{guard: ({context}) => context.hosted, target: 'bound'}, {target: 'orphaned'}]},
            bound: {tags: ['rest'], on: {HOST_GONE: 'orphaned'}},
            orphaned: {
              tags: ['beat'],
              meta: {waitsOn: 'a frame of its host standing (again)'},
              on: {HOST_BACK: 'bound'},
              after: {HOST_GONE_GRACE: {target: '#claim.released', actions: 'byHost'}},
            },
          },
        },
      },
    },
    released: {type: 'final'},
  },
});

/** The sample events the law's explorer drives the machine by. */
export const CLAIM_SAMPLE_EVENTS: ReadonlyArray<ClaimEvent> = [
  {type: 'ANSWER_IN'}, {type: 'BEAT_DONE'}, {type: 'REARM_BEAT'}, {type: 'ARRIVAL_DONE'}, {type: 'PRESENTING'},
  {type: 'RETAIN', gated: true}, {type: 'RETAIN', gated: false}, {type: 'REFUSED'},
  {type: 'HOST_GONE'}, {type: 'HOST_BACK'},
];

/** The claim that SERVES for ever (the release funnel's guard always refuses) — the explorer's second world. */
export const claimMachineServing = claimMachine.provide({guards: {mayRelease: () => false}});
