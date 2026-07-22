/*
 * playedCategoryDirector — the GSAP flight of the «Разыграно» CATEGORY VIEW:
 * the category's cards physically LIFT out of their real tableau slots,
 * travel into the category modal's grid slots (face-down events FLIP open
 * mid-flight), the modal frame assembles around the landed cards, and the
 * grid takes over under the proxies. Closing runs the mirrored journey home
 * (events flip back onto their face-down pile).
 *
 * Engineering contract (the handRevealDirector idiom, deliberately):
 *  - ONE reversible timeline per episode (`gsap.timeline({paused: true})`);
 *    B mid-open REVERSES the same timeline from its live progress — the
 *    cards retrace their exact path, no second choreography;
 *  - transform/opacity ONLY: proxies are natural-width (320) top-left-origin
 *    boxes; x/y/scale tweens on the proxy, rotationY on its `__flip` child
 *    (the shared .con-deal-proxy chassis — real perspective, honest faces);
 *  - geometry is measured ONCE per episode (source slot rects in one batch +
 *    ONE grid-origin read; targets are PURE plan math) — no per-frame reads,
 *    no layout writes;
 *  - a safety timer + a resize listener snap a stuck/invalidated episode to
 *    its end state (`finishCategoryInstant`) — the view can never wedge;
 *  - teardown is epoch-guarded (a rapid re-open kills the previous handoff
 *    fade before it clears the NEW flights).
 *
 * Reduced motion: no flights at all — the state machine steps through the
 * same phases synchronously and the modal simply fades (CSS), which keeps
 * every caller path identical.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {PLAYED_CARD_NATURAL_W} from '@/client/components/console/consolePlayedModel';
import {FlightRect} from '@/client/components/console/consolePlayedCategoryModel';
import {
  playedCategoryState, CategoryFlight, categoryFlightEl, clearCategoryFlightEls,
} from '@/client/console/played/playedCategoryView';

/** One card's whole journey (both directions use the same pair). */
export type CategoryFlightPlan = {
  flight: CategoryFlight,
  /** The card's REAL tableau rect (its slot's card box / the events pile). */
  source: FlightRect,
  /** The plan-derived landing rect in the category view. */
  target: FlightRect,
  /** The target lies inside the modal's visible clip — an off-window landing
   *  (a scrolled tail) fades into the scroll instead of overshooting. */
  targetVisible: boolean,
};

// ── timings (1080-logical ms; motionMs folds the speed preset) ─────────────

/** The initial rise out of the pile (px @ 1080 — × uiScale). */
const LIFT_PX = 16;
const LIFT_MS = 130;
/** The travel leg (per card; staggered). */
const FLY_MS = 520;
/** Per-card stagger — a left-to-right sweep off the table. */
const STAGGER_MS = 42;
/** Stagger ceiling so a 40-card category never drags the tail forever. */
const STAGGER_TOTAL_CAP_MS = 420;
/** The flip occupies this share of the travel leg (events). */
const FLIP_PORTION = 0.6;
/** The modal frame assembles after the last card lands (CSS transition). */
const FRAME_MS = 220;
/** The proxies dissolve over the real grid cards. */
const HANDOFF_MS = 180;
/** Everything above + slack — the episode can never outlive this. */
const SAFETY_SLACK_MS = 1500;

export const CATEGORY_FRAME_MS = FRAME_MS;

type Episode = {
  tl: gsap.core.Timeline,
  dir: 'open' | 'close',
  safety: number | undefined,
  onSettled: (settledAs: 'open' | 'closed') => void,
  /** TRUE once a finalize ran (idempotence guard). */
  done: boolean,
};

let episode: Episode | undefined;
let handoffFade: gsap.core.Tween | undefined;

export function isCategoryEpisodeRunning(): boolean {
  return episode !== undefined && !episode.done;
}

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/** Per-index launch delay: ordered by the DEPARTURE rect (left-to-right,
 *  top-to-bottom — a sweep off the surface the cards leave), capped so long
 *  categories stay tight. */
