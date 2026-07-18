/*
 * HAND REVEAL DIRECTOR — the physical dock ↔ hand-overlay transition
 * (the flagship "the hand OPENS" beat of the console footer).
 *
 * CONCEPT. The compact pack in the footer dock and the open hand overlay
 * are THE SAME physical cards. Opening: the pack lifts off the tray as one
 * mass, the backs flip to faces around the edge mid-flight, and the cards
 * fan out CENTRE-FIRST into the overlay's real slot positions; the overlay
 * chrome materializes around them. Closing: the spread converges back to
 * the centre axis, flips back-side-out on approach and lands exactly on
 * the dock's back positions.
 *
 * ONE CARD — ONE VISIBLE REPRESENTATION. For the whole episode the dock
 * pack (`handRevealState.dockLifted`) and the overlay slots
 * (`handRevealState.holdSlots` → `.con-hand--transit`) are Vue-held
 * invisible; the flying proxies are the only version of every card. The
 * handoff at either end is the project's standard materialization: release
 * the hold (the real element's own 160ms fade-in) under the proxy's
 * 130ms fade-out at an IDENTICAL rect.
 *
 * REVERSIBILITY (the hard requirement). One GSAP timeline per episode —
 * `B` mid-flight calls `reverseHandReveal()` → `tl.reversed(!reversed)`
 * from the CURRENT progress; reopening mid-close reverses the close
 * timeline the same way. No setTimeout choreography anywhere. Section
 * switching is owned here: an open episode keeps `section='hand'` mounted
 * from frame 0 (targets are measured off the real grid) and only returns
 * to 'board' when a reverse completes; a close episode returns to 'board'
 * immediately (the board is the backdrop of the gather) and re-mounts
 * 'hand' + restores the grid scroll the moment its direction flips back.
 *
 * EVERY card participates: backs visible in the dock fly from their real
 * rects, the thickness tail from near-stacked positions at the pack's
 * left flank; overlay slots beyond the visible window get PLAN-derived
 * rects (the grid's math is pure) and their proxies fade at the viewport
 * boundary — physically "into the scroll". Off-window proxies carry no
 * face (back-only) so a 30-card hand stays cheap.
 *
 * Perf: transform/opacity only; one read batch before spawning; no
 * per-frame Vue writes; will-change scoped by the proxy class; safety
 * timeout + resize → instant reconcile to the current direction's end
 * state. Reduced motion: no proxies — instant state flips (the project
 * convention across all directors).
 */

import {nextTick} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {
  clearRevealFlights, handRevealState, nextRevealId, revealEl,
} from '@/client/console/handDock/handRevealState';

export type RevealRect = {left: number, top: number, width: number, height: number};

/** One hand card's two homes (overlay order — the grid's own order). */
export type RevealPair = {
  name: CardName,
  /** Where the card lives in the DOCK (real back rect / thickness slot). */
  source: RevealRect,
  /** Where the card lives in the OVERLAY (real slot rect / plan-derived). */
  target: RevealRect,
  /** The target slot is inside the grid's visible window. */
  visible: boolean,
};

export type RevealHooks = {
  /** Switch the shell section — the director owns WHEN. */
  setSection: (s: 'hand' | 'board') => void,
  /** Restore the hand grid's scroll after a mid-close reopen remount. */
  restoreScroll: (px: number) => void,
};

type Episode = {
  kind: 'open' | 'close',
  tl: gsap.core.Timeline,
  els: Array<HTMLElement>,
  safety: number,
  onResize: () => void,
  /** The grid scrollTop captured when the close episode began. */
  scrollTop: number,
  finished: boolean,
};

let episode: Episode | undefined;
let hooks: RevealHooks | undefined;
/** The teardown's deferred handoff fade (proxies over the materializing real
 *  elements). Tracked so a NEW episode starting inside the handoff window can
 *  kill it — its delayed `clearRevealFlights()` would otherwise unmount the
 *  new episode's proxies mid-flight (cards blink out, then pop into place). */
let handoffFade: gsap.core.Tween | undefined;
/** An episode is being BUILT (measures / proxy spawn — a few frames before
 *  its timeline exists). Guards the window against a racing 2nd episode. */
let building = false;
/** A reverse requested during the build window — applied at install. */
let pendingReverse = false;

export function setHandRevealHooks(h: RevealHooks): void {
  hooks = h;
}

export function isHandRevealEpisodeRunning(): boolean {
  return building || (episode !== undefined && !episode.finished);
}

