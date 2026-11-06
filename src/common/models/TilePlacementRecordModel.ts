import {Color} from '../Color';
import {TileType} from '../TileType';
import {SpaceId} from '../Types';

/** The stock rows a cell's printed bonus can pay (the tile language's tokens — card resources ride their own scene). */
export type TilePlacementPaidResource = 'megacredits' | 'steel' | 'titanium' | 'plants' | 'energy' | 'heat';

/**
 * ONE TILE PLACED ON MARS — the record of the board's «чужой тайл» scene (the tile language, 2026-10-20). A tile
 * carries its owner (`SpaceModel.color`), but an OCEAN carries none, and what the cell PAID the seat that placed it is
 * on no other seat's screen: a viewer watching somebody else's landing could not say who placed it, nor that the cell
 * paid them — the bonus was simply covered by the tile. So `Game.addTile` writes, for every placement on Mars:
 *  · WHO placed it (`color` — an ocean's placer too),
 *  · what the cell's PRINTED bonus paid that seat as stock (`paid` — the human's printed icons; MarsBot's 1 M€ per
 *    covered icon, the Automa rulebook's own exchange, p.9 — never the human's icons for a bot),
 *  · how many cards the printed bonus drew (`cards`),
 *  · what PRODUCTION the printed bonus raised (`produced` — a printed production icon is a counter like any other:
 *    the placer's own scene flies it from the cell into the rail's production digit).
 * Purely presentational (the `CardAdjacencyPayoutModel` / `TileMoveRecordModel` precedent): a bounded ring, never
 * serialized, each client consuming a record once by `seq`. A restart loses the animation, never the rule.
 */
export type TilePlacementRecordModel = {
  /** Monotonic consumption key (derived from `gameAge`, restart-safe). */
  seq: number;
  spaceId: SpaceId;
  /** The seat that placed the tile. */
  color: Color;
  tileType: TileType;
  /** The stock the cell's printed bonus paid the placer, in the printed order. Empty for a cover / a tier / no bonus. */
  paid: ReadonlyArray<{resource: TilePlacementPaidResource, amount: number}>;
  /** Cards the printed bonus drew for the placer (0 when none). */
  cards: number;
  /**
   * The PRODUCTION the cell's printed bonus raised for the placer (Arabia Terra's energy-production cove), by the
   * same sums as `paid`. Absent when the cell printed none — a multiplied bonus is read off it exactly as off `paid`.
   */
  produced?: ReadonlyArray<{resource: TilePlacementPaidResource, amount: number}>;
};

/**
 * A CELL'S «STANDARD RESOURCE OF YOUR CHOICE» PAID — Amazonis Planitia's cells (E3, E9, K3; `SpaceBonus.STANDARD_RESOURCE`).
 * The cell's reward is a QUESTION (`SelectResource`, named by the cell — `choiceContext.source` kind `space`), so its
 * answer lands in a LATER response than the tile: the tile record cannot carry it. `Game.grantSpaceBonus` writes this
 * record when the answer is applied — who chose, which resource, from which cell — so the viewer's own token leaves the
 * cell for the rail row and another seat's leaves it for that seat's intake plaque. The same bounded ring and `seq` law
 * as `TilePlacementRecordModel`; never serialized.
 */
export type CellResourcePayoutModel = {
  seq: number;
  spaceId: SpaceId;
  color: Color;
  resource: TilePlacementPaidResource;
  amount: number;
};
