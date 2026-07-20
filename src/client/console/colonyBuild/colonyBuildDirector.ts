/*
 * colonyBuildDirector — the GSAP hands of the console colony-build hero scene.
 * Owns ONLY the DOM/tween work on the fixed stage (ConsoleColonyBuildLayer):
 * the cube's fly-in to the WAITING pose above the slot, its final descent into
 * the slot centre (the bonus has already left), and the instant, seamless
 * handoff onto the real committed cube. No game state, no Vue.
 *
 * THE CUBE IS ONE PHYSICAL OBJECT: it is placed at its FINAL size + style
 * (never scaled), only translated in Y. There is NO touchdown scale / bounce /
 * pulse — the landing is read from the slot's own occupied ring. The proxy is
 * pixel-identical to the static `.con-coltile__cube--filled` (the layer sizes
 * both from the same slot rect), so removing it at the handoff is invisible.
 *
 * Physics discipline: transform/opacity only; the layer owns absolute
 * positioning + the cube's material style, the director only TRANSFORMS in Y;
 * every entry point resolves (guarded budgets) and `killColonyBuildTweens`
 * reverts everything.
 */

import {gsap} from 'gsap';
import {BuildRect, CUBE_WAIT_LIFT_FACTOR, CUBE_APPROACH_EXTRA_FACTOR} from '@/client/console/colonyBuild/colonyBuildModel';

export type ColonyBuildStageEls = {
  /** The cube proxy (a pixel-twin of the real filled-cell cube). */
  cube: HTMLElement,
};

function guarded(run: (done: () => void) => void, budgetMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(safety);
        resolve();
      }
    };
    const safety = window.setTimeout(done, budgetMs + 1200);
    run(done);
  });
}

/** The waiting height (px) above the slot the cube hovers at while the bonus leaves. */
export function waitLiftPx(slot: BuildRect): number {
  return Math.max(20, slot.h * CUBE_WAIT_LIFT_FACTOR);
}

/**
 * Pose the cube proxy ABOVE its slot, higher still than the waiting pose (so it
 * FLIES IN to waiting), at FINAL size (scale 1 — never changed), invisible
 * until the approach's first frame. The layer has already sized + styled it as
 * a pixel-twin of the final static cube; the director only lifts it in Y.
 */
export function placeCubeProxy(els: ColonyBuildStageEls, opts: {slot: BuildRect}): boolean {
  if (opts.slot.w < 4 || opts.slot.h < 4) {
    return false;
  }
  const lift = waitLiftPx(opts.slot);
  gsap.set(els.cube, {
    y: -(lift + opts.slot.h * CUBE_APPROACH_EXTRA_FACTOR),
    scale: 1,
    autoAlpha: 0,
    transformOrigin: 'center center',
  });
  return true;
}

/**
 * The FLY-IN: the cube materializes already moving and glides down to the
 * WAITING pose just above the slot (never a pop-in). Resolves at the waiting
 * pose. Scale is untouched (final size throughout).
 */
export function playCubeApproach(els: ColonyBuildStageEls, opts: {slot: BuildRect, ms: number}): Promise<void> {
  const lift = waitLiftPx(opts.slot);
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    tl.to(els.cube, {autoAlpha: 1, duration: Math.min(0.14, opts.ms / 2000), ease: 'power1.out'}, 0);
    tl.to(els.cube, {y: -lift, duration: opts.ms / 1000, ease: 'power2.out'}, 0);
  }, opts.ms + 300);
}

/**
 * The FINAL DESCENT: the bonus has left the slot, so the cube settles from the
 * waiting pose straight down into the slot centre and stops. Decelerates to
 * rest — NO scale, NO bounce, NO overshoot; it ends EXACTLY at y:0 (the static
 * cube's position). Resolves at rest.
 */
export function playCubeDescent(els: ColonyBuildStageEls, opts: {ms: number}): Promise<void> {
  return guarded((done) => {
    gsap.timeline({onComplete: done})
      .to(els.cube, {y: 0, duration: opts.ms / 1000, ease: 'power2.out'}, 0);
  }, opts.ms + 300);
}

/**
 * The seamless handoff: the real filled-cell cube is already painted underneath
 * with IDENTICAL geometry + style, so the proxy is removed in ONE frame (no
 * opacity ramp / crossfade blur that would read as a change). Instant by design.
 */
export function disposeCubeProxy(els: ColonyBuildStageEls): void {
  gsap.set(els.cube, {autoAlpha: 0});
}

/** Abort/unmount: kill every tween on the stage (idempotent). */
export function killColonyBuildTweens(els: ColonyBuildStageEls): void {
  gsap.killTweensOf(els.cube);
}
