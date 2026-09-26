/*
 * A TILE TAKEN OFF THE BOARD — the CLIENT reading (Turmoil Redux, Water Export RX33).
 *
 * `worldMoveModel.ts` reads what an enactment does to the PLANET's scales,
 * `colonyTrackModel.ts` what it does to the COLONY TABLE; this module reads
 * what it does to the BOARD ITSELF — «the First Player removes 1 ocean tile»
 * (`IClientResolution.tileRemoval`, the declaration the shared world step pays
 * by). Like the planet's part it belongs to nobody and reaches everybody: one
 * ocean leaves, once, whoever won — but the printed rule names WHO CHOOSES the
 * cell, and that is the one thing this reading has to say before the vote.
 *
 * The moments are the world reading's, for the same reason:
 *   reference   — no table at all (the menu's inspector, the stand's catalog):
 *                 the declaration alone — one ocean leaves, the first player picks;
 *   conditional — the card is UP FOR THE VOTE: what the removal would do to the
 *                 board AS IT STANDS («океанов 3 → 2», or «океаны на максимуме:
 *                 не снимается», or «на поле нет океана») — never a promise
 *                 about a different board;
 *   pending     — the card is ENACTED and the phase is resolving it: the same
 *                 room, still to happen — or the QUESTION standing with the
 *                 first player;
 *   applied     — the server RECORDED it (the cell, the count before / after,
 *                 who chose — or the named skip): history, never recomputed.
 *
 * THE ARITHMETIC IS NOT THIS MODULE'S: every «current → resulting» comes from
 * the shared `tileRemovalRoom`, the one the server's own step decides by. What
 * this module adds is WHICH MOMENT the surface is in and the one honesty the
 * vote panel owes: the removal is the TABLE's, it costs the seat nothing, and a
 * Capital beside the chosen ocean scores one point less — said without a number,
 * because the cell is not chosen yet.
 *
 * Pure: no Vue, no DOM, no i18n (English keys and numbers).
 */
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {ParliamentEnactOutcomeModel} from '@/common/models/ParliamentModel';
import {SpaceModel} from '@/common/models/SpaceModel';
import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {TileType} from '@/common/TileType';
import {TILE_REMOVAL_STEP_KEY, TileRemovalDeclaration, TileRemovalRoom, tileRemovalRoom} from '@/common/parliament/tileRemoval';
import {REWARD_ADDRESS} from '@/common/parliament/rewardAddress';

export type TileRemovalContext = 'reference' | 'conditional' | 'pending' | 'applied';

/** The reading of a resolution's removal part. */
export type TileRemovalReading = {
  declaration: TileRemovalDeclaration;
  context: TileRemovalContext;
  /** conditional / pending: the removal's room on the LIVE board. */
  room?: TileRemovalRoom;
  /** applied: what the server recorded — the cell the tile left, the count before and after, who chose. */
  applied?: {space?: SpaceId; before: number; after: number; actor?: Color};
  /** applied: the removal did not happen — the server's own reason (an English key). */
  skipped?: string;
};

/** The band / results chip of the same part — the reading flattened to what a chip prints (the world chip's own shape). */
export type TileRemovalChip = {parameter: 'oceans'; before: number; after: number; steps: number; unrewarded: boolean; skipped?: string};

/**
 * A TILE-REMOVAL RECORD — the world's removal of a tile: no seat (`part:
 * 'world'`), the kind the shared step reports, or its named skip under the
 * same step key. Never a seat's record.
 */
export function isTileRemovalRecord(outcome: ParliamentEnactOutcomeModel): boolean {
  if (outcome.player !== undefined || outcome.part !== 'world') {
    return false;
  }
  return outcome.kind === 'tileRemoved' || (outcome.kind === 'skipped' && outcome.step === TILE_REMOVAL_STEP_KEY);
}

/** The removal record among a phase's outcomes, if the enactment made one. */
export function tileRemovalRecordOf(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel> | undefined): ParliamentEnactOutcomeModel | undefined {
  return (outcomes ?? []).find(isTileRemovalRecord);
}

/**
 * THE BOARD as the room reads it: the ocean count (every ocean tile, upgraded
 * ones included — the parameter's own count) and how many of them are PLAIN
 * (the only ones the step offers). Read off the game model's cells — a reading
 * of the board's state, never a rule of its own.
 */
export function tileRemovalTableOf(spaces: ReadonlyArray<SpaceModel> | undefined): {oceans: number; removableOceans: number} | undefined {
  if (spaces === undefined) {
    return undefined;
  }
  let oceans = 0;
  let removableOceans = 0;
  for (const space of spaces) {
    const tile = space.tileType;
    if (tile === TileType.OCEAN) {
      oceans++;
      removableOceans++;
    } else if (tile === TileType.OCEAN_CITY || tile === TileType.OCEAN_FARM || tile === TileType.OCEAN_SANCTUARY ||
      tile === TileType.NEW_HOLLAND || tile === TileType.WETLANDS) {
      oceans++;
    }
  }
  return {oceans, removableOceans};
}

