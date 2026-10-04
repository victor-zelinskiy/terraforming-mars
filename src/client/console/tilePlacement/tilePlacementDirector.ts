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
  TileRect, TileFlightProfile, OWN_FLIGHT_PROFILE,
  tileFlightPlan, tileFlightPoint, tileScaleAt, tileTiltAt, tileShadowAt,
  TILE_SETTLE_PX, TILE_TOUCH_MS,
  TIER_CRUISE_SCALE, tierDescentScaleAt, dustMoteVector,
  MovePose, movePlan, moveLiftPose, moveCarryPose, moveLandPose, moveShadowAt,
  MOVE_VACATED_T, MOVE_SHADOW_LAG, MOVE_DESCENT_T,
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
  /* NOTE: the OCEAN pieces are deliberately NOT here. The ocean payout is a
   * SHARED beat (`adjacencyPayoutBeat.ts`) with its own stage registration,
   * because the same water pays a Mars Nomads camp that merely MOVES onto the
   * cell — a hop that has no tile proxy for this handle to describe. */
  /** The Ares source-tile wake pulses (adjacency beat), in aresSources order. */
  aresPulses: ReadonlyArray<HTMLElement>,
  /** The ocean-cover landing splash (one per stage; absent → no splash). */
  splash: HTMLElement | undefined,
  /** The DEPARTING tile proxy of a remove-and-replace placement (the twin of
   *  the doomed board tile, carrying its own thickness edge and owner cube).
   *  Absent for an ordinary landing — there is nothing to remove. */
  depart: HTMLElement | undefined,
  /** The thickness underlay INSIDE the departing proxy (release decompresses
   *  it — the exact inverse of the landing's contact squash). */
  departEdge: HTMLElement | undefined,
  /** The DUST ring of a city-tier touchdown (Skyscrapers): the motes around
   *  the hex, posed by the director at contact. Absent → no dust. */
  dust?: HTMLElement | undefined,
  /** The surface-acceptance overlay INSIDE the departing proxy — present only
   *  when that proxy is a MOVE's (it lands, so it is accepted by the surface). */
  departTouch?: HTMLElement | undefined,
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
  /** The provenance pose (own hand vs a remote player) — defaults to OWN. */
  profile?: TileFlightProfile,
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
  const profile = opts.profile ?? OWN_FLIGHT_PROFILE;
  gsap.set(els.tile, {
    width: opts.hex.w,
    height: opts.hex.h,
    x: opts.from.x - opts.hex.w / 2,
    y: opts.from.y - opts.hex.h / 2,
    scale: profile.startScale,
    rotation: profile.startTiltDeg,
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

/**
 * Pose the DEPARTING proxy exactly over the doomed board tile: same box, same
 * art, seated (scale 1, square, thickness compressed to its resting 1px). The
 * caller blanks the real cell in this same synchronous turn — the takeover is
 * 1:1, so the swap itself is invisible and the only thing the player ever sees
 * move is the proxy. Returns false on degenerate geometry.
 */
export function placeDepartProxy(els: TileStageEls, hex: TileRect): boolean {
  if (els.depart === undefined || hex.w < 8 || hex.h < 8) {
    return false;
  }
  gsap.set(els.depart, {
    width: hex.w,
    height: hex.h,
    x: hex.x,
    y: hex.y,
    scale: 1,
    rotation: 0,
    transformOrigin: 'center center',
    autoAlpha: 1,
  });
  if (els.departEdge !== undefined) {
    gsap.set(els.departEdge, {y: 1}); // seated thickness — release decompresses it
  }
  return true;
}

export type TileDepartureOpts = {
  hex: TileRect,
  /** The lift in px (proportional to the hex — the model computes it). */
  liftPx: number,
  departMs: number,
  /** Where in the lift the fade begins (0..1) — it clears the cell first. */
  fadeAt: number,
  tiltDeg: number,
  scale: number,
};

/**
 * The UNSEATING (awaited): the standing tile releases from the surface — its
 * thickness edge decompresses as the contact breaks, it rises off the plane
 * toward the camera growing slightly, tips as it clears, and dissolves on its
 * way out. Its parked ground shadow (if the stage has one) widens and fades
 * with it, so the cell is visibly EMPTY, not merely uncovered. Resolves once
 * the tile is gone — the cleared cell is then the player's to read.
 */
export function playTileDeparture(els: TileStageEls, opts: TileDepartureOpts): Promise<void> {
  const depart = els.depart;
  if (depart === undefined) {
    return Promise.resolve();
  }
  const secs = opts.departMs / 1000;
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    // The contact breaks BEFORE the tile moves — the thickness is what was
    // holding it down (the landing compresses this same edge on touchdown).
    if (els.departEdge !== undefined) {
      tl.to(els.departEdge, {y: 4, duration: secs * 0.3, ease: 'power2.out'}, 0);
    }
    tl.to(depart, {
      y: opts.hex.y - opts.liftPx,
      scale: opts.scale,
      rotation: opts.tiltDeg,
      duration: secs,
      ease: 'power2.in', // gathers speed as it leaves — carried away, not tossed
    }, 0);
    tl.to(depart, {
      autoAlpha: 0,
      duration: secs * (1 - opts.fadeAt),
      ease: 'power1.in',
    }, secs * opts.fadeAt);
    if (els.shadow !== undefined) {
      // The ground shadow the tile was casting spreads and thins as it rises.
      gsap.set(els.shadow, {
        width: opts.hex.w,
        height: opts.hex.h * 0.5,
        x: opts.hex.x,
        y: opts.hex.y + opts.hex.h * 0.42,
        scale: 0.86,
        autoAlpha: 0.5,
        transformOrigin: 'center center',
      });
      tl.to(els.shadow, {scale: 1.16, autoAlpha: 0, duration: secs * 0.86, ease: 'power1.out'}, 0);
    }
  }, opts.departMs + 400);
}

