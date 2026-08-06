/*
 * COLONY FOCUS MOTION — the browse ⇄ focus choreography of the console
 * COLONY WORKSPACE (ConsoleColoniesSection ⇄ ConsoleColonyFocusStage),
 * spoken in the WORKSPACE DESCEND grammar (surfaceMotion/workspaceDescend.ts).
 *
 * Entering the COLONY FOCUS stage is NOT a modal popping over the grid. The
 * player pressed a physical colony tile, and THAT SURFACE opens into its own
 * deeper state:
 *
 *  · COMMIT — the pressed tile answers where it stands (CSS `--descend` ring);
 *  · RELEASE — the tile's own content (name, track, cells, status) dissolves
 *    IN PLACE — the stage's hero column restates all of it larger, so carrying
 *    it would be a duplicate flying into its own copy;
 *  · UNFOLD — the stage surface is clipped down to the tile's rect and opens
 *    from it, while the tile grid recedes into the same press point;
 *  · CARRY — the ONE genuinely semantic object travels: the tile's planet
 *    medallion FLIPs into the stage's hero planet (the colony itself — the
 *    subject of the decision, not a widget);
 *  · REVEAL — the stage's columns (track dossier, payment, outcome) surface
 *    from INSIDE the opened panel with a short stagger;
 *  · B reverses the same phrase: controls let go, the panel FOLDS back into
 *    the tile's rect, the planet FLIPs home, the grid breathes back.
 *
 * The CONFIRM path deliberately reuses the same fold (`focusConfirmLeave`
 * marker): the stage folds back into the traded tile — the very tile the
 * trade-fleet is about to fly at — so «подтвердил → вернулся на поверхность →
 * флот полетел» reads as one continuous sentence.
 *
 * surfaceMotionDirector idioms verbatim: transform/opacity/clip only
 * (perf-lite safe), guarded episodes, durations through `motionMs`, FLIP
 * deltas zoom-compensated, reduced motion = short functional fades.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
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
} from '@/client/console/surfaceMotion/workspaceDescend';

// ── timings (1080-logical ms; motionMs folds the speed preset) ──────────────

const RELEASE_MS = 110;
const BROWSE_OUT_MS = 170;
const BROWSE_IN_MS = 180;
const UNFOLD_MS = 270;
const FOLD_MS = 200;
/** The confirm fold is brisker — the fleet launch is already the next beat. */
const CONFIRM_FOLD_MS = 160;
const CASCADE_MS = 170;
const CASCADE_OUT_MS = 90;
const PLANET_FLIP_MS = 300;
const PLANET_FLIP_BACK_MS = 240;
const UNFOLD_AT_MS = 60;

// ── the armed origins ───────────────────────────────────────────────────────

const TILE_KEY = 'colony-tile';
const PLANET_KEY = 'colony-planet';
export const COLONY_PRESS_KEY = 'colony-browse';

/** Called by the section right before mounting the focus stage: remember the
 *  pressed tile's rect + its planet medallion's rect (the FLIP source). */
export function armColonyFocusOrigin(
  tile: {left: number, top: number, width: number, height: number} | undefined,
  planet: {left: number, top: number, width: number, height: number} | undefined,
): void {
  armDescendRect(TILE_KEY, tile);
  armDescendRect(PLANET_KEY, planet);
}

/** The rect (and roundness) the stage unfolded FROM — kept for the fold. */
let unfoldedFrom: {rect: {left: number, top: number, width: number, height: number}, radius: number | undefined} | undefined;

/** One-shot: the NEXT leave is a CONFIRM fold (brisk, no planet fly-home race
 *  with the fleet launch), not a cancel. Armed by the confirm handler. */
let confirmLeave = false;

export function markColonyFocusConfirmLeave(): void {
  confirmLeave = true;
}

/** Game-switch / unmount boundary. */
export function resetColonyFocusMotion(): void {
  unfoldedFrom = undefined;
  confirmLeave = false;
}

// ── element resolution ──────────────────────────────────────────────────────

function rootOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('.con-colonies');
}

function browseOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-colonies__browse') ?? null;
}

/** The pressed tile in the browse grid (the unfold's origin). */
function tileOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-colonies__slot--focused .con-coltile') ?? null;
}

/** The tile's planet medallion — the carried subject's browse twin. */
function tilePlanetOf(el: Element): HTMLElement | null {
  return tileOf(el)?.querySelector<HTMLElement>('.con-coltile__planet-berth') ?? null;
}

