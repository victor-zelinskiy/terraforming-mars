/*
 * COLONY-TRADE DIRECTOR — the GSAP choreography of the trade-reward
 * cinematic's two custom pieces:
 *
 *   · CARD COVERS: each drawn card physically leaves ITS OWN area of the
 *     colony tile (the «ТОРГОВАТЬ» value cell for the trade income, the
 *     «БОНУС» cell for a colony bonus) as a separate face-down flyer, arcs
 *     to the reveal modal's real slot, and tumbles open in flight — the same
 *     premium 3D turn the deal / deck-draw scenes speak, so every card in
 *     the fork flies one language. One cover per real card, staggered, never
 *     "one cover with a ×N".
 *
 *   · THE WHITE MARKER RESET: after every reward is confirmed, the colony's
 *     track marker steps LEFT cell by cell to its reset position (a calm
 *     rail glide with a per-cell impulse), and SETTLES — the readouts morph
 *     only on that landing.
 *
 * Geometry conventions mirror deckDrawDirector: natural-width proxies with
 * `transformOrigin: 'top left'`, centre poses resolved to top-left, landing
 * scale = targetRect.width / CARD_NATURAL_W (pixel-perfect handoff).
 */

import {gsap} from 'gsap';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {TRADE_COVER_FLIGHT_MS} from '@/client/console/colonyTrade/colonyTradeModel';

/** BASE ms → seconds, through the fork-wide speed preset. */
const s = (baseMs: number) => motionMs(baseMs) / 1000;

export type TradeDirectorHandle = {kill: () => void};

export type RectLike = {left: number, top: number, width: number, height: number};

/** Deterministic per-cover tilt (the fork bans Math.random in plans). */
function jitterDeg(index: number): number {
  const magnitude = 1.2 + ((index * 137) % 5) * 0.5;
  return (index % 2 === 0 ? -1 : 1) * magnitude;
}

/**
 * The shared premium 3D turn (the deal/deck-draw language): rotateY 180→0
 * with a forward tumble + depth push; the settle overshoot rides SCALE,
 * never the turn axis (an angular overshoot would flash the mirrored back).
 */
function addTurn(tl: gsap.core.Timeline, o: {
  proxy: HTMLElement,
  flip: HTMLElement,
  at: number,
  dur: number,
  poseScale: number,
}): void {
  const {proxy, flip, at, dur, poseScale} = o;
  const half = dur * 0.5;
  tl.to(flip, {rotateY: 0, duration: dur, ease: 'power3.out'}, at);
  tl.to(flip, {rotateX: -11, duration: half, ease: 'sine.inOut'}, at);
  tl.to(flip, {rotateX: 0, duration: half, ease: 'sine.inOut'}, at + half);
  tl.to(flip, {z: 64, duration: half, ease: 'power2.out'}, at);
  tl.to(flip, {z: 0, duration: half, ease: 'power2.inOut'}, at + half);
  tl.call(() => proxy.classList.add('con-coltrade-proxy--revealing'), undefined, at + dur * 0.46);
  tl.to(proxy, {scale: poseScale * 1.04, duration: dur * 0.62, ease: 'power2.out'}, at);
  tl.to(proxy, {scale: poseScale, duration: s(190), ease: 'back.out(1.4)'}, at + dur * 0.62);
}

/**
 * ONE cover's flight: born AT the source area (matching its small rect —
 * a separation from the tile, never an appearance beside it), a launch pop
 * toward the viewer, the two-channel arc to the target, and the tumble-open
 * riding the leg. `onLanded` fires when the cover rests in the slot rect.
 */
