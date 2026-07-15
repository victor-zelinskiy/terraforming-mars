/*
 * playedHeroDirector — the GSAP hands of the played-card hero scene.
 *
 * Owns ONLY the DOM/tween work on the proxy stage (ConsolePlayedHeroLayer):
 * placement over the source, the lift beat, the hero arc (position + scale +
 * roll + the event flip + shade + one restrained frame sweep, all driven by
 * ONE linear progress tween mapped through the model's speed profile), the
 * landing settle, the dissolve, and the kill switch. No game state, no Vue.
 *
 * Physics discipline (the project flight rules): transform/opacity only, all
 * rects measured BEFORE the timeline, one gsap.set per frame on two elements,
 * `will-change` scoped to the proxy's own CSS class, every entry point
 * resolves (guarded budgets) and `killHeroTweens` reverts everything.
 */

import {gsap} from 'gsap';
import {
  HeroRect, HeroPathPlan, heroPoint, heroProgressAt, heroScaleAt, heroTiltAt, heroFlipAt,
  HERO_LIFT_SCALE, HERO_SETTLE_PX,
} from '@/client/console/played/playedHeroModel';

export type HeroStageEls = {
  proxy: HTMLElement,
  flip: HTMLElement | undefined,
  shade: HTMLElement | undefined,
  sweep: HTMLElement | undefined,
};

/** Natural design width of the premium card face (`.pcard`). */
const CARD_NATURAL_W = 320;

type ProxyGeometry = {
  /** gsap scale at flight start = the source box scale (typography true). */
  baseScale: number,
  /** Natural (unscaled) proxy height derived from the REAL source rect. */
  naturalH: number,
};

let geometry: ProxyGeometry | undefined;

/**
 * Position the proxy pixel-perfect over the captured source rect (natural
 * width, outer scale, top-left origin — the shared proxy discipline). MUST
 * run in the same synchronous turn as blanking the source. Returns false on
 * a degenerate rect (caller degrades to the no-flight path).
 */
export function placeHeroProxy(els: HeroStageEls, rect: HeroRect): boolean {
  if (rect.w < 10 || rect.h < 10) {
    return false;
  }
  const baseScale = rect.w / CARD_NATURAL_W;
  geometry = {baseScale, naturalH: rect.h / baseScale};
  // CENTER origin: the roll pivots around the card's middle (a corner pivot
  // reads as a swing, not a banking card), and the position math collapses
  // to "translate the natural box so its centre sits at the path point" —
  // scale-independent.
  gsap.set(els.proxy, {
    width: CARD_NATURAL_W,
    height: geometry.naturalH,
    x: rect.x + rect.w / 2 - CARD_NATURAL_W / 2,
    y: rect.y + rect.h / 2 - geometry.naturalH / 2,
    scale: baseScale,
    rotation: 0,
    transformOrigin: 'center center',
    autoAlpha: 1,
  });
  if (els.flip !== undefined) {
    gsap.set(els.flip, {rotationY: 0});
  }
  if (els.shade !== undefined) {
    gsap.set(els.shade, {autoAlpha: 0, scaleX: 1});
  }
  if (els.sweep !== undefined) {
    gsap.set(els.sweep, {autoAlpha: 0, backgroundPosition: '130% 0'});
  }
  return true;
}

/** Bounded-promise wrapper (the guarded() discipline of cardExitDirector). */
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

/**
 * Phase A — the lift-off: the card separates from the composer. A soft rise,
 * the ~1.05 scale, the contact shadow turning airborne. Physical, never
 * springy (power2.out, no overshoot).
 */
export function playHeroLift(els: HeroStageEls, durationMs: number): Promise<void> {
  const g = geometry;
  if (g === undefined) {
    return Promise.resolve();
  }
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    tl.to(els.proxy, {
      y: `-=${Math.round(10 * g.baseScale) + 4}`,
      scale: g.baseScale * HERO_LIFT_SCALE,
      duration: durationMs / 1000,
      ease: 'power2.out',
    }, 0);
    if (els.shade !== undefined) {
      tl.to(els.shade, {autoAlpha: 0.5, scaleX: 1.06, duration: durationMs / 1000, ease: 'power2.out'}, 0);
    }
  }, durationMs);
}

export type HeroFlightOpts = {
  isEvent: boolean,
  durationMs: number,
  uiScale: number,
};

/**
 * Phase C/D — the hero arc + landing. ONE linear tween drives a progress
 * value; the model's speed profile (brisk approach → cinematic apex glide →
 * decisive exit → calm final 20%) maps it to path progress, and position,
 * scale, roll, the event flip, the shade and the one frame sweep are all
 * derived per frame from that single value — the whole card behaves as one
 * physical object on one curve. Ends with a microscopic damped settle.
 */