export type TileMoveOpts = {
  /** The rect the proxy is born over: the source hex — or a stack's top tier in its lifted rect. */
  source: TileRect,
  /** The live destination hex: the landing geometry AND the proxy's own box. */
  dest: TileRect,
  uiScale: number,
  liftMs: number,
  carryMs: number,
  landMs: number,
  /** The tile has cleared the source cell's contour (the carry's `MOVE_VACATED_T`) — fired once. */
  onCleared?: () => void,
};

/** The live move timeline per proxy — a move tweens a plain progress object, which `killTweensOf(element)` cannot reach. */
const moveTimelines = new WeakMap<HTMLElement, gsap.core.Timeline>();

/**
 * THE MOVE's proxy (TR14 Re-settlement — the fourth case): the DEPART twin,
 * posed 1:1 over the real tile it takes over — its box is the DESTINATION hex
 * (so the touchdown is a scale-1 identity), scaled to the source rect, seated,
 * level, fully material. The caller turns the real source cell into what the
 * server left there in this same synchronous turn — the swap is invisible.
 * The ground shadow parks under the source, still unseen: a seated tile casts
 * none. Returns false on degenerate geometry (the caller degrades).
 */
export function placeMoveProxy(els: TileStageEls, source: TileRect, dest: TileRect): boolean {
  if (els.depart === undefined || source.w < 8 || source.h < 8 || dest.w < 8 || dest.h < 8) {
    return false;
  }
  const plan = movePlan(source, dest);
  gsap.set(els.depart, {
    width: dest.w,
    height: dest.h,
    x: plan.from.x - dest.w / 2,
    y: plan.from.y - dest.h / 2,
    scale: plan.sourceScale,
    rotation: 0,
    transformOrigin: 'center center',
    autoAlpha: 1,
  });
  if (els.departEdge !== undefined) {
    gsap.set(els.departEdge, {y: 1}); // seated thickness — the lift decompresses it
  }
  if (els.departTouch !== undefined) {
    gsap.set(els.departTouch, {autoAlpha: 0});
  }
  if (els.shadow !== undefined) {
    gsap.set(els.shadow, {
      width: dest.w,
      height: dest.h * 0.5,
      x: plan.from.x - dest.w / 2,
      y: plan.from.y - dest.h / 2 + dest.h * 0.42,
      scale: moveShadowAt(0).scale * plan.sourceScale,
      autoAlpha: 0,
      transformOrigin: 'center center',
    });
  }
  return true;
}

/**
 * THE MOVE (awaited): ONE object, three beats, never tilted and never faded.
 *   LIFT    — straight up off the source: the thickness decompresses as the
 *             contact breaks, the scale grows to the carried size, the ground
 *             shadow separates and softens;
 *   CARRY   — one low arc across the shared edge, in-out; the shadow travels
 *             on the ground a touch behind the tile; `onCleared` fires once
 *             the tile has left the source's contour;
 *   LANDING — lowered into the board's scale, the shadow tightening to
 *             contact, then the landing's own contact: the thickness
 *             compresses, one quiet brightness pass, a microscopic damped
 *             settle — no bounce.
 * Resolves at rest, on completion AND on interruption; the caller paints the
 * real tile under the settled proxy and removes the proxy the frame after.
 */
