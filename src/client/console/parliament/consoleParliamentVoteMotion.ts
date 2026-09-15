/*
 * THE VOTE STEP'S MOTION — the Parliament's browse ⇄ vote choreography,
 * spoken in the WORKSPACE DESCEND grammar (surfaceMotion/workspaceDescend.ts)
 * exactly as the Action Browser's browse ⇄ focus phrase
 * (consoleActionFocusMotion.ts). One physical object travels: the resolution
 * card the player pressed.
 *
 *  · COMMIT — the pressed voting slot answers where it stands;
 *  · RECEDE — the whole overview (government · voting area · seats · parties ·
 *    Agenda) steps back INTO the press point; the slot's card goes dark on the
 *    first frame — the flying hero IS that card now (never a double image);
 *  · UNFOLD — the vote's decision surface opens FROM the slot's rect while
 *    the card FLIPs from the slot's card rect into the hero column;
 *  · REVEAL — the decision rows (source, forecast, confirm) surface from
 *    inside the opened panel with a short stagger;
 *  · B reverses the same phrase: the rows let go, the panel folds back into
 *    the slot's rect, the card FLIPs home, the overview breathes back from
 *    the same point — and the slot's card lights up only when the hero has
 *    landed on it.
 *
 * Entered FROM THE FULLSCREEN VIEWER the phrase is INSTANT: the card is
 * already in flight from the viewer into the hero slot (the zoom handoff),
 * so the overview parks receded and the surface stands ready under the
 * veil — the one moving object is the viewer's card.
 *
 * Transform / opacity / clip only (perf-lite safe), guarded episodes (`done()`
 * can never be dropped), durations through `motionMs`, FLIP deltas
 * compensated for CSS-`zoom` contexts, reduced motion = short functional
 * fades with unchanged semantics.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {
  armDescendOrigin,
  armDescendRect,
  takeDescendOrigin,
  takeDescendRect,
  guardedDescend,
  killDescendEpisode,
  descendFlipFrom,
  descendRecede,
  descendReturn,
  descendParkLayer,
  descendUnfold,
  descendFold,
  descendCascade,
  descendCascadeOut,
  descendRadiusOf,
  descendPx,
} from '@/client/console/surfaceMotion/workspaceDescend';

type Rect = {left: number, top: number, width: number, height: number};

// ── timings (1080-logical ms; motionMs folds the speed preset) ──────────────

/** The overview receding into the press point. */
const BODY_OUT_MS = 190;
/** …and breathing back on B. */
const BODY_IN_MS = 200;
/** The decision surface opening from the slot's rect. */
const UNFOLD_MS = 300;
const FOLD_MS = 210;
/** The decision rows surfacing from inside the opened panel. */
const CASCADE_MS = 180;
const CASCADE_OUT_MS = 90;
/** The card FLIP (slot ⇄ hero) — the carried subject; the eye follows it. */
const CARD_FLIP_MS = 320;
const CARD_FLIP_BACK_MS = 260;
/** The unfold's start offset — the commit reads first. */
const UNFOLD_AT_MS = 60;

// ── the armed origins ───────────────────────────────────────────────────────

const CARD_KEY = 'parliament-vote-card';
const SLOT_KEY = 'parliament-vote-slot';
const PRESS_KEY = 'parliament-vote';

/** The entrance's shape — armed by the section right before the layer mounts. */
let armedInstant = false;
/** The rect the surface unfolded from — the fold on the way back. */
let unfoldedFrom: {rect: Rect, radius: number | undefined} | undefined;

/**
 * Arm the vote step's origins: the pressed slot's rect (the surface unfolds
 * from it), its card's rect (the hero FLIPs from it) and the press point (the
 * overview recedes into it). `instant` = the fullscreen viewer is handing the
 * card over: no FLIP, no unfold — the layer stands ready under the veil.
 */
