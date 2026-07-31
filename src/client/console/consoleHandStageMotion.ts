/*
 * HAND STAGE MOTION — the browse ⇄ play choreography of «КАРТЫ В РУКЕ».
 *
 * THE PROBLEM THIS SOLVES. The obvious way to carry the chosen card into the
 * play stage is to fly it there. It is also the wrong way: the hand is a GRID,
 * so the card the player picked can be anywhere in it, and a card picked at the
 * far right has to be dragged across the entire viewport. That reads as a
 * widget being transported — mechanical, slow, and worse the further right the
 * card sat, which is exactly the kind of inconsistency a premium transition
 * cannot have.
 *
 * THE ANSWER IS TO MOVE THE CAMERA, NOT THE CARD. The whole browse layer is
 * transformed so that the chosen card comes to rest on the play stage's anchor.
 * The card therefore never moves RELATIVE TO ITS OWN SURFACE — the surface
 * reframes around it — and the distance the eye travels is identical whether
 * the card was first or last in the grid. One transform on one layer, which is
 * also why this is cheap: no per-card tween, no proxy, no second render of the
 * hand.
 *
 * THE PHRASE (order is the whole point):
 *
 *  1. COMMIT — the pressed slot answers the press where it stands. Short, and
 *     it is the only beat before anything moves, so the player knows WHICH card
 *     was taken before the space starts changing.
 *  2. DEPTH COLLAPSE — every other card lets go and is GONE. Not dimmed to a
 *     ghost: a hand grid still legible behind the play surface is the single
 *     loudest "this is a modal over a screen" cue there is.
 *  3. CAMERA REFRAME — the layer translates + scales so the chosen card lands
 *     exactly on the stage's hero rect.
 *  4. HANDOFF — in ONE frame the real hero becomes visible and the browse layer
 *     goes dark. Both are the same card face at the same rect and the same
 *     size, so the swap has nothing to see.
 *  5. CONTEXT UNFOLD — only now does the work surface open, from the card.
 *
 * B reverses it exactly: the surface folds, the layer is placed back at the
 * reframed transform with the hero hidden, and it flies home to identity — so
 * the card lands back in its own slot rather than being re-created there.
 *
 * The HEADER is deliberately untouched by all of this. It is the system anchor;
 * only its breadcrumb tail crossfades, and that is the workspace's own doing.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {
  armDescendRect,
  takeDescendRect,
  guardedDescend,
  killDescendEpisode,
  descendUnfold,
  descendFold,
  descendCascade,
  descendCascadeOut,
  descendRectOf,
  descendRadiusOf,
  descendPx,
} from '@/client/console/surfaceMotion/workspaceDescend';

// ── timings (1080-logical ms; motionMs folds the speed preset) ───────────────

/** The pressed card acknowledging the press, before anything moves. */
const COMMIT_MS = 130;
/** The camera reframing around the chosen card. */
const CAMERA_MS = 400;
/** …and flying home on the way back. */
const CAMERA_BACK_MS = 330;
/** The work surface opening from the card, and folding back. */
const UNFOLD_MS = 260;
const FOLD_MS = 190;
/** The controls surfacing from inside the opened surface. */
const CASCADE_MS = 190;
const CASCADE_OUT_MS = 90;
/** How long we wait for the teleported composer's hero to exist (frames). */
const HERO_POLL_FRAMES = 24;

const CARD_KEY = 'hand-card';

/**
 * The pressed card's viewport rect, armed SYNCHRONOUSLY in the A handler —
 * before the stage mounts, while the slot is still where the player saw it.
 */
export function armHandStageOrigin(rect: {left: number, top: number, width: number, height: number} | undefined): void {
  armDescendRect(CARD_KEY, rect);
}

/** The camera transform that carried the card to the anchor — kept so B can
 *  put the layer back exactly there before flying it home. */
type CameraShot = {x: number, y: number, scale: number, origin: string};
let camera: CameraShot | undefined;

/**
 * THE INPUT GATE. The phrase owns the pad from the press until the work
 * surface has settled: mid-reframe the composer is mounted and would happily
 * take an A for a CTA the player cannot even see yet, and a second A on the way
 * back would re-descend into a card that is still flying home. Not a
 * `setTimeout` — it is released by the episode's own completion, so a slow
 * frame lengthens the lock instead of opening a hole in it.
 */
