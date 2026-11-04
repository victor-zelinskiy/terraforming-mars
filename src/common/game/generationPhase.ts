import {Phase} from '../Phase';
import {WorldGovernmentActModel} from '../models/GameModel';

/**
 * THE GENERATION'S PHASE — the ONE reading every presenter of «which phase of the generation is this» stands on
 * (P67 World Government Advisor · ledger GL).
 *
 * `GameModel.phase` is the ENGINE's truth, and SOLAR is also its suppression flag: a card's action that makes the
 * player the World Government for one action (`IGame.temporarySolarPhase` — World Government Advisor, the Terra
 * colony's bonus) borrows it in the MIDDLE of the action phase. Read raw, the console took that borrowed SOLAR for the
 * end of the generation: the active seat's «ходит» went dark, the turn hand-off lost its owner, the off-turn reading
 * failed. While the server publishes `worldGovernmentAct` the generation is still in its ACTION phase.
 *
 * Who reads `phase` raw instead is a reader of the ENGINE's flag (the scale-step rating beat — silent in SOLAR, and
 * rightly: the government pays no rating) or of a save's phase (the admin rollback) — each listed with its reason in
 * `tests/console/generationPhaseGuard.spec.ts`, which fails any other client comparison with `Phase.ACTION` /
 * `Phase.SOLAR`. Pure — both sides may import it.
 */
export function generationPhaseOf(game: {phase: Phase, worldGovernmentAct?: WorldGovernmentActModel}): Phase {
  return game.worldGovernmentAct !== undefined ? Phase.ACTION : game.phase;
}
