import * as constants from '../../common/constants';
import {AutomaCorporations} from './corps/AutomaCorporations';
import {GlobalParameter} from '../../common/GlobalParameter';
import {Board} from '../boards/Board';
import {IGame} from '../IGame';
import {AutomaTilePlacer} from './AutomaTilePlacer';
import {AutomaTurnLog} from './AutomaTurnLog';
import {marsBotOf} from './AutomaUtil';

/**
 * The «push the parameter that is ALMOST at a bonus» ladder, printed
 * identically on two official cards:
 *
 *  - B06 Lobbyists / B15 Venus Next Lobbyists (the random bonus deck), and
 *  - B25 Do It Right (Inventrix's corporation card, C05) — the same a/b/c
 *    options word for word; only the card's FATE and its (d) fallback differ
 *    (Lobbyists destroys itself and otherwise advances the furthest Martian
 *    parameter; Do It Right recurs forever and otherwise does nothing).
 *
 * The ladder lives here, in ONE place, because the two cards must never drift
 * apart: a rules answer about «1–2 steps away from a bonus step» has to mean
 * the same thing on both. The callers own what the ladder does not print —
 * where the card goes and what happens when nothing fires.
 *
 * The branch that fired is announced to the turn review here too (the review
 * shows the ONE resolved option, never the card's whole rule text).
 */

/** The option that fired, in the printed a/b/c order. */
export type NearBonusBranch = 'temperature' | 'oxygen' | 'venus' | 'ocean';

/** Steps left to the NEAREST bonus step / completion above the current value; undefined when complete. */
export function stepsToNextTarget(current: number, targets: ReadonlyArray<number>, stepSize: number): number | undefined {
  const ahead = targets.filter((t) => t > current);
  if (ahead.length === 0) {
    return undefined;
  }
  return (Math.min(...ahead) - current) / stepSize;
}

/** Temperature bonus steps: heat at −24/−20, the ocean at 0, completion at +8. */
export function temperatureStepsToTarget(game: IGame): number | undefined {
  return stepsToNextTarget(game.getTemperature(),
    [constants.TEMPERATURE_BONUS_FOR_HEAT_1, constants.TEMPERATURE_BONUS_FOR_HEAT_2, constants.TEMPERATURE_FOR_OCEAN_BONUS, constants.MAX_TEMPERATURE], 2);
}

/** Oxygen bonus steps: the temperature raise at 8%, completion at 14%. */
export function oxygenStepsToTarget(game: IGame): number | undefined {
  return stepsToNextTarget(game.getOxygenLevel(),
    [constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS, constants.MAX_OXYGEN_LEVEL], 1);
}

/** Venus bonus steps: the card draw at 8%, the TR at 16%, completion at 30% (standard board). */
export function venusStepsToTarget(game: IGame): number | undefined {
  return stepsToNextTarget(game.getVenusScaleLevel(),
    [constants.VENUS_LEVEL_FOR_CARD_BONUS, constants.VENUS_LEVEL_FOR_TR_BONUS, constants.MAX_VENUS_SCALE], 2);
}

/**
 * Resolve the FIRST possible option of the ladder, or none:
 *
 *  a. temperature 1–2 steps from a bonus step or completion → +2 steps;
 *  b. oxygen 1–2 steps away → a greenery (its own raise) + 1 more oxygen,
 *     which is the printed «places a greenery tile, raises oxygen 2 steps»;
 *  c. the THIRD option, which the caller names because the two cards print
 *     different ones: `'ocean'` — an ocean-reserved space adjacent to 2+
 *     oceans gets an ocean; `'venus'` (B15 only) — Venus 1–2 steps from a
 *     bonus step gets +2 steps.
 *
 * Returns the branch that fired, or undefined when none could — the caller
 * then runs its own printed fallback.
 */
export function pushNearestBonus(game: IGame, thirdOption: 'ocean' | 'venus'): NearBonusBranch | undefined {
  const bot = marsBotOf(game);

  const temperatureSteps = temperatureStepsToTarget(game);
  if (temperatureSteps !== undefined && temperatureSteps <= 2) {
    AutomaTurnLog.setBonusBranch(game, {key: 'Temperature near a bonus step'});
    // One ACTION, however many steps it prints: a corporation that takes it
    // over skips the whole raise (C36), and the branch still counts as the
    // one the ladder chose.
    if (!AutomaCorporations.replacesParameterRaise(game, GlobalParameter.TEMPERATURE)) {
      game.increaseTemperature(bot, 2); // Clamped internally at completion.
      game.log('${0} raised ${1} ${2} step(s) raised ${1} ${2} {step|steps}', (b) => b.player(bot).globalParameter(GlobalParameter.TEMPERATURE).number(2));
    }
    return 'temperature';
  }

  const oxygenSteps = oxygenStepsToTarget(game);
  if (oxygenSteps !== undefined && oxygenSteps <= 2 &&
      game.board.getAvailableSpacesForGreenery(bot).length > 0) {
    AutomaTurnLog.setBonusBranch(game, {key: 'Oxygen near a bonus step'});
    AutomaTilePlacer.placeGreenery(game); // Raises oxygen 1 step for the greenery.
    // …and the printed «raises oxygen» line on top of the tile is the action
    // a corporation may take over (C36). The GREENERY itself stands: no
    // printed sentence of that card lists «place a greenery tile».
    if (!AutomaCorporations.replacesParameterRaise(game, GlobalParameter.OXYGEN)) {
      game.increaseOxygenLevel(bot, 1);
      game.log('${0} raised ${1} ${2} step(s) raised ${1} ${2} {step|steps}', (b) => b.player(bot).globalParameter(GlobalParameter.OXYGEN).number(1));
    }
    return 'oxygen';
  }

  if (thirdOption === 'venus') {
    const venusSteps = venusStepsToTarget(game);
    if (game.gameOptions.venusNextExtension && venusSteps !== undefined && venusSteps <= 2) {
      AutomaTurnLog.setBonusBranch(game, {key: 'Venus near a bonus step'});
      if (!AutomaCorporations.replacesParameterRaise(game, GlobalParameter.VENUS)) {
        game.increaseVenusScaleLevel(bot, 2); // Clamped internally.
        game.log('${0} raised ${1} ${2} step(s) raised ${1} ${2} {step|steps}', (b) => b.player(bot).globalParameter(GlobalParameter.VENUS).number(2));
      }
      return 'venus';
    }
    return undefined;
  }

  const oceanTarget = game.board.getAvailableSpacesForOcean(bot).filter((space) =>
    game.board.getAdjacentSpaces(space).filter(Board.isOceanSpace).length >= 2);
  if (oceanTarget.length > 0) {
    AutomaTurnLog.setBonusBranch(game, {key: 'Ocean next to two oceans'});
    // This branch picks the space itself instead of going through the shared
    // placer, so it asks the same question the placer would (C36).
    if (AutomaCorporations.replacesParameterRaise(game, GlobalParameter.OCEANS)) {
      return 'ocean';
    }
    const space = AutomaTilePlacer.breakTie(game, oceanTarget);
    game.addOcean(bot, space);
    return 'ocean';
  }
  return undefined;
}
