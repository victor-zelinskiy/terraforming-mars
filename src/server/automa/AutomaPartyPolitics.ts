/*
 * B21 PARTY POLITICS — one vote of the bot a generation (Turmoil Redux, docs/TURMOIL_REDUX_MARSBOT.md §3.1).
 *
 * RB-C p.6 prints the classic card: a delegate from the reserve into a
 * PARTY by a six-item list, then a flip («divisible by 3») for a paid second
 * one. In Redux the delegate goes on a RESOLUTION by the chooser's list
 * (§3.3), and the printed tail is deliberately NOT here: the further votes
 * come from LOBBYING (`AutomaLobbying.ts`) — every project card the bot plays
 * whose cost is divisible by 3 — so that they arrive in DIFFERENT turns and in
 * an unpredictable number. The card recurs into the action deck every
 * generation from the first (the B16 family), so it fires once per generation
 * at a random point of the bot's turns.
 *
 * The card decides WHEN the bot votes, never at what price: the vote is the
 * human's (`castBotVote` → `Parliament.canVote`, §3.0 — D12) — the lobby's
 * free delegate when it is still there, else one from the reserve for 5 M€.
 *
 * A bonus card's impossibility is never a Failed Action (rulebook p.5): no
 * parliament seat, no resolution up for a vote, no delegate left, no 5 M€
 * for a reserve one — each is a journal line and a named refusal in the turn
 * script, and the card is simply discarded (the recurring route keeps it in
 * its pool).
 */
import {IGame} from '../IGame';
import {BonusCardOutcome} from './AutomaBonusCards';
import {castBotVote} from './AutomaPolitics';
import {AutomaTurnLog} from './AutomaTurnLog';
import {marsBotOf} from './AutomaUtil';
import {BotVoteBranch, decidingVoteRule, voteRuleBranch} from '../../common/automa/botVoteText';
import {BotVoteChoice} from '../parliament/BotVoteChooser';
import {PARLIAMENT_VOTE_COST} from '../../common/parliament/ParliamentTypes';
import {VoteRefusal} from '../parliament/Parliament';
import {IPlayer} from '../IPlayer';

/** The ONE resolved branch the turn review prints for the card — the rule that decided the card (the shared phrase). */
export function voteBranchOf(choice: BotVoteChoice): BotVoteBranch {
  return voteRuleBranch(decidingVoteRule(choice.rules), choice.deficit);
}

/** The card's journal line and its resolved branch for each way the vote can be refused. */
function logRefusal(game: IGame, bot: IPlayer, refusal: VoteRefusal): BotVoteBranch {
  switch (refusal) {
  case 'no-seat':
    game.log('${0} has no seat at the Mars Parliament: no delegate to send', (b) => b.player(bot));
    return {key: 'MarsBot has no seat at the Mars Parliament'};
  case 'no-resolution':
    game.log('${0} has no resolution to vote for', (b) => b.player(bot));
    return {key: 'No resolution is up for a vote'};
  case 'no-delegate':
    game.log('${0} has no delegate left to send', (b) => b.player(bot));
    return {key: 'No delegate left to send'};
  case 'not-enough-mc':
    game.log('${0} cannot send a delegate: not enough M€ for one from the reserve (${1} M€)', (b) => b.player(bot).number(PARLIAMENT_VOTE_COST));
    return {key: 'Not enough M€ to send a delegate from the reserve'};
  }
}

export function partyPolitics(game: IGame): BonusCardOutcome {
  const bot = marsBotOf(game);
  const vote = castBotVote(game, bot);
  if (!vote.placed) {
    const branch = logRefusal(game, bot, vote.refusal);
    AutomaTurnLog.note(game, {kind: 'vote-refused', reason: vote.refusal}, {consumeLog: true});
    AutomaTurnLog.setBonusBranch(game, branch);
    return 'discard';
  }
  AutomaTurnLog.setBonusBranch(game, voteBranchOf(vote.choice));
  return 'discard';
}
