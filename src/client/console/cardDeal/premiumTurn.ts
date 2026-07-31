/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PREMIUM 3D TURN — the ONE way a card opens in this fork.
 *
 * Lifted VERBATIM out of `deckDrawDirector` (where it was written for the
 * deck-draw cinematic) so the batch arrival inside a workspace can play the
 * SAME motion instead of a second, look-alike timeline. That flow was already
 * the reference implementation of «the card tumbles open while it travels»;
 * the only thing that was fork-specific about it was the CSS class the glint
 * rides, which is now a parameter.
 *
 * Four channels, ONE motion:
 *  · rotateY 180 → 0 — the turn, decelerating into the face-up rest (inertia);
 *  · rotateX 0 → −tilt → 0 — a small forward tumble that gives the turn volume;
 *  · z 0 → push → 0 — the card lifts toward the viewer as it opens, then sinks;
 *  · a one-shot light sweep (a CSS `--revealing` class) as the face comes round.
 *
 * ⚠️ The settle overshoot rides SCALE (on the proxy), never rotateY — an
 * angular overshoot past 0°/180° flashes the mirrored backface, which is the
 * one artefact a card turn can never show.
 *
 * The flip chassis is expected to be set up at (re)born time by the caller
 * (`gsap.set(flip, {rotateY: 180})` = back showing); this only animates from
 * there. `preserve-3d` + `backface-visibility: hidden` live on the shared
 * `.con-deal-proxy__flip / __face / __back` chassis, and the PROXY owns the
 * `perspective`, so the Z push reads as true depth.
 */

import {motionMs} from '@/client/components/motion/motionTokens';

/**
 * The slice of a GSAP timeline this primitive needs. Structural on purpose:
 * the module never STARTS a timeline — it layers the turn onto the caller's
 * flight timeline, which is what makes «fly» and «open» one motion instead of
 * two — so it has no reason to depend on the gsap module at all.
 */
export type CardTurnTimeline = {
  to(target: object, vars: object, position?: number | string): unknown;
  call(callback: () => void, params: undefined, position: number | string): unknown;
};

/** BASE ms → seconds, through the fork-wide speed preset. */
const s = (baseMs: number) => motionMs(baseMs) / 1000;

/** The glint class of the deck-draw cinematic's own proxy chassis. */
export const DECKDRAW_TURN_GLINT = 'con-deckdraw-proxy--revealing';

/** The glint class of the SHARED deal proxy (`.con-deal-proxy`). */
export const DEAL_TURN_GLINT = 'con-deal-proxy--revealing';

export type PremiumTurnOptions = {
  /** The flyer root (owns `perspective`; the scale settle rides it). */
  proxy: HTMLElement,
  /** The 3D flip chassis (`.con-deal-proxy__flip`). */
  flip: HTMLElement,
  /** Timeline position the turn starts at (seconds). */
  at: number,
  /** Full duration of the turn (seconds). */
  dur: number,
  /** The scale the card rests at when the turn completes. */
  poseScale: number,
  /** Depth push magnitude (px at scale 1); the hero moment pushes harder. */
  push: number,
  /** The one-shot sweep class for THIS proxy chassis. */
  glintClass?: string,
  /**
   * Whether the turn owns the proxy's SCALE (the overshoot settle). Default
   * true. Set false when the turn is layered onto a leg that is ALREADY
   * tweening scale — two live tweens on one property fight per tick and the
   * card visibly jitters, which is the opposite of the one-object illusion.
   */
  settleScale?: boolean,
  /**
   * Fired once as the face crosses into view (~rotateY 90°) — the first frame
   * the card is readable. Callers use it to swap a «being drawn» status for
   * the real one, exactly when the player can see the answer.
   */
  onFaceShown?: () => void,
};

/**
 * Layer the OPEN onto a flight timeline. Used by the deck-draw PLAIN landing
 * (the turn rides the flight), the deck-draw MATCH's inspect-point moment (the
 * card is turned over in place) and the workspace BATCH arrival.
 */
export function addPremiumTurn(tl: CardTurnTimeline, o: PremiumTurnOptions): void {
  const {proxy, flip, at, dur, poseScale, push} = o;
  const glint = o.glintClass ?? DECKDRAW_TURN_GLINT;
  const half = dur * 0.5;
  // Y — the turn, inertial deceleration into rest.
  tl.to(flip, {rotateY: 0, duration: dur, ease: 'power3.out'}, at);
  // X — a forward tumble peaking at the halfway (card edge-on) point.
  tl.to(flip, {rotateX: -13, duration: half, ease: 'sine.inOut'}, at);
  tl.to(flip, {rotateX: 0, duration: half, ease: 'sine.inOut'}, at + half);
  // Z — depth push toward the viewer, then a soft sink to rest.
  tl.to(flip, {z: push, duration: half, ease: 'power2.out'}, at);
  tl.to(flip, {z: 0, duration: half, ease: 'power2.inOut'}, at + half);
  // The light sweep fires as the face crosses into view (~rotateY 90°).
  tl.call(() => {
    proxy.classList.add(glint);
    o.onFaceShown?.();
  }, undefined, at + dur * 0.46);
  // Settle overshoot on SCALE (safe — never on the turn axis).
  if (o.settleScale !== false) {
    tl.to(proxy, {scale: poseScale * 1.05, duration: dur * 0.62, ease: 'power2.out'}, at);
    tl.to(proxy, {scale: poseScale, duration: s(210), ease: 'back.out(1.5)'}, at + dur * 0.62);
  }
}
