/*
 * HAND STAGE MOTION — the OCCLUSION BRIDGE between «КАРТЫ В РУКЕ» and the
 * Card Play level.
 *
 * WHY NOT A FLIGHT, AND WHY NOT A CAMERA. The chosen card can be anywhere in
 * the grid, so flying it to the play anchor dragged it across however much
 * viewport happened to lie in between — mechanical, and worse the further
 * right the card sat. The next attempt transformed the WHOLE browse layer so
 * the card came to rest on the anchor (a "virtual camera"). That fixed the
 * distance problem and created three new ones: the handoff between the scaled
 * grid card and the real hero was a visible micro-jerk (two different render
 * paths of the same face can never match to the pixel), the return played as a
 * zoom-out of the entire scene (dozens of cards moving at once reads as the UI
 * losing its footing), and the cost of the move scaled with the size of the
 * hand. Both models are gone.
 *
 * THE BRIDGE. The awkward distance between the slot and the anchor is not
 * travelled — it is OCCLUDED. A near-opaque premium surface grows out of the
 * chosen card, covers the work area, and under that cover the re-anchor
 * happens instantly and invisibly. The bridge then sweeps away to the right,
 * revealing the card already standing on the play anchor and the work surface
 * assembling behind the veil's trailing edge. Nothing else on the screen
 * moves: the grid stays put, the header stays put, and the cost of the
 * transition is one plane + one group fade, whatever the hand holds.
 *
 * ENTRY (the phases are the contract, their overlap is the craft):
 *  1 · CARD COMMIT     — the pressed card answers IN ITS SLOT (CSS `--staged`
 *                        pulse); everything else stands still.
 *  2 · HAND ISOLATION  — the other cards and the browse chrome fade out in
 *                        place. Opacity only; nothing travels.
 *  3 · BRIDGE OPEN     — the bridge UNFOLDS from the card's own rect
 *                        (clip-path — the surface visibly belongs to the card).
 *  4 · HIDDEN RE-ANCHOR— under full cover: grid hidden, play level shown,
 *                        and the reveal waits for TWO STABLE FRAMES of the
 *                        hero's rect, so nothing can move after it is seen.
 *  5 · REVEAL          — the bridge sweeps off to the right (its lit edge is
 *                        the frontier), uncovering the card first, then the
 *                        work surface groups materialize with a short stagger.
 *
 * RETURN plays the same material backwards: the controls let go, the bridge
 * sweeps IN from the right until the level is covered, the grid is restored
 * under the cover (selected card back in its own slot — it never left the
 * DOM), the bridge FOLDS into that slot and dissolves over the card, and the
 * rest of the hand fades back in around it.
 *
 * ONE VISUAL OWNER, ALWAYS. Source card → (covered) → play hero → (covered) →
 * source card. The two representations are never on screen together and the
 * swap always happens under a fully opaque plane, so identity continuity is a
 * property of the construction, not of a pixel-perfect alignment.
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
} from '@/client/console/surfaceMotion/workspaceDescend';

// ── timings (1080-logical ms; motionMs folds the speed preset) ───────────────

/* The COMMIT beat has no constant of its own: the pulse is CSS (`--staged`,
 * ~150 ms) and the timeline BUYS its beat with the offsets below — isolation
 * starts while the pulse is still landing, the bridge only after it has. */
/** Everything that is not the chosen card letting go, in place. */
const ISOLATE_AT_MS = 100;
const ISOLATE_MS = 150;
/** The bridge unfolding out of the card's rect. */
const UNFOLD_AT_MS = 190;
const UNFOLD_MS = 240;
/** The bridge sweeping off / in — the reveal and the cover. */
const SWEEP_OUT_MS = 280;
const SWEEP_IN_MS = 240;
/** The bridge folding into the home slot on the way back. */
const FOLD_MS = 210;
/** The fold's plate dissolving over the returned card. */
const BRIDGE_FADE_MS = 130;
/** The rest of the hand blooming back in around the returned card. */
const SIBLINGS_IN_MS = 170;
/** The play controls letting go on B. */
const CASCADE_OUT_MS = 90;
/** Work-surface groups materializing behind the sweep. */
const CASCADE_MS = 190;
/** Stability wait cap, in FRAMES (the wait ends the moment layout settles). */
const STABLE_FRAMES = 24;

