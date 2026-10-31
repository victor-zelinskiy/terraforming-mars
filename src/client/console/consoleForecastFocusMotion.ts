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
 *
 * A host whose door and whose parked layers live OUTSIDE its own box (the
 * start's deployment — P79 · DI: the door on the status rail below, the queue
 * cards beside the hero and the shelf to park) ARMS them with the rect
 * (`armForecastDoor`): the phrase then releases that row, recedes those
 * layers and — the panel's clip never paints outside its own box — seeds the
 * unfold on the panel's edge right over the row, so the panel grows OUT of it.
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

/** A door armed by its host (P79 · DI): the pressed row's element and the layers to park, one-shot — consumed by the
 *  NEXT enter, expired after 1 s like the armed rects, so a stale arm never reaches a composer's phrase. */
let armedDoor: {row: HTMLElement | undefined, browse: ReadonlyArray<HTMLElement>, at: number} | undefined;
const DOOR_ARM_TTL_MS = 1000;

export function armForecastDoor(door: {row: HTMLElement | undefined, browse: ReadonlyArray<HTMLElement>}): void {
  armedDoor = {...door, at: Date.now()};
}

function takeArmedDoor(): {row: HTMLElement | undefined, browse: ReadonlyArray<HTMLElement>} | undefined {
  const door = armedDoor;
  armedDoor = undefined;
  return door !== undefined && Date.now() - door.at <= DOOR_ARM_TTL_MS ? door : undefined;
}

/** What the last enter released and parked — the leave restores exactly those (an armed host's layers are not
 *  re-findable from the layer: they live outside its host). */
let entered: {row: HTMLElement | null, browse: ReadonlyArray<HTMLElement>} | undefined;

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
  armedDoor = undefined;
  entered = undefined;
}

// ── element resolution ──────────────────────────────────────────────────────

/** The surface hosting the layer — a composer, or any stage that declares itself one (`data-forecast-host`:
 *  the fleet-dock stage). The nearest wins, so a stage nested inside a composer's flow is its own host. */
function composerOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('[data-forecast-host], .con-composer');
}

/** The composer's WORK COLUMN content — what parks under the layer. */
function browseOf(el: Element): HTMLElement | null {
  return composerOf(el)?.querySelector<HTMLElement>('[data-forecast-browse]') ?? null;
}

/** The pressed «Сработает» row. */
function rowOf(el: Element): HTMLElement | null {
  return composerOf(el)?.querySelector<HTMLElement>('[data-forecast-row]') ?? null;
}

function rowContentOf(row: HTMLElement | null): Array<HTMLElement> {
  return row === null ? [] : Array.from(row.children) as Array<HTMLElement>;
}

/** The parked layers of this layer's episode: what the enter remembered, else the host's own work column. */
function parkedOf(el: Element): ReadonlyArray<HTMLElement> {
  if (entered !== undefined) {
    return entered.browse;
  }
  const browse = browseOf(el);
  return browse === null ? [] : [browse];
}

function releasedRowOf(el: Element): HTMLElement | null {
  return entered !== undefined ? entered.row : rowOf(el);
}

type Rect = {left: number, top: number, width: number, height: number};

/**
 * The unfold's seed INSIDE the panel's box. The clip never paints outside the panel, so a door standing OUTSIDE it
 * (the start's status rail, under the deployment) would open from nothing: the seed is the row's own size, slid onto
 * the panel's nearest edge right over the row — the panel visibly grows OUT of it. A row that meets the box (every
 * composer's) is returned untouched.
 */
