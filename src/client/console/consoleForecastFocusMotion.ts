/*
 * FORECAST FOCUS MOTION — the composer ⇄ «Эффекты» layer choreography of the
 * card-play and blue-action composers, spoken in the WORKSPACE DESCEND
 * grammar (surfaceMotion/workspaceDescend.ts).
 *
 * A sibling of `consoleEffectsFocusMotion.ts` with the element roles
 * re-pointed at the composer's own selectors and the armed-rect keys renamed
 * (`forecast-*` — the descend registries are name-keyed, and the effects
 * explorer's own dossier phrase runs INSIDE this layer with its `effect-*`
 * keys). The phrase is the one the console speaks everywhere: COMMIT (the
 * CSS `--descend` flare on the «Сработает» row) → RELEASE (the row's own
 * content dissolves in place) → the composer's work column RECEDES into the
 * press point → UNFOLD (the layer's panel opens from the row's rect) →
 * REVEAL (the explorer's zones cascade from inside) — and B / R3 reverse it.
 *
 * NOTHING ELSE MOVES: the composer's hero card, the frame, the rail and the
 * command bar stand still; the column is parked (`autoAlpha`), never
 * unmounted, so the payment, the chosen branch and the cursor survive the
 * trip by construction.
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
} from '@/client/console/surfaceMotion/workspaceDescend';

// ── timings (value-mirror of the effects / action focus phrase) ─────────────

const RELEASE_MS = 120;
const BROWSE_OUT_MS = 170;
const BROWSE_IN_MS = 180;
const UNFOLD_MS = 280;
const FOLD_MS = 200;
const CASCADE_MS = 175;
const CASCADE_OUT_MS = 90;
const UNFOLD_AT_MS = 70;

// ── the armed origins (forecast-* keys — never shared with any other phrase) ──

const ROW_KEY = 'forecast-row';
const PRESS_KEY = 'forecast-press';

/** The «Сработает» row's rect + the press point, armed SYNCHRONOUSLY in the
 *  R3 / click handler (armed rects expire in 1 s). */
export function armForecastRow(rect: {left: number, top: number, width: number, height: number} | undefined): void {
  armDescendRect(ROW_KEY, rect);
  if (rect !== undefined) {
    armDescendOrigin(PRESS_KEY, {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2});
  }
}

/** The rect the layer's panel unfolded FROM — the fold's destination. */
let unfoldedFrom: {rect: {left: number, top: number, width: number, height: number}, radius: number | undefined} | undefined;

/** One-shot: the NEXT leave resolves instantly (the composer is leaving too). */
let instantFold = false;

export function armForecastInstantFold(): void {
  instantFold = true;
}

export function resetForecastFocusMotion(): void {
  unfoldedFrom = undefined;
  instantFold = false;
}

// ── element resolution ──────────────────────────────────────────────────────

/** The composer hosting the layer. */
function composerOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('.con-composer');
}

/** The composer's WORK COLUMN content — what parks under the layer. */
function browseOf(el: Element): HTMLElement | null {
  return composerOf(el)?.querySelector<HTMLElement>('[data-forecast-browse]') ?? null;
}

/** The pressed «Сработает» row. */
function rowOf(el: Element): HTMLElement | null {
  return composerOf(el)?.querySelector<HTMLElement>('[data-forecast-row]') ?? null;
}

function rowContentOf(el: Element): Array<HTMLElement> {
  const row = rowOf(el);
  return row === null ? [] : Array.from(row.children) as Array<HTMLElement>;
}

/** The layer's panel — the unfold surface. */
function surfaceOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-forecast-surface]');
}

/** The explorer's zones — the reveal cascade (its own dossier phrase keeps
 *  its `[data-unfold-item]`s for the deeper level). */
function cascadeItemsOf(el: Element): Array<HTMLElement> {
  return Array.from(el.querySelectorAll<HTMLElement>('.con-efx__filters, .con-efx__order, .con-efx__detail, .con-efx__list'));
}

