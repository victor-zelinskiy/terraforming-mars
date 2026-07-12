/*
 * ANNOTATION FOCUS BUS — the console-native traversal bridge for the
 * fullscreen rule overlay.
 *
 * The RIGHT STICK cycles focus across the visible rule blocks while the
 * fullscreen viewer is open (D-pad / left stick stay reserved for card
 * browsing). The layer registers a traversal handler when its blocks are
 * on screen; the console shell's zoom input carve-out feeds stick flicks
 * into `stepAnnotationFocus`. `annotationTraversalState.active` is
 * reactive so the zoom command bar can advertise the RS affordance only
 * when there is something to traverse.
 *
 * Module singleton by design: exactly one fullscreen annotation layer can
 * be live at a time (one CardZoomModal dialog owns the top layer).
 */

import {reactive} from 'vue';

export type AnnotationTraversal = {
  /** Move focus to the next (+1) / previous (−1) block, cycling. */
  step: (delta: 1 | -1) => void;
  /** Drop the stick focus back to the neutral resting state. */
  clear: () => void;
};

export const annotationTraversalState = reactive({active: false});

let handler: AnnotationTraversal | undefined;

export function registerAnnotationTraversal(h: AnnotationTraversal): void {
  handler = h;
  annotationTraversalState.active = true;
}

export function unregisterAnnotationTraversal(h: AnnotationTraversal): void {
  if (handler === h) {
    handler = undefined;
    annotationTraversalState.active = false;
  }
}

/** Returns false when no layer is live (the caller may repurpose the input). */
export function stepAnnotationFocus(delta: 1 | -1): boolean {
  if (handler === undefined) {
    return false;
  }
  handler.step(delta);
  return true;
}

export function clearAnnotationFocus(): void {
  handler?.clear();
}
