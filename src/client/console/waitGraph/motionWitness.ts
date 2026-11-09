import {gsap} from 'gsap';

/**
 * THE MOTION WITNESS — is ANYTHING on the page actually moving (or scheduled to)? A blocking animation hold claims «a
 * story is playing, wait for it»; the witness checks the claim against the page: a GSAP tween or delayed call not yet
 * finished, a CSS animation / transition / Web Animation running. Ambient loops (an infinite repeat) are no witness —
 * they move forever and prove nothing.
 *
 * Why: the liveness arbiter counts a blocking hold as «in flight» for `ANIMATION_STALL_GRACE_MS` (20 s) whatever it
 * holds, so a hold that outlived its motion (a seeder deferring its fly for a covered board, a story whose tween was
 * killed) kept the screen dead ~30 s before the first rung — longer than a player waits (the Hi-Tech Lab lesson of
 * 2026-11-09: a cure that comes after the reload is no cure). SHADOW first: the shell names a hold standing STILL
 * (`[liveness] still hold`) and acts on nothing; the monkey's net and the field log measure it before it is armed.
 */
export type MotionWitness = {gsap: number, css: number};

/** Sources, injectable for the unit spec. */
export type MotionSources = {
  tweens: () => ReadonlyArray<{paused(): boolean, progress(): number, repeat(): number}>,
  animations: () => ReadonlyArray<{playState: string, effect: {getTiming(): {iterations?: number}} | null}>,
};

const PAGE_SOURCES: MotionSources = {
  tweens: () => gsap.globalTimeline.getChildren(true, true, false) as unknown as ReadonlyArray<{paused(): boolean, progress(): number, repeat(): number}>,
  animations: () => (typeof document !== 'undefined' && typeof document.getAnimations === 'function' ? document.getAnimations() : []),
};

/** What moves on the page right now — finite motion only (a tween not finished, an animation running). */
export function witnessMotion(sources: MotionSources = PAGE_SOURCES): MotionWitness {
  let tweens = 0;
  for (const t of sources.tweens()) {
    if (!t.paused() && t.progress() < 1 && t.repeat() !== -1) {
      tweens++;
    }
  }
  let css = 0;
  for (const a of sources.animations()) {
    const iterations = a.effect?.getTiming().iterations ?? 1;
    if (a.playState === 'running' && Number.isFinite(iterations)) {
      css++;
    }
  }
  return {gsap: tweens, css};
}

export function motionWitnessed(w: MotionWitness): boolean {
  return w.gsap + w.css > 0;
}

/** How long blocking holds may stand with NOTHING moving before the shadow names them. */
export const STILL_HOLD_SHADOW_MS = 6_000;

/**
 * The still-hold clock (PURE — the shell feeds it once a second): since when blocking holds stood with nothing moving,
 * and whether this tick crosses the shadow's threshold (named once per still spell).
 */
export type StillHoldState = {since: number, named: boolean};

export function observeStillHold(state: StillHoldState, now: number, blocking: boolean, moving: boolean): {state: StillHoldState, cross: boolean, stillMs: number} {
  if (!blocking || moving) {
    return {state: {since: 0, named: false}, cross: false, stillMs: 0};
  }
  const since = state.since === 0 ? now : state.since;
  const stillMs = now - since;
  const cross = !state.named && stillMs >= STILL_HOLD_SHADOW_MS;
  return {state: {since, named: state.named || cross}, cross, stillMs};
}
