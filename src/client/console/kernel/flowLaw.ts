/*
 * @console-shared LIVE — the flow kernel (docs/claude/console/architecture-v2/KERNEL.md).
 *
 * THE LAW OF A LIFECYCLE MACHINE — «a state with no exit» and «a wait with no bound» are test failures, not reviews.
 *
 * Every atomic state of a lifecycle machine says what it is, with exactly one TAG (its own or an ancestor's):
 *
 *   rest    nothing is owed here — the machine may stand in it for ever (idle, released, gone);
 *   player  it waits for the player's press — `meta.accepts` names the surface that takes the press;
 *   beat    a transient: something is in flight and the pad may be absorbed. A beat OWES ITS END, so it must carry
 *           an `after` transition (its bound) and `meta.waitsOn` (what it waits for).
 *
 * Two judges read a machine:
 *
 *  · `machineLawViolations` — STATIC, over the definition: the tags, a beat's bound and `waitsOn`, a player state's
 *    `accepts`, no trap (a beat / player state has a way out), and from every state a `rest` state or the machine's end
 *    is reachable along its declared transitions.
 *  · `exploreMachine` — DYNAMIC, over the reachable snapshots (guards and context included), driven by the machine's
 *    sample events plus every delayed event it declares: a standing beat's bound really moves it, a player state has a
 *    press that moves it, and from every reachable snapshot a snapshot with no beat standing is reachable.
 *
 * `tests/console/kernel/flowLaw.spec.ts` runs both over every registered machine.
 */
import {AnyStateMachine, EventObject, getInitialSnapshot, getNextSnapshot} from 'xstate';

export const FLOW_STATE_TAGS = ['rest', 'player', 'beat'] as const;
export type FlowStateTag = typeof FLOW_STATE_TAGS[number];

export type MachineLawViolation = {
  /** The state node's id (`submit.presenting`), or a snapshot's value for a dynamic finding. */
  state: string,
  rule: 'tag' | 'bound' | 'waits-on' | 'accepts' | 'trap' | 'no-rest' | 'dead-bound' | 'dead-press' | 'explosion',
  detail: string,
};

// The structural surface of an XState state node the judges read (kept local: the library's own type is a 9-parameter
// generic, and nothing here depends on those parameters).
type Transition = {eventType: string, target?: ReadonlyArray<Node>};
type Node = {
  id: string,
  key: string,
  type: 'atomic' | 'compound' | 'parallel' | 'final' | 'history',
  tags: ReadonlyArray<string>,
  meta?: Record<string, unknown>,
  parent?: Node,
  states: Record<string, Node>,
  initial?: {target?: ReadonlyArray<Node>},
  transitions: Map<string, ReadonlyArray<Transition>>,
  always?: ReadonlyArray<Transition>,
  after: ReadonlyArray<Transition>,
};

function allNodes(root: Node): Array<Node> {
  const out: Array<Node> = [];
  const visit = (node: Node): void => {
    out.push(node);
    for (const child of Object.values(node.states)) {
      visit(child);
    }
  };
  visit(root);
  return out;
}

/** The node and its ancestors, innermost first. */
function chainOf(node: Node): Array<Node> {
  const chain: Array<Node> = [];
  for (let n: Node | undefined = node; n !== undefined; n = n.parent) {
    chain.push(n);
  }
  return chain;
}

function flowTagsOf(node: Node): Array<FlowStateTag> {
  const found = new Set<FlowStateTag>();
  for (const n of chainOf(node)) {
    for (const tag of n.tags) {
      if ((FLOW_STATE_TAGS as ReadonlyArray<string>).includes(tag)) {
        found.add(tag as FlowStateTag);
      }
    }
  }
  return [...found];
}

function transitionsOf(node: Node): Array<Transition> {
  return [...[...node.transitions.values()].flat(), ...(node.always ?? [])];
}

/** The atomic / final states a transition's target comes to rest in (a compound enters its initial, a parallel all regions). */
function leavesOf(node: Node): Array<Node> {
  if (node.type === 'atomic' || node.type === 'final') {
    return [node];
  }
  if (node.type === 'parallel') {
    return Object.values(node.states).flatMap(leavesOf);
  }
  if (node.type === 'compound') {
    return (node.initial?.target ?? []).flatMap(leavesOf);
  }
  return [];
}

