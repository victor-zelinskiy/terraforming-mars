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
};
