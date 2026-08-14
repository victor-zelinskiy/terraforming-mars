import {IPlayer} from '../IPlayer';
import {PotentialActionsModel} from '../../common/models/PotentialActionsModel';
import {DeltaProjectExpansion} from '../delta/DeltaProjectExpansion';

/**
 * The TURN-INDEPENDENT availability projection of one player (see
 * {@link PotentialActionsModel}): what they could do if it were their action
 * window right now.
 *
 * Every number is delegated to the real domain validator — this module owns NO
 * rule of its own, and must never grow one. It exists so the four numbers are
 * computed in ONE place, from the same code the engine executes with, instead of
 * being re-derived per surface (which is how the client ended up guessing "you
 * cannot afford it" at a player holding 510 M€).
 *
 * READ-ONLY with respect to game state. `getPlayableCards` / `canPlay` refresh a
 * card's EPHEMERAL `warnings` / `additionalProjectCosts` exactly as the action
 * menu and `unplayableReasons` already do on every model build — no lasting
 * effect, and the serializer re-runs them afterwards anyway.
 */
export function potentialActions(player: IPlayer): PotentialActionsModel {
  return {
    playableCards: player.getPlayableCards().length,
    cardActions: player.getPlayableActionCards().length,
    hydroAdvance: potentialHydroAdvance(player) ? 1 : 0,
    colonyTrades: player.colonies.potentialTradeCount(),
  };
}

/**
 * A Hydronetwork («Гидросеть») advance is possible by the RULES: the expansion
 * is in this game, the player has track progress, they have not advanced this
 * generation, and at least one destination is legally reachable AND payable
 * (`maxSteps` folds energy, the per-position tag path incl. wilds, and VP-slot
 * occupancy into one authoritative answer).
 *
 * The player's action window is deliberately NOT part of this — it is the one
 * thing `PublicPlayerModel.canAdvanceDelta` adds on top.
 */
export function potentialHydroAdvance(player: IPlayer): boolean {
  return player.game.gameOptions.deltaProjectExpansion === true &&
    player.deltaProjectData !== undefined &&
    player.deltaProjectData.usedThisGeneration !== true &&
    DeltaProjectExpansion.maxSteps(player) > 0;
}