/** THE STATIC JUDGE. `[]` = the definition keeps the law. */
export function machineLawViolations(machine: AnyStateMachine): Array<MachineLawViolation> {
  const root = machine.root as unknown as Node;
  const violations: Array<MachineLawViolation> = [];
  const leaves = allNodes(root).filter((n) => n.type === 'atomic' || n.type === 'final');
  const isMachineEnd = (n: Node): boolean => n.type === 'final' && n.parent === root;

  for (const leaf of leaves) {
    if (leaf.type === 'final') {
      continue;
    }
    const chain = chainOf(leaf);
    const tags = flowTagsOf(leaf);
    if (tags.length !== 1) {
      violations.push({
        state: leaf.id, rule: 'tag',
        detail: tags.length === 0 ? 'no tag — every state is `rest`, `player` or `beat`' : `several tags (${tags.join(', ')}) — exactly one`,
      });
      continue;
    }
    const tag = tags[0];
    const tagged = chain.find((n) => n.tags.includes(tag)) as Node;
    const underTag = chain.slice(0, chain.indexOf(tagged) + 1);
    // What leaves THIS leaf: a transition declared on it or an ancestor whose target is not the leaf itself.
    const exits = chain.flatMap(transitionsOf).filter((t) => (t.target ?? []).some((target) => !leavesOf(target).every((l) => l === leaf)));
    if (tag === 'beat') {
      const bounds = underTag.flatMap((n) => n.after).filter((t) => (t.target ?? []).length > 0);
      if (bounds.length === 0) {
        violations.push({state: leaf.id, rule: 'bound', detail: 'a beat with no `after` transition — a wait with no bound'});
      }
      if (!underTag.some((n) => typeof n.meta?.waitsOn === 'string' && n.meta.waitsOn !== '')) {
        violations.push({state: leaf.id, rule: 'waits-on', detail: 'a beat with no `meta.waitsOn` — it does not say what it waits for'});
      }
    }
    if (tag === 'player' && !underTag.some((n) => typeof n.meta?.accepts === 'string' && n.meta.accepts !== '')) {
      violations.push({state: leaf.id, rule: 'accepts', detail: 'a player state with no `meta.accepts` — it does not name the surface that takes the press'});
    }
    if (tag !== 'rest' && exits.length === 0) {
      violations.push({state: leaf.id, rule: 'trap', detail: `a ${tag} state with no way out`});
    }
  }

  // REACHABILITY: from every leaf, a rest leaf or the machine's end, along the declared transitions (guards ignored —
  // the dynamic judge reads them).
  const restful = (n: Node): boolean => isMachineEnd(n) || (n.type !== 'final' && flowTagsOf(n).length === 1 && flowTagsOf(n)[0] === 'rest');
  for (const start of leaves) {
    if (restful(start)) {
      continue;
    }
    const seen = new Set<Node>([start]);
    const queue = [start];
    let reached = false;
    while (queue.length > 0 && !reached) {
      const leaf = queue.shift() as Node;
      for (const t of chainOf(leaf).flatMap(transitionsOf)) {
        for (const target of t.target ?? []) {
          for (const next of leavesOf(target)) {
            if (restful(next)) {
              reached = true;
            }
            if (!seen.has(next)) {
              seen.add(next);
              queue.push(next);
            }
          }
        }
      }
    }
    if (!reached) {
      violations.push({state: start.id, rule: 'no-rest', detail: 'no `rest` state and no end of the machine is reachable from here'});
    }
  }
  return violations;
}

export type ExploreOptions = {
  /** The events to drive the machine with — one sample per event type and per guard-relevant payload. */
  events: ReadonlyArray<EventObject>,
  /** The machine's input, when it takes one. */
  input?: unknown,
  /** How a snapshot is told from another (default: its value and its context, as JSON). */
  key?: (snapshot: {value: unknown, context: unknown}) => string,
  /** A machine whose context counts without bound must not hang the judge. */
  maxStates?: number,
};