export function runTradeCoverFlight(args: {
  proxy: HTMLElement,
  flip: HTMLElement,
  index: number,
  from: RectLike,
  /** The reveal slot's card rect (multi) — pixel-perfect top-left landing. */
  toRect?: RectLike,
  /** A centre pose (single-card presentation) when there is no slot. */
  toCentre?: {x: number, y: number, scale: number},
  naturalH: number,
  delayMs: number,
  reduced: boolean,
  onLanded: () => void,
}): TradeDirectorHandle {
  const {proxy, flip, from, naturalH, reduced} = args;
  const startScale = Math.max(0.02, from.width / CARD_NATURAL_W);
  const fromCx = from.left + from.width / 2;
  const fromCy = from.top + from.height / 2;

  const centre = (cx: number, cy: number, scale: number) => ({
    x: cx - (CARD_NATURAL_W * scale) / 2,
    y: cy - (naturalH * scale) / 2,
  });

  const born = centre(fromCx, fromCy, startScale);
  gsap.set(proxy, {
    width: CARD_NATURAL_W,
    height: naturalH,
    transformOrigin: 'top left',
    x: born.x,
    y: born.y,
    scale: startScale,
    rotation: jitterDeg(args.index) * 0.6,
    autoAlpha: 1,
  });
  gsap.set(flip, {rotateY: 180}); // born face DOWN — the tile shows a card back

  // Landing pose.
  let landX: number;
  let landY: number;
  let landScale: number;
  if (args.toRect !== undefined) {
    landScale = Math.max(0.05, args.toRect.width / CARD_NATURAL_W);
    landX = args.toRect.left;
    landY = args.toRect.top;
  } else if (args.toCentre !== undefined) {
    landScale = args.toCentre.scale;
    const pose = centre(args.toCentre.x, args.toCentre.y, landScale);
    landX = pose.x;
    landY = pose.y;
  } else {
    // No believable destination — dissolve honestly, never a fake landing.
    const tl = gsap.timeline({delay: s(args.delayMs), onComplete: args.onLanded});
    tl.to(proxy, {autoAlpha: 0, y: '+=24', duration: s(160), ease: 'power1.in'});
    return {kill: () => tl.kill()};
  }

  const tl = gsap.timeline({delay: s(args.delayMs), onComplete: args.onLanded});

  if (reduced) {
    tl.to(proxy, {x: landX, y: landY, scale: landScale, rotation: 0, duration: s(140), ease: 'power2.out'}, 0);
    tl.to(flip, {rotateY: 0, duration: s(120), ease: 'power2.out'}, 0);
    return {kill: () => tl.kill()};
  }

  // ── 1 · The LIFT-OFF pop: the cover separates from its cell ────────────
  const popMs = 130;
  const popPose = centre(fromCx, fromCy - 8 - 10 * startScale, startScale * 1.35);
  tl.to(proxy, {x: popPose.x, y: popPose.y, scale: startScale * 1.35, duration: s(popMs), ease: 'power2.out'}, 0);

  // ── 2 · The two-channel arc to the slot, the tumble riding the leg ─────
  const travelMs = TRADE_COVER_FLIGHT_MS - popMs;
  const travelAt = s(popMs);
  const travel = s(travelMs);
  tl.to(proxy, {x: landX, duration: travel, ease: 'power1.inOut'}, travelAt);
  tl.to(proxy, {y: landY, duration: travel, ease: 'power3.out'}, travelAt);
  tl.to(proxy, {rotation: 0, duration: travel * 0.8, ease: 'power2.out'}, travelAt);
  addTurn(tl, {
    proxy, flip,
    at: travelAt + travel * 0.32,
    dur: travel * 0.68,
    poseScale: landScale,
  });
  return {kill: () => tl.kill()};
}

/** The proxies dissolve over the released real cards (never a swap). */
export function runTradeCoversHandoff(args: {
  proxies: ReadonlyArray<HTMLElement>,
  reduced: boolean,
  onDone: () => void,
}): TradeDirectorHandle {
  const tl = gsap.timeline({onComplete: args.onDone});
  const dur = s(args.reduced ? 90 : 220);
  if (args.proxies.length === 0) {
    tl.to({}, {duration: dur});
  } else {
    tl.to(args.proxies, {autoAlpha: 0, duration: dur, ease: 'power1.out'}, 0);
  }
  return {kill: () => tl.kill()};
}

/**
 * The WHITE MARKER's reset glide: charge on the current cell, then step LEFT
 * through each passed cell (an even rail rhythm, a light per-cell impulse
 * via `onCellPassed`), and SETTLE on the reset cell with a soft snap.
 * `cells` are the passed cells' rects in glide order (from-1 … to); the
 * marker is a fixed-position dot the layer owns.
 */
export function runColonyTrackGlide(args: {
  marker: HTMLElement,
  fromRect: RectLike,
  cells: ReadonlyArray<RectLike>,
  perCellMs: number,
  reduced: boolean,
  onCellPassed: (i: number) => void,
  onLanded: () => void,
}): TradeDirectorHandle {
  const {marker, fromRect, cells, reduced} = args;
  const size = Math.max(6, Math.min(fromRect.width, fromRect.height));
  const poseAt = (r: RectLike) => ({
    x: r.left + r.width / 2 - size / 2,
    y: r.top + r.height / 2 - size / 2,
  });
  const start = poseAt(fromRect);
  gsap.set(marker, {width: size, height: size, x: start.x, y: start.y, scale: 1, autoAlpha: 1});

  const tl = gsap.timeline({onComplete: args.onLanded});
  if (reduced || cells.length === 0) {
    const last = cells.length > 0 ? poseAt(cells[cells.length - 1]) : start;
    tl.to(marker, {x: last.x, y: last.y, duration: s(120), ease: 'power2.out'}, 0);
    tl.call(() => {
      cells.forEach((_c, i) => args.onCellPassed(i));
    }, undefined, s(120));
    return {kill: () => tl.kill()};
  }

  // Charge: the marker wakes on its cell before it moves.
  tl.to(marker, {scale: 1.35, duration: s(140), ease: 'power2.out'}, 0);
  tl.to(marker, {scale: 1.12, duration: s(110), ease: 'power2.inOut'}, s(140));

  let at = s(260);
  cells.forEach((cell, i) => {
    const pose = poseAt(cell);
    const step = s(args.perCellMs);
    tl.to(marker, {x: pose.x, y: pose.y, duration: step, ease: 'power1.inOut'}, at);
    tl.call(() => args.onCellPassed(i), undefined, at + step * 0.6);
    at += step;
  });

  // The landing snap: decisive, no overshoot past the cell.
  tl.to(marker, {scale: 1, duration: s(180), ease: 'back.out(2.2)'}, at);
  return {kill: () => tl.kill()};
}
