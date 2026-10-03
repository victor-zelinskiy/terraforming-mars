/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE COLONY ROSTER — the PURE half (no Vue, no DOM; spec'd under the server
 * runner: tests/console/colonyRosterModel.spec.ts). Which tiles stand on the
 * table is the SERVER's (`ColoniesHandler.seat / retire / replaceColonyTile`,
 * `ColonyRosterPrompt`); this module only READS it: which level of the pick
 * stands, what one change between two tables was, where the cursor goes when
 * the table under it changes, and what a ceremony's beats are.
 * Contract: docs/COLONY_ROSTER_CEREMONY.md.
 */
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardResource} from '@/common/CardResource';
import {
  ColonyRosterBuild, ColonyRosterChange, ColonyRosterIncoming, ColonyRosterOutgoing, ColonyRosterPrompt, rosterBuildLands,
} from '@/common/colonies/ColonyRoster';

/**
 * THE LEVEL of a roster pick — which question the grid is asking right now:
 *  · `outgoing` — «which tile leaves»: the grid is the TABLE (every tile in
 *    play, the ones that cannot leave disabled with their ONE reason);
 *  · `incoming` — «which tile enters»: the grid is the RESERVE catalog.
 * `remove` is always the first, `add` always the second, `replace` walks from
 * the first to the second once the leaving tile is chosen (`draftOutgoing`).
 */
export type RosterLevel = 'outgoing' | 'incoming';

export function rosterLevel(roster: ColonyRosterPrompt | undefined, draftOutgoing: ColonyName | undefined): RosterLevel | undefined {
  if (roster === undefined) {
    return undefined;
  }
  if (roster.kind === 'remove') {
    return 'outgoing';
  }
  if (roster.kind === 'add') {
    return 'incoming';
  }
  return draftOutgoing === undefined ? 'outgoing' : 'incoming';
}

/** The tiles that MAY leave — the outgoing level's selectable set, in the table's order. */
export function rosterLeavable(roster: ColonyRosterPrompt | undefined): ReadonlyArray<ColonyName> {
  return (roster?.outgoing ?? []).filter((tile) => tile.reason === undefined).map((tile) => tile.colony);
}

export function rosterOutgoingOf(roster: ColonyRosterPrompt | undefined, colony: string): ColonyRosterOutgoing | undefined {
  return roster?.outgoing?.find((tile) => tile.colony === colony);
}

export function rosterIncomingOf(roster: ColonyRosterPrompt | undefined, colony: string): ColonyRosterIncoming | undefined {
  return roster?.incoming?.find((tile) => tile.colony === colony);
}

/**
 * A draft of a leaving tile is only as good as the marker that still lists it
 * as able to leave: a table that moved under the pick (a reload, a re-ask with
 * fresh candidates) drops a draft the server would refuse.
 */
export function rosterDraftStands(roster: ColonyRosterPrompt | undefined, draftOutgoing: ColonyName | undefined): boolean {
  return draftOutgoing !== undefined && roster?.kind === 'replace' && rosterLeavable(roster).includes(draftOutgoing);
}

/**
 * ONE CHANGE BETWEEN TWO TABLES, read from their names in order — the viewer's
 * seed (nobody armed anything on this screen; the answer simply carried a
 * different table). `undefined` when the tables are the same, or differ by
 * more than one change (two changes in one view: nothing honest to play — the
 * table simply shows the new truth).
 */
export function rosterDiff(before: ReadonlyArray<ColonyName>, after: ReadonlyArray<ColonyName>): ColonyRosterChange | undefined {
  const gone = before.filter((name) => !after.includes(name));
  const come = after.filter((name) => !before.includes(name));
  if (gone.length === 1 && come.length === 1 && before.length === after.length) {
    const slot = before.indexOf(gone[0]);
    // A replacement keeps the slot; anything else is two changes at once.
    return after.indexOf(come[0]) === slot ? {kind: 'replace', removed: gone[0], added: come[0], slot} : undefined;
  }
  if (gone.length === 0 && come.length === 1 && after.length === before.length + 1) {
    return {kind: 'add', added: come[0], slot: after.indexOf(come[0])};
  }
  if (gone.length === 1 && come.length === 0 && after.length === before.length - 1) {
    return {kind: 'remove', removed: gone[0], slot: before.indexOf(gone[0])};
  }
  return undefined;
}

