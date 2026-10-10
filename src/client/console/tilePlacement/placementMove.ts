/*
 * @console-shared LIVE — console native stands on this file.
 *
 * PLACEMENT MOVE — the SOURCE level of a move pick (Turmoil Redux TR14
 * Re-settlement: «remove a city tile you own on Mars and place it in an
 * adjacent … space»; TR39 Canyon Carving: «remove any 1 ocean tile from the
 * board and place it in an adjacent space …»).
 *
 * A move is ONE placement decision made of TWO cells: which tile leaves, and
 * where it lands. The server asks it as one prompt (`SelectSpaceModel.tileMove`
 * — every tile that may move with ITS destinations, every tile that may not
 * with its reason) and takes it as one answer (`{spaceId, movedFrom}`), so the
 * only thing that exists between the two picks is PRESENTATION — and this
 * module is all of it: which tile the player has lifted.
 *
 * THE LEVELS ARE ONE PROMPT READ TWICE, never two prompts:
 *   · `source` (nothing lifted) — the legal cells are the tiles that may move;
 *   · `cell`   (a tile lifted)  — the legal cells are THAT tile's destinations.
 * `moveLevelPrompt` derives the level's own SelectSpace-shaped prompt, and
 * EVERYTHING downstream reads only that: the one board binder (highlight,
 * clicks, the availability wave), the reticle, the dossier, the command bar.
 * So the two-phase confirm machine (`placementFlow.ts`: navigate → locked →
 * committing, the dwell, the release gate) is untouched — it describes the
 * CELL level; the source level is its `navigate` with no lock, and lifting a
 * tile is one press of pure presentation (nothing is sent, B puts it down).
 *
 * THE FAMILY of the move — a CITY (TR14) or an OCEAN (TR39) — is the prompt's
 * own `placementType` (`'city-move'` / `'ocean-move'`), a server marker: it
 * decides the WORDS every surface speaks for the levels («Взять город» /
 * «Взять океан», «Другой город» / «Другой океан», the banner, the dossier's
 * section) and what a cell that is no source is called by exclusion («not one
 * of your cities on Mars» / «not an ocean tile»). A word for one family on the
 * other's road is a lie on the screen; nothing here is keyed on a title.
 *
 * The client derives NOTHING about the rule: «is this my city», «is this cell
 * adjacent», «what lands» are the marker's own lists. The one statement made
 * by exclusion — a cell that is neither a source nor a disabled source is
 * «not one of the tiles this move is about» — is the server's too: the two
 * lists are exhaustive over the move's population by the marker's contract.
 *
 * Pure + reactive, no DOM: spec'd under the server runner
 * (tests/console/placementMove.spec.ts).
 */
import {reactive} from 'vue';
import {SpaceId} from '@/common/Types';
import {TileType} from '@/common/TileType';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {PlacementIllegalReason, PlacementIllegalSpace} from '@/common/inputs/PlacementIllegalReason';
import {TileMoveSourceModel} from '@/common/boards/TileMove';

export type PlacementMoveLevel = 'source' | 'cell';

/** The kind of tile a move prompt is about — the prompt's own `placementType`, never a title. */
export type PlacementMoveFamily = 'city' | 'ocean';

export const placementMoveState = reactive({
  /** The tile the player has LIFTED (the cell it stands on) — undefined on the source level. */
  from: undefined as SpaceId | undefined,
});

/** «Взять город» / «Взять океан» — one press, pure presentation: nothing is sent, B puts it down. */
export function pickUpMoveSource(from: SpaceId): void {
  placementMoveState.from = from;
}

/** B from the cell level — the tile stands back on its cell, the pick returns to «which tile». */
export function putDownMoveSource(): void {
  placementMoveState.from = undefined;
}

/** The placement is over / cancelled / the world moved under it — nothing stays lifted. */
export function resetPlacementMove(): void {
  placementMoveState.from = undefined;
}

/** Is this prompt a MOVE (the server's own marker — never a title, never a kind guess)? */
export function isMovePrompt(prompt: SelectSpaceModel | undefined): boolean {
  return prompt?.tileMove !== undefined;
}

/**
 * The move's FAMILY — by the prompt's `placementType` (`'ocean-move'` is the
 * ocean's; every other move prompt is the city's, the family that existed
 * first). Undefined for a prompt that is not a move.
 */
export function moveFamily(prompt: SelectSpaceModel | undefined): PlacementMoveFamily | undefined {
  if (!isMovePrompt(prompt)) {
    return undefined;
  }
  return prompt?.placementType === 'ocean-move' ? 'ocean' : 'city';
}

/** What a cell that is neither a source nor a disabled source IS, by the marker's exclusion — per family. */
const NOT_A_SOURCE: Readonly<Record<PlacementMoveFamily, PlacementIllegalReason>> = {
  city: 'not-your-city',
  ocean: 'not-an-ocean-tile',
};

