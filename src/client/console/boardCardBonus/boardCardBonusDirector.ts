/*
 * BOARD CARD-BONUS DIRECTOR — the GSAP choreography of the "card bonus
 * lifts off the board cell" cinematic (transform/opacity only, clipped
 * app-level stage — see ConsoleBoardCardBonusLayer.vue).
 *
 * Beats:
 *  LIFT    — the cover (the SAME card.webp art as the board icon) rises off
 *            the cell with a slight grow; a calm float loop is the honest
 *            pending pose while the server resolves.
 *  FAN-OUT — multi-card: N covers take over at the hero's exact rect as a
 *            packed stack, travel together to the gather point, then peel
 *            one by one into the reveal modal's exact slot rects, half-
 *            flipping back→face on the way (the deal language).
 *  SINGLE  — one cover flies to the presentation point, flipping mid-
 *            flight; the fullscreen viewer then physically lifts the real
 *            card out of it (the existing zoom FLIP — not this director).
 *  HANDOFF — proxies crossfade out AFTER the real cards are visible.
 *  ABORT   — return (back onto the cell) / absorb (into the fresh tile) /
 *            instant (short fade) — never a stranded cover.
 *
 * All durations resolve through motionMs() (speed presets scale in step);
 * geometry uses top-left transform origins with per-waypoint centre math
 * (the same approach as the trade-fleet / hydro-marker directors).
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {
  BonusSceneTimings, RectLike, coverLiftRise, fanDelayMs,
} from '@/client/console/boardCardBonus/boardCardBonusModel';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/** Deterministic per-cover rotation jitter (no Math.random — resume/test safe). */
function jitterDeg(index: number): number {
  const magnitude = 2 + ((index * 137) % 4); // 2..5
  return (index % 2 === 0 ? -1 : 1) * magnitude;
}

export type BonusCoverHandle = {
  /** The cover's CURRENT visual rect (the proxies take over at it). */
  rect: () => RectLike,
  kill: () => void,
};

/**
 * LIFT + HOVER. The cover element is sized/positioned onto the board
 * icon's exact rect first (same art, same size — frame one is a pixel-
 * perfect takeover), then rises and floats until the transfer takes over.
 */
export function runBonusCoverLift(args: {
  cover: HTMLElement,
  from: RectLike,
  t: BonusSceneTimings,
  reduced: boolean,
  onLifted: () => void,
}): BonusCoverHandle {
  const {cover, from, t} = args;
  gsap.set(cover, {
    width: from.width,
    height: from.height,
    x: from.left,
    y: from.top,
    scale: 1,
    rotation: 0,
    transformOrigin: '50% 50%',
    autoAlpha: 1,
  });
  const rise = coverLiftRise(from.height);
  const tl = gsap.timeline();
  if (args.reduced) {
    tl.to(cover, {y: from.top - rise, scale: 1.25, duration: s(t.liftMs), ease: 'power1.out', onComplete: args.onLifted});
  } else {
    // The separation beat: up + grow + a slight tilt — "taken off the board".
    tl.to(cover, {y: from.top - rise, scale: 1.4, rotation: -4, duration: s(t.liftMs), ease: 'back.out(1.5)', onComplete: args.onLifted});
    if (t.hoverLoopMs > 0) {
      // The honest pending float (killed the moment the transfer takes over).
      tl.to(cover, {y: from.top - rise - 4, duration: s(t.hoverLoopMs / 2), ease: 'sine.inOut', repeat: -1, yoyo: true});
    }
  }
  return {
    rect: () => cover.getBoundingClientRect(),
    kill: () => tl.kill(),
  };
}

export type BonusSceneHandle = {
  kill: () => void,
};

/**
 * MULTI-CARD FAN-OUT: the covers (already stacked at the hero's rect)
 * travel together to the gather point, then peel into the exact reveal
 * slot rects with a stagger, completing the back→face flip on the fan leg.
 * Landing is pixel-perfect: x/y = the slot's card rect at scale 1.
 */