/**
 * THE CURSOR IS A NAME, NOT AN INDEX. The grid's focus is stored as a position
 * (`consoleState.colonyIndex`), so a tile seated BEFORE it (an addition is
 * sorted in by name) silently moved the focus onto another colony. When the
 * table changes the focus follows the COLONY it stood on; a colony that left
 * hands the focus to its successor by slot (the tile that took its place, or
 * the one that closed the gap), clamped to the table.
 */
export function reanchorColonyCursor(before: ReadonlyArray<string>, after: ReadonlyArray<string>, index: number): number {
  if (after.length === 0) {
    return 0;
  }
  const name = before[index];
  const kept = name === undefined ? -1 : after.indexOf(name);
  if (kept !== -1) {
    return kept;
  }
  return Math.min(Math.max(0, index), after.length - 1);
}

/** What the STAGE states before the press — three facts, each once. */
export type RosterStageReading = {
  /** «Снимается: X» — the tile that leaves (absent for an addition). */
  leaves?: ColonyName;
  /** «Приходит: Y — войдёт активной / неактивной» (absent for a removal). `needs` names what would wake it. */
  arrives?: {colony: ColonyName, entersActive: boolean, needs: ReadonlyArray<CardResource>};
  /** «Колония: слот N» or the ONE reason it will not be built (absent when the effect builds nothing). */
  build?: {lands: true, slot: number} | {lands: false, reason: string};
};

export function rosterStageReading(
  roster: ColonyRosterPrompt | undefined,
  outgoing: ColonyName | undefined,
  incoming: ColonyName | undefined,
  cardResourcesOf: (colony: ColonyName) => ReadonlyArray<CardResource>,
): RosterStageReading {
  const reading: RosterStageReading = {};
  if (roster === undefined) {
    return reading;
  }
  if (outgoing !== undefined && roster.kind !== 'add') {
    reading.leaves = outgoing;
  }
  const entry = incoming === undefined ? undefined : rosterIncomingOf(roster, incoming);
  if (entry !== undefined && roster.kind !== 'remove') {
    reading.arrives = {
      colony: entry.colony,
      entersActive: entry.entersActive,
      needs: entry.entersActive ? [] : cardResourcesOf(entry.colony),
    };
    const build: ColonyRosterBuild | undefined = entry.build;
    if (build !== undefined) {
      reading.build = rosterBuildLands(build) ? {lands: true, slot: build.slot} : {lands: false, reason: build.skipped};
    }
  }
  return reading;
}

// ── THE CEREMONY'S BEATS ────────────────────────────────────────────────────
//
// Base durations (through `motionMs()` at the call site). The grammar is one,
// the order mirrored: an arrival is «space → objects → WORDS», a departure
// «words → objects → space».

/** DEPART — the planet leaves its own disc. */
export const ROSTER_DEPART_MS = 560;
/** ARRIVE — the planet docks, the tile assembles around it. */
export const ROSTER_ARRIVE_MS = 900;
/** RESEAT — the grid changes its population (only when the NUMBER of tiles changes). */
export const ROSTER_RESEAT_MS = 360;
/** The receipt's read (the class of `CARDLAND_READ_MS`). */
export const ROSTER_READ_MS = 680;
/** Reduced motion / fx-lite: final poses and one short fade. */
export const ROSTER_REDUCED_MS = 120;

export type RosterBeat = 'depart' | 'reseat' | 'arrive';

/**
 * The beats of ONE change, in order. A replacement never reseats (no box of
 * the grid changes); a removal lets the planet go and then closes the ranks;
 * an addition opens the ranks first (the slot exists before its object) and
 * then seats the planet. Reduced motion plays no beat at all — final poses.
 */
export function rosterBeats(change: ColonyRosterChange, opts: {reduced?: boolean} = {}): ReadonlyArray<RosterBeat> {
  if (opts.reduced === true) {
    return [];
  }
  switch (change.kind) {
  case 'replace': return ['depart', 'arrive'];
  case 'remove': return ['depart', 'reseat'];
  case 'add': return ['reseat', 'arrive'];
  }
}

/** The whole ceremony's length in base ms — the named bound of its hold. */
export function rosterCeremonyMs(change: ColonyRosterChange, opts: {reduced?: boolean} = {}): number {
  if (opts.reduced === true) {
    return ROSTER_REDUCED_MS;
  }
  return rosterBeats(change).reduce((sum, beat) =>
    sum + (beat === 'depart' ? ROSTER_DEPART_MS : beat === 'arrive' ? ROSTER_ARRIVE_MS : ROSTER_RESEAT_MS), 0);
}
