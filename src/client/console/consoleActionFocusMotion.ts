/*
 * ACTION FOCUS MOTION — the browse ⇄ focus choreography of the console
 * Action Browser (ConsoleCardActions.vue), spoken in the WORKSPACE DESCEND
 * grammar (surfaceMotion/workspaceDescend.ts).
 *
 * Entering the ACTION FOCUS stage is NOT a modal popping over the grid, and
 * NOT a set of widgets flying to new homes. The player pressed a physical
 * action slot, and THAT SURFACE opens into its own configuration state:
 *
 *  · COMMIT — the chosen slot answers the press where it stands (CSS
 *    `--descend` ring flare);
 *  · RELEASE — the slot's own content (graphic, way-finder, diagnostics)
 *    dissolves IN PLACE. It belongs to the browse layer; carrying it into the
 *    stage would duplicate what the hero card and the cost/result blocks
 *    already say;
 *  · UNFOLD — the stage's configuration SURFACE is clipped down to the slot's
 *    rect and opens from it, while the browse layer recedes into the same
 *    press point. Nothing scales, so no ring or text is distorted: the lit
 *    edge of the button literally grows into the panel's edge;
 *  · CARRY — the ONE genuinely semantic object travels: the inspector's card
 *    thumbnail FLIPs into the stage's hero card (the subject of the action,
 *    not a widget);
 *  · REVEAL — the controls (formula, decisions, CTA) surface from INSIDE the
 *    opened panel with a short stagger;
 *  · B reverses the same phrase: the controls let go, the panel FOLDS back
 *    into the slot's rect, the card FLIPs home, the browse layer breathes
 *    back from the same origin.
 *
 * Follows the surfaceMotionDirector idioms verbatim: transform/opacity/clip
 * only (no `filter`, no layout property — perf-lite safe), guarded episodes
 * (`done()` can never be dropped), durations through `motionMs`, FLIP deltas
 * compensated for CSS-`zoom` contexts, reduced motion = short functional
 * fades with unchanged semantics.
 *
 * The stage element keeps `data-motion-surface="action-composer"` for the
 * AWAITING handoff (the departure capture + the phase FLIP into the reveal /
 * task host are surface-motion's job, untouched here) — these hooks own only
 * the INTERNAL browse ⇄ focus transition.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {isConsoleHandPickActive} from '@/client/console/consoleHandPick';
import {
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

// ── timings (1080-logical ms; motionMs folds the speed preset) ──────────────

/** The slot's own content letting go where it stands. */
const RELEASE_MS = 120;
/** The browse layer receding into the press point. */
const BROWSE_OUT_MS = 170;
/** The browse layer breathing back on B. */
const BROWSE_IN_MS = 180;
/** The configuration surface opening from the slot's rect. */
const UNFOLD_MS = 280;
/** …and folding back into it. */
const FOLD_MS = 200;
/** The controls surfacing from inside the opened panel. */
const CASCADE_MS = 175;
const CASCADE_OUT_MS = 90;
/** The card FLIP (thumbnail ⇄ hero) — the carried subject; the eye follows it. */
const CARD_FLIP_MS = 300;
const CARD_FLIP_BACK_MS = 250;
/** The unfold's start offset — the commit + release read first. */
const UNFOLD_AT_MS = 70;

// ── the armed origins ───────────────────────────────────────────────────────

const THUMB_KEY = 'action-thumb';
const SLOT_KEY = 'action-slot';

/** Called by the browser right before mounting the focus stage: remember the
 *  inspector thumbnail's viewport rect so the enter hook can FLIP from it. */
export function armActionFocusOrigin(rect: {left: number, top: number, width: number, height: number} | undefined): void {
  armDescendRect(THUMB_KEY, rect);
}

/**
 * The rect (and roundness) the configuration surface unfolded FROM — kept for
 * the fold on the way back. Measured in the browse layer's RESTING space (the
 * layer is receded while the stage is up, and it is back at rest exactly when
 * the fold lands), so the panel collapses into the slot the player pressed.
 */
let unfoldedFrom: {rect: {left: number, top: number, width: number, height: number}, radius: number | undefined} | undefined;

/** Game-switch / unmount boundary. */
export function resetActionFocusMotion(): void {
  unfoldedFrom = undefined;
  resetWorkspaceDescend();
}

// ── element resolution ──────────────────────────────────────────────────────

function rootOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('.con-cardactions');
}

function browseOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-cardactions__browse') ?? null;
}

function thumbOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('[data-action-flow-thumb]') ?? null;
}

function heroCardOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-action-focus-card]');
}

/** The stage's CONFIGURATION SURFACE — the unfold's subject. */
function surfaceOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-unfold-surface]');
}

/** The controls that surface from inside the opened panel. */
function cascadeItemsOf(el: Element): Array<HTMLElement> {
  return Array.from(el.querySelectorAll<HTMLElement>('[data-unfold-item]'));
}

/** The pressed slot in the browse grid (the unfold's origin). */
function slotOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-cardactions__tile--focused') ?? null;
}

/** The pressed slot's OWN content — released in place, never carried. */
function slotContentOf(el: Element): Array<HTMLElement> {
  const slot = slotOf(el);
  return slot === null ?
    [] :
    Array.from(slot.querySelectorAll<HTMLElement>('.con-cardactions__tile-head, .con-cardactions__canvas, .con-cardactions__tile-meta'));
}

