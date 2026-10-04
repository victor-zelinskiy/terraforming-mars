import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {Color} from '../Color';
import {SpaceId} from '../Types';

/**
 * A CARD'S REWARD THAT DEPENDS ON THE CELL — «add 1 data to ANY card for each
 * city adjacent to this tile» (Turmoil Redux TR21 Arboretum, the first card of
 * the class; docs/TURMOIL_REDUX_ARBORETUM.md). The amount is unknown until the
 * cell is chosen, and its CAUSE is the neighbourhood of the tile — so every
 * surface states it by the same three words: what is counted (`basis`), which
 * cells did the counting (the dossier fact's `spaces`, the payout's
 * `neighbours`) and where it landed (the payout's `target`).
 */

/**
 * WHAT a per-neighbour amount counts. `adjacent-city`: each city tile beside
 * the placed tile, of any owner — a city STACK counts per tier (the fork's
 * law for a quantity of cities, `boards/cityStack.ts`). A union, so the next
 * «for each X next to this tile» names its own X instead of borrowing one.
 */
export type AdjacencyAmountBasis = {per: 'adjacent-city'};

/**
 * ONE PAYOUT of the class, for the board's scene (`GameModel.cardAdjacencyPayouts`):
 * which tile counted, which neighbours paid how many units each, and the card
 * the units landed on with its count before. Purely presentational (the
 * `AresAdjacencyGrantModel` / `TileMoveRecordModel` precedent): a bounded ring,
 * never serialized, each client consuming a record once by `seq` — the placing
 * player's own scene and every other viewer's remote one read the SAME record,
 * so neither re-derives a neighbour. A restart loses the animation, never the
 * rule (the journal keeps the line and its basis).
 */
export type CardAdjacencyPayoutModel = {
  /** Monotonic consumption key (derived from `gameAge`, restart-safe). */
  seq: number;
  /** The seat that was paid — the owner of `target`. */
  color: Color;
  /** The card whose printed effect paid (Arboretum). */
  card: CardName;
  /** The tile just placed — the centre of the counted neighbourhood. */
  spaceId: SpaceId;
  basis: AdjacencyAmountBasis;
  /** The paying neighbours in the board's adjacency order; `units` per cell (a stack: its tiers). */
  neighbours: ReadonlyArray<{spaceId: SpaceId, units: number}>;
  /** The card the units landed on. */
  target: CardName;
  resource: CardResource;
  /** Σ units — what landed. */
  amount: number;
  /** `target`'s stored count BEFORE the payout (the scene's frozen start). */
  before: number;
};
