/*
 * EFFECTS FOCUS MOTION — the browse ⇄ detail choreography of the console
 * Effects Explorer (ConsoleEffectsExplorer.vue), spoken in the WORKSPACE
 * DESCEND grammar (surfaceMotion/workspaceDescend.ts).
 *
 * A verbatim sibling of `consoleActionFocusMotion.ts` with the seven element
 * roles re-pointed at the explorer's own selectors and the armed-rect keys
 * renamed (`effect-*` — the descend registries are name-keyed, and BOTH
 * surfaces can be in the DOM at once: the info panel is an overlay). The
 * phrase is identical: COMMIT (CSS `--descend` flare) → RELEASE (the slot's
 * own content dissolves in place) → the browse layer RECEDES into the press
 * point → UNFOLD (the dossier surface opens from the slot's rect) + CARRY
 * (the dossier thumbnail FLIPs into the stage's hero card) → REVEAL (the
 * blocks cascade from inside) — and B reverses it.
 *
 * Two additions the read-only explorer needs:
 *  · `armEffectsInstantFold()` — a one-shot the seat switch arms so the NEXT
 *    leave resolves instantly (LB/RB drops the detail; a stranger's browse
 *    must not play a stranger's fold);
 *  · `playEffectsDetailStep()` — the LB/RB sibling-effect patch INSIDE the
 *    standing stage (a short directional content beat, never a re-descend).
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
  descendRelease,
  descendCascade,
  descendCascadeOut,
  descendRectOf,
  descendRadiusOf,
  descendPx,
  resetWorkspaceDescend,
} from '@/client/console/surfaceMotion/workspaceDescend';

// ── timings (value-mirror of the action focus phrase) ───────────────────────

const RELEASE_MS = 120;
const BROWSE_OUT_MS = 170;
const BROWSE_IN_MS = 180;
const UNFOLD_MS = 280;
const FOLD_MS = 200;
const CASCADE_MS = 175;
const CASCADE_OUT_MS = 90;
const CARD_FLIP_MS = 300;
const CARD_FLIP_BACK_MS = 250;
const UNFOLD_AT_MS = 70;
/** The detail LB/RB step — a short directional patch. */
const DETAIL_STEP_MS = 150;

// ── the armed origins (effect-* keys — never shared with the actions surface) ──

const THUMB_KEY = 'effect-thumb';
const SLOT_KEY = 'effect-slot';
const PRESS_KEY = 'effect-browse';

/** Remember the dossier thumbnail's rect right before mounting the stage. */
export function armEffectsFocusOrigin(rect: {left: number, top: number, width: number, height: number} | undefined): void {
  armDescendRect(THUMB_KEY, rect);
}

/** The pressed slot's rect (armed in the SAME synchronous press handler). */
export function armEffectsSlot(rect: {left: number, top: number, width: number, height: number} | undefined): void {
  armDescendRect(SLOT_KEY, rect);
}

/** The press point (the browse layer recedes into it on the descend). */
export function armEffectsPress(point: {x: number, y: number} | undefined): void {
  if (point !== undefined) {
    armDescendOrigin(PRESS_KEY, point);
  }
}

/** The rect the stage surface unfolded FROM — the fold's destination. */
let unfoldedFrom: {rect: {left: number, top: number, width: number, height: number}, radius: number | undefined} | undefined;

/** One-shot: the NEXT leave resolves instantly (seat switch / reset). */
let instantFold = false;

export function armEffectsInstantFold(): void {
  instantFold = true;
}

/** Game-switch / unmount boundary. */
export function resetEffectsFocusMotion(): void {
  unfoldedFrom = undefined;
  instantFold = false;
  resetWorkspaceDescend();
}

// ── element resolution ──────────────────────────────────────────────────────

function rootOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('.con-efx');
}

function browseOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-efx__browse') ?? null;
}

function thumbOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('[data-effect-flow-thumb]') ?? null;
}

function heroCardOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-effect-focus-card]');
}

function surfaceOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-unfold-surface]');
}

function cascadeItemsOf(el: Element): Array<HTMLElement> {
  return Array.from(el.querySelectorAll<HTMLElement>('[data-unfold-item]'));
}

function slotOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-efx__tile--focused') ?? null;
}

function slotContentOf(el: Element): Array<HTMLElement> {
  const slot = slotOf(el);
  return slot === null ?
    [] :
    Array.from(slot.querySelectorAll<HTMLElement>('.con-efx__tile-head, .con-efx__canvas, .con-efx__tile-meta'));
}

