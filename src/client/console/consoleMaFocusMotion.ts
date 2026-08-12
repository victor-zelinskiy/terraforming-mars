/*
 * MA FOCUS MOTION — the browse ⇄ detail ⇄ ceremony choreography of the
 * console MILESTONES/AWARDS WORKSPACE (ConsoleMaScreen ⇄ ConsoleMaFocusStage),
 * spoken in the WORKSPACE DESCEND grammar (surfaceMotion/workspaceDescend.ts;
 * the colony focus stage is the family reference).
 *
 * Entering the detail stage is NOT a modal popping over the grid. The player
 * pressed a physical dashboard card, and THAT SURFACE opens into its own
 * deeper state:
 *
 *  · COMMIT — the pressed card answers where it stands (a hair of lift, the
 *    neighbours yield locally — never a full-screen dim);
 *  · RELEASE — the card's own content (name, rule, metrics) dissolves IN
 *    PLACE — the stage restates all of it larger, so carrying it would be a
 *    duplicate flying into its own copy;
 *  · UNFOLD — the stage surface is clipped down to the card's rect and opens
 *    from it, while the grid recedes into the same press point;
 *  · CARRY — the ONE genuinely semantic object travels: the item's EMBLEM
 *    (the art pedestal) FLIPs into the stage's hero stage. The pressed card's
 *    own art goes dark the same instant — one physical object, never two;
 *  · REVEAL — two waves: `[data-unfold-item]` (structure) first,
 *    `[data-unfold-late]` (labels, numbers, verdicts) only once the geometry
 *    has stopped moving; the boundary `[data-unfold-edge]` forms last;
 *  · B reverses the same phrase and the emblem FLIPs home into its card.
 *
 * THE CEREMONY PHRASE (post-commit) is this module's own addition: the detail
 * panels release in place, the hero emblem GLIDES to the centre ceremony seat
 * (the same DOM node — no reset, no re-entrance), the coronation dressing
 * surfaces around it, the shared `playCeremonyBurst` fires over the seat, and
 * the completion callback (after the dwell) is the ONE signal the shell closes
 * the workspace on — never a parallel timeout.
 *
 * surfaceMotionDirector idioms verbatim: transform/opacity/clip only
 * (perf-lite safe), guarded episodes, durations through `motionMs`, FLIP
 * deltas zoom-compensated, reduced motion = short functional fades.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {playCeremonyBurst, CeremonyBurstHandle} from '@/client/console/ceremony/ceremonyFx';
import {MaKind} from '@/client/components/ma/maArt';
import {
  armDescendRect,
  armDescendOrigin,
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

const RELEASE_MS = 120;
const BROWSE_OUT_MS = 190;
const BROWSE_IN_MS = 200;
const UNFOLD_MS = 360;
const FOLD_MS = 220;
const REVEAL_MS = 230;
const REVEAL_STAGGER_S = 0.05;
const LATE_MS = 280;
const LATE_STAGGER_S = 0.028;
const LATE_SPREAD_S = 0.26;
const CASCADE_OUT_MS = 100;
/** The emblem is the heaviest object on the stage — it settles slowest. */
const HERO_FLIP_MS = 400;
const HERO_FLIP_BACK_MS = 250;
const UNFOLD_AT_MS = 70;
const REVEAL_AT_MS = 250;
const LATE_AT_MS = 410;
const COMMIT_MS = 130;
const NEIGHBOUR_DIM_MS = 150;
const EDGE_AT_MS = 300;
const EDGE_MS = 300;

// ── the armed origins ───────────────────────────────────────────────────────

const CARD_KEY = 'ma-card';
const ART_KEY = 'ma-art';
export const MA_PRESS_KEY = 'ma-browse';

type Rect = {left: number, top: number, width: number, height: number};

/** Called by the screen right before opening the focus stage: remember the
 *  pressed card's rect (the unfold source) + the emblem pedestal's rect (the
 *  carried subject's FLIP source) + the press point (the recede origin). */
export function armMaFocusOrigin(
  card: Rect | undefined,
  art: Rect | undefined,
): void {
  armDescendRect(CARD_KEY, card);
  armDescendRect(ART_KEY, art);
  armDescendOrigin(MA_PRESS_KEY, card === undefined ? undefined :
    {x: card.left + card.width / 2, y: card.top + card.height / 2});
}

