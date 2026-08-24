/*
 * nomadMoveDirector — the GSAP hands of the console Mars Nomads MOVE scene.
 * Owns ONLY the DOM/tween work on the fixed stage (ConsoleNomadMoveLayer):
 * posing the module proxy pixel-exact over the resting board token, the
 * LIFT-OFF (the module rises while its contact shadow stays on the SOURCE
 * surface and weakens), the carried hop arc with the lean into the travel
 * direction, the DESTINATION shadow converging through the approach, the
 * touchdown micro-compression + settle, the frame-perfect dissolve onto the
 * committed board token, and the kill switch. No game state, no Vue.
 *
 * The destination's printed-bonus displacement rides the SHARED bonus
 * functions of tilePlacementDirector (placeBonusProxies / playBonusPreLift /
 * playBonusHandoff) — one physical rule for "something arrives on a bonus
 * cell", never a copy.
 *
 * Physics discipline: transform/opacity only, geometry measured BEFORE a
 * timeline starts, every entry point resolves (guarded budgets), and
 * `killNomadTweens` reverts everything.
 */

import {gsap} from 'gsap';
import {TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  NomadFlightPlan, nomadFlightPlan, nomadFlightPoint, nomadScaleAt, nomadTiltAt,
  nomadDstShadowAt, nomadSrcShadowAt,
  NOMAD_LIFT_RISE_PX, NOMAD_LIFT_SCALE, NOMAD_SETTLE_PX,
} from '@/client/console/nomads/nomadMoveModel';

