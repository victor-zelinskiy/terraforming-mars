/*
 * THE COLONY TABLE'S PART — the CLIENT reading (Turmoil Redux, Unity Budget RX29).
 *
 * `worldMoveModel.ts` reads what an enactment does to the PLANET; this module
 * reads what it does to the COLONY TABLE — «advance each colony track 2 steps»
 * (`IClientResolution.trackAdvance`, the declaration the shared world step
 * pays by). Like the planet's part it belongs to nobody and reaches everybody:
 * every tile in play advances, once, whoever won.
 *
 * The moments are the world reading's, for the same reason:
 *   reference   — no table at all (the menu's inspector, the stand's catalog):
 *                 the declared steps, nothing more;
 *   conditional — the card is UP FOR THE VOTE: what the advance would do to
 *                 the table AS IT STANDS («Луна 3 → 5», or «Ио: трек на
 *                 максимуме») — never a promise about a different table;
 *   pending     — the card is ENACTED and the phase is resolving it: the same
 *                 room, still to happen;
 *   applied     — the server RECORDED it (every tile's marker before / after,
 *                 or the named skip of a table with no tile): history, never
 *                 recomputed from today's table.
 *
 * THE ARITHMETIC IS NOT THIS MODULE'S: every «current → resulting» comes from
 * the shared `colonyTrackRoom`, the one the server's own step reads. What this
 * module adds is WHICH MOMENT the surface is in and which tile could NOT move
 * — a track at its end is named, never a silent nothing.
 *
 * Pure: no Vue, no DOM, no i18n (English keys and numbers).
 */
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {ParliamentEnactOutcomeModel} from '@/common/models/ParliamentModel';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyName} from '@/common/colonies/ColonyName';
import {COLONY_TRACK_STEP_KEY, ColonyTrackAdvance, ColonyTrackMove, colonyTrackMoveSteps, colonyTrackRoom} from '@/common/parliament/colonyTrackAdvance';
import {REWARD_ADDRESS} from '@/common/parliament/rewardAddress';

export type ColonyTrackContext = 'reference' | 'conditional' | 'pending' | 'applied';

/** ONE tile's move as the surface may state it: where the marker stood, where it lands, and whether the end of the track stopped it. */
export type ColonyTrackTileReading = ColonyTrackMove & {
  /** The steps actually made (0 at the end of the track). */
  steps: number;
  /** The marker stood at the end of the track already — nothing pretends to have moved. */
  atMax: boolean;
};

/** The reading of a resolution's whole colony-table part. */
export type ColonyTrackReading = {
  advance: ColonyTrackAdvance;
  context: ColonyTrackContext;
  /** conditional / pending: every ACTIVE tile's room on the LIVE table; applied: the record's own list. Empty in `reference`. */
  tiles: ReadonlyArray<ColonyTrackTileReading>;
  /** applied: the advance did not happen at all (no tile in play) — the server's own reason (an English key). */
  skipped?: string;
};

/** The band / results chip of the same part — the reading flattened to what a chip prints. */
export type ColonyTrackMoveChip = {colony: ColonyName, before: number, after: number, steps: number, atMax: boolean};

/**
 * A COLONY TRACK RECORD — the world's move of every colony track: no seat
 * (`part: 'world'`), the kind the shared step reports, or its named skip
 * under the same step key. Never a seat's record.
 */
export function isColonyTrackRecord(outcome: ParliamentEnactOutcomeModel): boolean {
  if (outcome.player !== undefined || outcome.part !== 'world') {
    return false;
  }
  return outcome.kind === 'colonyTrack' || (outcome.kind === 'skipped' && outcome.step === COLONY_TRACK_STEP_KEY);
}

/** The colony track record among a phase's outcomes, if the enactment made one. */
export function colonyTrackRecordOf(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel> | undefined): ParliamentEnactOutcomeModel | undefined {
  return (outcomes ?? []).find(isColonyTrackRecord);
}

/** The tile readings of ONE record — the server's list, each with the steps it actually made. */
export function colonyTrackTilesOf(record: ParliamentEnactOutcomeModel): Array<ColonyTrackTileReading> {
  return (record.tracks ?? []).map((move) => {
    const steps = colonyTrackMoveSteps(move);
    return {colony: move.colony, before: move.before, after: move.after, steps, atMax: steps === 0};
  });
}

/**
 * THE READING of a resolution's colony-table part. `colonies` absent →
 * `reference` (nothing to measure against); `outcomes` carrying the world's
 * record → `applied`. Undefined for a resolution that declares no such part —
 * a caller prints nothing rather than an empty block.
 */
export function colonyTrackReadingOf(
  resolution: IClientResolution | undefined,
  colonies: ReadonlyArray<ColonyModel> | undefined,
  opts: {enacted?: boolean; outcomes?: ReadonlyArray<ParliamentEnactOutcomeModel>} = {},
): ColonyTrackReading | undefined {
  const advance = resolution?.trackAdvance;
  if (advance === undefined) {
    return undefined;
  }
  const record = colonyTrackRecordOf(opts.outcomes);
  if (record !== undefined) {
    const tiles = colonyTrackTilesOf(record);
    const applied: ColonyTrackReading = {advance, context: 'applied', tiles};
    // A skip is the record's own sentence; a record of no tile at all that named no reason is still a
    // skip, and the address's title names it.
    if (record.kind === 'skipped' || tiles.length === 0) {
      applied.skipped = record.reason ?? REWARD_ADDRESS.colonyTrack.skipTitle;
    }
    return applied;
  }
  if (colonies === undefined) {
    return {advance, context: 'reference', tiles: []};
  }
  // THE LIVE TABLE: every tile with a live track — exactly the ones the step will move — through the
  // shared room, so the reading and the move are one arithmetic.
  const tiles = colonies.filter((colony) => colony.isActive).map((colony): ColonyTrackTileReading => {
    const room = colonyTrackRoom(advance, colony.trackPosition);
    return {colony: colony.name, before: room.current, after: room.resulting, steps: room.applied, atMax: room.atMax};
  });
  return {advance, context: opts.enacted === true ? 'pending' : 'conditional', tiles};
}

/** The chips a band / a results line prints for the reading — one per tile, in the server's order. */
export function colonyTrackChipsOf(reading: ColonyTrackReading): Array<ColonyTrackMoveChip> {
  return reading.tiles.map((tile) => ({colony: tile.colony, before: tile.before, after: tile.after, steps: tile.steps, atMax: tile.atMax}));
}

/** The ONE sentence of the whole part — «Every colony track +2» (an English key with the steps as its param). */
export const COLONY_TRACK_SUMMARY_KEY = 'Every colony track +${0}';

/** The word for a track that could not move (an English key). */
export const COLONY_TRACK_AT_MAX_KEY = 'track at its maximum';

/**
 * ONE tile as a SENTENCE — «Luna: 3 → 5» / «Io: track at its maximum». The
 * caption is the tile's name (translated by the caller's `t.text`); the
 * detail is the numbers, or the named end of the track.
 */
export function colonyTrackTileSentenceOf(
  tile: ColonyTrackTileReading,
  t: {text: (key: string) => string, params: (key: string, params: Array<string>) => string},
): {caption: string, detail: string} {
  const caption = t.text(tile.colony);
  if (tile.atMax) {
    return {caption, detail: t.text(COLONY_TRACK_AT_MAX_KEY)};
  }
  return {caption, detail: t.params('${0} → ${1}', [String(tile.before), String(tile.after)])};
}