export function playTileMove(els: TileStageEls, opts: TileMoveOpts): Promise<void> {
  const proxy = els.depart;
  if (proxy === undefined) {
    return Promise.resolve();
  }
  const plan = movePlan(opts.source, opts.dest);
  const w = opts.dest.w;
  const h = opts.dest.h;
  const lift = opts.liftMs / 1000;
  const carry = opts.carryMs / 1000;
  const land = opts.landMs / 1000;
  const descent = land * MOVE_DESCENT_T;
  const contact = Math.max(0.04, land - descent);
  const touchAt = lift + carry + descent;
  const total = touchAt + contact;
  const settlePx = Math.max(1.5, Math.round(TILE_SETTLE_PX * 0.6 * opts.uiScale));
  const easeOut = gsap.parseEase('power2.out');
  const easeInOut = gsap.parseEase('power2.inOut');
  const easeIn = gsap.parseEase('power2.in');
  let cleared = false;
  const clear = () => {
    if (!cleared) {
      cleared = true;
      opts.onCleared?.();
    }
  };
  // The shadow lies ON THE GROUND: under the tile's foot, never lifted with it.
  const ground = (x: number, y: number, scale: number, alpha: number) => {
    if (els.shadow !== undefined) {
      gsap.set(els.shadow, {x: x - w / 2, y: y - h / 2 + h * 0.42, scale, autoAlpha: alpha});
    }
  };
  /*
   * THE WHOLE MOVE AS A FUNCTION OF ITS OWN CLOCK — one writer for the proxy's
   * pose. Three chained tweens (one per beat, plus relative settle tweens on
   * the element) were MEASURED to leave the tile hanging at the carry's last
   * pose on a slow renderer (the 4K profile, a handful of frames per scene):
   * the proxy rested one lift above the hex and the real tile then appeared a
   * whole lift below it. A pose computed from the clock cannot skip or reorder
   * a beat however long a frame is, and the resting pose is WRITTEN at the end
   * — never inferred from the last tick.
   */
  const render = (t: number) => {
    let p: MovePose;
    if (t < lift) {
      const q = easeOut(t / lift);
      p = moveLiftPose(plan, q);
      const sh = moveShadowAt(q);
      ground(plan.from.x, plan.from.y, sh.scale * plan.sourceScale, sh.alpha * q);
    } else if (t < lift + carry) {
      const q = easeInOut((t - lift) / carry);
      p = moveCarryPose(plan, q);
      // The shadow follows on the ground with a lag that vanishes at both ends.
      const qs = q - MOVE_SHADOW_LAG * 4 * q * (1 - q);
      const sh = moveShadowAt(1);
      ground(
        plan.from.x + (plan.to.x - plan.from.x) * qs,
        plan.from.y + (plan.to.y - plan.from.y) * qs,
        sh.scale * (plan.sourceScale + (1 - plan.sourceScale) * q),
        sh.alpha);
      if (q >= MOVE_VACATED_T) {
        clear();
      }
    } else if (t < touchAt) {
      clear();
      const q = easeIn((t - lift - carry) / descent);
      p = moveLandPose(plan, q);
      const sh = moveShadowAt(1 - q);
      ground(plan.to.x, plan.to.y, sh.scale, sh.alpha);
    } else {
      clear();
      // The settle: the mass is felt once — down and back, damped, never a bounce.
      const s = Math.min(1, (t - touchAt) / contact);
      const bump = s < 0.4 ? easeOut(s / 0.4) : 1 - easeOut((s - 0.4) / 0.6);
      p = moveLandPose(plan, 1);
      p.y += settlePx * bump;
      const sh = moveShadowAt(0);
      ground(plan.to.x, plan.to.y, sh.scale, sh.alpha);
    }
    gsap.set(proxy, {x: p.x - w / 2, y: p.y - h / 2, scale: p.scale, rotation: 0});
  };
  return guarded((done) => {
    const clock = {t: 0};
    const tl = gsap.timeline({
      onComplete: () => {
        render(total); // AT REST, exactly on the destination hex
        done();
      },
      onInterrupt: done,
    });
    moveTimelines.set(proxy, tl);
    tl.to(clock, {t: total, duration: total, ease: 'none', onUpdate: () => render(clock.t)}, 0);
    // The thickness: the contact breaks first (it is what was holding the tile down) and compresses again at the touch.
    if (els.departEdge !== undefined) {
      tl.to(els.departEdge, {y: 3, duration: lift * 0.6, ease: 'power2.out'}, 0);
      tl.to(els.departEdge, {y: 1, duration: Math.min(0.09, contact), ease: 'power2.out'}, touchAt);
    }
    // The surface accepts it: one quiet brightness pass inside the contact window.
    if (els.departTouch !== undefined) {
      tl.to(els.departTouch, {autoAlpha: 0.22, duration: contact * 0.35, ease: 'power1.in'}, touchAt);
      tl.to(els.departTouch, {autoAlpha: 0, duration: contact * 0.65, ease: 'power1.out'}, touchAt + contact * 0.35);
    }
  }, opts.liftMs + opts.carryMs + opts.landMs + 400);
}

/**
 * THE MOVE's handoff: the real tile is already painted underneath with the
 * identical geometry, so the proxy simply GOES — no dissolve (two identical
 * copies cannot crossfade into anything but a ghost); the ground shadow, which
 * the real board does not draw, thins out on its own.
 */
export function removeMoveProxy(els: TileStageEls): void {
  if (els.depart !== undefined) {
    moveTimelines.get(els.depart)?.kill();
    moveTimelines.delete(els.depart);
    gsap.set(els.depart, {autoAlpha: 0});
  }
  if (els.shadow !== undefined) {
    gsap.to(els.shadow, {autoAlpha: 0, duration: 0.11, ease: 'power1.out'});
  }
}

export type TileFlightOpts = {
  hex: TileRect,
  from: TransferPoint,
  uiScale: number,
  flightMs: number,
  settleMs: number,
  /** The provenance pose (own hand vs a remote player) — defaults to OWN. */
  profile?: TileFlightProfile,
  /**
   * Re-read the LIVE landing hex at the final approach (boardSpaceGeometry,
   * mechanism D): the aim above was a one-shot measure, and the board's
   * coordinate space can move under a ~1 s flight (Planet Focus enter/exit,
   * a fit recalibration). Read once as the flight crosses
   * {@link TILE_RETARGET_AT}; the remaining leg blends position AND size
   * onto the live rect (smoothstep — no visible kink). `undefined` from the
   * reader (board hidden) keeps the planned aim — the caller's post-flight
   * verify owns that degrade.
   */
  liveHex?: () => TileRect | undefined,
};

