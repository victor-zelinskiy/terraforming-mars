import {SECOND_SHIFT_LOG, secondShiftCap} from '../../common/automa/SecondShift';
import {IGame} from '../IGame';
import {AutomaTurnLog} from './AutomaTurnLog';
import {marsBotOf} from './AutomaUtil';

/**
 * «ВТОРАЯ СМЕНА» — the server half (the rule itself: `common/automa/SecondShift.ts`).
 *
 * Asked by the controller at the ONE place the bot would pass — its action deck
 * is empty. The offer is pure; taking it draws one project card off the deck
 * INTO the action deck, so the turn then runs the ordinary project branch
 * (the journal's «played», the corporation's hook, the human reactors, the
 * lobbying rider, the played pile) — an extra card is a card like any other,
 * only its origin is told: the journal line and the turn step `second-shift`
 * (the turn review's headline, the bot screen's counter).
 */
export class SecondShift {
  /** The rule is on for this game and this difficulty has a cap above zero. */
  public static enabled(game: IGame): boolean {
    const automa = game.automa;
    return automa !== undefined && game.gameOptions.automa?.secondShift === true && secondShiftCap(automa.difficulty) > 0;
  }

  /** The cap on this game's difficulty (0 when the rule is off). */
  public static cap(game: IGame): number {
    return SecondShift.enabled(game) && game.automa !== undefined ? secondShiftCap(game.automa.difficulty) : 0;
  }

  /** The extra cards already drawn THIS generation. */
  public static drawn(game: IGame): number {
    const state = game.automa?.secondShift;
    return state !== undefined && state.generation === game.generation ? state.drawn : 0;
  }

  /** The players still in the round — not the bot, not passed. */
  public static playersStillActing(game: IGame): number {
    return game.players.filter((p) => !p.isMarsBot && !game.hasPassedThisActionPhase(p)).length;
  }

  /**
   * The offer at an empty deck: the ordinal of the card the bot would draw now
   * and the cap — undefined when the rule is off, the cap is spent, or nobody
   * else is in the round (then the bot passes as the rulebook says).
   */
  public static offer(game: IGame): {index: number, cap: number} | undefined {
    const automa = game.automa;
    if (automa === undefined || automa.actionDeck.length > 0 || !SecondShift.enabled(game)) {
      return undefined;
    }
    const cap = SecondShift.cap(game);
    const drawn = SecondShift.drawn(game);
    if (drawn >= cap || SecondShift.playersStillActing(game) === 0) {
      return undefined;
    }
    return {index: drawn + 1, cap};
  }

  /**
   * Take the offer: one project card off the deck into the action deck, the
   * count bumped, the line journaled, the step noted. Returns false when
   * there is no offer or the project deck has nothing left to draw.
   */
  public static take(game: IGame): boolean {
    const automa = game.automa;
    const offer = SecondShift.offer(game);
    if (automa === undefined || offer === undefined) {
      return false;
    }
    const card = game.projectDeck.draw(game);
    if (card === undefined) {
      return false;
    }
    automa.actionDeck.push({kind: 'project', name: card.name});
    automa.secondShift = {generation: game.generation, drawn: offer.index};
    game.log(SECOND_SHIFT_LOG, (b) => b.player(marsBotOf(game)).number(offer.index).number(offer.cap));
    AutomaTurnLog.note(game, {kind: 'second-shift', index: offer.index, cap: offer.cap}, {consumeLog: true});
    return true;
  }
}