/* ── choreography constants (base ms — motionMs scales them) ──────────
   Tuned UNHURRIED: the rise starts on the input frame (responsiveness),
   but the flight itself is long enough to READ — the player must see the
   pack lift, turn and fan out, not deduce it. The lift and the flight are
   BUTT-JOINED per card (never overlapping y-tweens — two live tweens on
   one channel jitter). */
const LIFT_MS = 140; // the pack's "answers the input" rise (starts frame 1)
const OPEN_FLIGHT_MS = 600;
const CLOSE_FLIGHT_MS = 500;
const HANDOFF_MS = 200; // proxy fade over the materializing real card
const LIFT_PX = 18;

/** The centre-out fan window: bounded regardless of hand size. */
function spreadMs(count: number): number {
  return count <= 4 ? 150 : count <= 8 ? 200 : 240;
}

/** 0..1 rank of a card's distance from the centre axis (row-weighted). */
function centreRank(pairs: ReadonlyArray<RevealPair>): Array<number> {
  const cx = window.innerWidth / 2;
  const rowH = pairs.reduce((m, p) => Math.max(m, p.target.height), 1);
  const dist = pairs.map((p) => {
    const c = p.target.left + p.target.width / 2;
    const row = Math.max(0, Math.round((p.target.top - pairs[0].target.top) / rowH));
    return Math.abs(c - cx) + row * 220;
  });
  const max = Math.max(1, ...dist);
  return dist.map((d) => d / max);
}

function spawnBudget(count: number, flightMs: number): number {
  return motionMs(LIFT_MS + flightMs + spreadMs(count)) + 1500;
}

/**
 * Spawn one proxy per pair, position each over `from`, size it to the
 * MATERIALIZATION end's aspect (`sizeTo`) so the handoff rect matches the
 * real element exactly. Returns elements in pair order (missing = skipped).
 */
async function spawnProxies(pairs: ReadonlyArray<RevealPair>, from: 'source' | 'target', sizeTo: 'source' | 'target'): Promise<Array<HTMLElement | undefined>> {
  // A previous episode's handoff fade may still be pending: kill it BEFORE
  // replacing the flights, so its onComplete can't clear the new proxies.
  // (kill() suppresses onComplete; the old, nearly-transparent proxies are
  // replaced by the new flight list in this same flush.)
  handoffFade?.kill();
  handoffFade = undefined;
  handRevealState.flights = pairs.map((p) => ({id: nextRevealId(), name: p.name, face: p.visible}));
  const ids = handRevealState.flights.map((f) => f.id);
  await nextTick();
  return pairs.map((p, i) => {
    const el = revealEl(ids[i]);
    if (el === undefined) {
      return undefined;
    }
    const at = p[from];
    const size = p[sizeTo];
    const scale = at.width / CARD_NATURAL_W;
    gsap.set(el, {
      width: CARD_NATURAL_W,
      height: size.height / (size.width / CARD_NATURAL_W),
      x: at.left,
      y: at.top,
      scale,
      autoAlpha: from === 'target' && !p.visible ? 0 : 1,
      transformOrigin: 'top left',
    });
    const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flip !== null) {
      // Open starts back-side-out (180); close starts face-out (0).
      gsap.set(flip, {rotationY: from === 'source' ? 180 : 0});
    }
    return el;
  });
}

function teardown(instant: boolean): void {
  const ep = episode;
  if (ep === undefined) {
    return;
  }
  clearTimeout(ep.safety);
  window.removeEventListener('resize', ep.onResize);
  ep.tl.kill();
  const els = ep.els.filter((e): e is HTMLElement => e !== undefined);
  if (instant || els.length === 0) {
    gsap.set(els, {autoAlpha: 0});
    clearRevealFlights();
  } else {
    // The materialization: real elements fade in under the proxies (their
    // own 160ms transition — the hold release happened in the caller),
    // the proxies fade out on top. Outside the reversible window by design.
    // The deferred clear is EPOCH-GUARDED: it only fires while this fade is
    // still the current handoff — a new episode spawned inside the window
    // kills the fade (spawnProxies) and owns the flights from then on.
    const fade = gsap.to(els, {
      autoAlpha: 0,
      duration: motionMs(HANDOFF_MS) / 1000,
      ease: 'power1.out',
      onComplete: () => {
        if (handoffFade === fade) {
          handoffFade = undefined;
          clearRevealFlights();
        }
      },
    });
    handoffFade = fade;
  }
  episode = undefined;
}

/* ── OPEN: dock pack → overlay slots ────────────────────────────────── */

/**
 * The shell has ALREADY set section='hand' (slots render held via
 * `holdSlots`) and measured both ends; this builds + plays the episode.
 */
