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