export function armParliamentVote(origin: {card?: Rect, slot?: Rect, press?: {x: number, y: number}, instant?: boolean}): void {
  armDescendRect(CARD_KEY, origin.card);
  armDescendRect(SLOT_KEY, origin.slot);
  armDescendOrigin(PRESS_KEY, origin.press);
  armedInstant = origin.instant === true;
}

export function resetParliamentVoteMotion(): void {
  unfoldedFrom = undefined;
  armedInstant = false;
}

// ── element resolution ──────────────────────────────────────────────────────

function rootOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('.con-parl');
}

function bodyOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-parl__body') ?? null;
}

function heroCardOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-parl-vote-card]');
}

function surfaceOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-parl-vote-surface]');
}

function cascadeItemsOf(el: Element): Array<HTMLElement> {
  return Array.from(el.querySelectorAll<HTMLElement>('[data-parl-vote-item]'));
}

function hiddenByHost(el: Element): boolean {
  return el instanceof HTMLElement && el.offsetParent === null && getComputedStyle(el).position !== 'fixed';
}

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

// ── the enter hook (browse → vote) ──────────────────────────────────────────

export function parliamentVoteEnterHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || hiddenByHost(el)) {
    killDescendEpisode(el);
    done();
    return;
  }
  const body = bodyOf(el);
  const heroCard = heroCardOf(el);
  const surface = surfaceOf(el);
  const items = cascadeItemsOf(el);
  const slotRect = takeDescendRect(SLOT_KEY);
  const cardRect = takeDescendRect(CARD_KEY);
  const pressPoint = takeDescendOrigin(PRESS_KEY);
  const instant = armedInstant;
  armedInstant = false;
  unfoldedFrom = slotRect === undefined ? undefined : {rect: slotRect, radius: undefined};

  // FROM THE VIEWER: the card is arriving on its own flight; everything else
  // is simply in place under the veil.
  if (instant || consoleReducedMotionActive()) {
    guardedDescend(el, 140, done, (finish) => {
      if (body !== null) {
        descendParkLayer(body);
      }
      return gsap.fromTo(el, {autoAlpha: instant ? 1 : 0}, {autoAlpha: 1, duration: instant ? 0.01 : 0.1, ease: 'power1.out', clearProps: 'opacity,visibility', onComplete: finish});
    });
    return;
  }

  guardedDescend(el, UNFOLD_AT_MS + CARD_FLIP_MS + 160, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. The overview RECEDES INTO the press point.
    if (body !== null) {
      descendRecede(tl, body, pressPoint, s(BODY_OUT_MS), s(30));
    }
    // 2. UNFOLD — the decision surface opens FROM the slot's rect.
    const unfolded = surface !== null &&
      descendUnfold(tl, surface, slotRect, s(UNFOLD_MS), s(UNFOLD_AT_MS), descendRadiusOf(surface));
    if (surface !== null && !unfolded) {
      tl.fromTo(surface,
        {autoAlpha: 0, y: descendPx(10)},
        {autoAlpha: 1, y: 0, duration: s(CASCADE_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, s(UNFOLD_AT_MS));
    }
    // 3. CARRY — the card FLIPs from its slot into the hero column (one
    //    object: the slot's copy went dark before this frame).
    if (heroCard !== null) {
      const from = cardRect !== undefined ? descendFlipFrom(heroCard, cardRect) : undefined;
      if (from !== undefined) {
        tl.fromTo(heroCard,
          {x: from.x, y: from.y, scale: from.scale, transformOrigin: 'top left'},
          {x: 0, y: 0, scale: 1, duration: s(CARD_FLIP_MS), ease: 'power3.inOut', clearProps: 'transform', overwrite: 'auto'}, 0);
      } else {
        tl.fromTo(heroCard,
          {autoAlpha: 0, scale: 0.97, transformOrigin: '50% 50%'},
          {autoAlpha: 1, scale: 1, duration: s(CASCADE_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility', overwrite: 'auto'}, 0);
      }
    }
    // 4. REVEAL — the decision rows surface from inside the opening panel.
    descendCascade(tl, items, s(CASCADE_MS), s(UNFOLD_AT_MS + 100));
    return tl;
  });
}

// ── the leave hook (vote → browse: a CANCEL — the committed path leaves with
//    the whole workspace, whose own surface-motion leave carries the layer) ──

export function parliamentVoteLeaveHook(el: Element, done: () => void, homeCardRect: () => Rect | undefined): void {
  if (typeof window === 'undefined' || hiddenByHost(el)) {
    killDescendEpisode(el);
    unfoldedFrom = undefined;
    done();
    return;
  }
  const body = bodyOf(el);
  const heroCard = heroCardOf(el);
  const surface = surfaceOf(el);
  const items = cascadeItemsOf(el);
  const home = unfoldedFrom;
  unfoldedFrom = undefined;

  if (consoleReducedMotionActive()) {
    guardedDescend(el, 140, done, (finish) => {
      if (body !== null) {
        gsap.set(body, {autoAlpha: 1, clearProps: 'transform,opacity,visibility'});
      }
      return gsap.to(el, {autoAlpha: 0, duration: 0.1, ease: 'power1.in', onComplete: finish});
    });
    return;
  }

  // The overview returns FIRST in the DOM (it is behind the layer): its card
  // slot is measured at rest, so the hero flies onto the real place.
  if (body !== null) {
    gsap.set(body, {autoAlpha: 1, scale: 1, clearProps: 'transform,opacity,visibility'});
  }
  const target = homeCardRect();
  if (body !== null) {
    descendParkLayer(body);
  }
  guardedDescend(el, CARD_FLIP_BACK_MS + 160, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. The rows let go in place.
    descendCascadeOut(tl, items, s(CASCADE_OUT_MS), 0);
    // 2. FOLD — the panel collapses back into the slot it opened from.
    const folded = surface !== null && descendFold(tl, surface, home?.rect, s(FOLD_MS), s(40), home?.radius);
    if (surface !== null && !folded) {
      tl.to(surface, {autoAlpha: 0, duration: s(110), ease: 'power2.in'}, s(20));
    }
    // 3. The overview BREATHES BACK from the same press point.
    if (body !== null) {
      descendReturn(tl, body, s(BODY_IN_MS), s(30));
    }
    // 4. The card FLIPs HOME into its slot — the last thing to land; the
    //    slot's copy lights up when this layer is gone (the host's `done`).
    if (heroCard !== null && target !== undefined && target.width >= 10) {
      const to = descendFlipFrom(heroCard, target);
      if (to !== undefined) {
        tl.to(heroCard, {x: to.x, y: to.y, scale: to.scale, transformOrigin: 'top left', duration: s(CARD_FLIP_BACK_MS), ease: 'power3.inOut', overwrite: 'auto'}, s(10));
      }
    } else if (heroCard !== null) {
      tl.to(heroCard, {autoAlpha: 0, duration: s(120), ease: 'power2.in'}, s(20));
    }
    return tl;
  });
}

/** Cancelled-pair hooks: drop the dead tween and re-pose the layers to the direction the element is ACTUALLY taking. */
export function parliamentVoteEnterCancelledHook(el: Element): void {
  killDescendEpisode(el);
}

export function parliamentVoteLeaveCancelledHook(el: Element): void {
  killDescendEpisode(el);
  const body = bodyOf(el);
  if (body !== null) {
    descendParkLayer(body);
  }
  const heroCard = heroCardOf(el);
  if (heroCard !== null) {
    gsap.set(heroCard, {clearProps: 'transform,opacity,visibility'});
  }
  const surface = surfaceOf(el);
  if (surface !== null) {
    gsap.set(surface, {clearProps: 'clipPath,webkitClipPath,opacity,visibility'});
  }
}

/** The overview's layer comes back to rest (the workspace is leaving with the vote landed — nothing to fold). */
export function restoreParliamentBody(root: Element | null | undefined): void {
  const body = root?.querySelector<HTMLElement>('.con-parl__body') ?? null;
  if (body !== null) {
    gsap.set(body, {clearProps: 'transform,opacity,visibility'});
  }
}
