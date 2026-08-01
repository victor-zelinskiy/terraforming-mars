/*
 * HAND STAGE MOTION — the PERSISTENT HERO transition between «КАРТЫ В РУКЕ»
 * and the Card Play level.
 *
 * THE GRAMMAR, and why it is this one. Three models have now been tried:
 *
 *  · a raw proxy FLIGHT read as a widget being transported, worse the further
 *    right the card sat;
 *  · the VIRTUAL CAMERA (transforming the whole grid) fixed the distance and
 *    broke everything else: a visible micro-jerk at the handoff (two render
 *    paths of one face never match to the pixel), a return that read as the
 *    whole scene zooming out, and a cost that grew with the hand;
 *  · the OCCLUSION BRIDGE hid the re-anchor under an opaque plane — and hid
 *    THE CARD with it. The player saw their card vanish and a different card
 *    appear elsewhere: a teleport wearing a premium surface.
 *
 * The correct primitive was in the codebase all along: the exit-layer
 * TRANSFER (`runCardTransfer`) — ONE FaceLite hero on the app-level flight
 * stage, spawned over the source in the same paint the source hides, flying a
 * FIXED duration whatever the distance (velocity adapts, never the clock),
 * landing only after the destination's rect has held STABLE across frames,
 * revealing the real card UNDER itself and fading above it. What it lacked was
 * everything AROUND the card, and that is what this module adds:
 *
 *  · a COMMIT LIFT on the hero the frame it spawns (the press answers on the
 *    card itself — scale, ring, depth — while every neighbour stands still);
 *  · HAND ISOLATION — the rest of the hand fades IN PLACE (group opacity;
 *    the grid never transforms, so the cost never grows with the hand);
 *  · a CARD-LED SURFACE REVEAL — the work-surface groups materialize in
 *    reading order WHILE the hero flies, so the card and the level assemble
 *    as one event, not as a flight followed by a screen;
 *  · the INPUT GATE and the return phrase (groups release, the hand blooms
 *    back in around the hero flying home into its own held-empty slot).
 *
 * WHY THE CARD NEVER FLICKERS HERE. The hero is the ONLY visible owner from
 * the press to the dock: the slot hides in the spawn's paint, the destination
 * well is pre-held and revealed UNDER the still-opaque hero on touchdown, and
 * the flight does not even begin until the well's rect has stopped moving —
 * so nothing can shift after the player has seen the card arrive. The swap
 * frames are pixel-aligned by construction, not by luck.
 *
 * The HEADER, the bars and the rail take no part in any of this.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

// ── timings (1080-logical ms; motionMs folds the speed preset) ───────────────

/** The rest of the hand letting go, in place. */
const ISOLATE_MS = 150;
/** Work-surface groups materializing behind the hero. */
const CASCADE_MS = 190;
const CASCADE_STAGGER_S = 0.04;
/** The play controls letting go on B. */
const GROUPS_OUT_MS = 90;
/** The hand blooming back in around the returning hero. */
const SIBLINGS_IN_MS = 180;
/** The hero's commit lift (spawn response; the flight overwrites it). */
const LIFT_MS = 100;
/** How long we wait for the composer's groups to mount (frames, not ms). */
const ITEMS_POLL_FRAMES = 30;

/**
 * THE INPUT GATE. The phrase owns the pad from the press until BOTH the
 * surface and the hero have settled: mid-flight the composer is mounted and
 * would take an A for a CTA the player has not seen land yet, and a second B
 * on the way back would re-enter a transition already running. A COUNTER, not
 * a boolean — the surface episode and the hero flight release independently,
 * and a cancelled episode's safety must never unlock a successor still live.
 */
let liveEpisodes = 0;

export function handStageTransitioning(): boolean {
  return liveEpisodes > 0;
}

function acquireGate(): () => void {
  liveEpisodes++;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      liveEpisodes = Math.max(0, liveEpisodes - 1);
    }
  };
}

/**
 * Wrap the HERO FLIGHT's promise in the gate — the shell starts the transfer
 * (it owns the slots and the holds), the gate stays closed until the card has
 * genuinely docked, on every path including the transfer's own safety.
 */
export function guardHandHeroFlight<T>(flight: Promise<T>): Promise<T> {
  const release = acquireGate();
  return flight.finally(release);
}

/**
 * The hero's COMMIT response, applied by the transfer's `onSpawn` — the press
 * answers ON THE CARD ITSELF in the same paint the slot hides under it: the
 * mint ring says «taken», the small lift says «off the shelf». The flight
 * tween that follows is created later, so its per-frame writes win the shared
 * axis from wherever the lift has reached — the lift blends into the travel
 * instead of completing as a separate move.
 */
export function heroCommitLift(el: HTMLElement): void {
  el.classList.add('con-exit-proxy--commit');
  if (consoleReducedMotionActive()) {
    return;
  }
  gsap.to(el, {y: `-=${8 * conUiScale()}`, duration: motionMs(LIFT_MS) / 1000, ease: 'power2.out'});
}

export function resetHandStageMotion(): void {
  liveEpisodes = 0;
}

