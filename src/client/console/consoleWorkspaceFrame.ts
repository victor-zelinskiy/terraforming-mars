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

/**
 * THE FRAME'S PROTOCOL — the moves between phases the product makes (FREEZE ZERO, stage 4: «machine moves 100 %
 * walked-or-declared»).
 *
 * The machine takes ANY phase from any phase (`PHASE` — the record's one writer is a mirror, and a mirror that
 * refused a write would part from its record). So its state space was every pair: 52 moves by region — of which
 * 3 421 walks (the whole e2e suite, the monkey in the bottle in every mode, the monkey in the real browser) made 20.
 * The other 32 were never «unwalked»: nothing in the product makes them, and nothing said so — an any-to-any machine
 * permits a wrong move silently. This is the set the product makes, each row read off those walks:
 *
 *   browse     → configure · executing · committed · verdict        (a step opens; a press commits; a result or a
 *                                                                    verdict arrives where the player stood)
 *   configure  → browse · executing · committed                     (B; the confirm; an answer with no beat)
 *   executing  → browse · configure · committed · verdict · completing
 *                                                                   (the press did not land — back where it came
 *                                                                    from; the answer's stage; the result leaving)
 *   committed  → browse · configure · executing · verdict · completing
 *                                                                   (a reversible fold; the next stage of ONE flow;
 *                                                                    the next commit; the result leaving)
 *   verdict    → executing                                          (its «ОК» — the verdict has one door)
 *   completing → committed                                          (NO move of its own: a completing frame LEAVES
 *                                                                    — the conclusion pops it. The one exit that is
 *                                                                    a move is its bound's, and the recovery's)
 *
 * A move outside the set is still MADE — and SAID (`consoleWorkspaceStack.writeFramePhase`: «[workspace] … off the
 * frame's protocol»): a line for the trail, a row of `unlisted` in the walks' report — never a silent permission.
 * The coverage's universe is the protocol (`flowMachines` → `flowCoverageProbe.machineUniverse`). Widening it is a
 * decision written here, with the walk that makes the move.
 */
export const FRAME_PROTOCOL: Readonly<Record<WorkspacePhase, ReadonlyArray<WorkspacePhase>>> = {
  browse: ['configure', 'executing', 'committed', 'verdict'],
  configure: ['browse', 'executing', 'committed'],
  executing: ['browse', 'configure', 'committed', 'verdict', 'completing'],
  committed: ['browse', 'configure', 'executing', 'verdict', 'completing'],
  verdict: ['executing'],
  completing: ['committed'],
};

/** Is `from → to` a move of the protocol? (A phase written again is no move.) */
export function frameMoveOnProtocol(from: WorkspacePhase, to: WorkspacePhase): boolean {
  return from === to || FRAME_PROTOCOL[from].includes(to);
}

/** The same law over the machine's state VALUES as the trace prints them (`browse`, `{"executing":"onStage"}`). */
export function frameEdgeOnProtocol(from: string, to: string): boolean {
  const phaseOf = (value: string): WorkspacePhase | undefined => {
    const name = /^\{"(\w+)":/.exec(value)?.[1] ?? value;
    return Object.prototype.hasOwnProperty.call(FRAME_PROTOCOL, name) ? name as WorkspacePhase : undefined;
  };
  const a = phaseOf(from);
  const b = phaseOf(to);
  // (A value that is no phase — the machine's own seating — is not the protocol's to judge.)
  return a === undefined || b === undefined || frameMoveOnProtocol(a, b);
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
