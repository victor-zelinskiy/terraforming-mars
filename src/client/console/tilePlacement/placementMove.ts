/*
 * @console-shared LIVE — console native stands on this file.
 *
 * PLACEMENT MOVE — the SOURCE level of a move pick (Turmoil Redux TR14
 * Re-settlement: «remove a city tile you own on Mars and place it in an
 * adjacent … space»).
 *
 * A move is ONE placement decision made of TWO cells: which city leaves, and
 * where it lands. The server asks it as one prompt (`SelectSpaceModel.tileMove`
 * — every city that may move with ITS destinations, every city that may not
 * with its reason) and takes it as one answer (`{spaceId, movedFrom}`), so the
 * only thing that exists between the two picks is PRESENTATION — and this
 * module is all of it: which city the player has lifted.
 *
 * THE LEVELS ARE ONE PROMPT READ TWICE, never two prompts:
 *   · `city` (nothing lifted) — the legal cells are the cities that may move;
 *   · `cell` (a city lifted)  — the legal cells are THAT city's destinations.
 * `moveLevelPrompt` derives the level's own SelectSpace-shaped prompt, and
 * EVERYTHING downstream reads only that: the one board binder (highlight,
 * clicks, the availability wave), the reticle, the dossier, the command bar.
 * So the two-phase confirm machine (`placementFlow.ts`: navigate → locked →
 * committing, the dwell, the release gate) is untouched — it describes the
 * CELL level; the city level is its `navigate` with no lock, and lifting a
 * city is one press of pure presentation (nothing is sent, B puts it down).
 *
 * The client derives NOTHING about the rule: «is this my city», «is this cell
 * adjacent», «what lands» are the marker's own lists. The one statement made
 * by exclusion — a cell that is neither a source nor a disabled source is «not
 * one of your cities on Mars» — is the server's too: the two lists are
 * exhaustive over the player's cities by the marker's contract.
 *
 * Pure + reactive, no DOM: spec'd under the server runner
 * (tests/console/placementMove.spec.ts).
 */
import {reactive} from 'vue';
import {SpaceId} from '@/common/Types';
import {TileType} from '@/common/TileType';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {PlacementIllegalSpace} from '@/common/inputs/PlacementIllegalReason';
import {TileMoveSourceModel} from '@/common/boards/TileMove';

export type PlacementMoveLevel = 'city' | 'cell';

export const placementMoveState = reactive({
  /** The city the player has LIFTED (the cell it stands on) — undefined on the city level. */
  from: undefined as SpaceId | undefined,
});

/** «Взять город» — one press, pure presentation: nothing is sent, B puts it down. */
export function pickUpMoveSource(from: SpaceId): void {
  placementMoveState.from = from;
}

/** B from the cell level — the city stands back on its cell, the pick returns to «which city». */
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

/** The marker's entry for the city on `from` — undefined when no such city may move. */
export function moveSourceOf(prompt: SelectSpaceModel | undefined, from: SpaceId | undefined): TileMoveSourceModel | undefined {
  if (from === undefined) {
    return undefined;
  }
  return prompt?.tileMove?.sources.find((source) => source.from === from);
}

/**
 * Which level a move prompt stands on. A lifted cell that is no longer a
 * source (the offer changed under the player) reads as the city level — a
 * stale lift can never offer destinations.
 */
export function placementMoveLevel(prompt: SelectSpaceModel | undefined, from: SpaceId | undefined = placementMoveState.from): PlacementMoveLevel | undefined {
  if (!isMovePrompt(prompt)) {
    return undefined;
  }
  return moveSourceOf(prompt, from) !== undefined ? 'cell' : 'city';
}

/**
 * THE LEVEL'S OWN PROMPT — the SelectSpace shape every placement reader takes:
 *
 *   city → `spaces` are the cities that may move; a city that may not carries
 *          its ONE reason; every other cell is «not one of your cities on
 *          Mars» (the marker's two lists are exhaustive — see the header);
 *   cell → `spaces` are the lifted city's destinations; a cell the prompt
 *          offers to a SIBLING city carries this city's own reason
 *          (`source.illegal`), every other cell keeps the prompt's reason;
 *          `tileType` is what LANDS (`arrives` — a Capital arrives as a
 *          Capital, a stack's top tier as a plain city).
 *
 * A prompt that is not a move is returned AS IS (the same object — no reader
 * sees a new identity). `boardSpaces` is every cell id of the board (the
 * city level names the reason of each cell that is no city of the player's).
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
  const others: Array<PlacementIllegalSpace> = boardSpaces
    .filter((id) => !sources.has(id) && !named.has(id))
    .map((id) => ({spaceId: id, reason: 'not-your-city'}));
  return {
    ...prompt,
    spaces: move.sources.map((s) => s.from),
    illegalSpaces: [...disabled, ...others],
  };
}

/**
 * The tile the reticle and the dossier NAME for the focused cell of a move:
 * on the cell level what lands (`arrives`); on the city level the tile the
 * focused city would send (`arrives` again — a Capital reads «Столица», a
 * stack's top tier «Город»), a plain city for any other cell.
 */
export function moveFocusTile(prompt: SelectSpaceModel | undefined, from: SpaceId | undefined, focused: SpaceId | undefined): TileType | undefined {
  if (!isMovePrompt(prompt)) {
    return undefined;
  }
  return (moveSourceOf(prompt, from) ?? moveSourceOf(prompt, focused))?.arrives ?? TileType.CITY;
}

/**
 * Where the cursor lands when a city is lifted: its FIRST destination in the
 * server's own order (clockwise from the east neighbour) — deterministic, and
 * a FOCUS, never a choice: the lock is still two presses away.
 */
export function moveFirstDestination(prompt: SelectSpaceModel | undefined, from: SpaceId | undefined): SpaceId | undefined {
  return moveSourceOf(prompt, from)?.to[0];
}
