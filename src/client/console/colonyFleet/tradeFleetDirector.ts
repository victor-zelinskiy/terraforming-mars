/*
 * TRADE FLEET DIRECTOR — the GSAP staging of the console colony-trade launch
 * (the "send a trade fleet to the planet" cinematic). ONE flight per launch,
 * over the app-level `ConsoleTradeFleetLayer` (mounted in ConsoleShell, so a
 * flight survives the composer closing beneath it).
 *
 * Phases (see tradeFleetModel for the pure timings/trajectory):
 *   CHARGE   — the ship sits over the composer launch anchor, engines ignite;
 *   LIFT     — it comes off the composer toward the grid;
 *   TRANSIT  — a confident bézier arc to the target berth (nose along heading,
 *              a short engine trail);
 *   APPROACH — hovers just off the berth, PENDING (holds until the server
 *              confirms — `dock()` is what releases it);
 *   DOCK     — the final snap into the berth + the colony acknowledgment glow;
 *              `onDock` resolves the WaitingFor gate.
 *
 * Contracts (mirror the deal/exit directors): transform/opacity only (the
 * ship element geometry is fixed — GSAP moves a composite layer); durations
 * through motionMs(); `skip()` is idempotent and always tears down; a safety
 * guarantees `dock`'s callback fires even if rAF stalls; reduced motion runs
 * a short straight hop with no arc/trail (the sequence still reads).
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
  /** Launch rect (the composer fleet anchor) — screen coords. */
  from: DOMRect,
  /** Berth rect (the target colony tile) — screen coords. */
  to: DOMRect,
  reduced: boolean,
  /** Phase → controller (injected to keep the graph acyclic). */
  onPhase: (phase: FleetPhaseName) => void,
};

function centre(r: DOMRect): Point {
  return {x: r.left + r.width / 2, y: r.top + r.height / 2};
}

export function runTradeFleetFlight(args: RunFleetArgs): TradeFleetDirectorHandle {
  const {ship, reduced} = args;
  const t: FleetTimings = reduced ? reducedFleetTimings() : fleetTimings();
  const s = (baseMs: number) => motionMs(baseMs) / 1000;

  const from = centre(args.from);
  const to = centre(args.to);
  const ctrl = launchArcControl(from, to);
  // The launch now starts from the TOP fleet dock, so the arc's "up" bow can
  // push the apex above the viewport — clamp it on-screen so the ship never
  // clips out the top on its climb (the layer is `overflow: clip`).
  ctrl.y = Math.max(ctrl.y, 16);

  let docked = false;
  let killed = false;
  let dockCb: (() => void) | undefined;
  let approachReached = false;

  // The ship is centred on its own box; position by its centre.
  const half = ship.offsetWidth / 2 || 20;
  const halfH = ship.offsetHeight / 2 || 20;
  const setAt = (p: Point, rotation: number, scale: number) => {
    gsap.set(ship, {x: p.x - half, y: p.y - halfH, rotation, scale, transformOrigin: '50% 50%'});
  };

  setAt(from, 0, reduced ? 1 : 0.9);
  gsap.set(ship, {autoAlpha: 1});

  const tl = gsap.timeline();

  // CHARGE + LIFT — engines ignite, the ship comes off the composer.
  args.onPhase('launch');
  tl.to(ship, {scale: reduced ? 1 : 1.06, duration: s(t.chargeMs), ease: 'power2.out'}, 0);
  tl.call(() => args.onPhase('transit'), undefined, s(t.chargeMs));

  // TRANSIT — the arc. Drive a 0..1 proxy and place the ship on the bézier so
  // the nose follows the heading (compositor-friendly: one tween of an object).
  const prog = {p: 0};
  const flightScale = reduced ? 1 : 1.14;
  tl.to(prog, {
    p: 1,
    duration: s(t.liftMs + t.transitMs),
    ease: reduced ? 'power1.inOut' : 'power2.inOut',
    onUpdate: () => {
      const p = prog.p;
      const mt = 1 - p;
      const x = mt * mt * from.x + 2 * mt * p * ctrl.x + p * p * to.x;
      const y = mt * mt * from.y + 2 * mt * p * ctrl.y + p * p * to.y;
      const rot = reduced ? 0 : arcHeadingDeg(from, ctrl, to, p);
      // Ease the scale up on the climb, back down onto the berth.
      const scale = reduced ? 1 : 0.9 + (flightScale - 0.9) * Math.sin(p * Math.PI);
      setAt({x, y}, rot, scale);
    },
  }, s(t.chargeMs));

  // APPROACH — hover just off the berth (pending), until `dock()` releases.
  const approachAt = s(t.chargeMs) + s(t.liftMs + t.transitMs);
  tl.call(() => {
    approachReached = true;
    args.onPhase('approach');
    tryDock();
  }, undefined, approachAt);

  // A gentle idle bob while pending (paused-friendly; killed at dock).
  if (!reduced) {
    tl.to(ship, {y: '+=4', duration: s(220), yoyo: true, repeat: -1, ease: 'sine.inOut'}, approachAt);
  }

  // PIXEL-PERFECT dock scale: the proxy (its own box) shrinks so its VISUAL
  // size equals the berth slot's real rect — the same size the docked ship
  // renders at. Combined with centring on the slot centre + rotation 0, the
  // landed proxy occupies the IDENTICAL rect the real ship will, so the fade
  // is a true crossfade (never a centre-of-planet detour + reappear).
  const dockScale = args.to.width > 8 ? args.to.width / (ship.offsetWidth || 46) : (reduced ? 0.5 : 0.46);

  function finishDock(): void {
    if (docked || killed) {
      return;
    }
    docked = true;
    gsap.killTweensOf(ship); // stop the idle bob
    args.onPhase('dock');
    // Settle EXACTLY onto the final ship slot (position + size + angle), a
    // clean ease (no overshoot — the last frame must be pixel-perfect). On
    // landing, resolve the gate: the caller commits, the REAL docked ship
    // materializes in this exact rect UNDER the still-visible proxy, and only
    // then does `release()` crossfade the proxy out.
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
      duration: s(t.dockMs), ease: 'power2.out',
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
