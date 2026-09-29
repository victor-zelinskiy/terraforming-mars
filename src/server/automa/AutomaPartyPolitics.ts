/*
 * B21 PARTY POLITICS — the bot's free delegate (Turmoil Redux, docs/TURMOIL_REDUX_MARSBOT.md §3.1).
 *
 * RB-C p.6 prints the classic card: a delegate from the reserve into a
 * PARTY by a six-item list, then a flip («divisible by 3») for a paid second
 * one. In Redux the delegate goes on a RESOLUTION by the chooser's list
 * (§3.3), and the printed tail is deliberately NOT here: the paid delegates
 * come from LOBBYING (`AutomaLobbying.ts`) — every project card the bot plays
 * whose cost is divisible by 3 — so that they arrive in DIFFERENT turns and in
 * an unpredictable number. The card recurs into the action deck every
 * generation from the first (the B16 family), so it fires once per generation
 * at a random point of the bot's turns.
 *
 * A bonus card's impossibility is never a Failed Action (rulebook p.5): no
 * parliament seat, no resolution up for a vote, no delegate left — each is a
 * journal line and a named refusal in the turn script, and the card is
 * simply discarded (the recurring route keeps it in its pool).
 */
import {IGame} from '../IGame';
import {BonusCardOutcome} from './AutomaBonusCards';
import {placeBotDelegate} from './AutomaPolitics';
import {AutomaTurnLog} from './AutomaTurnLog';
import {marsBotOf} from './AutomaUtil';
import {BotVoteBranch, decidingVoteRule, voteRuleBranch} from '../../common/automa/botVoteText';
import {BotVoteChoice} from '../parliament/BotVoteChooser';

/** The ONE resolved branch the turn review prints for the card — the rule that decided the card (the shared phrase). */
export function voteBranchOf(choice: BotVoteChoice): BotVoteBranch {
  return voteRuleBranch(decidingVoteRule(choice.rules), choice.deficit);
}

export function partyPolitics(game: IGame): BonusCardOutcome {
  const bot = marsBotOf(game);
  const parliament = game.parliament;
  if (parliament === undefined || !parliament.participates(bot, 'delegates')) {
    game.log('${0} has no seat at the Mars Parliament: no delegate to send', (b) => b.player(bot));
    AutomaTurnLog.note(game, {kind: 'vote-refused', reason: 'no-seat'}, {consumeLog: true});
    AutomaTurnLog.setBonusBranch(game, {key: 'MarsBot has no seat at the Mars Parliament'});
    return 'discard';
  }
  if (parliament.slots.length === 0) {
    game.log('${0} has no resolution to vote for', (b) => b.player(bot));
    AutomaTurnLog.note(game, {kind: 'vote-refused', reason: 'no-resolution'}, {consumeLog: true});
    AutomaTurnLog.setBonusBranch(game, {key: 'No resolution is up for a vote'});
    return 'discard';
  }
  const source = parliament.lobby.has(bot.id) ? 'lobby' : parliament.reserve(bot) > 0 ? 'reserve' : undefined;
  if (source === undefined) {
    game.log('${0} has no delegate left to send', (b) => b.player(bot));
    AutomaTurnLog.note(game, {kind: 'vote-refused', reason: 'no-delegate'}, {consumeLog: true});
    AutomaTurnLog.setBonusBranch(game, {key: 'No delegate left to send'});
    return 'discard';
  }
  const choice = placeBotDelegate(game, bot, source, {paid: false});
  AutomaTurnLog.setBonusBranch(game, voteBranchOf(choice));
  return 'discard';
}
