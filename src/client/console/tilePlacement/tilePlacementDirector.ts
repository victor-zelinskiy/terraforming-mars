/*
 * tilePlacementDirector — the GSAP hands of the console tile-placement hero
 * scene. Owns ONLY the DOM/tween work on the fixed stage
 * (ConsoleTilePlacementLayer): posing the tile proxy at the table-edge
 * supply, the carried flight into the live hex (ONE progress tween maps
 * position + the cruise-then-approach scale + the unwinding tilt + the
 * tightening ground shadow + the thickness edge through the model's
 * profiles — one physical object on one curve), the touchdown settle + the
 * quiet surface-acceptance beat, the frame-perfect dissolve onto the real
 * board tile, the printed-bonus lifts of the reward beat, and the kill
 * switch. No game state, no Vue.
 *
 * Physics discipline (the project flight rules): transform/opacity only,
 * geometry measured BEFORE a timeline starts, `will-change` scoped to the
 * stage's own classes, every entry point resolves (guarded budgets) and
 * `killTileTweens` reverts everything.
 */

import {gsap} from 'gsap';
import {
  TileRect, tileFlightPlan, tileFlightPoint, tileScaleAt, tileTiltAt, tileShadowAt,
  TILE_START_SCALE, TILE_START_TILT_DEG, TILE_SETTLE_PX, TILE_TOUCH_MS,
} from '@/client/console/tilePlacement/tilePlacementModel';
import {TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {transferWaveDelayMs} from '@/client/console/resourceTransfer/resourceTransferModel';

export type TileStageEls = {
  /** The flying tile proxy (hex art + thickness edge + touch overlay). */
  tile: HTMLElement,
  /** The thickness underlay INSIDE the proxy (contact compresses it). */
  edge: HTMLElement | undefined,
  /** The surface-acceptance overlay INSIDE the proxy (one quiet beat). */
  touch: HTMLElement | undefined,
  /** The ground shadow, parked at the target hex for the whole flight. */
  shadow: HTMLElement | undefined,
  /** The printed-bonus icon proxies (reward beat), in bonusProxies order. */
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

export type TilePoseOpts = {
  /** The live hex rect (post pan/zoom) — the landing geometry. */
  hex: TileRect,
  /** The table-edge supply point the tile departs from. */
  from: TransferPoint,
};

/**
 * Pose the proxy at the supply: sized EXACTLY to the live hex box (so
 * touchdown is a scale-1 identity with the real tile), scaled up to the
 * carried departure size, slightly tilted, invisible until the flight's
 * first frame. The ground shadow parks at the hex, wide + faint.
 * Returns false on degenerate geometry (caller degrades to no-flight).
 */
export function placeTileProxy(els: TileStageEls, opts: TilePoseOpts): boolean {
  if (opts.hex.w < 8 || opts.hex.h < 8) {
    return false;
  }
  gsap.set(els.tile, {
    width: opts.hex.w,
    height: opts.hex.h,
    x: opts.from.x - opts.hex.w / 2,
    y: opts.from.y - opts.hex.h / 2,
    scale: TILE_START_SCALE,
    rotation: TILE_START_TILT_DEG,
    transformOrigin: 'center center',
    autoAlpha: 0,
  });
  if (els.edge !== undefined) {
    gsap.set(els.edge, {y: 3}); // airborne thickness — compresses at contact
  }
  if (els.touch !== undefined) {
    gsap.set(els.touch, {autoAlpha: 0});
  }
  if (els.shadow !== undefined) {
    const sh = tileShadowAt(0);
    gsap.set(els.shadow, {
      width: opts.hex.w,
      height: opts.hex.h * 0.5,
      x: opts.hex.x,
      y: opts.hex.y + opts.hex.h * 0.42,
      scale: sh.scale,
      autoAlpha: 0, // fades in with the departure
      transformOrigin: 'center center',
    });
  }
  return true;
}

export type TileFlightOpts = {
  hex: TileRect,
  from: TransferPoint,
  uiScale: number,
  flightMs: number,
  settleMs: number,
};

/**
 * The FLIGHT + TOUCHDOWN: one progress tween drives the whole approach —
 * the tile materializes in the pick-up (a fast fade at the supply), cruises
 * large across the board, eases down into the board's scale, unwinds
 * square, and CONTACTS: the thickness edge compresses, the shadow snaps to
 * contact, a quiet brightness crosses the face (the surface accepts it),
 * and a microscopic damped settle ends the motion. Resolves at rest.
 */
export function playTileFlight(els: TileStageEls, opts: TileFlightOpts): Promise<void> {
  const plan = tileFlightPlan(opts.from, {
    x: opts.hex.x + opts.hex.w / 2,
    y: opts.hex.y + opts.hex.h / 2,
  });
  const settlePx = Math.max(2, Math.round(TILE_SETTLE_PX * opts.uiScale));
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    // The pick-up: the tile materializes already moving — never a pop-in.
    tl.to(els.tile, {autoAlpha: 1, duration: Math.min(0.14, opts.flightMs / 3000), ease: 'power1.out'}, 0);
    if (els.shadow !== undefined) {
      tl.to(els.shadow, {autoAlpha: 1, duration: 0.2, ease: 'power1.out'}, 0.05);
    }
    const prog = {q: 0};
    tl.to(prog, {
      q: 1,
      duration: opts.flightMs / 1000,
      ease: 'power2.inOut',
      onUpdate: () => {
        const p = tileFlightPoint(plan, prog.q);
        gsap.set(els.tile, {
          x: p.x - opts.hex.w / 2,
          y: p.y - opts.hex.h / 2,
          scale: tileScaleAt(prog.q),
          rotation: tileTiltAt(prog.q),
        });
        if (els.shadow !== undefined) {
          const sh = tileShadowAt(prog.q);
          gsap.set(els.shadow, {scale: sh.scale, autoAlpha: Math.min(1, prog.q * 5) * sh.alpha});
        }
      },
    }, 0);
    // CONTACT — all in one beat, inside the settle window:
    const touchAt = opts.flightMs / 1000;
    if (els.edge !== undefined) {
      // The thickness compresses: airborne 3px → seated 1px.
      tl.to(els.edge, {y: 1, duration: 0.1, ease: 'power2.out'}, touchAt);
    }
    if (els.touch !== undefined) {
      // The surface accepts it: one quiet brightness pass, never a flash.
      tl.to(els.touch, {autoAlpha: 0.22, duration: (TILE_TOUCH_MS * 0.35) / 1000, ease: 'power1.in'}, touchAt);
      tl.to(els.touch, {autoAlpha: 0, duration: (TILE_TOUCH_MS * 0.65) / 1000, ease: 'power1.out'});
    }
    // The settle: microscopic damped weight — felt, not seen.
    tl.to(els.tile, {y: `+=${settlePx}`, duration: 0.07, ease: 'power1.out'}, touchAt);
    tl.to(els.tile, {y: `-=${settlePx}`, duration: Math.max(0.09, opts.settleMs / 1000 - 0.07), ease: 'power2.out'}, touchAt + 0.07);
    if (els.shadow !== undefined) {
      tl.to(els.shadow, {autoAlpha: 0.5, duration: 0.12, ease: 'power1.out'}, touchAt);
    }
  }, opts.flightMs + opts.settleMs + 400);
}

