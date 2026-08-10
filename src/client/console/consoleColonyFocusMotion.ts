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
 *  · REVEAL — TWO WAVES, and the order is the whole point. Wave 1
 *    (`[data-unfold-item]`) is STRUCTURE: the return-base rail, the berths,
 *    the configuration and the result panel surface from INSIDE the opened
 *    surface while the carry is still settling. Wave 2 (`[data-unfold-late]`)
 *    is the FINE PRINT — labels, numbers, notes, the verdict — and it starts
 *    only once the geometry has stopped moving. Space, then objects, then
 *    words; a word that is legible while its panel is still opening is what
 *    made the old entrance read as "a page that was already there";
 *  · B reverses the same phrase: the fine print lets go first, then the
 *    structure, then the panel FOLDS back into the tile's rect, the planet
 *    FLIPs home and the grid breathes back.
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
//
// THE ORDER IS THE POINT: space first, objects second, words last. Every
// number below serves that sentence — the surface has to have finished
// opening before a single label is legible, or the scene reads as a page that
// was already there and merely appeared. (It used to: the stage published no
// `[data-unfold-item]` at all, so the REVEAL beat animated nothing and every
// word was at full opacity from the first frame while the panel was still
// clipped to a tile-sized window. That is the "резко / текст сразу" the
// rework had to remove.)

const RELEASE_MS = 120;
const BROWSE_OUT_MS = 190;
const BROWSE_IN_MS = 200;
const UNFOLD_MS = 360;
const FOLD_MS = 220;
/** Wave 1 — the structural groups surface from inside the opened panel. */
const REVEAL_MS = 230;
const REVEAL_STAGGER_S = 0.05;
/** Wave 2 — the FINE PRINT. Deliberately later, softer and slower: numbers
 *  and labels are the last thing to arrive, never the first. */
const LATE_MS = 280;
const LATE_STAGGER_S = 0.028;
/** The whole late wave never spreads wider than this (see `lateStagger`). */
const LATE_SPREAD_S = 0.26;
const CASCADE_OUT_MS = 100;
const PLANET_FLIP_MS = 380;
const PLANET_FLIP_BACK_MS = 250;
const UNFOLD_AT_MS = 70;
/** When each beat starts (base ms from the press). */
const CARRY_TRACK_AT_MS = 110;
const CARRY_SLOTS_AT_MS = 150;
const REVEAL_AT_MS = 250;
const LATE_AT_MS = 410;
/**
 * THE COMMIT RESPONSE — the pressed tile's own answer, before anything moves.
 * A short controlled depth response (it lifts a hair and its focus light pulls
 * IN), so the descent starts from an object that acknowledged the press rather
 * than from a grid that simply vanished. It overlaps the recede on purpose: a
 * beat that finishes before the next one starts reads as a queue.
 */
const COMMIT_MS = 130;
/** The neighbours yield to the chosen tile a frame before the layer recedes —
 *  local, not a full-screen dim (which would be a modal's backdrop). */
const NEIGHBOUR_DIM_MS = 150;
/** The stage's boundary is the LAST thing to exist. It starts while the
 *  opening is still finishing (overlap, never a queue) and settles after it. */
const EDGE_AT_MS = 300;
const EDGE_MS = 300;

// ── the armed origins ───────────────────────────────────────────────────────

const TILE_KEY = 'colony-tile';
const PLANET_KEY = 'colony-planet';
const TRACK_KEY = 'colony-track';
const SLOTS_KEY = 'colony-slots';
export const COLONY_PRESS_KEY = 'colony-browse';

type Rect = {left: number, top: number, width: number, height: number};

/** Called by the section right before mounting the focus stage: remember the
 *  pressed tile's rect + the THREE carried identities' rects — the planet
 *  medallion, the compact track strip and the build-slot row. Each FLIPs
 *  into its expanded counterpart: the colony physically continues, it is
 *  never replaced by a new detail page. */
export function armColonyFocusOrigin(
  tile: Rect | undefined,
  planet: Rect | undefined,
  track?: Rect | undefined,
  slots?: Rect | undefined,
): void {
  armDescendRect(TILE_KEY, tile);
  armDescendRect(PLANET_KEY, planet);
  armDescendRect(TRACK_KEY, track);
  armDescendRect(SLOTS_KEY, slots);
}

