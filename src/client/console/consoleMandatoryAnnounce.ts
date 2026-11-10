/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE ANNOUNCE PLATE'S LIFECYCLE AS A MACHINE (architecture v2, lifecycle 3; docs/claude/console/architecture-v2/PLAN.md
 * §2.2). `consoleMandatoryGate.ts` derives WHICH decision is the current beat and stays the one door; this is what one
 * beat does in time — one machine per beat key, in a scope of its own:
 *
 *   pending ──PRESENTED──▶ presented ──ACK──▶ acknowledged          (the scope's end = the beat is gone)
 *      │ after 15 s            ▲
 *      ▼                       │ PRESENTED
 *     late ────────────────────┘        ACK from any state → acknowledged
 *
 *  · `pending` is a BEAT: the first presentation waits for the scenes of the screen (the feed's read beat, blocking
 *    holds, the heroes) — all bounded — so the state has its own bound. It was a latch with no clock: a leaked raw
 *    signal kept the gate PENDING for ever with the surface suppressed (inventory A1), cured by the wait graph's
 *    `overdue` judgement fifteen seconds and three ticks later. The bound is now the state's.
 *  · `late` is what stands past the bound: the only thing that may honestly still be in front of the plate is the
 *    player's own time (a reveal they have not taken). Entering it runs the plate's DOOR (the shell: acknowledge where
 *    the question's own surface already stands and serves it, else light the chip's beacon) — never a press on the
 *    player's behalf.
 *  · The latches die with their beat by construction: a new key is a new machine in `pending`, so a completed action
 *    leaves nothing stale and the same key arising again runs a fresh cycle (`noteMandatoryBeatIdentity` no longer
 *    clears three fields by hand).
 */
import {assign, emit, setup} from 'xstate';

/** How long the first presentation may wait for the scenes of the screen before the plate's door is run. */
export const ANNOUNCE_PENDING_MAX_MS = 15_000;

export type AnnounceEvent =
  /** The first presentation happened (the plate rose on the board home, or the chip's beacon lit elsewhere). */
  | {type: 'PRESENTED'}
  /** The player opened it (A) — or its question's own surface serves it in place. */
  | {type: 'ACK'}
  /** The screen director's cure for a blind announce: light the chip's beacon (opens nothing). */
  | {type: 'BEACON'};

export type AnnounceContext = {
  key: string,
  /** The chip's beacon is forced for this beat. */
  beacon: boolean,
  /** Born acknowledged (see `seating`). */
  bornAcknowledged: boolean,
};

export const announceMachine = setup({
  types: {
    context: {} as AnnounceContext,
    events: {} as AnnounceEvent,
    input: {} as {key: string, acknowledged: boolean},
    emitted: {} as {type: 'overdue', key: string},
  },
  delays: {PENDING_MAX: ANNOUNCE_PENDING_MAX_MS},
}).createMachine({
  id: 'announce',
  context: ({input}) => ({key: input.key, beacon: false, bornAcknowledged: input.acknowledged}),
  initial: 'seating',
  on: {BEACON: {actions: assign({beacon: true})}},
  states: {
    // A beat acknowledged before it became the current one (a scene that opens the next flow itself) is born open.
    seating: {
      tags: ['rest'],
      always: [{guard: ({context}) => context.bornAcknowledged, target: 'acknowledged'}, {target: 'pending'}],
    },
    pending: {
      tags: ['beat'],
      meta: {waitsOn: 'its first presentation — the feed\'s read beat and the scenes of the screen'},
      on: {PRESENTED: 'presented', ACK: 'acknowledged'},
      after: {PENDING_MAX: {target: 'late', actions: emit(({context}) => ({type: 'overdue' as const, key: context.key}))}},
    },
    late: {
      tags: ['player'],
      meta: {accepts: 'what still stands in front of the plate (a reveal to take) — or the question\'s own surface'},
      on: {PRESENTED: 'presented', ACK: 'acknowledged'},
    },
    presented: {
      tags: ['player'],
      meta: {accepts: 'the plate on the board home (A opens) / the chip\'s beacon elsewhere'},
      on: {ACK: 'acknowledged'},
    },
    // Opened: the surface it announced is the player's now. The beat stands until its derivation stops returning it.
    acknowledged: {tags: ['rest']},
  },
});

/** The sample events the law's explorer drives the machine by. */
export const ANNOUNCE_SAMPLE_EVENTS: ReadonlyArray<AnnounceEvent> = [{type: 'PRESENTED'}, {type: 'ACK'}, {type: 'BEACON'}];
