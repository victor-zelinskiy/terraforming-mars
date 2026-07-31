/*
 * HAND STAGE MOTION — the browse ⇄ play choreography of «КАРТЫ В РУКЕ», spoken
 * in the WORKSPACE DESCEND grammar (surfaceMotion/workspaceDescend.ts), the
 * same phrase «Действия карт» uses one level up.
 *
 * Pressing A on a card is NOT a modal popping over the hand and NOT a page
 * change. The player pressed a physical card, and the WORKSPACE opens into that
 * card's own configuration state:
 *
 *  · COMMIT   — the pressed slot answers where it stands (CSS, `--descend`);
 *  · CARRY    — the card itself travels. Deliberately NOT re-implemented here:
 *               `runCardTransfer` already lifts a proxy out of the hand slot
 *               into the composer's card well, holding both ends, and reverses
 *               it on cancel. One carried object, one implementation — a second
 *               FLIP of the same card would be a double image;
 *  · UNFOLD   — the stage zone is clipped down to the pressed card's rect and
 *               opens from it. Nothing scales, so no ring or text distorts: the
 *               lit edge of the card grows into the panel's edge;
 *  · RECEDE   — the browse layer steps back. CSS (`.con-hand__browse--parked`),
 *               not a timeline: it is a STATE, it must hold for as long as the
 *               stage is up (a timeline would have to be re-asserted after
 *               every interruption), and it costs one transition;
 *  · REVEAL   — the arriving composer surfaces its own controls from inside the
 *               opened panel. That is a SECOND, separate beat (`handStageReveal`)
 *               because the teleport lands a flush after the zone: without it
 *               the content would simply appear inside an already-open box —
 *               the same blink, one level in.
 *  · B reverses: the controls let go, the panel FOLDS back into the card's
 *    rect, the shelf breathes back, the card flies home.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {
  armDescendRect,
  takeDescendRect,
  guardedDescend,
  killDescendEpisode,
  descendUnfold,
  descendFold,
  descendCascade,
  descendCascadeOut,
  descendRectOf,
  descendRadiusOf,
  descendPx,
} from '@/client/console/surfaceMotion/workspaceDescend';

/** The stage opening from the pressed card's rect. */
const UNFOLD_MS = 270;
/** …and folding back into it. */
const FOLD_MS = 200;
/** The composer's controls surfacing from inside the opened panel. */
const CASCADE_MS = 180;
const CASCADE_OUT_MS = 90;

const CARD_KEY = 'hand-card';

/**
 * The pressed card's viewport rect, armed SYNCHRONOUSLY in the A handler —
 * before the stage mounts, while the slot is still where the player saw it.
 * The live slot is the fallback (the browse layer is only parked, never
 * unmounted, so it stays measurable), which is what makes the fold work even
 * when the descent was opened from somewhere else (the fullscreen viewer).
 */
export function armHandStageOrigin(rect: {left: number, top: number, width: number, height: number} | undefined): void {
  armDescendRect(CARD_KEY, rect);
}

/** The rect the stage unfolded FROM — kept for the fold on the way back. */
let unfoldedFrom: {rect: {left: number, top: number, width: number, height: number}, radius: number | undefined} | undefined;

export function resetHandStageMotion(): void {
  unfoldedFrom = undefined;
}

function rootOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('.con-hand');
}

/** The card the descent opened from (the unfold's origin). */
function selectedSlotOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-hand__slot--selected') ?? null;
}

/** The controls that surface from inside the opened panel (the teleported
 *  composer marks them; absent while the zone is still empty). */
function cascadeItemsOf(el: Element): Array<HTMLElement> {
  return Array.from(el.querySelectorAll<HTMLElement>('[data-unfold-item]'));
}

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/** The section is hidden by a pick bridge / not laid out — no live geometry. */
function noGeometry(el: Element): boolean {
  return el instanceof HTMLElement && el.offsetParent === null && getComputedStyle(el).position !== 'fixed';
}

// ── enter (browse → play stage) ─────────────────────────────────────────────

export function handStageEnterHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || noGeometry(el)) {
    killDescendEpisode(el);
    done();
    return;
  }
  const slot = selectedSlotOf(el);
  const cardRect = takeDescendRect(CARD_KEY) ?? descendRectOf(slot);
  const radius = descendRadiusOf(slot);
  unfoldedFrom = cardRect === undefined ? undefined : {rect: cardRect, radius};

  if (consoleReducedMotionActive()) {
    guardedDescend(el, 140, done, (finish) =>
      gsap.fromTo(el, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.1, ease: 'power1.out', clearProps: 'opacity,visibility', onComplete: finish}));
    return;
  }

  guardedDescend(el, UNFOLD_MS + 140, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    const unfolded = descendUnfold(tl, el as HTMLElement, cardRect, s(UNFOLD_MS), 0, radius);
    if (!unfolded) {
      // No measurable origin (a hand slot outside the virtual window, a
      // descent opened from the fullscreen viewer): degrade to a short rise —
      // never to nothing, and never to a pop.
      tl.fromTo(el,
        {autoAlpha: 0, y: descendPx(10)},
        {autoAlpha: 1, y: 0, duration: s(CASCADE_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, 0);
    }
    return tl;
  });
}

// ── leave (play stage → browse; the CANCEL path) ────────────────────────────

export function handStageLeaveHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || noGeometry(el)) {
    killDescendEpisode(el);
    unfoldedFrom = undefined;
    done();
    return;
  }
  const home = unfoldedFrom;
  unfoldedFrom = undefined;
  const items = cascadeItemsOf(el);

  if (consoleReducedMotionActive()) {
    guardedDescend(el, 120, done, (finish) =>
      gsap.to(el, {autoAlpha: 0, duration: 0.1, ease: 'power1.in', onComplete: finish}));
    return;
  }

  guardedDescend(el, FOLD_MS + 140, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    descendCascadeOut(tl, items, s(CASCADE_OUT_MS), 0);
    const folded = descendFold(tl, el as HTMLElement, home?.rect, s(FOLD_MS), s(50), home?.radius);
    tl.to(el, {autoAlpha: 0, duration: s(folded ? 90 : 110), ease: 'power2.in'}, s(folded ? FOLD_MS - 20 : 0));
    return tl;
  });
}

export function handStageEnterCancelledHook(el: Element): void {
  killDescendEpisode(el);
}

export function handStageLeaveCancelledHook(el: Element): void {
  killDescendEpisode(el);
  gsap.set(el, {clearProps: 'clipPath,webkitClipPath,opacity,visibility,transform'});
}

/**
 * THE SECOND REVEAL — the teleported surface's own content surfacing from
 * inside the already-opened zone.
 *
 * Called by the embedded composer on mount, NOT by the enter hook: the zone is
 * rendered from the moment the descent opens (so the teleport always has a
 * target), which means the content arrives one flush later and the enter hook
 * has nothing to cascade. Skipping this is what makes an embedded stage read as
 * «a box opened, then something appeared in it».
 */
export function handStageReveal(root: HTMLElement | undefined): void {
  if (root === undefined || typeof window === 'undefined') {
    return;
  }
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-unfold-item]'));
  if (items.length === 0) {
    return;
  }
  if (consoleReducedMotionActive()) {
    gsap.set(items, {clearProps: 'transform,opacity,visibility'});
    return;
  }
  const tl = gsap.timeline();
  descendCascade(tl, items, s(CASCADE_MS), 0);
}
