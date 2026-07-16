/*
 * DECK-DRAW DIRECTOR — the GSAP choreography of the console "cards come off
 * the top-bar project deck" cinematic. Timings/geometry come from the pure
 * deckDrawModel; this module only moves elements.
 *
 * The physical language mirrors the deal / board-bonus directors so every
 * card in this fork flies the same way:
 *  · the proxy is NATURAL-width (CARD_NATURAL_W) with `transformOrigin:
 *    'top left'`, so a landing scale maps it onto a real slot pixel-perfect;
 *  · the arc is composed from two channels (lateral `power1.inOut` + vertical
 *    `power3.out`) — no path plugin, and it reads as weight, not a wobble;
 *  · the flip RIDES its leg (one object on one curve), never a separate beat;
 *  · rotation jitter is deterministic (the fork bans Math.random in plans).
 */

import {gsap} from 'gsap';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {DeckDrawTimings, DrawBeat, RectLike} from './deckDrawModel';

/** BASE ms → seconds, through the fork-wide speed preset. */
const s = (baseMs: number) => motionMs(baseMs) / 1000;

/** Deterministic per-card tilt (−4°..+4°), stable across re-runs. */
function jitterDeg(index: number): number {
  const magnitude = 1.5 + ((index * 137) % 5) * 0.6;
  return (index % 2 === 0 ? -1 : 1) * magnitude;
}

export type DeckDrawHandle = {kill: () => void};

/** Everything one card's beat needs to be played. */
export type BeatEls = {
  /** The flyer root (fixed-positioned, `perspective` owner). */
  proxy: HTMLElement,
  /** The 3D flip chassis (`.con-deal-proxy__flip`). */
  flip: HTMLElement,
};

export type BeatTargets = {
  /** Where the card pauses to be judged (centre + scale). */
  inspect: {x: number, y: number, scale: number},
  /** A matched card's resting place in the hold zone (centre + scale). */
  hold?: {x: number, y: number, scale: number},
  /** A discarded card's landing rect on the tray pile. */
  tray?: RectLike,
};

/**
 * The deck's own top-card rect (where every card is born) and the natural
 * height the proxies are boxed at.
 */
export type DeckAnchor = {rect: RectLike, naturalH: number};

/**
 * Play ONE card's beat: peel off the deck → travel → (flip + judge) → route
 * to its destination.
 *
 * `onDrawn` fires as the card commits to leaving the deck (the counter ticks
 * there — the number and the physical stack must tell the same story), and
 * `onLanded` when it has arrived.
 */