/** The rect (and roundness) the stage unfolded FROM — kept for the fold. */
let unfoldedFrom: {rect: Rect, radius: number | undefined} | undefined;

/** Game-switch / unmount boundary. */
export function resetMaFocusMotion(): void {
  unfoldedFrom = undefined;
  stopMaCeremonyStage();
}

// ── element resolution ──────────────────────────────────────────────────────

function rootOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('.con-ma');
}

function browseOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-ma__browse') ?? null;
}

/** The pressed card in the browse grid (the unfold's origin). */
function cardOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-ma__card--focused') ?? null;
}

/** The card's emblem pedestal — the carried subject's browse twin. */
function cardArtOf(el: Element): HTMLElement | null {
  return cardOf(el)?.querySelector<HTMLElement>('.con-ma__stage') ?? null;
}

/** The card's OWN content — released in place, never carried. */
function cardContentOf(el: Element): Array<HTMLElement> {
  const card = cardOf(el);
  return card === null ?
    [] :
    Array.from(card.querySelectorAll<HTMLElement>('.con-ma__body, .con-ma__status'));
}

function surfaceOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-unfold-surface]');
}

/** The cards the player did NOT press — they yield locally, in place. */
function neighbourCardsOf(el: Element): Array<HTMLElement> {
  const root = rootOf(el);
  return root === null ?
    [] :
    Array.from(root.querySelectorAll<HTMLElement>('.con-ma__card:not(.con-ma__card--focused)'));
}

function surfaceEdgeOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-unfold-edge]');
}

/** The stage's hero emblem pedestal (the carried subject). */
function heroOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-ma-focus-hero]');
}

function cascadeItemsOf(el: Element): Array<HTMLElement> {
  return Array.from(el.querySelectorAll<HTMLElement>('[data-unfold-item]'));
}

function cascadeLateOf(el: Element): Array<HTMLElement> {
  return Array.from(el.querySelectorAll<HTMLElement>('[data-unfold-late]'));
}

/** Everything the entrance hides — restored together on any abort. */
function revealablesOf(el: Element): Array<HTMLElement> {
  const extras = [surfaceEdgeOf(el)].filter((n): n is HTMLElement => n !== null);
  return [...cascadeItemsOf(el), ...cascadeLateOf(el), ...extras];
}

function hiddenHost(el: Element): boolean {
  return el instanceof HTMLElement && el.offsetParent === null &&
    getComputedStyle(el).position !== 'fixed';
}

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

// ── the enter hook (browse → detail: the SURFACE UNFOLD) ────────────────────

