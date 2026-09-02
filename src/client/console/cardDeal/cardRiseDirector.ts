/*
 * CARD RISE DIRECTOR — the draft → research phase-transition scene (the
 * GSAP twin of cardDealDirector, same layer, same handle contract).
 *
 * The drafted pile physically BECOMES the research row:
 *
 *  A. ARRIVAL   — the auto-passed last card(s) glide in from the RECEIVE
 *                 LANE (the neighbour who passed them — the same physical
 *                 origin every passed packet enters from), flipping
 *                 back→face, and brake softly into their shelf seat.
 *  B. SET BEAT  — the completed pile acknowledges itself (the label flips
 *                 to «НАБОР СОБРАН», the shelf ring warms once) and holds
 *                 a readable beat.
 *  C→D. THE PEEL — proxies materialize over every pile card (the real tray
 *                 slots empty underneath in the same breath) and the pile
 *                 un-stacks from its TOP — the RIGHT end, the newest card —
 *                 into the row's right end, right → left. The direction is
 *                 GEOMETRY, not taste: every flight then crosses only EMPTY
 *                 slots. A left→right fill sent each card sliding across
 *                 its already-landed neighbours at row altitude (the
 *                 measured «налезают друг на друга»), and no z-order makes
 *                 that read clean. Each card's small lift blends straight
 *                 into its own carry (never group-lift → hover → launch),
 *                 landings are cadenced, and the eye ends on the LEFT card
 *                 — exactly where the cursor will stand.
 *  E. FRAME     — the buy modal's chrome materializes AROUND the landing
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
  CARD_NATURAL_W, DECK_SCALE, RiseTimings, riseTotalMs,
} from '@/client/console/cardDeal/cardDealModel';
import {addCardCarry} from '@/client/console/cardDeal/cardCarry';
import {DealHandle, DealTargetRect} from '@/client/console/cardDeal/cardDealDirector';

export type RunRiseArgs = {
  /** One proxy element per card, in card order (ConsoleCardDealLayer). */
  proxies: ReadonlyArray<HTMLElement>,
  /** Where each card LANDS — the research-row slot rects (same order). */
  targets: ReadonlyArray<DealTargetRect>,
  /** Where each card RISES FROM — the tray slot rects (same order). */
  sources: ReadonlyArray<DealTargetRect>,
  /** Indices of cards that ARRIVE first (lane → tray, flipping). */
  arrivals: ReadonlyArray<number>,
  /**
   * The physical origin an ARRIVING card enters from — the receive-side
   * lane (the neighbour who passed it). The deck anchor is only the
   * fallback: a deck popping in over the HUD to deal a card the NEIGHBOUR
   * passed was the old, wrong story.
   */
  arrivalOrigin?: {x: number, y: number},
  /** The deck stack element — zeroed on skip only; the rise never shows it. */
  deck: HTMLElement | null,
  deckAnchor: {x: number, y: number},
  timings: RiseTimings,
  /** An arrival landed on the tray (reveal its tray slot + settle accent). */
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
  const {proxies, targets, sources, arrivals, deck, timings, onReveal, onDone} = args;
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
  const ui = conUiScale();
  const arrivalOrigin = args.arrivalOrigin ?? args.deckAnchor;

  // THE PEEL ORDER — rightmost target first (see the header). Computed up
  // front so the setup pass can assign draw order: the earlier a card
  // departs, the further along (larger, nearer the viewer) it is whenever a
  // trailing neighbour brushes past — it must paint on top.
  const peelRank = new Map<number, number>();
  proxies
    .map((_, i) => i)
    .filter((i) => targets[i] !== undefined && sources[i] !== undefined)
    .sort((a, b) => targets[b].left - targets[a].left)
    .forEach((i, k) => peelRank.set(i, k));

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
    // An arriving card enters at the shared deal scale (the passed-packet
    // grammar), centred on the lane point.
    const deckScale = DECK_SCALE * ui;
    gsap.set(proxy, {
      width: CARD_NATURAL_W,
      height: naturalH,
      x: arriving ? arrivalOrigin.x - (CARD_NATURAL_W * deckScale) / 2 : source.left,
      y: arriving ? arrivalOrigin.y - (naturalH * deckScale) / 2 : source.top,
      scale: arriving ? deckScale : scaleOf(source),
      rotation: 0,
      autoAlpha: 0,
      transformOrigin: 'top left',
      zIndex: proxies.length - (peelRank.get(i) ?? i),
    });
    const flip = proxy.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flip !== null) {
      gsap.set(flip, {rotationY: arriving ? 180 : 0});
    }
  });

  // ── A. Arrivals: the neighbour's card glides in from the lane, flipping,
  //      and brakes softly into its seat (deceleration belongs to arrivals —
  //      one power2.out clock, distance-scaled duration, no deck sprite). ──
  let arrivalsEnd = 0;
  if (arrivals.length > 0) {
    arrivals.forEach((index, k) => {
      const proxy = proxies[index];
      const source = sources[index];
      if (proxy === undefined || source === undefined) {
        return;
      }
      const naturalH = source.height / scaleOf(source);
      const deckScale = DECK_SCALE * ui;
      const from = {
        x: arrivalOrigin.x - (CARD_NATURAL_W * deckScale) / 2,
        y: arrivalOrigin.y - (naturalH * deckScale) / 2,
        scale: deckScale,
      };
      const to = {x: source.left, y: source.top, scale: scaleOf(source)};
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const flight = s(timings.arrivalFlightMs) * Math.max(0.72, Math.min(1.15, 0.6 + dist / (1500 * ui)));
      // A short anticipation beat: the stage settles, THEN the neighbour's
      // card slides in — an instant entry read as popping out of the edge.
      const at = s(120) + k * s(timings.arrivalStaggerMs);
      tl.set(proxy, {autoAlpha: 1}, at);
      addCardCarry(tl, at, proxy, {
        naturalH,
        from, to,
        duration: flight,
        sag: Math.min(dist * 0.05, 36 * ui),
        tilt: Math.max(-1.6, Math.min(1.6, (to.x - from.x) / (500 * ui))),
        ease: 'power2.out',
      });
      const flip = proxy.querySelector<HTMLElement>('.con-deal-proxy__flip');
      if (flip !== null) {
        tl.to(flip, {rotationY: 0, duration: flight * 0.5, ease: 'power2.inOut'}, at + flight * 0.06);
      }
      // No-dip handoff: the real tray mini-card SNAPS visible under the
      // still-opaque proxy at touchdown (the slot has no opacity transition),
      // then the proxy fades ON TOP — the combined image never dims.
      tl.call(() => args.onArrivalLanded(index), undefined, at + flight);
      tl.to(proxy, {autoAlpha: 0, duration: s(120), ease: 'power1.out'}, at + flight + 0.001);
      arrivalsEnd = Math.max(arrivalsEnd, at + flight);
    });
    arrivalsEnd += s(timings.arrivalSettleMs);
  }

  // ── B. The set beat: the pile acknowledges itself, then a hold ───────
  tl.call(() => args.onSetComplete(), undefined, arrivalsEnd);
  const liftStart = arrivalsEnd + s(timings.pulseMs) + s(timings.setHoldMs);

  // ── C→D. The peel: proxies stand over the pile (the tray empties in the
  //      same breath), then the pile un-stacks right → left. Each card's
  //      own lift blends into its own carry — one gesture per card, never
  //      group-lift → hover → launch (the dead air the measured clump had).
  tl.call(() => {
    proxies.forEach((proxy) => gsap.set(proxy, {autoAlpha: 1}));
    args.onLiftOff();
  }, undefined, liftStart);

  // The LANDINGS are the events (the planCardArrival lesson): one readable
  // touchdown at a time. A card owed a later landing simply LAUNCHES later
  // (its lift rides its own carry), so nothing hovers waiting for its slot.
  const landGap = s(timings.flightStaggerMs * 2);
  const liftDur = s(timings.liftMs);
  let prevLand = liftStart;
  let firstLand = Number.POSITIVE_INFINITY;
  let lastLand = liftStart;
  const byPeelOrder = [...peelRank.entries()].sort((a, b) => a[1] - b[1]);
  byPeelOrder.forEach(([i, k]) => {
    const proxy = proxies[i];
    const target = targets[i];
    const source = sources[i];
    if (proxy === undefined || target === undefined || source === undefined) {
      return;
    }
    const sF = scaleOf(source) * 1.02;
    const sT = scaleOf(target);
    const naturalH = target.height / sT;
    const from = {x: source.left, y: source.top - 10 * ui, scale: sF};
    const to = {x: target.left, y: target.top, scale: sT};
    const dist = Math.hypot(
      (to.x + (CARD_NATURAL_W * sT) / 2) - (from.x + (CARD_NATURAL_W * sF) / 2),
      (to.y + naturalH * sT / 2) - (from.y + naturalH * sF / 2));
    const dur = s(timings.flightMs) * Math.max(0.78, Math.min(1.18, 0.66 + dist / (1500 * ui)));
    // First peel launches right after the set beat; each later card lands
    // one cadence step after its leader — and its whole gesture (lift +
    // carry) is scheduled back from ITS OWN landing.
    const land = Math.max(liftStart + liftDur * 0.8 + dur, prevLand + landGap);
    prevLand = land;
    firstLand = Math.min(firstLand, land);
    lastLand = Math.max(lastLand, land);
    const carryAt = land - dur;
    const liftAt = carryAt - liftDur * 0.8;
    tl.to(proxy, {y: `-=${10 * ui}`, scale: '*=1.02', duration: liftDur, ease: 'power2.out'}, liftAt);
    addCardCarry(tl, carryAt, proxy, {
      naturalH,
      from, to,
      duration: dur,
      // A small per-order spread keeps consecutive arcs from tracing one
      // line; no divergent fan is needed — the peel never crosses a landed
      // card by construction.
      sag: Math.min(dist * 0.05, 40 * ui) + k * 6 * ui,
      tilt: Math.max(-2, Math.min(2,
        ((to.x + (CARD_NATURAL_W * sT) / 2) - (from.x + (CARD_NATURAL_W * sF) / 2)) / (420 * ui))),
    });
    // No-dip handoff at THIS card's own touchdown: the real card SNAPS
    // visible under the still-opaque proxy (the draft row has no opacity
    // transition), the proxy fades ON TOP — never a crossfade dip, never a
    // whole-row swap after the fact.
    tl.call(() => {
      if (!revealed.has(i)) {
        revealed.add(i);
        onReveal(i);
      }
    }, undefined, land);
    tl.to(proxy, {autoAlpha: 0, duration: s(120), ease: 'power1.out'}, land + 0.001);
  });

  // ── E. The frame materializes AS the first card touches down — the
  // chrome grows around an arriving row, not after a finished one. ──────
  const frameAt = Number.isFinite(firstLand) ?
    Math.max(liftStart + liftDur, firstLand - s(70)) : liftStart + liftDur;
  tl.call(revealFrameOnce, undefined, frameAt);
  // The timeline's own tail covers the last proxy's fade — completion can
  // never race a still-fading handoff.
  tl.set({}, {}, lastLand + s(160));

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