export function playHeroFlight(els: HeroStageEls, plan: HeroPathPlan, opts: HeroFlightOpts): Promise<void> {
  const g = geometry;
  if (g === undefined) {
    return Promise.resolve();
  }
  const flightSec = (opts.durationMs / 1000) * 0.92;
  const settlePx = Math.max(2, Math.round(HERO_SETTLE_PX * opts.uiScale));
  let sweepFired = false;
  return guarded((done) => {
    const prog = {q: 0};
    const tl = gsap.timeline({onComplete: done});
    tl.to(prog, {
      q: 1,
      duration: flightSec,
      ease: 'none',
      onUpdate: () => {
        const p = heroProgressAt(prog.q);
        const sc = g.baseScale * heroScaleAt(p, plan);
        const at = heroPoint(plan, p);
        gsap.set(els.proxy, {
          x: at.x - CARD_NATURAL_W / 2,
          y: at.y - g.naturalH / 2,
          scale: sc,
          rotation: heroTiltAt(p, plan.peakTilt),
        });
        if (opts.isEvent && els.flip !== undefined) {
          gsap.set(els.flip, {rotationY: heroFlipAt(p)});
        }
        if (els.shade !== undefined) {
          // Airborne belly: widest + softest at the apex, contact at both ends.
          const airborne = Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
          gsap.set(els.shade, {autoAlpha: 0.5 - 0.22 * airborne, scaleX: 1 + 0.14 * airborne});
        }
        // ONE restrained light sweep over the frame, fired at the apex
        // (a background-position glide inside the sweep's own clip box —
        // nothing translates outside the card silhouette).
        if (!sweepFired && p >= 0.44 && els.sweep !== undefined) {
          sweepFired = true;
          gsap.timeline()
            .set(els.sweep, {backgroundPosition: '130% 0'})
            .to(els.sweep, {autoAlpha: 0.32, duration: 0.09, ease: 'power1.in'})
            .to(els.sweep, {backgroundPosition: '-30% 0', duration: 0.36, ease: 'power2.inOut'}, '<')
            .to(els.sweep, {autoAlpha: 0, duration: 0.13, ease: 'power1.out'}, '-=0.14');
        }
      },
    }, 0);
    // The settle: 2–4 px of damped weight — felt, not seen.
    tl.to(els.proxy, {y: `+=${settlePx}`, duration: 0.09, ease: 'power1.out'});
    tl.to(els.proxy, {y: `-=${settlePx}`, duration: 0.14, ease: 'power2.out'});
    if (els.shade !== undefined) {
      tl.to(els.shade, {autoAlpha: 0.55, scaleX: 1, duration: 0.16, ease: 'power1.out'}, '<');
    }
  }, opts.durationMs + 400);
}

/**
 * Reduced motion: one short controlled transition straight to the target —
 * no arc, no roll, an event crossfades to its back at the midpoint (no 3D).
 * Same commit semantics as the full scene.
 */
export function playHeroReducedHop(els: HeroStageEls, target: HeroRect, durationMs: number): Promise<void> {
  const g = geometry;
  if (g === undefined) {
    return Promise.resolve();
  }
  const scale = target.w / CARD_NATURAL_W;
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    tl.to(els.proxy, {
      x: target.x + target.w / 2 - CARD_NATURAL_W / 2,
      y: target.y + target.h / 2 - g.naturalH / 2,
      scale,
      rotation: 0,
      duration: durationMs / 1000,
      ease: 'power2.inOut',
    }, 0);
    if (els.flip !== undefined) {
      // The gentle non-3D turn: the back fades over the face mid-hop.
      tl.set(els.flip, {rotationY: 180}, durationMs / 2000);
    }
  }, durationMs);
}

/** The frame-perfect handoff: the real slot is already painted underneath
 *  with identical geometry — a short dissolve hides sub-pixel rounding. */
export function disposeHeroProxy(els: HeroStageEls, durationMs: number): Promise<void> {
  return guarded((done) => {
    gsap.to(els.proxy, {autoAlpha: 0, duration: durationMs / 1000, ease: 'power1.out', onComplete: done});
  }, durationMs);
}

/** Abort/unmount: kill every tween on the stage (idempotent). */
export function killHeroTweens(els: HeroStageEls): void {
  gsap.killTweensOf(els.proxy);
  if (els.flip !== undefined) {
    gsap.killTweensOf(els.flip);
  }
  if (els.shade !== undefined) {
    gsap.killTweensOf(els.shade);
  }
  if (els.sweep !== undefined) {
    gsap.killTweensOf(els.sweep);
  }
}