/** A hidden/unlaid-out explorer (route torn down, panel closing) has no live
 *  geometry — resolve instantly. */
function hiddenAway(el: Element): boolean {
  return el instanceof HTMLElement && el.offsetParent === null && getComputedStyle(el).position !== 'fixed';
}

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/** Restore the browse layer + the released slot content + the thumb to rest. */
function restoreBrowse(el: Element): void {
  const browse = browseOf(el);
  if (browse !== null) {
    gsap.set(browse, {autoAlpha: 1, clearProps: 'transform,opacity,visibility'});
  }
  const content = slotContentOf(el);
  if (content.length > 0) {
    gsap.set(content, {clearProps: 'transform,opacity,visibility'});
  }
  const thumb = thumbOf(el);
  if (thumb !== null) {
    gsap.set(thumb, {clearProps: 'opacity'});
  }
}

// ── the enter hook (browse → detail: the SURFACE UNFOLD) ────────────────────

export function effectsFocusEnterHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || hiddenAway(el)) {
    killDescendEpisode(el);
    done();
    return;
  }
  const browse = browseOf(el);
  const thumb = thumbOf(el);
  const heroCard = heroCardOf(el);
  const surface = surfaceOf(el);
  const items = cascadeItemsOf(el);
  const content = slotContentOf(el);

  const slot = slotOf(el);
  const slotRect = takeDescendRect(SLOT_KEY) ?? descendRectOf(slot);
  const slotRadius = descendRadiusOf(slot);
  unfoldedFrom = slotRect === undefined ? undefined : {rect: slotRect, radius: slotRadius};

  if (consoleReducedMotionActive()) {
    guardedDescend(el, 160, done, (finish) => {
      if (browse !== null) {
        gsap.set(browse, {autoAlpha: 0});
      }
      return gsap.fromTo(el, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.1, ease: 'power1.out', clearProps: 'opacity,visibility', onComplete: finish});
    });
    return;
  }

  const pressPoint = takeDescendOrigin(PRESS_KEY);
  const thumbRect = takeDescendRect(THUMB_KEY);
  guardedDescend(el, UNFOLD_AT_MS + CARD_FLIP_MS + 140, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. RELEASE — the pressed slot's own content dissolves where it stands
    //    (the commit pulse plays under it through the CSS `--descend` class).
    descendRelease(tl, content, s(RELEASE_MS), 0);
    // 2. The browse layer RECEDES into the press point; the thumbnail goes
    //    dark INSTANTLY (the flying hero card IS that card — one object).
    if (thumb !== null) {
      gsap.set(thumb, {opacity: 0});
    }
    if (browse !== null) {
      descendRecede(tl, browse, pressPoint, s(BROWSE_OUT_MS), s(40));
    }
    // 3. UNFOLD — the dossier surface opens FROM the slot's rect; the card
    //    FLIP shares the window so the two read as one phrase.
    const unfolded = surface !== null &&
      descendUnfold(tl, surface, slotRect, s(UNFOLD_MS), s(UNFOLD_AT_MS), slotRadius);
    if (surface !== null && !unfolded) {
      tl.fromTo(surface,
        {autoAlpha: 0, y: descendPx(10)},
        {autoAlpha: 1, y: 0, duration: s(CASCADE_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, s(UNFOLD_AT_MS));
    }
    if (heroCard !== null) {
      const from = thumbRect !== undefined ? descendFlipFrom(heroCard, thumbRect) : undefined;
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
    // 4. REVEAL — the dossier blocks surface from inside the opening panel.
    descendCascade(tl, items, s(CASCADE_MS), s(UNFOLD_AT_MS + 100));
    return tl;
  });
}

// ── the leave hook (detail → browse — B / seat switch) ──────────────────────

export function effectsFocusLeaveHook(el: Element, done: () => void): void {
  const instant = instantFold;
  instantFold = false;
  if (typeof window === 'undefined' || instant || hiddenAway(el)) {
    killDescendEpisode(el);
    unfoldedFrom = undefined;
    restoreBrowse(el);
    done();
    return;
  }
  const browse = browseOf(el);
  const thumb = thumbOf(el);
  const heroCard = heroCardOf(el);
  const surface = surfaceOf(el);
  const items = cascadeItemsOf(el);
  const content = slotContentOf(el);
  const home = unfoldedFrom;
  unfoldedFrom = undefined;

  // The slot's content comes back with the layer (it was released, not moved)
  // — restoring it now is invisible: the browse layer is still receded.
  if (content.length > 0) {
    gsap.set(content, {clearProps: 'transform,opacity,visibility'});
  }

  if (consoleReducedMotionActive()) {
    guardedDescend(el, 140, done, (finish) => {
      restoreBrowse(el);
      return gsap.to(el, {autoAlpha: 0, duration: 0.1, ease: 'power1.in', onComplete: finish});
    });
    return;
  }

  const heroRect = heroCard?.getBoundingClientRect();
  guardedDescend(el, CARD_FLIP_BACK_MS + 140, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. The blocks let go in place.
    descendCascadeOut(tl, items, s(CASCADE_OUT_MS), 0);
    // One physical object: the stage's card goes dark the moment its browse
    // twin starts flying home.
    if (heroCard !== null) {
      gsap.set(heroCard, {opacity: 0});
    }
    // 2. FOLD — the panel collapses back into the slot it opened from.
    const folded = surface !== null &&
      descendFold(tl, surface, home?.rect, s(FOLD_MS), s(50), home?.radius);
    tl.to(el, {autoAlpha: 0, duration: s(folded ? 90 : 110), ease: 'power2.in'}, s(folded ? FOLD_MS - 20 : 0));
    // 3. The browse layer BREATHES BACK from the press point, and the card
    //    FLIPs home into the dossier thumbnail.
    if (browse !== null) {
      descendReturn(tl, browse, s(BROWSE_IN_MS), s(40));
    }
    if (thumb !== null) {
      gsap.set(thumb, {clearProps: 'opacity'});
      if (heroRect !== undefined && heroRect.width >= 10) {
        const from = descendFlipFrom(thumb, heroRect);
        if (from !== undefined) {
          tl.fromTo(thumb,
            {x: from.x, y: from.y, scale: from.scale, transformOrigin: 'top left'},
            {x: 0, y: 0, scale: 1, duration: s(CARD_FLIP_BACK_MS), ease: 'power3.inOut', clearProps: 'transform', overwrite: 'auto'}, s(20));
        }
      }
    }
    return tl;
  });
}

