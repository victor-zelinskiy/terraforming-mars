/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WAIT GRAPH — the registry (docs/claude/console/wait-graph.md). Phase Э2: a SHADOW.
 *
 * A wait enters the graph two ways:
 *  - a SOURCE (`registerWaitSource`) — a function over the owner's own reactive state that returns the nodes standing
 *    NOW (the shell's adapters over the existing mechanisms; a module's declaration of its own run);
 *  - an IMPERATIVE declaration (`declareWait`) — a handle the owner ends itself.
 * A node that does not say since when it waits is stamped the first tick it is seen (and forgotten the tick it is gone).
 *
 * `tickWaitGraph(world)` is called once per second by the shell (beside the liveness arbiter): it reads every source,
 * judges the snapshot (`judgeWaitGraph`), confirms findings across ticks and LOGS each confirmed one once —
 * `[wait-graph] <kind> <members> — <why> …`. Phase Э2 acts on nothing: the line is the evidence (harvested per e2e test
 * and per monkey walk, never red). Counted in `waitGraphStats` (`__conWaitGraph()` in the page).
 */
import {
  confirmWaitFindings, findingKey, initialWaitGraphConfirm, judgeWaitGraph, WaitFinding, WaitFindingKind, WaitGraphConfirm, WaitNode, WaitWorld,
} from '@/client/console/waitGraph/waitGraphModel';
import {consoleSessionScope} from '@/client/console/session/consoleSession';

/** A node as a source returns it — `since` optional (the registry stamps the first sighting). */
export type WaitNodeInput = Omit<WaitNode, 'since'> & {since?: number};

type Source = {name: string, read: () => ReadonlyArray<WaitNodeInput>};

const sources: Array<Source> = [];
const declared = new Map<string, WaitNode>();
const firstSeen = new Map<string, number>();
let confirm: WaitGraphConfirm = initialWaitGraphConfirm();

/** Counted for the evidence (`__conWaitGraph().stats`): ticks, the largest graph, confirmed findings by kind. */
export const waitGraphStats = {
  ticks: 0,
  maxNodes: 0,
  sourceErrors: 0,
  confirmed: {'cycle': 0, 'dangling': 0, 'dead-end': 0, 'overdue': 0, 'unbounded': 0} as Record<WaitFindingKind, number>,
  /** The last confirmed findings (newest last, bounded). */
  recent: [] as Array<{at: number, finding: WaitFinding}>,
};

/** The last snapshot, for diagnosis (`__conWaitGraph().nodes`). */
let lastNodes: ReadonlyArray<WaitNode> = [];

/** Register a source of nodes (idempotent by name). Returns the unregister. */
export function registerWaitSource(name: string, read: () => ReadonlyArray<WaitNodeInput>): () => void {
  const i = sources.findIndex((s) => s.name === name);
  if (i !== -1) {
    sources.splice(i, 1);
  }
  const source = {name, read};
  sources.push(source);
  return () => {
    const j = sources.indexOf(source);
    if (j !== -1) {
      sources.splice(j, 1);
    }
  };
}

/**
 * Declare an imperative wait — the returned handle updates its targets and ENDS it (idempotent).
 *
 * THE DECLARATION IS A ROW OF THE FLOW KERNEL'S WAIT TABLE (architecture v2 — PLAN §10 · C3): owned by the session that
 * stands, bounded by the node's own bound, named by its owner and what it waits for. `declared` is the row's mirror in
 * the graph's vocabulary (the judge reads nodes), never a second book: the session ending WITHDRAWS the row and the
 * node with it — a ceiling wait whose run forgot to end it can no longer stand into the next game as an «overdue»
 * nobody owns.
 */
export function declareWait(node: WaitNodeInput, now: number = Date.now()): {update: (patch: Partial<WaitNodeInput>) => void, end: () => void} {
  const full: WaitNode = {...node, since: node.since ?? now};
  declared.set(full.id, full);
  const waitsFor = full.targets.map((target) => (target.kind === 'node' ? target.id : target.what)).join(' + ');
  const forget = consoleSessionScope().note(`${full.id} (${full.owner}) — ${waitsFor}`, () => {
    if (declared.get(full.id)?.since === full.since) {
      declared.delete(full.id);
    }
  }, full.boundMs);
  return {
    // Only THIS declaration's node — a newer declaration of the same id is another run's, never patched or ended here.
    update: (patch) => {
      const cur = declared.get(full.id);
      if (cur !== undefined && cur.since === full.since) {
        declared.set(full.id, {...cur, ...patch, since: cur.since} as WaitNode);
      }
    },
    end: () => {
      forget();
      if (declared.get(full.id)?.since === full.since) {
        declared.delete(full.id);
      }
    },
  };
}

