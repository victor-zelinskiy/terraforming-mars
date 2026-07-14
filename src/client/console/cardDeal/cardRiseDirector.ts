/*
 * CARD RISE DIRECTOR — the draft → research phase-transition scene (the
 * GSAP twin of cardDealDirector, same layer, same handle contract).
 *
 * The drafted pile physically BECOMES the research row:
 *
 *  A. ARRIVAL   — the auto-passed last card(s) fly from the dealer's deck
 *                 into their tray slot, flipping back→face ("the neighbour
 *                 passed you the final card").
 *  B. SET BEAT  — the completed pile acknowledges itself (the tray pulses,
 *                 the label flips to «НАБОР СОБРАН») and holds a readable
 *                 beat.
 *  C. LIFT-OFF  — proxies materialize over every pile card (the real tray
 *                 slots empty underneath in the same breath) and the whole
 *                 group comes off the table, staggered.
 *  D. FLIGHTS   — each card arcs DOWN into its research-row slot, GROWING
 *                 from pile scale to row scale, left → right.
 *  E. FRAME     — the buy modal's chrome materializes AROUND the landed
 *                 row (onFrameReveal — the host releases its table-beat).
 *  F. HANDOFF   — the proxies dissolve into the real interactive cards.
 *
 * Contracts (identical to the deal director): transform/opacity only,
 * geometry set once; durations through motionMs(); skip()/kill() always
 * land the final state; a safety timeout survives a stalled rAF; reduced
 * motion never reaches this module (the sequence short-circuits it).
 */

import {gsap} from 'gsap';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {motionMs} from '@/client/components/motion/motionTokens';
import {
  CARD_NATURAL_W, DECK_SCALE, riseFlightDelayMs, RiseTimings, riseTotalMs,
} from '@/client/console/cardDeal/cardDealModel';
import {DealHandle, DealTargetRect} from '@/client/console/cardDeal/cardDealDirector';

export type RunRiseArgs = {
  /** One proxy element per card, in card order (ConsoleCardDealLayer). */
  proxies: ReadonlyArray<HTMLElement>,
  /** Where each card LANDS — the research-row slot rects (same order). */
  targets: ReadonlyArray<DealTargetRect>,
  /** Where each card RISES FROM — the tray slot rects (same order). */
  sources: ReadonlyArray<DealTargetRect>,
  /** Indices of cards that ARRIVE first (deck → tray, flipping). */
  arrivals: ReadonlyArray<number>,
  /** The deck stack element (shown only when something arrives). */
  deck: HTMLElement | null,
  deckAnchor: {x: number, y: number},
  timings: RiseTimings,
  /** An arrival landed on the tray (reveal its tray slot + pulse). */
  onArrivalLanded: (index: number) => void,
  /** The full set is on the tray — the «НАБОР СОБРАН» beat. */
  onSetComplete: () => void,
  /** Proxies stand over the pile — the tray empties underneath. */
  onLiftOff: () => void,
  /** The frame materialization beat (host releases the table view). */
  onFrameReveal: () => void,
  /** Un-hide the real research-row card i (rides the slot's own fade). */
  onReveal: (index: number) => void,
  /** The whole scene is over (fires exactly once, even on skip/kill). */
  onDone: () => void,
};