export function runDeckDrawBeat(args: {
  beat: DrawBeat,
  els: BeatEls,
  deck: DeckAnchor,
  targets: BeatTargets,
  t: DeckDrawTimings,
  reduced: boolean,
  onDrawn: () => void,
  onLanded: () => void,
}): DeckDrawHandle {
  const {beat, els, deck, targets, t, reduced} = args;
  const {proxy, flip} = els;

  const startScale = Math.max(0.02, deck.rect.width / CARD_NATURAL_W);
  const naturalH = deck.naturalH;
  const deckCx = deck.rect.left + deck.rect.width / 2;
  const deckCy = deck.rect.top + deck.rect.height / 2;

  // Centre-anchored placement helper: the proxy is top-left-origin, so a
  // centre pose resolves to (cx - w*scale/2, cy - h*scale/2).
  const at = (cx: number, cy: number, scale: number) => ({
    x: cx - (CARD_NATURAL_W * scale) / 2,
    y: cy - (naturalH * scale) / 2,
  });

  const born = at(deckCx, deckCy, startScale);
  gsap.set(proxy, {
    width: CARD_NATURAL_W,
    height: naturalH,
    transformOrigin: 'top left',
    x: born.x,
    y: born.y,
    scale: startScale,
    rotation: jitterDeg(beat.index) * 0.5,
    autoAlpha: 1,
  });
  gsap.set(flip, {rotateY: 180}); // every card is born face DOWN

  const tl = gsap.timeline({onComplete: args.onLanded});

  // ── 1 · The peel: the top card separates from the stack ───────────────
  // A short lift + slight grow off the deck's own position, so the card is
  // seen leaving the pile rather than appearing beside it.
  const peel = at(deckCx, deckCy - 10 - 14 * startScale, startScale * 1.14);
  tl.to(proxy, {
    x: peel.x, y: peel.y, scale: startScale * 1.14,
    duration: s(t.peelMs), ease: 'power2.out',
  }, 0);
  tl.call(args.onDrawn, undefined, s(t.peelMs * 0.55));

  const travelAt = s(t.peelMs);
  const travel = s(beat.travelMs);

  // ── DISCARD: a single quick flight deck → tray, face DOWN the whole way ─
  // No inspect, no flip — it flows past as part of the stream and lands on
  // the discard pile. Several are in the air at once (the plan starts them
  // `streamStepMs` apart), so what the player reads is the COUNT, not the card.
  if (beat.kind === 'discard') {
    if (targets.tray !== undefined) {
      const tray = targets.tray;
      const trayScale = Math.max(0.04, tray.width / CARD_NATURAL_W);
      // A slight arc (up-and-over) so the stream reads as thrown cards, not a
      // straight slide; the jitter keeps the pile looking hand-stacked.
      tl.to(proxy, {x: tray.left, duration: travel, ease: 'power1.inOut'}, travelAt);
      tl.to(proxy, {y: tray.top, duration: travel, ease: 'power2.in'}, travelAt);
      tl.to(proxy, {scale: trayScale, duration: travel, ease: 'power2.inOut'}, travelAt);
      tl.to(proxy, {rotation: jitterDeg(beat.index) * 0.9, duration: travel, ease: 'power2.out'}, travelAt);
      // It lands ON the pile: the real tray back materializes under it, so the
      // proxy fades on contact rather than vanishing in mid-air.
      tl.to(proxy, {autoAlpha: 0, duration: s(reduced ? 60 : 90), ease: 'power1.out'}, travelAt + travel);
    } else {
      // No believable tray anchor (degenerate layout): dive out honestly.
      tl.to(proxy, {autoAlpha: 0, y: '+=40', duration: travel, ease: 'power1.in'}, travelAt);
    }
    return {kill: () => tl.kill()};
  }

  // ── MATCH / plain: travel to the inspect point (a plain draw flies
  //    straight to its hold slot — nothing to judge) ─────────────────────
  const flying = beat.kind === 'plain' && targets.hold !== undefined ? targets.hold : targets.inspect;
  const flyTo = at(flying.x, flying.y, flying.scale);
  // The two-channel arc: lateral glide + a launch-fast / land-soft vertical.
  tl.to(proxy, {x: flyTo.x, duration: travel, ease: 'power1.inOut'}, travelAt);
  tl.to(proxy, {y: flyTo.y, duration: travel, ease: 'power3.out'}, travelAt);
  tl.to(proxy, {scale: flying.scale, duration: travel, ease: 'power2.out'}, travelAt);
  tl.to(proxy, {rotation: 0, duration: travel * 0.8, ease: 'power2.out'}, travelAt);
  if (beat.flipPortion > 0) {
    // The flip rides the travel — the card turns over as it comes at you.
    tl.to(flip, {
      rotateY: 0,
      duration: travel * beat.flipPortion,
      ease: 'power2.inOut',
    }, travelAt + travel * 0.1);
  }

  if (beat.kind === 'plain') {
    // Nothing to judge: a small settle and the card simply waits.
    tl.to(proxy, {scale: flying.scale * 0.98, duration: s(90), ease: 'power2.out'}, travelAt + travel);
    return {kill: () => tl.kill()};
  }

  // ── The verdict beat at the inspect point (MATCH) ─────────────────────
  const judgeAt = travelAt + travel;
  if (!reduced) {
    // A found card is CONFIRMED, calmly: a light scale settle + a one-shot
    // sweep across its frame (the layer's CSS owns the sweep; here it is the
    // class toggle that starts it). Never a badge, never a particle.
    tl.call(() => proxy.classList.add('con-deckdraw-proxy--found'), undefined, judgeAt);
    tl.to(proxy, {scale: flying.scale * 1.05, duration: s(120), ease: 'power2.out'}, judgeAt);
    tl.to(proxy, {scale: flying.scale, duration: s(150), ease: 'power2.inOut'}, judgeAt + s(120));
  }

  // ── The route: inspect point → hold slot ──────────────────────────────
  const routeAt = judgeAt + s(beat.inspectMs);
  const route = s(beat.routeMs);
  if (targets.hold !== undefined) {
    const hold = at(targets.hold.x, targets.hold.y, targets.hold.scale);
    tl.to(proxy, {x: hold.x, duration: route, ease: 'power1.inOut'}, routeAt);
    tl.to(proxy, {y: hold.y, duration: route, ease: 'power2.inOut'}, routeAt);
    tl.to(proxy, {scale: targets.hold.scale, duration: route, ease: 'back.out(1.05)'}, routeAt);
    tl.to(proxy, {rotation: 0, duration: route * 0.7, ease: 'power2.out'}, routeAt);
    return {kill: () => tl.kill()};
  }

  // No believable hold slot: dive out honestly rather than fake a landing.
  tl.to(proxy, {autoAlpha: 0, y: '+=40', duration: s(140), ease: 'power1.in'}, routeAt);
  return {kill: () => tl.kill()};
}