/** Cancelled-pair hooks: drop the dead tween and restore the direction the
 *  element is ACTUALLY taking. */
export function effectsFocusEnterCancelledHook(el: Element): void {
  killDescendEpisode(el);
}

export function effectsFocusLeaveCancelledHook(el: Element): void {
  killDescendEpisode(el);
  // A cancelled leave means the stage STAYS — re-park the browse layer, the
  // released slot content and the thumbnail (the enter hook's end state).
  const browse = browseOf(el);
  if (browse !== null) {
    descendParkLayer(browse);
  }
  const content = slotContentOf(el);
  if (content.length > 0) {
    gsap.set(content, {autoAlpha: 0});
  }
  const thumb = thumbOf(el);
  if (thumb !== null) {
    gsap.set(thumb, {opacity: 0});
  }
  const heroCard = heroCardOf(el);
  if (heroCard !== null) {
    gsap.set(heroCard, {clearProps: 'opacity'});
  }
  const surface = surfaceOf(el);
  if (surface !== null) {
    gsap.set(surface, {clearProps: 'clipPath,webkitClipPath'});
  }
}

// ── the detail LB/RB step (sibling effect, inside the standing stage) ───────

/**
 * A short DIRECTIONAL content patch: the dossier blocks and the hero step a
 * few px from the pressed direction while the identity underneath re-points
 * reactively. Never a re-descend (the stage stays mounted, its key constant);
 * reduced motion clears any leftovers and snaps.
 */
export function playEffectsDetailStep(stage: Element | null | undefined, dir: 1 | -1): void {
  if (stage === null || stage === undefined || typeof window === 'undefined') {
    return;
  }
  const targets: Array<HTMLElement> = [...cascadeItemsOf(stage)];
  const heroCard = heroCardOf(stage);
  if (heroCard !== null) {
    targets.push(heroCard);
  }
  if (targets.length === 0) {
    return;
  }
  gsap.killTweensOf(targets);
  if (consoleReducedMotionActive()) {
    gsap.set(targets, {clearProps: 'transform,opacity,visibility'});
    return;
  }
  gsap.fromTo(targets,
    {x: descendPx(14) * dir, opacity: 0.25},
    {x: 0, opacity: 1, duration: s(DETAIL_STEP_MS), ease: 'power2.out', stagger: 0.02, clearProps: 'transform,opacity'});
}
