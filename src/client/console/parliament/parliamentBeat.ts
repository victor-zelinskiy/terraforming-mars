/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A PARLIAMENT BEAT — «do this after N motion-milliseconds», the ONE way the
 * Parliament's surfaces schedule a stagger, a read dwell or a handoff.
 *
 * Not `window.setTimeout` (docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md §13.3 —
 * `tests/console/parliamentNoTimers.spec.ts` forbids it in this tree): a bare
 * timer is a clock nobody owns — it fires into an unmounted surface, it cannot
 * be paused with the motion it paces, it ignores the motion scale unless every
 * call site remembers to apply it, and each site keeps its own handle and its
 * own `clearTimeout` in `beforeUnmount`. A beat rides GSAP's clock instead
 * (`gsap.delayedCall`): it is killed like any tween, it runs on the same
 * ticker as the flights it staggers, and its duration goes through the console
 * motion scale ONCE, here. Reduced motion makes every beat instant — the
 * poses are the same, only the time between them is gone.
 *
 * …and it has an OWNER (architecture v2 — PLAN §10 · C1): the beat is a row of the game session's wait table
 * (`motionGuarantee`). A beat is very often what RELEASES something (a stagger's last pose, a handoff, a promise), so
 * it is a GUARANTEED release: it fires at its time, or at once when the game screen leaves — exactly once, unless it
 * was killed. It can no longer outlive the game it paced.
 *
 * The one timer the tree keeps is the section's SUBMIT SAFETY — a net over a
 * server that never answered, which is exactly what a wall clock is for.
 */
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {motionGuarantee} from '@/client/console/session/sessionWaits';

export type ParliamentBeat = {
  /** Cancel the beat before it fires (idempotent). */
  kill: () => void;
};

/** Schedule `fn` after `baseMs` of motion time (0 under reduced motion — the call still lands on the next tick). */
export function scheduleParliamentBeat(baseMs: number, fn: () => void): ParliamentBeat {
  return {kill: motionGuarantee(consoleMotionMs(baseMs), 'a Parliament beat', fn)};
}
