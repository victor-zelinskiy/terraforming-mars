/*
 * colonyBuildDirector — the GSAP hands of the console colony-build hero scene.
 * Owns ONLY the DOM/tween work on the fixed stage (ConsoleColonyBuildLayer):
 * the cube proxy's drop into the slot (fall → contact → damped settle), the
 * benefit-glyph displacement rise + hover, the handoff dissolve as the chip
 * wave takes over, and the frame-perfect crossfade onto the real filled-cell
 * cube. No game state, no Vue.
 *
 * Physics discipline (the project flight rules): transform/opacity only; the
 * layer owns absolute positioning (from the captured rects), the director only
 * TRANSFORMS relative to it; every entry point resolves (guarded budgets) and
 * `killColonyBuildTweens` reverts everything.
 */

import {gsap} from 'gsap';
import {BuildRect} from '@/client/console/colonyBuild/colonyBuildModel';

export type ColonyBuildStageEls = {
  /** The dropping cube proxy (a twin of the real filled-cell cube). */
  cube: HTMLElement,
  /** The benefit-glyph proxy (a resource bonus only — undefined otherwise). */
  glyph: HTMLElement | undefined,
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

/** The height (px) the cube is held above its slot before the drop. */
function dropHeightPx(slot: BuildRect): number {
  return Math.max(28, slot.h * 1.9);
}

/**
 * Pose the cube proxy held ABOVE its slot (the layer already sized + placed it
 * at the slot rect via CSS; the director only lifts it up + scales it a touch
 * larger, invisible until the drop's first frame). Returns false on degenerate
 * geometry (caller degrades to no-drop).
 */
export function placeCubeProxy(els: ColonyBuildStageEls, opts: {slot: BuildRect}): boolean {
  if (opts.slot.w < 4 || opts.slot.h < 4) {
    return false;
  }
  gsap.set(els.cube, {
    y: -dropHeightPx(opts.slot),
    scale: 1.18,
    autoAlpha: 0,
    transformOrigin: 'center center',
  });
  return true;
}

export type CubeDropOpts = {
  slot: BuildRect,
  uiScale: number,
  dropMs: number,
  settleMs: number,
};

/**
 * The DROP + TOUCHDOWN: the cube materializes already falling (never a
 * pop-in), accelerates down into the slot, seats at scale 1, and ends on a
 * microscopic damped settle. Resolves at rest.
 */
export function playCubeDrop(els: ColonyBuildStageEls, opts: CubeDropOpts): Promise<void> {
  const settlePx = Math.max(1.5, Math.round(2 * opts.uiScale));
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    // The pick-up: the cube materializes already moving — never a pop-in.
    tl.to(els.cube, {autoAlpha: 1, duration: Math.min(0.12, opts.dropMs / 3000), ease: 'power1.out'}, 0);
    // The fall: accelerate under gravity into the slot, easing to the board scale.
    tl.to(els.cube, {
      y: 0,
      scale: 1,
      duration: opts.dropMs / 1000,
      ease: 'power2.in',
    }, 0);
    // The settle: microscopic damped weight — felt, not seen.
    const touchAt = opts.dropMs / 1000;
    tl.to(els.cube, {y: `+=${settlePx}`, duration: 0.06, ease: 'power1.out'}, touchAt);
    tl.to(els.cube, {y: `-=${settlePx}`, duration: Math.max(0.09, opts.settleMs / 1000 - 0.06), ease: 'power2.out'}, touchAt + 0.06);
  }, opts.dropMs + opts.settleMs + 400);
}

export type GlyphPreLiftOpts = {
  /** When the rise starts (ms into the drop — the cube is descending). */
  delayMs: number,
  riseMs: number,
  hoverPx: number,
};

/**
 * The DISPLACEMENT rise (fire-and-forget, parallel to the cube drop): the
 * arriving cube pushes the benefit glyph UP — it rises off the slot with a
 * hint of carried inertia and HOVERS there while the cube seats in the vacated
 * cell. The glyph proxy paints ABOVE the cube proxy (layer order), so the
 * bonus is never covered — the cube takes its place beneath it.
 */
export function playGlyphPreLift(els: ColonyBuildStageEls, opts: GlyphPreLiftOpts): void {
  if (els.glyph === undefined) {
    return;
  }
  gsap.set(els.glyph, {autoAlpha: 1, y: 0, scale: 1, transformOrigin: 'center center'});
  gsap.timeline({delay: opts.delayMs / 1000})
    .to(els.glyph, {
      y: -opts.hoverPx,
      scale: 1.16,
      duration: opts.riseMs / 1000,
      ease: 'back.out(1.15)', // displaced with inertia — never springy
    }, 0);
}

/**
 * The HANDOFF (fire-and-forget — the framework's chip wave is the awaited
 * half): the hovering glyph dissolves the moment its chip is born at the hover
 * point — one continuous printed-glyph → physical-chip materialization.
 */
export function playGlyphHandoff(els: ColonyBuildStageEls): void {
  if (els.glyph === undefined) {
    return;
  }
  gsap.timeline({delay: 90 / 1000})
    .to(els.glyph, {autoAlpha: 0, scale: 1.05, duration: 0.16, ease: 'power1.in'}, 0);
}

/** The frame-perfect handoff: the REAL filled-cell cube is already painted
 *  underneath with identical geometry — a short dissolve hides sub-pixel
 *  rounding. durationMs 0 → an instant cut (a board follow-up / reduced). */
export function disposeCubeProxy(els: ColonyBuildStageEls, durationMs: number): Promise<void> {
  if (durationMs <= 0) {
    gsap.set(els.cube, {autoAlpha: 0});
    if (els.glyph !== undefined) {
      gsap.set(els.glyph, {autoAlpha: 0});
    }
    return Promise.resolve();
  }
  return guarded((done) => {
    gsap.timeline({onComplete: done})
      .to(els.cube, {autoAlpha: 0, duration: durationMs / 1000, ease: 'power1.out'}, 0);
  }, durationMs);
}

/** Abort/unmount: kill every tween on the stage (idempotent). */
export function killColonyBuildTweens(els: ColonyBuildStageEls): void {
  gsap.killTweensOf(els.cube);
  if (els.glyph !== undefined) {
    gsap.killTweensOf(els.glyph);
  }
}