const CARD_KEY = 'hand-card';

/**
 * The pressed card's viewport rect, armed SYNCHRONOUSLY in the A handler —
 * before the stage mounts, while the slot is still where the player saw it.
 */
export function armHandStageOrigin(rect: {left: number, top: number, width: number, height: number} | undefined): void {
  armDescendRect(CARD_KEY, rect);
}

/**
 * THE INPUT GATE. The phrase owns the pad from the press until the surface has
 * settled: mid-bridge the composer is mounted and would take an A for a CTA
 * the player cannot see yet, and a second B on the way back would re-enter a
 * transition already running. A COUNTER, not a boolean: a cancelled episode's
 * safety release must not unlock a successor episode that is still live.
 */
let liveEpisodes = 0;

export function handStageTransitioning(): boolean {
  return liveEpisodes > 0;
}

/** Wrap an episode's `done` so the gate and the cleanup can never be leaked —
 *  `guardedDescend` fires it exactly once, on completion OR on its safety. */
function gated(done: () => void, cleanup?: () => void): () => void {
  liveEpisodes++;
  return () => {
    liveEpisodes = Math.max(0, liveEpisodes - 1);
    try {
      cleanup?.();
    } finally {
      done();
    }
  };
}

// ── the bridge plane ────────────────────────────────────────────────────────

type Bridge = {host: HTMLElement, plane: HTMLElement};
let activeBridge: Bridge | undefined;

/** Build the occlusion plane inside the stage wrap. Imperative on purpose —
 *  it exists only for the length of one episode, like every proxy layer. */
function createBridge(near: Element): Bridge | undefined {
  const wrap = near.closest<HTMLElement>('.con-hand__stagewrap');
  if (wrap === null) {
    return undefined;
  }
  destroyBridge();
  const host = document.createElement('div');
  host.className = 'con-hand__bridgehost';
  const plane = document.createElement('div');
  plane.className = 'con-hand__bridge';
  const edge = document.createElement('div');
  edge.className = 'con-hand__bridge-edge';
  plane.appendChild(edge);
  host.appendChild(plane);
  wrap.appendChild(host);
  activeBridge = {host, plane};
  return activeBridge;
}

function destroyBridge(): void {
  activeBridge?.host.remove();
  activeBridge = undefined;
}

export function resetHandStageMotion(): void {
  destroyBridge();
  liveEpisodes = 0;
}

// ── element resolution ──────────────────────────────────────────────────────

function rootOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('.con-hand');
}

function browseOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-hand__browse') ?? null;
}

function selectedSlotOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-hand__slot--selected') ?? null;
}

/** The CARD FACE inside a slot / the hero well — rects compare like for like;
 *  the slot box carries chrome the face does not. */
function faceOf(el: Element | null): HTMLElement | null {
  return el?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? null;
}

/** The teleported composer's card well (mounts a flush after the zone). */
function heroWellOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-zoom-handoff="play-card"]');
}

/** Everything the HAND ISOLATION fades: every card except the chosen one,
 *  plus the browse chrome that describes a decision already made. */
function isolationTargets(browse: HTMLElement): Array<HTMLElement> {
  return Array.from(browse.querySelectorAll<HTMLElement>(
    '.con-hand__slot:not(.con-hand__slot--selected), .con-hand__scrollbar, .con-hand__verdictbar, .con-hand__empty'));
}

/** The work-surface groups that materialize behind the sweep. */
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
 * PHASE 4's stability contract: resolve only after the hero's rect has held
 * still for TWO CONSECUTIVE FRAMES (fonts applied, zoom applied, layout done).
 * Bounded in frames, not milliseconds — the wait ends the moment Vue and the
 * layout engine settle, and the cap turns a pathological stall into a reveal
 * rather than a hang.
 */
