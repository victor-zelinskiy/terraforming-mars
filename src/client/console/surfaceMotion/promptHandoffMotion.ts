/*
 * THE PROMPT HANDOFF — the GSAP half (PL-384; the pure half and the WHY: `promptHandoffModel.ts`).
 *
 * Two hosts speak the one phrase (RELEASE → ARRIVE → COMPOSE):
 *  - the surface-motion DIRECTOR, when one prompt-family band surface leaves and another enters in the same moment
 *    (the task host's reward → the production loss) — `playPromptRelease` / `playPromptArrive` on their panels;
 *  - a surface whose KEYED panel swaps one prompt for the next while the surface stays (two task-host prompts, two
 *    effect decisions in a chain) — `promptSwapLeaveHook` / `promptSwapEnterHook` on its `<transition mode="out-in">`.
 * A panel that is NOT a family plate (an embedded stage inside a workspace — no `.con-prompt`) keeps the stage's own
 * quiet swap (the old `con-task-swap` values): the workspace's flow grammar owns that beat, not the modal family's.
 *
 * Transform / opacity only, `motionMs` for every duration, reduced motion → a short opacity beat, every episode
 * guarded (a kill + a safety timer — `done()` always fires).
 */
import {gsap} from 'gsap';
import {motionCeilingMs, motionMs} from '@/client/components/motion/motionTokens';
import {flowClock} from '@/client/console/kernel/flowClock';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleSessionScope} from '@/client/console/session/consoleSession';
import {
  PROMPT_ARRIVE_MS, PROMPT_ARRIVE_SCALE, PROMPT_COMPOSE_MAX, PROMPT_COMPOSE_MS, PROMPT_COMPOSE_STEP_MS, PROMPT_COMPOSE_AT_MS,
  PROMPT_RELEASE_MS, PROMPT_RELEASE_SCALE, notePromptRelease, promptArrivalSpanMs,
} from '@/client/console/surfaceMotion/promptHandoffModel';

const SAFETY_SLACK_MS = 450;
/**
 * The hard ceiling of a hook's net past its episode's own length (FLAKE ZERO · class N): a motion whose clock does
 * not run at all (no frame comes) is finished here, never left to strand its element. Never motion-scaled down.
 */
export const EPISODE_NET_CEILING_MS = 4000;

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/** What a hook's net may ask of the episode it bounds: a GSAP tween / timeline, or a compositor episode. */
export type NetEpisode = {
  kill(): unknown,
  /** GSAP: the playhead — read with no argument; `progress(1)` CATCHES IT UP (its last frame, its own onComplete). */
  progress?: (value?: number) => unknown,
  /** A compositor episode: are its animations still pending / running? */
  moving?: () => boolean,
  /** A compositor episode: finish every animation (each fires its own finish). */
  finish?: () => void,
};

/**
 * THE NET OF A HOOK'S EPISODE — it catches a STALL, never a SLOW motion (animations.md § A MOTION IS RIGHT ON A SLOW
 * FRAME, law 1; FLAKE ZERO · class N). A wall-clock safety sized from the tween's own length and counted from its
 * creation fired mid-fade whenever GSAP's clock fell behind the wall's (a long task — the board re-shown at 4K —
 * is booked as 33 ms by `lagSmoothing`): `done()` came early and Vue took a leaving surface away at half its opacity.
 * Now the net LOOKS at `budgetMs`: an episode still being driven (a GSAP tick since the last look, or a compositor
 * animation pending / running) is given another slack; only one whose clock has STOPPED (two looks with no tick), one
 * that was replaced / killed, or one past the hard ceiling is ended — CAUGHT UP first (`progress(1)` / `finish()`),
 * never resolved in the middle. The owner's end (the game screen leaving) ends it at once, as before.
 * Returns the disarm.
 */
