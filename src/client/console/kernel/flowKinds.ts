/*
 * @console-shared LIVE — the flow kernel (docs/claude/console/architecture-v2/KERNEL.md).
 *
 * THE KINDS OF FLOW, AND WHO MAY WAIT FOR WHOM.
 *
 * Every scope has a KIND. A scope may always wait for its own descendants (a parent joining what it started) and for
 * the outside world (the player, the server, a motion, a clock). Waiting for the END OF ANOTHER FLOW is the one wait
 * that can close a cycle between modules — every field freeze of the «A waits for B waits for A» shape was one — so it
 * is not left to each call site: the pairs that may exist are listed HERE, once.
 *
 *   WAITS_ON[k] = the kinds a scope of kind `k` may wait for the end of.
 *
 * Two guarantees hang off the table:
 *  · a pair that is not in it does not compile (`scope.wait(ended(other))` is typed by it) and throws at run time for
 *    code that erased the kind;
 *  · `tests/console/kernel/flowLaw.spec.ts` proves the table is a DAG — so a cycle between KINDS cannot be written, and
 *    what is left (two instances of kinds on one path) is refused by the wait table the instant its last edge is asked
 *    for (`flowWait.ts`).
 *
 * The direction is the one every point fix of 2026-10 … 11 converged on: what the player has not seen yet yields to
 * what is on screen; a decision never waits on a story; the server's answer is waited for by everybody and waits for
 * nobody. ADD AN EDGE ONLY WITH ITS REASON IN A COMMENT — an edge here is a promise that the target never (transitively)
 * waits for the source, and the spec holds you to it.
 */

export type FlowKind =
  /** The game screen's root — lives from the session's start to its end. */
  | 'session'
  /** The submit funnel's own lifetime (one per session). */
  | 'transport'
  /** ONE submit: from the press's ticket to its settle. */
  | 'submit'
  /** One cinematic gate of a submit's presentation (a child of its submit). */
  | 'gate'
  /** A chain of workspace frames (the live stack, the park, aside for the board). */
  | 'chain'
  /** One workspace frame. */
  | 'frame'
  /** A step a frame owes (a second effect of the same press whose door has not opened yet). */
  | 'step'
  /** An outcome claim (a child of its host frame). */
  | 'claim'
  /** A mandatory announce plate (one per beat key). */
  | 'announce'
  /** A prompt surface that is coming alive / standing for a question. */
  | 'surface'
  /** A presentation story the board owes (a scale step, a landing, a park). */
  | 'story'
  /** A scene that owns the foreground for its own length (a hero, a ceremony, a director's run). */
  | 'scene'
  /** An async beat inside another flow (`scope.run`). */
  | 'task'
  /** Specs. */
  | 'test';

export const WAITS_ON = {
  session: [],
  transport: [],
  // A submit waits for the server and for its own gates (children) — never for another flow: everything else waits
  // for IT, so an edge out of here would be one hop from a cycle with every flow in the client.
  submit: [],
  // A gate plays its scene; a scene it hands over to is its own child.
  gate: [],
  chain: [],
  // A frame past its commit waits for its submit to settle. Its steps, claims and nested frames are its children.
  frame: ['submit'],
  // An owed step waits for the answer that carries it and for the scene that must finish before its door opens.
  step: ['submit', 'gate', 'scene'],
  // A claim waits for the answer; its presentation is its own child.
  claim: ['submit'],
  // A surface's ENTRY waits for what the same response is still telling (admission) — never the other way round:
  // once it stands, scenes play beside it (the presence latch).
  surface: ['submit', 'gate', 'scene', 'story'],
  // A story waits for a stage: the scene before it, a frame that covers the board to leave. A FRAME NEVER WAITS FOR A
  // STORY («a decision never waits on a story» — the Venus trade, the hydro finish) — `story` is in no flow's row but
  // the surface's entry and the plate's.
  story: ['submit', 'gate', 'scene', 'frame'],
  // A scene waits for the answer it plays and for the scene before it.
  scene: ['submit', 'gate'],
  // The plate is what the player has not seen yet: it yields to everything on screen.
  announce: ['submit', 'gate', 'scene', 'story', 'surface', 'frame', 'claim', 'step'],
  // A task inherits its parent's row at run time (`effectiveKind`); its own row is empty.
  task: [],
  test: ['test'],
} as const satisfies Record<FlowKind, ReadonlyArray<FlowKind>>;

/** The kinds a scope of kind `K` may wait for the end of. */
export type WaitsOn<K extends FlowKind> = (typeof WAITS_ON)[K][number];

export const FLOW_KINDS = Object.keys(WAITS_ON) as ReadonlyArray<FlowKind>;

/** May a scope of kind `waiter` wait for the end of a scope of kind `target`? (The run-time half of the type.) */
export function mayWaitOn(waiter: FlowKind, target: FlowKind): boolean {
  return (WAITS_ON[waiter] as ReadonlyArray<FlowKind>).includes(target);
}

/**
 * Is the table a DAG? Returns the first cycle of kinds found (`[]` = none). `test → test` is the one self-edge, kept out
 * of the judgement: specs build their own shapes, cycles included, to prove the wait table refuses them.
 */
export function flowKindCycle(table: Readonly<Record<string, ReadonlyArray<string>>> = WAITS_ON): ReadonlyArray<string> {
  const state = new Map<string, 'open' | 'done'>();
  const path: Array<string> = [];
  const visit = (kind: string): ReadonlyArray<string> => {
    if (state.get(kind) === 'done') {
      return [];
    }
    if (state.get(kind) === 'open') {
      return [...path.slice(path.indexOf(kind)), kind];
    }
    state.set(kind, 'open');
    path.push(kind);
    for (const next of table[kind] ?? []) {
      if (kind === 'test' && next === 'test') {
        continue;
      }
      const found = visit(next);
      if (found.length > 0) {
        return found;
      }
    }
    path.pop();
    state.set(kind, 'done');
    return [];
  };
  for (const kind of Object.keys(table)) {
    const found = visit(kind);
    if (found.length > 0) {
      return found;
    }
  }
  return [];
}