function whenStageStable(el: Element, then: () => void): void {
  let frames = 0;
  let stable = 0;
  let last: DOMRect | undefined;
  const probe = (): HTMLElement | null =>
    faceOf(heroWellOf(el)) ?? el.querySelector<HTMLElement>('.con-composer--embed');
  const step = () => {
    const target = probe();
    if (target !== null) {
      const r = target.getBoundingClientRect();
      const same = last !== undefined &&
        Math.abs(r.left - last.left) < 0.5 && Math.abs(r.top - last.top) < 0.5 &&
        Math.abs(r.width - last.width) < 0.5 && Math.abs(r.height - last.height) < 0.5;
      stable = same ? stable + 1 : 0;
      last = r;
      if (stable >= 2 && r.width > 8) {
        then();
        return;
      }
    }
    if (++frames >= STABLE_FRAMES) {
      then();
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── ENTRY (browse → play level) ─────────────────────────────────────────────

export function handStageEnterHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || noGeometry(el)) {
    killDescendEpisode(el);
    done();
    return;
  }
  const browse = browseOf(el);
  const slotFace = faceOf(selectedSlotOf(el));
  const armed = takeDescendRect(CARD_KEY);

  if (consoleReducedMotionActive() || browse === null) {
    // Reduced motion: commit → cover-free static anchor change → short reveal.
    // The `--parked` class hides the grid in the same flush; no space moves.
    guardedDescend(el, 160, gated(done), (finish) =>
      gsap.fromTo(el, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.1, ease: 'power1.out', clearProps: 'opacity,visibility', onComplete: finish}));
    return;
  }

  // The stage stays invisible until the bridge covers the space, and the
  // browse layer is taken back from its `--parked` resting truth for exactly
  // the length of the phrase (inline beats the class; cleanup returns it).
  gsap.set(el, {autoAlpha: 0});
  gsap.set(browse, {autoAlpha: 1});

  const siblings = isolationTargets(browse);
  const items = cascadeItemsOf(el);
  const fromRect = slotFace?.getBoundingClientRect() ?? armed ?? descendRectOf(selectedSlotOf(el));
  const radius = descendRadiusOf(slotFace);
  const bridge = createBridge(el);

  const cleanup = () => {
    destroyBridge();
    // The resting truths come back: the browse layer to its `--parked` class,
    // the siblings to their stylesheet opacity (a pick bridge needs them
    // LIVE, so inline zeros must never survive the episode), the stage and
    // the groups to plain visibility.
    gsap.set(browse, {clearProps: 'opacity,visibility'});
    if (siblings.length > 0) {
      gsap.set(siblings, {clearProps: 'opacity,visibility'});
    }
    if (items.length > 0) {
      gsap.set(items, {clearProps: 'opacity,visibility'});
    }
    gsap.set(el, {clearProps: 'opacity,visibility'});
  };

  if (bridge === undefined) {
    guardedDescend(el, 200, gated(done, cleanup), (finish) =>
      gsap.fromTo(el, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.12, ease: 'power1.out', onComplete: finish}));
    return;
  }
  gsap.set(bridge.plane, {autoAlpha: 0});

  guardedDescend(el, UNFOLD_AT_MS + UNFOLD_MS + SWEEP_OUT_MS + 900, gated(done, cleanup), (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1 · COMMIT — the CSS `--staged` pulse is already playing in the slot;
    //     the timeline's only job here is to give it its beat.
    // 2 · ISOLATION — everything that is not the chosen card lets go in place.
    if (siblings.length > 0) {
      tl.to(siblings, {autoAlpha: 0, duration: s(ISOLATE_MS), ease: 'power1.out'}, s(ISOLATE_AT_MS));
    }
    // 3 · BRIDGE OPEN — the plane unfolds out of the card's own rect.
    tl.set(bridge.plane, {autoAlpha: 1}, s(UNFOLD_AT_MS));
    if (!descendUnfold(tl, bridge.plane, fromRect, s(UNFOLD_MS), s(UNFOLD_AT_MS), radius)) {
      // Unusable geometry: the cover is the CONTRACT, so it materializes in
      // place instead of unfolding — never skipped.
      tl.fromTo(bridge.plane, {autoAlpha: 0}, {autoAlpha: 1, duration: s(160), ease: 'power2.out'}, s(UNFOLD_AT_MS));
    }
    // 4 · HIDDEN RE-ANCHOR — under full cover: swap the owner, then hold the
    //     reveal until the hero's rect has been still for two frames.
    tl.add(() => {
      gsap.set(browse, {autoAlpha: 0});
      if (siblings.length > 0) {
        gsap.set(siblings, {clearProps: 'opacity,visibility'});
      }
      if (items.length > 0) {
        gsap.set(items, {autoAlpha: 0});
      }
      gsap.set(el, {autoAlpha: 1});
    });
    tl.addPause('+=0.001', () => whenStageStable(el, () => tl.resume()));
    // 5 · REVEAL — the bridge sweeps off to the right (the lit edge is the
    //     frontier): the anchored card first, then the work surface, whose
    //     groups materialize just behind the veil.
    tl.set(bridge.plane, {clearProps: 'clipPath,webkitClipPath'});
    tl.to(bridge.plane, {xPercent: 103, duration: s(SWEEP_OUT_MS), ease: 'power2.inOut'});
    descendCascade(tl, items, s(CASCADE_MS), '<+=0.05', 0.045);
    return tl;
  });
}

