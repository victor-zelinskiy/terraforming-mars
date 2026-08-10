/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SELF-TARGET LINK — the one channel between the selector's «Эта карта»
 * handle and the real source card standing in the workspace's hero slot.
 *
 * WHY A MODULE AND NOT A PROP. The source card is NOT inside the selector: it
 * belongs to the composer, one level up and on the other side of the screen.
 * The handle has to be able to light it up without either component owning the
 * other, and without the selector reaching into a parent's DOM. A tiny reactive
 * fact both sides read is the smallest honest coupling — the same shape the
 * console already uses for its other cross-surface links.
 *
 * WHAT IT REPLACES. The selector used to render the source card AGAIN, at full
 * size, as its own candidate: two copies of one physical object on one screen,
 * which is precisely the continuity this fork spends its whole motion budget
 * defending. Now there is one card, and the handle points at it.
 *
 * WHAT IT CARRIES, and why each one has to be here:
 *
 *  · `present` — a source-card candidate EXISTS in the live step. The connector
 *    that draws the handle→card wire is mounted by the host (it has to be, it
 *    spans both columns), so the host needs the fact before the handle's DOM
 *    node does.
 *  · `focused` / `locked` — the cursor and the confirmed choice. Both are read
 *    by the host to light the REAL card, and by the connector to weight itself.
 *  · `pulse` — a PER-STEP NONCE, bumped on the rising edge of `focused` only and
 *    RESET WITH THE STEP (see `resetPlayedTargetSelf`). Both halves are load-
 *    bearing: a session-global nonce is permanently non-zero after the first
 *    self-target ever focused, so every later connector would read «an arrival
 *    happened» from a step the player left long ago and replay the light with
 *    the cursor nowhere near the proxy. The light
 *    that runs down the wire is a one-shot CONFIRMATION that the link exists,
 *    never a state: a permanent pulse would turn a physical connection into
 *    decoration, and the eye stops reading decoration within a second. Keeping
 *    the edge detection HERE (rather than in a watcher at each reader) is what
 *    makes «one pulse per arrival» true for every reader by construction.
 *  · `geometry` — a NONCE the step bumps whenever the boxes it owns genuinely
 *    moved (a new model, a re-solved card size, an owner-tab switch). The
 *    connector measures REAL elements, so it needs to be told when a measurement
 *    it took has expired. Selection and focus deliberately do NOT bump it: they
 *    may not move anything, and a geometry invalidation on every cursor step
 *    would be a re-measure per press.
 */
import {reactive} from 'vue';

export const playedTargetSelfState = reactive({
  /** A source-card candidate exists in the live step. */
  present: false,
  /** The «Эта карта» handle currently holds the cursor. */
  focused: false,
  /** The source card is the CONFIRMED target. */
  locked: false,
  /** Rising-edge-of-focus nonce — one short light down the wire, never a state. */
  pulse: 0,
  /** Bumped when the measured boxes changed; the connector re-measures on it. */
  geometry: 0,
});

/**
 * Publish the whole link in ONE call.
 *
 * Deliberately not three setters: `present` and `focused` are read together by
 * every consumer, and a two-statement update let a reader observe «focused on a
 * handle that is not present» for one tick — which is exactly long enough for
 * the connector to measure an element that had just been removed.
 */
export function setPlayedTargetSelfLink(next: {present: boolean, focused: boolean, locked: boolean}): void {
  // The PULSE fires on the rising edge and nowhere else, so «the handle already
  // had the cursor and the player pressed A» does not replay the arrival.
  if (next.focused && !playedTargetSelfState.focused) {
    playedTargetSelfState.pulse += 1;
  }
  playedTargetSelfState.present = next.present;
  playedTargetSelfState.focused = next.focused;
  playedTargetSelfState.locked = next.locked;
}

/** The step's boxes moved — anything measuring them must measure again. */
export function bumpPlayedTargetSelfGeometry(): void {
  playedTargetSelfState.geometry += 1;
}

/** Step unmount / workspace teardown — the hero must never keep a target ring
 *  that belongs to a selector that is gone. */
export function resetPlayedTargetSelf(): void {
  playedTargetSelfState.present = false;
  playedTargetSelfState.focused = false;
  playedTargetSelfState.locked = false;
  // …AND the pulse. It is a per-step count, not a session one: left standing it
  // is permanently > 0, and the next connector to mount reads «an arrival
  // happened» from a step that ended long ago.
  playedTargetSelfState.pulse = 0;
}