/** Every node standing now (sources + declarations), `since` stamped. */
export function collectWaitNodes(now: number): Array<WaitNode> {
  const out = new Map<string, WaitNode>();
  for (const source of sources) {
    let read: ReadonlyArray<WaitNodeInput>;
    try {
      read = source.read();
    } catch (err) {
      waitGraphStats.sourceErrors++;
      console.warn(`[wait-graph] source «${source.name}» threw — ${String(err).slice(0, 160)}`);
      continue;
    }
    for (const n of read) {
      out.set(n.id, {...n, since: n.since ?? firstSeen.get(n.id) ?? now});
    }
  }
  for (const n of declared.values()) {
    out.set(n.id, n);
  }
  for (const id of [...firstSeen.keys()]) {
    if (!out.has(id)) {
      firstSeen.delete(id);
    }
  }
  for (const n of out.values()) {
    if (!firstSeen.has(n.id)) {
      firstSeen.set(n.id, n.since);
    }
  }
  return [...out.values()];
}

// ── Э3 — ACTING: a confirmed cycle is broken through its yielding member's own door ──────────────────────────────

/**
 * A RECOVERY DOOR, registered by the owner of a wait (the name a node's `recovery` carries). It ends THIS node's wait
 * through the owner's existing path and says what it did ('' = nothing to do here). Never a new path, never a press.
 */
export type WaitRecovery = (node: WaitNode) => string;

const recoveries = new Map<string, WaitRecovery>();

/** Register a door by name (idempotent). Returns the unregister. */
export function registerWaitRecovery(name: string, door: WaitRecovery): () => void {
  recoveries.set(name, door);
  return () => {
    if (recoveries.get(name) === door) {
      recoveries.delete(name);
    }
  };
}

/**
 * The classes armed by default: `cycle` (Э3), `dead-end` (2026-11-09 — a question asked with nothing on screen
 * accepting, nothing holding it and nothing in flight: its door re-opens the question's own surface through the router)
 * and `dangling` (a wait pointing at a node that is not there — «set aside» with no restore card: un-set-aside). A
 * finding whose node has no door is a worklist row.
 */
export const WAIT_GRAPH_DEFAULT_ARMED: ReadonlyArray<WaitFindingKind> = ['cycle', 'dead-end', 'dangling', 'overdue'];

/**
 * `overdue` acts only on these families — the waits whose bound is the graph's OWN (no other net ends them): the plate
 * whose first presentation never came (inventory A1 — the gate stuck PENDING on a leaked raw signal, no timer). Every
 * other family's bound is its owner's ceiling (a hold's expire, a story's degrade, a ceiling wait's line), and that
 * owner already acts at the same moment.
 */
export const WAIT_GRAPH_OVERDUE_FAMILIES: ReadonlySet<WaitNode['family']> = new Set<WaitNode['family']>(['announce']);

/**
 * THE ARMED CLASSES — which confirmed findings the graph acts on (Э3 arms one class at a time, the screen director's
 * discipline). `cycle` is armed: a mutual wait has no other way out but a force teardown seconds later. The rest stay a
 * shadow until their evidence says a door exists for them.
 */
export const waitGraphArming: {armed: Set<WaitFindingKind>} = {armed: new Set<WaitFindingKind>(WAIT_GRAPH_DEFAULT_ARMED)};

/** What the last cures did (diagnosis; newest last, bounded). */
export const waitGraphCures: Array<{at: number, finding: string, member: string, door: string, did: string}> = [];

/**
 * ACT on a confirmed finding: a cycle is broken at its YIELDING member (the lowest rank, the youngest); a member with
 * no door hands the turn to the next member up the rank order — the cycle is broken by the weakest party that CAN
 * yield. Logged `[wait-graph] cure …` (an e2e run reads it as a defect upstream to fix, never a success).
 */