/** The frame-perfect handoff: the REAL board tile is already painted
 *  underneath with identical geometry — a short dissolve (shadow included)
 *  hides sub-pixel rounding. */
export function disposeTileProxy(els: TileStageEls, durationMs: number): Promise<void> {
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    tl.to(els.tile, {autoAlpha: 0, duration: durationMs / 1000, ease: 'power1.out'}, 0);
    if (els.shadow !== undefined) {
      tl.to(els.shadow, {autoAlpha: 0, duration: durationMs / 1000, ease: 'power1.out'}, 0);
    }
  }, durationMs);
}

export type BonusLiftOpts = {
  count: number,
  liftPx: number,
  liftMs: number,
};

/**
 * The REWARD BEAT's materialization lifts (fire-and-forget — the shared
 * framework's chip wave is the awaited half): each printed icon rises out
 * of the placed tile from its exact captured position, gaining body
 * (scale + shadow via CSS class), on the SAME stagger its transfer chip
 * uses — the chip is then born at the lifted point the moment the lift
 * completes, and the icon dissolves under it (one continuous
 * icon → physical-chip materialization, never a swap).
 */
export function playBonusLift(els: TileStageEls, opts: BonusLiftOpts): void {
  els.bonusIcons.forEach((el, i) => {
    const delay = transferWaveDelayMs(i, opts.count);
    gsap.set(el, {autoAlpha: 0, y: 0, scale: 1, transformOrigin: 'center center'});
    gsap.timeline({delay: delay / 1000})
      .to(el, {autoAlpha: 1, duration: 0.09, ease: 'power1.out'}, 0)
      .to(el, {y: -opts.liftPx, scale: 1.25, duration: opts.liftMs / 1000, ease: 'power2.out'}, 0)
      // The chip pops here (liftMs + the framework's own fade-in) — the
      // icon hands off underneath it.
      .to(el, {autoAlpha: 0, scale: 1.05, duration: 0.16, ease: 'power1.in'}, opts.liftMs / 1000 + 0.06);
  });
}

/** Abort/unmount: kill every tween on the stage (idempotent). */
export function killTileTweens(els: TileStageEls): void {
  gsap.killTweensOf(els.tile);
  if (els.edge !== undefined) {
    gsap.killTweensOf(els.edge);
  }
  if (els.touch !== undefined) {
    gsap.killTweensOf(els.touch);
  }
  if (els.shadow !== undefined) {
    gsap.killTweensOf(els.shadow);
  }
  els.bonusIcons.forEach((el) => gsap.killTweensOf(el));
}
