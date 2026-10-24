import {GlobalParameter} from '../../common/GlobalParameter';
import {IGame} from '../IGame';
import {divertsTerraforming, divertTerraforming} from '../parliament/divertedTerraformingGate';
import {TerraformingUnit} from '../parliament/resolutions/IResolution';
import {marsBotOf} from './AutomaUtil';

/**
 * MARSBOT UNDER A LAW THAT REPLACES TERRAFORMING (Turmoil Redux RX35 Diverted
 * Research — decision D13, the owner 2026-10-24: «the bot must not be able to
 * get around it»). The bot's primitives reach the planet by their own roads —
 * the track raise, the shared tile placer, the near-bonus ladder, the bonus
 * cards — and every one of them checks a ceiling or a cell and writes its own
 * «raised» line BEFORE / AFTER `Game.increase*`. So each asks HERE first, ahead
 * of the ceiling and the cell, exactly where a human's entry asks (decision
 * Р5: the law seats nothing and needs no room — a maxed track under the law is
 * no Failed Action): true = the law has paid the replacement (M€ — the bot
 * holds no card resource) and the caller performs NOTHING, logs nothing.
 *
 * A raise the bot does NOT pre-ask still ends at `Game.increaseOxygenLevel` /
 * `increaseTemperature`, which divert on their own; a greenery / ocean that
 * still reached `Game.addGreenery` / `addOcean` is caught by the NET there and
 * counted as a missed entry (the sweep spec requires zero).
 */
export function botDivertsTerraforming(game: IGame): boolean {
  return divertsTerraforming(marsBotOf(game));
}

/** Ask the standing law to take the bot's `unit` — true = done, perform nothing. */
export function divertBotTerraforming(game: IGame, unit: TerraformingUnit): boolean {
  return divertTerraforming(marsBotOf(game), unit);
}

/** The bot's raise of a Martian scale as a unit, for the callers that hold the parameter and the steps. */
export function divertBotRaise(game: IGame, parameter: GlobalParameter.OXYGEN | GlobalParameter.TEMPERATURE, steps: number): boolean {
  return divertBotTerraforming(game, {kind: 'parameter', parameter, steps});
}