/** The tile the family's object defaults to when no source is under the cursor (the reticle's and the dossier's swatch). */
const FAMILY_TILE: Readonly<Record<PlacementMoveFamily, TileType>> = {
  city: TileType.CITY,
  ocean: TileType.OCEAN,
};

/** The banner over the board on the SOURCE level — «which tile» in the family's own words. */
export const MOVE_SOURCE_BANNER: Readonly<Record<PlacementMoveFamily, string>> = {
  city: 'Choose your city',
  ocean: 'Choose an ocean',
};

/** The marker's entry for the tile on `from` — undefined when no such tile may move. */
export function moveSourceOf(prompt: SelectSpaceModel | undefined, from: SpaceId | undefined): TileMoveSourceModel | undefined {
  if (from === undefined) {
    return undefined;
  }
  return prompt?.tileMove?.sources.find((source) => source.from === from);
}

/**
 * Which level a move prompt stands on. A lifted cell that is no longer a
 * source (the offer changed under the player) reads as the source level — a
 * stale lift can never offer destinations.
 */
export function placementMoveLevel(prompt: SelectSpaceModel | undefined, from: SpaceId | undefined = placementMoveState.from): PlacementMoveLevel | undefined {
  if (!isMovePrompt(prompt)) {
    return undefined;
  }
  return moveSourceOf(prompt, from) !== undefined ? 'cell' : 'source';
}

/**
 * THE LEVEL'S OWN PROMPT — the SelectSpace shape every placement reader takes:
 *
 *   source → `spaces` are the tiles that may move; a tile that may not carries
 *            its ONE reason; every other cell is «not one of the tiles this
 *            move is about» in the family's words (the marker's two lists are
 *            exhaustive — see the header);
 *   cell   → `spaces` are the lifted tile's destinations; a cell the prompt
 *            offers to a SIBLING carries this tile's own reason
 *            (`source.illegal`), every other cell keeps the prompt's reason;
 *            `tileType` is what LANDS (`arrives` — a Capital arrives as a
 *            Capital, a stack's top tier as a plain city, an ocean as an ocean).
 *
 * A prompt that is not a move is returned AS IS (the same object — no reader
 * sees a new identity). `boardSpaces` is every cell id of the board (the
 * source level names the reason of each cell that is no source).
 */
export function moveLevelPrompt(
  prompt: SelectSpaceModel,
  from: SpaceId | undefined,
  boardSpaces: ReadonlyArray<SpaceId> = []): SelectSpaceModel {
  const move = prompt.tileMove;
  if (move === undefined) {
    return prompt;
  }
  const source = moveSourceOf(prompt, from);
  if (source !== undefined) {
    return {
      ...prompt,
      spaces: source.to,
      illegalSpaces: [...(prompt.illegalSpaces ?? []), ...(source.illegal ?? [])],
      tileType: source.arrives,
    };
  }
  const sources = new Set<SpaceId>(move.sources.map((s) => s.from));
  const disabled = move.disabledSources ?? [];
  const named = new Set<SpaceId>(disabled.map((entry) => entry.spaceId));
  const reason = NOT_A_SOURCE[moveFamily(prompt) ?? 'city'];
  const others: Array<PlacementIllegalSpace> = boardSpaces
    .filter((id) => !sources.has(id) && !named.has(id))
    .map((id) => ({spaceId: id, reason}));
  return {
    ...prompt,
    spaces: move.sources.map((s) => s.from),
    illegalSpaces: [...disabled, ...others],
  };
}

/**
 * The tile the reticle and the dossier NAME for the focused cell of a move:
 * on the cell level what lands (`arrives`); on the source level the tile the
 * focused source would send (`arrives` again — a Capital reads «Столица», a
 * stack's top tier «Город», an ocean «Океан»), the family's own tile for any
 * other cell.
 */
export function moveFocusTile(prompt: SelectSpaceModel | undefined, from: SpaceId | undefined, focused: SpaceId | undefined): TileType | undefined {
  const family = moveFamily(prompt);
  if (family === undefined) {
    return undefined;
  }
  return (moveSourceOf(prompt, from) ?? moveSourceOf(prompt, focused))?.arrives ?? FAMILY_TILE[family];
}

/**
 * Where the cursor lands when a tile is lifted: its FIRST destination in the
 * server's own order (clockwise from the east neighbour) — deterministic, and
 * a FOCUS, never a choice: the lock is still two presses away.
 */
export function moveFirstDestination(prompt: SelectSpaceModel | undefined, from: SpaceId | undefined): SpaceId | undefined {
  return moveSourceOf(prompt, from)?.to[0];
}
