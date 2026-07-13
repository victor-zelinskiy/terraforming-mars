import {CardName} from '../cards/CardName';

/**
 * Transient, self-only snapshot of a player's START-OF-GAME setup — the corp's
 * starting bonuses (M€ + behavior resources/production/TR) and the M€ paid for
 * the project cards bought at setup.
 *
 * The server applies all of this at once inside `Player.playCorporationCard`
 * (it can't safely be split without restructuring the multiplayer research /
 * prelude coordination). So the corp effect + card payment would otherwise
 * happen INVISIBLY, before the player ever sees the start ceremony. This
 * snapshot records exactly WHAT was applied (and the pre-corp baseline it was
 * applied over) so the premium start flow can REVEAL it as explicit, paced,
 * player-triggered stages — "press A to apply the corporation", then "press A
 * to pay for your cards" — each animating the left panel with delta chips. The
 * player sees precisely what they gain and pay, and at which stage.
 *
 * Same lifecycle as `energyHeatConversion` / `lastReveal`: set in
 * `playCorporationCard`, serialized self-only into `PlayerViewModel`, cleared on
 * the player's next input (`Player.process`), and NEVER written to the saved
 * game (display-only metadata — a reload mid-ceremony simply shows the final
 * values, no reveal).
 */
export type StartingSetupResources = {
  readonly megacredits: number;
  readonly steel: number;
  readonly titanium: number;
  readonly plants: number;
  readonly energy: number;
  readonly heat: number;
};

/** A full resource / production / TR snapshot of the player at one instant. */
export type StartingSetupSnapshot = StartingSetupResources & {
  readonly production: StartingSetupResources;
  readonly terraformRating: number;
};

export type StartingSetupModel = {
  readonly corporation: CardName;
  /**
   * The player's resource / production / TR state BEFORE the corporation was
   * played — the baseline the reveal counts up from (usually all zeros, TR 20).
   * The corp-bonus stage is derived client-side as `final` (the committed view)
   * with M€ raised back by `megacreditsPaid` (payment reversed), so only the
   * baseline + the payment amount need to travel.
   */
  readonly before: StartingSetupSnapshot;
  /** Project cards bought at setup (0 → the payment reveal stage is skipped). */
  readonly cardsBought: number;
  /** M€ deducted to pay for the bought cards (0 → no payment stage). */
  readonly megacreditsPaid: number;
  /**
   * The generation the setup belongs to (always 1). The client dedups replays
   * of the same view on `${color}:${generation}` so a re-fetch never re-reveals.
   */
  readonly generation: number;
};
