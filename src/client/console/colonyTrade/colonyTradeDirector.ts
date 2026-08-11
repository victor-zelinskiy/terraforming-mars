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
import {TRADE_COVER_FLIGHT_MS, TRADE_COVER_LIFT_MS} from '@/client/console/colonyTrade/colonyTradeModel';

/** BASE ms → seconds, through the fork-wide speed preset. */
const s = (baseMs: number) => motionMs(baseMs) / 1000;

/**
 * How long a released real card takes to become opaque — the CSS transition in
 * `console_board_bonus.less` (`.con-reveal--bonus-mode … .card-container`).
 * The handoff waits it out before dissolving the proxy above it.
 */
export const CARD_RELEASE_MS = 160;

export type TradeDirectorHandle = {kill: () => void};

export type RectLike = {left: number, top: number, width: number, height: number};

/** Deterministic per-cover tilt (the fork bans Math.random in plans). */
function jitterDeg(index: number): number {
  const magnitude = 1.2 + ((index * 137) % 5) * 0.5;
  return (index % 2 === 0 ? -1 : 1) * magnitude;
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
  /**
   * Deliver the card FACE DOWN — the colony-bonus cover does not turn in the
   * air, because the card is opened ON THE TABLE afterwards (the reveal modal
   * plays the turn in its zone). The handoff then lands a face-down cover on a
   * face-down card: one object, no contradiction, and the turn reads as the
   * player opening the bonus rather than as something already decided in
   * mid-flight.
   */
  faceDown?: boolean,
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
    if (args.faceDown !== true) {
      tl.to(flip, {rotateY: 0, duration: s(120), ease: 'power2.out'}, 0);
    }
    return {kill: () => tl.kill()};
  }

  /*
   * THE SEPARATION GRAMMAR (the board-bonus lift, spoken for the colony
   * track). The card is BORN as the exact card back printed on the reward
   * cell, and the launch is three distinct legs the eye can follow:
   *
   *   1 · SEPARATION — it rises STRAIGHT UP off its cell while growing to a
   *       readable hover size; the FLIP begins the moment the growth does
   *       (a card that turns as it comes towards you), with a touch of
   *       forward pitch and depth push. Unhurried on purpose — this leg is
   *       the whole feel of «карта отделилась от трека».
   *   2 · TRAVEL — the same object continues to its slot: two-channel arc,
   *       the remaining growth, controlled deceleration, the turn finishing
   *       on the way.
   *   3 · SETTLE — a soft contact pulse at the slot's exact size.
   */
  const liftMs = TRADE_COVER_LIFT_MS;
  const travelMs = TRADE_COVER_FLIGHT_MS - liftMs;
  const liftAt = 0;
  const travelAt = s(liftMs);
  const travel = s(travelMs);
  // The hover size: well past «a glyph», well short of the landed card — the
  // separation reads as ITS OWN event before the journey starts. STRICTLY
  // MONOTONIC: the card only ever grows towards its landing size (capped at
  // 92 % of it) — the bare ×1.6 arm once inflated a medium-sized source PAST
  // the slot, and a card that balloons at the apex and then shrinks into its
  // seat is exactly the «резко и неприятно» read.
  const hoverScale = startScale < landScale ?
    Math.max(startScale * 1.02,
      Math.min(Math.max(startScale * 1.6, startScale + (landScale - startScale) * 0.45), landScale * 0.92)) :
    startScale * 1.04;
  const liftPose = centre(fromCx, fromCy - (24 + 42 * hoverScale), hoverScale);

  // ── 1 · SEPARATION ──────────────────────────────────────────────────────
  tl.to(proxy, {x: liftPose.x, y: liftPose.y, duration: s(liftMs), ease: 'power2.out'}, liftAt);
  tl.to(proxy, {scale: hoverScale, duration: s(liftMs), ease: 'power2.out'}, liftAt);
  tl.to(proxy, {rotation: jitterDeg(args.index) * 0.35, duration: s(liftMs), ease: 'sine.out'}, liftAt);
  if (args.faceDown !== true) {
    // The turn RIDES the growth: it starts with the lift and completes on the
    // travel's first half — never a flip after a teleport.
    const turnDur = s(liftMs) + travel * 0.5;
    tl.to(flip, {rotateY: 0, duration: turnDur, ease: 'power2.inOut'}, liftAt);
    tl.to(flip, {rotateX: -9, duration: s(liftMs), ease: 'sine.out'}, liftAt);
    tl.to(flip, {rotateX: 0, duration: travel * 0.6, ease: 'sine.inOut'}, travelAt);
    tl.to(flip, {z: 46, duration: s(liftMs), ease: 'power2.out'}, liftAt);
    tl.to(flip, {z: 0, duration: travel, ease: 'power2.inOut'}, travelAt);
    tl.call(() => proxy.classList.add('con-coltrade-proxy--revealing'), undefined, s(liftMs) + travel * 0.18);
  }

  // ── 2 · TRAVEL ──────────────────────────────────────────────────────────
  tl.to(proxy, {x: landX, duration: travel, ease: 'power1.inOut'}, travelAt);
  tl.to(proxy, {y: landY, duration: travel, ease: 'power3.out'}, travelAt);
  tl.to(proxy, {rotation: 0, duration: travel * 0.7, ease: 'power2.out'}, travelAt);
  tl.to(proxy, {scale: landScale, duration: travel * 0.78, ease: 'power2.out'}, travelAt);

  // ── 3 · SETTLE — a soft contact at the slot's exact size. ──────────────
  tl.to(proxy, {scale: landScale * 1.025, duration: s(110), ease: 'power2.out'}, travelAt + travel * 0.78);
  tl.to(proxy, {scale: landScale, duration: s(150), ease: 'back.out(1.6)'}, travelAt + travel * 0.78 + s(110));
  return {kill: () => tl.kill()};
}

/**
 * The proxies dissolve over the released real cards (never a swap).
 *
 * ⚠️ THE LEAD-IN IS LOAD-BEARING. Releasing the cards flips
 * `.con-reveal--bonus-held` off, and the card's own CSS transition fades it in
 * over `CARD_RELEASE_MS`. Fading the proxy out at the SAME instant runs two
 * opposing opacity ramps over the same pixels: mid-way both are ~50 %
 * transparent and the board shows through — the reveal visibly BLINKS as the
 * cards arrive. The proxy therefore holds fully opaque until the real card
 * underneath is opaque, and only then dissolves — the crossfade the design
 * always described ("never a swap") instead of a dip through nothing.
 */
export function runTradeCoversHandoff(args: {
  proxies: ReadonlyArray<HTMLElement>,
  reduced: boolean,
  onDone: () => void,
}): TradeDirectorHandle {
  const tl = gsap.timeline({onComplete: args.onDone});
  const dur = s(args.reduced ? 90 : 260);
  // Mirrors the `.con-reveal--bonus-mode` card release transition (160ms) in
  // console_board_bonus.less — keep the two in step if either changes.
  const leadIn = args.reduced ? 0 : s(CARD_RELEASE_MS);
  if (args.proxies.length === 0) {
    tl.to({}, {duration: dur});
  } else {
    tl.to(args.proxies, {autoAlpha: 0, duration: dur, ease: 'power2.inOut'}, leadIn);
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
