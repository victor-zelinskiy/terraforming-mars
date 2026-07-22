/*
 * ACTION FOCUS MOTION — the browse ⇄ focus choreography of the console
 * Action Browser (ConsoleCardActions.vue).
 *
 * Entering the ACTION FOCUS stage is NOT a modal popping over the grid — the
 * SAME frame recomposes around the chosen action: the browse content (filters
 * + list + inspector) yields the stage, the inspector's card THUMBNAIL
 * physically FLIPs into the focus stage's hero card slot, and the decision
 * column rises as the natural continuation. B reverses the same movement —
 * the hero card FLIPs back into the inspector thumbnail and the grid returns
 * exactly as it was (its DOM is only hidden, never unmounted).
 *
 * Follows the surfaceMotionDirector idioms verbatim: transform/opacity-only,
 * per-element episode guards + safety timers (`done()` can never be dropped),
 * durations through `motionMs`, px offsets × `conUiScale`, FLIP deltas
 * compensated by the CSS-`zoom` context (`effZoom = rect.width/offsetWidth`),
 * reduced motion = short functional fades with unchanged semantics.
 *
 * The stage element keeps `data-motion-surface="action-composer"` for the
 * AWAITING handoff (the departure capture + the phase FLIP into the reveal /
 * task host are surface-motion's job, untouched here) — these hooks own only
 * the INTERNAL browse ⇄ focus transition, which surface motion's generic
 * open/dismiss vocabulary cannot express (it doesn't know about the browse
 * layer or the thumbnail).
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {isConsoleHandPickActive} from '@/client/console/consoleHandPick';
import {isPlayedTableauPickActive} from '@/client/console/played/playedCategoryView';

// ── timings (1080-logical ms; motionMs folds the speed preset) ──────────────

/** The browse layer letting go (filters + grid + inspector). */
const BROWSE_OUT_MS = 130;
/** The browse layer returning on B. */
const BROWSE_IN_MS = 160;
/** The decision column's rise (the stage assembling around the card). */
const STAGE_IN_MS = 200;
/** The stage letting go on B. */
const STAGE_OUT_MS = 110;
/** The card FLIP (thumbnail ⇄ hero) — the longest beat; the eye follows it. */
const CARD_FLIP_MS = 300;
const CARD_FLIP_BACK_MS = 260;
/** Safety slack added to every hook's guarantee timer. */
const SAFETY_SLACK_MS = 450;

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

// ── the armed origin (the thumbnail rect at the moment of the A press) ──────

const ORIGIN_FRESH_MS = 1000;

let armedOrigin: {rect: {left: number, top: number, width: number, height: number}, at: number} | undefined;

/** Called by the browser right before mounting the focus stage: remember the
 *  inspector thumbnail's viewport rect so the enter hook can FLIP from it. */
export function armActionFocusOrigin(rect: {left: number, top: number, width: number, height: number} | undefined): void {
  armedOrigin = rect === undefined || rect.width < 10 || rect.height < 10 ?
    undefined : {rect, at: Date.now()};
}

function takeActionFocusOrigin(): {left: number, top: number, width: number, height: number} | undefined {
  const armed = armedOrigin;
  armedOrigin = undefined;
  if (armed === undefined || Date.now() - armed.at > ORIGIN_FRESH_MS) {
    return undefined;
  }
  return armed.rect;
}

/** Game-switch / unmount boundary. */
export function resetActionFocusMotion(): void {
  armedOrigin = undefined;
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

/** The pick bridges hide the WHOLE center via v-show; a focus unmount during
 *  one (prompt-change teardown) has no live geometry — resolve instantly. */
function hiddenByBridge(el: Element): boolean {
  return isConsoleHandPickActive() || isPlayedTableauPickActive() ||
    (el instanceof HTMLElement && el.offsetParent === null && getComputedStyle(el).position !== 'fixed');
}

// ── episode guard (surfaceMotionDirector's `guarded` idiom) ─────────────────

const liveTweens = new WeakMap<Element, gsap.core.Timeline | gsap.core.Tween>();

function killLive(el: Element): void {
  liveTweens.get(el)?.kill();
  liveTweens.delete(el);
}

function guarded(
  el: Element,
  totalMs: number,
  done: () => void,
  body: (finish: () => void) => gsap.core.Timeline | gsap.core.Tween | undefined,
): void {
  killLive(el);
  let finished = false;
  let safety = 0;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    window.clearTimeout(safety);
    liveTweens.delete(el);
    done();
  };
  const tween = body(finish);
  if (tween === undefined) {
    finish();
    return;
  }
  liveTweens.set(el, tween);
  safety = window.setTimeout(finish, motionMs(totalMs) + SAFETY_SLACK_MS);
}

