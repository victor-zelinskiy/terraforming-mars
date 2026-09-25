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
 */
import {reactive} from 'vue';
import {SpaceId} from '@/common/Types';

export const stackSceneState = reactive({
  /** The cell a tier is descending onto — the base takes the load. */
  loading: undefined as SpaceId | undefined,
  /** The cell a tier just touched down on — the counter ticks, the cell jolts. */
  contact: undefined as SpaceId | undefined,
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
