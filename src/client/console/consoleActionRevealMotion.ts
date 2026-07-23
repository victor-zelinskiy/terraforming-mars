/*
 * ACTION REVEAL MOTION — the deck-check beat INSIDE the ACTION FOCUS stage
 * (ConsoleActionComposer's reveal phase; the flow design lives in
 * docs/CONSOLE_BLUE_ACTION_PARITY.md, «reveal phase» section).
 *
 * The physical story: confirming a reveal action (Search For Life /
 * Asteroid Deflection System) PULLS the top card off the HUD project deck —
 * a face-down card lifts out of the deck pile, travels down into the stage's
 * reveal slot (growing to its final size on the way), settles, and FLIPs
 * face-up in place. The first frame the face is visible is the moment the
 * «Вскрываем карту» status yields to the actual outcome (the onFaceShown
 * callback); when the flip settles, the composer swaps the proxy for the
 * REAL card in the same flush (pixel-true — the proxy landed exactly on the
 * slot rect).
 *
 * The revealed card's IDENTITY arrives only with the server's answer, so the
 * flight launches immediately (a card back needs no data) and the FLIP waits
 * for `notifyPayload()` — a fast response flips right after touchdown, a
 * slow one holds the card face-down on the slot (an honest "being revealed"
 * beat, never a fake face).
 *
 * Idioms: boardCardBonusDirector's proxy convention (natural 320-wide
 * chassis, transformOrigin top-left, scale onto the measured slot rect,
 * `flip` at rotateY 180 = back showing), motionMs timings, arc via separate
 * x/y eases, episode guard + safety timer, reduced motion = no travel/flip
 * (the callbacks still fire in order — semantics unchanged).
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';

/** The HUD project-deck pile — the physical source of every deck flight. */
const DECK_SEL = '.con-deckstack__pile';

/** Travel from the deck into the slot (face down). */
const TRAVEL_MS = 680;
/** The in-place flip (back → face). */
const FLIP_MS = 540;
/** The settle beat after the flip before the real-card handoff. */
const SETTLE_MS = 90;
/** Safety: force-settle even if GSAP stalls (backgrounded tab). */
const SAFETY_MS = 9000;

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

export type ActionRevealFlightHandle = {
  /** The revealed card's data arrived — the face is renderable, flip when landed. */
  notifyPayload(): void;
  /** Abort (phase cancelled / unmount): kills tweens, fires nothing further. */
  kill(): void;
};

export type ActionRevealFlightArgs = {
  /** The fixed-position proxy chassis (.con-deal-proxy). */
  proxy: HTMLElement;
  /** Its .con-deal-proxy__flip child (back at rotateY 180). */
  flip: HTMLElement;
  /** The stage's reveal slot — the flight's landing rect. */
  slot: HTMLElement;
  /** The face is FIRST visible (mid-flip) — swap the status to the outcome. */
  onFaceShown: () => void;
  /** The flip settled — swap the proxy for the real card (same flush). */
  onSettled: () => void;
};

/**
 * Launch the deck → slot reveal flight. Returns a handle the composer uses
 * to release the flip once the server's payload lands (and to abort).
 */