export function maFocusEnterHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || hiddenHost(el)) {
    killDescendEpisode(el);
    done();
    return;
  }
  const browse = browseOf(el);
  const surface = surfaceOf(el);
  const hero = heroOf(el);
  const items = cascadeItemsOf(el);
  const late = cascadeLateOf(el);
  const content = cardContentOf(el);
  const cardArt = cardArtOf(el);

  const card = cardOf(el);
  const cardRect = takeDescendRect(CARD_KEY) ?? descendRectOf(card);
  const cardRadius = descendRadiusOf(card);
  unfoldedFrom = cardRect === undefined ? undefined : {rect: cardRect, radius: cardRadius};

  if (consoleReducedMotionActive()) {
    guardedDescend(el, 160, done, (finish) => {
      if (browse !== null) {
        gsap.set(browse, {autoAlpha: 0});
      }
      return gsap.fromTo(el, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.1, ease: 'power1.out', clearProps: 'opacity,visibility', onComplete: finish});
    });
    return;
  }

  // Nothing secondary is painted before its beat (`:css="false"` — the hooks
  // run in the same task as the insert, before the first paint).
  if (items.length > 0) {
    gsap.set(items, {autoAlpha: 0});
  }
  if (late.length > 0) {
    gsap.set(late, {autoAlpha: 0});
  }
  const edge = surfaceEdgeOf(el);
  if (edge !== null) {
    gsap.set(edge, {autoAlpha: 0});
  }

  const pressPoint = takeDescendOrigin(MA_PRESS_KEY);
  const artRect = takeDescendRect(ART_KEY);
  const lateStagger = Math.min(LATE_STAGGER_S, LATE_SPREAD_S / Math.max(1, late.length));
  const totalMs = LATE_AT_MS + LATE_MS + Math.round(late.length * lateStagger * 1000) + 120;
  guardedDescend(el, totalMs, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 0. COMMIT RESPONSE — the pressed card answers, its neighbours yield.
    if (card !== null) {
      tl.fromTo(card,
        {scale: 1, transformOrigin: '50% 50%'},
        {scale: 1.018, duration: s(COMMIT_MS), ease: 'power2.out'}, 0);
    }
    const neighbours = neighbourCardsOf(el);
    if (neighbours.length > 0) {
      tl.to(neighbours, {opacity: 0.42, duration: s(NEIGHBOUR_DIM_MS), ease: 'power1.out'}, 0);
    }
    // 1. RELEASE — the card's own content dissolves where it stands.
    descendRelease(tl, content, s(RELEASE_MS), s(50));
    // 2. The grid RECEDES into the press point. The card's emblem goes dark
    //    INSTANTLY: the flying hero emblem IS that emblem now.
    if (cardArt !== null) {
      gsap.set(cardArt, {opacity: 0});
    }
    if (browse !== null) {
      descendRecede(tl, browse, pressPoint, s(BROWSE_OUT_MS), s(COMMIT_MS - 40));
    }
    // 3. UNFOLD — the stage surface opens FROM the card's rect.
    const unfolded = surface !== null &&
      descendUnfold(tl, surface, cardRect, s(UNFOLD_MS), s(UNFOLD_AT_MS), cardRadius);
    if (surface !== null && !unfolded) {
      tl.fromTo(surface,
        {autoAlpha: 0},
        {autoAlpha: 1, duration: s(REVEAL_MS), ease: 'expo.out', clearProps: 'opacity,visibility'}, s(UNFOLD_AT_MS));
    }
    // 4. CARRY — the emblem pedestal FLIPs from its compact card form into
    //    the hero stage: the SAME object growing, never a new frame over an
    //    old one.
    if (hero !== null) {
      const from = artRect !== undefined ? descendFlipFrom(hero, artRect) : undefined;
      if (from !== undefined) {
        tl.fromTo(hero,
          {x: from.x, y: from.y, scale: from.scale, transformOrigin: 'top left'},
          {x: 0, y: 0, scale: 1, duration: s(HERO_FLIP_MS), ease: 'power3.inOut', clearProps: 'transform', overwrite: 'auto'}, s(UNFOLD_AT_MS));
      } else {
        tl.fromTo(hero,
          {autoAlpha: 0, scale: 0.94, transformOrigin: '50% 50%'},
          {autoAlpha: 1, scale: 1, duration: s(REVEAL_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility', overwrite: 'auto'}, s(UNFOLD_AT_MS));
      }
    }
    // 5. REVEAL — structure surfaces from inside the opened panel while the
    //    carry is still settling; the fine print arrives only once the
    //    geometry has stopped moving; the edge forms last of all.
    descendCascade(tl, items, s(REVEAL_MS), s(REVEAL_AT_MS), REVEAL_STAGGER_S);
    descendCascade(tl, late, s(LATE_MS), s(LATE_AT_MS), lateStagger);
    if (edge !== null) {
      tl.to(edge, {autoAlpha: 1, duration: s(EDGE_MS), ease: 'power1.out',
        clearProps: 'opacity,visibility'}, s(EDGE_AT_MS));
    }
    return tl;
  });
}

// ── the leave hook (detail → browse: the cancel fold) ───────────────────────

export function maFocusLeaveHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || hiddenHost(el)) {
    killDescendEpisode(el);
    unfoldedFrom = undefined;
    restoreBrowse(el);
    done();
    return;
  }
  const browse = browseOf(el);
  const surface = surfaceOf(el);
  const hero = heroOf(el);
  const items = cascadeItemsOf(el);
  const late = cascadeLateOf(el);
  const content = cardContentOf(el);
  const cardArt = cardArtOf(el);
  const home = unfoldedFrom;
  unfoldedFrom = undefined;

  // The card's content comes back with the layer (it was released, not
  // moved) — restoring it now is invisible: the grid is still receded.
  if (content.length > 0) {
    gsap.set(content, {clearProps: 'transform,opacity,visibility'});
  }

  if (consoleReducedMotionActive()) {
    guardedDescend(el, 260, done, (finish) => {
      restoreBrowse(el);
      return gsap.to(el, {
        autoAlpha: 0,
        duration: s(110),
        ease: 'power2.in',
        onComplete: finish,
      });
    });
    return;
  }

  const heroRect = hero?.getBoundingClientRect();
  guardedDescend(el, Math.max(HERO_FLIP_BACK_MS, FOLD_MS) + 160, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 0. The cards behind come back to rest as the stage starts to let go.
    resetCards(el);
    // 1. The fine print lets go first, then the structure, and the boundary
    //    goes with them — a bordered rectangle shrinking into a card is the
    //    reading the entrance was built to avoid.
    descendCascadeOut(tl, late, s(CASCADE_OUT_MS), 0);
    descendCascadeOut(tl, items, s(CASCADE_OUT_MS), s(40));
    const edge = surfaceEdgeOf(el);
    if (edge !== null) {
      tl.to(edge, {autoAlpha: 0, duration: s(CASCADE_OUT_MS), ease: 'power1.in'}, 0);
    }
    // The single physical object: the stage's emblem goes dark the moment its
    // browse twin starts flying home.
    if (hero !== null) {
      gsap.set(hero, {opacity: 0});
    }
    // 2. FOLD — the panel collapses back into the card it opened from.
    const folded = surface !== null &&
      descendFold(tl, surface, home?.rect, s(FOLD_MS), s(40), home?.radius);
    tl.to(el, {autoAlpha: 0, duration: s(folded ? 90 : 110), ease: 'power2.in'}, s(folded ? FOLD_MS - 20 : 0));
    // 3. The grid BREATHES BACK from the same press point, and the emblem
    //    FLIPs home into the card's pedestal.
    if (browse !== null) {
      descendReturn(tl, browse, s(BROWSE_IN_MS), s(30));
    }
    if (cardArt !== null) {
      gsap.set(cardArt, {clearProps: 'opacity'});
      if (heroRect !== undefined && heroRect.width >= 10) {
        const from = descendFlipFrom(cardArt, heroRect);
        if (from !== undefined) {
          tl.fromTo(cardArt,
            {x: from.x, y: from.y, scale: from.scale, transformOrigin: 'top left'},
            {x: 0, y: 0, scale: 1, duration: s(HERO_FLIP_BACK_MS), ease: 'power3.inOut', clearProps: 'transform', overwrite: 'auto'}, s(20));
        }
      }
    }
    return tl;
  });
}

