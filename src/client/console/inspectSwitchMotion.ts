/*
 * INSPECTED-PLAYER SWITCH MOTION — the LB/RB beat of the Information
 * Workspace (Y). The left resource rail and the workspace panel are ONE
 * synchronized read of the inspected player, so a player switch moves them
 * as one composition:
 *
 *  - the workspace's identity + content zones ([data-insp-slide]) recompose
 *    with a small DIRECTIONAL bias matching the pressed bumper (RB = the
 *    next dossier arrives from the right, LB from the left) — a bias, never
 *    a carousel slide;
 *  - the rail ([data-insp-fade]) answers with a soft value dip — it is the
 *    ANCHOR of the mode and never translates; its numbers cross under the
 *    dip while the accent ring recolors via CSS.
 *
 * Rapid LB/RB presses COALESCE to the last selection: the reactive state
 * updates instantly per press, and each call kills the live tweens on the
 * same targets before starting over from the current values — no stacking,
 * no intermediate-player frames, no drift. Transform/opacity only (perf-lite
 * safe); reduced motion snaps (the state switch itself is the signal).
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';

/** Directional recompose of the workspace zones (1080-logical ms). */
const SLIDE_MS = 210;
/** The rail's value dip — slightly shorter, so the anchor settles first. */
const DIP_MS = 180;

function targets(selector: string): Array<HTMLElement> {
  if (typeof document === 'undefined') {
    return [];
  }
  return [...document.querySelectorAll<HTMLElement>(selector)];
}

function clearLive(els: Array<HTMLElement>): void {
  if (els.length > 0) {
    gsap.killTweensOf(els);
    gsap.set(els, {clearProps: 'transform,opacity'});
  }
}

/**
 * Play the player-switch beat. `dir` is the pressed bumper's direction:
 * +1 = RB (next player), −1 = LB (previous player).
 */
export function playInspectedSwitchMotion(dir: 1 | -1): void {
  const slides = targets('[data-insp-slide]');
  const fades = targets('[data-insp-fade]');
  if (slides.length === 0 && fades.length === 0) {
    return;
  }
  if (consoleReducedMotionActive()) {
    // The reactive swap already happened — just drop any live leftovers.
    clearLive(slides);
    clearLive(fades);
    return;
  }
  const u = conUiScale();
  if (slides.length > 0) {
    gsap.killTweensOf(slides);
    gsap.fromTo(slides,
      {x: dir * 14 * u, opacity: 0.25},
      {x: 0, opacity: 1, duration: motionMs(SLIDE_MS) / 1000, ease: 'power3.out', overwrite: 'auto', clearProps: 'transform,opacity'});
  }
  if (fades.length > 0) {
    gsap.killTweensOf(fades);
    gsap.fromTo(fades,
      {opacity: 0.45},
      {opacity: 1, duration: motionMs(DIP_MS) / 1000, ease: 'power2.out', overwrite: 'auto', clearProps: 'opacity'});
  }
}

/**
 * The CLOSE settle: the rail atomically returned to the viewer's own seat
 * while the workspace departs — a single soft dip acknowledges the rail's
 * context coming home. No translation (the rail never moves).
 */
export function playInspectedReturnMotion(): void {
  const fades = targets('[data-insp-fade]');
  if (fades.length === 0) {
    return;
  }
  if (consoleReducedMotionActive()) {
    clearLive(fades);
    return;
  }
  gsap.killTweensOf(fades);
  gsap.fromTo(fades,
    {opacity: 0.55},
    {opacity: 1, duration: motionMs(DIP_MS) / 1000, ease: 'power2.out', overwrite: 'auto', clearProps: 'opacity'});
}