/** The rect (and roundness) the stage unfolded FROM — kept for the fold. */
let unfoldedFrom: {rect: {left: number, top: number, width: number, height: number}, radius: number | undefined} | undefined;

/** Game-switch / unmount boundary. */
export function resetColonyFocusMotion(): void {
  unfoldedFrom = undefined;
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

/** The tiles the player did NOT press — they yield locally, in place. */
function neighbourTilesOf(el: Element): Array<HTMLElement> {
  const root = rootOf(el);
  return root === null ?
    [] :
    Array.from(root.querySelectorAll<HTMLElement>('.con-colonies__slot:not(.con-colonies__slot--focused) .con-coltile'));
}

function surfaceEdgeOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-unfold-edge]');
}

function heroPlanetOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-colony-focus-planet]');
}

/** The planet's own atmosphere layers. They are what turn a growing circle
 *  into a SPHERE APPROACHING: the key light drifts a touch against the body
 *  (parallax) and the lit rim only exists once there is a sphere to rim. */
function planetLightOf(el: Element): HTMLElement | null {
  return heroPlanetOf(el)?.querySelector<HTMLElement>('.con-colfocus__planet-light') ?? null;
}

function planetRimOf(el: Element): HTMLElement | null {
  return heroPlanetOf(el)?.querySelector<HTMLElement>('.con-colfocus__planet-rim') ?? null;
}

function heroTrackOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-colony-focus-track]');
}

function heroSlotsOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-colony-focus-slots]');
}

/** WAVE 1 — the structural groups (panels, rails, rows of real objects). */
function cascadeItemsOf(el: Element): Array<HTMLElement> {
  return Array.from(el.querySelectorAll<HTMLElement>('[data-unfold-item]'));
}

/** WAVE 2 — the FINE PRINT (labels, numbers, notes, verdict). Nested inside
 *  a wave-1 group is fine and common: the group's own fade is already over
 *  by the time this starts, so the two never fight for the same pixels. */
function cascadeLateOf(el: Element): Array<HTMLElement> {
  return Array.from(el.querySelectorAll<HTMLElement>('[data-unfold-late]'));
}

/** Everything the entrance hides — restored together on any abort. The EDGE
 *  and the planet's rim belong here for exactly the reason the two waves do:
 *  a killed timeline never runs its `clearProps`, and an interrupted entrance
 *  must not cost the stage its boundary for the rest of its life. */
