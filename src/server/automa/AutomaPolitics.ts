/*
 * THE BOT'S DELEGATE, PLACED — the ONE door both of its political rules go
 * through (Party Politics: a free delegate; Lobbying: a paid one), so the
 * ledger, the journal, the quest and the turn script read the same move.
 *
 * The placement IS the human's: `Parliament.placeVote` with a real sequence
 * number (the tie of the lead reads it), the same journal lines a human's
 * vote writes, the same `QuestTracker.report` («send N delegates»), the
 * ledger asserted after it. A paid delegate PAYS FIRST («pay, then place» —
 * the vote action's own order). The card is the chooser's (§3.3), never a
 * roll; what the chooser decided rides the turn script as a typed `vote`
 * step so the turn review explains the move from DATA.
 */
import {Resource} from '../../common/Resource';
import {PARLIAMENT_VOTE_COST} from '../../common/parliament/ParliamentTypes';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {BotVoteChoice, chooseVoteSlot} from '../parliament/BotVoteChooser';
import {QuestTracker} from '../parliament/quests/QuestTracker';
import {AutomaTurnLog} from './AutomaTurnLog';

export function placeBotDelegate(game: IGame, bot: IPlayer, source: 'lobby' | 'reserve', options: {paid: boolean}): BotVoteChoice {
  const parliament = game.parliament;
  if (parliament === undefined) {
    throw new Error('This game has no Mars Parliament');
  }
  const choice = chooseVoteSlot(parliament, bot);
  if (choice === undefined) {
    throw new Error('No resolution is up for a vote — the caller must check the area first');
  }
  const slot = parliament.slots[choice.slotIndex];
  const definition = parliament.resolutionOf(slot.instance);
  const before = parliament.winner();
  const cost = options.paid ? PARLIAMENT_VOTE_COST : 0;
  if (options.paid) {
    // PAY, THEN PLACE — the delegate moves only once the bill is settled.
    bot.stock.deduct(Resource.MEGACREDITS, cost, {log: true});
  }
  parliament.placeVote(bot, slot, source);
  if (source === 'lobby') {
    game.log('${0} sent the free delegate from the lobby to ${1}', (b) => b.player(bot).resolution(definition.id));
  } else {
    game.log('${0} sent a delegate from the reserve to ${1}', (b) => b.player(bot).resolution(definition.id));
  }
  const after = parliament.winner();
  const winsNow = after !== undefined && after.slotIndex === choice.slotIndex && after.player === bot.id;
  AutomaTurnLog.note(game, {
    kind: 'vote',
    resolution: definition.id,
    slot: choice.slotIndex,
    source,
    cost,
    rules: choice.rules,
    ...(choice.deficit === undefined ? {} : {deficit: choice.deficit}),
    winsNow,
  }, {consumeLog: true});
  // The verdict changed hands: said once, at the move that did it.
  if (winsNow && (before?.player !== bot.id || before.instance !== after.instance)) {
    game.log('${0} is now the winning player of ${1}', (b) => b.player(bot).resolution(definition.id));
  }
  QuestTracker.report(bot, {kind: 'delegates', amount: 1});
  parliament.assertLedger(game);
  return choice;
}