export function episodeNet(args: {
  episode: NetEpisode,
  /** The episode is still the element's live one (a new hook on the element replaced / killed it otherwise). */
  current: () => boolean,
  budgetMs: number,
  ceilingMs: number,
  what: string,
  finish: () => void,
}): () => void {
  const {episode} = args;
  const owner = consoleSessionScope();
  const start = flowClock().now();
  let lastFrame = gsap.ticker.frame;
  let still = 0;
  let disarm: () => void = () => {};
  const moving = (): boolean => {
    if (episode.moving !== undefined) {
      return episode.moving();
    }
    if (typeof episode.progress !== 'function' || !(Number(episode.progress()) < 1)) {
      return false;
    }
    const frame = gsap.ticker.frame;
    still = frame === lastFrame ? still + 1 : 0;
    lastFrame = frame;
    // A look that saw no tick may be the first task after a long one (the timer before the frame): only a SECOND
    // look in a row with no tick is a clock that does not run.
    return still < 2;
  };
  const look = (): void => {
    if (args.current() && owner.ended === undefined && flowClock().now() - start < args.ceilingMs && moving()) {
      disarm = owner.guarantee(SAFETY_SLACK_MS, `${args.what} — still moving`, look);
      return;
    }
    if (args.current()) {
      episode.finish?.();
      if (typeof episode.progress === 'function') {
        episode.progress(1);
      }
    }
    args.finish();
  };
  disarm = owner.guarantee(args.budgetMs, args.what, look);
  return () => disarm();
}

/** The blocks that COMPOSE, in reading order: the head's own lines (category · the ask · why), then the plate's
 *  other blocks. The crest is the head's absolute band and never moves. Capped (`PROMPT_COMPOSE_MAX`). */
export function promptComposeItems(panel: Element): Array<HTMLElement> {
  const items: Array<HTMLElement> = [];
  const head = panel.querySelector<HTMLElement>(':scope > .con-prompt-head');
  if (head !== null) {
    for (const part of head.querySelectorAll<HTMLElement>(':scope > .con-prompt-head__kicker, :scope > .con-prompt-head__ask, :scope > .con-prompt-head__trigger')) {
      items.push(part);
    }
  }
  for (const child of Array.from(panel.children)) {
    if (child === head || !(child instanceof HTMLElement) || getComputedStyle(child).position === 'absolute') {
      continue;
    }
    items.push(child);
  }
  return items.slice(0, PROMPT_COMPOSE_MAX);
}

/** RELEASE — the answered plate(s) let go on the spot. */
export function playPromptRelease(tl: gsap.core.Timeline, panels: ReadonlyArray<HTMLElement>, at: number): void {
  if (panels.length === 0) {
    return;
  }
  // A plate's own CSS opacity transition (the task host's table-beat release) would trail every frame the tween
  // writes — the episode owns the opacity outright.
  gsap.set(panels, {transition: 'none'});
  tl.to(panels, {
    autoAlpha: 0,
    scale: PROMPT_RELEASE_SCALE,
    transformOrigin: '50% 50%',
    duration: s(PROMPT_RELEASE_MS),
    ease: 'power2.in',
  }, at);
}

/**
 * ARRIVE + COMPOSE — the next plate materializes where decisions stand (no travel: the band's frames never move),
 * its blocks surface from inside in reading order. `at` is the arrival's start (seconds into `tl`).
 */