/**
 * The FINISH beat: the search is over. The held cards get one clean, quiet
 * confirmation (a small lift + settle, in place) before the reveal frame
 * assembles around them. This is the scene's calmest, largest moment.
 */
export function runDeckDrawSettle(args: {
  proxies: ReadonlyArray<HTMLElement>,
  t: DeckDrawTimings,
  reduced: boolean,
  onDone: () => void,
}): DeckDrawHandle {
  const {proxies, t} = args;
  const tl = gsap.timeline({onComplete: args.onDone});
  if (args.reduced || proxies.length === 0) {
    tl.to({}, {duration: s(t.settleMs)});
    return {kill: () => tl.kill()};
  }
  proxies.forEach((proxy, i) => {
    tl.to(proxy, {y: '-=6', duration: s(t.settleMs * 0.4), ease: 'power2.out'}, i * s(50));
    tl.to(proxy, {y: '+=6', duration: s(t.settleMs * 0.6), ease: 'power2.inOut'}, i * s(50) + s(t.settleMs * 0.4));
  });
  return {kill: () => tl.kill()};
}

/**
 * The ASSEMBLE leg: the held cards fly from the hold zone into the reveal
 * modal's REAL slot rects. Landing is pixel-perfect (x/y = the slot's card
 * rect at the mapped scale), so the frame can materialize around cards that
 * already stand exactly where the modal wants them.
 */
export function runDeckDrawAssemble(args: {
  proxies: ReadonlyArray<HTMLElement>,
  targets: ReadonlyArray<RectLike>,
  naturalHs: ReadonlyArray<number>,
  t: DeckDrawTimings,
  reduced: boolean,
  onAllLanded: () => void,
}): DeckDrawHandle {
  const {proxies, targets, naturalHs, t} = args;
  const master = gsap.timeline({onComplete: args.onAllLanded});
  const legMs = args.reduced ? t.routeMs : t.routeMs * 1.25;
  proxies.forEach((proxy, i) => {
    const target = targets[i];
    if (target === undefined) {
      return;
    }
    const scaleTo = Math.max(0.05, target.width / CARD_NATURAL_W);
    const naturalH = naturalHs[i] ?? target.height / scaleTo;
    // Re-box to the target's aspect so the landing is exact even if the
    // modal renders the card at a different aspect than the hold pose did.
    gsap.set(proxy, {height: naturalH});
    master.to(proxy, {
      x: target.left, y: target.top, scale: scaleTo, rotation: 0,
      duration: s(legMs), ease: 'power2.inOut',
    }, i * s(args.reduced ? 0 : 60));
  });
  if (proxies.length === 0) {
    master.to({}, {duration: s(legMs)});
  }
  return {kill: () => master.kill()};
}

/**
 * The HANDOFF: the real cards have already faded in UNDER the proxies (the
 * overlay released them), so the proxies dissolve above them — one continuous
 * materialization, never a swap.
 */
export function runDeckDrawHandoff(args: {
  proxies: ReadonlyArray<HTMLElement>,
  t: DeckDrawTimings,
  onDone: () => void,
}): DeckDrawHandle {
  const tl = gsap.timeline({onComplete: args.onDone});
  if (args.proxies.length === 0) {
    tl.to({}, {duration: s(args.t.handoffMs)});
    return {kill: () => tl.kill()};
  }
  tl.to(args.proxies, {autoAlpha: 0, duration: s(args.t.handoffMs), ease: 'power1.out'}, 0);
  return {kill: () => tl.kill()};
}

/** The deck's own reaction: the stack settles a hair as a card leaves it. */
export function runDeckSettleTick(deckEl: HTMLElement, reduced: boolean): void {
  if (reduced) {
    return;
  }
  gsap.fromTo(deckEl,
    {y: -1.5},
    {y: 0, duration: s(220), ease: 'power2.out', overwrite: 'auto'});
}
