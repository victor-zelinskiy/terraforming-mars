/*
 * CARD DEAL DIRECTOR — the GSAP staging layer of the console deal cinematic.
 *
 * Owns ONE timeline per deal: deck rise → staged card flights (arc +
 * back→face half-flip + rotation settle) → per-card landing handoff
 * (proxy fades OUT while the real slot fades IN — `onReveal(i)` fires
 * slightly before touchdown so the materialization reads continuous) →
 * deck exit → `onDone`.
 *
 * Contracts (CONSOLE_FOUNDATION.md §7 + the fork motion system):
 *  - transform/opacity ONLY — geometry (per-proxy height) is SET once
 *    before the first frame, never animated;
 *  - every duration resolves through `motionMs()` (speed presets scale the
 *    whole choreography); reduced-motion never reaches this module — the
 *    sequence layer (cardDealSequence.ts) short-circuits it;
 *  - `skip()` / `kill()` are idempotent and always leave the scene in the
 *    final state (all slots revealed) — any gamepad press mid-deal skips;
 *  - a safety timeout hard-finishes the deal even if rAF stalls (hidden
 *    tab), so a held slot can never strand the prompt.
 *
 * The proxies fly on a fixed full-viewport layer (ConsoleCardDealLayer)
 * clipped by the console-native overflow policy — flights can never create
 * scrollable overflow.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {
  CARD_NATURAL_W, DECK_SCALE, DealTimings, dealTotalMs, flightPlan, HANDOFF_AT, REVEAL_AT,
} from '@/client/console/cardDeal/cardDealModel';

export type DealTargetRect = {left: number, top: number, width: number, height: number};

export type RunDealArgs = {
  /** One proxy element per card, in card order (ConsoleCardDealLayer). */
  proxies: ReadonlyArray<HTMLElement>,
  /** Where each card lands — the real card's viewport rect (same order). */
  targets: ReadonlyArray<DealTargetRect>,
  /** The deck stack element (card backs at the bottom of the screen). */
  deck: HTMLElement | null,
  /** Deck anchor in viewport coordinates (stack centre-top). */
  deckAnchor: {x: number, y: number},
  timings: DealTimings,
  /** Un-hide the real slot for card i (rides the slot's own CSS fade-in). */
  onReveal: (index: number) => void,
  /** The whole cinematic is over (fires exactly once, even on skip/kill). */
  onDone: () => void,
};

export type DealHandle = {
  /** Jump to the final state instantly (any input mid-deal). */
  skip: () => void,
  /** Tear down without visual guarantees (unmount path). */
  kill: () => void,
};