// ── element resolution ──────────────────────────────────────────────────────

function rootOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('.con-hand');
}

function browseOf(el: Element): HTMLElement | null {
  return rootOf(el)?.querySelector<HTMLElement>('.con-hand__browse') ?? null;
}

/** Everything the HAND ISOLATION fades: every card except the chosen one
 *  (its slot is already held empty by `stagedHandCard`), plus the browse
 *  chrome that describes a decision already made. */
function isolationTargets(browse: HTMLElement): Array<HTMLElement> {
  return Array.from(browse.querySelectorAll<HTMLElement>(
    '.con-hand__slot:not(.con-hand__slot--selected), .con-hand__scrollbar, .con-hand__verdictbar, .con-hand__empty'));
}

/** The work-surface groups that materialize behind the flying hero. */
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

const ARMING_CLASS = 'con-hand__stage--arming';

/** Per-element episode registry — a new episode kills the previous one. */
const liveTimelines = new WeakMap<Element, gsap.core.Timeline>();

function killEpisode(el: Element): void {
  liveTimelines.get(el)?.kill();
  liveTimelines.delete(el);
}

// ── ENTRY (browse → play level) ─────────────────────────────────────────────

export function handStageEnterHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || noGeometry(el)) {
    killEpisode(el);
    el.classList?.remove(ARMING_CLASS);
    done();
    return;
  }
  const browse = browseOf(el);

  if (consoleReducedMotionActive() || browse === null) {
    // Reduced motion / no grid: the `--parked` class hides the hand in the
    // same flush; the level appears with a short functional fade. The hero
    // transfer short-circuits on its own (same platform-wide convention).
    const release = acquireGate();
    gsap.fromTo(el, {autoAlpha: 0}, {
      autoAlpha: 1, duration: 0.1, ease: 'power1.out',
      clearProps: 'opacity,visibility',
      onComplete: () => {
        release();
        done();
      },
    });
    return;
  }

  killEpisode(el);
  // Groups born inside the ARMING window stay CSS-hidden until the cascade
  // takes them — they must not pop in the frame the composer mounts (one
  // flush after this hook), and they must reveal WITH the hero, not before it.
  el.classList.add(ARMING_CLASS);
  // The browse layer is taken back from its `--parked` resting truth for the
  // length of the isolation fade (inline beats the class; cleanup returns it).
  gsap.set(browse, {autoAlpha: 1});
  const siblings = isolationTargets(browse);

  const release = acquireGate();
  let finished = false;
  const cleanup = () => {
    el.classList.remove(ARMING_CLASS);
    // Kill BEFORE clearing: a still-running isolation tween would re-write
    // the very inline values the clear just removed (the classic way a
    // cancelled episode leaves half-faded neighbours behind).
    gsap.killTweensOf(browse);
    if (siblings.length > 0) {
      gsap.killTweensOf(siblings);
    }
    gsap.set(browse, {clearProps: 'opacity,visibility'});
    if (siblings.length > 0) {
      gsap.set(siblings, {clearProps: 'opacity,visibility'});
    }
  };
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    window.clearTimeout(safety);
    liveTimelines.delete(el);
    cleanup();
    release();
    done();
  };
  // The safety is a FAILURE path: it must be past every healthy schedule
  // (isolation + a full items poll + the cascade), and short enough that a
  // broken frame reads as abrupt rather than hung.
  const safety = window.setTimeout(finish, motionMs(ISOLATE_MS + CASCADE_MS) + 1400);

  const tl = gsap.timeline();
  liveTimelines.set(el, tl);
  // 1 · HAND ISOLATION — everything that is not the chosen card lets go in
  //     place (the hero is already flying above, spawned by the shell in the
  //     same tick). The grid itself never moves.
  if (siblings.length > 0) {
    tl.to(siblings, {autoAlpha: 0, duration: s(ISOLATE_MS), ease: 'power1.out'}, 0);
  }
  tl.add(() => {
    // The faded grid goes fully dark (its resting `--parked` truth) and the
    // siblings' inline zeros are returned to the stylesheet — a later pick
    // bridge needs them alive.
    gsap.set(browse, {autoAlpha: 0});
    if (siblings.length > 0) {
      gsap.set(siblings, {clearProps: 'opacity,visibility'});
    }
  });
  // 2 · CARD-LED SURFACE REVEAL — wait for the teleported composer's groups
  //     (frames, not ms: the wait ends the moment Vue patches), then cascade
  //     them in reading order while the hero is still travelling.
  let frames = 0;
  const poll = () => {
    if (finished) {
      return;
    }
    const items = cascadeItemsOf(el);
    if (items.length === 0 && frames++ < ITEMS_POLL_FRAMES) {
      requestAnimationFrame(poll);
      return;
    }
    if (items.length === 0) {
      el.classList.remove(ARMING_CLASS);
      finish();
      return;
    }
    // Build the reveal FIRST (the fromTo applies its 0-state inline in this
    // same turn), THEN drop the arming class — no frame can show the groups
    // at rest before their materialize.
    const reveal = gsap.timeline({onComplete: finish});
    reveal.fromTo(items,
      {autoAlpha: 0, y: 9 * conUiScale()},
      {autoAlpha: 1, y: 0, duration: s(CASCADE_MS), ease: 'expo.out', stagger: CASCADE_STAGGER_S, clearProps: 'transform'});
    el.classList.remove(ARMING_CLASS);
    liveTimelines.set(el, reveal);
  };
  requestAnimationFrame(poll);
}