/** The tile's OWN content — released in place, never carried. */
function tileContentOf(el: Element): Array<HTMLElement> {
  const tile = tileOf(el);
  return tile === null ?
    [] :
    Array.from(tile.querySelectorAll<HTMLElement>('.con-coltile__head, .con-coltile__mid, .con-coltile__rows, .con-coltile__status'));
}

function surfaceOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-unfold-surface]');
}

function heroPlanetOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-colony-focus-planet]');
}

function cascadeItemsOf(el: Element): Array<HTMLElement> {
  return Array.from(el.querySelectorAll<HTMLElement>('[data-unfold-item]'));
}

/** A hidden section (embedded teardown / v-show'd host) has no live geometry. */
function hiddenHost(el: Element): boolean {
  return el instanceof HTMLElement && el.offsetParent === null &&
    getComputedStyle(el).position !== 'fixed';
}

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

// ── the enter hook (browse → focus: the SURFACE UNFOLD) ─────────────────────

export function colonyFocusEnterHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || hiddenHost(el)) {
    killDescendEpisode(el);
    done();
    return;
  }
  const browse = browseOf(el);
  const surface = surfaceOf(el);
  const heroPlanet = heroPlanetOf(el);
  const items = cascadeItemsOf(el);
  const content = tileContentOf(el);
  const tilePlanet = tilePlanetOf(el);

  const tile = tileOf(el);
  const tileRect = takeDescendRect(TILE_KEY) ?? descendRectOf(tile);
  const tileRadius = descendRadiusOf(tile);
  unfoldedFrom = tileRect === undefined ? undefined : {rect: tileRect, radius: tileRadius};

  if (consoleReducedMotionActive()) {
    guardedDescend(el, 160, done, (finish) => {
      if (browse !== null) {
        gsap.set(browse, {autoAlpha: 0});
      }
      return gsap.fromTo(el, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.1, ease: 'power1.out', clearProps: 'opacity,visibility', onComplete: finish});
    });
    return;
  }

  const pressPoint = takeDescendOrigin(COLONY_PRESS_KEY);
  const planetRect = takeDescendRect(PLANET_KEY);
  guardedDescend(el, UNFOLD_AT_MS + PLANET_FLIP_MS + 140, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. RELEASE — the pressed tile's own content dissolves where it stands.
    descendRelease(tl, content, s(RELEASE_MS), 0);
    // 2. The grid RECEDES INTO the press point. The tile's planet goes dark
    //    INSTANTLY: the flying hero planet IS that planet now (one physical
    //    object, never a double image).
    if (tilePlanet !== null) {
      gsap.set(tilePlanet, {opacity: 0});
    }
    if (browse !== null) {
      descendRecede(tl, browse, pressPoint, s(BROWSE_OUT_MS), s(40));
    }
    // 3. UNFOLD — the stage surface opens FROM the tile's rect; the planet
    //    FLIP shares the window so the two read as ONE phrase.
    const unfolded = surface !== null &&
      descendUnfold(tl, surface, tileRect, s(UNFOLD_MS), s(UNFOLD_AT_MS), tileRadius);
    if (surface !== null && !unfolded) {
      tl.fromTo(surface,
        {autoAlpha: 0},
        {autoAlpha: 1, duration: s(CASCADE_MS), ease: 'expo.out', clearProps: 'opacity,visibility'}, s(UNFOLD_AT_MS));
    }
    if (heroPlanet !== null) {
      const from = planetRect !== undefined ? descendFlipFrom(heroPlanet, planetRect) : undefined;
      if (from !== undefined) {
        tl.fromTo(heroPlanet,
          {x: from.x, y: from.y, scale: from.scale, transformOrigin: 'top left'},
          {x: 0, y: 0, scale: 1, duration: s(PLANET_FLIP_MS), ease: 'power3.inOut', clearProps: 'transform', overwrite: 'auto'}, 0);
      } else {
        tl.fromTo(heroPlanet,
          {autoAlpha: 0, scale: 0.9, transformOrigin: '50% 50%'},
          {autoAlpha: 1, scale: 1, duration: s(CASCADE_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility', overwrite: 'auto'}, 0);
      }
    }
    // 4. REVEAL — the stage's columns surface from INSIDE the opening panel.
    descendCascade(tl, items, s(CASCADE_MS), s(UNFOLD_AT_MS + 90));
    return tl;
  });
}

// ── the leave hook (focus → browse: cancel OR the confirm fold) ─────────────

export function colonyFocusLeaveHook(el: Element, done: () => void): void {
  const isConfirm = confirmLeave;
  confirmLeave = false;
  if (typeof window === 'undefined' || hiddenHost(el)) {
    killDescendEpisode(el);
    unfoldedFrom = undefined;
    restoreBrowse(el);
    done();
    return;
  }
  const browse = browseOf(el);
  const surface = surfaceOf(el);
  const heroPlanet = heroPlanetOf(el);
  const items = cascadeItemsOf(el);
  const content = tileContentOf(el);
  const tilePlanet = tilePlanetOf(el);
  const home = unfoldedFrom;
  unfoldedFrom = undefined;

  // The tile's content comes back with the layer (it was released, not moved)
  // — restoring it now is invisible: the grid is still receded.
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

  const heroRect = heroPlanet?.getBoundingClientRect();
  const foldMs = isConfirm ? CONFIRM_FOLD_MS : FOLD_MS;
  guardedDescend(el, Math.max(PLANET_FLIP_BACK_MS, foldMs) + 160, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. The controls let go in place.
    descendCascadeOut(tl, items, s(CASCADE_OUT_MS), 0);
    // The single physical object: the stage's planet goes dark the moment its
    // browse twin starts flying home.
    if (heroPlanet !== null) {
      gsap.set(heroPlanet, {opacity: 0});
    }
    // 2. FOLD — the panel collapses back into the tile it opened from. On the
    //    CONFIRM path this is the tile the fleet is about to fly at: the fold
    //    literally hands the screen back to the traded colony.
    const folded = surface !== null &&
      descendFold(tl, surface, home?.rect, s(foldMs), s(40), home?.radius);
    tl.to(el, {autoAlpha: 0, duration: s(folded ? 90 : 110), ease: 'power2.in'}, s(folded ? foldMs - 20 : 0));
    // 3. The grid BREATHES BACK from the same press point, and the planet
    //    FLIPs home into the tile's medallion.
    if (browse !== null) {
      descendReturn(tl, browse, s(BROWSE_IN_MS), s(30));
    }
    if (tilePlanet !== null) {
      gsap.set(tilePlanet, {clearProps: 'opacity'});
      if (heroRect !== undefined && heroRect.width >= 10) {
        const from = descendFlipFrom(tilePlanet, heroRect);
        if (from !== undefined) {
          tl.fromTo(tilePlanet,
            {x: from.x, y: from.y, scale: from.scale, transformOrigin: 'top left'},
            {x: 0, y: 0, scale: 1, duration: s(PLANET_FLIP_BACK_MS), ease: 'power3.inOut', clearProps: 'transform', overwrite: 'auto'}, s(20));
        }
      }
    }
    return tl;
  });
}

