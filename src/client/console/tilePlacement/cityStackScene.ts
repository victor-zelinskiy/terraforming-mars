/*
 * cityStackScene — the REAL CELL's part of the city-tier landing (Turmoil
 * Redux — Skyscrapers, `docs/claude/console/tile-replacement.md` § THE THIRD
 * CASE). The tier's own flight is a proxy on the hero stage
 * (`consoleTilePlacement` / `tilePlacementDirector`); what the cell UNDER it
 * does is CSS driven from this tiny reactive state, so the board's own
 * transforms (the stack's lift, the tiers' step) and the scene's never fight
 * over one element's `transform`:
 *
 *   loading — the tier hangs over the cell and the base takes the load: the
 *             contour tightens, the standing tile settles down a pixel and
 *             compresses to the stack's scale, the counter APPEARS at the
 *             current height («×1»); only THIS cell reacts, never a neighbour;
 *   contact — the tier touched down: the model already carries the new
 *             height (the paint is the same frame), so the counter reads «×2»
 *             and TICKS, the whole cell takes one micro-jolt, the dust falls.
 *
 * ONE owner: the placement transaction opens `loading` when the vertical
 * descent begins, flips it to `contact` in the same synchronous turn the real
 * tile paints, and clears everything at `finish` / `abort` — a cell may never
 * be left «loading» (its counter would lie) or «contact» (its jolt would
 * replay on the next paint).
 *
 * THE CRANE, REVERSED (a MOVE off a stack — TR14 Re-settlement, § THE FOURTH
 * CASE): the same two answers, mirrored, in the frame the top tier stops
 * painting on the cell (the proxy has taken it over):
 *
 *   released  — the mirror of `contact`: the model already carries the lower
 *               height, so the counter reads it and TICKS «×2 → ×1»; at
 *               height 1 it has said its last number and goes;
 *   unloading — the mirror of `loading`: the load is gone, the base returns
 *               from the stack's scale to the full hex.
 *
 * A move may run on the hero stage (the viewer's own) and on the remote stage
 * (somebody else's) — each clears only the cell it marked.
 */
import {reactive} from 'vue';
import {SpaceId} from '@/common/Types';

export const stackSceneState = reactive({
  /** The cell a tier is descending onto — the base takes the load. */
  loading: undefined as SpaceId | undefined,
  /** The cell a tier just touched down on — the counter ticks, the cell jolts. */
  contact: undefined as SpaceId | undefined,
  /** The cell a tier just LIFTED OFF (a move) — the counter ticks down. */
  released: undefined as SpaceId | undefined,
  /** …and its base is returning to the full hex. */
  unloading: undefined as SpaceId | undefined,
});

export function beginStackLoad(id: SpaceId): void {
  stackSceneState.contact = undefined;
  stackSceneState.loading = id;
}

/** The touchdown: called in the SAME synchronous turn the real tile paints, so the counter's tick and its new number are one frame. */
export function stackContact(id: SpaceId): void {
  stackSceneState.loading = undefined;
  stackSceneState.contact = id;
}

/** The top tier left the cell — called in the SAME synchronous turn the model drops the tier, so the tick and its new number are one frame. */
export function stackRelease(id: SpaceId): void {
  stackSceneState.released = id;
  stackSceneState.unloading = id;
}

/** The move that marked `id` is over (or aborted): its release states go — and only its own. */
export function clearStackRelease(id: SpaceId): void {
  if (stackSceneState.released === id) {
    stackSceneState.released = undefined;
  }
  if (stackSceneState.unloading === id) {
    stackSceneState.unloading = undefined;
  }
}

export function clearStackScene(): void {
  stackSceneState.loading = undefined;
  stackSceneState.contact = undefined;
}

export function stackLoadingAt(id: SpaceId): boolean {
  return stackSceneState.loading === id;
}

export function stackContactAt(id: SpaceId): boolean {
  return stackSceneState.contact === id;
}

export function stackReleasedAt(id: SpaceId): boolean {
  return stackSceneState.released === id;
}

export function stackUnloadingAt(id: SpaceId): boolean {
  return stackSceneState.unloading === id;
}
