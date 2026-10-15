/*
 * THE PROMPT HANDOFF — the PURE half of «one decision gives way to the next» (PL-384, the owner's order of
 * 2026-10-15: «a premium transition — not drawn out, visually pleasant and WORKED OUT»).
 *
 * One press routinely answers a decision AND raises the next one (Philares' reward, then the Ares hazard's loss — one
 * placement). Two prompt plates used to swap as a ~110 ms cross-fade (two band surfaces) or a plain out-in fade (a
 * keyed panel inside one surface): the answered plate and the new one were briefly the same blur, and the new
 * question arrived the way a re-render does — nothing said «this is ANOTHER decision».
 *
 * The phrase is one sentence in three beats, the same for both hosts (`promptHandoffMotion.ts`):
 *   1. RELEASE  — the answered plate lets go ON THE SPOT (a hair of scale back, opacity out; no travel — the band's
 *                 frames never move);
 *   2. ARRIVE   — the next plate materializes where the decision always stands, from a hair further back than an
 *                 ordinary open, starting a beat BEFORE the release has fully gone (the stage is never empty, and
 *                 the two plates are never both legible);
 *   3. COMPOSE  — its head and blocks surface from inside in reading order (category · the ask · why · the body),
 *                 so the eye is led back to the top of a NEW question. A tone flip's beat (the crest, the emblem,
 *                 the tag) starts once the plate has arrived.
 * About 0.4 s from the press to a readable plate; the last block settles by ~0.55 s.
 *
 * Unit-tested under the server runner (no DOM): tests/console/promptHandoffModel.spec.ts.
 */
import {SurfaceMotionId} from '@/client/console/surfaceMotion/surfaceMotionModel';

/** The answered plate lets go. */
export const PROMPT_RELEASE_MS = 130;
/** The next plate materializes. */
export const PROMPT_ARRIVE_MS = 300;
/** The arrival starts this long BEFORE the release ends (never both legible: the release is at ~⅓ opacity then). */
export const PROMPT_ARRIVE_OVERLAP_MS = 40;
/** The compose cascade's first block, after the plate's own start. */
export const PROMPT_COMPOSE_AT_MS = 70;
/** …and the step between blocks. */
export const PROMPT_COMPOSE_STEP_MS = 45;
/** One block's rise. */
export const PROMPT_COMPOSE_MS = 240;
/** A long plate composes its first blocks only — the rest is already there (a cascade of ten reads as a load). */
export const PROMPT_COMPOSE_MAX = 6;
/** A plate entering this long after a prompt plate let go is the NEXT decision of the same moment (one response
 *  replaces one prompt with the next in a single flush — the window only absorbs a slow frame). */
export const PROMPT_HANDOFF_WINDOW_MS = 450;
/** The arrival's starting scale (an ordinary open materializes from .988 — a handoff from a hair further back). */
export const PROMPT_ARRIVE_SCALE = 0.965;
/** The release's resting scale. */
export const PROMPT_RELEASE_SCALE = 0.975;

/**
 * The prompt-modal family's BAND surfaces — a closed table (never inferred at a call site). A new family plate
 * joins here or it keeps the plain workspace materialize.
 */
export const PROMPT_SURFACES: ReadonlySet<SurfaceMotionId> = new Set<SurfaceMotionId>([
  'task-host',
  'production-loss',
  'effect-decision',
  'bot-attack',
  'gov-support',
  'spend-heat',
  'venus-bonus',
  'ares-globals',
  'confirm',
]);

export function isPromptSurface(id: SurfaceMotionId | undefined): boolean {
  return id !== undefined && PROMPT_SURFACES.has(id);
}

/**
 * How long the incoming plate WAITS before it materializes — the release's remaining time minus the overlap.
 * `undefined` = no prompt let go recently: this is an ordinary open, not a handoff.
 */
export function promptArrivalDelayMs(releaseAt: number | undefined, now: number): number | undefined {
  if (releaseAt === undefined) {
    return undefined;
  }
  const since = now - releaseAt;
  if (since < 0 || since > PROMPT_HANDOFF_WINDOW_MS) {
    return undefined;
  }
  return Math.max(0, PROMPT_RELEASE_MS - PROMPT_ARRIVE_OVERLAP_MS - since);
}

/** The compose cascade's offsets (ms from the plate's own start), one per block, capped. */
export function promptComposeOffsets(count: number): ReadonlyArray<number> {
  const n = Math.max(0, Math.min(count, PROMPT_COMPOSE_MAX));
  return Array.from({length: n}, (_, i) => PROMPT_COMPOSE_AT_MS + i * PROMPT_COMPOSE_STEP_MS);
}

/** The whole arrival's length from the plate's own start (the guard's budget). */
export function promptArrivalSpanMs(blocks: number): number {
  const offsets = promptComposeOffsets(blocks);
  const last = offsets.length === 0 ? 0 : offsets[offsets.length - 1] + PROMPT_COMPOSE_MS;
  return Math.max(PROMPT_ARRIVE_MS, last);
}

// ── the one fact the two hosts share: WHEN a prompt plate last let go ───────────────────────────────────────────

let releaseAt: number | undefined;

const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** A prompt plate starts letting go (a band surface's leave, a keyed panel's leave). */
export function notePromptRelease(at: number = clock()): void {
  releaseAt = at;
}

/** The incoming plate's wait, read (never consumed) — the head reads it at render for its beat, the director at
 *  its enter; both see the same release. */
export function promptHandoffDelayNow(at: number = clock()): number | undefined {
  return promptArrivalDelayMs(releaseAt, at);
}

/** Game-switch / spec boundary. */
export function resetPromptHandoff(): void {
  releaseAt = undefined;
}
