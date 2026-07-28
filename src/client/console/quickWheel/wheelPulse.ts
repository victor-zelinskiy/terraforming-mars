/*
 * QUICK-WHEEL PULSE — the direct-action acknowledgement (wheelHandoffModel's
 * `pulse` half). A committed wheel action that opens NO surface (heat
 * conversion) still answers the player somewhere real: the live HUD element
 * about to change (`data-wheel-anchor`) gives one short physical pulse the
 * moment the command lands. The SERVER result's own animations (value flips,
 * delta chips, the temperature-scale marker) then carry the actual change —
 * the pulse acknowledges, it never pretends.
 *
 * Transform-only (perf-lite keeps it), episode-safe (a re-pulse overwrites),
 * reduced-motion silent. Deliberately NOT a director: no timeline handles,
 * no holds, no state — fire and forget.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

/** Pulse the named anchors in order (a small stagger between them). */
export function pulseWheelAnchors(ids: ReadonlyArray<string>): void {
  if (typeof document === 'undefined' || consoleReducedMotionActive()) {
    return;
  }
  ids.forEach((id, i) => {
    const el = document.querySelector<HTMLElement>(`[data-wheel-anchor="${id}"]`);
    if (el === null) {
      return; // profile variance — the acknowledgement degrades silently
    }
    gsap.fromTo(el,
      {scale: 1},
      {
        scale: 1.12,
        duration: motionMs(90) / 1000,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
        delay: (motionMs(110) + i * motionMs(140)) / 1000,
        overwrite: 'auto',
        onComplete: () => gsap.set(el, {clearProps: 'transform'}),
      });
  });
}