export type NomadStageEls = {
  /** The flying module proxy (a real NomadToken at flight size). */
  token: HTMLElement,
  /** The SOURCE contact shadow — stays on the surface through the lift. */
  srcShadow: HTMLElement | undefined,
  /** The DESTINATION ground shadow — parked at the target anchor. */
  dstShadow: HTMLElement | undefined,
  /** The displaced printed-bonus icon proxies, in bonusProxies order. */
  bonusIcons: ReadonlyArray<HTMLElement>,
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

export type NomadPoseOpts = {
  /** The resting token's CENTRE on the source cell (viewport space). */
  from: TransferPoint,
  /** The resting token's CENTRE on the destination cell. */
  to: TransferPoint,
  /** The resting token's footprint (px) — the proxy is sized to it, so the
   *  touchdown is a scale-1 identity with the real board token. */
  sizePx: number,
  uiScale: number,
};

/**
 * Pose the proxy pixel-exact over the RESTING source token (the caller
 * hides the real one in this same synchronous turn — the swap discipline;
 * the takeover is 1:1, never a double vision). The source shadow sits at
 * contact under it; the destination shadow parks at the target anchor,
 * invisible until the approach. Returns false on degenerate geometry.
 */
export function placeNomadProxy(els: NomadStageEls, opts: NomadPoseOpts): boolean {
  if (opts.sizePx < 6) {
    return false;
  }
  gsap.set(els.token, {
    width: opts.sizePx,
    height: opts.sizePx,
    x: opts.from.x - opts.sizePx / 2,
    y: opts.from.y - opts.sizePx / 2,
    scale: 1,
    rotation: 0,
    transformOrigin: 'center center',
    autoAlpha: 1,
  });
  const shW = opts.sizePx * 1.1;
  const shH = opts.sizePx * 0.34;
  if (els.srcShadow !== undefined) {
    gsap.set(els.srcShadow, {
      width: shW,
      height: shH,
      x: opts.from.x - shW / 2,
      y: opts.from.y + opts.sizePx * 0.36,
      scale: 1,
      autoAlpha: 0.9,
      transformOrigin: 'center center',
    });
  }
  if (els.dstShadow !== undefined) {
    gsap.set(els.dstShadow, {
      width: shW,
      height: shH,
      x: opts.to.x - shW / 2,
      y: opts.to.y + opts.sizePx * 0.36,
      scale: 1.5,
      autoAlpha: 0,
      transformOrigin: 'center center',
    });
  }
  return true;
}

export type NomadFlightOpts = NomadPoseOpts & {
  liftMs: number,
  flightMs: number,
  settleMs: number,
};

/**
 * LIFT-OFF → HOP → TOUCHDOWN, one timeline:
 *  - the module separates from the surface (rises + grows toward the lift
 *    pose) while the SOURCE contact shadow stays down and weakens — height
 *    is told by the separation, not by the object fading;
 *  - the hop: one progress tween maps position along the tall carried arc,
 *    the cruise scale crest, the lean into the travel direction and the
 *    DESTINATION shadow's convergence — one physical object on one curve;
 *  - contact: micro-compression (the module presses into the surface), the
 *    destination shadow spreads with the weight, a microscopic damped
 *    settle ends the motion. Resolves at rest.
 */
export function playNomadFlight(els: NomadStageEls, opts: NomadFlightOpts): Promise<void> {
  const rise = Math.max(6, Math.round(NOMAD_LIFT_RISE_PX * opts.uiScale));
  const liftedFrom: TransferPoint = {x: opts.from.x, y: opts.from.y - rise};
  const plan: NomadFlightPlan = nomadFlightPlan(liftedFrom, opts.to);
  const settlePx = Math.max(1.5, Math.round(NOMAD_SETTLE_PX * opts.uiScale));
  const liftS = opts.liftMs / 1000;
  const flightS = opts.flightMs / 1000;
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    // THE LIFT: separation from the surface. The token rises out of its
    // resting pose; the source shadow stays parked at contact and lets go.
    tl.to(els.token, {
      x: liftedFrom.x - opts.sizePx / 2,
      y: liftedFrom.y - opts.sizePx / 2,
      scale: NOMAD_LIFT_SCALE,
      duration: liftS,
      ease: 'power2.out',
    }, 0);
    if (els.srcShadow !== undefined) {
      const srcProg = {q: 0};
      tl.to(srcProg, {
        q: 1,
        duration: liftS,
        ease: 'power1.out',
        onUpdate: () => {
          const sh = nomadSrcShadowAt(srcProg.q);
          gsap.set(els.srcShadow as HTMLElement, {scale: sh.scale, autoAlpha: sh.alpha});
        },
      }, 0);
    }
    // THE HOP: one progress tween over the arc.
    const prog = {q: 0};
    tl.to(prog, {
      q: 1,
      duration: flightS,
      ease: 'power2.inOut',
      onUpdate: () => {
        const p = nomadFlightPoint(plan, prog.q);
        gsap.set(els.token, {
          x: p.x - opts.sizePx / 2,
          y: p.y - opts.sizePx / 2,
          scale: nomadScaleAt(prog.q),
          rotation: nomadTiltAt(prog.q, plan.dir),
        });
        if (els.dstShadow !== undefined) {
          const sh = nomadDstShadowAt(prog.q);
          gsap.set(els.dstShadow, {scale: sh.scale, autoAlpha: sh.alpha});
        }
      },
    }, liftS);
    // CONTACT: compression + spread + damped settle, inside the settle window.
    const touchAt = liftS + flightS;
    tl.to(els.token, {scaleX: 1.06, scaleY: 0.9, duration: 0.07, ease: 'power2.out'}, touchAt);
    tl.to(els.token, {scaleX: 0.99, scaleY: 1.012, duration: 0.09, ease: 'power1.inOut'}, touchAt + 0.07);
    tl.to(els.token, {scaleX: 1, scaleY: 1, duration: Math.max(0.06, opts.settleMs / 1000 - 0.16), ease: 'power2.out'}, touchAt + 0.16);
    tl.to(els.token, {y: `+=${settlePx}`, duration: 0.06, ease: 'power1.out'}, touchAt);
    tl.to(els.token, {y: `-=${settlePx}`, duration: 0.09, ease: 'power2.out'}, touchAt + 0.06);
    if (els.dstShadow !== undefined) {
      tl.to(els.dstShadow, {scale: 1.12, autoAlpha: 0.95, duration: 0.07, ease: 'power1.out'}, touchAt);
      tl.to(els.dstShadow, {scale: 1, autoAlpha: 0.9, duration: 0.12, ease: 'power1.inOut'}, touchAt + 0.07);
    }
  }, opts.liftMs + opts.flightMs + opts.settleMs + 400);
}

/** The frame-perfect handoff: the REAL board token is already painted
 *  underneath with identical geometry — a short dissolve (shadow included)
 *  hides sub-pixel rounding. */
export function disposeNomadProxy(els: NomadStageEls, durationMs: number): Promise<void> {
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    tl.to(els.token, {autoAlpha: 0, duration: durationMs / 1000, ease: 'power1.out'}, 0);
    if (els.dstShadow !== undefined) {
      tl.to(els.dstShadow, {autoAlpha: 0, duration: durationMs / 1000, ease: 'power1.out'}, 0);
    }
    if (els.srcShadow !== undefined) {
      tl.to(els.srcShadow, {autoAlpha: 0, duration: durationMs / 1000, ease: 'power1.out'}, 0);
    }
  }, durationMs);
}

/** Abort/unmount: kill every tween on the stage (idempotent). */
export function killNomadTweens(els: NomadStageEls): void {
  gsap.killTweensOf(els.token);
  if (els.srcShadow !== undefined) {
    gsap.killTweensOf(els.srcShadow);
  }
  if (els.dstShadow !== undefined) {
    gsap.killTweensOf(els.dstShadow);
  }
  els.bonusIcons.forEach((el) => gsap.killTweensOf(el));
}
