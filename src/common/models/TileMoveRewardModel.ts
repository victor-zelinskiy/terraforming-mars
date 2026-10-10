import {SpaceId} from '../Types';
import {Resource} from '../Resource';

/**
 * Transient, self-only snapshot of WHAT A TILE MOVE PAID BEYOND THE CELL —
 * the rating the move itself grants (Turmoil Redux TR39 Canyon Carving: an
 * ocean carried one space pays +1 TR, `Game.moveOceanTile`) and what the TABLE
 * answered that rating with, measured on the mover's own stock (the ruling
 * Greens' «2 M€ per TR step», any passive that answers a rating gain).
 *
 * WHY THE SERVER HAS TO SAY THIS. The rating and its answer are applied in the
 * same response as the landing, and the console scene pays the LANDING's
 * rewards in the engine's own order AFTER the tile has touched down (the
 * printed bonus, the neighbouring water, the neighbouring tiles, the law). A
 * rating that ticked at the response — while the tile was still in the air —
 * told the result ahead of its cause, and the table's answer netted into the
 * card's price told nothing at all. The scene must hold both to the landing
 * and may not re-derive either (the move's TR is a rule of the move; the
 * table's answer is the Parliament's), so the ONE function that pays the move
 * publishes what it paid. Purely presentational: nothing reads it back, no
 * rating moves because of it.
 *
 * Lifecycle mirrors `lastOceanBonus`: set inside the input that moved the
 * tile, serialized self-only in `PlayerViewModel`, cleared at the start of the
 * player's next input (`Player.process`). Never serialized into the saved
 * game. The client matches `spaceId` + `from` against the move it armed.
 */
export type TileMoveRewardModel = {
  /** The cell the tile LANDED on (the landing whose reward beats play it). */
  readonly spaceId: SpaceId;
  /** The cell the tile LEFT — with `spaceId`, the declared pair of the one move. */
  readonly from: SpaceId;
  /** The terraform rating the move itself paid (0 for a move that pays none). */
  readonly rating: number;
  /**
   * What the table answered the rating with, on the mover's own stock — every
   * standard resource that GREW between the rating's grant and its return
   * (the Greens' M€). Measured, never re-derived; empty when nothing answered.
   */
  readonly reactions: ReadonlyArray<{readonly resource: Resource, readonly amount: number}>;
};
