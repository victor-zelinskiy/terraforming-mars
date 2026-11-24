/*
 * @console-shared LIVE — the journal's hover previews stand on this file.
 *
 * WHERE A HOVER PREVIEW STANDS — beside the name that raised it, by the size it REALLY has.
 *
 * Every preview of the journal (a card, a colony, an award) is teleported to the body and placed by the rect of its
 * chip: to the LEFT of it (the journal lives on the right edge — the room is over the board), flipped to the right
 * when the left has none, centred on the chip's line and clamped into the viewport.
 *
 * THE SIZE IS MEASURED, NEVER ASSUMED. Each popover used to carry «the approximate rendered size» as two constants,
 * «used only for positioning math» — and the thing it positioned changed under them: the colony's tile, rebuilt
 * since, renders about 155 × 118 where the constants still said 286 × 360, so its preview stood a hundred and fifty
 * pixels ABOVE the name it explained and far to its left, over a line that had nothing to do with it (the first walk
 * of the journal's chips under a pointer — FREEZE ZERO, stage 4, 2026-11-25). The preview is laid out once, hidden,
 * measured in the same flush, and shown where its own box says; the constants are only the guess of that one
 * unpainted pass.
 */
import {computed, ComputedRef, onMounted, ref, watch} from 'vue';

export type PreviewSize = {width: number, height: number};
export type PreviewAnchor = {left: number, right: number, top: number, height: number};

/** The gap between the chip and its preview. */
export const PREVIEW_GAP = 14;
/** The preview never comes closer to a screen edge than this. */
export const PREVIEW_VIEWPORT_MARGIN = 8;

/** Pure: the preview's top-left corner for a chip at `anchor`, a box of `size`, a viewport. */
export function previewPlacement(anchor: PreviewAnchor, size: PreviewSize, viewport: PreviewSize): {left: number, top: number} {
  // Horizontal: left of the chip; no room there — right of it; then clamped, so it never spills off either edge.
  let left = anchor.left - PREVIEW_GAP - size.width;
  if (left < PREVIEW_VIEWPORT_MARGIN) {
    left = anchor.right + PREVIEW_GAP;
  }
  left = Math.max(PREVIEW_VIEWPORT_MARGIN, Math.min(left, viewport.width - size.width - PREVIEW_VIEWPORT_MARGIN));
  // Vertical: centred on the chip's line, clamped into the viewport.
  let top = anchor.top + anchor.height / 2 - size.height / 2;
  top = Math.max(PREVIEW_VIEWPORT_MARGIN, Math.min(top, viewport.height - size.height - PREVIEW_VIEWPORT_MARGIN));
  return {left: Math.round(left), top: Math.round(top)};
}

/**
 * The preview's inline style, placed by its MEASURED box.
 *  · `box`    — the element whose on-screen rect IS the preview (a template ref of the popover);
 *  · `shown`  — the popover is rendered (its `v-if`);
 *  · `anchor` — the chip's rect;
 *  · `guess`  — the size assumed for the one pass before the measure (that pass is not painted: `visibility: hidden`).
 * The measure runs POST-flush on the edge that shows the popover or moves its anchor — the node is in the DOM by then —
 * and once on the mount (a popover born shown has no such edge).
 */
export function useMeasuredPreviewStyle(
  box: {readonly value: HTMLElement | null},
  shown: () => boolean,
  anchor: () => PreviewAnchor | undefined,
  guess: PreviewSize,
): ComputedRef<Record<string, string>> {
  const measured = ref<PreviewSize | undefined>(undefined);
  const measure = (): void => {
    if (!shown() || anchor() === undefined) {
      measured.value = undefined;
      return;
    }
    const rect = box.value?.getBoundingClientRect();
    if (rect !== undefined && rect.width > 0 && rect.height > 0) {
      measured.value = {width: rect.width, height: rect.height};
    }
  };
  watch(() => (shown() ? anchor() : undefined), measure, {flush: 'post'});
  onMounted(measure);
  return computed((): Record<string, string> => {
    const a = anchor();
    if (a === undefined) {
      return {display: 'none'};
    }
    const at = previewPlacement(a, measured.value ?? guess, {width: window.innerWidth, height: window.innerHeight});
    return {left: `${at.left}px`, top: `${at.top}px`, ...(measured.value === undefined ? {visibility: 'hidden'} : {})};
  });
}
