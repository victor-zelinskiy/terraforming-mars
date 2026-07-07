import {IGame} from '../IGame';
import {AutomaTilePlacer} from './AutomaTilePlacer';
import {marsBotOf} from './AutomaSetup';

/**
 * MarsBot's game-end behavior (rulebook p.10).
 */
export class AutomaGameEnd {
  /**
   * "MarsBot places final greenery tiles for each of its tracks where the
   * space immediately ahead of its tracker cube is a greenery action. Move the
   * tracker forward and perform MarsBot's greenery action for each track this
   * applies to."
   *
   * A regression marker on that next space suppresses it (strict reading of
   * "ignoring all actions on that track" — owner-confirmed): the tracker does
   * not move and no greenery is placed from that track.
   *
   * The tracker genuinely advances — Banker/Scientist/… award evaluations see
   * the new positions. The greenery rides the ordinary placement path: bot
   * placement priorities, tiebreakers and placement bonuses apply; oxygen is
   * already maxed at game end so no O2/TR is granted by it.
   */
  public static placeFinalGreeneries(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const bot = marsBotOf(game);
    for (const track of automa.board.tracks) {
      if (track.peek() === 'greenery' && !track.regressedPositions.has(track.position + 1)) {
        track.advance();
        game.log('${0} advances a track for a final greenery', (b) => b.player(bot));
        AutomaTilePlacer.placeGreenery(game);
      }
    }
  }
}
