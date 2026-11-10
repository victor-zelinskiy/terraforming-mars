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

/**
 * THE WORKSPACE-STALL FORCE GRACE. A flow that reported FINISHED (its ending is
 * OWED — `workspaceConclusionOwe.ts`) and still cannot dismiss for this long, with
 * nothing the player could act on, is a ghost — the owed run force-tears it down.
 * Above every legitimate transient (the soft reconcile + re-ask window ≈ 5 s),
 * well below the board-beat park's 30 s cliff and the claim's 20 s backstop,
 * so the player never waits those out again. The universal net the four field
 * hangs earned — see `docs/claude/console/flow-close-gates.md` § THE STALL NET.
 */
export const OWED_CONCLUSION_FORCE_MS = 8000;

/**
 * …AND THE GHOST VERDICT ITSELF MUST HOLD THIS LONG, CONTINUOUSLY, before the force. The escalation clock above runs
 * from the FIRST owe — which can be a legitimate hold the player spent 16 s in (the Reds' discard album) — so a verdict
 * read once, in the very flush an answer lands, tore the workspace down under the payout that answer had just seeded
 * (field 2026-10-24 / 25: «card-actions … could not dismiss for 18s … signal: ||payout||», then the rail held 35 s).
 * A transient (a flush between the answer and its flyer) never survives this window; a real ghost always does.
 */
export const OWED_CONCLUSION_GHOST_CONFIRM_MS = 2500;

/**
 * THE LAST REFUSED CONCLUSION — which workspace, and the NAMED hold that refused it (`workspaceConclusionFor`'s
 * reason). Diagnostics only (the conclusion witness's heal warn reads it): plain module state, never reactive — a
 * refusal must not become a render dependency of anything. A holder (`.last`), because the conclusion writes it and
 * the supervisor reads it from another module.
 */
export const conclusionRefusal: {last: {kind: WorkspaceFrameKind, reason: string, at: number} | undefined} = {last: undefined};

/**
 * Workspace entries deferred to the screen handoff (`enterWorkspaceAfterHandoff`) — one pending entry per kind.
 * REACTIVE: a cached computed reads it (`draftClaimsTask` — an owed entry claims its prompts), and a plain Set there
 * would be a latch (invariant 17).
 */
export const handoffPendingEntries = reactive(new Set<WorkspaceFrameKind>());
