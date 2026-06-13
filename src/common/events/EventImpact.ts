import {Units} from '../Units';
import {CardResource} from '../CardResource';
import {GlobalParameter} from '../GlobalParameter';
import {CardName} from '../cards/CardName';

/**
 * FACTUAL impact of a {@link GameEvent}. Facts only — never an estimated
 * "M€ equivalent" valuation. Turning facts into a value score is a SEPARATE
 * layer (see `valuation()` in the client analytics), so the persisted stream
 * stays objective and reproducible while valuation heuristics can change
 * without a data migration.
 *
 * All numeric deltas are SIGNED (a loss is negative). Empty fields are omitted.
 */
export type EventImpact = {
  /** Standard resource stock change (signed). */
  stock?: Partial<Units>;
  /** Production change (signed). */
  production?: Partial<Units>;
  /** Card-resource (microbe/animal/floater/asteroid/…) additions/removals. */
  cardResources?: ReadonlyArray<{cardResource: CardResource; target?: CardName; amount: number}>;
  /** Terraform Rating change (signed). */
  tr?: number;
  /** Global-parameter steps moved (temperature/oxygen/oceans/venus). */
  globalParameter?: {parameter: GlobalParameter; steps: number};
  /** Cards drawn. */
  cardsDrawn?: number;
  /** Cards discarded. */
  cardsDiscarded?: number;
  /** Direct VP grant (rare mid-game; most VP is computed at endgame). */
  vp?: number;
  /** Tiles placed on a board. */
  tilesPlaced?: number;
  /** M€ actually paid (payment events). */
  megacreditsPaid?: number;
  /**
   * M€ saved by a discount (the SAVING, not the spend). This is the "hidden
   * value" the effect overlay / insightEngine surface — populated ONLY by
   * `discount-applied` events, never inferred from a stock delta.
   */
  megacreditsSaved?: number;
};