/** Undo the COMMIT RESPONSE (inline props the recede does not own). */
function resetCards(el: Element): void {
  const card = cardOf(el);
  if (card !== null) {
    gsap.set(card, {clearProps: 'transform'});
  }
  const neighbours = neighbourCardsOf(el);
  if (neighbours.length > 0) {
    gsap.set(neighbours, {clearProps: 'opacity'});
  }
}

/** Restore the browse layer + released card bits to their resting state. */
function restoreBrowse(el: Element): void {
  const browse = browseOf(el);
  if (browse !== null) {
    gsap.set(browse, {autoAlpha: 1, clearProps: 'transform,opacity,visibility'});
  }
  const content = cardContentOf(el);
  if (content.length > 0) {
    gsap.set(content, {clearProps: 'transform,opacity,visibility'});
  }
  const cardArt = cardArtOf(el);
  if (cardArt !== null) {
    gsap.set(cardArt, {clearProps: 'opacity'});
  }
  resetCards(el);
}

/**
 * Park the browse layer WITHOUT an episode (the restore-mount path: the
 * screen mounts with the detail stage already open, so no enter hook plays
 * and no inline recede exists yet — the parked truth must still hold).
 */
export function parkMaBrowse(root: Element): void {
  const browse = root.querySelector<HTMLElement>('.con-ma__browse');
  if (browse !== null) {
    descendParkLayer(browse);
  }
}

/** Cancelled-pair hooks (the surface-motion idiom). */
export function maFocusEnterCancelledHook(el: Element): void {
  killDescendEpisode(el);
  const hidden = revealablesOf(el);
  if (hidden.length > 0) {
    gsap.set(hidden, {clearProps: 'transform,opacity,visibility'});
  }
}

