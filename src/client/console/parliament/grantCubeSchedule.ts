import {delegateFlightMs} from './delegateFlightPose';

/**
 * A GRANT OF SEVERAL DELEGATES IS ONE PHRASE (P72 Envoys from Venus — ledger CZ; the class: every grant N > 1 — T03,
 * P83, P72, P77, High Circles, Titan Holdings). The cubes of one answer used to fly STRICTLY IN TURN — the touchdown of
 * one launched the next — so a grant of 2 was two whole flights (2 × 0.68…0.92 s) of waiting for a second cube that
 * said nothing new. They now leave the reserve as ONE gesture: each starts a fixed beat after the one before it (the
 * Parliament's support rhythm, law 12 — «a cube every ≥ 90 ms»), each flies its OWN arc into its OWN place on the
 * ribbon, each ticks its counter on its OWN touchdown, and the touchdowns keep the order of the starts.
 *
 * Pure: base milliseconds (the caller folds them through the motion clock), the flight's own length taken from
 * `delegateFlightMs` — ONE flight is never shortened (its curves and durations are the cube's law, §8); only the
 * starts overlap. Reduced motion: no schedule at all (the cubes are simply there).
 */

/** The beat between two cubes' starts — the support rhythm of law 12 (≥ 90 ms), a hair slower for a figure. */
export const GRANT_CUBE_STAGGER_MS = 120;
/** The least gap between two touchdowns — the ribbon ticks twice, never twice in one frame. */
export const GRANT_TOUCH_GAP_MS = 90;

export type GrantCubeBeat = {
  /** When this cube lifts off the reserve (base ms from the phrase's start). */
  startMs: number;
  /** Its own flight's whole length (base ms, `delegateFlightMs` of its distance). */
  durationMs: number;
  /** When it sets down on its place (base ms from the phrase's start). */
  touchMs: number;
};

/**
 * The schedule of one grant's cubes, in placement order: `distances[i]` is the base-to-base distance (screen px) of
 * cube i's flight. Cube 0 starts at once; every next one starts `GRANT_CUBE_STAGGER_MS` after the one before it — later
 * only when its own flight is so much shorter that it would set down before its predecessor (the touchdowns follow the
 * starts, `GRANT_TOUCH_GAP_MS` apart). A grant of ONE is exactly the old phrase: one start at 0, one flight.
 */
export function grantCubeSchedule(distances: ReadonlyArray<number>, reduced = false): Array<GrantCubeBeat> {
  if (reduced) {
    return [];
  }
  const out: Array<GrantCubeBeat> = [];
  for (const distance of distances) {
    const durationMs = delegateFlightMs(Math.max(0, distance));
    const prev = out[out.length - 1];
    const startMs = prev === undefined ? 0 :
      Math.max(prev.startMs + GRANT_CUBE_STAGGER_MS, prev.touchMs + GRANT_TOUCH_GAP_MS - durationMs);
    out.push({startMs, durationMs, touchMs: startMs + durationMs});
  }
  return out;
}

/** The phrase's whole length (base ms): the last touchdown — what a hold over the grant budgets beyond one flight. */
export function grantPhraseMs(schedule: ReadonlyArray<GrantCubeBeat>): number {
  return schedule.reduce((end, beat) => Math.max(end, beat.touchMs), 0);
}
