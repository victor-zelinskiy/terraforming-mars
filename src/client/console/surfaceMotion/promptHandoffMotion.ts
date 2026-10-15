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
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {
  PROMPT_ARRIVE_MS, PROMPT_ARRIVE_SCALE, PROMPT_COMPOSE_MAX, PROMPT_COMPOSE_MS, PROMPT_COMPOSE_STEP_MS, PROMPT_COMPOSE_AT_MS,
  PROMPT_RELEASE_MS, PROMPT_RELEASE_SCALE, notePromptRelease, promptArrivalSpanMs,
} from '@/client/console/surfaceMotion/promptHandoffModel';

const SAFETY_SLACK_MS = 450;

function s(ms: number): number {
  return motionMs(ms) / 1000;
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

const live = new WeakMap<Element, {kill: () => unknown}>();

function guardedSwap(el: Element, totalMs: number, done: () => void, body: (finish: () => void) => {kill: () => unknown}): void {
  live.get(el)?.kill();
  let finished = false;
  let safety = 0;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    window.clearTimeout(safety);
    live.delete(el);
    done();
  };
  safety = window.setTimeout(finish, motionMs(totalMs) + SAFETY_SLACK_MS);
  const episode = body(finish);
  if (!finished) {
    live.set(el, episode);
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