export function maFocusLeaveCancelledHook(el: Element): void {
  killDescendEpisode(el);
  // A cancelled leave means the stage STAYS — restore what the fold had
  // started to let go, then re-park the browse layer and the released card
  // content (the enter hook's end state).
  const hidden = revealablesOf(el);
  if (hidden.length > 0) {
    gsap.set(hidden, {clearProps: 'transform,opacity,visibility'});
  }
  const browse = browseOf(el);
  if (browse !== null) {
    descendParkLayer(browse);
  }
  const content = cardContentOf(el);
  if (content.length > 0) {
    gsap.set(content, {autoAlpha: 0});
  }
  const cardArt = cardArtOf(el);
  if (cardArt !== null) {
    gsap.set(cardArt, {opacity: 0});
  }
  const hero = heroOf(el);
  if (hero !== null) {
    gsap.set(hero, {clearProps: 'opacity'});
  }
  const surface = surfaceOf(el);
  if (surface !== null) {
    gsap.set(surface, {clearProps: 'clipPath,webkitClipPath'});
  }
}

// ── THE CEREMONY PHRASE (commit confirmed → coronation ON the stage) ────────
//
// The hero emblem is already standing in its detail seat — the ceremony
// develops OUT of it: the detail panels release in place, the emblem GLIDES
// (same DOM node, transform only) into the centre ceremony seat, the
// coronation dressing surfaces around it, the shared burst fires, and after
// the dwell the completion callback releases the shell to close the
// workspace. No re-entrance, no second emblem, no reset of scale/position.

const CERE_DETAIL_OUT_MS = 180;
const CERE_GLIDE_AT_MS = 120;
const CERE_GLIDE_MS = 520;
/** The dressing overlaps the glide's settle (a queue reads as two events). */
const CERE_DRESS_LEAD_MS = 160;
const CERE_LINE_MS = 420;
const CERE_LINE_STAGGER_S = 0.09;
/** The coronation dwell — measured from the dressing's arrival. The original
 *  overlay lifetimes (3600/3000) included its own hero entrance; the hero is
 *  already on stage here, so the beat spends its length on the ceremony. */
const CERE_DWELL_MILESTONE_MS = 2900;
const CERE_DWELL_AWARD_MS = 2500;
const CERE_REDUCED_DWELL_MS = 1400;

type CeremonyEpisode = {
  tl: gsap.core.Timeline,
  burst: CeremonyBurstHandle | undefined,
  consumed: boolean,
};

let cereEpisode: CeremonyEpisode | undefined;

/** Kill a live ceremony episode (unmount / teardown). The completion
 *  callback will NOT fire after this — the caller owns the exit path. */
export function stopMaCeremonyStage(): void {
  if (cereEpisode === undefined) {
    return;
  }
  cereEpisode.consumed = true;
  cereEpisode.burst?.stop();
  cereEpisode.tl.kill();
  cereEpisode = undefined;
}

/**
 * Transform-only glide args from the element's CURRENT box onto a target
 * rect (centre-anchored), zoom-compensated like `descendFlipFrom`.
 */
function glideTo(el: HTMLElement, target: Rect): {x: number, y: number, scale: number} | undefined {
  const from = el.getBoundingClientRect();
  if (from.width < 10 || target.width < 10) {
    return undefined;
  }
  const effZoom = el.offsetWidth > 0 ? from.width / el.offsetWidth : 1;
  return {
    x: ((target.left + target.width / 2) - (from.left + from.width / 2)) / effZoom,
    y: ((target.top + target.height / 2) - (from.top + from.height / 2)) / effZoom,
    scale: target.width / from.width,
  };
}

/**
 * Play the ceremony ON the detail stage. `onDone` fires exactly once, after
 * the dwell (or the safety timer) — it is the shell's ONE close signal.
 */