function launchDelays(plans: ReadonlyArray<CategoryFlightPlan>, dir: 'open' | 'close'): Map<number, number> {
  const fromOf = (p: CategoryFlightPlan): FlightRect => (dir === 'open' ? p.source : p.target);
  const order = [...plans].sort((a, b) => (fromOf(a).y - fromOf(b).y) || (fromOf(a).x - fromOf(b).x));
  const per = Math.min(STAGGER_MS, plans.length > 1 ? STAGGER_TOTAL_CAP_MS / (plans.length - 1) : STAGGER_MS);
  const out = new Map<number, number>();
  order.forEach((p, rank) => out.set(p.flight.id, rank * per));
  return out;
}

function placeAt(el: HTMLElement, rect: FlightRect, faceDown: boolean): void {
  const scale = Math.max(0.02, rect.w / PLAYED_CARD_NATURAL_W);
  gsap.set(el, {
    width: PLAYED_CARD_NATURAL_W,
    height: rect.h / scale,
    x: rect.x,
    y: rect.y,
    scale,
    transformOrigin: 'top left',
    autoAlpha: 1,
  });
  const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
  if (flip !== null) {
    gsap.set(flip, {rotationY: faceDown ? 180 : 0});
  }
}

function killEpisode(): void {
  if (episode !== undefined) {
    if (episode.safety !== undefined) {
      window.clearTimeout(episode.safety);
    }
    episode.tl.kill();
    episode.done = true;
    episode = undefined;
  }
  window.removeEventListener('resize', onEpisodeResize);
}

function onEpisodeResize(): void {
  // A resize invalidates every measured/derived rect — snap to the end state.
  finishCategoryInstant();
}

/**
 * Build + run one directional episode over the SAME plan set. The open
 * direction flies source → target (events flip open); the close direction
 * target → source (events flip shut). `onSettled` fires exactly once with
 * the direction the episode ACTUALLY settled in (a reversed open settles
 * 'closed').
 */
function runEpisode(
  dir: 'open' | 'close',
  plans: ReadonlyArray<CategoryFlightPlan>,
  onSettled: (settledAs: 'open' | 'closed') => void,
): void {
  killEpisode();
  handoffFade?.kill();
  handoffFade = undefined;

  const tl = gsap.timeline({paused: true});
  const delays = launchDelays(plans, dir);
  const lift = LIFT_PX * conUiScale();

  for (const p of plans) {
    const el = categoryFlightEl(p.flight.id);
    if (el === undefined) {
      continue;
    }
    const from = dir === 'open' ? p.source : p.target;
    const to = dir === 'open' ? p.target : p.source;
    // The card starts face-down when: opening an events flight (still on the
    // pile) — or NOT: closing starts from the face-up grid.
    const startsDown = p.flight.faceDown && dir === 'open';
    const endsDown = p.flight.faceDown && dir === 'close';
    placeAt(el, from, startsDown);
    const at = s(delays.get(p.flight.id) ?? 0);
    const flyDur = s(FLY_MS);
    const toScale = Math.max(0.02, to.w / PLAYED_CARD_NATURAL_W);

    // Leg 0 — the physical LIFT out of the slot (both directions: a card
    // leaves a surface by rising off it, never by sliding flat).
    tl.to(el, {y: from.y - lift, duration: s(LIFT_MS), ease: 'power1.out'}, at);
    // Leg 1 — the travel: x and y run on slightly different eases so the
    // path bows naturally (an arc without a bezier plugin); scale glides.
    const flyAt = at + s(LIFT_MS);
    tl.to(el, {x: to.x, duration: flyDur, ease: 'power2.inOut'}, flyAt);
    tl.to(el, {y: to.y, duration: flyDur, ease: 'power3.inOut'}, flyAt);
    tl.to(el, {scale: toScale, duration: flyDur, ease: 'power2.inOut'}, flyAt);
    // The event flip rides the middle of the travel — a real 3D turn.
    if (startsDown || endsDown) {
      const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
      if (flip !== null) {
        tl.to(flip, {
          rotationY: endsDown ? 180 : 0,
          duration: flyDur * FLIP_PORTION,
          ease: 'power2.inOut',
        }, flyAt + flyDur * 0.12);
      }
    }
    // A landing beyond the modal clip (scrolled tail) fades INTO the scroll;
    // a card RETURNING from beyond the clip fades IN out of it.
    if (!p.targetVisible) {
      if (dir === 'open') {
        tl.to(el, {autoAlpha: 0, duration: flyDur * 0.4, ease: 'power1.in'}, flyAt + flyDur * 0.5);
      } else {
        gsap.set(el, {autoAlpha: 0});
        tl.to(el, {autoAlpha: 1, duration: flyDur * 0.35, ease: 'power1.out'}, flyAt + flyDur * 0.1);
      }
    }
  }

  const total = s(LIFT_MS + FLY_MS) + s(Math.min(STAGGER_TOTAL_CAP_MS, (plans.length - 1) * STAGGER_MS));
  void total;

  const ep: Episode = {tl, dir, safety: undefined, onSettled, done: false};
  tl.eventCallback('onComplete', () => finalize(ep, dir === 'open' ? 'open' : 'closed'));
  tl.eventCallback('onReverseComplete', () => finalize(ep, dir === 'open' ? 'closed' : 'open'));
  episode = ep;
  ep.safety = window.setTimeout(() => finishCategoryInstant(), motionMs(LIFT_MS + FLY_MS + STAGGER_TOTAL_CAP_MS) + SAFETY_SLACK_MS);
  window.addEventListener('resize', onEpisodeResize);
  tl.play(0);
}