export function runCardRiseTimeline(args: RunRiseArgs): DealHandle {
  const {proxies, targets, sources, arrivals, deck, deckAnchor, timings, onReveal, onDone} = args;
  const s = (baseMs: number) => motionMs(baseMs) / 1000;

  const revealed = new Set<number>();
  let finished = false;
  let frameRevealed = false;

  const arrivalSet = new Set(arrivals);
  const revealFrameOnce = () => {
    if (!frameRevealed) {
      frameRevealed = true;
      args.onFrameReveal();
    }
  };
  const revealAll = () => {
    for (let i = 0; i < targets.length; i++) {
      if (!revealed.has(i)) {
        revealed.add(i);
        onReveal(i);
      }
    }
  };

  const safety = setTimeout(() => finish(true), motionMs(riseTotalMs(proxies.length, arrivals.length, timings)) + 1500);
  const tl = gsap.timeline({paused: true});

  const finish = (viaSkip: boolean) => {
    if (finished) {
      return;
    }
    finished = true;
    clearTimeout(safety);
    revealFrameOnce();
    revealAll();
    if (viaSkip) {
      tl.kill();
      gsap.set(proxies as Array<HTMLElement>, {autoAlpha: 0});
      if (deck !== null) {
        gsap.set(deck, {autoAlpha: 0});
      }
    }
    onDone();
  };

  const scaleOf = (rect: DealTargetRect) => rect.width / CARD_NATURAL_W;

  // Geometry is SET once per proxy: natural width, height from the TARGET
  // aspect (source and target are the same card frame — identical ratio).
  proxies.forEach((proxy, i) => {
    const target = targets[i];
    const source = sources[i];
    if (target === undefined || source === undefined) {
      return;
    }
    const naturalH = target.height / scaleOf(target);
    const arriving = arrivalSet.has(i);
    // Match the rem-authored deck stack's size on the TV profile.
    const deckScale = DECK_SCALE * conUiScale();
    gsap.set(proxy, {
      width: CARD_NATURAL_W,
      height: naturalH,
      x: arriving ? deckAnchor.x - (CARD_NATURAL_W * deckScale) / 2 : source.left,
      y: arriving ? deckAnchor.y : source.top,
      scale: arriving ? deckScale : scaleOf(source),
      rotation: 0,
      autoAlpha: 0,
      transformOrigin: 'top left',
    });
    const flip = proxy.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flip !== null) {
      gsap.set(flip, {rotationY: arriving ? 180 : 0});
    }
  });

  // ── A. Arrivals: deck rise → flight(s) into the tray, flipping ───────
  let arrivalsEnd = 0;
  if (arrivals.length > 0) {
    if (deck !== null) {
      gsap.set(deck, {x: deckAnchor.x, y: deckAnchor.y + 18, xPercent: -50, autoAlpha: 0});
      tl.to(deck, {y: deckAnchor.y, autoAlpha: 1, duration: s(140), ease: 'power2.out'}, 0);
    }
    arrivals.forEach((index, k) => {
      const proxy = proxies[index];
      const source = sources[index];
      if (proxy === undefined || source === undefined) {
        return;
      }
      const at = s(140) + k * s(timings.arrivalStaggerMs);
      const flight = s(timings.arrivalFlightMs);
      tl.set(proxy, {autoAlpha: 1}, at);
      tl.to(proxy, {x: source.left, duration: flight, ease: 'power1.inOut'}, at);
      tl.to(proxy, {y: source.top, duration: flight, ease: 'power3.out'}, at);
      tl.to(proxy, {scale: scaleOf(source), duration: flight, ease: 'back.out(1.2)'}, at);
      const flip = proxy.querySelector<HTMLElement>('.con-deal-proxy__flip');
      if (flip !== null) {
        tl.to(flip, {rotationY: 0, duration: flight * 0.55, ease: 'power2.inOut'}, at);
      }
      // The real tray mini-card materializes under the landed proxy and the
      // proxy hands off (deal language) — the whole pile is REAL for the
      // set-complete pulse (a fixed proxy would not scale with it).
      tl.call(() => args.onArrivalLanded(index), undefined, at + flight * 0.9);
      tl.to(proxy, {autoAlpha: 0, duration: s(timings.handoffMs), ease: 'power1.out'}, at + flight * 0.95);
      arrivalsEnd = Math.max(arrivalsEnd, at + flight);
    });
    if (deck !== null) {
      tl.to(deck, {y: deckAnchor.y + 22, autoAlpha: 0, duration: s(160), ease: 'power2.in'}, arrivalsEnd * 0.7);
    }
    arrivalsEnd += s(timings.arrivalSettleMs);
  }

  // ── B. The set beat: the pile acknowledges itself, then a hold ───────
  tl.call(() => args.onSetComplete(), undefined, arrivalsEnd);
  const liftStart = arrivalsEnd + s(timings.pulseMs) + s(timings.setHoldMs);

  // ── C→D. Lift-off + flights into the research row ────────────────────
  tl.call(() => {
    // Proxies materialize over the pile; the tray empties in the same
    // breath (Vue-managed holds — the patch lands under opaque proxies).
    proxies.forEach((proxy) => gsap.set(proxy, {autoAlpha: 1}));
    args.onLiftOff();
  }, undefined, liftStart);

  let flightsEnd = liftStart;
  proxies.forEach((proxy, i) => {
    const target = targets[i];
    if (target === undefined) {
      return;
    }
    const liftAt = liftStart + i * s(timings.liftStaggerMs);
    const tilt = (i % 2 === 0 ? -1 : 1) * (1.2 + (i * 137) % 3);
    tl.to(proxy, {y: `-=14`, scale: `*=1.05`, rotation: tilt, duration: s(timings.liftMs), ease: 'power2.out'}, liftAt);
    // riseFlightDelayMs already folds the lift duration in — flights start
    // strictly after their card's own lift settles (stagger 75 > 40).
    const at = liftStart + s(riseFlightDelayMs(i, timings));
    const flight = s(timings.flightMs);
    tl.to(proxy, {x: target.left, duration: flight, ease: 'power1.inOut'}, at);
    tl.to(proxy, {y: target.top, duration: flight, ease: 'power2.inOut'}, at);
    tl.to(proxy, {scale: scaleOf(target), duration: flight, ease: 'back.out(1.15)'}, at);
    tl.to(proxy, {rotation: 0, duration: flight * 0.75, ease: 'power2.out'}, at);
    flightsEnd = Math.max(flightsEnd, at + flight);
  });

  // ── E→F. Frame materializes around the row, proxies dissolve ─────────
  const frameAt = flightsEnd + 0.04;
  tl.call(revealFrameOnce, undefined, frameAt);
  const handoffAt = frameAt + s(timings.frameMs) * 0.8;
  proxies.forEach((proxy, i) => {
    tl.call(() => {
      if (!revealed.has(i)) {
        revealed.add(i);
        onReveal(i);
      }
    }, undefined, handoffAt + i * 0.02);
    tl.to(proxy, {autoAlpha: 0, duration: s(timings.handoffMs), ease: 'power1.out'}, handoffAt + i * 0.02);
  });

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
