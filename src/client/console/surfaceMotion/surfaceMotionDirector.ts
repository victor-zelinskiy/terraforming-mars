/*
 * CONSOLE SURFACE MOTION — the GSAP runtime (the director).
 *
 * The DOM half of the surface-motion system: a pair of Vue `<transition
 * :css="false">` hooks the shell binds to every MIGRATED band surface. The
 * hooks read `data-motion-surface` off the element, resolve the transition
 * kind through the PURE model (+ the store's departure / wheel-origin
 * captures) and play a short compositor-only choreography. Contracts
 * (playedCategoryDirector / consoleZoomMotion idioms):
 *
 *  - transform/opacity ONLY, on the surface's `[data-motion-panel]` (falling
 *    back to the root); the fixed band root itself is never animated, so the
 *    full-viewport geometry the fit engines measure stays put;
 *  - every hook is EPISODE-GUARDED (a per-element kill + a safety timer) —
 *    `done()` always fires, a stalled rAF can never wedge Vue's transition
 *    bookkeeping, a rapid re-open kills the previous tween mid-flight and
 *    continues from the live values;
 *  - durations resolve through `motionMs` (speed presets scale in lockstep);
 *    reduced motion snaps to the end state (a short opacity beat at most);
 *  - the shade owner registry is driven HERE (enter registers, leave
 *    releases) so the one `.con-shade` dim can never double or blink across
 *    a swap — the CSS transition on the shade does the rest;
 *  - a surface hidden by the hand/tableau PICK bridge (v-show) triggers the
 *    same hooks — those are recognized (isPickBridgeHidden) and resolved
 *    instantly: the pick's own hand choreography owns that beat.
 *
 * PHASE entries (composer → reveal result) additionally FLIP every anchor
 * (`data-motion-anchor` id matched against the captured departure) from its
 * old viewport rect into its new one — the source card physically travels
 * between the stages of one operation instead of blinking.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {isConsoleHandPickActive} from '@/client/console/consoleHandPick';
import {isPlayedTableauPickActive} from '@/client/console/played/playedCategoryView';
import {
  SurfaceMotionId,
  SurfaceDeparture,
} from '@/client/console/surfaceMotion/surfaceMotionModel';
import {
  addShadeOwner,
  removeShadeOwner,
  isAnchorHandoffLive,
  takeSurfaceDeparture,
  takeWheelOrigin,
  takeWheelChosenSlot,
} from '@/client/console/surfaceMotion/surfaceMotionState';

// ── timings (1080-logical ms; motionMs folds the speed preset) ──────────────

/** First appearance of a band surface. */
const OPEN_MS = 210;
/** Final exit of a band surface. */
const DISMISS_MS = 140;
/** The continuation entry of a phase handoff (faster than an open — the
 *  scene is already established; only the stage recomposes). */
const PHASE_MS = 190;
/** The anchor FLIP rides slightly longer than the panel so the travelling
 *  card is the last thing to settle — the eye follows it. */
const PHASE_ANCHOR_MS = 300;
/** The outgoing side of an ordinary handoff. */
const HANDOFF_OUT_MS = 110;
/** The wheel family — mechanical, immediate. */
const WHEEL_IN_MS = 120;
const WHEEL_OUT_MS = 95;
const WHEEL_SLOT_STAGGER_S = 0.011;
/** Safety slack added to every hook's guarantee timer. */
const SAFETY_SLACK_MS = 450;

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/** A press mid-bridge (hand/tableau pick hides the composer via v-show) —
 *  those "transitions" are the bridge's own beat, never ours. */
function isPickBridgeHidden(): boolean {
  return isConsoleHandPickActive() || isPlayedTableauPickActive();
}

/**
 * Surfaces that NEVER own the shade:
 *  - the action composer is a CHILD layer of the action center (whose
 *    ownership already dims the stage) — and a child's leave hook never
 *    fires when its parent unmounts wholesale, so a child ownership would
 *    leak past the parent's teardown; the center's `--behind` recession
 *    carries its extra depth instead;
 *  - the MA screen + the generic bottom sheet keep their own LIGHT dims by
 *    design (0.34 quick-glance / bottom-sheet 0.6 — the board must stay
 *    readable behind them), so the full shade must not stack on top;
 *  - Info Mode is a Y-layer that opens OVER arbitrary surfaces (z 11560,
 *    above the shade) and carries its own full dim;
 *  - a SECTION (colonies / hydro) is a workspace, not a modal — no dim.
 */
