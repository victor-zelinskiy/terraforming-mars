/*
 * HYDRO DRAW DIRECTOR — the GSAP choreography of the «Гидромоделирование»
 * card flight (transform/opacity only, clipped app-level stage — see
 * ConsoleHydroDrawLayer.vue). The plan it executes is pure: hydroDrawModel.ts.
 *
 * Beats (one master timeline, every card on it):
 *  EMERGE  — a tight face-down stack rises out of the track cell the marker
 *            just landed on and OPENS into a fan, card by card;
 *  HOLD    — the completed fan breathes (the presentation beat);
 *  TRAVEL  — the group moves into the modal's exact slot rects, flipping
 *            face-up on the way and settling flat.
 *
 * NO JERKS — the property that drove this rework:
 *  - every animated property is ONE continuous tween per leg, so there is no
 *    junction where velocity can jump (the board-bonus director chains a
 *    gather leg into a fan leg, which reads as a stutter with four cards);
 *  - the arc is made by LAGGING the vertical tween behind the horizontal one
 *    rather than by a mid waypoint — a curved path with no waypoint to stop at;
 *  - every leg ends on an `inOut`/`out` ease, i.e. at zero velocity, so a card
 *    settles into its slot instead of arriving at speed;
 *  - the fan hold is a deliberate pause at a completed pose (still velocity
 *    zero on both sides), never a mid-flight stall.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {
  emergeDelayMs, hydroFanOffsets, stackOffset, travelDelayMs,
  HydroDrawTimings, RectLike,
} from '@/client/console/hydroDraw/hydroDrawModel';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/** How much of the way from the cell stack to the slot the fan pose sits. */
const FAN_SCALE_PORTION = 0.62;
/** Deterministic pre-emerge tilt (no Math.random — resume/test safe). */
function stackRotation(index: number): number {
  return (index % 2 === 0 ? -1 : 1) * (1.5 + (index % 3));
}

export type HydroFlightHandle = {kill: () => void};

