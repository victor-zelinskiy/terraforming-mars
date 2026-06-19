/**
 * One landing on the Delta Project ("Гидросеть") track — a position the player
 * STOPPED on (and so received its reward), with the generation it happened and,
 * for a choice stage (positions 1/2), which reward alternative was taken.
 * Positions a player merely jumped OVER are NOT recorded (they get no reward),
 * so the client can tell "stopped + rewarded" from "passed through" by comparing
 * stops to the current position.
 */
export type DeltaStop = {
  position: number;
  generation: number;
  /** Chosen reward alternative index for a choice stage (0/1); omitted otherwise. */
  choice?: number;
};

export type DeltaProjectPlayerModel = {
  position: number;
  jovianBonus: boolean;
  // True once the player has advanced on the track this generation. Reset at the
  // start of each generation (runProductionPhase). Gates the once-per-generation
  // global "Гидросеть" action. Optional for backward-compatibility with saves
  // created before the Delta Project became a global subsystem action.
  usedThisGeneration?: boolean;
  // Landing history (positions the player stopped on + reward choice), oldest
  // first. Drives the per-stage history panel. Optional for old saves.
  stops?: Array<DeltaStop>;
}
