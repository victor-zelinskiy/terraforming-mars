/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE FRAME'S PHASE AS A MACHINE (architecture v2, lifecycle 2; docs/claude/console/architecture-v2/PLAN.md §2.2).
 *
 * `consoleWorkspaceFlow.ts` says what the six phases MEAN (which side of the commit, what B does, whether the pad is
 * live). This says what they are in TIME: four of them are places the player may stand for as long as they like
 * (`browse` · `configure` · `committed` · `verdict`), two are BEATS (`executing` · `completing`) — the pad is absorbed
 * there by contract, so a beat OWES ITS END.
 *
 * Until now a beat was a value written into a reactive record by one call and, with luck, overwritten by another: a
 * missed edge, an early `return`, an exception in the async beat behind it — and the frame stood `executing` with
 * nothing behind it, every press swallowed, until a net judged the screen dead. Here:
 *
 *  · a beat is a STATE WITH A BOUND (`after BEAT_MAX` — the law refuses a beat without one). The supervisor still cuts
 *    a quiet beat much sooner; the bound is what makes «a frame in a beat for ever» unrepresentable whatever else
 *    fails. It runs only while the frame is ON STAGE: a frame aside for the board or in the park is not absorbing
 *    anybody's pad (the player is answering elsewhere, for as long as they like);
 *  · the machine remembers where the beat came FROM and whether a press was bound to it (`leased`), so a press that
 *    did not land puts the frame back by one rule (`consoleWorkspaceStack.ts` § the beat's lease) instead of by a
 *    watcher per surface that somebody had to remember to write;
 *  · every phase change of every frame is a trace record with the event that caused it.
 *
 * The record's `phase` field (`WorkspaceFrame.phase`) is this machine's MIRROR — one writer.
 */
import {assign, emit, setup} from 'xstate';
import type {WorkspacePhase} from '@/client/console/consoleWorkspaceFlow';

/**
 * A beat's own bound, on stage. Deliberately far above everything that legitimately keeps a beat standing (the
 * submit's presentation is bounded at 120 s, a hold at 35 s) and far above the supervisor's own judgement of a QUIET
 * beat (seconds): this is the structural guarantee, not the cure.
 */
export const FRAME_BEAT_MAX_MS = 180_000;

export type FrameEvent =
  /** The frame's owner moves it (`setWorkspaceFramePhase` and the stack's own verbs). */
  | {type: 'PHASE', phase: WorkspacePhase}
  /** The frame left the stage (parked, aside for the board). */
  | {type: 'AWAY'}
  /** …and came back. */
  | {type: 'BACK'}
  /** A press was bound to the standing beat (the beat's lease). */
  | {type: 'LEASED'};

export type FrameContext = {
  /** The workspace kind — for the trace and the expiry's line. */
  kind: string,
  /** The phase — THE value the record mirrors. */
  phase: WorkspacePhase,
  /** Where the standing beat came from (the phase a press that did not land goes back to). */
  before: WorkspacePhase,
  /** Counts beats: a late ending of an old beat never touches a newer one. */
  beat: number,
  /** A press is bound to the standing beat. */
  leased: boolean,
  /** The frame is off stage. */
  away: boolean,
};

export function isBeatPhase(phase: WorkspacePhase): boolean {
  return phase === 'executing' || phase === 'completing';
}

const to = (phase: WorkspacePhase) => ({event}: {event: FrameEvent}) => event.type === 'PHASE' && event.phase === phase;

export const frameMachine = setup({
  types: {
    context: {} as FrameContext,
    events: {} as FrameEvent,
    input: {} as {kind: string, phase: WorkspacePhase, away: boolean},
    emitted: {} as {type: 'beatExpired', kind: string, phase: WorkspacePhase},
  },
  delays: {BEAT_MAX: FRAME_BEAT_MAX_MS},
  guards: {
    isAway: ({context}) => context.away,
    toBrowse: to('browse'),
    toConfigure: to('configure'),
    toExecuting: to('executing'),
    toCommitted: to('committed'),
    toVerdict: to('verdict'),
    toCompleting: to('completing'),
  },
  actions: {
    // ONE action for every phase move: a beat entered from a place remembers the place and starts unleased.
    move: assign(({context, event}) => {
      if (event.type !== 'PHASE' || event.phase === context.phase) {
        return {};
      }
      const entersBeat = isBeatPhase(event.phase) && !isBeatPhase(context.phase);
      return {
        phase: event.phase,
        before: entersBeat ? context.phase : context.before,
        beat: entersBeat ? context.beat + 1 : context.beat,
        leased: entersBeat ? false : (isBeatPhase(event.phase) ? context.leased : false),
      };
    }),
    expire: assign({phase: 'committed' as WorkspacePhase, leased: false}),
  },
}).createMachine({
  id: 'frame',
  context: ({input}) => ({kind: input.kind, phase: input.phase, before: input.phase, beat: 0, leased: false, away: input.away}),
  initial: 'seating',
  on: {
    PHASE: [
      {guard: 'toBrowse', target: '.browse', actions: 'move'},
      {guard: 'toConfigure', target: '.configure', actions: 'move'},
      {guard: 'toCommitted', target: '.committed', actions: 'move'},
      {guard: 'toVerdict', target: '.verdict', actions: 'move'},
      // (A beat already standing takes its own phase written again itself, below — it is never re-entered here.)
      {guard: 'toExecuting', target: '.executing', actions: 'move'},
      {guard: 'toCompleting', target: '.completing', actions: 'move'},
    ],
    AWAY: {actions: assign({away: true})},
    BACK: {actions: assign({away: false})},
    LEASED: {actions: assign({leased: true})},
  },
  states: {
    // The frame is seated at the phase it was created with (a restored frame may be born past its commit).
    seating: {
      tags: ['rest'],
      always: [
        {guard: ({context}) => context.phase === 'browse', target: 'browse'},
        {guard: ({context}) => context.phase === 'configure', target: 'configure'},
        {guard: ({context}) => context.phase === 'committed', target: 'committed'},
        {guard: ({context}) => context.phase === 'verdict', target: 'verdict'},
        {guard: ({context}) => context.phase === 'executing', target: 'executing'},
        {target: 'completing'},
      ],
    },
    browse: {tags: ['rest']},
    configure: {tags: ['player'], meta: {accepts: 'the workspace\'s own stage (a reversible step)'}},
    committed: {tags: ['player'], meta: {accepts: 'the workspace\'s result stage (B collapses it)'}},
    verdict: {tags: ['player'], meta: {accepts: 'the verdict\'s «ОК»'}},
    executing: {
      initial: 'placing',
      // Its own phase written again while it stands changes nothing (no re-entry: the bound keeps its clock).
      on: {PHASE: [{guard: 'toExecuting', actions: 'move'}]},
      states: {
        placing: {tags: ['rest'], always: [{guard: 'isAway', target: 'away'}, {target: 'onStage'}]},
        onStage: {
          tags: ['beat'],
          meta: {waitsOn: 'the submit it crossed the commit for, then the scenes that answer set off'},
          on: {AWAY: {target: 'away', actions: assign({away: true})}},
          after: {
            BEAT_MAX: {
              target: '#frame.committed',
              actions: [emit(({context}) => ({type: 'beatExpired' as const, kind: context.kind, phase: 'executing' as WorkspacePhase})), 'expire'],
            },
          },
        },
        away: {tags: ['rest'], on: {BACK: {target: 'onStage', actions: assign({away: false})}}},
      },
    },
    completing: {
      initial: 'placing',
      on: {PHASE: [{guard: 'toCompleting', actions: 'move'}]},
      states: {
        placing: {tags: ['rest'], always: [{guard: 'isAway', target: 'away'}, {target: 'onStage'}]},
        onStage: {
          tags: ['beat'],
          meta: {waitsOn: 'the result leaving (its flight to the hand / the discard, its read)'},
          on: {AWAY: {target: 'away', actions: assign({away: true})}},
          after: {
            BEAT_MAX: {
              target: '#frame.committed',
              actions: [emit(({context}) => ({type: 'beatExpired' as const, kind: context.kind, phase: 'completing' as WorkspacePhase})), 'expire'],
            },
          },
        },
        away: {tags: ['rest'], on: {BACK: {target: 'onStage', actions: assign({away: false})}}},
      },
    },
  },
});

/** The sample events the law's explorer drives the machine by. */
export const FRAME_SAMPLE_EVENTS: ReadonlyArray<FrameEvent> = [
  {type: 'PHASE', phase: 'browse'}, {type: 'PHASE', phase: 'configure'}, {type: 'PHASE', phase: 'executing'},
  {type: 'PHASE', phase: 'committed'}, {type: 'PHASE', phase: 'verdict'}, {type: 'PHASE', phase: 'completing'},
  {type: 'AWAY'}, {type: 'BACK'}, {type: 'LEASED'},
];

/** The explorer's key: the beat COUNTER is unbounded by design — every other fact of the context tells states apart. */
export function frameSnapshotKey(snapshot: {value: unknown, context: unknown}): string {
  const {phase, before, leased, away} = snapshot.context as FrameContext;
  return JSON.stringify([snapshot.value, phase, before, leased, away]);
}
