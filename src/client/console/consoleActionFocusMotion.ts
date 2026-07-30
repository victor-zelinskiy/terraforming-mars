/*
 * ACTION FOCUS MOTION — the browse ⇄ focus choreography of the console
 * Action Browser (ConsoleCardActions.vue), spoken in the WORKSPACE DESCEND
 * grammar (surfaceMotion/workspaceDescend.ts).
 *
 * Entering the ACTION FOCUS stage is NOT a modal popping over the grid — the
 * player steps DEEPER into the same workspace at the point of commitment:
 *
 *  · the chosen slot fires its COMMIT PULSE where it stands (CSS `--descend`);
 *  · the browse layer RECEDES INTO the press point (scale + dissolve — depth,
 *    never a sideways slide);
 *  · the SEMANTIC OBJECTS are carried, not replaced: the inspector's card
 *    thumbnail FLIPs into the stage's hero card, and the chosen slot's ACTION
 *    GRAPHIC FLIPs into the stage's action strip — the exact formula the
 *    player pressed lands in the deeper layer;
 *  · B reverses the same phrase: the stage yields, the objects FLIP home,
 *    the browse layer breathes back from the same origin.
 *
 * Follows the surfaceMotionDirector idioms verbatim: transform/opacity-only,
 * guarded episodes (`done()` can never be dropped), durations through
 * `motionMs`, FLIP deltas compensated for CSS-`zoom` contexts, reduced
 * motion = short functional fades with unchanged semantics.
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
import {isPlayedTableauPickActive} from '@/client/console/played/playedCategoryView';
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
  descendPx,
  resetWorkspaceDescend,
} from '@/client/console/surfaceMotion/workspaceDescend';

// ── timings (1080-logical ms; motionMs folds the speed preset) ──────────────

/** The browse layer receding into the press point. */
const BROWSE_OUT_MS = 150;
/** The browse layer breathing back on B. */
const BROWSE_IN_MS = 170;
/** The decision column's rise (the stage assembling around the card). */
const STAGE_IN_MS = 200;
/** The stage letting go on B. */
const STAGE_OUT_MS = 110;
/** The card FLIP (thumbnail ⇄ hero) — the longest beat; the eye follows it. */
const CARD_FLIP_MS = 300;
const CARD_FLIP_BACK_MS = 260;
/** The action graphic's carry (slot ⇄ the stage's action strip). */
const GRAPHIC_FLIP_MS = 260;

// ── the armed thumbnail origin (the card-face carry) ────────────────────────

const THUMB_KEY = 'action-thumb';

/** Called by the browser right before mounting the focus stage: remember the
 *  inspector thumbnail's viewport rect so the enter hook can FLIP from it. */
export function armActionFocusOrigin(rect: {left: number, top: number, width: number, height: number} | undefined): void {
  armDescendRect(THUMB_KEY, rect);
}

/** Game-switch / unmount boundary. */
export function resetActionFocusMotion(): void {
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

function stageColumnOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('.con-composer__actright');
}

/** The stage's ACTION STRIP — the deeper home of the pressed formula. */
function actionStripOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-action-strip]');
}

/** The FOCUSED slot's graphic in the browse grid (the carry's home). */
function slotGraphicOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-cardactions__tile--focused .con-cardactions__graphic') ?? null;
}

/** The pick bridges hide the WHOLE center via v-show; a focus unmount during
 *  one (prompt-change teardown) has no live geometry — resolve instantly. */
function hiddenByBridge(el: Element): boolean {
  return isConsoleHandPickActive() || isPlayedTableauPickActive() ||
    (el instanceof HTMLElement && el.offsetParent === null && getComputedStyle(el).position !== 'fixed');
}

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

// ── the enter hook (browse → focus: the DESCENT) ────────────────────────────

