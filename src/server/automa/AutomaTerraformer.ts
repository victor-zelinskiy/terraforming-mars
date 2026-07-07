import * as constants from '../../common/constants';
import {IGame} from '../IGame';
import {failedAction} from './AutomaFailedAction';
import {marsBotOf} from './AutomaUtil';

/**
 * MarsBot's global-parameter raises. TR follows the normal rules; the
 * bot-specific bonus-step behavior (rulebook p.9: −24/−20 heat production →
 * 2 M€; the 0 °C ocean and the 8% oxygen temperature bonuses resolve
 * immediately or become a Failed Action) lives as isMarsBot branches inside
 * Game.increaseTemperature / increaseOxygenLevel, so a raise from ANY automa
 * source (track action, bonus card, greenery) behaves identically.
 */
export class AutomaTerraformer {
  /** "MarsBot raises the temperature by 1 step" — a completed track is a Failed Action. */
  public static raiseTemperature(game: IGame): void {
    if (game.getTemperature() >= constants.MAX_TEMPERATURE) {
      failedAction(game, 'temperature-maxed');
      return;
    }
    const bot = marsBotOf(game);
    game.increaseTemperature(bot, 1);
    game.log('${0} raised the temperature 1 step', (b) => b.player(bot));
  }
}