/** A hidden / unlaid-out composer has no live geometry — resolve instantly. */
function hiddenAway(el: Element): boolean {
  return el instanceof HTMLElement && el.offsetParent === null && getComputedStyle(el).position !== 'fixed';
}

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/** Restore the parked column + the released row content to rest. */
function restoreBrowse(el: Element): void {
  const browse = browseOf(el);
  if (browse !== null) {
    gsap.set(browse, {autoAlpha: 1, clearProps: 'transform,opacity,visibility'});
  }
  const content = rowContentOf(el);
  if (content.length > 0) {
    gsap.set(content, {clearProps: 'transform,opacity,visibility'});
  }
}

// ── the enter hook (composer → layer: the SURFACE UNFOLD) ───────────────────

export function forecastFocusEnterHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || hiddenAway(el)) {
    killDescendEpisode(el);
    done();
    return;
  }
  const browse = browseOf(el);
  const surface = surfaceOf(el);
  const items = cascadeItemsOf(el);
  const content = rowContentOf(el);
  const row = rowOf(el);
  const rowRect = takeDescendRect(ROW_KEY) ?? descendRectOf(row);
  const rowRadius = descendRadiusOf(row);
  unfoldedFrom = rowRect === undefined ? undefined : {rect: rowRect, radius: rowRadius};

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
  guardedDescend(el, UNFOLD_AT_MS + UNFOLD_MS + 240, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. RELEASE — the row's own content dissolves where it stands (the
    //    commit pulse plays under it through the CSS `--descend` class).
    descendRelease(tl, content, s(RELEASE_MS), 0);
    // 2. The work column RECEDES into the press point.
    if (browse !== null) {
      descendRecede(tl, browse, pressPoint, s(BROWSE_OUT_MS), s(40));
    }
    // 3. UNFOLD — the layer's panel opens FROM the row's rect.
    const unfolded = surface !== null &&
      descendUnfold(tl, surface, rowRect, s(UNFOLD_MS), s(UNFOLD_AT_MS), rowRadius);
    if (surface !== null && !unfolded) {
      tl.fromTo(surface,
        {autoAlpha: 0, y: descendPx(10)},
        {autoAlpha: 1, y: 0, duration: s(CASCADE_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, s(UNFOLD_AT_MS));
    }
    // 4. REVEAL — the explorer's zones surface from inside the opening panel.
    descendCascade(tl, items, s(CASCADE_MS), s(UNFOLD_AT_MS + 100));
    return tl;
  });
}

// ── the leave hook (layer → composer — B / R3) ──────────────────────────────

export function forecastFocusLeaveHook(el: Element, done: () => void): void {
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
  const surface = surfaceOf(el);
  const items = cascadeItemsOf(el);
  const content = rowContentOf(el);
  const home = unfoldedFrom;
  unfoldedFrom = undefined;

  // The row's content comes back with the column (it was released, not
  // moved) — restoring it now is invisible: the column is still receded.
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

  guardedDescend(el, FOLD_MS + BROWSE_IN_MS + 140, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. The zones let go in place.
    descendCascadeOut(tl, items, s(CASCADE_OUT_MS), 0);
    // 2. FOLD — the panel collapses back into the row it opened from.
    const folded = surface !== null &&
      descendFold(tl, surface, home?.rect, s(FOLD_MS), s(50), home?.radius);
    tl.to(el, {autoAlpha: 0, duration: s(folded ? 90 : 110), ease: 'power2.in'}, s(folded ? FOLD_MS - 20 : 0));
    // 3. The work column BREATHES BACK from the press point.
    if (browse !== null) {
      descendReturn(tl, browse, s(BROWSE_IN_MS), s(40));
    }
    return tl;
  });
}

/** Cancelled-pair hooks: drop the dead tween and restore the direction the
 *  element is ACTUALLY taking. */
export function forecastFocusEnterCancelledHook(el: Element): void {
  killDescendEpisode(el);
}

export function forecastFocusLeaveCancelledHook(el: Element): void {
  killDescendEpisode(el);
  // A cancelled leave means the layer STAYS — re-park the column and the
  // released row content (the enter hook's end state).
  const browse = browseOf(el);
  if (browse !== null) {
    descendParkLayer(browse);
  }
  const content = rowContentOf(el);
  if (content.length > 0) {
    gsap.set(content, {autoAlpha: 0});
  }
  const surface = surfaceOf(el);
  if (surface !== null) {
    gsap.set(surface, {clearProps: 'clipPath,webkitClipPath'});
  }
}
