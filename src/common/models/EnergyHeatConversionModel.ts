/**
 * Transient, self-only snapshot of the energy→heat conversion that happens
 * during a player's PRODUCTION phase — the rule "at the end of a generation
 * all of a player's energy turns into heat", and the Supercapacitors
 * player-chosen variant of it.
 *
 * The SERVER is the single source of truth for the converted AMOUNT. A pure
 * client diff of before/after-production resource counts cannot isolate it,
 * because production income is added to BOTH energy and heat in the same step
 * (`Player.finishProductionPhase`, which runs right after the conversion),
 * muddying the diff. So we snapshot the exact amount + the pre-conversion
 * stocks here and let the client drive a clean paired "Energy −X → Heat +X"
 * transition animation from a known-good number.
 *
 * Set in `Player.runProductionPhase` / `Supercapacitors.onProduction`; cleared
 * on the player's next input (`Player.process`), exactly like `lastReveal`.
 * Never serialized into the saved game — it is display-only metadata.
 */
export type EnergyHeatConversionModel = {
  /** Energy converted into heat. Always ≥ 1 — the field is left unset when 0. */
  readonly amount: number;
  /** Energy stock immediately BEFORE the conversion (= energy after + amount). */
  readonly energyBefore: number;
  /** Heat stock immediately BEFORE the conversion (= heat after − amount). */
  readonly heatBefore: number;
  /**
   * The generation the conversion belongs to (snapshot at conversion time).
   * The client dedups replays of the same conversion across poll responses on
   * `${color}:${generation}`, so re-fetching the same view never re-animates.
   */
  readonly generation: number;
};
