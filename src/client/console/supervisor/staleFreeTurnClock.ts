/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A FINISHED FRAME OVER THE FREE TURN — the conclusion's CANDIDATE and its DOOR BY LEVEL.
 *
 * (The file keeps the name of what it held first: the stale free-turn reaper's clock — eight seconds of quiet on the
 * supervisor's 1 Hz tick, retired 2026-11-23 when both its cures became this door. Its three laws live on in the
 * door's own terms: a new question is a new candidate, anything in flight starts the quiet again, a hold is the
 * frame's own time.)
 */

import {LevelDoorState, levelDoorInit, observeLevelDoor} from '@/client/console/levelDoor';

/**
 * THE CONCLUSION's CANDIDATE — ONE predicate for the conclusion's door and for its measure
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

/**
 * THE CONCLUSION's LEVEL DOOR (FREEZE ZERO, stage 2 — S5-rest: «one owner per question by a total function»).
 *
 * A finished frame over the free turn used to leave in one of two ways: its flow's own ending (an EDGE — a take's
 * last card, a flow-complete report, the owed run's re-ask) or, when no edge came, the reaper — eight seconds of a
 * dead screen later, named as a defect. The decision itself was always right as a pure function of what stands: the
 * candidate (`freeTurnConclusionCandidate`), the guarded conclusion's own verdict `dismiss` (nothing is owed inside
 * the frame — every hold of `FRAME_HOLDS`, the claim, a nested step, a prompt it serves, a park), no look the player
 * reads over it, and NOTHING IN FLIGHT (`flightsInTheAir` — the wait graph's motion and server waits, the wire, the
 * kernel's own beats). So it is executed BY LEVEL: that state standing for this many painted frames, and this long,
 * is the conclusion — through the ONE guarded door every ending uses.
 *
 * WHY TWELVE FRAMES AND A QUARTER OF A SECOND: over the whole e2e suite (1 502 tests, CI 2026-11-22, run 45071347931)
 * a candidate with a `dismiss` verdict stood QUIET exactly twice, 550 and 582 ms — the colony roster's read, a pause
 * written as a net's timer instead of a wait of the kernel (now a `span`, so it reads `busy`). Every other candidate
 * the suite makes is busy until its flow ends it or held by a named reason. Twelve frames is past a hand-off between
 * two flights (one ends, the next rises a tick later); the wall-clock floor keeps a 120 Hz page from halving it.
 * Counted in FRAMES — a page that does not paint opens no door. (The reaper stood behind it on the wall clock for a
 * day, as a net that should never speak again; it did not, over the whole suite, the gate and the box — and went.)
 */
export const CONCLUSION_DOOR_QUIET_FRAMES = 12;
export const CONCLUSION_DOOR_QUIET_MS = 250;

/** (The rule itself is the console's ONE door by level — `levelDoor.ts`; this is its bar for the conclusion.) */
export type ConclusionDoorState = LevelDoorState;

export function conclusionDoorInit(): ConclusionDoorState {
  return levelDoorInit();
}

/** One painted frame's look (pure): the next state, and whether the door opens NOW. */
export function observeConclusionDoor(
  state: ConclusionDoorState, look: {key: string | undefined, quiet: boolean, now: number},
): {state: ConclusionDoorState, open: boolean} {
  return observeLevelDoor(state, look, {frames: CONCLUSION_DOOR_QUIET_FRAMES, ms: CONCLUSION_DOOR_QUIET_MS});
}