export function seedInside(row: Rect, box: Rect): Rect {
  const meets = row.left < box.left + box.width && row.left + row.width > box.left &&
    row.top < box.top + box.height && row.top + row.height > box.top;
  if (meets || box.width <= 0 || box.height <= 0) {
    return row;
  }
  const width = Math.min(row.width, box.width);
  const height = Math.min(row.height, box.height);
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  return {
    left: clamp(row.left, box.left, box.left + box.width - width),
    top: clamp(row.top, box.top, box.top + box.height - height),
    width,
    height,
  };
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
  for (const browse of parkedOf(el)) {
    gsap.set(browse, {autoAlpha: 1, clearProps: 'transform,opacity,visibility'});
  }
  const content = rowContentOf(releasedRowOf(el));
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
  const door = takeArmedDoor();
  const row = door?.row ?? rowOf(el);
  const parked: ReadonlyArray<HTMLElement> = door !== undefined ? door.browse : [browseOf(el)].filter((b): b is HTMLElement => b !== null);
  entered = {row, browse: parked};
  const surface = surfaceOf(el);
  const items = cascadeItemsOf(el);
  const content = rowContentOf(row);
  const armedRect = takeDescendRect(ROW_KEY) ?? descendRectOf(row);
  const surfaceRect = surface === null ? undefined : descendRectOf(surface);
  const rowRect = armedRect === undefined || surfaceRect === undefined ? armedRect : seedInside(armedRect, surfaceRect);
  const rowRadius = descendRadiusOf(row);
  unfoldedFrom = rowRect === undefined ? undefined : {rect: rowRect, radius: rowRadius};

  if (consoleReducedMotionActive()) {
    guardedDescend(el, 160, done, (finish) => {
      if (parked.length > 0) {
        gsap.set(parked, {autoAlpha: 0});
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
    // 2. The work column RECEDES into the press point (every layer an armed host parks — the same beat).
    for (const browse of parked) {
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
    entered = undefined;
    done();
    return;
  }
  const parked = parkedOf(el);
  const surface = surfaceOf(el);
  const items = cascadeItemsOf(el);
  const row = releasedRowOf(el);
  const content = rowContentOf(row);
  const home = unfoldedFrom;
  unfoldedFrom = undefined;
  // The episode's memory lives to the leave's END: a cancelled leave re-parks exactly these layers.
  const finishLeave = () => {
    entered = undefined;
    done();
  };
  // A door OUTSIDE the host (the start's status rail) stays in plain view while the panel folds into it: its content
  // comes back AT the fold's end — the panel went back into the row. A composer's row sits under its receded column,
  // where restoring it now is invisible.
  const rowInView = row !== null && composerOf(el)?.contains(row) !== true;
  if (content.length > 0 && !rowInView) {
    gsap.set(content, {clearProps: 'transform,opacity,visibility'});
  }

  if (consoleReducedMotionActive()) {
    guardedDescend(el, 140, finishLeave, (finish) => {
      for (const browse of parked) {
        gsap.set(browse, {autoAlpha: 1, clearProps: 'transform,opacity,visibility'});
      }
      if (content.length > 0) {
        gsap.set(content, {clearProps: 'transform,opacity,visibility'});
      }
      return gsap.to(el, {autoAlpha: 0, duration: 0.1, ease: 'power1.in', onComplete: finish});
    });
    return;
  }

  guardedDescend(el, FOLD_MS + BROWSE_IN_MS + 140, finishLeave, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. The zones let go in place.
    descendCascadeOut(tl, items, s(CASCADE_OUT_MS), 0);
    // 2. FOLD — the panel collapses back into the row it opened from.
    const folded = surface !== null &&
      descendFold(tl, surface, home?.rect, s(FOLD_MS), s(50), home?.radius);
    tl.to(el, {autoAlpha: 0, duration: s(folded ? 90 : 110), ease: 'power2.in'}, s(folded ? FOLD_MS - 20 : 0));
    // 3. The work column BREATHES BACK from the press point.
    for (const browse of parked) {
      descendReturn(tl, browse, s(BROWSE_IN_MS), s(40));
    }
    // 4. …and an in-view door takes its content back where the panel went in.
    if (content.length > 0 && rowInView) {
      tl.fromTo(content, {autoAlpha: 0}, {autoAlpha: 1, duration: s(RELEASE_MS), ease: 'power1.out', clearProps: 'transform,opacity,visibility'}, s(FOLD_MS));
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
  for (const browse of parkedOf(el)) {
    descendParkLayer(browse);
  }
  const content = rowContentOf(releasedRowOf(el));
  if (content.length > 0) {
    gsap.set(content, {autoAlpha: 0});
  }
  const surface = surfaceOf(el);
  if (surface !== null) {
    gsap.set(surface, {clearProps: 'clipPath,webkitClipPath'});
  }
}