/** Restore the browse layer + released tile bits to their resting state. */
function restoreBrowse(el: Element): void {
  const browse = browseOf(el);
  if (browse !== null) {
    gsap.set(browse, {autoAlpha: 1, clearProps: 'transform,opacity,visibility'});
  }
  const content = tileContentOf(el);
  if (content.length > 0) {
    gsap.set(content, {clearProps: 'transform,opacity,visibility'});
  }
  const tilePlanet = tilePlanetOf(el);
  if (tilePlanet !== null) {
    gsap.set(tilePlanet, {clearProps: 'opacity'});
  }
}

/** Cancelled-pair hooks (the surface-motion idiom). */
export function colonyFocusEnterCancelledHook(el: Element): void {
  killDescendEpisode(el);
}

export function colonyFocusLeaveCancelledHook(el: Element): void {
  killDescendEpisode(el);
  // A cancelled leave means the stage STAYS — re-park the browse layer, the
  // released tile content and the planet (the enter hook's end state).
  const browse = browseOf(el);
  if (browse !== null) {
    descendParkLayer(browse);
  }
  const content = tileContentOf(el);
  if (content.length > 0) {
    gsap.set(content, {autoAlpha: 0});
  }
  const tilePlanet = tilePlanetOf(el);
  if (tilePlanet !== null) {
    gsap.set(tilePlanet, {opacity: 0});
  }
  const heroPlanet = heroPlanetOf(el);
  if (heroPlanet !== null) {
    gsap.set(heroPlanet, {clearProps: 'opacity'});
  }
  const surface = surfaceOf(el);
  if (surface !== null) {
    gsap.set(surface, {clearProps: 'clipPath,webkitClipPath'});
  }
}
