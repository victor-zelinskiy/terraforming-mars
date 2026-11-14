/*
 * @console-shared LIVE — console native stands on this file.
 *
 * WHAT STOOD — the evidence a stall's event carries (`DiagEvidence`), and the one word that names its HOLDER.
 *
 * A freeze of this console is a wait nobody ended. Until this module its event said THAT the screen stood («unserved,
 * asked card») and an agent had to ask the player for a report to learn WHY. Now the supervisor says who held the
 * question in ONE word of the arbiter's line (`holder:` — the tail of the cause class, `cause.ts`), and the event
 * carries what stood at that moment: the kernel's flow tree with every wait, the wait table, the wait graph, the
 * kernel's last records (the machines' transitions among them) and what the pad's funnel last saw.
 *
 * Taken ONCE per defect, when its line is printed — or BEFORE an acting net acts (`diagnosticsCapture.ts`
 * `withDiagEvidence`) — never on a healthy second. Bounded. Read-only: nothing here changes what it describes.
 */
import {
  DIAG_EVIDENCE_GRAPH_MAX, DIAG_EVIDENCE_LINE_MAX, DIAG_EVIDENCE_TRACE_MAX, DIAG_EVIDENCE_TREE_MAX, DIAG_EVIDENCE_WAITS_MAX, DiagEvidence,
} from '@/common/diagnostics/DiagnosticModel';
import {dumpFlowTree, waitTable} from '@/client/console/kernel/flowScope';
import {flowTraceLines} from '@/client/console/kernel/flowTrace';
import {inputEchoSnapshot} from '@/client/console/inputEcho';
import {waitGraphSnapshot} from '@/client/console/waitGraph/waitGraph';

/** What the supervisor knows of the screen that a holder is named from — every term a fact it already samples. */
export type StallHolderFacts = {
  /** The leak detector found NO surface serving the live question. */
  stranded: boolean;
  /** A claim stands: `<host>:<stage>` ('' = none). */
  claim: string;
  /** A live frame of a phase that is over ('' = none). */
  deadFrame: string;
  /** A transient beat stands on the deepest frame (the pad absorbed by contract). */
  beat: boolean;
  /** A surface hand-over is awaited: what it is awaited FROM ('' = none). */
  awaiting: string;
  /** The admission block holding the question's surface ('' = none). */
  block: string;
  /** The oldest BLOCKING animation hold ('' = none). */
  hold: string;
  /** The screen accepts, and the player's presses change nothing. */
  deaf: boolean;
};

/**
 * WHO HOLDS THE QUESTION — one word, by ONE precedence (the first that holds): what leaves the question with no
 * surface at all comes before what keeps a standing surface from taking input, and a suspect that is only
 * circumstantial (a claim, a hold) comes last. A stranded question names the claim beside it: an orphaned claim is
 * what suppresses the question's own surface (the Hi-Tech Lab class).
 */
export function stallHolder(f: StallHolderFacts): string {
  if (f.stranded) {
    return f.claim !== '' ? `stranded+claim:${f.claim}` : 'stranded';
  }
  if (f.deadFrame !== '') {
    return `dead-frame:${f.deadFrame}`;
  }
  if (f.beat) {
    return 'beat';
  }
  if (f.awaiting !== '') {
    return `awaiting:${f.awaiting}`;
  }
  if (f.block !== '') {
    return `block:${f.block}`;
  }
  if (f.claim !== '') {
    return `claim:${f.claim}`;
  }
  if (f.hold !== '') {
    return `hold:${f.hold}`;
  }
  return f.deaf ? 'deaf' : 'none';
}

function clip(line: string): string {
  return line.length <= DIAG_EVIDENCE_LINE_MAX ? line : `${line.slice(0, DIAG_EVIDENCE_LINE_MAX - 1)}…`;
}

/**
 * The tree within its bound: whole when it fits; else every scope near the roots and every scope that WAITS (a wait
 * is what a stall is made of), in the tree's own order, with what was left out counted.
 */
export function boundedTree(lines: ReadonlyArray<string>, max: number = DIAG_EVIDENCE_TREE_MAX): Array<string> {
  if (lines.length <= max) {
    return lines.map(clip);
  }
  const depth = (line: string): number => (line.length - line.trimStart().length) / 2;
  const kept = lines.filter((line) => depth(line) <= 2 || line.includes('⟵ waits'));
  const shown = kept.slice(0, max).map(clip);
  return [...shown, `… ${lines.length - shown.length} more scope(s) stand (idle leaves and what did not fit)`];
}

/** The supervisor's own account, handed in: it reads the shell through its port, this module does not. */
export type StallEvidenceFacts = {
  /** The server's question, the task, who may serve it, who does. */
  question: string;
  /** Who holds it — the class's holder first. */
  holders: ReadonlyArray<string>;
};

/** One snapshot of what stands. */
export function buildStallEvidence(facts: StallEvidenceFacts, now: number = Date.now()): DiagEvidence {
  const seconds = (since: number): string => `${Math.max(0, (now - since) / 1000).toFixed(1)}s`;
  const waits = waitTable()
    .filter((row) => row.family !== 'timer')
    .sort((a, b) => a.since - b.since)
    .slice(0, DIAG_EVIDENCE_WAITS_MAX)
    .map((row) => clip(`${row.owner} [${row.family}] waits «${row.what}»${row.on !== undefined ? ` → ${row.on}` : ''} ${seconds(row.since)}` +
      `${row.boundMs === undefined ? '' : ` of ${Math.round(row.boundMs / 1000)}s`}`));
  const graph = waitGraphSnapshot();
  const nodes = graph.nodes.slice(0, DIAG_EVIDENCE_GRAPH_MAX).map((n) => clip(
    `${n.id} (${n.owner}${n.detail !== undefined ? `: ${n.detail}` : ''}) → ` +
    `${n.targets.map((t) => (t.kind === 'node' ? t.id : `${t.kind}:${t.what}`)).join(' + ')} ${seconds(n.since)}` +
    `${n.boundMs === undefined ? '' : ` of ${Math.round(n.boundMs / 1000)}s`}${n.recovery !== undefined ? ` [door ${n.recovery}]` : ''}`));
  const standing = graph.standing.map((key) => clip(`finding: ${key}`));
  const echo = inputEchoSnapshot();
  const last = echo.lastPress;
  return {
    at: now,
    question: clip(facts.question),
    holders: facts.holders.map(clip),
    tree: boundedTree(dumpFlowTree()),
    waits,
    graph: [...nodes, ...standing],
    trace: flowTraceLines(DIAG_EVIDENCE_TRACE_MAX).map(clip),
    input: `A/B presses ${echo.verbPresses} (no handler took ${echo.verbDropped}, B taken ${echo.backTaken}), absorbed ${echo.absorbed}` +
      `${last === undefined ? '' : `; last press ${last.code} → ${last.outcome}${last.absorbedBy !== undefined && last.absorbedBy.length > 0 ? ` by ${last.absorbedBy.join(',')}` : ''}`}`,
  };
}
