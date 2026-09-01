import * as constants from '../../common/constants';
import {AutomaCorporations} from './corps/AutomaCorporations';
import {GlobalParameter} from '../../common/GlobalParameter';
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
    // A corporation may TAKE THE ACTION OVER before anything is asked of the
    // parameter — «when MarsBot WOULD raise the temperature» (C36). Asked
    // FIRST, so a completed temperature is not a Failed Action either: the
    // action the mat gave was replaced, and a replaced action never reaches
    // the question «can this still be raised?».
    if (AutomaCorporations.replacesParameterRaise(game, GlobalParameter.TEMPERATURE)) {
      return;
    }
    if (game.getTemperature() >= constants.MAX_TEMPERATURE) {
      failedAction(game, 'temperature-maxed');
      return;
    }
    const bot = marsBotOf(game);
    game.increaseTemperature(bot, 1);
    game.log('${0} raised ${1} ${2} step(s) raised ${1} ${2} {step|steps}', (b) => b.player(bot).globalParameter(GlobalParameter.TEMPERATURE).number(1));
  }
}