function actOn(finding: WaitFinding, nodes: ReadonlyArray<WaitNode>, now: number): void {
  if (!waitGraphArming.armed.has(finding.kind)) {
    return;
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (finding.kind !== 'cycle') {
    // A ONE-MEMBER finding (a dead end, a dangling wait, an overdue plate): the node's OWN door, or a worklist row.
    const node = byId.get(finding.members[0]);
    if (finding.kind === 'overdue' && (node === undefined || !WAIT_GRAPH_OVERDUE_FAMILIES.has(node.family))) {
      return;
    }
    const door = node?.recovery === undefined ? undefined : recoveries.get(node.recovery);
    if (node === undefined || door === undefined) {
      console.warn(`[wait-graph] cure ${finding.kind} — ${finding.members[0]} has no door: a worklist row`);
      return;
    }
    let did = '';
    try {
      did = door(node);
    } catch (err) {
      console.warn(`[wait-graph] door «${node.recovery}» threw on ${node.id} — ${String(err).slice(0, 160)}`);
    }
    if (did !== '') {
      waitGraphCures.push({at: now, finding: findingKey(finding), member: node.id, door: node.recovery ?? '', did});
      if (waitGraphCures.length > 40) {
        waitGraphCures.shift();
      }
      console.warn(`[wait-graph] cure ${finding.kind} at ${node.id} through «${node.recovery}» — ${did}`);
    } else {
      console.warn(`[wait-graph] cure ${finding.kind} — the door «${node.recovery}» of ${node.id} had nothing to do: a worklist row`);
    }
    return;
  }
  const order = [finding.yields, ...finding.members.filter((m) => m !== finding.yields)]
    .filter((m): m is string => m !== undefined)
    .map((m) => byId.get(m))
    .filter((n): n is WaitNode => n !== undefined)
    .sort((a, b) => (a.id === finding.yields ? -1 : b.id === finding.yields ? 1 : 0));
  for (const node of order) {
    const door = node.recovery === undefined ? undefined : recoveries.get(node.recovery);
    if (door === undefined) {
      continue;
    }
    let did = '';
    try {
      did = door(node);
    } catch (err) {
      did = '';
      console.warn(`[wait-graph] door «${node.recovery}» threw on ${node.id} — ${String(err).slice(0, 160)}`);
    }
    if (did !== '') {
      waitGraphCures.push({at: now, finding: findingKey(finding), member: node.id, door: node.recovery ?? '', did});
      if (waitGraphCures.length > 40) {
        waitGraphCures.shift();
      }
      console.warn(`[wait-graph] cure ${finding.kind} at ${node.id} through «${node.recovery}» — ${did}`);
      return;
    }
  }
  console.warn(`[wait-graph] cure ${finding.kind} — no member's door could yield (${finding.members.join(', ')}): a worklist row`);
}

/** One tick: read, judge, confirm, log the newly confirmed. Returns the confirmed findings of this tick. */
export function tickWaitGraph(world: WaitWorld): Array<WaitFinding> {
  const nodes = collectWaitNodes(world.now);
  lastNodes = nodes;
  waitGraphStats.ticks++;
  waitGraphStats.maxNodes = Math.max(waitGraphStats.maxNodes, nodes.length);
  const r = confirmWaitFindings(confirm, judgeWaitGraph(nodes, world));
  confirm = r.state;
  for (const f of r.confirmed) {
    waitGraphStats.confirmed[f.kind]++;
    waitGraphStats.recent.push({at: world.now, finding: f});
    if (waitGraphStats.recent.length > 40) {
      waitGraphStats.recent.shift();
    }
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const members = f.members.map((m) => {
      const n = byId.get(m);
      return n === undefined ? m : `${m} (${n.owner}${n.detail !== undefined ? `: ${n.detail}` : ''})`;
    });
    console.warn(`[wait-graph] ${f.kind} ${members.join(' · ')} — ${f.why}` +
      `${f.yields !== undefined ? ` — yields: ${f.yields}` : ''} — standing ${Math.round(f.ageMs / 1000)} s`);
    actOn(f, nodes, world.now);
  }
  return r.confirmed;
}

/** The graph as it stood at the last tick, and the evidence (diagnosis; `window.__conWaitGraph`). */
export function waitGraphSnapshot(): {nodes: ReadonlyArray<WaitNode>, stats: typeof waitGraphStats, standing: Array<string>, cures: typeof waitGraphCures, armed: Array<string>} {
  return {nodes: lastNodes, stats: waitGraphStats, standing: [...confirm.streak.keys()], cures: waitGraphCures, armed: [...waitGraphArming.armed]};
}

/** A short digest of the graph for a field line (`[liveness] …`, the field recorder): `id<-targets` per node. */
export function waitGraphDigest(limit = 12): string {
  return lastNodes.slice(0, limit).map((n) => `${n.id}→${n.targets.map((t) => (t.kind === 'node' ? t.id : `${t.kind}`)).join('+')}`).join(' | ');
}

/** Test seam — forget every source, declaration and streak. */
export function resetWaitGraph(): void {
  sources.splice(0);
  declared.clear();
  firstSeen.clear();
  confirm = initialWaitGraphConfirm();
  lastNodes = [];
  waitGraphStats.ticks = 0;
  waitGraphStats.maxNodes = 0;
  waitGraphStats.sourceErrors = 0;
  for (const k of Object.keys(waitGraphStats.confirmed) as Array<WaitFindingKind>) {
    waitGraphStats.confirmed[k] = 0;
  }
  waitGraphStats.recent.splice(0);
  recoveries.clear();
  waitGraphCures.splice(0);
  waitGraphArming.armed = new Set<WaitFindingKind>(WAIT_GRAPH_DEFAULT_ARMED);
}

/** For tests: the key a finding is tracked by. */
export {findingKey};