// ── RETURN (play level → browse; the CANCEL path) ───────────────────────────

export function handStageLeaveHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || noGeometry(el)) {
    killDescendEpisode(el);
    destroyBridge();
    done();
    return;
  }
  const browse = browseOf(el);
  if (browse === null) {
    killDescendEpisode(el);
    destroyBridge();
    done();
    return;
  }
  // FIRST, before this tick can paint: the `--parked` class left with the
  // stage flag, so without this the whole grid would flash in behind the play
  // surface for the frame the leave takes to start.
  gsap.set(browse, {autoAlpha: 0});

  const siblings = isolationTargets(browse);
  const slotFace = faceOf(selectedSlotOf(el));
  // `visibility: hidden` keeps layout, so the home slot is measurable NOW —
  // the grid has not moved since entry (input was locked, scroll untouched).
  const home = slotFace?.getBoundingClientRect();
  const radius = descendRadiusOf(slotFace);
  const items = cascadeItemsOf(el);

  const cleanup = () => {
    destroyBridge();
    gsap.set(browse, {clearProps: 'opacity,visibility'});
    if (siblings.length > 0) {
      gsap.set(siblings, {clearProps: 'opacity,visibility'});
    }
  };

  if (consoleReducedMotionActive()) {
    guardedDescend(el, 160, gated(done, cleanup), (finish) =>
      gsap.to(el, {autoAlpha: 0, duration: 0.1, ease: 'power1.in', onComplete: finish}));
    return;
  }

  const bridge = createBridge(el);
  if (bridge === undefined) {
    guardedDescend(el, 160, gated(done, cleanup), (finish) =>
      gsap.to(el, {autoAlpha: 0, duration: 0.12, ease: 'power1.in', onComplete: finish}));
    return;
  }
  // The plane waits just off the right edge; its lit left edge is the frontier.
  gsap.set(bridge.plane, {xPercent: 103});

  guardedDescend(el, SWEEP_IN_MS + FOLD_MS + SIBLINGS_IN_MS + 700, gated(done, cleanup), (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1 · RELEASE — the controls let go where they stand.
    descendCascadeOut(tl, items, s(CASCADE_OUT_MS), 0);
    // 2 · COVER — the bridge sweeps in from the right over the play surface.
    tl.to(bridge.plane, {xPercent: 0, duration: s(SWEEP_IN_MS), ease: 'power2.inOut'}, s(40));
    // 3 · HIDDEN RETURN — under full cover: the play level goes dark and the
    //     grid comes back with only the chosen card visible, standing in its
    //     own slot (it never left the DOM, so this is a reveal, not a move).
    tl.add(() => {
      gsap.set(el, {autoAlpha: 0});
      if (siblings.length > 0) {
        gsap.set(siblings, {autoAlpha: 0});
      }
      gsap.set(browse, {autoAlpha: 1});
    });
    // 4 · FOLD — the bridge collapses into the home slot and dissolves over
    //     the card: the surface that came out of the card goes back into it.
    const folded = home !== undefined &&
      descendFold(tl, bridge.plane, {left: home.left, top: home.top, width: home.width, height: home.height}, s(FOLD_MS), '+=0.03', radius);
    if (folded) {
      tl.to(bridge.plane, {autoAlpha: 0, duration: s(BRIDGE_FADE_MS), ease: 'power1.out'}, '-=0.02');
    } else {
      tl.to(bridge.plane, {autoAlpha: 0, duration: s(170), ease: 'power1.inOut'}, '+=0.03');
    }
    // 5 · HAND REVEAL — the rest of the hand blooms back in around the card.
    if (siblings.length > 0) {
      tl.to(siblings, {
        autoAlpha: 1, duration: s(SIBLINGS_IN_MS), ease: 'power1.out',
        clearProps: 'opacity,visibility',
      }, folded ? '-=0.10' : '<');
    }
    return tl;
  });
}