export function runCardDealTimeline(args: RunDealArgs): DealHandle {
  const {proxies, targets, deck, deckAnchor, timings, onReveal, onDone} = args;
  const s = (baseMs: number) => motionMs(baseMs) / 1000;

  const revealed = new Set<number>();
  let finished = false;

  // Safety: a stalled rAF (hidden tab / driver hiccup) can never strand the
  // prompt behind held slots — hard-finish shortly after the planned end.
  // (setTimeout callbacks are never synchronous, so referencing `finish`
  // from here is safe.)
  const safety = setTimeout(() => finish(true), motionMs(dealTotalMs(proxies.length, timings)) + 1500);

  const revealAll = () => {
    for (let i = 0; i < targets.length; i++) {
      if (!revealed.has(i)) {
        revealed.add(i);
        onReveal(i);
      }
    }
  };

  const tl = gsap.timeline({paused: true});

  const finish = (viaSkip: boolean) => {
    if (finished) {
      return;
    }
    finished = true;
    clearTimeout(safety);
    revealAll();
    if (viaSkip) {
      tl.kill();
      // Proxies/deck belong to the v-if'd layer — the host unmounts it on
      // done; still zero them out so a skip never flashes a stray flyer.
      gsap.set(proxies as Array<HTMLElement>, {autoAlpha: 0});
      if (deck !== null) {
        gsap.set(deck, {autoAlpha: 0});
      }
    }
    onDone();
  };

  // ── Deck: rise in at the anchor, small "ready" pulse ─────────────────
  const deckDelay = s(timings.deckRiseMs);
  if (deck !== null) {
    gsap.set(deck, {x: deckAnchor.x, y: deckAnchor.y + 18, xPercent: -50, autoAlpha: 0});
    tl.to(deck, {y: deckAnchor.y, autoAlpha: 1, duration: deckDelay, ease: 'power2.out'}, 0);
    tl.to(deck, {scale: 1.05, duration: s(timings.deckPulseMs) / 2, yoyo: true, repeat: 1, ease: 'power1.inOut'}, deckDelay);
  }

  // ── Per-card flight ──────────────────────────────────────────────────
  proxies.forEach((proxy, i) => {
    const rect = targets[i];
    if (rect === undefined) {
      return;
    }
    const plan = flightPlan(i, timings);
    const at = s(plan.delayMs);
    const flight = s(timings.flightMs);
    const scaleTo = rect.width / CARD_NATURAL_W;
    // Geometry is SET once (height/width are never animated): the proxy is
    // natural-width; height matches the target's aspect so the landed proxy
    // covers the real card exactly.
    const naturalH = rect.height / scaleTo;
    const startX = deckAnchor.x - (CARD_NATURAL_W * DECK_SCALE) / 2;
    const startY = deckAnchor.y;

    gsap.set(proxy, {
      width: CARD_NATURAL_W,
      height: naturalH,
      x: startX,
      y: startY,
      scale: DECK_SCALE,
      rotation: plan.rotZFrom,
      autoAlpha: 0,
      transformOrigin: 'top left',
    });

    const flip = proxy.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flip !== null) {
      gsap.set(flip, {rotationY: 180});
    }

    tl.set(proxy, {autoAlpha: 1}, at);
    // The arc is composed from two channels: X eases in-out (lateral slide),
    // Y launches fast and lands soft — together they trace a rising arc
    // without a path plugin. Scale settles with a slight overshoot (the
    // physical "card lands on the table" beat).
    tl.to(proxy, {x: rect.left, duration: flight, ease: 'power1.inOut'}, at);
    tl.to(proxy, {y: rect.top, duration: flight, ease: 'power3.out'}, at);
    tl.to(proxy, {scale: scaleTo, duration: flight, ease: 'back.out(1.2)'}, at);
    tl.to(proxy, {rotation: 0, duration: flight * 0.8, ease: 'power2.out'}, at);
    if (flip !== null) {
      tl.to(flip, {rotationY: 0, duration: flight * timings.flipPortion, ease: 'power2.inOut'}, at);
    }
    // Handoff: the REAL slot starts fading in just before touchdown, the
    // proxy fades out right after — one continuous materialization.
    tl.call(() => {
      if (!revealed.has(i)) {
        revealed.add(i);
        onReveal(i);
      }
    }, undefined, at + flight * REVEAL_AT);
    tl.to(proxy, {autoAlpha: 0, duration: s(timings.handoffMs), ease: 'power1.out'}, at + flight * HANDOFF_AT);
  });

  // ── Deck exit after the last launch ──────────────────────────────────
  if (deck !== null && proxies.length > 0) {
    const lastLaunch = s(flightPlan(proxies.length - 1, timings).delayMs);
    tl.to(deck, {y: deckAnchor.y + 22, autoAlpha: 0, duration: s(timings.deckExitMs), ease: 'power2.in'},
      lastLaunch + s(timings.flightMs) * 0.5);
  }

  tl.eventCallback('onComplete', () => finish(false));
  tl.play(0);

  return {
    skip: () => finish(true),
    kill: () => {
      if (!finished) {
        finished = true;
        clearTimeout(safety);
        tl.kill();
      }
    },
  };
}