const NON_SHADE_OWNERS: ReadonlySet<SurfaceMotionId> = new Set([
  'action-composer', 'ma-screen', 'sheet', 'info-mode', 'section',
]);

function surfaceIdOf(el: Element): SurfaceMotionId | undefined {
  const id = (el as HTMLElement).dataset?.motionSurface;
  return id === undefined || id === '' ? undefined : (id as SurfaceMotionId);
}

function panelOf(el: Element): HTMLElement | undefined {
  const panel = el.querySelector<HTMLElement>('[data-motion-panel]');
  return panel ?? (el instanceof HTMLElement ? el : undefined);
}

/** EVERY panel under the root — a departing action center carries its open
 *  composer with it (the composer's own transition never fires when the
 *  parent unmounts), so the leave must move BOTH panels as one. */
function panelsOf(el: Element): Array<HTMLElement> {
  const panels = [...el.querySelectorAll<HTMLElement>('[data-motion-panel]')];
  if (panels.length > 0) {
    return panels;
  }
  return el instanceof HTMLElement ? [el] : [];
}

/** The per-element live tween registry — a new hook on the same element
 *  kills the previous episode and continues from the live values. */
const liveTweens = new WeakMap<Element, gsap.core.Timeline | gsap.core.Tween>();

function killLive(el: Element): void {
  liveTweens.get(el)?.kill();
  liveTweens.delete(el);
}

/**
 * Run `body` with a guaranteed completion: `finish` is once-gated, wired to
 * the returned timeline's onComplete AND a safety timer. The hook's `done`
 * can therefore never be dropped (Vue would otherwise strand the element).
 */
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

// ── the enter hook ──────────────────────────────────────────────────────────

/**
 * Vue `@enter` for a migrated band surface. Resolves the entry kind:
 *  - a fresh departure capture linking to this surface → PHASE continuation
 *    (+ anchor FLIPs);
 *  - a fresh wheel origin → directional entry from the chosen slot;
 *  - the quick wheel itself → the mechanical wheel-open;
 *  - otherwise → the standard open rise.
 */
