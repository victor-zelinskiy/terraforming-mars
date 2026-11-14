/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A WAIT WHOSE ONLY WAY OUT IS A CEILING — the class the owner's field freeze of 2026-11-08 belonged to (Flooding: the
 * played hero waited for a pay-back whose commit waited for the hero; 8 s of a still card until `PAYBACK_WAIT_MAX_MS`
 * broke it). Such a wait is a node of the wait graph for as long as it stands (owner, what it waits for, its ceiling as
 * the bound) — and when the CEILING ends it rather than the thing it waited for, that is said once:
 * `[wait-graph] ceiling <id> (<owner>) — «<what>» did not come in N ms`. A ceiling is a safety, never a schedule: every
 * line is a hidden mutual wait or a lost signal upstream — harvested per e2e test and per monkey walk as the worklist
 * (docs/claude/console/wait-graph.md § CEILINGS; `ceilingWaitGuard.spec` keeps new ceilings on this primitive).
 */
import {FlowScope, polled, settled} from '@/client/console/kernel/flowScope';
import {consoleSessionScope} from '@/client/console/session/consoleSession';
import {declareWait} from '@/client/console/waitGraph/waitGraph';
import {WaitNode} from '@/client/console/waitGraph/waitGraphModel';

export type CeilingWaitSpec = {
  /** The wait's name — stable per call site (`played-hero:payback`); the run is numbered by the primitive. */
  id: string,
  /** The module that waits. */
  owner: string,
  /** What it waits FOR — the line names it when it never came. */
  what: string,
  /** The ceiling (ms) — the node's bound. */
  maxMs: number,
  /** Who answers: a motion (the default), the server, the player. */
  target?: 'motion' | 'server' | 'player',
  family?: WaitNode['family'],
  detail?: string,
  /**
   * THIS WAIT'S CEILING IS ITS HONEST END — say why (one phrase). A ceiling is a safety, never a schedule: a line of an
   * undeclared wait is a defect upstream (an EVENT — `common/diagnostics/shapes.ts`). A wait for something only the
   * PLAYER decides the time of (a foreign tile waiting for a board the viewer keeps covered) reaches its ceiling by
   * design; declared so, its line is COUNTED and never an event. Declaring it is a decision to defend in review —
   * never a way to silence a line.
   */
  planned?: string,
};

export type CeilingWait = {
  /** The awaited thing came — the node ends. */
  met: () => void,
  /** The ceiling ended it — named once, counted, the node ends. */
  ceiling: () => void,
  /** The wait was abandoned (its run is gone) — the node ends, nothing is said. */
  end: () => void,
  /** What holds it right now — on the node, and named by the ceiling line if it comes. */
  update: (detail: string) => void,
};

/** Evidence (`__conWaitGraph().ceilings`): how many waits met their thing, how many ended on the ceiling, the last ones. */
export const ceilingStats = {
  met: 0,
  hits: 0,
  recent: [] as Array<{at: number, id: string, owner: string, what: string, maxMs: number}>,
};

let seq = 0;

export function beginCeilingWait(spec: CeilingWaitSpec, now: number = Date.now()): CeilingWait {
  const run = ++seq;
  const node = declareWait({
    id: `ceiling:${spec.id}#${run}`, family: spec.family ?? 'flow', owner: spec.owner,
    targets: [{kind: spec.target ?? 'motion', what: spec.what}], boundMs: spec.maxMs,
    ...(spec.detail !== undefined ? {detail: spec.detail} : {}),
  }, now);
  let open = true;
  let detail = spec.detail;
  return {
    met: () => {
      if (open) {
        open = false;
        ceilingStats.met++;
        node.end();
      }
    },
    ceiling: () => {
      if (!open) {
        return;
      }
      open = false;
      node.end();
      ceilingStats.hits++;
      ceilingStats.recent.push({at: Date.now(), id: spec.id, owner: spec.owner, what: spec.what, maxMs: spec.maxMs});
      if (ceilingStats.recent.length > 40) {
        ceilingStats.recent.shift();
      }
      console.warn(`[wait-graph] ceiling ${spec.id} (${spec.owner}${detail !== undefined && detail !== '' ? `: ${detail}` : ''}) — ` +
        `«${spec.what}» did not come in ${spec.maxMs} ms — the wait ended on its ceiling${spec.planned !== undefined ? ` (planned: ${spec.planned})` : ''}`);
    },
    end: () => {
      if (open) {
        open = false;
        node.end();
      }
    },
    update: (d) => {
      if (open && d !== detail) {
        detail = d;
        node.update({detail: d});
      }
    },
  };
}

/**
 * Race `until` against the ceiling: resolves `true` when the awaited thing came first, `false` when the ceiling ended the
 * wait (said once).
 *
 * The race is a WAIT OF THE FLOW KERNEL (architecture v2 — PLAN §10 · C3): bounded by the ceiling on the kernel's clock,
 * a row of the wait table while it stands, and OWNED — by `owner` when the caller has a run of its own (a scene's scope,
 * a hold's), by the session otherwise. When the owner ends first the wait is over (`false`: nothing is coming for a
 * flow that is gone) — the race used to keep its timer and its continuation alive into the next game.
 */
export function raceCeiling(spec: CeilingWaitSpec, until: Promise<unknown>, owner: FlowScope = consoleSessionScope()): Promise<boolean> {
  const w = beginCeilingWait(spec);
  // Quiet: the ceiling's own line (`[wait-graph] ceiling …`) is the one the harvests read.
  return owner.wait(settled(spec.what, until), {bound: {ms: spec.maxMs, quiet: 'said by the ceiling line'}}).then((result) => {
    switch (result.status) {
    case 'met':
      if (result.value.ok) {
        w.met();
      } else {
        w.end();
      }
      return true;
    case 'bound':
      w.ceiling();
      return false;
    default:
      w.end();
      return false;
    }
  });
}

/**
 * A CONDITION against the ceiling: resolves `true` when `read` came true (it is re-read every `everyMs` on the kernel's
 * clock — true now resolves now), `false` when the ceiling ended the wait (said once) or its owner ended first.
 *
 * What a hand-written poll becomes — `wait ??= beginCeilingWait(…)`, a `setTimeout(poll, …)` / a frame loop, a deadline
 * compared by hand: one bounded, owned row of the wait table, still a node of the legacy graph with its ceiling line.
 */
export function untilCeiling(spec: CeilingWaitSpec, read: () => boolean, owner: FlowScope = consoleSessionScope(), everyMs = 100): Promise<boolean> {
  if (read()) {
    return Promise.resolve(true);
  }
  const w = beginCeilingWait(spec);
  return owner.wait(polled(spec.what, read, everyMs), {bound: {ms: spec.maxMs, quiet: 'said by the ceiling line'}}).then((result) => {
    if (result.status === 'met') {
      w.met();
      return true;
    }
    if (result.status === 'bound') {
      w.ceiling();
    } else {
      w.end();
    }
    return false;
  });
}

/** Test seam. */
export function resetCeilingStats(): void {
  ceilingStats.met = 0;
  ceilingStats.hits = 0;
  ceilingStats.recent.splice(0);
  seq = 0;
}
