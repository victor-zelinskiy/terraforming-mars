/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A DOOR BY LEVEL (FREEZE ZERO, stage 2 — «one owner per question by a total function»).
 *
 * A decision that is right as a pure function of what STANDS is not left to an edge. An edge is one moment — a
 * watcher's flush, a callback of a flight, a report of a flow that ended — and a moment can be missed: the state it
 * should have ended then stands until a net comes for it, seconds later, and calls it a defect. A level door executes
 * the decision the other way round: every painted frame its owner asks «does the state stand, and is everything
 * quiet?» — and when the answer has been «yes» for the door's frames (and its floor of wall-clock time), the door
 * opens, ONCE per standing state. A flow that ends itself first is the same ending a few frames sooner; one that did
 * not is no longer a dead screen.
 *
 * The three doors of the console (each with its measure, read over the whole suite before it was built):
 *   · the OPENING's       — the start director's cure of a standing disagreement (`startDirector.ts`);
 *   · the CONCLUSION's    — a finished frame over the free turn leaves (`supervisor/staleFreeTurnClock.ts`);
 *   · the STRAND's        — a start scene that serves nothing is healed, then yields (`startServing.ts`).
 *
 * COUNTED IN FRAMES — the clock of the thing it bounds: a page that does not paint opens no door, and a machine four
 * times slower waits as many frames as a fast one (a heavy mount is 200 ms on one and 800 on another, and three
 * frames on both). The floor in milliseconds keeps a 120 Hz page from halving the wait. Pure.
 */

export type LevelDoorBar = {
  /** Painted frames in a row the state must stand quiet. */
  readonly frames: number;
  /** …and no sooner than this long after the quiet began (wall clock, never motion-scaled). */
  readonly ms: number;
};

export type LevelDoorState = {
  /** The standing state being watched ('' = none) — a new key is a new state, with its own one opening. */
  readonly key: string;
  /** Painted frames in a row it stood quiet. */
  readonly frames: number;
  /** When that quiet run began. */
  readonly since: number;
  /** The door already opened for this standing state — ONCE (a door that changed nothing is a net's to name). */
  readonly opened: boolean;
};

export function levelDoorInit(): LevelDoorState {
  return {key: '', frames: 0, since: 0, opened: false};
}

/** One painted frame's look: the next state, and whether the door opens NOW. `key` undefined — nothing stands. */
export function observeLevelDoor(
  state: LevelDoorState, look: {key: string | undefined, quiet: boolean, now: number}, bar: LevelDoorBar,
): {state: LevelDoorState, open: boolean} {
  if (look.key === undefined) {
    return {state: state.key === '' ? state : levelDoorInit(), open: false};
  }
  const same = look.key === state.key;
  if (!look.quiet) {
    // (Something moved, a hold stands, the player reads: the quiet starts again — the state keeps its `opened`.)
    return {state: {key: look.key, frames: 0, since: 0, opened: same && state.opened}, open: false};
  }
  const frames = same ? state.frames + 1 : 1;
  const since = same && state.frames > 0 ? state.since : look.now;
  const opened = same && state.opened;
  const open = !opened && frames >= bar.frames && look.now - since >= bar.ms;
  return {state: {key: look.key, frames, since, opened: opened || open}, open};
}