let transitioning = false;

export function handStageTransitioning(): boolean {
  return transitioning;
}

/** The rect the work surface unfolded FROM (the anchored card). */
let unfoldedFrom: {rect: {left: number, top: number, width: number, height: number}, radius: number | undefined} | undefined;

export function resetHandStageMotion(): void {
  camera = undefined;
  unfoldedFrom = undefined;
  transitioning = false;
}

/** Wrap an episode so the gate can never be left closed — `guardedDescend`
 *  guarantees `done()` fires exactly once, on completion OR on its safety. */
function gated(done: () => void): () => void {
  transitioning = true;
  return () => {
    transitioning = false;
    done();
  };
}

function rootOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('.con-hand');
}

function browseOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-hand__browse') ?? null;
}

/** The card the descent opened from — the camera's subject. */
function selectedSlotOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-hand__slot--selected') ?? null;
}

/** The CARD FACE inside a slot / the hero well — rects must compare like for
 *  like, and the slot box carries padding the card face does not. */
function faceOf(el: Element | null): HTMLElement | null {
  return el?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? null;
}

/** The teleported composer's card well (present a flush AFTER this zone). */
function heroWellOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-zoom-handoff="play-card"]');
}

/** The controls that surface from inside the opened surface. */
function cascadeItemsOf(el: Element): Array<HTMLElement> {
  return Array.from(el.querySelectorAll<HTMLElement>('[data-unfold-item]'));
}

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/** The section is hidden by a pick bridge / not laid out — no live geometry. */
function noGeometry(el: Element): boolean {
  return el instanceof HTMLElement && el.offsetParent === null && getComputedStyle(el).position !== 'fixed';
}

/**
 * Wait for the teleported hero to exist and be measurable. Bounded in FRAMES,
 * not milliseconds: the wait is over as soon as Vue has patched, and the
 * fallback is a plain reveal rather than a stall.
 */
