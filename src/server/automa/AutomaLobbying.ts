/*
 * LOBBYING — the bot's PAID delegates (Turmoil Redux, docs/TURMOIL_REDUX_MARSBOT.md §3.2).
 *
 * «Each time MarsBot plays a PROJECT CARD in its turn whose cost is divisible
 * by 3 (0 divides), after the card resolved it lobbies: one delegate from the
 * reserve for 5 M€ onto the resolution of the chooser's list; a cost divisible
 * by 9 — two delegates (5 M€ each, the list re-read for each). No reserve, or
 * no 5 M€ — the lobbying does not happen (a journal line with the reason,
 * never a Failed Action). Bonus cards never lobby.»
 *
 * The randomness is the OFFICIAL generator («the flipped card's price is
 * evenly divisible by 3», RB-C p.6) taken from the card the bot ALREADY
 * played: no extra reveal, a full explanation («EVA Mechs, cost 12 — divisible
 * by 3 → a delegate on …»), and the action deck is hidden from the human
 * (`MarsBotModel.actionDeckSize` is a number) — so until the bot's last card
 * the human never knows whether one more is coming. It is a RIDER of the
 * controller's project-card branch, after the tags and before the played
 * pile: inside the same turn and the same journal group, under its own
 * cause (`lobbying`) so the review reads it as the turn's own step.
 *
 * It is NOT a second resolution of the card and not a reveal: the card was
 * played once (the human reactors fired once, `AutomaHumanTagReactions`), a
 * Failed Action does not cancel it (the card was played, its cost is
 * printed), and a card a BONUS card resolved (R&D's draw) is that card's
 * effect — the controller's branch is the one door.
 *
 * The knobs: `LOBBYING_DIVISOR` / `LOBBYING_DOUBLE_DIVISOR` (softer: 4/8 or
 * 5/10); the delegate's price is the shared `PARLIAMENT_VOTE_COST`. The
 * share of the real project deck each divisor selects is MEASURED and
 * printed by `tests/automa/AutomaLobbying.spec.ts` § measured.
 */
import {Resource} from '../../common/Resource';
import {PARLIAMENT_VOTE_COST} from '../../common/parliament/ParliamentTypes';
import {IGame} from '../IGame';
import {IProjectCard} from '../cards/IProjectCard';
import {placeBotDelegate} from './AutomaPolitics';
import {AutomaTurnLog} from './AutomaTurnLog';
import {marsBotOf} from './AutomaUtil';

export const LOBBYING_DIVISOR = 3;
export const LOBBYING_DOUBLE_DIVISOR = 9;

/** How many delegates a played card of `cost` lobbies with: 2 by the double divisor, 1 by the divisor, else 0. */
export function lobbyingDelegates(cost: number): number {
  if (cost % LOBBYING_DOUBLE_DIVISOR === 0) {
    return 2;
  }
  return cost % LOBBYING_DIVISOR === 0 ? 1 : 0;
}

export class AutomaLobbying {
  /** The rider: called by the controller once the played project card resolved. */
  public static afterProjectCard(game: IGame, card: IProjectCard): void {
    const parliament = game.parliament;
    if (parliament === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    if (!parliament.participates(bot, 'delegates')) {
      return;
    }
    const count = lobbyingDelegates(card.cost);
    if (count === 0) {
      return;
    }
    const previous = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'lobbying'});
    try {
      game.events.withSource({kind: 'parliament'}, () => {
        game.log('${0} lobbies: the cost of ${1} (${2} M€) is divisible by ${3}', (b) =>
          b.player(bot).card(card).number(card.cost).number(count === 2 ? LOBBYING_DOUBLE_DIVISOR : LOBBYING_DIVISOR));
        for (let i = 0; i < count; i++) {
          if (parliament.slots.length === 0) {
            game.log('${0} cannot lobby: no resolution is up for a vote', (b) => b.player(bot));
            AutomaTurnLog.note(game, {kind: 'vote-refused', reason: 'no-resolution'}, {consumeLog: true});
            return;
          }
          if (parliament.reserve(bot) <= 0) {
            game.log('${0} cannot lobby: no delegate left in the reserve', (b) => b.player(bot));
            AutomaTurnLog.note(game, {kind: 'vote-refused', reason: 'no-delegate'}, {consumeLog: true});
            return;
          }
          if (bot.stock.get(Resource.MEGACREDITS) < PARLIAMENT_VOTE_COST) {
            game.log('${0} cannot lobby: not enough M€ for a delegate (${1} M€)', (b) => b.player(bot).number(PARLIAMENT_VOTE_COST));
            AutomaTurnLog.note(game, {kind: 'vote-refused', reason: 'not-enough-mc'}, {consumeLog: true});
            return;
          }
          placeBotDelegate(game, bot, 'reserve', {paid: true});
        }
      });
    } finally {
      AutomaTurnLog.setCause(game, previous);
    }
  }
}
