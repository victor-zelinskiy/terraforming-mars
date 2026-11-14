/*
 * THE REBUILD IS BOUNDED — the pure half of `sessionRebuild.ts` (FREEZE ZERO — PLAN §4 · 6).
 *
 * «Rebuild the console session» is the last line against a freeze, and a last line that can repeat is a loop: a page
 * that reloads itself every fifteen seconds is worse than the freeze it answers. Two bounds, both decided HERE from a
 * small record that outlives the document (the caller keeps it in `sessionStorage`):
 *
 *   · ONE rebuild per QUESTION. The question is the server's own (`type#promptId`, per seat): if it stands unserved
 *     again after the page was rebuilt for it, the client's state was never the cause — the table itself cannot be
 *     served by this build. That is a defect to NAME (once), not to retry;
 *   · at most `REBUILD_WINDOW_MAX` within `REBUILD_WINDOW_MS`, whatever the questions — a console that needs a
 *     fourth rebuild in five minutes is not being cured by them.
 *
 * Pure: no clock, no storage, no DOM — `tests/console/sessionRebuild.spec.ts`.
 */

/** One rebuild that was made: the question it was made for (the bound's key — '' when the server asked nothing) and when. */
export type RebuildRecord = {q: string, at: number};

/** What outlives the document: the rebuilds made in this tab, and the questions whose refusal was already said. */
export type RebuildMemory = {made: ReadonlyArray<RebuildRecord>, told: ReadonlyArray<string>};

export const REBUILD_WINDOW_MS = 5 * 60_000;
export const REBUILD_WINDOW_MAX = 3;
/** The records kept (the newest): far more than a window can hold, far less than a tab can grow. */
const KEPT = 24;

export type RebuildDecision =
  /** Go: the memory to keep BEFORE the document leaves. */
  | {verdict: 'rebuild', memory: RebuildMemory}
  /**
   * Stay. `again` — this very question was rebuilt for once; `rate` — the window is full; `off` — the last line is
   * switched off (`?rebuild=0`). `tell` — whether the refusal is still to be SAID (once per question per tab: a
   * standing refusal is one fact, not a line a second).
   */
  | {verdict: 'refused', reason: RebuildRefusal, tell: boolean, memory: RebuildMemory};

/** Why the page stays: this question was rebuilt for once · the window is full · the last line is switched off. */
export type RebuildRefusal = 'again' | 'rate' | 'off';

export const EMPTY_REBUILD_MEMORY: RebuildMemory = {made: [], told: []};

/** The memory as it was written — anything else (absent, cut, another build's shape) is «nothing was made». */
export function parseRebuildMemory(raw: string | null | undefined): RebuildMemory {
  if (raw === null || raw === undefined || raw === '') {
    return EMPTY_REBUILD_MEMORY;
  }
  try {
    const read = JSON.parse(raw) as {made?: unknown, told?: unknown};
    const made = Array.isArray(read.made) ? read.made.filter((r): r is RebuildRecord => {
      const record = r as Partial<RebuildRecord> | null;
      return record !== null && typeof record === 'object' && typeof record.q === 'string' && typeof record.at === 'number' && Number.isFinite(record.at);
    }) : [];
    const told = Array.isArray(read.told) ? read.told.filter((q): q is string => typeof q === 'string') : [];
    return {made: made.slice(-KEPT), told: told.slice(-KEPT)};
  } catch {
    return EMPTY_REBUILD_MEMORY;
  }
}

/**
 * May the session be rebuilt for `question` now? `question` is the bound's key for the standing question ('' when
 * the server asks nothing — then only the window bounds it).
 */
export function decideRebuild(memory: RebuildMemory, question: string, now: number, off = false): RebuildDecision {
  const refuse = (reason: RebuildRefusal): RebuildDecision => {
    // (The window's refusal is told per question too: «the fourth in five minutes» is said for the question it met.)
    const key = `${reason}:${question}`;
    const tell = !memory.told.includes(key);
    return {verdict: 'refused', reason, tell, memory: tell ? {made: memory.made, told: [...memory.told, key].slice(-KEPT)} : memory};
  };
  if (off) {
    return refuse('off');
  }
  if (question !== '' && memory.made.some((record) => record.q === question)) {
    return refuse('again');
  }
  // (A clock that went back — a record «from the future» — still counts: the bound errs towards staying.)
  const recent = memory.made.filter((record) => now - record.at < REBUILD_WINDOW_MS);
  if (recent.length >= REBUILD_WINDOW_MAX) {
    return refuse('rate');
  }
  return {verdict: 'rebuild', memory: {made: [...memory.made, {q: question, at: now}].slice(-KEPT), told: memory.told}};
}