export function runMaCeremonyStage(
  el: Element,
  opts: {kind: MaKind},
  onDone: () => void,
): void {
  stopMaCeremonyStage();
  const hero = heroOf(el);
  const seat = el.querySelector<HTMLElement>('[data-ma-cere-seat]');
  // The glide TARGET is the seat's inner slot (smaller than the ring, so the
  // coronation ring frames the emblem); the seat itself hosts the burst.
  const slot = el.querySelector<HTMLElement>('[data-ma-cere-slot]') ?? seat;
  const dress = Array.from(el.querySelectorAll<HTMLElement>('[data-ma-cere-dress]'));
  const lines = Array.from(el.querySelectorAll<HTMLElement>('[data-ma-cere-line]'));
  const detail = Array.from(el.querySelectorAll<HTMLElement>('[data-ma-detail]'));

  const reduced = consoleReducedMotionActive();
  const dwellMs = reduced ? CERE_REDUCED_DWELL_MS :
    opts.kind === 'milestone' ? CERE_DWELL_MILESTONE_MS : CERE_DWELL_AWARD_MS;

  let finished = false;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    cereEpisode = undefined;
    onDone();
  };

  if (typeof window === 'undefined' || hero === null || seat === null) {
    // No stage to play on (teardown race) — the completion still fires so the
    // flow can never hang on a missing DOM node.
    window.setTimeout(finish, motionMs(reduced ? 200 : 800));
    return;
  }

  if (reduced) {
    // Reduced motion: the detail steps aside, the dressing states the result,
    // the dwell is short — no glide, no burst (ceremonyFx already no-ops).
    const tl = gsap.timeline({onComplete: finish});
    if (detail.length > 0) {
      tl.to(detail, {autoAlpha: 0, duration: 0.12, ease: 'power1.in'}, 0);
    }
    if (dress.length > 0 || lines.length > 0) {
      tl.fromTo([...dress, ...lines], {autoAlpha: 0}, {autoAlpha: 1, duration: 0.14, ease: 'power1.out'}, 0.1);
    }
    tl.to({}, {duration: s(dwellMs)}, '>');
    cereEpisode = {tl, burst: undefined, consumed: false};
    return;
  }

  // Hidden before the first paint of the ceremony zone (the caller mounts it
  // and runs this in the same tick).
  if (dress.length > 0) {
    gsap.set(dress, {autoAlpha: 0});
  }
  if (lines.length > 0) {
    gsap.set(lines, {autoAlpha: 0});
  }

  const slotRect = descendRectOf(slot);
  const glide = slotRect !== undefined ? glideTo(hero, slotRect) : undefined;
  const glideEndS = s(CERE_GLIDE_AT_MS + CERE_GLIDE_MS);
  const dressAtS = glideEndS - s(CERE_DRESS_LEAD_MS);
  const dwellEndS = dressAtS + s(CERE_LINE_MS) + s(dwellMs);

  const tl = gsap.timeline({onComplete: finish});
  // 1. The detail UI steps aside IN PLACE — the scene belongs to the emblem.
  if (detail.length > 0) {
    tl.to(detail, {autoAlpha: 0, y: -6, duration: s(CERE_DETAIL_OUT_MS), ease: 'power2.in', stagger: 0.02}, 0);
  }
  // 2. THE HERO GLIDES to the ceremony seat — the same physical object, one
  //    continuous move (transform only; the layout beneath never reflows).
  if (glide !== undefined) {
    tl.to(hero, {
      x: glide.x, y: glide.y, scale: glide.scale,
      transformOrigin: '50% 50%',
      duration: s(CERE_GLIDE_MS),
      ease: 'power3.inOut',
    }, s(CERE_GLIDE_AT_MS));
  }
  // 3. The coronation dressing surfaces around the settling emblem.
  if (dress.length > 0) {
    tl.fromTo(dress,
      {autoAlpha: 0, scale: 0.82, transformOrigin: '50% 50%'},
      {autoAlpha: 1, scale: 1, duration: s(520), ease: 'power2.out', stagger: 0.06}, dressAtS);
  }
  if (lines.length > 0) {
    tl.fromTo(lines,
      {autoAlpha: 0, y: 10},
      {autoAlpha: 1, y: 0, duration: s(CERE_LINE_MS), ease: 'expo.out', stagger: CERE_LINE_STAGGER_S},
      dressAtS + s(120));
  }
  // 4. THE BURST — the shared ceremony language, over the seat the emblem
  //    just landed in.
  tl.call(() => {
    if (cereEpisode !== undefined && !cereEpisode.consumed) {
      cereEpisode.burst = playCeremonyBurst({
        host: seat,
        accent: opts.kind === 'milestone' ? 'gold' : 'medal',
        reduced: false,
        intensity: 'full',
        delayMs: 0,
      });
    }
  }, undefined, dressAtS + s(60));
  // 5. THE DWELL — the player reads the result; the completion after it is
  //    the shell's one close signal.
  tl.to({}, {duration: Math.max(0.01, dwellEndS - tl.duration())}, '>');
  cereEpisode = {tl, burst: undefined, consumed: false};
}