export function runHydroCardFlight(args: {
  proxies: ReadonlyArray<HTMLElement>,
  flips: ReadonlyArray<HTMLElement>,
  /** The track cell the cards come out of (already card-shaped). */
  from: RectLike,
  /** The pick modal's exact slot rects, in card order. */
  targets: ReadonlyArray<RectLike>,
  /** Where the fan opens (hydroFanCentre). */
  fan: {x: number, y: number},
  t: HydroDrawTimings,
  reduced: boolean,
  onAllLanded: () => void,
}): HydroFlightHandle {
  const {proxies, flips, from, targets, fan, t} = args;
  const count = proxies.length;
  const offsets = hydroFanOffsets(count);
  const fromCx = from.left + from.width / 2;
  const fromCy = from.top + from.height / 2;
  const master = gsap.timeline({onComplete: args.onAllLanded});

  proxies.forEach((proxy, i) => {
    const target = targets[i];
    const flip = flips[i];
    const offset = offsets[i];
    if (target === undefined || flip === undefined || offset === undefined) {
      return;
    }
    /*
     * Geometry mirrors the deal / bonus directors: the proxy is NATURAL width
     * (so the card frame keeps its true proportions — never a stretched box),
     * its height follows the TARGET's aspect, and scale maps it onto each pose.
     */
    const endScale = Math.max(0.05, target.width / CARD_NATURAL_W);
    const naturalH = target.height / endScale;
    const startScale = Math.max(0.02, Math.min(endScale, from.width / CARD_NATURAL_W));
    const fanScale = startScale + (endScale - startScale) * FAN_SCALE_PORTION;

    const stack = stackOffset(i);
    const startX = fromCx - (CARD_NATURAL_W * startScale) / 2 + stack.dx * CARD_NATURAL_W * startScale;
    const startY = fromCy - (naturalH * startScale) / 2 + stack.dy * naturalH * startScale;
    const fanX = fan.x + offset.spread * CARD_NATURAL_W * fanScale - (CARD_NATURAL_W * fanScale) / 2;
    const fanY = fan.y + offset.drop * naturalH * fanScale - (naturalH * fanScale) / 2;

    gsap.set(proxy, {
      width: CARD_NATURAL_W,
      height: naturalH,
      transformOrigin: 'top left',
      x: startX,
      y: startY,
      scale: startScale,
      rotation: args.reduced ? 0 : stackRotation(i),
      autoAlpha: 0,
    });
    gsap.set(flip, {rotateY: 180}); // face down — the card back leaves the cell

    if (args.reduced) {
      // One short, complete path: cell → slot, flipping on the way.
      const at = s(emergeDelayMs(i, t));
      master.to(proxy, {autoAlpha: 1, duration: s(t.emergeMs) * 0.4, ease: 'power1.out'}, at);
      master.to(proxy, {
        x: target.left, y: target.top, scale: endScale, rotation: 0,
        duration: s(t.emergeMs) + s(t.travelMs), ease: 'power2.out',
      }, at);
      master.to(flip, {rotateY: 0, duration: s(t.travelMs) * t.flipPortion, ease: 'power1.inOut'}, at + s(t.emergeMs) * 0.5);
      return;
    }

    // ── EMERGE: out of the cell and into the fan ───────────────────────────
    const emergeAt = s(emergeDelayMs(i, t));
    master.to(proxy, {autoAlpha: 1, duration: s(t.emergeMs) * 0.34, ease: 'power1.out'}, emergeAt);
    master.to(proxy, {
      x: fanX, y: fanY, scale: fanScale, rotation: offset.rot,
      duration: s(t.emergeMs),
      ease: 'power2.out', // leaves the cell with impulse, arrives at rest
    }, emergeAt);

    // ── TRAVEL: the fan moves into the slots (+ HOLD, by the start offset) ──
    const travelAt = s(travelDelayMs(i, count, t));
    const travel = s(t.travelMs);
    const lag = travel * t.travelArcLag;
    // Horizontal and vertical are single continuous tweens; the vertical one
    // starts slightly later, which bows the path without any waypoint.
    master.to(proxy, {x: target.left, duration: travel, ease: 'power1.inOut'}, travelAt);
    master.to(proxy, {y: target.top, duration: travel - lag, ease: 'power2.inOut'}, travelAt + lag);
    master.to(proxy, {scale: endScale, rotation: 0, duration: travel, ease: 'power2.inOut'}, travelAt);
    master.to(flip, {
      rotateY: 0,
      duration: travel * t.flipPortion,
      ease: 'power2.inOut',
    }, travelAt + travel * t.flipStartPortion);
  });

  // A degenerate set (no proxies) must still resolve the scene.
  if (master.duration() === 0) {
    master.to({}, {duration: 0.01});
  }
  return {kill: () => master.kill()};
}

/**
 * HANDOFF: the landed proxies crossfade out — called AFTER the modal has
 * released its real cards, so each real card is already fading in UNDERNEATH
 * its proxy (one continuous materialization, never a swap).
 */
export function runHydroHandoff(args: {
  proxies: ReadonlyArray<HTMLElement>,
  t: HydroDrawTimings,
  onDone: () => void,
}): HydroFlightHandle {
  const tl = gsap.timeline({onComplete: args.onDone});
  if (args.proxies.length === 0) {
    tl.to({}, {duration: 0.01});
    return {kill: () => tl.kill()};
  }
  args.proxies.forEach((proxy, i) => {
    tl.to(proxy, {autoAlpha: 0, duration: s(args.t.handoffMs), ease: 'power1.out'}, s(i * 45));
  });
  return {kill: () => tl.kill()};
}

/** Teardown visual: a short fade of whatever is still in the air. */
export function runHydroFadeOut(args: {
  els: ReadonlyArray<HTMLElement>,
  onDone: () => void,
}): HydroFlightHandle {
  const tl = gsap.timeline({onComplete: args.onDone});
  if (args.els.length === 0) {
    tl.to({}, {duration: 0.01});
    return {kill: () => tl.kill()};
  }
  tl.to(args.els as Array<HTMLElement>, {autoAlpha: 0, duration: s(150), ease: 'power1.out'}, 0);
  return {kill: () => tl.kill()};
}