export function runActionRevealFlight(args: ActionRevealFlightArgs): ActionRevealFlightHandle {
  const {proxy, flip, slot, onFaceShown, onSettled} = args;
  let dead = false;
  let payloadReady = false;
  let landed = false;
  let flipStarted = false;
  let faceShown = false;
  let settled = false;
  let safety = 0;

  const fireFace = () => {
    if (!dead && !faceShown) {
      faceShown = true;
      onFaceShown();
    }
  };
  const fireSettled = () => {
    if (!dead && !settled) {
      settled = true;
      window.clearTimeout(safety);
      fireFace(); // never settle without the status having swapped
      onSettled();
    }
  };

  if (typeof window === 'undefined') {
    fireSettled();
    return {notifyPayload: () => { /* done */ }, kill: () => { /* done */ }};
  }

  const reduced = consoleReducedMotionActive();
  const slotRect = slot.getBoundingClientRect();
  const usable = slotRect.width >= 10 && slotRect.height >= 10;

  // Reduced motion (or an unmeasurable slot): no travel, no flip — the real
  // card fades in via the composer's own transition once the payload lands.
  if (reduced || !usable) {
    gsap.set(proxy, {autoAlpha: 0});
    safety = window.setTimeout(fireSettled, SAFETY_MS);
    return {
      notifyPayload: () => fireSettled(),
      kill: () => {
        dead = true;
        window.clearTimeout(safety);
      },
    };
  }

  const scaleTo = Math.max(0.05, slotRect.width / CARD_NATURAL_W);
  const naturalH = slotRect.height / scaleTo;

  // The deck pile is the physical source; a missing pile (HUD variant)
  // degrades to a pull-in from just above the top edge, same trajectory feel.
  const deckEl = document.querySelector<HTMLElement>(DECK_SEL);
  const deckRect = deckEl?.getBoundingClientRect();
  const fromCx = deckRect !== undefined && deckRect.width > 4 ?
    deckRect.left + deckRect.width / 2 : slotRect.left + slotRect.width / 2;
  const fromCy = deckRect !== undefined && deckRect.height > 4 ?
    deckRect.top + deckRect.height / 2 : -naturalH * 0.1;
  const startScale = deckRect !== undefined && deckRect.width > 4 ?
    Math.max(0.04, Math.min(scaleTo, deckRect.width / CARD_NATURAL_W)) : scaleTo * 0.5;

  gsap.set(proxy, {
    width: CARD_NATURAL_W,
    height: naturalH,
    transformOrigin: 'top left',
    x: fromCx - (CARD_NATURAL_W * startScale) / 2,
    y: fromCy - (naturalH * startScale) / 2,
    scale: startScale,
    rotation: -5,
    autoAlpha: 0,
  });
  gsap.set(flip, {rotateY: 180}); // back showing — the card leaves the deck face down

  const tl = gsap.timeline();
  // A short lift OUT of the pile (the card frees itself before travelling).
  tl.to(proxy, {autoAlpha: 1, y: `-=${12}`, duration: s(120), ease: 'power2.out'}, 0);
  // The travel: x and y ride DIFFERENT eases — the path bows into a natural
  // arc; the scale grows most over the second half (approach = arrival).
  tl.to(proxy, {x: slotRect.left, duration: s(TRAVEL_MS), ease: 'power2.inOut'}, s(90));
  tl.to(proxy, {y: slotRect.top, duration: s(TRAVEL_MS), ease: 'power3.inOut'}, s(90));
  tl.to(proxy, {scale: scaleTo, duration: s(TRAVEL_MS), ease: 'power2.in'}, s(90));
  tl.to(proxy, {rotation: 0, duration: s(TRAVEL_MS * 0.8), ease: 'power2.out'}, s(150));
  tl.call(() => {
    landed = true;
    maybeFlip();
  });

  /** The in-place flip — only when BOTH the card landed AND the face exists. */
  const maybeFlip = () => {
    if (dead || flipStarted || !landed || !payloadReady) {
      return;
    }
    flipStarted = true;
    const ftl = gsap.timeline();
    ftl.to(flip, {
      rotateY: 0,
      duration: s(FLIP_MS),
      ease: 'power2.inOut',
      onUpdate() {
        if (this.progress() >= 0.5) {
          fireFace();
        }
      },
    }, 0);
    // The physical "card snaps over" beat: a slight scale breath on the proxy,
    // peaking as the face passes the camera plane.
    ftl.to(proxy, {scale: scaleTo * 1.035, duration: s(FLIP_MS / 2), ease: 'power2.out'}, 0);
    ftl.to(proxy, {scale: scaleTo, duration: s(FLIP_MS / 2), ease: 'power2.in'}, s(FLIP_MS / 2));
    ftl.to({}, {duration: s(SETTLE_MS)});
    ftl.call(fireSettled);
    liveFlip = ftl;
  };

  let liveFlip: gsap.core.Timeline | undefined;
  safety = window.setTimeout(fireSettled, SAFETY_MS);

  return {
    notifyPayload: () => {
      payloadReady = true;
      maybeFlip();
    },
    kill: () => {
      dead = true;
      window.clearTimeout(safety);
      tl.kill();
      liveFlip?.kill();
    },
  };
}