/**
 * THE READING of a resolution's removal part. `table` absent → `reference`
 * (nothing to measure against); `outcomes` carrying the world's record →
 * `applied`. Undefined for a resolution that declares no such part — a caller
 * prints nothing rather than an empty block.
 */
export function tileRemovalReadingOf(
  resolution: IClientResolution | undefined,
  table: {oceans: number; removableOceans?: number} | undefined,
  opts: {enacted?: boolean; outcomes?: ReadonlyArray<ParliamentEnactOutcomeModel>} = {},
): TileRemovalReading | undefined {
  const declaration = resolution?.tileRemoval;
  if (declaration === undefined) {
    return undefined;
  }
  const record = tileRemovalRecordOf(opts.outcomes);
  if (record !== undefined) {
    const applied: TileRemovalReading = {
      declaration,
      context: 'applied',
      applied: {
        before: record.parameter?.before ?? 0,
        after: record.parameter?.after ?? 0,
        ...(record.space === undefined ? {} : {space: record.space}),
        ...(record.actor === undefined ? {} : {actor: record.actor}),
      },
    };
    // A skip is the record's own sentence; a record that names no cell removed nothing, and the address's title names it.
    if (record.kind === 'skipped' || record.space === undefined) {
      applied.skipped = record.reason ?? REWARD_ADDRESS.tileRemoved.skipTitle;
    }
    return applied;
  }
  if (table === undefined) {
    return {declaration, context: 'reference'};
  }
  return {declaration, context: opts.enacted === true ? 'pending' : 'conditional', room: tileRemovalRoom(declaration, table)};
}

/** Does the reading state a removal that will NOT happen (the maximum, or nothing to remove)? */
export function tileRemovalBlocked(reading: TileRemovalReading): boolean {
  return reading.skipped !== undefined || (reading.room !== undefined && !reading.room.removes);
}

/**
 * The band's chip of the removal — the world chip's own shape (the ocean count
 * before → after in the planet's unit, or the named skip), so the band, the
 * results and the receipt print it with the parameter chips they already have.
 * `undefined` for a reading with nothing measurable yet (reference).
 */
export function tileRemovalChipOf(reading: TileRemovalReading): TileRemovalChip | undefined {
  if (reading.applied !== undefined) {
    const {before, after} = reading.applied;
    return {parameter: 'oceans', before, after, steps: after - before, unrewarded: false, ...(reading.skipped === undefined ? {} : {skipped: reading.skipped})};
  }
  const room = reading.room;
  if (room === undefined) {
    return undefined;
  }
  const skipped = room.removes ? undefined : (room.atMax ? OCEANS_AT_MAX_KEY : NO_REMOVABLE_OCEAN_KEY);
  return {parameter: 'oceans', before: room.current, after: room.resulting, steps: room.resulting - room.current, unrewarded: false, ...(skipped === undefined ? {} : {skipped})};
}

/** The reading's own words for the two edges the room names before the vote (English keys). */
export const OCEANS_AT_MAX_KEY = 'oceans at their maximum — nothing is removed';
export const NO_REMOVABLE_OCEAN_KEY = 'no ocean on the board to remove';

/** The ONE sentence of the whole part on the vote panel — WHO removes WHAT (an English key). */
export const TILE_REMOVAL_SUMMARY_KEY = 'The first player removes 1 ocean tile from the board';

/** …and its honest footnote: what the removal may cost, without a number — the cell is not chosen yet (an English key). */
export const TILE_REMOVAL_COST_NOTE_KEY = 'A Capital beside it scores one point less. Nobody loses TR.';

/** The word for the question standing with the first player (an English key). */
export const TILE_REMOVAL_ASKING_KEY = 'the first player is choosing the ocean';

/**
 * ONE reading as a SENTENCE — «Oceans: 3 → 2» / «Oceans: at their maximum —
 * nothing is removed» / «Oceans: 3 → 2 · chosen by ${actor}». The caption is
 * the parameter's name; the detail is the numbers, the named skip, or the
 * declaration alone where there is no table.
 */
export function tileRemovalSentenceOf(
  reading: TileRemovalReading,
  t: {text: (key: string) => string, params: (key: string, params: Array<string>) => string},
  nameOf?: (color: Color) => string,
): {caption: string, detail: string} {
  const caption = t.text('Oceans');
  if (reading.skipped !== undefined) {
    return {caption, detail: t.text(reading.skipped)};
  }
  if (reading.applied !== undefined) {
    const parts = [t.params('${0} → ${1}', [String(reading.applied.before), String(reading.applied.after)])];
    if (reading.applied.actor !== undefined && nameOf !== undefined) {
      parts.push(t.params('chosen by ${0}', [nameOf(reading.applied.actor)]));
    }
    return {caption, detail: parts.join(' · ')};
  }
  const room = reading.room;
  if (room === undefined) {
    return {caption, detail: t.text('one tile leaves — the first player chooses which')};
  }
  if (!room.removes) {
    return {caption, detail: t.text(room.atMax ? OCEANS_AT_MAX_KEY : NO_REMOVABLE_OCEAN_KEY)};
  }
  return {caption, detail: t.params('${0} → ${1}', [String(room.current), String(room.resulting)])};
}