function whenHeroReady(el: Element, then: (well: HTMLElement | null) => void): void {
  let frames = 0;
  const poll = () => {
    const well = heroWellOf(el);
    const face = faceOf(well);
    if (face !== null && face.getBoundingClientRect().width > 8) {
      then(well);
      return;
    }
    if (++frames >= HERO_POLL_FRAMES) {
      then(null);
      return;
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}

/**
 * Solve the camera: the transform that maps `from` (the card where it sits in
 * the grid) onto `to` (the stage's hero rect).
 *
 * The origin is the card's centre IN THE LAYER'S OWN BOX, so the scale pivots
 * on the card and the translate is then a pure centre-to-centre delta. Doing it
 * the other way round (origin at the layer centre) makes the translate depend
 * on the scale and the card overshoots by exactly the grid's own offset — the
 * bug that makes this kind of transition look "almost right".
 */
export type CameraBox = {left: number, top: number, width: number, height: number};

export function solveCameraShot(
  layerBox: CameraBox,
  from: CameraBox,
  to: CameraBox,
): CameraShot | undefined {
  if (layerBox.width < 1 || from.width < 1 || to.width < 1) {
    return undefined;
  }
  const originX = from.left + from.width / 2 - layerBox.left;
  const originY = from.top + from.height / 2 - layerBox.top;
  return {
    x: (to.left + to.width / 2) - (from.left + from.width / 2),
    y: (to.top + to.height / 2) - (from.top + from.height / 2),
    scale: to.width / from.width,
    origin: `${originX.toFixed(1)}px ${originY.toFixed(1)}px`,
  };
}

function solveCamera(layer: HTMLElement, from: DOMRect, to: DOMRect): CameraShot | undefined {
  return solveCameraShot(layer.getBoundingClientRect(), from, to);
}

// ── enter (browse → play stage) ─────────────────────────────────────────────

export function handStageEnterHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || noGeometry(el)) {
    killDescendEpisode(el);
    done();
    return;
  }
  const browse = browseOf(el);
  const slot = selectedSlotOf(el);
  const slotFace = faceOf(slot);
  const armedRect = takeDescendRect(CARD_KEY);
  camera = undefined;

  if (consoleReducedMotionActive() || browse === null || slotFace === null) {
    // No camera to move (or the player asked for none): keep the honest
    // unfold-from-the-card so the stage still opens FROM somewhere.
    const fromRect = armedRect ?? descendRectOf(slot);
    unfoldedFrom = fromRect === undefined ? undefined : {rect: fromRect, radius: descendRadiusOf(slot)};
    guardedDescend(el, UNFOLD_MS + 160, gated(done), (finish) => {
      const tl = gsap.timeline({onComplete: finish});
      if (browse !== null) {
        gsap.set(browse, {autoAlpha: 0});
      }
      if (!descendUnfold(tl, el as HTMLElement, fromRect, s(UNFOLD_MS), 0, descendRadiusOf(slot))) {
        tl.fromTo(el, {autoAlpha: 0, y: descendPx(10)},
          {autoAlpha: 1, y: 0, duration: s(CASCADE_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, 0);
      }
      return tl;
    });
    return;
  }

  // The stage stays invisible until the camera has landed — the work surface
  // must not be readable over a hand that is still reframing.
  gsap.set(el, {autoAlpha: 0});
  // The layer's RESTING truth while a stage is open is «hidden» (the `--parked`
  // class), because that is what must hold if no episode ever runs. For the
  // duration of the camera it is the visible representation of the card, so the
  // director takes it back with an inline override — which beats the class by
  // construction and is undone by `clearProps` on the way out.
  gsap.set(browse, {autoAlpha: 1});
  // 1 · COMMIT + 2 · DEPTH COLLAPSE — both are CSS on the layer (one class,
  // one paint), so the cost does not grow with the size of the hand.
  browse.classList.add('con-hand__browse--reframing');

  guardedDescend(el, COMMIT_MS + CAMERA_MS + UNFOLD_MS + 420, gated(done), (finish) => {
    const tl = gsap.timeline({paused: true, onComplete: finish});
    whenHeroReady(el, (well) => {
      const heroFace = faceOf(well);
      const from = slotFace.getBoundingClientRect();
      const to = heroFace?.getBoundingClientRect();
      const shot = to === undefined ? undefined : solveCamera(browse, from, to);
      unfoldedFrom = to === undefined ?
        undefined :
        {rect: {left: to.left, top: to.top, width: to.width, height: to.height}, radius: descendRadiusOf(heroFace)};

      if (shot === undefined || well === null) {
        // Degrade to the plain open rather than to a wrong camera: a solve on
        // unusable geometry would fling the layer somewhere arbitrary.
        gsap.set(browse, {autoAlpha: 0});
        tl.to(el, {autoAlpha: 1, duration: s(CASCADE_MS), ease: 'power2.out'}, 0);
        descendCascade(tl, cascadeItemsOf(el), s(CASCADE_MS), s(60));
        tl.play();
        return;
      }
      camera = shot;
      // The hero is the same card as the one on the layer — only one of them
      // may be visible at a time, ever.
      gsap.set(well, {autoAlpha: 0});
      // 3 · CAMERA REFRAME.
      tl.to(browse, {
        x: shot.x, y: shot.y, scale: shot.scale,
        transformOrigin: shot.origin,
        duration: s(CAMERA_MS), ease: 'power3.inOut',
      }, s(COMMIT_MS));
      // 4 · HANDOFF — one frame, both ends at the same rect.
      tl.add(() => {
        gsap.set(well, {autoAlpha: 1});
        gsap.set(browse, {autoAlpha: 0});
      });
      // 5 · CONTEXT UNFOLD — the work surface opens FROM the anchored card.
      tl.set(el, {autoAlpha: 1});
      if (!descendUnfold(tl, el as HTMLElement, unfoldedFrom?.rect, s(UNFOLD_MS), '<', unfoldedFrom?.radius)) {
        tl.fromTo(el, {autoAlpha: 0}, {autoAlpha: 1, duration: s(CASCADE_MS), ease: 'power2.out'}, '<');
      }
      descendCascade(tl, cascadeItemsOf(el), s(CASCADE_MS), '<+=0.06');
      tl.play();
    });
    return tl;
  });
}

// ── leave (play stage → browse; the CANCEL path) ────────────────────────────

export function handStageLeaveHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || noGeometry(el)) {
    killDescendEpisode(el);
    camera = undefined;
    unfoldedFrom = undefined;
    done();
    return;
  }
  const browse = browseOf(el);
  const well = heroWellOf(el);
  const home = unfoldedFrom;
  const shot = camera;
  const items = cascadeItemsOf(el);
  unfoldedFrom = undefined;
  camera = undefined;

  const restoreLayer = () => {
    if (browse !== null) {
      browse.classList.remove('con-hand__browse--reframing');
      gsap.set(browse, {clearProps: 'transform,opacity,visibility,transformOrigin'});
    }
  };

  if (consoleReducedMotionActive() || browse === null || shot === undefined) {
    guardedDescend(el, 140, gated(done), (finish) => {
      restoreLayer();
      return gsap.to(el, {autoAlpha: 0, duration: 0.1, ease: 'power1.in', onComplete: finish});
    });
    return;
  }

  guardedDescend(el, FOLD_MS + CAMERA_BACK_MS + 300, gated(done), (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1 · the controls let go, then the surface folds back into the card.
    descendCascadeOut(tl, items, s(CASCADE_OUT_MS), 0);
    const folded = descendFold(tl, el as HTMLElement, home?.rect, s(FOLD_MS), s(40), home?.radius);
    tl.to(el, {autoAlpha: 0, duration: s(folded ? 90 : 110), ease: 'power2.in'}, s(folded ? FOLD_MS - 20 : 0));
    // 2 · the layer takes the card back at EXACTLY the rect the hero occupies,
    //     so the object is handed over rather than re-created.
    tl.add(() => {
      if (well !== null) {
        gsap.set(well, {autoAlpha: 0});
      }
      gsap.set(browse, {x: shot.x, y: shot.y, scale: shot.scale, transformOrigin: shot.origin, autoAlpha: 1});
    });
    // 3 · the camera flies home; the rest of the hand comes back with it.
    tl.add(() => browse.classList.remove('con-hand__browse--reframing'));
    tl.to(browse, {
      x: 0, y: 0, scale: 1,
      duration: s(CAMERA_BACK_MS), ease: 'power3.inOut',
      clearProps: 'transform,opacity,visibility,transformOrigin',
    });
    return tl;
  });
}

