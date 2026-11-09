/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WAIT GRAPH — the PURE half (docs/claude/console/wait-graph.md).
 *
 * Every wait the console holds is a NODE: who waits (`owner`), since when, for what (`targets`), how long it may
 * (`boundMs`) and how it is ended if it must be (`recovery` — the owner's own door). The graph is read once per tick
 * and judged STRUCTURALLY, never by a clock alone:
 *
 *  - `cycle`     — a strongly connected set of nodes waiting on each other: none of them can move;
 *  - `dangling`  — a node waits on a node that is not there (its partner ended without it);
 *  - `dead-end`  — every way out of a node ends in an external that cannot come (a press with nothing accepting, an
 *                  answer with nothing on the wire and nothing owed);
 *  - `overdue`   — a node past the bound it declared;
 *  - `unbounded` — no bound, no door, waiting on anything but the player.
 *
 * A finding is CONFIRMED only after it stood `WAIT_GRAPH_CONFIRM_TICKS` ticks in a row with the same members — a
 * wait that closes a cycle for one frame (a hand-over mid-flight) is not a defect.
 *
 * Pure: no DOM, no Vue, no timers — the registry (`waitGraph.ts`) feeds it snapshots.
 */

/** The family a wait belongs to — also its RANK when a cycle must be broken (lower = yields first). */
export type WaitFamily =
  | 'announce' // a plate the player has not opened (the mandatory gate)
  | 'park' // the board-beat park, a parked reveal
  | 'story' // a presentation ledger story
  | 'hold' // an animation hold
  | 'flow' // a module's flow state machine (a walk, a rally, a trade, the start's release)
  | 'claim' // a workspace outcome claim
  | 'conclusion' // a workspace's guarded ending (held or owed)
  | 'transport' // the submit funnel and its gates
  | 'admission' // a family held by an admission block
  | 'surface' // a screen standing for a question
  | 'question'; // the server's live ask

/**
 * Who yields first when a cycle must be broken: the LOWEST rank (§2 of the contract). «The question beats the story;
 * the surface beats the conclusion; a plate the player has not seen yields to everything».
 */
export const WAIT_FAMILY_RANK: Readonly<Record<WaitFamily, number>> = {
  announce: 0,
  park: 1,
  story: 2,
  hold: 3,
  flow: 4,
  claim: 5,
  conclusion: 6,
  transport: 7,
  admission: 8,
  surface: 9,
  question: 10,
};

/** What a node waits for. */
export type WaitTarget =
  | {kind: 'node', id: string}
  | {kind: 'player', what: string}
  | {kind: 'server', what: string}
  | {kind: 'motion', what: string};

export type WaitNode = {
  /** Names the RUN the wait belongs to (`conclusion:parliament`, `flow:rally#42`) — never a bare flag. */
  id: string;
  family: WaitFamily;
  /** The module that owns the wait (and its ending). */
  owner: string;
  /** When the wait began (ms, the registry's clock). */
  since: number;
  targets: ReadonlyArray<WaitTarget>;
  /** How long the wait may honestly stand (ms) — undefined = no bound declared. */
  boundMs?: number;
  /** The owner's door that ends it when it must (a name the registry can run) — undefined = no door. */
  recovery?: string;
  /** Free-form facts for the log (a stage, a prompt id). */
  detail?: string;
};

/** The world the externals are judged against (read by the registry from the live screen). */
export type WaitWorld = {
  now: number;
  /** Some surface on screen ACCEPTS input for the live question (the liveness arbiter's `accepting`). */
  accepting: boolean;
  /** A request is on the wire (the transport funnel). */
  requestInFlight: boolean;
  /** The server owes the viewer something it has not delivered (a prompt is expected — another seat moves, etc.). */
  serverOwes: boolean;
  /**
   * Something is IN FLIGHT on screen (the liveness arbiter's own list — a request, a blocking hold under its ceiling, a
   * story within its grace, a flight). A press cannot come while a scene plays — but the screen is not dead either: a dead
   * end is «nothing accepts AND nothing moves», the arbiter's own definition of a stall (the e2e harvest of 2026-11-09:
   * three false dead ends inside a long hand-over and a law's play).
   */
  motionInFlight?: boolean;
};

export type WaitFindingKind = 'cycle' | 'dangling' | 'dead-end' | 'overdue' | 'unbounded';

export type WaitFinding = {
  kind: WaitFindingKind;
  /** The nodes it is about (a cycle's members in a stable order; one node otherwise). */
  members: ReadonlyArray<string>;
  /** For a cycle: the member that yields first (lowest rank, then the youngest) — the one Э3 breaks through its door. */
  yields?: string;
  /** The oldest member's age (ms). */
  ageMs: number;
  /** One-line explanation for the log. */
  why: string;
};

/** A finding confirmed after this many consecutive ticks with the same key (the screen shadow's three passes). */
export const WAIT_GRAPH_CONFIRM_TICKS = 3;

/** A stable identity of a finding across ticks. */
export function findingKey(f: WaitFinding): string {
  return `${f.kind}:${[...f.members].sort().join('|')}`;
}

function nodeEdges(node: WaitNode): Array<string> {
  return node.targets.filter((t): t is {kind: 'node', id: string} => t.kind === 'node').map((t) => t.id);
}

/** Tarjan's strongly connected components over the `node` edges — every SCC of 2+ nodes, or a node waiting on itself. */
export function waitCycles(nodes: ReadonlyArray<WaitNode>): Array<Array<string>> {
  const edges = new Map(nodes.map((n) => [n.id, nodeEdges(n)]));
  let index = 0;
  const stack: Array<string> = [];
  const onStack = new Set<string>();
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const at = (m: Map<string, number>, id: string): number => m.get(id) ?? Number.MAX_SAFE_INTEGER;
  const out: Array<Array<string>> = [];
  const visit = (id: string): void => {
    idx.set(id, index);
    low.set(id, index);
    index++;
    stack.push(id);
    onStack.add(id);
    for (const next of edges.get(id) ?? []) {
      if (!edges.has(next)) {
        continue;
      }
      if (!idx.has(next)) {
        visit(next);
        low.set(id, Math.min(at(low, id), at(low, next)));
      } else if (onStack.has(next)) {
        low.set(id, Math.min(at(low, id), at(idx, next)));
      }
    }
    if (at(low, id) === at(idx, id)) {
      const scc: Array<string> = [];
      for (let w = stack.pop(); w !== undefined; w = stack.pop()) {
        onStack.delete(w);
        scc.push(w);
        if (w === id) {
          break;
        }
      }
      const selfLoop = scc.length === 1 && (edges.get(id) ?? []).includes(id);
      if (scc.length > 1 || selfLoop) {
        out.push(scc.sort());
      }
    }
  };
  for (const n of nodes) {
    if (!idx.has(n.id)) {
      visit(n.id);
    }
  }
  return out;
}

/** The member a cycle breaks through: the lowest family rank, then the youngest wait (the newest yields to the older). */
export function yieldingMember(nodes: ReadonlyArray<WaitNode>, members: ReadonlyArray<string>): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rank = (id: string) => {
    const n = byId.get(id);
    return n === undefined ? Number.MAX_SAFE_INTEGER : WAIT_FAMILY_RANK[n.family];
  };
  const since = (id: string) => byId.get(id)?.since ?? 0;
  return [...members].sort((a, b) => rank(a) - rank(b) || since(b) - since(a) || a.localeCompare(b))[0];
}