/** Transform-only FLIP args from an old viewport rect into an element's
 *  CURRENT box, compensated for the CSS `zoom:` context the element sits in
 *  (transform px inside a zoomed subtree are rescaled by the browser). */
function flipFrom(el: HTMLElement, from: {left: number, top: number, width: number, height: number}):
  {x: number, y: number, scale: number} | undefined {
  const to = el.getBoundingClientRect();
  if (to.width < 10 || to.height < 10) {
    return undefined;
  }
  const scale = from.width / to.width;
  if (!isFinite(scale) || scale <= 0) {
    return undefined;
  }
  const effZoom = el.offsetWidth > 0 ? to.width / el.offsetWidth : 1;
  return {
    x: (from.left - to.left) / effZoom,
    y: (from.top - to.top) / effZoom,
    scale,
  };
}

// ── the enter hook (browse → focus) ─────────────────────────────────────────

export function actionFocusEnterHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || hiddenByBridge(el)) {
    killLive(el);
    done();
    return;
  }
  const browse = browseOf(el);
  const thumb = thumbOf(el);
  const heroCard = heroCardOf(el);
  const column = stageColumnOf(el);

  if (consoleReducedMotionActive()) {
    guarded(el, 160, done, (finish) => {
      if (browse !== null) {
        gsap.set(browse, {autoAlpha: 0});
      }
      return gsap.fromTo(el, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.1, ease: 'power1.out', clearProps: 'opacity,visibility', onComplete: finish});
    });
    return;
  }

  const origin = takeActionFocusOrigin();
  guarded(el, CARD_FLIP_MS + 100, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. The browse layer yields — a short, confident recede. The thumbnail
    //    goes dark INSTANTLY: the flying hero card IS that card now (one
    //    physical object, never a double image).
    if (thumb !== null) {
      gsap.set(thumb, {opacity: 0});
    }
    if (browse !== null) {
      tl.to(browse, {autoAlpha: 0, x: -14 * conUiScale(), duration: s(BROWSE_OUT_MS), ease: 'power2.in', overwrite: 'auto'}, 0);
    }
    // 2. The hero card FLIPs from the thumbnail's rect into its stage home.
    if (heroCard !== null) {
      const from = origin !== undefined ? flipFrom(heroCard, origin) : undefined;
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
    // 3. The decision column rises as the stage assembles around the card.
    if (column !== null) {
      tl.fromTo(column,
        {autoAlpha: 0, y: 12 * conUiScale()},
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
    killLive(el);
    done();
    return;
  }
  const browse = browseOf(el);
  const thumb = thumbOf(el);
  const heroCard = heroCardOf(el);

  if (consoleReducedMotionActive()) {
    guarded(el, 140, done, (finish) => {
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

  // Capture the hero card's live rect BEFORE anything moves — the thumbnail
  // FLIPs back from it.
  const heroRect = heroCard?.getBoundingClientRect();
  guarded(el, CARD_FLIP_BACK_MS + 100, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // The single physical card: the stage copy goes dark the moment the
    // thumbnail starts flying home.
    if (heroCard !== null) {
      gsap.set(heroCard, {opacity: 0});
    }
    tl.to(el, {autoAlpha: 0, y: 8 * conUiScale(), duration: s(STAGE_OUT_MS), ease: 'power2.in'}, 0);
    if (browse !== null) {
      tl.to(browse, {autoAlpha: 1, x: 0, duration: s(BROWSE_IN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility', overwrite: 'auto'}, s(30));
    }
    if (thumb !== null) {
      gsap.set(thumb, {clearProps: 'opacity'});
      if (heroRect !== undefined && heroRect.width >= 10) {
        const from = flipFrom(thumb, heroRect);
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

/** Cancelled-pair hooks: drop the dead tween and restore the browse layer to
 *  the direction the element is ACTUALLY taking. */
export function actionFocusEnterCancelledHook(el: Element): void {
  killLive(el);
}

export function actionFocusLeaveCancelledHook(el: Element): void {
  killLive(el);
  // A cancelled leave means the stage STAYS — re-hide the browse layer and
  // the thumbnail (the enter hook's end state).
  const browse = browseOf(el);
  if (browse !== null) {
    gsap.set(browse, {autoAlpha: 0, x: -14 * conUiScale()});
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