export async function runHandOpenEpisode(pairs: ReadonlyArray<RevealPair>): Promise<void> {
  if (pairs.length === 0 || consoleReducedMotionActive()) {
    handRevealState.phase = 'open';
    handRevealState.dockLifted = true;
    handRevealState.holdSlots = false;
    return;
  }
  building = true;
  pendingReverse = false;
  handRevealState.phase = 'opening';
  handRevealState.holdSlots = true;
  const els = await spawnProxies(pairs, 'source', 'target');
  // Same-flush with the proxies' first paint: the pack vanishes the frame
  // its proxies stand over it — never both at once.
  handRevealState.dockLifted = true;

  const s = (ms: number) => motionMs(ms) / 1000;
  const ranks = centreRank(pairs);
  const spread = spreadMs(pairs.length);
  const tl = gsap.timeline({paused: true});

  pairs.forEach((p, i) => {
    const el = els[i];
    if (el === undefined) {
      return;
    }
    const scaleTo = p.target.width / CARD_NATURAL_W;
    // The flight BUTT-JOINS the lift (same y channel — overlapping tweens
    // on one property fight each other and read as a jitter).
    const at = s(LIFT_MS) + s(spread) * ranks[i];
    const flight = s(OPEN_FLIGHT_MS);
    // The input-answer beat: the whole pack rises off the tray as one
    // mass — soft out, so the hold at the top blends into the launch.
    tl.to(el, {y: p.source.top - LIFT_PX * conUiScale(), duration: s(LIFT_MS), ease: 'power1.out'}, 0);
    // The fan-out: X eases laterally, Y launches into the spread with a
    // soft landing, the scale grows to the slot's real size — one calm,
    // rising, opening gesture.
    tl.to(el, {x: p.target.left, duration: flight, ease: 'power2.inOut'}, at);
    tl.to(el, {y: p.target.top, duration: flight, ease: 'power2.inOut'}, at);
    tl.to(el, {scale: scaleTo, duration: flight, ease: 'power2.inOut'}, at);
    const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flip !== null) {
      // Back → face strictly around the edge, through the flight's heart —
      // slow enough that the turn itself is the readable event.
      tl.to(flip, {rotationY: 0, duration: flight * 0.62, ease: 'power2.inOut'}, at + flight * 0.08);
    }
    if (!p.visible) {
      // The scroll tail: the card exits through the grid's lower boundary.
      tl.to(el, {autoAlpha: 0, duration: flight * 0.35, ease: 'power1.in'}, at + flight * 0.55);
    }
  });

  installEpisode('open', tl, els, 0, spawnBudget(pairs.length, OPEN_FLIGHT_MS));
  tl.eventCallback('onComplete', () => finalizeOpenForward(false));
  tl.eventCallback('onReverseComplete', () => finalizeOpenReverse(false));
  tl.play(0);
}

function finalizeOpenForward(instant: boolean): void {
  if (episode === undefined || episode.finished) {
    return;
  }
  episode.finished = true;
  handRevealState.phase = 'open';
  handRevealState.holdSlots = false; // slots fade in under the proxies
  teardown(instant);
}

function finalizeOpenReverse(instant: boolean): void {
  if (episode === undefined || episode.finished) {
    return;
  }
  episode.finished = true;
  handRevealState.phase = 'docked';
  handRevealState.dockLifted = false; // the pack materializes under the proxies
  handRevealState.holdSlots = false;
  hooks?.setSection('board');
  teardown(instant);
}

/* ── CLOSE: overlay slots → dock pack ───────────────────────────────── */

