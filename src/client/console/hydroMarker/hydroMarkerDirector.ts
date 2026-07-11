/*
 * HYDRO MARKER DIRECTOR — the GSAP staging of the console hydronetwork
 * marker advance. The engineering-flavoured sibling of tradeFleetDirector:
 * calmer, more "instrument" — a token gliding along a rail, not a ship
 * flying an arc.
 *
 * Phases (see hydroMarkerModel for the pure timings):
 *   CHARGE  — the marker sits over the old stop, focuses (a brief ready beat);
 *   LIFT    — it comes a touch off the rail;
 *   GLIDE   — it travels straight along the rail to the new stop (eased,
 *             confident, no arc — this is a track, not the sky);
 *   ARRIVE  — it hovers ON the new stop, PENDING (holds until the server
 *             confirms — `lock()` is what releases it);
 *   LOCK    — the final snap onto the stop (PIXEL-PERFECT: exact position +
 *             size of the real marker) + a lock-in pulse; `onLand` resolves
 *             the WaitingFor gate → the caller commits;
 *   RELEASE — after the commit, crossfade the proxy out onto the now-real
 *             marker (same rect) → `onGone` unmounts + clears.
 *
 * Contracts (mirror the fleet/deal directors): transform/opacity only;
 * durations through motionMs(); `skip()` idempotent + always tears down; a
 * safety guarantees the gate resolves even if rAF stalls; reduced motion runs
 * a short straight step-glide (the sequence still reads).
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {arriveReadyMs, markerTimings, MarkerTimings, reducedMarkerTimings} from '@/client/console/hydroMarker/hydroMarkerModel';

/** Phase notifications back to the controller (injected — no import cycle). */
export type MarkerPhaseName = 'charge' | 'glide' | 'arrive' | 'lock' | 'pulse';

export type HydroMarkerDirectorHandle = {
  /** Release the arrival hold: the final PIXEL-PERFECT lock-in snap onto the
   *  stop slot, then `onLand` (the caller commits — the real marker
   *  materializes in this exact rect under the still-visible proxy). */
  lock: (onLand: () => void) => void,
  /** After the commit: crossfade the locked proxy out onto the now-real
   *  marker, then `onGone` (the caller unmounts + clears). */
  release: (onGone: () => void) => void,
  /** Tear down instantly (abort / unmount) — no visual guarantees. */
  skip: () => void,
};

export type RunMarkerArgs = {
  /** The gliding marker element (positioned by the director). */
  marker: HTMLElement,
  /** Old stop marker-slot rect — screen coords. */
  from: DOMRect,
  /** New stop marker-slot rect — screen coords (the pixel-perfect target). */
  to: DOMRect,
  reduced: boolean,
  /** Phase → controller (injected to keep the graph acyclic). */
  onPhase: (phase: MarkerPhaseName) => void,
};

type Point = {x: number, y: number};
function centre(r: DOMRect): Point {
  return {x: r.left + r.width / 2, y: r.top + r.height / 2};
}