/** Where the final-approach re-read happens — the hand-dock family's proven
 *  retarget point (final-approach-retarget). */
export const TILE_RETARGET_AT = 0.72;

/**
 * The FLIGHT + TOUCHDOWN: one progress tween drives the whole approach —
 * the tile materializes in the pick-up (a fast fade at the supply), cruises
 * large across the board, eases down into the board's scale, unwinds
 * square, and CONTACTS: the thickness edge compresses, the shadow snaps to
 * contact, a quiet brightness crosses the face (the surface accepts it),
 * and a microscopic damped settle ends the motion. Resolves at rest.
 */
export function playTileFlight(els: TileStageEls, opts: TileFlightOpts): Promise<void> {
  const profile = opts.profile ?? OWN_FLIGHT_PROFILE;
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
    // The final-approach correction (see `liveHex`): measured once at the
    // retarget point, blended over the remaining leg. `corrMeasured` keeps
    // the read one-shot even when the board answers undefined.
    let corr: {dx: number, dy: number, dw: number, dh: number} | undefined;
    let corrMeasured = false;
    tl.to(prog, {
      q: 1,
      duration: opts.flightMs / 1000,
      ease: 'power2.inOut',
      onUpdate: () => {
        const p = tileFlightPoint(plan, prog.q);
        let cx = p.x;
        let cy = p.y;
        let w = opts.hex.w;
        let h = opts.hex.h;
        if (opts.liveHex !== undefined && prog.q >= TILE_RETARGET_AT) {
          if (!corrMeasured) {
            corrMeasured = true;
            const lh = opts.liveHex();
            if (lh !== undefined) {
              corr = {
                dx: (lh.x + lh.w / 2) - (opts.hex.x + opts.hex.w / 2),
                dy: (lh.y + lh.h / 2) - (opts.hex.y + opts.hex.h / 2),
                dw: lh.w - opts.hex.w,
                dh: lh.h - opts.hex.h,
              };
              if (Math.abs(corr.dx) + Math.abs(corr.dy) + Math.abs(corr.dw) + Math.abs(corr.dh) < 1) {
                corr = undefined; // the space did not move — keep the pure plan
              }
            }
          }
          if (corr !== undefined) {
            const k = (prog.q - TILE_RETARGET_AT) / (1 - TILE_RETARGET_AT);
            const ke = k * k * (3 - 2 * k); // smoothstep into the live rect
            cx += corr.dx * ke;
            cy += corr.dy * ke;
            w += corr.dw * ke;
            h += corr.dh * ke;
          }
        }
        gsap.set(els.tile, {
          x: cx - w / 2,
          y: cy - h / 2,
          ...(corr !== undefined ? {width: w, height: h} : {}),
          scale: tileScaleAt(prog.q, profile),
          rotation: tileTiltAt(prog.q, profile),
        });
        if (els.shadow !== undefined) {
          const sh = tileShadowAt(prog.q);
          // The ground shadow marks the LANDING spot (not the airborne
          // tile) — under a correction it glides onto the live cell with
          // the same blend.
          let shadowPose = {};
          if (corr !== undefined) {
            const k = (prog.q - TILE_RETARGET_AT) / (1 - TILE_RETARGET_AT);
            const ke = k * k * (3 - 2 * k);
            const landCx = opts.hex.x + opts.hex.w / 2 + corr.dx * ke;
            const landCy = opts.hex.y + opts.hex.h / 2 + corr.dy * ke;
            shadowPose = {
              x: landCx - w / 2,
              y: landCy - h / 2 + h * 0.42,
              width: w,
              height: h * 0.5,
            };
          }
          gsap.set(els.shadow, {
            scale: sh.scale,
            autoAlpha: Math.min(1, prog.q * 5) * sh.alpha,
            ...shadowPose,
          });
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

export type TierApproachOpts = {
  /** Where the board will paint the new top tile (the stack's lifted rect) — the proxy is sized to it. */
  landing: TileRect,
  /** The point the tier hangs at — straight above the landing. */
  hover: TransferPoint,
  from: TransferPoint,
  approachMs: number,
};

/**
 * THE SWING (awaited) — a city tier arrives like a block on a crane: from
 * the supply it swings over the site on one low arc with its HORIZONTAL
 * SPEED DYING OUT (a decelerating ease, never the ordinary landing's
 * in-out), stays large and close to the camera (it has not been lowered
 * yet), unwinds its carried tilt, and comes to rest hanging over the
 * stack. The ground shadow parks under the landing, wide and faint.
 * Resolves with the tier hanging — the caller lets the base take the load.
 */
export function playTierApproach(els: TileStageEls, opts: TierApproachOpts): Promise<void> {
  const plan = tileFlightPlan(opts.from, opts.hover);
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    tl.to(els.tile, {autoAlpha: 1, duration: Math.min(0.14, opts.approachMs / 3000), ease: 'power1.out'}, 0);
    if (els.shadow !== undefined) {
      tl.to(els.shadow, {autoAlpha: 0.6, duration: 0.2, ease: 'power1.out'}, 0.05);
    }
    const prog = {q: 0};
    tl.to(prog, {
      q: 1,
      duration: opts.approachMs / 1000,
      ease: 'power2.out', // the swing loses its speed as it reaches the site
      onUpdate: () => {
        const p = tileFlightPoint(plan, prog.q);
        // Carried large the whole way: the lowering, not the swing, brings it into the board's scale.
        const scale = OWN_FLIGHT_PROFILE.startScale - (OWN_FLIGHT_PROFILE.startScale - TIER_CRUISE_SCALE) * Math.min(1, prog.q * 1.4);
        gsap.set(els.tile, {
          x: p.x - opts.landing.w / 2,
          y: p.y - opts.landing.h / 2,
          scale,
          rotation: tileTiltAt(prog.q),
        });
        if (els.shadow !== undefined) {
          const sh = tileShadowAt(0);
          gsap.set(els.shadow, {scale: sh.scale, autoAlpha: Math.min(1, prog.q * 5) * sh.alpha});
        }
      },
    }, 0);
  }, opts.approachMs + 400);
}

export type TierDescentOpts = {
  landing: TileRect,
  hover: TransferPoint,
  uiScale: number,
  descentMs: number,
  contactMs: number,
};

/**
 * THE LOWERING + THE CONTACT (awaited) — straight down, x fixed on the
 * stack's centre: the tier is lowered INTO the board's scale (large →
 * exactly the landing rect), the ground shadow tightens from hover to
 * contact, and at the bottom it CONTACTS — dense and short: the thickness
 * compresses 3 → 1 px, one quiet brightness pass crosses the face, a
 * microscopic damped settle ends the motion. No bounce. Resolves at rest;
 * the caller paints the real tile (and ticks the counter) at that instant.
 */
export function playTierDescent(els: TileStageEls, opts: TierDescentOpts): Promise<void> {
  const cx = opts.landing.x + opts.landing.w / 2;
  const cy = opts.landing.y + opts.landing.h / 2;
  const settlePx = Math.max(1.5, Math.round(TILE_SETTLE_PX * 0.6 * opts.uiScale));
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    const prog = {q: 0};
    tl.to(prog, {
      q: 1,
      duration: opts.descentMs / 1000,
      ease: 'power1.inOut', // a controlled lowering — it neither drops nor floats
      onUpdate: () => {
        const y = opts.hover.y + (cy - opts.hover.y) * prog.q;
        gsap.set(els.tile, {
          x: cx - opts.landing.w / 2,
          y: y - opts.landing.h / 2,
          scale: tierDescentScaleAt(prog.q),
          rotation: 0,
        });
        if (els.shadow !== undefined) {
          const sh = tileShadowAt(prog.q);
          gsap.set(els.shadow, {scale: sh.scale, autoAlpha: sh.alpha});
        }
      },
    }, 0);
    const touchAt = opts.descentMs / 1000;
    if (els.edge !== undefined) {
      tl.to(els.edge, {y: 1, duration: 0.09, ease: 'power2.out'}, touchAt);
    }
    if (els.touch !== undefined) {
      tl.to(els.touch, {autoAlpha: 0.26, duration: (opts.contactMs * 0.3) / 1000, ease: 'power1.in'}, touchAt);
      tl.to(els.touch, {autoAlpha: 0, duration: (opts.contactMs * 0.7) / 1000, ease: 'power1.out'});
    }
    // The settle: the mass is felt once — down and back, damped, never a bounce.
    tl.to(els.tile, {y: `+=${settlePx}`, duration: 0.06, ease: 'power1.out'}, touchAt);
    tl.to(els.tile, {y: `-=${settlePx}`, duration: Math.max(0.08, opts.contactMs / 1000 - 0.06), ease: 'power2.out'}, touchAt + 0.06);
    if (els.shadow !== undefined) {
      tl.to(els.shadow, {autoAlpha: 0.5, duration: 0.1, ease: 'power1.out'}, touchAt);
    }
  }, opts.descentMs + opts.contactMs + 400);
}

/**
 * THE DUST (fire-and-forget) — the contact squeezes a ring of dust out from
 * under the tier: a few motes burst outward along the hex's perimeter, rise
 * a hair, and fall back, fading as they settle. Deterministic angles (the
 * model's), sized from the live hex — never fixed px, never confetti.
 */
export function playStackDust(els: TileStageEls, opts: {hex: TileRect, uiScale: number, dustMs: number}): void {
  const dust = els.dust;
  if (dust === undefined) {
    return;
  }
  const motes = Array.from(dust.querySelectorAll<HTMLElement>('.con-tileplace__dust-mote'));
  const ms = opts.dustMs / 1000;
  gsap.set(dust, {
    width: opts.hex.w, height: opts.hex.h,
    x: opts.hex.x, y: opts.hex.y,
    autoAlpha: 1,
  });
  motes.forEach((mote, i) => {
    const v = dustMoteVector(i, motes.length, opts.hex.w);
    gsap.set(mote, {x: 0, y: opts.hex.h * 0.12, scale: 0.6, autoAlpha: 0, transformOrigin: 'center center'});
    gsap.timeline({delay: (i % 3) * 0.012})
      .to(mote, {autoAlpha: 0.85, duration: ms * 0.12, ease: 'power1.out'}, 0)
      .to(mote, {x: v.dx, y: v.dy - v.rise, scale: 1, duration: ms * 0.42, ease: 'power2.out'}, 0)
      .to(mote, {y: v.dy + v.rise * 0.6, autoAlpha: 0, scale: 0.7, duration: ms * 0.5, ease: 'power1.in'}, ms * 0.42);
  });
  gsap.to(dust, {autoAlpha: 0, duration: 0.05, delay: ms + 0.05});
}

/**
 * SEAT the settled proxy exactly on a (re-measured) resting rect — the
 * post-flight verify of the live-anchor contract: when the coordinate space
 * moved AFTER the final-approach re-read (an exit transition that finished
 * in the flight's last 300 ms), the caller re-measures once at rest and
 * seats the proxy on the live cell before the reveal, so the handoff is
 * frame-perfect instead of landing beside the tile it is about to become.
 */
export function seatTileProxy(els: TileStageEls, hex: TileRect): void {
  gsap.set(els.tile, {
    x: hex.x, y: hex.y, width: hex.w, height: hex.h, scale: 1, rotation: 0,
  });
  if (els.shadow !== undefined) {
    gsap.set(els.shadow, {
      width: hex.w, height: hex.h * 0.5, x: hex.x, y: hex.y + hex.h * 0.42,
    });
  }
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

/**
 * Pose the bonus icon proxies at REST — pixel-exact over the printed field
 * icons, visible from this same synchronous turn. The caller blanks the
 * REAL icons in the same turn (the `con-deal-hold` swap discipline), so
 * the takeover is a seamless 1:1 replacement — never a double vision.
 * Takes the ICON ARRAY (not the whole stage) so the nomad-move scene can
 * displace a cell's bonuses with the SAME physical rule.
 */
export function placeBonusProxies(icons: ReadonlyArray<HTMLElement>): void {
  icons.forEach((el) => {
    gsap.set(el, {autoAlpha: 1, y: 0, scale: 1, transformOrigin: 'center center'});
  });
}

export type BonusPreLiftOpts = {
  /** When the rise starts (ms into the flight — the tile is descending). */
  delayMs: number,
  riseMs: number,
  hoverPx: number,
};

/**
 * The DISPLACEMENT rise (fire-and-forget, parallel to the tile flight):
 * the arriving tile pushes the printed bonuses UP — they rise off the
 * surface with a hint of carried inertia and HOVER there while the tile
 * slides underneath and seats. The proxies paint ABOVE the tile proxy
 * (layer order), so a bonus is never covered and never pops out from
 * beneath — the tile is revealed sliding UNDER them.
 */
export function playBonusPreLift(icons: ReadonlyArray<HTMLElement>, opts: BonusPreLiftOpts): void {
  icons.forEach((el, i) => {
    gsap.timeline({delay: (opts.delayMs + i * 45) / 1000})
      .to(el, {
        y: -opts.hoverPx,
        scale: 1.18,
        duration: opts.riseMs / 1000,
        ease: 'back.out(1.15)', // displaced with inertia — never springy
      }, 0);
  });
}

/**
 * The HANDOFF (fire-and-forget — the framework's chip wave is the awaited
 * half): each HOVERING icon dissolves the moment its chip is born at the
 * hover point, on the SAME wave stagger — one continuous
 * printed-icon → physical-chip materialization, never a swap.
 */
export function playBonusHandoff(icons: ReadonlyArray<HTMLElement>, opts: {count: number}): void {
  icons.forEach((el, i) => {
    const delay = transferWaveDelayMs(i, opts.count);
    gsap.timeline({delay: (delay + 90) / 1000})
      .to(el, {autoAlpha: 0, scale: 1.05, duration: 0.16, ease: 'power1.in'}, 0);
  });
}

// ── the OCEAN beat: the water pays, coin by coin ───────────────────────────

export type OceanActivationOpts = {
  /** Per-ocean launch delay (ms, motion-scaled) — index-aligned with the
   *  transfer wave's own stagger, so cause and payment stay locked. */
  delays: ReadonlyArray<number>;
  /** Unit shore direction (ocean → placed tile), index-aligned. */
  shores: ReadonlyArray<TransferPoint>;
  /** How far back into the water each pulse's light starts, in px. */
  drifts: ReadonlyArray<number>;
  pulseMs: number;
};

/**
 * THE WATER RESPONDS (fire-and-forget). A local swell at the shore the ocean
 * shares with the new tile: the light gathers a little way out and SLIDES to
 * the shore while a thin ring opens over it, then settles. Cold turquoise,
 * confined to the shoreline — economic infrastructure waking up, not magic.
 */
export function playOceanActivation(pulses: ReadonlyArray<HTMLElement>, opts: OceanActivationOpts): void {
  playShorePulses(pulses, opts);
}

/**
 * THE NEIGHBOURING TILE ANSWERS (fire-and-forget — the Ares adjacency
 * beat). Same shoreline physics as the ocean's swell — the light gathers a
 * little way INTO the paying tile and slides to the shared edge under an
 * opening ring — with the palette carried by CSS (`--ares`): warm printed
 * infrastructure waking up, not water.
 */
export function playAresSourcePulses(pulses: ReadonlyArray<HTMLElement>, opts: OceanActivationOpts): void {
  playShorePulses(pulses, opts);
}

/** The shared shoreline-pulse mechanics (ocean swell / Ares tile wake) —
 *  one physical language, palettes differ in CSS only. */
function playShorePulses(pulses: ReadonlyArray<HTMLElement>, opts: OceanActivationOpts): void {
  pulses.forEach((el, i) => {
    const wash = el.querySelector<HTMLElement>('.con-tileplace__oceanpulse-wash');
    const ring = el.querySelector<HTMLElement>('.con-tileplace__oceanpulse-ring');
    const shore = opts.shores[i] ?? {x: 0, y: -1};
    const drift = opts.drifts[i] ?? 0;
    const delay = (opts.delays[i] ?? 0) / 1000;
    const ms = opts.pulseMs / 1000;
    if (wash !== null) {
      // The sheen travels FROM the open water TO the materialization point.
      gsap.set(wash, {
        x: -shore.x * drift, y: -shore.y * drift,
        scale: 0.5, autoAlpha: 0, transformOrigin: 'center center',
      });
      gsap.timeline({delay})
        .to(wash, {x: 0, y: 0, scale: 1, autoAlpha: 0.55, duration: ms * 0.55, ease: 'power2.out'}, 0)
        .to(wash, {scale: 1.1, autoAlpha: 0, duration: ms * 0.75, ease: 'power1.inOut'}, ms * 0.55);
    }
    if (ring !== null) {
      gsap.set(ring, {scale: 0.34, autoAlpha: 0, transformOrigin: 'center center'});
      gsap.timeline({delay: delay + ms * 0.12})
        .to(ring, {autoAlpha: 0.7, duration: ms * 0.2, ease: 'power1.out'}, 0)
        .to(ring, {scale: 1.15, autoAlpha: 0, duration: ms * 0.95, ease: 'power2.out'}, 0);
    }
  });
}

/**
 * THE SEA ACCEPTS THE BUILDING (fire-and-forget). An ocean-cover touchdown:
 * one thin ring opens from under the seated tile while a soft wash brightens
 * the water's edge, then everything settles. Deliberately calmer than the
 * payment pulses — this is an acknowledgement, not a reward.
 */
export function playCoverSplash(els: TileStageEls, opts: {hex: TileRect, uiScale: number, splashMs: number}): void {
  const splash = els.splash;
  if (splash === undefined) {
    return;
  }
  const ring = splash.querySelector<HTMLElement>('.con-tileplace__splash-ring');
  const wash = splash.querySelector<HTMLElement>('.con-tileplace__splash-wash');
  const ms = opts.splashMs / 1000;
  gsap.set(splash, {
    width: opts.hex.w, height: opts.hex.h,
    x: opts.hex.x, y: opts.hex.y,
    autoAlpha: 1,
  });
  if (ring !== null) {
    gsap.set(ring, {scale: 0.55, autoAlpha: 0, transformOrigin: 'center center'});
    gsap.timeline()
      .to(ring, {autoAlpha: 0.65, duration: ms * 0.22, ease: 'power1.out'}, 0)
      .to(ring, {scale: 1.28, autoAlpha: 0, duration: ms * 0.85, ease: 'power2.out'}, ms * 0.1);
  }
  if (wash !== null) {
    gsap.set(wash, {scale: 0.8, autoAlpha: 0, transformOrigin: 'center center'});
    gsap.timeline()
      .to(wash, {scale: 1, autoAlpha: 0.4, duration: ms * 0.4, ease: 'power1.out'}, 0)
      .to(wash, {scale: 1.08, autoAlpha: 0, duration: ms * 0.6, ease: 'power1.inOut'}, ms * 0.4);
  }
}

export type OceanCoinOpts = {
  /** Per-coin launch delay (ms, motion-scaled) — index-aligned. */
  delays: ReadonlyArray<number>;
  /** How far into the ocean's pulse the condensation begins (ms). */
  leadMs: number;
  /** The whole birth: condensation → contour → gold mass → numeral + sheen. */
  formMs: number;
  /** Condensation particles per coin. */
  sparks: number;
};

/**
 * THE COIN CONDENSES (fire-and-forget). Never a fade-in and never a bare
 * `scale 0 → 1`: particles gather out of the lit water (mostly gold, a couple
 * of cold blue ones that keep the tie to the ocean), the outer METAL CONTOUR
 * closes first, the gold MASS fills it, and only then the M€ numeral strikes
 * with one short specular sweep. The scaffold ring then dissolves, leaving a
 * coin that is pixel-identical to the framework's own M€ chip — which is what
 * makes the handoff into the flight invisible.
 */
export function playOceanCoinMaterialize(coins: ReadonlyArray<HTMLElement>, opts: OceanCoinOpts): void {
  const f = opts.formMs / 1000;
  coins.forEach((root, i) => {
    const delay = ((opts.delays[i] ?? 0) + opts.leadMs) / 1000;
    const ring = root.querySelector<HTMLElement>('.con-tileplace__coin-ring');
    const body = root.querySelector<HTMLElement>('.con-tileplace__coin-body');
    const value = root.querySelector<HTMLElement>('.con-tileplace__coin-value');
    const sheen = root.querySelector<HTMLElement>('.con-tileplace__coin-sheen');
    const sparks = Array.from(root.querySelectorAll<HTMLElement>('.con-tileplace__coin-spark'));

    gsap.set(root, {autoAlpha: 1, scale: 1, y: 0, transformOrigin: 'center center'});
    const radius = (root.offsetWidth || 44) * 0.9;
    const tl = gsap.timeline({delay});

    sparks.forEach((s, k) => {
      // Deterministic gather ring (no randomness — replays identically, and a
      // second coin in the same wave is rotated so the two never read as twins).
      const angle = (k / Math.max(1, opts.sparks)) * Math.PI * 2 + i * 0.7;
      gsap.set(s, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        scale: 0.7, autoAlpha: 0, transformOrigin: 'center center',
      });
      tl.to(s, {autoAlpha: 0.95, duration: f * 0.12, ease: 'power1.out'}, f * 0.02 + k * 0.012);
      tl.to(s, {x: 0, y: 0, scale: 0.35, autoAlpha: 0, duration: f * 0.46, ease: 'power2.in'}, f * 0.06 + k * 0.012);
    });
    if (ring !== null) {
      // The contour closes in — the coin's outline exists before its substance.
      gsap.set(ring, {scale: 1.5, autoAlpha: 0, transformOrigin: 'center center'});
      tl.to(ring, {scale: 1, autoAlpha: 1, duration: f * 0.34, ease: 'back.out(1.1)'}, f * 0.2);
      tl.to(ring, {autoAlpha: 0, duration: f * 0.22, ease: 'power1.in'}, f * 0.78);
    }
    if (body !== null) {
      // …then the gold mass fills that outline.
      gsap.set(body, {scale: 0.28, autoAlpha: 0, transformOrigin: 'center center'});
      tl.to(body, {scale: 1, autoAlpha: 1, duration: f * 0.4, ease: 'power2.out'}, f * 0.42);
    }
    if (value !== null) {
      gsap.set(value, {scale: 0.72, autoAlpha: 0, transformOrigin: 'center center'});
      tl.to(value, {scale: 1, autoAlpha: 1, duration: f * 0.26, ease: 'back.out(1.6)'}, f * 0.7);
    }
    if (sheen !== null) {
      gsap.set(sheen, {xPercent: -160, rotation: 18, autoAlpha: 0, transformOrigin: 'center center'});
      tl.to(sheen, {autoAlpha: 0.75, duration: f * 0.1, ease: 'power1.out'}, f * 0.74);
      tl.to(sheen, {xPercent: 160, duration: f * 0.32, ease: 'power1.inOut'}, f * 0.74);
      tl.to(sheen, {autoAlpha: 0, duration: f * 0.14, ease: 'power1.in'}, f * 0.92);
    }
  });
}

/**
 * THE HANDOFF (fire-and-forget — the framework's chip wave is the awaited
 * half): each formed coin lifts off and dissolves exactly as its transfer chip
 * is born at the same point, on the SAME per-index stagger. One continuous
 * object: condensed here, carried from here.
 */
export function playOceanCoinHandoff(coins: ReadonlyArray<HTMLElement>, opts: {delays: ReadonlyArray<number>, uiScale: number}): void {
  const lift = Math.max(3, Math.round(5 * opts.uiScale));
  coins.forEach((root, i) => {
    gsap.timeline({delay: ((opts.delays[i] ?? 0) + 70) / 1000})
      .to(root, {y: -lift, scale: 1.04, autoAlpha: 0, duration: 0.16, ease: 'power1.in'}, 0);
  });
}

/**
 * Kill the tweens of the OCEAN pieces (pulses / coins). They animate their
 * CHILDREN (wash / ring / body / sparks), so killing the roots alone would
 * leave sub-tweens running on a detached tree. Exported because the ocean
 * beat is shared and aborts with its own caller, not with the tile scene.
 */
export function killOceanTweens(roots: ReadonlyArray<HTMLElement>): void {
  roots.forEach((el) => {
    gsap.killTweensOf(el);
    el.querySelectorAll<HTMLElement>('*').forEach((child) => gsap.killTweensOf(child));
  });
}

/** Abort/unmount: kill every tween on the stage (idempotent). */
export function killTileTweens(els: TileStageEls): void {
  gsap.killTweensOf(els.tile);
  if (els.edge !== undefined) {
    gsap.killTweensOf(els.edge);
  }
  if (els.depart !== undefined) {
    // A move drives its proxy through a progress tween on a plain object — kill the timeline that owns it.
    moveTimelines.get(els.depart)?.kill();
    moveTimelines.delete(els.depart);
    gsap.killTweensOf(els.depart);
  }
  if (els.departEdge !== undefined) {
    gsap.killTweensOf(els.departEdge);
  }
  if (els.departTouch !== undefined) {
    gsap.killTweensOf(els.departTouch);
  }
  if (els.touch !== undefined) {
    gsap.killTweensOf(els.touch);
  }
  if (els.shadow !== undefined) {
    gsap.killTweensOf(els.shadow);
  }
  els.bonusIcons.forEach((el) => gsap.killTweensOf(el));
  // The pulse/coin/splash pieces animate their CHILDREN (wash / ring / body /
  // sparks), so killing the roots alone would leave sub-tweens running on a
  // detached tree.
  const withChildren = [...els.aresPulses];
  if (els.splash !== undefined) {
    withChildren.push(els.splash);
  }
  if (els.dust !== undefined) {
    withChildren.push(els.dust);
  }
  withChildren.forEach((el) => {
    gsap.killTweensOf(el);
    el.querySelectorAll<HTMLElement>('*').forEach((child) => gsap.killTweensOf(child));
  });
}
