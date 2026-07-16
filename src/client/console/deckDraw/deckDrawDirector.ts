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

/**
 * The shared PREMIUM 3D TURN: a real physical tumble open. Layers the OPEN
 * onto the flip chassis (`.con-deal-proxy__flip`, `preserve-3d`, backface-
 * hidden; the proxy owns the `perspective`, so a Z push reads as true depth).
 *
 * Four channels, one motion:
 *  · rotateY 180 → 0 — the turn, decelerating into the face-up rest (inertia);
 *  · rotateX 0 → −tilt → 0 — a small forward tumble that gives the turn volume;
 *  · z 0 → push → 0 — the card lifts toward the viewer as it opens, then sinks;
 *  · a one-shot light sweep (CSS `--revealing`) as the face comes round.
 * The settle overshoot rides SCALE (on the proxy), never rotateY — an angular
 * overshoot past 0°/180° would flash the mirrored backface.
 *
 * The flip is set up at (re)born time by the caller (`gsap.set(flip,{rotateY:
 * 180})`); this only animates from there. Used by the PLAIN landing (the turn
 * rides the flight) and the MATCH's inspect-point moment (the card is turned
 * over in place — the "is it the one?" table gesture).
 */
function addPremiumTurn(tl: gsap.core.Timeline, o: {
  proxy: HTMLElement,
  flip: HTMLElement,
  /** Timeline position the turn starts at. */
  at: number,
  /** Full duration of the turn (already in seconds). */
  dur: number,
  /** The scale the card rests at when the turn completes. */
  poseScale: number,
  /** Depth push magnitude (px at scale 1); the hero moment pushes harder. */
  push: number,
}): void {
  const {proxy, flip, at, dur, poseScale, push} = o;
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
  tl.call(() => proxy.classList.add('con-deckdraw-proxy--revealing'), undefined, at + dur * 0.46);
  // Settle overshoot on SCALE (safe — never on the turn axis).
  tl.to(proxy, {scale: poseScale * 1.05, duration: dur * 0.62, ease: 'power2.out'}, at);
  tl.to(proxy, {scale: poseScale, duration: s(210), ease: 'back.out(1.5)'}, at + dur * 0.62);
}

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

  // ── DISCARD: the dealer's gesture, face DOWN the whole way ────────────
  // Two legible movements instead of one blur: the card is PULLED off the
  // deck toward the table (growing closer — the eye registers "a card was
  // really taken"), considered for a blink, then TOSSED onto the pile in a
  // flat arc. Several are in the air at once (the plan starts them
  // `streamStepMs` apart), so the stream still reads as a COUNT — but each
  // card's own motion now reads as a hand at work, not a projectile.
  if (beat.kind === 'discard') {
    if (targets.tray !== undefined) {
      const tray = targets.tray;
      const trayScale = Math.max(0.04, tray.width / CARD_NATURAL_W);
      const pull = s(beat.pullMs ?? beat.travelMs * 0.33);
      const hold = s(beat.holdMs ?? 0);
      const toss = s(beat.tossMs ?? beat.travelMs * 0.67);

      // The dealer's spot: below the deck, nudged toward the tray, with a
      // small deterministic per-card scatter so overlapping cards in the
      // stream never stack on one point — they cascade like a real hand
      // pulling cards to slightly different places.
      const scatterX = ((beat.index * 53) % 3 - 1) * 14;
      const scatterY = ((beat.index * 31) % 3 - 1) * 9;
      const pullScale = Math.max(startScale, trayScale * 0.92);
      const pullCx = deckCx - (deckCx - (tray.left + tray.width / 2)) * 0.22 + scatterX;
      const pullCy = deckCy + deck.rect.height * 1.7 + 12 * pullScale + scatterY;
      const pullPos = at(pullCx, pullCy, pullScale);

      // Leg 1 — the PULL: down off the deck, growing toward the viewer,
      // tilting into the coming toss. Quick grab, decelerating arrival.
      tl.to(proxy, {x: pullPos.x, duration: pull, ease: 'power2.out'}, travelAt);
      tl.to(proxy, {y: pullPos.y, duration: pull, ease: 'power2.out'}, travelAt);
      tl.to(proxy, {scale: pullScale, duration: pull, ease: 'power2.out'}, travelAt);
      tl.to(proxy, {rotation: jitterDeg(beat.index) * 0.5 - 3, duration: pull, ease: 'power2.out'}, travelAt);

      // The blink — the card is "considered": alive (a slight rotation
      // drift), never static, never long enough to read.
      const tossAt = travelAt + pull + hold;
      if (hold > 0) {
        tl.to(proxy, {rotation: jitterDeg(beat.index) * 0.5 + 1, duration: hold, ease: 'sine.inOut'}, travelAt + pull);
      }

      // Leg 2 — the TOSS: a flat sideways throw onto the pile. A touch of
      // rise first (the flick of the wrist), then the drop onto the stack;
      // the spin carries through the flight and lands at the pile's jitter.
      tl.to(proxy, {x: tray.left, duration: toss, ease: 'power1.inOut'}, tossAt);
      tl.to(proxy, {y: pullPos.y - 16, duration: toss * 0.3, ease: 'power2.out'}, tossAt);
      tl.to(proxy, {y: tray.top, duration: toss * 0.7, ease: 'power2.in'}, tossAt + toss * 0.3);
      tl.to(proxy, {scale: trayScale, duration: toss, ease: 'power2.inOut'}, tossAt);
      tl.to(proxy, {rotation: jitterDeg(beat.index) * 0.9, duration: toss, ease: 'power1.out'}, tossAt);
      // It lands ON the pile: the real tray back materializes under it, so the
      // proxy fades on contact rather than vanishing in mid-air.
      tl.to(proxy, {autoAlpha: 0, duration: s(reduced ? 60 : 90), ease: 'power1.out'}, tossAt + toss);
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

  if (beat.kind === 'plain') {
    // PLAIN: the reveal IS the flight. The card tumbles open in 3D as it lands
    // in its hold slot — never a one-frame back→face swap. The proxy ends
    // face-up, so the later handoff is a clean face→face crossfade (the
    // reveal card fades in UNDER it).
    if (reduced) {
      // Short, honest turn — no theatrics; lands face-up on the hold slot.
      tl.to(flip, {rotateY: 0, duration: s(150), ease: 'power2.out'}, travelAt + travel * 0.35);
      tl.to(proxy, {scale: flying.scale, duration: s(90), ease: 'power2.out'}, travelAt + travel);
      return {kill: () => tl.kill()};
    }
    // The turn starts ~40% into the flight and lands with the card, so "fly"
    // and "open" read as one continuous motion, not settle-then-flip.
    addPremiumTurn(tl, {
      proxy, flip,
      at: travelAt + travel * 0.4,
      dur: travel * 0.66 + s(150),
      poseScale: flying.scale,
      push: 74,
    });
    return {kill: () => tl.kill()};
  }

  // ── MATCH: the card arrives FACE DOWN, and is turned over AT the inspect
  //    point — the physical "is it the one?" table gesture. The turn is the
  //    same premium tumble the plain landing plays, with a harder depth push
  //    (this IS the hero moment), and the mint confirmation sweep fires as
  //    the turn settles into the read.
  const judgeAt = travelAt + travel;
  const turnDur = s(beat.turnMs);
  if (reduced) {
    tl.to(flip, {rotateY: 0, duration: turnDur, ease: 'power2.out'}, judgeAt);
  } else {
    addPremiumTurn(tl, {proxy, flip, at: judgeAt, dur: turnDur, poseScale: flying.scale, push: 96});
    // The FOUND confirmation (the layer's mint sweep) rides the settle — the
    // turn reveals, the sweep confirms. Never a badge, never a particle.
    tl.call(() => proxy.classList.add('con-deckdraw-proxy--found'), undefined, judgeAt + turnDur * 0.88);
  }

  // ── The route: inspect point → hold slot ──────────────────────────────
  const routeAt = judgeAt + turnDur + s(beat.inspectMs);
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
