/*
 * TRADE FLEET DIRECTOR — the GSAP staging of the console colony-trade launch
 * (the "send a trade fleet to the planet" cinematic). ONE flight per launch,
 * over the app-level `ConsoleTradeFleetLayer` (mounted in ConsoleShell, so a
 * flight survives the composer closing beneath it).
 *
 * THE CHOREOGRAPHY (the premium rework — each beat answers a defect the
 * arcade version shipped):
 *   IGNITION — the ship squats on its pad (engines charge) and rises at the
 *              PAD SHIP'S OWN SIZE (startScale is measured from the launch
 *              rect — the proxy used to spawn ~1.7× its pad ship, a visible
 *              size pop on the very first frame);
 *   TRANSIT  — one bézier arc on one clock. The nose BANKS INTO the heading
 *              over the first ~12% (it used to snap to the tangent on frame
 *              one) and the hull grows toward the viewer mid-flight — the
 *              travel carries mass through attitude and scale alone (a puff
 *              trail shipped once and was cut: it read as debris, not wake);
 *   FLARE    — over the last ~22% the ship pitches back upright (a lander's
 *              flare), so the approach hover holds nose-up over the berth —
 *              the dock no longer spins the hull half a turn in place;
 *   APPROACH — slow station-keeping (a ±3px drift on a 1.2s breath + a tiny
 *              attitude sway — the old 220ms yoyo bob read as jitter),
 *              PENDING until the server confirms (`dock()` releases);
 *   DOCK     — the final descent onto the berth, PIXEL-PERFECT (position +
 *              size + angle of the real docked ship), then the colony ack.
 *
 * Contracts (mirror the deal/exit directors): transform/opacity only (the
 * ship element geometry is fixed — GSAP moves a composite layer); durations
 * through motionMs(); `skip()` is idempotent and always tears down; a safety
 * guarantees `dock`'s callback fires even if rAF stalls; reduced motion runs
 * a short straight hop with no arc.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {
  approachReadyMs, arcHeadingDeg, FleetTimings, fleetTimings, launchArcControl, Point, reducedFleetTimings,
} from '@/client/console/colonyFleet/tradeFleetModel';

/** Phase notifications back to the controller (injected — no import cycle). */
export type FleetPhaseName = 'launch' | 'transit' | 'approach' | 'dock' | 'ack';

export type TradeFleetDirectorHandle = {
  /** Release the approach hold: play the final PIXEL-PERFECT dock snap onto
   *  the berth slot, then `onLand` (the caller commits — the real ship
   *  materializes in this exact rect under the still-visible proxy). */
  dock: (onLand: () => void) => void,
  /** After the commit: crossfade the landed proxy out onto the now-real
   *  docked ship, then `onGone` (the caller unmounts + clears). */
  release: (onGone: () => void) => void,
  /** Tear down instantly (abort / unmount) — no visual guarantees. */
  skip: () => void,
};

export type RunFleetArgs = {
  /** The flying ship element (positioned by the director). */
  ship: HTMLElement,
  /** Launch rect (the fleet pad's ship slot) — screen coords. */
  from: DOMRect,
  /** Berth rect (the target colony's dock slot) — screen coords. */
  to: DOMRect,
  reduced: boolean,
  /** Phase → controller (injected to keep the graph acyclic). */
  onPhase: (phase: FleetPhaseName) => void,
};

