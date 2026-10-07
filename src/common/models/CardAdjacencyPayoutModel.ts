import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {Color} from '../Color';
import {SpaceId} from '../Types';
import {Units} from '../Units';

/**
 * A CARD'S REWARD THAT A PLACED TILE PAYS — the record of the board scene «ТАЙЛ
 * ПЛАТИТ КАРТЕ». Two causes share it (one writer, `cards/tilePayout.ts`):
 *
 *  · `adjacent-cities` — «add 1 data to ANY card for each city adjacent to
 *    this tile» (Turmoil Redux TR21 Arboretum; docs/TURMOIL_REDUX_ARBORETUM.md).
 *    The amount is unknown until the cell is chosen and its CAUSE is the
 *    neighbourhood, so every surface states it by the same three words: what
 *    is counted (`basis`), which cells did the counting (the dossier fact's
 *    `spaces`, the payout's `neighbours`) and where it landed (`target`).
 *  · `tile-placed` — a card that ANSWERS a tile placed (TR30 Red Museum: «after
 *    you place a city or special tile on Mars adjacent to no greeneries or
 *    oceans, add 2 data resources to this card»). The tile itself is the
 *    cause: `neighbours` is the placed cell alone, carrying every unit, and
 *    the units land on the card that answered (`target === card`).
 */

/** WHY the tile paid — what the scene reads its token source from. */
export type TilePayoutCause = 'adjacent-cities' | 'tile-placed';

/**
 * WHAT a per-neighbour amount counts. `adjacent-city`: each city tile beside
 * the placed tile, of any owner — a city STACK counts per tier (the fork's
 * law for a quantity of cities, `boards/cityStack.ts`). A union, so the next
 * «for each X next to this tile» names its own X instead of borrowing one.
 */
export type AdjacencyAmountBasis = {per: 'adjacent-city'};

/**
 * ONE PAYOUT of the class, for the board's scene (`GameModel.cardAdjacencyPayouts`):
 * which tile paid, which cells sent how many units each, and the card the
 * units landed on with its count before. Purely presentational (the
 * `AresAdjacencyGrantModel` / `TileMoveRecordModel` precedent): a bounded ring,
 * never serialized, each client consuming a record once by `seq` — the placing
 * player's own scene and every other viewer's remote one read the SAME record,
 * so neither re-derives a neighbour. A restart loses the animation, never the
 * rule (the journal keeps the line).
 */
export type CardAdjacencyPayoutModel = {
  /** Monotonic consumption key (derived from `gameAge`, restart-safe). */
  seq: number;
  /** Why the tile paid — the scene's token source: the paying neighbours, or the placed tile itself. */
  cause: TilePayoutCause;
  /** The seat that was paid — the owner of `target`. */
  color: Color;
  /** The card whose printed effect paid (Arboretum, Red Museum). */
  card: CardName;
  /** The tile just placed — the centre of the counted neighbourhood, or the cause itself. */
  spaceId: SpaceId;
  /** What one unit counts — only for a per-neighbour amount (`adjacent-cities`). */
  basis?: AdjacencyAmountBasis;
  /**
   * The cells that SENT the units, each with its share, in the board's
   * adjacency order (a stack: its tiers). For `tile-placed` it is the placed
   * cell alone, carrying the whole amount.
   */
  neighbours: ReadonlyArray<{spaceId: SpaceId, units: number}>;
  /** The card the units landed on. */
  target: CardName;
  resource: CardResource;
  /** Σ units — what landed. */
  amount: number;
  /** `target`'s stored count BEFORE the payout (the scene's frozen start). */
  before: number;
  /**
   * What the TABLE paid the seat in answer to this addition — MEASURED around
   * the one `addResourceTo` (Martian Fiber's +1 M€ per data), never derived:
   * the scene flies it to the rail after the card has gone home. Absent when
   * nothing answered.
   */
  reactions?: Partial<Units>;
};
