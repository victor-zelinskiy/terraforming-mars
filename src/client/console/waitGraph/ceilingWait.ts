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
        `«${spec.what}» did not come in ${spec.maxMs} ms — the wait ended on its ceiling`);
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
 * wait (said once). The ceiling's timer is cleared either way.
 */
export function raceCeiling(spec: CeilingWaitSpec, until: Promise<unknown>): Promise<boolean> {
  const w = beginCeilingWait(spec);
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      w.ceiling();
      resolve(false);
    }, spec.maxMs);
    until.then(() => {
      clearTimeout(timer);
      w.met();
      resolve(true);
    }, () => {
      clearTimeout(timer);
      w.end();
      resolve(true);
    });
  });
}

/** Test seam. */
export function resetCeilingStats(): void {
  ceilingStats.met = 0;
  ceilingStats.hits = 0;
  ceilingStats.recent.splice(0);
  seq = 0;
}