/** The pick bridges hide the WHOLE center via v-show; a focus unmount during
 *  one (prompt-change teardown) has no live geometry — resolve instantly. */
function hiddenByBridge(el: Element): boolean {
  return isConsoleHandPickActive() ||
    (el instanceof HTMLElement && el.offsetParent === null && getComputedStyle(el).position !== 'fixed');
}

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

// ── the enter hook (browse → focus: the SURFACE UNFOLD) ─────────────────────

export function actionFocusEnterHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || hiddenByBridge(el)) {
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

  // The slot's rect: armed at the press (the press-time truth), with the live
  // slot as the fallback — the header keeps a FIXED height across the two
  // states, so the browse layer is laid out identically either way.
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

  const pressPoint = takeDescendOrigin('action-browse');
  const thumbRect = takeDescendRect(THUMB_KEY);
  guardedDescend(el, UNFOLD_AT_MS + CARD_FLIP_MS + 140, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. RELEASE — the pressed slot's own content dissolves where it stands
    //    (the commit pulse plays under it through the CSS `--descend` class).
    descendRelease(tl, content, s(RELEASE_MS), 0);
    // 2. The browse layer RECEDES INTO the press point. The thumbnail goes
    //    dark INSTANTLY: the flying hero card IS that card now (one physical
    //    object, never a double image).
    if (thumb !== null) {
      gsap.set(thumb, {opacity: 0});
    }
    if (browse !== null) {
      descendRecede(tl, browse, pressPoint, s(BROWSE_OUT_MS), s(40));
    }
    // 3. UNFOLD — the configuration surface opens FROM the slot's rect. The
    //    card FLIP shares the same window and easing family, so the two read
    //    as ONE phrase, not two competing animations.
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
    // 4. CONTEXT REVEAL — the controls surface from INSIDE the opening panel
    //    (deliberately overlapping the unfold: they emerge behind its edge).
    descendCascade(tl, items, s(CASCADE_MS), s(UNFOLD_AT_MS + 100));
    return tl;
  });
}

// ── the leave hook (focus → browse; only for a CANCEL — the committed path
//    unmounts the whole center, whose own surface-motion leave carries every
//    nested panel, and this hook never fires) ─────────────────────────────────

export function actionFocusLeaveHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || hiddenByBridge(el)) {
    killDescendEpisode(el);
    unfoldedFrom = undefined;
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
      if (thumb !== null) {
        gsap.set(thumb, {clearProps: 'opacity'});
      }
      if (browse !== null) {
        gsap.set(browse, {autoAlpha: 1, clearProps: 'transform,opacity,visibility'});
      }
      return gsap.to(el, {autoAlpha: 0, duration: 0.1, ease: 'power1.in', onComplete: finish});
    });
    return;
  }

  // The carried card's live rect BEFORE anything moves — the thumbnail FLIPs
  // home from it.
  const heroRect = heroCard?.getBoundingClientRect();
  guardedDescend(el, CARD_FLIP_BACK_MS + 140, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. The controls let go in place.
    descendCascadeOut(tl, items, s(CASCADE_OUT_MS), 0);
    // The single physical object: the stage's card goes dark the moment its
    // browse twin starts flying home.
    if (heroCard !== null) {
      gsap.set(heroCard, {opacity: 0});
    }
    // 2. FOLD — the panel collapses back into the slot it opened from.
    const folded = surface !== null &&
      descendFold(tl, surface, home?.rect, s(FOLD_MS), s(50), home?.radius);
    tl.to(el, {autoAlpha: 0, duration: s(folded ? 90 : 110), ease: 'power2.in'}, s(folded ? FOLD_MS - 20 : 0));
    // 3. The browse layer BREATHES BACK from the same press point it receded
    //    into, and the card FLIPs home into the inspector.
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

/**
 * THE WORKSPACE TAKES ITS SCREEN BACK from a STEP that had it (a card's
 * Hydronetwork advance — an overlay frame of this same stack).
 *
 * This is the yield's reverse, and it is NOT a transition: the workspace never
 * left, so there is no `@enter` to hang it on — it dissolved its body in place
 * and kept its header. So it comes back the way every deeper layer in this
 * console does: the content CASCADES from inside, while the one carried object
 * is left alone — its travel home is `carryAnchorsHome`'s, and two owners on
 * one transform is how a card ends up wearing whichever finished last.
 *
 * The flat 200 ms opacity transition this replaces could not do the job: the
 * carried card lives INSIDE the fading subtree and `opacity` is multiplicative,
 * so the one object that must never blink blinked with everything else.
 */
export function playActionCarryReturn(root: Element | null | undefined): void {
  if (root === null || root === undefined || typeof window === 'undefined') {
    return;
  }
  const groups = Array.from(root.querySelectorAll<HTMLElement>('[data-unfold-item]'))
    .filter((n) => n.querySelector('[data-motion-anchor]') === null && !n.hasAttribute('data-motion-anchor'));
  if (groups.length === 0 || consoleReducedMotionActive()) {
    return;
  }
  descendCascade(gsap.timeline(), groups, s(CASCADE_MS), 0);
}

/** Cancelled-pair hooks: drop the dead tween and restore the browse layer to
 *  the direction the element is ACTUALLY taking. */
export function actionFocusEnterCancelledHook(el: Element): void {
  killDescendEpisode(el);
}

export function actionFocusLeaveCancelledHook(el: Element): void {
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
