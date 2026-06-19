export type DeltaProjectPlayerModel = {
  position: number;
  jovianBonus: boolean;
  // True once the player has advanced on the track this generation. Reset at the
  // start of each generation (runProductionPhase). Gates the once-per-generation
  // global "Гидросеть" action. Optional for backward-compatibility with saves
  // created before the Delta Project became a global subsystem action.
  usedThisGeneration?: boolean;
}