export function surfaceEnterHook(el: Element, done: () => void): void {
  const id = surfaceIdOf(el);
  if (id === undefined || typeof window === 'undefined') {
    done();
    return;
  }
  // The reveal's headless variant renders nothing (the fullscreen dialog owns
  // the presentation) and the drawn variant is choreographed by its own draw
  // cinematic (deal-in slots, bonus veils) — the band motion must not touch
  // their opacity. They still own the shade (drawn) or not (headless).
  const variant = (el as HTMLElement).dataset?.motionVariant;
  if (variant !== 'headless' && !NON_SHADE_OWNERS.has(id)) {
    addShadeOwner(id);
  }
  // A pick-bridge re-show (v-show flip back) is NOT an entrance — the
  // re-shown surface must cover the section switch in the same frame.
  const pickReturn = (el as HTMLElement).dataset?.motionPickHidden === '1';
  if (pickReturn) {
    delete (el as HTMLElement).dataset.motionPickHidden;
  }
  if (isPickBridgeHidden() || pickReturn || variant === 'headless' || variant === 'drawn') {
    killLive(el);
    done();
    return;
  }
  const panel = panelOf(el);
  if (panel === undefined) {
    done();
    return;
  }
  const reduced = consoleReducedMotionActive();
  const departure = takeSurfaceDeparture(id);
  const wheelOrigin = id === 'quick' ? undefined : takeWheelOrigin();
  const kind = departure !== undefined ? 'phase' :
    id === 'quick' ? 'wheel-open' :
      wheelOrigin !== undefined ? 'wheel-handoff' : 'open';

  if (reduced) {
    // Reduced motion: no travel — a short functional fade only.
    guarded(el, 160, done, (finish) => {
      gsap.set(panel, {clearProps: 'transform,opacity,visibility'});
      return gsap.fromTo(panel, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.12, ease: 'power1.out', onComplete: finish});
    });
    return;
  }

  // The generic bottom sheet keeps its authored character: it RISES from the
  // bar band (the retired `con-sheet-up` CSS re-expressed here so the GSAP
  // runtime owns the property, never fighting a CSS animation).
  if (id === 'sheet' && kind === 'open') {
    guarded(el, 230, done, (finish) => gsap.fromTo(panel,
      {autoAlpha: 0, y: 26 * conUiScale()},
      {autoAlpha: 1, y: 0, duration: s(220), ease: 'expo.out', clearProps: 'transform,opacity,visibility', onComplete: finish}));
    return;
  }

  switch (kind) {
  case 'phase':
    enterPhase(el, panel, departure as SurfaceDeparture, done);
    return;
  case 'wheel-open':
    guarded(el, WHEEL_IN_MS + 120, done, (finish) => {
      const tl = gsap.timeline({onComplete: finish});
      tl.fromTo(panel,
        {autoAlpha: 0, scale: 0.955, transformOrigin: '50% 58%'},
        {autoAlpha: 1, scale: 1, duration: s(WHEEL_IN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, 0);
      // The slots materialize in a micro-cascade — transform-only, subtle.
      const slots = el.querySelectorAll<HTMLElement>('.con-quick__slot');
      if (slots.length > 0) {
        tl.fromTo(slots,
          {y: 7 * conUiScale(), opacity: 0},
          {y: 0, opacity: 1, duration: s(110), ease: 'power2.out', stagger: WHEEL_SLOT_STAGGER_S, clearProps: 'transform,opacity'}, s(20));
      }
      return tl;
    });
    return;
  case 'wheel-handoff': {
    // Directional entry: the surface rises FROM the chosen slot's direction —
    // the wheel's impulse carries into the next screen.
    const origin = wheelOrigin as {x: number, y: number};
    guarded(el, OPEN_MS, done, (finish) => {
      const rect = panel.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = origin.x - cx;
      const dy = origin.y - cy;
      const len = Math.max(1, Math.hypot(dx, dy));
      const push = Math.min(18 * conUiScale(), len * 0.08);
      return gsap.fromTo(panel,
        {autoAlpha: 0, x: (dx / len) * push, y: (dy / len) * push, scale: 0.985, transformOrigin: '50% 50%'},
        {autoAlpha: 1, x: 0, y: 0, scale: 1, duration: s(OPEN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility', onComplete: finish});
    });
    return;
  }
  default:
    guarded(el, OPEN_MS, done, (finish) => gsap.fromTo(panel,
      {autoAlpha: 0, y: 14 * conUiScale(), scale: 0.986, transformOrigin: '50% 62%'},
      {autoAlpha: 1, y: 0, scale: 1, duration: s(OPEN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility', onComplete: finish}));
  }
}

/**
 * PHASE continuation: the panel enters as the next stage of the SAME scene —
 * a soft directional recompose from the outgoing panel's centre — while every
 * shared anchor FLIPs from its captured rect into its new home (the source
 * card travels; the eye keeps its object).
 */
function enterPhase(el: Element, panel: HTMLElement, dep: SurfaceDeparture, done: () => void): void {
  guarded(el, PHASE_ANCHOR_MS + 80, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    const rect = panel.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (dep.panel !== undefined) {
      dx = (dep.panel.left + dep.panel.width / 2) - (rect.left + rect.width / 2);
      dy = (dep.panel.top + dep.panel.height / 2) - (rect.top + rect.height / 2);
    }
    const cap = 26 * conUiScale();
    const clamp = (v: number) => Math.max(-cap, Math.min(cap, v * 0.16));
    tl.fromTo(panel,
      {autoAlpha: 0, x: clamp(dx), y: clamp(dy), scale: 0.99, transformOrigin: '50% 50%'},
      {autoAlpha: 1, x: 0, y: 0, scale: 1, duration: s(PHASE_MS), ease: 'power3.out', clearProps: 'transform,opacity,visibility'}, 0);

    // Anchor FLIPs — matched by id against the capture. Transform-only:
    // translate from the old rect's top-left + scale by the width ratio.
    // ZOOM COMPENSATION: card slots live inside CSS `zoom:` contexts (the
    // reveal source is zoomed 0.92×uiScale) which rescale a child's
    // transform pixels — viewport-px deltas must be divided by the
    // effective zoom (visual width / layout width) or the card undershoots.
    for (const anchorEl of el.querySelectorAll<HTMLElement>('[data-motion-anchor]')) {
      const anchorId = anchorEl.dataset.motionAnchor;
      const from = anchorId !== undefined ? dep.anchors.get(anchorId) : undefined;
      if (from === undefined) {
        continue;
      }
      const to = anchorEl.getBoundingClientRect();
      if (to.width < 10 || to.height < 10) {
        continue;
      }
      const scale = from.width / to.width;
      if (!isFinite(scale) || scale <= 0) {
        continue;
      }
      const effZoom = anchorEl.offsetWidth > 0 ? to.width / anchorEl.offsetWidth : 1;
      tl.fromTo(anchorEl,
        {x: (from.left - to.left) / effZoom, y: (from.top - to.top) / effZoom, scale, transformOrigin: 'top left', opacity: 1},
        {x: 0, y: 0, scale: 1, duration: s(PHASE_ANCHOR_MS), ease: 'power3.inOut', clearProps: 'transform'}, 0);
    }
    return tl;
  });
}

// ── the leave hook ──────────────────────────────────────────────────────────

/**
 * Vue `@leave` for a migrated band surface. The wheel's leave distinguishes
 * a plain dismiss from a slot handoff (the chosen slot flashes its impulse);
 * every other surface departs with a short, confident drop. The shade owner
 * releases IMMEDIATELY (the shade's own CSS fade runs in parallel — or holds,
 * when the next owner registered in the same flush).
 */
export function surfaceLeaveHook(el: Element, done: () => void): void {
  const id = surfaceIdOf(el);
  if (id === undefined || typeof window === 'undefined') {
    done();
    return;
  }
  removeShadeOwner(id);
  const variant = (el as HTMLElement).dataset?.motionVariant;
  if (isPickBridgeHidden()) {
    // The pick bridge hides the surface via v-show — mark it so the flip
    // BACK is recognized as a re-show (instant), not a fresh entrance.
    (el as HTMLElement).dataset.motionPickHidden = '1';
    killLive(el);
    done();
    return;
  }
  if (variant === 'headless') {
    killLive(el);
    done();
    return;
  }
  const panels = panelsOf(el);
  const panel = panels[0];
  if (panel === undefined) {
    done();
    return;
  }
  // An anchored FLIP is claiming this surface's card (composer → reveal):
  // blank the departing anchors instantly so the travelling card exists on
  // the INCOMING side only — never a double image.
  if (isAnchorHandoffLive()) {
    const anchors = el.querySelectorAll<HTMLElement>('[data-motion-anchor]');
    if (anchors.length > 0) {
      gsap.set(anchors, {opacity: 0});
    }
  }
  if (consoleReducedMotionActive()) {
    guarded(el, 140, done, (finish) => gsap.to(panels, {autoAlpha: 0, duration: 0.1, ease: 'power1.in', onComplete: finish}));
    return;
  }
  if (id === 'quick') {
    const chosen = takeWheelChosenSlot();
    guarded(el, WHEEL_OUT_MS + 80, done, (finish) => {
      const tl = gsap.timeline({onComplete: finish});
      if (chosen !== undefined) {
        const chosenEl = el.querySelector<HTMLElement>(`.con-quick__slot--${chosen}`);
        const rest = [...el.querySelectorAll<HTMLElement>('.con-quick__slot')].filter((n) => n !== chosenEl);
        // The un-chosen slots let go first; the chosen one carries the
        // impulse — a brief press-forward, then it follows the panel out.
        if (rest.length > 0) {
          tl.to(rest, {opacity: 0, duration: s(65), ease: 'power1.in'}, 0);
        }
        if (chosenEl !== null) {
          tl.to(chosenEl, {scale: 1.06, duration: s(70), ease: 'power2.out'}, 0);
        }
        tl.to(panel, {autoAlpha: 0, scale: 0.985, duration: s(WHEEL_OUT_MS), ease: 'power2.in'}, s(30));
      } else {
        tl.to(panel, {autoAlpha: 0, scale: 0.972, transformOrigin: '50% 58%', duration: s(WHEEL_OUT_MS), ease: 'power2.in'}, 0);
      }
      return tl;
    });
    return;
  }
  guarded(el, DISMISS_MS, done, (finish) => gsap.to(panels, {
    autoAlpha: 0,
    y: 8 * conUiScale(),
    scale: 0.992,
    transformOrigin: '50% 60%',
    duration: s(id === 'action-composer' || id === 'card-actions' ? HANDOFF_OUT_MS : DISMISS_MS),
    ease: 'power2.in',
    onComplete: finish,
  }));
}

/** Vue `@enter-cancelled` / `@leave-cancelled` — re-align the shade owner
 *  with the element's ACTUAL direction and drop the dead tween. */
export function surfaceEnterCancelledHook(el: Element): void {
  const id = surfaceIdOf(el);
  killLive(el);
  if (id !== undefined) {
    removeShadeOwner(id);
  }
}

export function surfaceLeaveCancelledHook(el: Element): void {
  const id = surfaceIdOf(el);
  killLive(el);
  if (id !== undefined && (el as HTMLElement).dataset?.motionVariant !== 'headless' && !NON_SHADE_OWNERS.has(id)) {
    addShadeOwner(id);
  }
}
