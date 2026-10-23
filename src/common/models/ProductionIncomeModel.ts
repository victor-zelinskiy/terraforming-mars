import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {Units} from '../Units';

/**
 * Transient, self-only RECORD of the production phase that just paid this
 * player (TR61 — «ДОХОД — СОБЫТИЕ»): the server's own statement of what the
 * phase added, published on the view beside the conversion snapshot.
 *
 * It is the console's generation scene's ONE source: the income flows from
 * each row's production badge into its stock figure by THIS record, the
 * rating's M€ out of the rating cell, the energy into heat — never by a
 * client-side diff of two views (the research deal, a card's
 * `onProductionPhase`, the parliament's levies all move the same counters in
 * the same response) and never by the client re-adding production to stock
 * (invariant 7: readers never count income themselves).
 *
 * Set in `Player.runProductionPhase` (filled by `finishProductionPhase` /
 * `convertEnergyToHeat`); cleared on the player's next input
 * (`Player.process`), exactly like `energyHeatConversion`. Never serialized
 * into the saved game — a reload shows no scene (the journal keeps the group).
 */
export type ProductionIncomeModel = {
  /** The generation whose production this is — the scene's dedupe key with the seat's colour. */
  readonly generation: number;
  /** The `production-phase-income` root's correlation id — the scene's link into the journal group. */
  readonly correlationId: number;
  /** What the production VALUES added to the stock, per resource (a negative M€ production is a negative entry). */
  readonly income: Units;
  /** The terraform rating paid as M€ — the phase's own second M€ line. */
  readonly rating: number;
  /** Energy turned into heat BEFORE the income (0 when there was none) — the same amount `energyHeatConversion` carries. */
  readonly conversion: number;
  /**
   * What a card's OWN production hook (`onProductionPhase`) paid into this seat's stock INSIDE the phase, card by
   * card in tableau order (Pristar's 6 M€, Sol Bank's M€ per data) — the stock measured around each hook by the
   * server, never re-derived from the card. Absent / empty when no hook moved the stock. A hook that DEFERS its
   * payment is not here (its move lands after the record): the scene's promise then disagrees and degrades honestly.
   */
  readonly hooks?: ReadonlyArray<ProductionHookIncomeModel>;
};

/** One card's production hook payment (`ProductionIncomeModel.hooks`). */
export type ProductionHookIncomeModel = {
  readonly card: CardName;
  /** The stock change the hook made, per resource (only non-zero entries matter). */
  readonly income: Units;
  /**
   * What the hook ADDED to its own card (Pristar's preservation) — measured on the card's counter around the call,
   * with the victory points that move with it (the card's own `getVictoryPoints`, before → after). Absent when the
   * card's store did not grow.
   */
  readonly cardResources?: {readonly resource: CardResource, readonly amount: number, readonly vp: number};
};