export function runBonusFanOut(args: {
  proxies: ReadonlyArray<HTMLElement>,
  flips: ReadonlyArray<HTMLElement>,
  from: RectLike,
  targets: ReadonlyArray<RectLike>,
  gather: {x: number, y: number},
  t: BonusSceneTimings,
  reduced: boolean,
  onAllLanded: () => void,
}): BonusSceneHandle {
  const {proxies, flips, from, targets, gather, t} = args;
  const fromCx = from.left + from.width / 2;
  const fromCy = from.top + from.height / 2;
  const master = gsap.timeline({onComplete: args.onAllLanded});
  proxies.forEach((proxy, i) => {
    const target = targets[i];
    const flip = flips[i];
    if (target === undefined || flip === undefined) {
      return;
    }
    /*
     * Geometry follows the deal director exactly: the proxy is NATURAL-
     * width (typography/frame proportions stay true — never a stretched
     * box), its height derived from the target's aspect, and the LANDING
     * scale maps it onto the slot's zoomed rect pixel-perfect. The
     * takeover start shrinks it onto the hero cover's visual rect.
     */
    const scaleTo = Math.max(0.05, target.width / CARD_NATURAL_W);
    const naturalH = target.height / scaleTo;
    const startScale = Math.max(0.02, Math.min(scaleTo, from.width / CARD_NATURAL_W));
    const midScale = Math.min(scaleTo, Math.max(startScale, startScale + (scaleTo - startScale) * 0.5));
    // A tiny deterministic stack offset so the packet reads as N covers.
    const stackDx = (i % 2 === 0 ? -1 : 1) * i * 2;
    const stackDy = i * 2;
    gsap.set(proxy, {
      width: CARD_NATURAL_W,
      height: naturalH,
      transformOrigin: 'top left',
      x: fromCx - (CARD_NATURAL_W * startScale) / 2 + stackDx,
      y: fromCy - (naturalH * startScale) / 2 + stackDy,
      scale: startScale,
      rotation: jitterDeg(i),
      autoAlpha: 1,
    });
    gsap.set(flip, {rotateY: 180}); // back showing (the cover art)
    const sub = gsap.timeline();
    if (args.reduced) {
      // Short but full path: straight to the slot, quick flip on the way.
      sub.to(proxy, {
        x: target.left, y: target.top, scale: scaleTo, rotation: 0,
        duration: s(t.fanMs), ease: 'power2.out',
      }, 0);
      sub.to(flip, {rotateY: 0, duration: s(t.fanMs * t.flipPortion), ease: 'power1.inOut'}, 0);
      master.add(sub, s(fanDelayMs(i, t)));
      return;
    }
    // Leg 1 — the packed gather (backs showing, jitter calming down).
    sub.to(proxy, {
      x: gather.x - (CARD_NATURAL_W * midScale) / 2 + stackDx * 0.6,
      y: gather.y - (naturalH * midScale) / 2 + stackDy * 0.6,
      scale: midScale,
      rotation: jitterDeg(i) * 0.4,
      duration: s(t.gatherMs),
      ease: 'power2.inOut',
    }, s(i * t.gatherStaggerMs));
    // Leg 2 — the fan: peel to the exact slot, flip completing mid-leg.
    const fanAt = s(t.gatherMs + fanDelayMs(i, t));
    sub.to(proxy, {
      x: target.left, y: target.top, scale: scaleTo, rotation: 0,
      duration: s(t.fanMs), ease: 'power3.out',
    }, fanAt);
    sub.to(flip, {rotateY: 0, duration: s(t.fanMs * t.flipPortion), ease: 'power2.inOut'}, fanAt + s(t.fanMs * 0.08));
    master.add(sub, 0);
  });
  return {kill: () => master.kill()};
}

/**
 * SINGLE-CARD FLIGHT: the cover flies to the presentation point (centre-
 * screen), growing and flipping back→face mid-flight. `to` is the CENTRE +
 * scale of the pose (the zoom FLIP takes the card from there).
 */