function centre(r: DOMRect): Point {
  return {x: r.left + r.width / 2, y: r.top + r.height / 2};
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function runTradeFleetFlight(args: RunFleetArgs): TradeFleetDirectorHandle {
  const {ship, reduced} = args;
  const t: FleetTimings = reduced ? reducedFleetTimings() : fleetTimings();
  const s = (baseMs: number) => motionMs(baseMs) / 1000;

  const from = centre(args.from);
  const to = centre(args.to);
  const ctrl = launchArcControl(from, to);
  // The launch starts from the TOP fleet dock, so the arc's "up" bow can
  // push the apex above the viewport — clamp it on-screen so the ship never
  // clips out the top on its climb (the layer is `overflow: clip`).
  ctrl.y = Math.max(ctrl.y, 16);

  let docked = false;
  let killed = false;
  let dockCb: (() => void) | undefined;
  let approachReached = false;

  // The ship is centred on its own box; position by its centre.
  const shipW = ship.offsetWidth || 46;
  const half = shipW / 2;
  const halfH = (ship.offsetHeight || 46) / 2;
  const setAt = (p: Point, rotation: number, scale: number) => {
    gsap.set(ship, {x: p.x - half, y: p.y - halfH, rotation, scale, transformOrigin: '50% 50%'});
  };

  // HONEST SIZES. The proxy takes off at the PAD SHIP'S size and lands at
  // the BERTH ship's size — both measured, so neither end of the flight can
  // pop. Mid-flight it grows toward the viewer (presence), then settles
  // toward the approach size on the descent.
  const startScale = reduced ? 0.6 : Math.max(0.3, Math.min(1.2, args.from.width / shipW));
  const dockScale = args.to.width > 8 ? args.to.width / shipW : startScale;
  const peakScale = reduced ? startScale : Math.max(startScale * 1.6, 1.0);
  const approachScale = reduced ? dockScale : Math.max(dockScale * 1.5, startScale);

  setAt(from, 0, startScale);
  gsap.set(ship, {autoAlpha: 1});

  const tl = gsap.timeline();

  // IGNITION — a squat as the engines charge, then the rise begins. The
  // recover ends at the EXACT scale the transit drive starts from
  // (`liftScale`) — the old 1.05 → 1.0 seam popped 5% on the liftoff frame.
  // The plume itself is the icon's CSS `launch` state (the controller phase).
  const liftScale = reduced ? startScale : startScale * 1.02;
  args.onPhase('launch');
  if (!reduced) {
    tl.to(ship, {scale: startScale * 0.93, duration: s(t.chargeMs * 0.4), ease: 'power2.in'}, 0);
    tl.to(ship, {scale: liftScale, duration: s(t.chargeMs * 0.6), ease: 'power2.out'}, s(t.chargeMs * 0.4));
  }
  tl.call(() => args.onPhase('transit'), undefined, s(t.chargeMs));

  // TRANSIT — one bézier on one clock; heading and scale derive from the
  // same progress:
  //  · the nose BANKS IN over the first 12% (rotation 0 on the pad → the
  //    live tangent) and FLARES OUT over the last 22% (tangent → upright),
  //    so neither end of the flight snaps an angle;
  //  · scale rides a sin² hump from the lift size to a mid-flight peak and
  //    down to the approach size — sin² has ZERO slope at both ends, so the
  //    hull arrives with no residual growth/shrink (a plain sin(πp) is at
  //    its fastest shrink on the very arrival frame — a visible hard stop).
  const prog = {p: 0};
  tl.to(prog, {
    p: 1,
    duration: s(t.liftMs + t.transitMs),
    ease: reduced ? 'power1.inOut' : 'power2.inOut',
    onUpdate: () => {
      const p = prog.p;
      const mt = 1 - p;
      const x = mt * mt * from.x + 2 * mt * p * ctrl.x + p * p * to.x;
      const y = mt * mt * from.y + 2 * mt * p * ctrl.y + p * p * to.y;
      const heading = reduced ? 0 : arcHeadingDeg(from, ctrl, to, p);
      const rot = reduced ? 0 : heading * smoothstep(0, 0.12, p) * (1 - smoothstep(0.78, 1, p));
      const hump = Math.sin(p * Math.PI);
      const base = liftScale + (approachScale - liftScale) * p;
      const scale = reduced ? startScale : base + (peakScale - base) * hump * hump;
      setAt({x, y}, rot, scale);
    },
  }, s(t.chargeMs));

  // APPROACH — station-keeping over the berth (pending until `dock()`).
  const approachAt = s(t.chargeMs) + s(t.liftMs + t.transitMs);
  tl.call(() => {
    approachReached = true;
    args.onPhase('approach');
    tryDock();
  }, undefined, approachAt);

  // A slow drift + a tiny attitude sway — a vessel holding position, never
  // the old 220ms bob (which read as jitter). Killed at dock.
  if (!reduced) {
    tl.to(ship, {y: '+=3', duration: s(1150), yoyo: true, repeat: -1, ease: 'sine.inOut'}, approachAt);
    tl.to(ship, {rotation: 1.0, duration: s(1450), yoyo: true, repeat: -1, ease: 'sine.inOut'}, approachAt);
  }

  function finishDock(): void {
    if (docked || killed) {
      return;
    }
    docked = true;
    gsap.killTweensOf(ship); // stop the station-keeping
    args.onPhase('dock');
    // The final descent: settle EXACTLY onto the ship slot (position + size
    // + angle) on ONE symmetric ease — it leaves the hover gently and
    // arrives gently (the old 260ms power3.out read as a snap), and the
    // last frame is pixel-perfect (no overshoot by construction). On
    // landing, resolve the gate: the caller commits, the REAL docked ship
    // materializes in this exact rect UNDER the still-visible proxy, and
    // only then does `release()` crossfade the proxy out.
    const land = gsap.timeline({
      onComplete: () => {
        args.onPhase('ack');
        const cb = dockCb;
        dockCb = undefined;
        cb?.();
      },
    });
    land.to(ship, {
      x: to.x - half, y: to.y - halfH, rotation: 0, scale: dockScale,
      duration: s(t.dockMs), ease: 'power2.inOut',
    });
  }

  // The dock can be requested before OR after the ship reaches the approach
  // point — fire it as soon as both are true.
  let dockRequested = false;
  function tryDock(): void {
    if (dockRequested && approachReached) {
      finishDock();
    }
  }

  // Safety: if rAF stalls (hidden tab), guarantee the dock callback fires so
  // the WaitingFor gate can never hang.
  let safetyId = 0;

  function clearSafety(): void {
    if (safetyId !== 0) {
      clearTimeout(safetyId);
      safetyId = 0;
    }
  }

  return {
    dock: (onLand: () => void) => {
      dockCb = onLand;
      dockRequested = true;
      // Guarantee resolution even if the timeline is frozen.
      safetyId = window.setTimeout(() => {
        const cb = dockCb;
        dockCb = undefined;
        cb?.();
      }, motionMs(approachReadyMs(t) + t.dockMs) + 1200) as unknown as number;
      tryDock();
    },
    release: (onGone: () => void) => {
      clearSafety();
      if (killed) {
        onGone();
        return;
      }
      // The real docked ship is now committed UNDER the pixel-perfect proxy —
      // crossfade the proxy out onto it. A safety fires onGone even if rAF stalls.
      let released = false;
      const finish = () => {
        if (!released) {
          released = true;
          onGone();
        }
      };
      window.setTimeout(finish, motionMs(t.ackMs) + 600);
      gsap.to(ship, {autoAlpha: 0, duration: s(t.ackMs), ease: 'power1.out', onComplete: finish});
    },
    skip: () => {
      killed = true;
      clearSafety();
      tl.kill();
      gsap.killTweensOf(ship);
      gsap.set(ship, {autoAlpha: 0});
      const cb = dockCb;
      dockCb = undefined;
      cb?.();
    },
  };
}