// ── RETURN (play level → browse; the CANCEL path) ───────────────────────────

export function handStageLeaveHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || noGeometry(el)) {
    killEpisode(el);
    done();
    return;
  }
  const browse = browseOf(el);
  if (browse === null) {
    killEpisode(el);
    done();
    return;
  }
  // FIRST, before this tick can paint: the `--parked` class left with the
  // stage flag, so without this the whole grid would flash in at full
  // strength behind the still-standing play surface.
  gsap.set(browse, {autoAlpha: 0});
  const siblings = isolationTargets(browse);
  if (siblings.length > 0) {
    gsap.set(siblings, {autoAlpha: 0});
  }
  const items = cascadeItemsOf(el);

  killEpisode(el);
  const release = acquireGate();
  let finished = false;
  const cleanup = () => {
    gsap.killTweensOf(browse);
    if (siblings.length > 0) {
      gsap.killTweensOf(siblings);
    }
    gsap.set(browse, {clearProps: 'opacity,visibility'});
    if (siblings.length > 0) {
      gsap.set(siblings, {clearProps: 'opacity,visibility'});
    }
  };
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    window.clearTimeout(safety);
    liveTimelines.delete(el);
    cleanup();
    release();
    done();
  };
  const safety = window.setTimeout(finish, motionMs(GROUPS_OUT_MS + SIBLINGS_IN_MS) + 1200);

  if (consoleReducedMotionActive()) {
    cleanup();
    gsap.to(el, {autoAlpha: 0, duration: 0.1, ease: 'power1.in', onComplete: finish});
    return;
  }

  const tl = gsap.timeline({onComplete: finish});
  liveTimelines.set(el, tl);
  // 1 · RELEASE — the controls let go where they stand; the hero (spawned by
  //     the shell over the anchored card in this same tick) is already lifting
  //     away above them.
  if (items.length > 0) {
    tl.to(items, {autoAlpha: 0, duration: s(GROUPS_OUT_MS), ease: 'power1.in'}, 0);
  }
  tl.to(el, {autoAlpha: 0, duration: s(100), ease: 'power1.in'}, s(30));
  // 2 · HAND REVEAL — the hand blooms back in AROUND the returning hero: the
  //     grid is static, only opacity comes back, and the chosen card's slot
  //     stays held empty until the hero touches down in it.
  tl.set(browse, {autoAlpha: 1}, s(40));
  if (siblings.length > 0) {
    tl.to(siblings, {
      autoAlpha: 1, duration: s(SIBLINGS_IN_MS), ease: 'power1.out',
      clearProps: 'opacity,visibility',
    }, s(60));
  }
}

// ── cancelled pairs ─────────────────────────────────────────────────────────

export function handStageEnterCancelledHook(el: Element): void {
  killEpisode(el);
  // Leave the DOM in the entry's END state — the follow-up leave hook owns
  // the way back from exactly there.
  el.classList?.remove(ARMING_CLASS);
  const browse = browseOf(el);
  if (browse !== null) {
    gsap.set(browse, {autoAlpha: 0});
    const siblings = isolationTargets(browse);
    if (siblings.length > 0) {
      gsap.set(siblings, {clearProps: 'opacity,visibility'});
    }
  }
}

export function handStageLeaveCancelledHook(el: Element): void {
  killEpisode(el);
  // A cancelled leave means the stage STAYS: back to the play level's resting
  // state — surface visible, grid hidden (the `--parked` class is on again).
  gsap.set(el, {clearProps: 'opacity,visibility,transform'});
  const browse = browseOf(el);
  if (browse !== null) {
    gsap.set(browse, {autoAlpha: 0});
  }
}

/**
 * THE SECOND REVEAL — for a composer that re-mounts into an ALREADY-OPEN zone
 * (the way back from a pick bridge). There is no hero flight to reveal
 * behind, so the groups get the same short materialize they would have had.
 * During the initial entry the zone is still arming and the enter hook owns
 * everything — this is a deliberate no-op then.
 */
export function handStageReveal(root: HTMLElement | undefined): void {
  if (root === undefined || typeof window === 'undefined') {
    return;
  }
  const stage = root.closest<HTMLElement>('.con-hand__stage');
  if (stage === null || stage.classList.contains(ARMING_CLASS)) {
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
  gsap.fromTo(items,
    {autoAlpha: 0, y: 9 * conUiScale()},
    {autoAlpha: 1, y: 0, duration: s(CASCADE_MS), ease: 'expo.out', stagger: CASCADE_STAGGER_S, clearProps: 'transform,opacity,visibility'});
}
