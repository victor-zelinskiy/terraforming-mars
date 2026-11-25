/*
 * @console-shared LIVE — console native stands on this file.
 *
 * MODULE STATE MORE THAN ONE SHELL CONTROLLER STANDS ON (architecture v2 — the shell slices). In the monolith these
 * were module-level declarations of ConsoleShell.vue, shared by whoever was in the file; now that the file's domains
 * are controllers, what two of them read lives here, by name. (State ONE domain owns lives in that domain's
 * controller. This file shrinks as the conclusion and the supervisor stop sampling each other — PLAN §5 · S5, §6.)
 */
import {reactive} from 'vue';
import type {WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {sessionState} from '@/client/console/session/consoleSession';

/**
 * THE WAIT GRAPH's BOUND OF AN OWED CONCLUSION THAT HOLDS ON A MOTION (`supervisorController` — the node
 * `conclusion:<kind>`). A flow that reported FINISHED (its ending is OWED — `workspaceConclusionOwe.ts`) and still
 * cannot dismiss is re-asked on its facts and on its cadence, and a ghost is torn down by the debt's own LEVEL door
 * (a second of painted quiet); this number is only what the graph's judge holds the node to — past it the debt is
 * `overdue` and the graph's own door re-asks. (It was the sum of the escalation's two clocks — eight seconds owed, two
 * and a half read a ghost — until the escalation became a door, 2026-11-23; `docs/claude/console/flow-close-gates.md`
 * § THE STALL NET.)
 */
export const OWED_CONCLUSION_BOUND_MS = 10_500;

/**
 * THE LAST REFUSED CONCLUSION — which workspace, and the NAMED hold that refused it (`workspaceConclusionFor`'s
 * reason). Diagnostics only (the conclusion witness's heal warn reads it): plain module state, never reactive — a
 * refusal must not become a render dependency of anything. A holder (`.last`), because the conclusion writes it and
 * the supervisor reads it from another module.
 */
export const conclusionRefusal: {
  last: {kind: WorkspaceFrameKind, reason: string, at: number} | undefined,
  /**
   * …AND EACH WORKSPACE's OWN (FREEZE ZERO, CI #148 — game 1125): one slot for every kind meant the refusal of ANOTHER
   * workspace overwrote this one's, and a debt read «held: unknown» — no edge in the hold table, the motion bound of
   * 10.5 s on a step that has no clock: «overdue … past its 11 s bound — standing 33 s». A kind's reason is cleared
   * only by ITS OWN conclusion.
   */
  byKind: Map<WorkspaceFrameKind, {reason: string, at: number}>,
} = {last: undefined, byKind: new Map()};

/** The named hold this workspace's last refused conclusion held on, `'unknown'` when it never refused. */
export function conclusionRefusalOf(kind: WorkspaceFrameKind): string {
  return conclusionRefusal.byKind.get(kind)?.reason ?? 'unknown';
}

/** The session's end: nothing of a refusal carries over. */
export function resetConclusionRefusal(): void {
  conclusionRefusal.last = undefined;
  conclusionRefusal.byKind.clear();
}

/**
 * Workspace entries deferred to the screen handoff (`enterWorkspaceAfterHandoff`) — one pending entry per kind.
 * REACTIVE: a cached computed reads it (`draftClaimsTask` — an owed entry claims its prompts), and a plain Set there
 * would be a latch (invariant 17).
 */
export const handoffPendingEntries = reactive(new Set<WorkspaceFrameKind>());

// THE GAME SCREEN LEAVES: no refusal of the last game names a workspace of the next one.
sessionState('conclusion-refusal', resetConclusionRefusal, 185);