function revealablesOf(el: Element): Array<HTMLElement> {
  const extras = [surfaceEdgeOf(el), planetRimOf(el)].filter((n): n is HTMLElement => n !== null);
  return [...cascadeItemsOf(el), ...cascadeLateOf(el), ...extras];
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
  const late = cascadeLateOf(el);
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

  // NOTHING SECONDARY IS PAINTED BEFORE ITS BEAT. The hooks run in the same
  // task as the insert (`:css="false"`), so hiding here happens BEFORE the
  // first paint — the player never sees a fully-drawn page get clipped open
  // around it.
  if (items.length > 0) {
    gsap.set(items, {autoAlpha: 0});
  }
  if (late.length > 0) {
    gsap.set(late, {autoAlpha: 0});
  }
  // …and neither is the stage's own boundary: the frame must be formed by the
  // opening, not revealed by it.
  const edge = surfaceEdgeOf(el);
  const rim = planetRimOf(el);
  if (edge !== null) {
    gsap.set(edge, {autoAlpha: 0});
  }
  if (rim !== null) {
    gsap.set(rim, {autoAlpha: 0});
  }

  const pressPoint = takeDescendOrigin(COLONY_PRESS_KEY);
  const planetRect = takeDescendRect(PLANET_KEY);
  const trackRect = takeDescendRect(TRACK_KEY);
  const slotsRect = takeDescendRect(SLOTS_KEY);
  // The stagger is a RHYTHM, not a queue: a colony with many labels must not
  // make the entrance longer than one with few. Cap the whole late wave's
  // spread, so the last word always arrives within the same beat.
  const lateStagger = Math.min(LATE_STAGGER_S, LATE_SPREAD_S / Math.max(1, late.length));
  const totalMs = LATE_AT_MS + LATE_MS + Math.round(late.length * lateStagger * 1000) + 120;
  guardedDescend(el, totalMs, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 0. COMMIT RESPONSE — the pressed tile answers, and its neighbours yield
    //    to it. This is a LOCAL depth event on the object the player touched,
    //    not a screen-wide dim: a full-surface fade before a descent is a
    //    modal's backdrop, and it is what makes the next beat read as "another
    //    screen arriving" instead of "this object opening".
    if (tile !== null) {
      tl.fromTo(tile,
        {scale: 1, transformOrigin: '50% 50%'},
        {scale: 1.022, duration: s(COMMIT_MS), ease: 'power2.out'}, 0);
    }
    const neighbours = neighbourTilesOf(el);
    if (neighbours.length > 0) {
      tl.to(neighbours, {opacity: 0.42, duration: s(NEIGHBOUR_DIM_MS), ease: 'power1.out'}, 0);
    }
    // 1. RELEASE — the pressed tile's own content dissolves where it stands,
    //    ON the lift, so the two are one gesture rather than two.
    descendRelease(tl, content, s(RELEASE_MS), s(50));
    // 2. The grid RECEDES INTO the press point. The tile's planet goes dark
    //    INSTANTLY: the flying hero planet IS that planet now (one physical
    //    object, never a double image).
    if (tilePlanet !== null) {
      gsap.set(tilePlanet, {opacity: 0});
    }
    if (browse !== null) {
      descendRecede(tl, browse, pressPoint, s(BROWSE_OUT_MS), s(COMMIT_MS - 40));
    }
    // 3. UNFOLD — the stage surface opens FROM the tile's rect; the carried
    //    identities share the window so it all reads as ONE phrase. The
    //    opening is deliberately the LONGEST beat in the phrase: it is the
    //    physical move the whole entrance is about.
    const unfolded = surface !== null &&
      descendUnfold(tl, surface, tileRect, s(UNFOLD_MS), s(UNFOLD_AT_MS), tileRadius);
    if (surface !== null && !unfolded) {
      tl.fromTo(surface,
        {autoAlpha: 0},
        {autoAlpha: 1, duration: s(REVEAL_MS), ease: 'expo.out', clearProps: 'opacity,visibility'}, s(UNFOLD_AT_MS));
    }
    // 4. CARRY — the colony's three physical identities FLIP from their
    //    compact overview forms into the expanded ones: the planet medallion
    //    → the hero planet, the 7-cell strip → the expanded track, the build
    //    row → the big berths (the player tokens ride inside them). Each is
    //    the SAME object growing, never a new frame over an old one.
    //    INERTIA: they do not share one easing. The planet is the heaviest
    //    thing on the stage and settles slowest; the track and the berths are
    //    lighter and catch up — three objects with mass, not one flat DOM
    //    block sliding as a unit.
    const carry = (target: HTMLElement | null, fromRect: Rect | undefined, atS: number, durMs: number, ease: string) => {
      if (target === null) {
        return;
      }
      const from = fromRect !== undefined ? descendFlipFrom(target, fromRect) : undefined;
      if (from !== undefined) {
        tl.fromTo(target,
          {x: from.x, y: from.y, scale: from.scale, transformOrigin: 'top left'},
          {x: 0, y: 0, scale: 1, duration: s(durMs), ease, clearProps: 'transform', overwrite: 'auto'}, atS);
      } else {
        tl.fromTo(target,
          {autoAlpha: 0, scale: 0.94, transformOrigin: '50% 50%'},
          {autoAlpha: 1, scale: 1, duration: s(REVEAL_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility', overwrite: 'auto'}, atS);
      }
    };
    carry(heroPlanet, planetRect, s(UNFOLD_AT_MS), PLANET_FLIP_MS, 'power3.inOut');
    carry(heroTrackOf(el), trackRect, s(CARRY_TRACK_AT_MS), PLANET_FLIP_MS - 20, 'power2.inOut');
    carry(heroSlotsOf(el), slotsRect, s(CARRY_SLOTS_AT_MS), PLANET_FLIP_MS - 40, 'power2.inOut');
    // 4b. THE PLANET BECOMES A SPHERE APPROACHING, not a circle enlarging.
    //     Its key light drifts a few tenths of a rem AGAINST the body through
    //     the carry (parallax between the art, its light and the space behind
    //     it), and the lit atmosphere rim — which has nothing to rim while the
    //     medallion is still small — comes up as the size arrives.
    const light = planetLightOf(el);
    if (light !== null && planetRect !== undefined) {
      tl.fromTo(light,
        {xPercent: -4, yPercent: -3, opacity: 0.55},
        {xPercent: 0, yPercent: 0, opacity: 1, duration: s(PLANET_FLIP_MS + 60), ease: 'power2.out',
          clearProps: 'transform,opacity'}, s(UNFOLD_AT_MS));
    }
    if (rim !== null) {
      tl.to(rim, {autoAlpha: 1, duration: s(PLANET_FLIP_MS * 0.7), ease: 'power1.out',
        clearProps: 'opacity,visibility'}, s(UNFOLD_AT_MS + PLANET_FLIP_MS * 0.35));
    }
    // 5. REVEAL — the structural groups surface from INSIDE the opened panel,
    //    while the carry is still settling: space, then objects.
    descendCascade(tl, items, s(REVEAL_MS), s(REVEAL_AT_MS), REVEAL_STAGGER_S);
    // 5b. THE TRACK ANSWERS. One delicate sweep along the rail as it finishes
    //     unfolding — the instrument powering up, not a decoration: it runs
    //     once, in the direction the track is read, and leaves nothing behind.
    //     (The stage is mounted fresh for every descent, so the class can
    //     never already be there — no reflow dance is needed to replay it.)
    const track = heroTrackOf(el);
    if (track !== null) {
      tl.call(() => track.classList.add('con-colfocus__xtrack--sweep'), undefined, s(CARRY_TRACK_AT_MS + 140));
    }
    // 6. THE FINE PRINT LAST. By the time a label is legible the geometry it
    //    belongs to has already stopped moving — this is the whole difference
    //    between "the scene opened" and "a page appeared".
    descendCascade(tl, late, s(LATE_MS), s(LATE_AT_MS), lateStagger);
    // 7. THE EDGE FORMS LAST OF ALL — around content that has already taken
    //    its place. Overlapping the fine print (not queued after it) is what
    //    keeps this a settle rather than an eighth event.
    if (edge !== null) {
      tl.to(edge, {autoAlpha: 1, duration: s(EDGE_MS), ease: 'power1.out',
        clearProps: 'opacity,visibility'}, s(EDGE_AT_MS));
    }
    return tl;
  });
}

// ── the EMBEDDED ENTRY (the workspace arriving as a STEP of another flow) ───

/** The step's own room opens; nothing is scaled (clip only). */
const STEP_OPEN_MS = 300;
/** The colonies surface from inside it, in reading order. */
const STEP_ITEM_MS = 250;
const STEP_ITEM_STAGGER_S = 0.042;
/** The whole tile wave never spreads wider than this, whatever the count. */
const STEP_SPREAD_S = 0.24;
const STEP_ITEMS_AT_MS = 120;

/**
 * COLONIES ARRIVING AS A STEP — «Старт партии › <пролог> › КОЛОНИИ».
 *
 * A hosted step used to be handed the STANDALONE band-surface entrance (a
 * whole workspace switch, played inside somebody else's zone), which is why
 * entering the colonies from the start workspace read as a different screen
 * being thrown up rather than as this flow going one level deeper.
 *
 * The phrase is the workspace descend's, one level in and without a rect to
 * fly from (the player pressed a prompt, not a tile): the ROOM opens by clip
 * — the frame is never scaled, so the header, the fleet dock and the host's
 * own chrome cannot drift — and the colonies then surface from INSIDE it in
 * reading order. Everything is measured and laid out before the first frame:
 * the fit engine has already run, so no tile ever resizes under the entrance.
 */
export function playColonyStepEntry(root: HTMLElement): void {
  if (typeof window === 'undefined' || hiddenHost(root)) {
    return;
  }
  const stage = root.querySelector<HTMLElement>('.con-colonies__stagewrap');
  const tiles = Array.from(root.querySelectorAll<HTMLElement>('.con-colonies__slot'));
  const rail = root.querySelector<HTMLElement>('.con-colonies__rail');
  const toolbar = root.querySelector<HTMLElement>('.con-colonies__toolbar');
  const risers = [...tiles, ...(rail === null ? [] : [rail])];
  if (stage === null && risers.length === 0) {
    return;
  }

  if (consoleReducedMotionActive()) {
    gsap.fromTo(root, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.1, ease: 'power1.out', clearProps: 'opacity,visibility'});
    return;
  }

  // Hidden BEFORE the first paint, in the same task as the mount — the player
  // must never see a finished grid and then watch a window open around it.
  if (risers.length > 0) {
    gsap.set(risers, {autoAlpha: 0});
  }
  const stagger = Math.min(STEP_ITEM_STAGGER_S, STEP_SPREAD_S / Math.max(1, tiles.length));
  const totalMs = STEP_ITEMS_AT_MS + STEP_ITEM_MS + Math.round(risers.length * stagger * 1000) + 120;
  guardedDescend(root, totalMs, () => undefined, () => {
    const tl = gsap.timeline();
    // The TOOLBAR is the host's spatial anchor for this step (the fleet dock
    // lives there and must not move): it settles in place, it never travels.
    if (toolbar !== null) {
      tl.fromTo(toolbar, {autoAlpha: 0}, {autoAlpha: 1, duration: s(160), ease: 'power1.out', clearProps: 'opacity,visibility'}, 0);
    }
    if (stage !== null) {
      tl.fromTo(stage,
        {clipPath: 'inset(6% 0% 12% 0% round .55rem)', webkitClipPath: 'inset(6% 0% 12% 0% round .55rem)'},
        {clipPath: 'inset(0% 0% 0% 0% round .55rem)', webkitClipPath: 'inset(0% 0% 0% 0% round .55rem)',
          duration: s(STEP_OPEN_MS), ease: 'expo.out', clearProps: 'clipPath,webkitClipPath'}, 0);
    }
    descendCascade(tl, risers, s(STEP_ITEM_MS), s(STEP_ITEMS_AT_MS), stagger);
    return tl;
  });
}

// ── the leave hook (focus → browse: cancel OR the confirm fold) ─────────────

export function colonyFocusLeaveHook(el: Element, done: () => void): void {
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
  const late = cascadeLateOf(el);
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
  const foldMs = FOLD_MS;
  guardedDescend(el, Math.max(PLANET_FLIP_BACK_MS, foldMs) + 160, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 0. The tiles behind come back to rest as the stage starts to let go, so
    //    the returning grid is already whole when it is revealed.
    resetTiles(el);
    // 1. The controls let go in place — the FINE PRINT first, exactly the
    //    reverse of the way it arrived, so the panel is already wordless by
    //    the time it starts folding (a fold with live text reads as a screen
    //    being yanked away). The BOUNDARY goes with them: a bordered rectangle
    //    shrinking into a tile is the very reading the entrance was rebuilt to
    //    remove, and it must not come back on the way out.
    descendCascadeOut(tl, late, s(CASCADE_OUT_MS), 0);
    descendCascadeOut(tl, items, s(CASCADE_OUT_MS), s(40));
    const edge = surfaceEdgeOf(el);
    if (edge !== null) {
      tl.to(edge, {autoAlpha: 0, duration: s(CASCADE_OUT_MS), ease: 'power1.in'}, 0);
    }
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

/**
 * Undo the COMMIT RESPONSE. The lift and the neighbours' yield are inline
 * props on elements the recede does not own (the layer fades; its children
 * keep whatever was set on them), so they must be cleared explicitly on every
 * path back — otherwise the grid returns with one tile still enlarged and the
 * rest at 42 %, for the rest of the workspace's life.
 */
function resetTiles(el: Element): void {
  const tile = tileOf(el);
  if (tile !== null) {
    gsap.set(tile, {clearProps: 'transform'});
  }
  const neighbours = neighbourTilesOf(el);
  if (neighbours.length > 0) {
    gsap.set(neighbours, {clearProps: 'opacity'});
  }
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
  resetTiles(el);
}

/** Cancelled-pair hooks (the surface-motion idiom). */
export function colonyFocusEnterCancelledHook(el: Element): void {
  killDescendEpisode(el);
  // A killed timeline never runs its `clearProps`, so the two reveal waves
  // would stay at `autoAlpha: 0` for the stage's whole life — an entrance
  // that is interrupted must not cost the player the content.
  const hidden = revealablesOf(el);
  if (hidden.length > 0) {
    gsap.set(hidden, {clearProps: 'transform,opacity,visibility'});
  }
}

export function colonyFocusLeaveCancelledHook(el: Element): void {
  killDescendEpisode(el);
  // A cancelled leave means the stage STAYS — restore what the fold had
  // started to let go, then re-park the browse layer, the released tile
  // content and the planet (the enter hook's end state).
  const hidden = revealablesOf(el);
  if (hidden.length > 0) {
    gsap.set(hidden, {clearProps: 'transform,opacity,visibility'});
  }
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