/**
 * Can this external ever come? A press needs something accepting; an answer needs a request on the wire or a debt of
 * the server; a motion is its own clock (judged by the node's bound, never here).
 */
function externalCanCome(t: WaitTarget, world: WaitWorld): boolean {
  switch (t.kind) {
  case 'player': return world.accepting || world.motionInFlight === true;
  case 'server': return world.requestInFlight || world.serverOwes;
  case 'motion': return true;
  case 'node': return true;
  }
}

/** JUDGE one snapshot (pure). Findings are UNCONFIRMED here — the registry confirms them across ticks. */
export function judgeWaitGraph(nodes: ReadonlyArray<WaitNode>, world: WaitWorld): Array<WaitFinding> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const findings: Array<WaitFinding> = [];
  const age = (ids: ReadonlyArray<string>) => Math.max(0, ...ids.map((id) => world.now - (byId.get(id)?.since ?? world.now)));
  const inCycle = new Set<string>();
  for (const members of waitCycles(nodes)) {
    members.forEach((m) => inCycle.add(m));
    const yields = yieldingMember(nodes, members);
    findings.push({
      kind: 'cycle', members, yields, ageMs: age(members),
      why: members.map((m) => {
        const n = byId.get(m);
        return `${m} → ${(n === undefined ? [] : nodeEdges(n)).filter((e) => members.includes(e)).join(',')}`;
      }).join(' · '),
    });
  }
  for (const n of nodes) {
    const missing = nodeEdges(n).filter((id) => !byId.has(id));
    if (missing.length > 0 && missing.length === n.targets.length) {
      findings.push({kind: 'dangling', members: [n.id], ageMs: age([n.id]), why: `waits on ${missing.join(', ')} — not there`});
      continue;
    }
    if (inCycle.has(n.id)) {
      continue;
    }
    const externals = n.targets.filter((t) => t.kind !== 'node');
    const internals = nodeEdges(n).filter((id) => byId.has(id));
    if (internals.length === 0 && externals.length > 0 && externals.every((t) => !externalCanCome(t, world))) {
      findings.push({
        kind: 'dead-end', members: [n.id], ageMs: age([n.id]),
        why: externals.map((t) => `${t.kind}:${(t as {what: string}).what}`).join(', ') + ' cannot come',
      });
      continue;
    }
    if (n.boundMs !== undefined && world.now - n.since > n.boundMs) {
      findings.push({kind: 'overdue', members: [n.id], ageMs: age([n.id]), why: `past its ${Math.round(n.boundMs / 1000)} s bound`});
      continue;
    }
    // UNBOUNDED is judged on the EXTERNAL ends only: a node waiting on other nodes is judged through them (the
    // question held by the plate is as bounded as the plate) — the first shadow run's 68 false findings were all that.
    if (n.boundMs === undefined && n.recovery === undefined && internals.length === 0 &&
      externals.length > 0 && !externals.every((t) => t.kind === 'player')) {
      findings.push({kind: 'unbounded', members: [n.id], ageMs: age([n.id]), why: 'no bound, no door'});
    }
  }
  return findings;
}

/** The confirmation state carried between ticks (pure). */
export type WaitGraphConfirm = {streak: ReadonlyMap<string, number>};

export function initialWaitGraphConfirm(): WaitGraphConfirm {
  return {streak: new Map()};
}

/**
 * CONFIRM across ticks: a finding is reported the tick its streak reaches `WAIT_GRAPH_CONFIRM_TICKS` (once — a standing
 * finding is not re-reported every tick), and forgotten the tick it disappears.
 */
export function confirmWaitFindings(state: WaitGraphConfirm, findings: ReadonlyArray<WaitFinding>): {state: WaitGraphConfirm, confirmed: Array<WaitFinding>} {
  const next = new Map<string, number>();
  const confirmed: Array<WaitFinding> = [];
  for (const f of findings) {
    const key = findingKey(f);
    const streak = (state.streak.get(key) ?? 0) + 1;
    next.set(key, streak);
    if (streak === WAIT_GRAPH_CONFIRM_TICKS) {
      confirmed.push(f);
    }
  }
  return {state: {streak: next}, confirmed};
}