export function runHydroMarkerGlide(args: RunMarkerArgs): HydroMarkerDirectorHandle {
  const {marker, reduced} = args;
  const t: MarkerTimings = reduced ? reducedMarkerTimings() : markerTimings();
  const s = (baseMs: number) => motionMs(baseMs) / 1000;

  const from = centre(args.from);
  const to = centre(args.to);

  let locked = false;
  let killed = false;
  let lockCb: (() => void) | undefined;
  let arriveReached = false;
  let lockRequested = false;
  let safetyId = 0;

  const half = marker.offsetWidth / 2 || 8;
  const halfH = marker.offsetHeight / 2 || 8;
  // PIXEL-PERFECT target scale: the proxy's visual size == the real marker
  // slot's rect (the same size the real marker renders at), so the crossfade
  // is a true handoff, never a size pop.
  const lockScale = args.to.width > 4 ? args.to.width / (marker.offsetWidth || 16) : (reduced ? 0.9 : 1);
  // The start scale matches the source rect too (from and to are the same
  // marker-slot size, so this is ~lockScale — the glide keeps a steady size).
  const startScale = args.from.width > 4 ? args.from.width / (marker.offsetWidth || 16) : lockScale;

  const setAt = (p: Point, scale: number, lift: number) => {
    gsap.set(marker, {x: p.x - half, y: p.y - halfH - lift, scale, transformOrigin: '50% 50%'});
  };
  setAt(from, startScale, 0);
  gsap.set(marker, {autoAlpha: 1});

  function clearSafety(): void {
    if (safetyId !== 0) {
      clearTimeout(safetyId);
      safetyId = 0;
    }
  }

  const tl = gsap.timeline();

  // CHARGE — the marker focuses on the old stop (a brief, calm ready beat).
  args.onPhase('charge');
  tl.to(marker, {scale: reduced ? startScale : startScale * 1.18, duration: s(t.chargeMs), ease: 'power2.out'}, 0);

  // LIFT + GLIDE — a touch off the rail, then a straight eased glide to the
  // new stop (an instrument track — no arc). A tiny lift reads as "off the
  // rail, travelling", settling back down on arrival.
  args.onPhase('glide');
  const glideAt = s(t.chargeMs);
  const prog = {p: 0};
  tl.to(prog, {
    p: 1,
    duration: s(t.liftMs + t.glideMs),
    ease: reduced ? 'power1.inOut' : 'power2.inOut',
    onUpdate: () => {
      const p = prog.p;
      const x = from.x + (to.x - from.x) * p;
      const y = from.y + (to.y - from.y) * p;
      const lift = reduced ? 0 : Math.sin(p * Math.PI) * 8; // small arc off the rail
      const scale = reduced ? startScale : startScale * (1.12 - 0.12 * p);
      setAt({x, y}, scale, lift);
    },
  }, glideAt);

  // ARRIVE — hover ON the new stop (pending), until `lock()` releases.
  const arriveAt = glideAt + s(t.liftMs + t.glideMs);
  tl.call(() => {
    arriveReached = true;
    args.onPhase('arrive');
    tryLock();
  }, undefined, arriveAt);
  if (!reduced) {
    tl.to(marker, {scale: `+=0.04`, duration: s(200), yoyo: true, repeat: -1, ease: 'sine.inOut'}, arriveAt);
  }

  function finishLock(): void {
    if (locked || killed) {
      return;
    }
    locked = true;
    gsap.killTweensOf(marker); // stop the pending pulse
    args.onPhase('lock');
    // Snap EXACTLY onto the real marker slot (position + size), a firm ease
    // (no overshoot — the last frame is pixel-perfect). On landing, resolve
    // the gate: the caller commits, the real marker materializes in this rect
    // UNDER the proxy, and `release()` crossfades onto it.
    const land = gsap.timeline({
      onComplete: () => {
        args.onPhase('pulse');
        const cb = lockCb;
        lockCb = undefined;
        cb?.();
      },
    });
    land.to(marker, {x: to.x - half, y: to.y - halfH, scale: lockScale, duration: s(t.lockMs), ease: 'power3.out'});
  }

  function tryLock(): void {
    if (lockRequested && arriveReached) {
      finishLock();
    }
  }

  return {
    lock: (onLand: () => void) => {
      lockCb = onLand;
      lockRequested = true;
      safetyId = setTimeout(() => {
        const cb = lockCb;
        lockCb = undefined;
        cb?.();
      }, motionMs(arriveReadyMs(t) + t.lockMs) + 1000) as unknown as number;
      tryLock();
    },
    release: (onGone: () => void) => {
      clearSafety();
      if (killed) {
        onGone();
        return;
      }
      let released = false;
      const finish = () => {
        if (!released) {
          released = true;
          onGone();
        }
      };
      setTimeout(finish, motionMs(t.pulseMs) + 500);
      gsap.to(marker, {autoAlpha: 0, duration: s(t.pulseMs), ease: 'power1.out', onComplete: finish});
    },
    skip: () => {
      killed = true;
      clearSafety();
      tl.kill();
      gsap.killTweensOf(marker);
      gsap.set(marker, {autoAlpha: 0});
      const cb = lockCb;
      lockCb = undefined;
      cb?.();
    },
  };
}