function finalize(ep: Episode, settledAs: 'open' | 'closed'): void {
  if (ep.done) {
    return;
  }
  ep.done = true;
  if (ep.safety !== undefined) {
    window.clearTimeout(ep.safety);
    ep.safety = undefined;
  }
  if (episode === ep) {
    episode = undefined;
  }
  window.removeEventListener('resize', onEpisodeResize);
  ep.onSettled(settledAs);
}

/** Start the OPEN flight (tableau → category view). */
export function runCategoryOpen(plans: ReadonlyArray<CategoryFlightPlan>, onSettled: (settledAs: 'open' | 'closed') => void): void {
  runEpisode('open', plans, onSettled);
}

/** Start the CLOSE flight (category view → tableau). */
export function runCategoryClose(plans: ReadonlyArray<CategoryFlightPlan>, onSettled: (settledAs: 'open' | 'closed') => void): void {
  runEpisode('close', plans, onSettled);
}

/**
 * B mid-flight: REVERSE the running episode from its live progress — the
 * cards retrace their exact path. Returns false when nothing is running.
 */
export function reverseCategoryEpisode(): boolean {
  if (episode === undefined || episode.done) {
    return false;
  }
  episode.tl.reversed(!episode.tl.reversed());
  return true;
}

/** Snap the running episode to the state it is CURRENTLY heading for. */
export function finishCategoryInstant(): void {
  const ep = episode;
  if (ep === undefined || ep.done) {
    return;
  }
  if (ep.tl.reversed()) {
    ep.tl.progress(0, false);
    finalize(ep, ep.dir === 'open' ? 'closed' : 'open');
  } else {
    ep.tl.progress(1, false);
    finalize(ep, ep.dir === 'open' ? 'open' : 'closed');
  }
}

/**
 * The HANDOFF dissolve: the real cards are already painting under the
 * proxies (identical rects) — the proxies melt away. Epoch-guarded: a new
 * episode kills a pending fade before it can clear the new flights.
 */
export function dissolveCategoryProxies(onDone: () => void): void {
  const els = playedCategoryState.flights
    .map((f) => categoryFlightEl(f.id))
    .filter((el): el is HTMLElement => el !== undefined);
  if (els.length === 0 || consoleReducedMotionActive()) {
    clearCategoryFlightEls();
    onDone();
    return;
  }
  const fade = gsap.to(els, {
    autoAlpha: 0,
    duration: s(HANDOFF_MS),
    ease: 'power1.out',
    stagger: s(14),
    onComplete: () => {
      if (handoffFade === fade) {
        handoffFade = undefined;
        clearCategoryFlightEls();
        onDone();
      }
    },
  });
  handoffFade = fade;
}

/** Hard teardown (overlay unmount / hard-block close) — kills everything. */
export function resetCategoryDirector(): void {
  killEpisode();
  handoffFade?.kill();
  handoffFade = undefined;
  clearCategoryFlightEls();
}