export function playPromptArrive(tl: gsap.core.Timeline, panel: HTMLElement, at: number): number {
  const u = conUiScale();
  const items = promptComposeItems(panel);
  // `fromTo` renders its FROM state at build — the plate is invisible from the first painted frame, however long it
  // waits for the release to go. Its own CSS opacity transition is off for the episode (it would trail the tween).
  gsap.set(panel, {transition: 'none'});
  tl.fromTo(panel,
    {autoAlpha: 0, scale: PROMPT_ARRIVE_SCALE, transformOrigin: '50% 50%'},
    {autoAlpha: 1, scale: 1, duration: s(PROMPT_ARRIVE_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility,transition'}, at);
  if (items.length > 0) {
    tl.fromTo(items,
      {y: 6 * u, opacity: 0},
      {
        y: 0, opacity: 1, duration: s(PROMPT_COMPOSE_MS), ease: 'power3.out',
        stagger: s(PROMPT_COMPOSE_STEP_MS), clearProps: 'transform,opacity',
      }, at + s(PROMPT_COMPOSE_AT_MS));
  }
  return promptArrivalSpanMs(items.length);
}

// ── the KEYED swap (a surface that stays while its panel changes prompt) ────────────────────────────────────────

const live = new WeakMap<Element, NetEpisode>();

function guardedSwap(el: Element, totalMs: number, done: () => void, body: (finish: () => void) => NetEpisode): void {
  live.get(el)?.kill();
  let finished = false;
  let safety: () => void = () => {};
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    safety();
    live.delete(el);
    done();
  };
  const episode = body(finish);
  if (!finished) {
    live.set(el, episode);
    // The net catches a STALL, never a slow motion — on the episode's own clock (`episodeNet`).
    safety = episodeNet({
      episode, current: () => live.get(el) === episode,
      budgetMs: motionMs(totalMs) + SAFETY_SLACK_MS, ceilingMs: motionCeilingMs(totalMs) + EPISODE_NET_CEILING_MS,
      what: 'promptHandoffMotion: a beat\'s safety', finish,
    });
  }
}

function isFamilyPlate(el: Element): el is HTMLElement {
  return el instanceof HTMLElement && el.classList.contains('con-prompt');
}

/** `@leave` of a keyed prompt panel. */
export function promptSwapLeaveHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || !(el instanceof HTMLElement)) {
    done();
    return;
  }
  if (consoleReducedMotionActive()) {
    guardedSwap(el, 120, done, (finish) => gsap.to(el, {autoAlpha: 0, duration: 0.1, ease: 'power1.in', onComplete: finish}));
    return;
  }
  if (!isFamilyPlate(el)) {
    // An embedded stage's quiet swap (the old `con-task-swap` leave).
    guardedSwap(el, 120, done, (finish) => gsap.to(el, {autoAlpha: 0, duration: s(120), ease: 'power2.in', onComplete: finish}));
    return;
  }
  notePromptRelease();
  guardedSwap(el, PROMPT_RELEASE_MS, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    playPromptRelease(tl, [el], 0);
    return tl;
  });
}

/** `@enter` of a keyed prompt panel (`mode="out-in"` — the release has already gone, so the arrival starts now). */
export function promptSwapEnterHook(el: Element, done: () => void): void {
  if (typeof window === 'undefined' || !(el instanceof HTMLElement)) {
    done();
    return;
  }
  if (consoleReducedMotionActive()) {
    guardedSwap(el, 140, done, (finish) => gsap.fromTo(el, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.12, ease: 'power1.out', clearProps: 'opacity,visibility', onComplete: finish}));
    return;
  }
  if (!isFamilyPlate(el)) {
    // An embedded stage's quiet swap (the old `con-task-swap` enter: a short rise).
    const u = conUiScale();
    guardedSwap(el, 160, done, (finish) => gsap.fromTo(el,
      {autoAlpha: 0, y: 10 * u},
      {autoAlpha: 1, y: 0, duration: s(160), ease: 'expo.out', clearProps: 'transform,opacity,visibility', onComplete: finish}));
    return;
  }
  guardedSwap(el, promptArrivalSpanMs(PROMPT_COMPOSE_MAX), done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    playPromptArrive(tl, el, 0);
    return tl;
  });
}

/** Cancelled pair: drop the dead tween and let the element rest where its direction ends. */
export function promptSwapEnterCancelledHook(el: Element): void {
  live.get(el)?.kill();
  live.delete(el);
  gsap.set(el, {clearProps: 'transform,opacity,visibility,transition'});
}

export function promptSwapLeaveCancelledHook(el: Element): void {
  live.get(el)?.kill();
  live.delete(el);
  gsap.set(el, {clearProps: 'transform,opacity,visibility,transition'});
}
