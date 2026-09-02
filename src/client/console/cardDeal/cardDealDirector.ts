/*
 * CARD DEAL DIRECTOR — the GSAP staging layer of the console deal cinematic.
 *
 * Owns ONE timeline per deal: deck rise → staged card flights → per-card
 * landing handoff (proxy fades OUT while the real slot fades IN —
 * `onReveal(i)` fires slightly before touchdown so the materialization
 * reads continuous) → deck exit → `onDone`.
 *
 * THE FLIGHT IS ONE CARRY (cardCarry.ts — the tabletop grammar every other
 * deck flight already speaks): position, scale and rotation ride ONE eased
 * clock along a low arc, centre-true (a `top left` origin + a scale change
 * slides the centre — that is what read as «cards appear crookedly»), the
 * launch jitter settling in flight. The old per-axis mix (x power1.inOut /
 * y power3.out / scale back.out) is exactly the «ease salad» the carry was
 * written to retire — the back.out balloon at the landing included.
 *
 * THE LANDINGS ARE THE EVENTS (the planCardArrival lesson): flights are
 * distance-scaled, so touchdowns are re-spaced to the dealer's own cadence
 * by keeping a card LONGER IN THE AIR — launches stay the quick cascade
 * off the deck, landings arrive one readable beat at a time.
 *
 * THE DEALER CAN BE A REAL PILE: with `deck: null` + `originScale`, no
 * synthetic stack sprite rises — the cards leave straight from the live
 * pile at its honest on-screen size and grow over the whole approach
 * («взять карту с той колоды и поднести к себе»).
 *
 * Contracts (docs/CONSOLE_FOUNDATION.md §7 + the fork motion system):
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
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {motionMs} from '@/client/components/motion/motionTokens';
import {addCardCarry} from '@/client/console/cardDeal/cardCarry';
import {
  CARD_NATURAL_W, DECK_SCALE, DealTimings, dealTotalMs, flightPlan, HANDOFF_AT, REVEAL_AT,
} from '@/client/console/cardDeal/cardDealModel';

export type DealTargetRect = {left: number, top: number, width: number, height: number};

export type RunDealArgs = {
  /** One proxy element per card, in card order (ConsoleCardDealLayer). */
  proxies: ReadonlyArray<HTMLElement>,
  /** Where each card lands — the real card's viewport rect (same order). */
  targets: ReadonlyArray<DealTargetRect>,
  /** The deck stack element (card backs at the origin); null = the origin
   *  is a REAL on-screen pile that needs no synthetic stand-in. */
  deck: HTMLElement | null,
  /** Deck anchor in viewport coordinates (stack centre-top / pile centre). */
  deckAnchor: {x: number, y: number},
  /** The origin's honest card scale (a bare-pile origin) — see the header.
   *  Absent → the shared DECK_SCALE presentation. */
  originScale?: number,
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

  const ui = conUiScale();
  // The visual deck stack is rem-authored (it grows with the TV profile);
  // the proxy's departure scale must match or the lift-off pops. A bare
  // real-pile origin states its own scale instead.
  const deckScale = args.originScale ?? DECK_SCALE * ui;

  // ── Deck: rise in at the anchor, small "ready" pulse ─────────────────
  const deckDelay = s(timings.deckRiseMs);
  if (deck !== null) {
    gsap.set(deck, {x: deckAnchor.x, y: deckAnchor.y + 18, xPercent: -50, autoAlpha: 0});
    tl.to(deck, {y: deckAnchor.y, autoAlpha: 1, duration: deckDelay, ease: 'power2.out'}, 0);
    tl.to(deck, {scale: 1.05, duration: s(timings.deckPulseMs) / 2, yoyo: true, repeat: 1, ease: 'power1.inOut'}, deckDelay);
  }
  // No sprite → no rise/pulse beat to wait out: the launch plan's built-in
  // lead collapses to a short anticipation (the pile is already there).
  const lead = deck !== null ? 0 : s(timings.deckRiseMs + timings.deckPulseMs) - s(80);

  // ── Per-card flight: one carry per card, landings on the cadence ─────
  const landGap = s(timings.staggerMs);
  let prevLand = 0;
  let lastLaunch = 0;
  let lastFlightDur = s(timings.flightMs);
  proxies.forEach((proxy, i) => {
    const rect = targets[i];
    if (rect === undefined) {
      return;
    }
    const plan = flightPlan(i, timings);
    const launch = Math.max(0, s(plan.delayMs) - lead);
    const scaleTo = rect.width / CARD_NATURAL_W;
    // Geometry is SET once (height/width are never animated): the proxy is
    // natural-width; height matches the target's aspect so the landed proxy
    // covers the real card exactly.
    const naturalH = rect.height / scaleTo;
    const from = {
      x: deckAnchor.x - (CARD_NATURAL_W * deckScale) / 2,
      // With the sprite the proxy leaves from the stack's own box (top
      // anchored at the anchor, exactly like the sprite); a bare pile
      // origin centres the card on the pile point.
      y: deck !== null ? deckAnchor.y : deckAnchor.y - (naturalH * deckScale) / 2,
      scale: deckScale,
    };
    const to = {x: rect.left, y: rect.top, scale: scaleTo};
    const dist = Math.hypot(
      (to.x + (CARD_NATURAL_W * scaleTo) / 2) - (from.x + (CARD_NATURAL_W * deckScale) / 2),
      (to.y + naturalH * scaleTo / 2) - (from.y + naturalH * deckScale / 2));
    // Distance-scaled travel; the landing cadence is enforced by keeping a
    // card LONGER in the air (never by launching late — the quick cascade
    // off the deck is what reads as dealing).
    let flight = s(timings.flightMs) * Math.max(0.8, Math.min(1.2, 0.65 + dist / (1600 * ui)));
    let land = launch + flight;
    if (i > 0 && land < prevLand + landGap) {
      flight += prevLand + landGap - land;
      land = prevLand + landGap;
    }
    prevLand = land;
    lastLaunch = launch;
    lastFlightDur = flight;

    gsap.set(proxy, {
      width: CARD_NATURAL_W,
      height: naturalH,
      x: from.x,
      y: from.y,
      scale: deckScale,
      rotation: plan.rotZFrom,
      autoAlpha: 0,
      transformOrigin: 'top left',
      // Depth reads as progress: the leading (further-along, larger) card
      // paints over its trailing followers out of the shared origin.
      zIndex: proxies.length - i,
    });

    const flip = proxy.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flip !== null) {
      gsap.set(flip, {rotationY: 180});
    }

    tl.set(proxy, {autoAlpha: 1}, launch);
    // ONE low-arc carry on ONE clock: fast off the deck, braking into the
    // slot (deceleration belongs to arrivals); the launch jitter decays in
    // flight, a light bank leans the card into its travel.
    addCardCarry(tl, launch, proxy, {
      naturalH,
      from, to,
      duration: flight,
      sag: Math.min(dist * 0.045, 36 * ui),
      rotFrom: plan.rotZFrom,
      tilt: Math.max(-1.2, Math.min(1.2, (to.x - from.x) / (700 * ui))),
      ease: 'power2.out',
    });
    if (flip !== null) {
      tl.to(flip, {rotationY: 0, duration: flight * timings.flipPortion, ease: 'power2.inOut'}, launch + flight * 0.08);
    }
    // Handoff: the REAL slot starts fading in just before touchdown, the
    // proxy fades out right after — one continuous materialization.
    tl.call(() => {
      if (!revealed.has(i)) {
        revealed.add(i);
        onReveal(i);
      }
    }, undefined, launch + flight * REVEAL_AT);
    tl.to(proxy, {autoAlpha: 0, duration: s(timings.handoffMs), ease: 'power1.out'}, launch + flight * HANDOFF_AT);
  });

  // ── Deck exit after the last launch ──────────────────────────────────
  if (deck !== null && proxies.length > 0) {
    tl.to(deck, {y: deckAnchor.y + 22, autoAlpha: 0, duration: s(timings.deckExitMs), ease: 'power2.in'},
      lastLaunch + lastFlightDur * 0.5);
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