type Explored = {value: unknown, done: boolean, tags: Set<string>, next: Map<string, string>};

/** Every delayed event the definition declares (`xstate.after.<delay>.<state>`). */
export function delayedEventTypes(machine: AnyStateMachine): Array<string> {
  return [...new Set(allNodes(machine.root as unknown as Node).flatMap((n) => n.after.map((t) => t.eventType)))];
}

/**
 * THE DYNAMIC JUDGE: breadth-first over the reachable snapshots. Returns the violations and how many snapshots were
 * read (a spec asserts the number is not trivially small — an explorer that saw one state proved nothing).
 */
export function exploreMachine(machine: AnyStateMachine, options: ExploreOptions): {violations: Array<MachineLawViolation>, states: number} {
  const keyOf = options.key ?? ((s) => JSON.stringify([s.value, s.context]));
  const delayed = delayedEventTypes(machine);
  const events: Array<EventObject> = [...options.events, ...delayed.map((type) => ({type}))];
  const maxStates = options.maxStates ?? 5000;
  type Snap = ReturnType<typeof getInitialSnapshot>;
  const initial = getInitialSnapshot(machine, options.input as never) as Snap;
  const graph = new Map<string, Explored>();
  const queue: Array<{key: string, snapshot: Snap}> = [];
  const admit = (snapshot: Snap): string => {
    const s = snapshot as unknown as {value: unknown, context: unknown, status: string, tags: Set<string>};
    const key = keyOf(s);
    if (!graph.has(key)) {
      graph.set(key, {value: s.value, done: s.status === 'done', tags: new Set(s.tags), next: new Map()});
      queue.push({key, snapshot});
    }
    return key;
  };
  admit(initial);
  const violations: Array<MachineLawViolation> = [];
  while (queue.length > 0) {
    if (graph.size > maxStates) {
      violations.push({state: '*', rule: 'explosion', detail: `more than ${maxStates} snapshots — give the judge a coarser key`});
      break;
    }
    const {key, snapshot} = queue.shift() as {key: string, snapshot: Snap};
    const node = graph.get(key) as Explored;
    if (node.done) {
      continue;
    }
    for (const event of events) {
      let next: Snap;
      try {
        next = getNextSnapshot(machine, snapshot as never, event as never) as Snap;
      } catch {
        continue;
      }
      const nextKey = admit(next);
      if (nextKey !== key) {
        node.next.set(`${event.type}${nextKey}`, nextKey);
      }
    }
  }
  const show = (e: Explored): string => (typeof e.value === 'string' ? e.value : JSON.stringify(e.value));
  // A snapshot is AT REST when the machine is done or no beat stands in it.
  const atRest = (e: Explored): boolean => e.done || !e.tags.has('beat');
  for (const [key, node] of graph) {
    if (node.done) {
      continue;
    }
    if (node.tags.has('beat')) {
      const moved = [...node.next.keys()].some((edge) => edge.startsWith('xstate.after.'));
      if (!moved) {
        violations.push({state: show(node), rule: 'dead-bound', detail: 'a beat stands here and none of its delayed transitions moves the machine (a guarded bound that never passes?)'});
      }
    } else if (node.tags.has('player') && node.next.size === 0) {
      violations.push({state: show(node), rule: 'dead-press', detail: 'a player state no sample event moves — a press that changes nothing'});
    }
    const seen = new Set<string>([key]);
    const walk = [key];
    let reached = atRest(node);
    while (walk.length > 0 && !reached) {
      const at = graph.get(walk.shift() as string) as Explored;
      for (const nextKey of at.next.values()) {
        const next = graph.get(nextKey) as Explored;
        if (atRest(next)) {
          reached = true;
          break;
        }
        if (!seen.has(nextKey)) {
          seen.add(nextKey);
          walk.push(nextKey);
        }
      }
    }
    if (!reached) {
      violations.push({state: show(node), rule: 'no-rest', detail: 'no snapshot without a standing beat is reachable from here'});
    }
  }
  return {violations, states: graph.size};
}