export function handStageEnterCancelledHook(el: Element): void {
  killDescendEpisode(el);
}

export function handStageLeaveCancelledHook(el: Element): void {
  killDescendEpisode(el);
  gsap.set(el, {clearProps: 'clipPath,webkitClipPath,opacity,visibility,transform'});
  // A cancelled leave means the stage STAYS: the layer must go back to hidden,
  // or the hand would sit visible underneath the play surface.
  const browse = browseOf(el);
  if (browse !== null) {
    browse.classList.add('con-hand__browse--reframing');
    gsap.set(browse, {autoAlpha: 0});
  }
}

/**
 * THE SECOND REVEAL — kept for hosts that arrive into an already-open zone.
 *
 * The enter hook now waits for the teleported composer itself (it has to, to
 * measure the hero), so on the normal path the cascade is part of the one
 * phrase and this is a no-op. It still matters when the composer re-mounts into
 * a standing stage (a pick bridge coming back), where there is no camera move
 * to hang the reveal on.
 */
export function handStageReveal(root: HTMLElement | undefined): void {
  if (root === undefined || typeof window === 'undefined') {
    return;
  }
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-unfold-item]'));
  if (items.length === 0 || root.closest('.con-hand__stage') === null) {
    return;
  }
  if (consoleReducedMotionActive()) {
    gsap.set(items, {clearProps: 'transform,opacity,visibility'});
    return;
  }
  // Only when the zone is already settled — otherwise the enter hook owns it.
  const stage = root.closest<HTMLElement>('.con-hand__stage');
  if (stage !== null && Number(getComputedStyle(stage).opacity) < 0.9) {
    return;
  }
  const tl = gsap.timeline();
  descendCascade(tl, items, s(CASCADE_MS), 0);
}
