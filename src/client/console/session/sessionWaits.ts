/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE TWO WAITS EVERY MOTION MODULE WRITES BY HAND (architecture v2 — docs/claude/console/architecture-v2/PLAN.md
 * §10 · C1) — as kernel waits with an owner.
 *
 *  · `whenPainted(n, boundMs)` — «the pose has reached the screen»: `n` painted frames from now. The hand-written
 *    form is two nested animation-frame callbacks beside a timer that resolves the same promise and is cleared by
 *    them — and the form WITHOUT the timer is an await that never resolves in a window that does not paint (a
 *    suspended TV, an occluded window, a starved compositor). Here the bound is not optional.
 *
 *  · `span(ms)` — «a beat of stillness»: the promise around a bare timer. As a span of an owner it is over at once
 *    when the owner ends (a director's pause does not keep a dead game's sequence alive for its full length).
 *
 * The owner is the run the wait serves when the caller has one (`run.scope`, `hold.scope`, a frame's scope) and the
 * session otherwise. Neither ever rejects, neither ever hangs.
 */
import {gsap} from 'gsap';
import {FlowScope, frames} from '@/client/console/kernel/flowScope';
import {consoleSessionScope} from '@/client/console/session/consoleSession';

/**
 * Resolves once the page has painted `count` times — or `boundMs` have passed without that many frames, or the owner
 * has ended. The bound only lets the flow go on; it never moves anything.
 */
export function whenPainted(count = 2, boundMs = 400, owner: FlowScope = consoleSessionScope()): Promise<void> {
  return owner.wait(frames(count), {bound: {ms: boundMs, quiet: 'a frame that did not paint — the flow goes on'}}).then(() => undefined);
}

/** A beat of `ms` in the owner's life: resolves when it has passed, or at once when the owner ended first. */
export function span(ms: number, owner: FlowScope = consoleSessionScope()): Promise<void> {
  return owner.sleep(ms).then(() => undefined);
}

/*
 * ── THE MOTION CLOCK ─────────────────────────────────────────────────────────────────────────────────────────────────
 * A beat that paces TWEENS rides GSAP's clock (`gsap.delayedCall`), not the wall clock: on a starved frame GSAP's lag
 * smoothing stretches every timeline, and a wall-clock timer beside them fires early relative to the motion it was
 * meant to follow (animations.md § A MOTION IS RIGHT ON A SLOW FRAME). What a bare `delayedCall` lacks is an OWNER: it
 * fires into a surface that left, and nobody can see it standing. These three are `delayedCall` WITH an owner — a row
 * of the wait table, taken back (or released) when the owner ends. The time is in MILLISECONDS, already through the
 * motion scale of the caller (`motionMs(…)`).
 */

/**
 * PACING on the motion clock: `run` is called `ms` of GSAP time from now — and never after the owner has ended.
 * Returns the cancel (idempotent).
 */
export function motionAfter(ms: number, what: string, run: () => void, owner: FlowScope = consoleSessionScope()): () => void {
  let forget: () => void = () => {};
  const call = gsap.delayedCall(Math.max(0, ms) / 1000, () => {
    forget();
    run();
  });
  forget = owner.note(what, () => call.kill(), ms);
  return () => {
    forget();
    call.kill();
  };
}

/**
 * A RELEASE on the motion clock: `release` is called exactly once — at `ms` of GSAP time, OR when the owner ends,
 * whichever comes first — unless the returned `disarm` is called before either. (An owner already gone: a microtask
 * later, never inside this call.)
 */
export function motionGuarantee(ms: number, what: string, release: () => void, owner: FlowScope = consoleSessionScope()): () => void {
  let owed = true;
  let call: gsap.core.Tween | undefined = undefined;
  let forget: () => void = () => {};
  const fire = (): void => {
    if (!owed) {
      return;
    }
    owed = false;
    forget();
    call?.kill();
    release();
  };
  if (owner.ended !== undefined) {
    void Promise.resolve().then(fire);
    return () => {
      owed = false;
    };
  }
  call = gsap.delayedCall(Math.max(0, ms) / 1000, fire);
  // The owner ending first is the other way it comes due: the row's withdrawal IS the release.
  forget = owner.note(what, fire, ms);
  return () => {
    owed = false;
    forget();
    call?.kill();
  };
}

/** A beat of `ms` on the motion clock: resolves when it has passed, or at once when the owner ended first. */
export function motionSpan(ms: number, owner: FlowScope = consoleSessionScope()): Promise<void> {
  return new Promise<void>((resolve) => {
    motionGuarantee(ms, `${Math.round(ms)}ms of motion`, resolve, owner);
  });
}

