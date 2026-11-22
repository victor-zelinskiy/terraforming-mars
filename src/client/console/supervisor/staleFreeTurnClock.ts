/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE STALE FREE-TURN CLOCK — when a finished frame standing over the player's free turn has been QUIET long enough
 * for the supervisor's reaper (`supervisorController.reapStaleFreeTurnFrame`) to conclude it. Pure: the next clock and
 * whether the reaper is due.
 *
 * Why it is its own clock, not the liveness arbiter's `progressAt` (CI 2026-11-11, run 42998242617 — `console-colony-
 * pluto-embed` :329): the reaper runs BEFORE the arbiter's observation inside the same 1 Hz tick, so it read a progress
 * stamp one tick old. The Pluto payout waited on the player's take (the reaper asked, the conclusion HELD on
 * `live-outcome` — right), the player took the card, the server asked a NEW free-turn prompt — and on that very tick
 * the reaper saw a new key with the old stamp («9 s quiet»), the claim with nothing left to present was let go and the
 * colonies were concluded under the trade's own closing beat: the working area still coming back, the track reset
 * gliding over a dissolving stage, «its flow did not end itself». Three laws:
 *   1. A NEW QUESTION IS PROGRESS — a changed frame / prompt key restarts the clock in the same observation.
 *   2. SOMETHING IN FLIGHT IS NOT QUIET — the clock restarts while anything is.
 *   3. A HOLD IS NOT QUIET — a conclusion the frame's own reason refused (`heldAt`) waits a whole quiet span again:
 *      the holder ends with its own edge, and the flow that owns the ending gets the time to end itself.
 */

/**
 * THE CONCLUSION's CANDIDATE — ONE predicate for the reaper and for the conclusion door's measure
 * (`outcomeController.measureConcludeDoor`): the server asks the FREE TURN and the stack's top is a frame PAST ITS
 * COMMIT that does not serve it — never a frame of a phase (its life is the anchor rule's), never a stack set aside or
 * standing aside for the board, never under a placement. Pure; the frame's half comes first (the measure asks every
 * frame, and a table with no committed frame on top answers in three reads).
 */
export function freeTurnConclusionCandidate(
  top: {phase: string, anchor: {type: string}, serves: ReadonlyArray<string>} | undefined,
  table: () => {asksFreeTurn: boolean, collapsed: boolean, yieldedToBoard: boolean, placement: boolean},
): boolean {
  if (top === undefined || top.phase !== 'committed' || top.anchor.type === 'phase' || top.serves.includes('actionMenu')) {
    return false;
  }
  const t = table();
  return t.asksFreeTurn && !t.collapsed && !t.yieldedToBoard && !t.placement;
}

export type StaleFreeTurnClock = {
  /** `<kind>|<promptId>` of the candidate frame being timed ('' = no candidate). */
  readonly key: string;
  /** The clock's own start — the later of the arbiter's progress and this is the quiet's origin. */
  readonly since: number;
};

export function staleFreeTurnClockInit(now: number): StaleFreeTurnClock {
  return {key: '', since: now};
}

export type StaleFreeTurnObservation = {
  readonly now: number;
  /** The candidate's key, or undefined when the top frame is no candidate (not over the free turn, not committed …). */
  readonly key: string | undefined;
  readonly inFlight: boolean;
  /** The liveness arbiter's last progress stamp (one tick old at the reaper's read — law 1 covers what it misses). */
  readonly progressAt: number;
};

export function observeStaleFreeTurn(
  clock: StaleFreeTurnClock, o: StaleFreeTurnObservation, staleMs: number,
): {clock: StaleFreeTurnClock, due: boolean, quietMs: number} {
  if (o.key === undefined) {
    return {clock: {key: '', since: o.now}, due: false, quietMs: 0};
  }
  if (o.key !== clock.key || o.inFlight) {
    return {clock: {key: o.key, since: o.now}, due: false, quietMs: 0};
  }
  const quietMs = o.now - Math.max(clock.since, o.progressAt);
  return {clock, due: quietMs >= staleMs, quietMs};
}

/** The reaper asked and the frame's own reason HELD the conclusion — the next ask is a whole quiet span later (law 3). */
export function staleFreeTurnHeld(clock: StaleFreeTurnClock, now: number): StaleFreeTurnClock {
  return {key: clock.key, since: now};
}
