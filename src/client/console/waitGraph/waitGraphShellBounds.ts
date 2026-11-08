/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE BOUND each admission block may honestly hold a family for (the wait graph's shell source, Э2) — read off the
 * owners' own ceilings in the inventory (docs/claude/console/wait-graph-inventory.md): a block held past it is
 * `overdue` in the graph. `reveal` is not here: the player takes the cards — honest for as long as they read.
 */
import type {AdmissionBlock} from '@/client/console/consolePromptAdmission';
import type {WorkspaceHoldReason} from '@/client/console/consoleWorkspaceFlow';

/**
 * EXHAUSTIVE BY TYPE (Э4 — the law): a new admission block that holds a family by TIMING must say how long it may; the
 * compiler refuses a block missing here. `reveal` (the player reads) and `announce-gate` (an edge to the plate's own
 * node) are the two that are not a clock.
 */
export const WAIT_ADMISSION_BOUND_MS: Readonly<Record<Exclude<AdmissionBlock, 'reveal' | 'announce-gate'>, number>> = {
  'stage-gate': 15_000,
  'played-hero': 35_000,
  'tile-hero': 35_000,
  'card-arrival': 35_000,
  'board-bonus': 35_000,
  'card-discard': 35_000,
  'presentation': 35_000,
  'animation': 35_000,
  'remote-landing': 20_000,
  'board-story': 30_000,
  'table-answer': 20_000,
};

/**
 * WHAT A HELD CONCLUSION WAITS FOR, by its reason — EXHAUSTIVE BY TYPE (Э4): a new hold reason must name its edge in the
 * graph or the compiler refuses it. `question` — the live question (owned-prompt); `nested` — the frame standing above;
 * `claim` — its own claim; `follow-up` — the follow-up door's admission; `player` — the player's restore; `motion` — a
 * story of its own bounded by the conclusion's escalation.
 */
export const CONCLUSION_HOLD_EDGE: Readonly<Record<WorkspaceHoldReason, 'question' | 'nested' | 'claim' | 'follow-up' | 'player' | 'motion'>> = {
  'nested-step': 'nested',
  'owed-step': 'follow-up',
  'live-outcome': 'claim',
  'owned-prompt': 'question',
  'parked': 'player',
  'off-stage': 'motion',
};