export function actionFocusEnterHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || hiddenByBridge(el)) {
    killDescendEpisode(el);
    done();
    return;
  }
  const browse = browseOf(el);
  const thumb = thumbOf(el);
  const heroCard = heroCardOf(el);
  const column = stageColumnOf(el);
  const strip = actionStripOf(el);

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
  const graphicRect = takeDescendRect('action-graphic');
  guardedDescend(el, CARD_FLIP_MS + 120, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. The browse layer RECEDES INTO the press point — the commit pulse on
    //    the chosen slot plays inside this dissolve (CSS `--descend`). The
    //    thumbnail goes dark INSTANTLY: the flying hero card IS that card now
    //    (one physical object, never a double image).
    if (thumb !== null) {
      gsap.set(thumb, {opacity: 0});
    }
    if (browse !== null) {
      descendRecede(tl, browse, pressPoint, s(BROWSE_OUT_MS), 0);
    }
    // 2. The hero card FLIPs from the thumbnail's rect into its stage home.
    if (heroCard !== null) {
      const from = thumbRect !== undefined ? descendFlipFrom(heroCard, thumbRect) : undefined;
      if (from !== undefined) {
        tl.fromTo(heroCard,
          {x: from.x, y: from.y, scale: from.scale, transformOrigin: 'top left'},
          {x: 0, y: 0, scale: 1, duration: s(CARD_FLIP_MS), ease: 'power3.inOut', clearProps: 'transform', overwrite: 'auto'}, 0);
      } else {
        tl.fromTo(heroCard,
          {autoAlpha: 0, scale: 0.97, transformOrigin: '50% 50%'},
          {autoAlpha: 1, scale: 1, duration: s(STAGE_IN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility', overwrite: 'auto'}, 0);
      }
    }
    // 3. The pressed ACTION GRAPHIC is CARRIED into the stage's strip — the
    //    exact object of the commitment lands in the deeper layer.
    if (strip !== null) {
      const from = graphicRect !== undefined ? descendFlipFrom(strip, graphicRect) : undefined;
      if (from !== undefined) {
        tl.fromTo(strip,
          {x: from.x, y: from.y, scale: from.scale, transformOrigin: 'top left'},
          {x: 0, y: 0, scale: 1, duration: s(GRAPHIC_FLIP_MS), ease: 'power3.inOut', clearProps: 'transform', overwrite: 'auto'}, s(20));
      } else {
        tl.fromTo(strip,
          {autoAlpha: 0, y: descendPx(8)},
          {autoAlpha: 1, y: 0, duration: s(STAGE_IN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility', overwrite: 'auto'}, s(30));
      }
    }
    // 4. The decision column rises as the stage assembles around the objects.
    if (column !== null) {
      tl.fromTo(column,
        {autoAlpha: 0, y: descendPx(12)},
        {autoAlpha: 1, y: 0, duration: s(STAGE_IN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, s(40));
    }
    return tl;
  });
}

// ── the leave hook (focus → browse; only for a CANCEL — the committed path
//    unmounts the whole center, whose own surface-motion leave carries every
//    nested panel, and this hook never fires) ─────────────────────────────────

export function actionFocusLeaveHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || hiddenByBridge(el)) {
    killDescendEpisode(el);
    done();
    return;
  }
  const browse = browseOf(el);
  const thumb = thumbOf(el);
  const heroCard = heroCardOf(el);
  const strip = actionStripOf(el);

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

  // Capture the carried objects' live rects BEFORE anything moves — their
  // browse homes FLIP back from them.
  const heroRect = heroCard?.getBoundingClientRect();
  const stripRect = strip?.getBoundingClientRect();
  guardedDescend(el, CARD_FLIP_BACK_MS + 120, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // The single physical objects: the stage copies go dark the moment their
    // browse twins start flying home.
    if (heroCard !== null) {
      gsap.set(heroCard, {opacity: 0});
    }
    tl.to(el, {autoAlpha: 0, y: descendPx(8), duration: s(STAGE_OUT_MS), ease: 'power2.in'}, 0);
    // The browse layer BREATHES BACK from the same press point it receded into.
    if (browse !== null) {
      descendReturn(tl, browse, s(BROWSE_IN_MS), s(30));
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
    // The action graphic flies home into its slot.
    const slotGraphic = slotGraphicOf(el);
    if (slotGraphic !== null && stripRect !== undefined && stripRect.width >= 10) {
      const from = descendFlipFrom(slotGraphic, stripRect);
      if (from !== undefined) {
        tl.fromTo(slotGraphic,
          {x: from.x, y: from.y, scale: from.scale, transformOrigin: 'top left'},
          {x: 0, y: 0, scale: 1, duration: s(GRAPHIC_FLIP_MS), ease: 'power3.inOut', clearProps: 'transform', overwrite: 'auto'}, s(30));
      }
    }
    return tl;
  });
}

/** Cancelled-pair hooks: drop the dead tween and restore the browse layer to
 *  the direction the element is ACTUALLY taking. */
export function actionFocusEnterCancelledHook(el: Element): void {
  killDescendEpisode(el);
}

export function actionFocusLeaveCancelledHook(el: Element): void {
  killDescendEpisode(el);
  // A cancelled leave means the stage STAYS — re-park the browse layer and
  // the thumbnail (the enter hook's end state).
  const browse = browseOf(el);
  if (browse !== null) {
    descendParkLayer(browse);
  }
  const thumb = thumbOf(el);
  if (thumb !== null) {
    gsap.set(thumb, {opacity: 0});
  }
  const heroCard = heroCardOf(el);
  if (heroCard !== null) {
    gsap.set(heroCard, {clearProps: 'opacity'});
  }
}
