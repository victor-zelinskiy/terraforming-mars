/*
 * THE WINNER'S PARAMETER STEP — the family's ONE shared executor (Turmoil
 * Redux, Mohole Contest RX23: «the player that won this resolution increases
 * the global temperature 2 steps»).
 *
 * A card declares the DATA (`winnerReward: {kind: 'parameter', parameter,
 * steps}`, `common/parliament/winnerReward.ts`) and lists the step this
 * function derives from it — the next card with a direct step of a parameter
 * is one line of declaration, never a second executor. The guard refuses a
 * parameter declaration without its step and a step without its declaration.
 *
 * THE READINGS FIXED HERE:
 *  · THE WINNER IS REWARDED. The political phase is `Phase.PARLIAMENT`, so the
 *    engine's own gate (`rewarded = !government && !unrewarded`) pays the
 *    mover everything a raising player gets: +1 TR per step actually made
 *    (`increaseTerraformRating(steps, {global: true})`), the track's bonuses
 *    (the heat production of −24 / −20 °C), the winner's own
 *    `onGlobalParameterIncrease` hooks, the Turmoil hook, and — outside the
 *    gate, as for everybody — the 0 °C ocean. `unrewarded: true` is the WORLD
 *    move's flag (Gas Export, Heat Capture: a step made by nobody, credited to
 *    nobody); passing it here would silently take the winner's TR and bonuses
 *    away. It is never passed, and the spec pins the TR on the winner.
 *  · THE CEILING IS NAMED. The room is read FIRST through the shared
 *    `parameterRoom` (the same arithmetic the vote panel printed): one step
 *    from the maximum makes one step and the record carries the step actually
 *    made; at the maximum the step is a NAMED skip («at its maximum — it is
 *    not raised»), never the engine's silent early return.
 *  · THE 0 °C OCEAN is the engine's own follow-up (`Game.increaseTemperature`
 *    defers `PlaceOceanTile` for the mover): a placement of its own that the
 *    phase waits out (`drainDeferred`) before the walk goes on — the winner
 *    places it, with the tile's TR and the cell's bonuses through the standard
 *    placement. The step neither re-implements nor suppresses it.
 *  · THE RECORD is the winner's (`part: 'winner'`, stamped by the driver):
 *    `kind: 'globalParameter'` with the steps made, the value before and
 *    after, and `tr` — the rating the step paid, MEASURED around the call.
 *
 * THE STEP CONTRACT (IResolution.ts): the step MUTATES (nothing here asks —
 * the ocean is the engine's deferred question, not this step's) and reports
 * exactly once, the ceiling branch included.
 */
import {GlobalParameter} from '../../../common/GlobalParameter';
import {ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {parameterRoom, ParameterTable} from '../../../common/parliament/parameterMove';
import {WinnerParameterReward, winnerParameterStepKey, WinnerStepParameter} from '../../../common/parliament/winnerReward';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {EnactStep} from './IResolution';

/** The skip's reason at the ceiling, per parameter — English keys the stage plate translates. */
export const WINNER_STEP_AT_MAXIMUM_REASON: Readonly<Record<WinnerStepParameter, string>> = {
  temperature: 'Temperature is at its maximum — it is not raised',
  oxygen: 'Oxygen is at its maximum — it is not raised',
  venus: 'Venus is at its maximum — it is not raised',
};

const GLOBAL_PARAMETER: Readonly<Record<WinnerStepParameter, GlobalParameter>> = {
  temperature: GlobalParameter.TEMPERATURE,
  oxygen: GlobalParameter.OXYGEN,
  venus: GlobalParameter.VENUS,
};

/** The table as the engine has it right now — the ONE reader for the step. */
export function parameterTableOf(game: IGame): ParameterTable {
  return {
    oxygenLevel: game.getOxygenLevel(),
    temperature: game.getTemperature(),
    oceans: game.board.getOceanSpaces().length,
    venusScaleLevel: game.getVenusScaleLevel(),
  };
}

function valueOf(game: IGame, parameter: WinnerStepParameter): number {
  switch (parameter) {
  case 'temperature': return game.getTemperature();
  case 'oxygen': return game.getOxygenLevel();
  case 'venus': return game.getVenusScaleLevel();
  }
}

/**
 * THE RAISE, through the engine's own API — REWARDED (no `unrewarded`: the
 * winner is a player making a step, never the World Government). The engine
 * takes literal step counts; the room already cut `steps` to what fits.
 */
function raise(game: IGame, player: IPlayer, parameter: WinnerStepParameter, steps: number): void {
  const n = Math.max(1, Math.min(3, steps));
  switch (parameter) {
  case 'temperature':
    game.increaseTemperature(player, n as 1 | 2 | 3);
    return;
  case 'oxygen':
    game.increaseOxygenLevel(player, Math.min(2, n) as 1 | 2);
    return;
  case 'venus':
    game.increaseVenusScaleLevel(player, n as 1 | 2 | 3);
    return;
  }
}

/**
 * THE STEP a card lists for its `winnerReward: {kind: 'parameter'}` — keyed
 * by the parameter (`winnerParameterStepKey`), so the record, the guard and
 * every reading agree on its name.
 */
export function winnerParameterStep(id: ResolutionId, reward: WinnerParameterReward): EnactStep {
  return {
    key: winnerParameterStepKey(reward),
    run(ctx) {
      const game = ctx.game;
      const player = ctx.player;
      const parameter = reward.parameter;
      const gp = GLOBAL_PARAMETER[parameter];
      const room = parameterRoom({parameter, steps: reward.steps}, parameterTableOf(game));
      if (!room.moves) {
        // THE CEILING, NAMED: the engine would return silently; the record and the journal say why nothing moved.
        game.log('${0} is at its maximum — the winner\'s step from ${1} is skipped', (b) => b.globalParameter(gp).resolution(id));
        ctx.report({kind: 'skipped', amount: 0, parameter: {id: parameter, before: room.current, after: room.current}, reason: WINNER_STEP_AT_MAXIMUM_REASON[parameter]});
        return undefined;
      }
      const before = room.current;
      const trBefore = player.terraformRating;
      raise(game, player, parameter, room.applied);
      const after = valueOf(game, parameter);
      const tr = player.terraformRating - trBefore;
      game.log('${0} raised ${1} ${2} step(s) from ${3} (${4} → ${5}) and gains ${6} TR', (b) =>
        b.player(player).globalParameter(gp).number(room.applied).resolution(id).number(before).number(after).number(tr));
      ctx.report({kind: 'globalParameter', amount: room.applied, parameter: {id: parameter, before, after}, tr});
      return undefined;
    },
  };
}
