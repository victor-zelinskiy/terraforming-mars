/*
 * A TILE REMOVED FROM THE BOARD, AND THE ROOM IT HAS (Turmoil Redux — Water Export, RX33).
 *
 * The first resolution whose enactment TAKES TERRAFORMING BACK: «If oceans
 * are not at maximum, the First Player removes 1 ocean tile from the board».
 * Like a world move of a global parameter (`parameterMove.ts`) and the colony
 * table's advance (`colonyTrackAdvance.ts`) it belongs to NOBODY — the ocean
 * count is the planet's, the tile leaves for everybody, once per enactment —
 * and it is therefore a WORLD step: run once, recorded with no seat, read the
 * same by every viewer. What is NEW in the family: the world step ASKS. The
 * printed rule names its executor by POSITION («the First Player»), and that
 * player picks the cell; the record still carries no seat, and names the
 * executor only as the one who chose (`actor`).
 *
 * A card declares the tile and the executor and nothing else; the family's
 * ONE shared step (`server/parliament/resolutions/ResolutionTileRemoval.ts`)
 * pays it through the engine's own removal (`Game.removeTile` — the very
 * mutation the Reds' party action and the Dry Deserts event use).
 *
 * WHAT A READING MAY HONESTLY SAY is the removal's ROOM: how many oceans stand,
 * whether the card's own clause forbids the removal (oceans at their maximum —
 * the rule of the resolution, checked FIRST), and whether there is anything to
 * remove at all (no ocean on the board, or every ocean upgraded — the engine's
 * own filter, checked second). Two conditions, two reasons, never one general
 * «nothing happened».
 *
 * Pure, shared by the server (the step that pays, the contract guard) and the
 * client (the vote reading, the inspector, the sitting's scene, the results,
 * the stand). No i18n, no DOM: every label is the reader's.
 */
import {MAX_OCEAN_TILES} from '../constants';

/**
 * THE DECLARATION: the executor named by the printed rule removes ONE tile of
 * `tile` from the board, once per enactment. `executor: 'first-player'` is the
 * only executor the family knows today — the first player in generation order
 * (the World Government's own handle) — and it is a rule of the card, so a
 * reading can print WHO will be asked before the vote.
 */
export type TileRemovalDeclaration = {
  tile: 'ocean';
  executor: 'first-player';
};

/** The step key the shared removal step reports under — the client finds the record by it (structural, never a title). */
export const TILE_REMOVAL_STEP_KEY = 'oceanRemoval';

/** WHAT A DECLARED REMOVAL WOULD DO TO THE TABLE RIGHT NOW. */
export type TileRemovalRoom = {
  /** How many oceans stand on the board (upgraded ones included — the parameter's own count). */
  current: number;
  max: number;
  /** The CARD's own clause: at the maximum the law does not remove anything. Checked first. */
  atMax: boolean;
  /** How many oceans the executor may actually pick from (plain oceans only — an upgraded ocean is never removed). */
  removable: number;
  /** The removal happens: not at the maximum, and at least one plain ocean stands. */
  removes: boolean;
  /** The count after the removal (== current when nothing is removed). */
  resulting: number;
};

/** The table facts a room reads — the ocean count, and how many of them are plain (removable). */
export type TileRemovalTable = {
  oceans: number;
  /** Absent when the reader cannot tell plain oceans from upgraded ones: then every ocean is assumed plain. */
  removableOceans?: number;
};

/**
 * The room of ONE removal against the table. Pure arithmetic over the
 * engine's own ceiling (`MAX_OCEAN_TILES` — the bound `Game.canAddOcean`
 * reads) and its own filter (`getOceanSpaces({upgradedOceans: false})`).
 */
export function tileRemovalRoom(_declaration: TileRemovalDeclaration, table: TileRemovalTable): TileRemovalRoom {
  const max = MAX_OCEAN_TILES;
  const current = Math.max(0, table.oceans);
  const atMax = current >= max;
  const removable = Math.max(0, Math.min(current, table.removableOceans ?? current));
  const removes = !atMax && removable > 0;
  return {
    current,
    max,
    atMax,
    removable,
    removes,
    resulting: removes ? current - 1 : current,
  };
}

/** A declared removal names a tile the family can remove and an executor it can ask — the guard's own check. */
export function tileRemovalDeclared(declaration: TileRemovalDeclaration | undefined): declaration is TileRemovalDeclaration {
  return declaration !== undefined && declaration.tile === 'ocean' && declaration.executor === 'first-player';
}

/** THE SKIP REASON of the card's own clause: the oceans stand at their maximum (an English key). */
export const OCEANS_AT_MAX_REASON = 'Oceans are at their maximum — nothing is removed';

/** THE SKIP REASON of an empty pick: no plain ocean stands on the board to remove (an English key). */
export const NO_REMOVABLE_OCEAN_REASON = 'No ocean tile can be removed';