export function runBonusSingleFlight(args: {
  proxy: HTMLElement,
  flip: HTMLElement,
  from: RectLike,
  to: {x: number, y: number, scale: number},
  naturalW: number,
  naturalH: number,
  t: BonusSceneTimings,
  reduced: boolean,
  onArrived: () => void,
}): BonusSceneHandle {
  const {proxy, flip, from, to, naturalW, naturalH, t} = args;
  const fromCx = from.left + from.width / 2;
  const fromCy = from.top + from.height / 2;
  const startScale = Math.max(0.02, Math.min(1, from.width / Math.max(1, naturalW)));
  gsap.set(proxy, {
    width: naturalW,
    height: naturalH,
    transformOrigin: 'top left',
    x: fromCx - (naturalW * startScale) / 2,
    y: fromCy - (naturalH * startScale) / 2,
    scale: startScale,
    rotation: args.reduced ? 0 : -4,
    autoAlpha: 1,
  });
  gsap.set(flip, {rotateY: 180});
  const targetX = to.x - (naturalW * to.scale) / 2;
  const targetY = to.y - (naturalH * to.scale) / 2;
  const tl = gsap.timeline({onComplete: args.onArrived});
  if (args.reduced) {
    tl.to(proxy, {x: targetX, y: targetY, scale: to.scale, duration: s(t.singleFlightMs), ease: 'power1.out'}, 0);
    tl.to(flip, {rotateY: 0, duration: s(t.singleFlightMs * t.flipPortion), ease: 'power1.inOut'}, 0);
    return {kill: () => tl.kill()};
  }
  // A gentle arc: the midpoint rides above the straight line (the card is
  // presented UP into view, not dragged across the table).
  const midScale = startScale + (to.scale - startScale) * 0.55;
  const midX = (fromCx + to.x) / 2 - (naturalW * midScale) / 2;
  const midY = Math.min(fromCy, to.y) - 56 - (naturalH * midScale) / 2;
  tl.to(proxy, {x: midX, y: midY, scale: midScale, rotation: 3, duration: s(t.singleFlightMs * 0.55), ease: 'power2.in'}, 0);
  tl.to(proxy, {x: targetX, y: targetY, scale: to.scale, rotation: 0, duration: s(t.singleFlightMs * 0.45), ease: 'power3.out'}, '>');
  // The flip completes right around the apex — the face leads the arrival.
  tl.to(flip, {rotateY: 0, duration: s(t.singleFlightMs * t.flipPortion), ease: 'power2.inOut'}, s(t.singleFlightMs * 0.18));
  return {kill: () => tl.kill()};
}

/**
 * HANDOFF: the landed proxies crossfade out — called AFTER the overlay has
 * released its held static cards, so the real card is already fading in
 * UNDERNEATH each proxy (one continuous materialization, never a swap).
 */
export function runBonusHandoff(args: {
  proxies: ReadonlyArray<HTMLElement>,
  t: BonusSceneTimings,
  onDone: () => void,
}): BonusSceneHandle {
  const tl = gsap.timeline({onComplete: args.onDone});
  args.proxies.forEach((proxy, i) => {
    tl.to(proxy, {autoAlpha: 0, duration: s(args.t.handoffMs), ease: 'power1.out'}, s(i * 40));
  });
  return {kill: () => tl.kill()};
}

/**
 * ABORT visual — the honest recall. `return`: the cover flies back onto
 * its cell (the board icon is restored by the layer as it lands);
 * `absorb`: the cover sinks into the freshly-placed tile; `instant`: a
 * short fade (teardown). Always resolves `onDone` (kill-safe via GSAP's
 * onComplete — the layer also clears on its own safety path).
 */
export function runBonusAbortVisual(args: {
  els: ReadonlyArray<HTMLElement>,
  mode: 'return' | 'absorb' | 'instant',
  cell: RectLike | undefined,
  t: BonusSceneTimings,
  onDone: () => void,
}): BonusSceneHandle {
  const {els, mode, cell, t} = args;
  const tl = gsap.timeline({onComplete: args.onDone});
  if (els.length === 0) {
    tl.to({}, {duration: 0.01});
    return {kill: () => tl.kill()};
  }
  if (mode === 'return' && cell !== undefined) {
    // Back onto the cell: land at the exact icon rect, then a quick fade
    // (the restored icon appears underneath — same art, seamless).
    els.forEach((el) => {
      tl.to(el, {x: cell.left, y: cell.top, scale: 1, rotation: 0, duration: s(t.returnMs), ease: 'power2.inOut'}, 0);
    });
    tl.to(els as Array<HTMLElement>, {autoAlpha: 0, duration: s(90), ease: 'power1.out'});
    return {kill: () => tl.kill()};
  }
  if (mode === 'absorb' && cell !== undefined) {
    const cx = cell.left + cell.width / 2;
    const cy = cell.top + cell.height / 2;
    els.forEach((el) => {
      const w = el.offsetWidth || 16;
      const h = el.offsetHeight || 20;
      tl.to(el, {
        x: cx - (w * 0.2) / 2, y: cy - (h * 0.2) / 2, scale: 0.2, rotation: 0,
        duration: s(t.absorbMs), ease: 'power2.in',
      }, 0);
    });
    tl.to(els as Array<HTMLElement>, {autoAlpha: 0, duration: s(110), ease: 'power1.in'}, s(t.absorbMs * 0.5));
    return {kill: () => tl.kill()};
  }
  tl.to(els as Array<HTMLElement>, {autoAlpha: 0, duration: s(120), ease: 'power1.out'}, 0);
  return {kill: () => tl.kill()};
}