// ── cancelled pairs ─────────────────────────────────────────────────────────

export function handStageEnterCancelledHook(el: Element): void {
  killDescendEpisode(el);
  // Leave the DOM in the entry's END state — the follow-up leave hook owns the
  // way back from exactly there. (The stale episode's safety still fires its
  // own cleanup + gate release; the counter keeps the new episode locked.)
  destroyBridge();
  const browse = browseOf(el);
  if (browse !== null) {
    gsap.set(browse, {autoAlpha: 0});
    const siblings = isolationTargets(browse);
    if (siblings.length > 0) {
      gsap.set(siblings, {clearProps: 'opacity,visibility'});
    }
  }
  gsap.set(el, {autoAlpha: 1});
}

export function handStageLeaveCancelledHook(el: Element): void {
  killDescendEpisode(el);
  // A cancelled leave means the stage STAYS: back to the play level's resting
  // state — surface visible, grid hidden (the `--parked` class is on again).
  destroyBridge();
  gsap.set(el, {clearProps: 'clipPath,webkitClipPath,transform'});
  gsap.set(el, {autoAlpha: 1});
  const browse = browseOf(el);
  if (browse !== null) {
    gsap.set(browse, {autoAlpha: 0});
  }
}

/**
 * THE SECOND REVEAL — for a composer that re-mounts into an ALREADY-OPEN zone
 * (the way back from a pick bridge). There is no bridge to hang the reveal on,
 * so the groups get the same short materialize they would have had behind the
 * sweep. During the initial entry the zone is still dark (autoAlpha 0) and the
 * enter hook owns everything — this is a deliberate no-op then.
 */
export function handStageReveal(root: HTMLElement | undefined): void {
  if (root === undefined || typeof window === 'undefined') {
    return;
  }
  const stage = root.closest<HTMLElement>('.con-hand__stage');
  if (stage === null) {
    return;
  }
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-unfold-item]'));
  if (items.length === 0) {
    return;
  }
  if (consoleReducedMotionActive()) {
    gsap.set(items, {clearProps: 'transform,opacity,visibility'});
    return;
  }
  if (Number(getComputedStyle(stage).opacity) < 0.9) {
    return;
  }
  const tl = gsap.timeline();
  descendCascade(tl, items, s(CASCADE_MS), 0);
}
