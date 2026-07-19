/*
 * useConsoleFocusFrame — measured-rect provider for a MOVING premium
 * selection frame (foundation layer; docs/CONSOLE_FOUNDATION.md §6).
 *
 * The console navigation model is STATE-driven (`--cursor` classes), never
 * DOM :focus — so a future Ark-Nova-style gliding highlight needs the
 * CURSORED element's live geometry, not focus events. This composable is
 * that geometry: point `target` at the cursored element (swap the ref as the
 * cursor moves) and render a fixed-position frame layer with `frameStyle`.
 *
 * Nothing consumes it yet by design — it exists so the upcoming Motion for
 * Vue / focus-frame task builds on a measured foundation instead of
 * inventing per-screen rect plumbing. VueUse: `useElementBounding` (reactive
 * rect: resize / scroll / mutation aware).
 */

import {computed, ComputedRef, CSSProperties, Ref} from 'vue';
import {useElementBounding} from '@vueuse/core';

export type ConsoleFocusFrame = {
  /** Live geometry of the tracked element (all reactive). */
  x: Ref<number>,
  y: Ref<number>,
  width: Ref<number>,
  height: Ref<number>,
  /** True while the target exists and has layout. */
  visible: ComputedRef<boolean>,
  /**
   * Style for a `position: fixed` frame layer — transform/size only (GPU
   * path, no layout thrash); pair with a CSS transition on transform for
   * the glide.
   */
  frameStyle: ComputedRef<CSSProperties>,
  /** Force a re-measure (after a programmatic scroll / zoom change). */
  update: () => void,
};

export function useConsoleFocusFrame(
  target: Ref<HTMLElement | null | undefined>,
  padding: number = 4,
): ConsoleFocusFrame {
  const {x, y, width, height, update} = useElementBounding(target);
  const visible = computed(() => width.value > 0 && height.value > 0);
  const frameStyle = computed<CSSProperties>(() => {
    if (!visible.value) {
      return {opacity: '0'};
    }
    return {
      opacity: '1',
      transform: `translate(${x.value - padding}px, ${y.value - padding}px)`,
      width: `${width.value + padding * 2}px`,
      height: `${height.value + padding * 2}px`,
    };
  });
  return {x, y, width, height, visible, frameStyle, update};
}
