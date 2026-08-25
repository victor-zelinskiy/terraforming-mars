/*
 * CARD CARRY — the ONE in-air card gesture of the console's tabletop
 * grammar: a low quadratic arc on a SINGLE eased clock, with position,
 * scale and rotation all derived from that one progress. Used by the
 * draft pick (strip → tray) and the research rise (tray → buy row) — any
 * flight where a card physically travels between two table places.
 *
 * Why one clock: the measured «дёрганый» beats all came from several
 * independent tweens fighting on unrelated ease curves (x on power1, y on
 * power3, scale on back.out) — the card stops, re-accelerates and balloons
 * at the landing. One progress = one gesture.
 *
 * Why CENTRE-TRUE: the proxies keep `transformOrigin: top left` (the
 * handoff contract — visual top-left equals the GSAP x/y at any scale), so
 * a scale change anchored there slides the card's CENTRE toward the bottom
 * right as it grows. This module drives the CENTRE along the arc and
 * derives the top-left per frame — growth is symmetric, the card tracks
 * the path the eye expects (the deck cinematic's «centre-anchored peel»
 * lesson, applied to travel).
 *
 * Landing truth: an optional `retarget` re-reads the LIVE destination past
 * RETARGET_AT and ramps the difference in over the final stretch — the
 * final-approach discipline (a keep-2 shelf re-fits when the first card
 * lands; a row re-centres when a sibling arrives).
 */

import {gsap} from 'gsap';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';

export type CarryPose = {x: number, y: number, scale: number};

export type CarryArgs = {
  /** The proxy's natural box height (its width is CARD_NATURAL_W). */
  naturalH: number,
  /** Start pose (top-left + scale — the proxy's current analytic pose). */
  from: CarryPose,
  /** End pose (top-left + scale — the measured destination). */
  to: CarryPose,
  /** Seconds (already motion-scaled by the caller). */
  duration: number,
  /** Upward sag of the arc's midpoint (screen px; 0 = straight carry). */
  sag: number,
  /**
   * Banking: `rotFrom` decays a residual take-tilt to 0 (cos-shaped, the
   * pick's lifted card straightens in flight); `tilt` is a full sin bank
   * (0 at both ends, peak mid-flight — a card that leans INTO its travel).
   * Both may be 0.
   */
  rotFrom?: number,
  tilt?: number,
  /** Live destination re-read past RETARGET_AT (top-left + width). */
  retarget?: () => {left: number, top: number, width: number} | undefined,
};

/** Where the live re-read happens (fraction of the carry). */
export const CARRY_RETARGET_AT = 0.8;

const centreOf = (p: CarryPose, naturalH: number) => ({
  x: p.x + (CARD_NATURAL_W * p.scale) / 2,
  y: p.y + (naturalH * p.scale) / 2,
});

/**
 * Add one carry onto `tl` at `position` for `el`. The caller owns the
 * timeline's lifecycle (play/kill/skip); a killed timeline simply stops
 * mid-pose — the caller's finish path lands the final state.
 */
export function addCardCarry(tl: gsap.core.Timeline, position: number, el: HTMLElement, args: CarryArgs): void {
  const {naturalH, duration} = args;
  const fc = centreOf(args.from, naturalH);
  const tc = centreOf(args.to, naturalH);
  const midX = (fc.x + tc.x) / 2;
  const midY = (fc.y + tc.y) / 2 - args.sag;
  // Quadratic control point that makes the curve PASS THROUGH (midX, midY).
  const c = {x: 2 * midX - (fc.x + tc.x) / 2, y: 2 * midY - (fc.y + tc.y) / 2};
  const sF = args.from.scale;
  const sT = args.to.scale;
  const rotFrom = args.rotFrom ?? 0;
  const tilt = args.tilt ?? 0;
  const corr = {x: 0, y: 0, s: 0};
  const drive = {q: 0};
  tl.to(drive, {
    q: 1,
    duration,
    ease: 'power2.inOut',
    onUpdate: () => {
      const p = drive.q;
      const inv = 1 - p;
      const k = p * p * (3 - 2 * p); // smoothstep growth over the whole approach
      const cw = p <= CARRY_RETARGET_AT ? 0 : (p - CARRY_RETARGET_AT) / (1 - CARRY_RETARGET_AT);
      const sc = sF + (sT - sF) * k + corr.s * cw;
      const cx = inv * inv * fc.x + 2 * inv * p * c.x + p * p * tc.x + corr.x * cw;
      const cy = inv * inv * fc.y + 2 * inv * p * c.y + p * p * tc.y + corr.y * cw;
      gsap.set(el, {
        x: cx - (CARD_NATURAL_W * sc) / 2,
        y: cy - (naturalH * sc) / 2,
        scale: sc,
        rotation: rotFrom * (p < 0.85 ? Math.cos(p * Math.PI * 0.5) : 0) + tilt * Math.sin(Math.PI * p),
      });
    },
  }, position);
  if (args.retarget !== undefined) {
    tl.call(() => {
      const live = args.retarget?.();
      if (live !== undefined && live.width > 8) {
        const liveScale = live.width / CARD_NATURAL_W;
        const lc = centreOf({x: live.left, y: live.top, scale: liveScale}, naturalH);
        corr.x = lc.x - tc.x;
        corr.y = lc.y - tc.y;
        corr.s = liveScale - sT;
      }
    }, undefined, position + duration * CARRY_RETARGET_AT);
  }
}