export async function runHandCloseEpisode(pairs: ReadonlyArray<RevealPair>, scrollTop: number): Promise<void> {
  if (pairs.length === 0 || consoleReducedMotionActive()) {
    handRevealState.phase = 'docked';
    handRevealState.dockLifted = false;
    handRevealState.holdSlots = false;
    hooks?.setSection('board');
    return;
  }
  building = true;
  pendingReverse = false;
  handRevealState.phase = 'closing';
  handRevealState.holdSlots = true; // same-flush: slots hide under their proxies
  const els = await spawnProxies(pairs, 'target', 'source');
  // The board is the backdrop of the gather from the first flight frame.
  hooks?.setSection('board');

  const s = (ms: number) => motionMs(ms) / 1000;
  const ranks = centreRank(pairs);
  const spread = spreadMs(pairs.length) * 0.6; // gathering is brisker (§11)
  const tl = gsap.timeline({paused: true});

  pairs.forEach((p, i) => {
    const el = els[i];
    if (el === undefined) {
      return;
    }
    const scaleTo = p.source.width / CARD_NATURAL_W;
    // Outer cards start first; the centre card caps the pack last.
    const at = s(spread) * (1 - ranks[i]);
    const flight = s(CLOSE_FLIGHT_MS);
    if (!p.visible) {
      // The scroll tail re-enters through the grid's lower boundary.
      tl.to(el, {autoAlpha: 1, duration: flight * 0.3, ease: 'power1.out'}, at);
    }
    tl.to(el, {x: p.source.left, duration: flight, ease: 'power2.inOut'}, at);
    tl.to(el, {y: p.source.top, duration: flight, ease: 'power2.inOut'}, at);
    tl.to(el, {scale: scaleTo, duration: flight, ease: 'power2.inOut'}, at);
    const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flip !== null) {
      // Face → back on approach: the pack turns back-side-out at the tray.
      tl.to(flip, {rotationY: 180, duration: flight * 0.55, ease: 'power2.inOut'}, at + flight * 0.38);
    }
  });

  installEpisode('close', tl, els, scrollTop, spawnBudget(pairs.length, CLOSE_FLIGHT_MS));
  tl.eventCallback('onComplete', () => finalizeCloseForward(false));
  tl.eventCallback('onReverseComplete', () => finalizeCloseReverse(false));
  tl.play(0);
}

function finalizeCloseForward(instant: boolean): void {
  if (episode === undefined || episode.finished) {
    return;
  }
  episode.finished = true;
  handRevealState.phase = 'docked';
  handRevealState.dockLifted = false; // the pack materializes under the proxies
  handRevealState.holdSlots = false;
  teardown(instant);
}

function finalizeCloseReverse(instant: boolean): void {
  if (episode === undefined || episode.finished) {
    return;
  }
  episode.finished = true;
  handRevealState.phase = 'open';
  handRevealState.holdSlots = false; // slots fade in under the proxies
  teardown(instant);
}

/* ── shared episode plumbing ────────────────────────────────────────── */

function installEpisode(kind: 'open' | 'close', tl: gsap.core.Timeline, els: Array<HTMLElement | undefined>, scrollTop: number, budgetMs: number): void {
  const onResize = () => finishInstant();
  const safety = window.setTimeout(() => finishInstant(), budgetMs);
  window.addEventListener('resize', onResize);
  episode = {
    kind, tl, scrollTop, onResize, finished: false,
    safety,
    els: els.filter((e): e is HTMLElement => e !== undefined),
  };
  building = false;
  // A `B` landed during the build window (measures/spawn): honour it now —
  // the timeline reverses from ~0 progress, an immediate graceful cancel.
  if (pendingReverse) {
    pendingReverse = false;
    reverseHandReveal();
  }
}

/** Snap to the CURRENT direction's end state (resize / safety / unmount). */
export function finishInstant(): void {
  const ep = episode;
  if (ep === undefined || ep.finished) {
    return;
  }
  const toStart = ep.tl.reversed();
  if (ep.kind === 'open') {
    (toStart ? finalizeOpenReverse : finalizeOpenForward)(true);
  } else {
    (toStart ? finalizeCloseReverse : finalizeCloseForward)(true);
  }
}

/**
 * Flip the running episode's direction from its CURRENT progress — the
 * `B`-mid-opening / reopen-mid-closing contract. Returns false when no
 * episode is running (the caller falls through to its normal handling).
 */
export function reverseHandReveal(): boolean {
  const ep = episode;
  if (ep === undefined || ep.finished) {
    if (building) {
      pendingReverse = true; // applied the moment the timeline installs
      return true;
    }
    return false;
  }
  const nowReversed = !ep.tl.reversed();
  ep.tl.reversed(nowReversed);
  if (ep.kind === 'open') {
    handRevealState.phase = nowReversed ? 'closing' : 'opening';
  } else {
    handRevealState.phase = nowReversed ? 'opening' : 'closing';
    // A close gather flips back toward the OPEN hand: the overlay must be
    // there to land in — remount it held + restore the exact scroll the
    // targets were measured at.
    if (nowReversed) {
      hooks?.setSection('hand');
      void nextTick().then(() => hooks?.restoreScroll(ep.scrollTop));
    } else {
      hooks?.setSection('board');
    }
  }
  return true;
}

/**
 * A non-choreographed path closed/replaced the hand (sale cancel, a task
 * surface, a game switch): reconcile the presentation state so the dock
 * never sticks empty. Safe to call any time.
 */
export function resetHandReveal(): void {
  finishInstant();
  building = false;
  pendingReverse = false;
  handRevealState.phase = 'docked';
  handRevealState.dockLifted = false;
  handRevealState.holdSlots = false;
  clearRevealFlights();
}
