/*
 * THE BOT'S DELEGATE, PLACED — two doors and one body, so the ledger, the
 * journal, the quest and the turn script read the same move:
 *
 *  - `castBotVote` — THE VOTE. Both of the bot's political rules come through
 *    it (Party Politics, Lobbying), and those rules decide only WHEN and HOW
 *    MANY times the bot votes. FROM WHERE and AT WHAT PRICE is the human's own
 *    rule of the vote, `Parliament.canVote` (docs/TURMOIL_REDUX_MARSBOT.md
 *    §3.0, D12): the lobby's free delegate first, then one from the reserve
 *    for `PARLIAMENT_VOTE_COST`. The bot has no economy of its own — the first
 *    revision tied the price to the RULE (Party Politics = the lobby, Lobbying
 *    = the reserve), and the bot paid 5 M€ a delegate while its free one stood
 *    in the lobby for half a generation.
 *  - `placeBotGrantDelegate` — a delegate an EFFECT hands the bot (a colony, a
 *    card): the human's grant, from the reserve and free; never the lobby
 *    (that cube is the generation's free vote, and a bonus must not spend it).
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
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {VoteRefusal} from '../parliament/Parliament';
import {BotVoteChoice, chooseVoteSlot} from '../parliament/BotVoteChooser';
import {QuestTracker} from '../parliament/quests/QuestTracker';
import {AutomaTurnLog} from './AutomaTurnLog';

export type BotVote =
  | {placed: true; choice: BotVoteChoice; source: 'lobby' | 'reserve'; cost: number}
  /** The vote did not happen — the CALLER writes its own journal line for the refusal (it knows the rule that asked). */
  | {placed: false; refusal: VoteRefusal};

/** THE BOT TAKES THE VOTE: the human's rule of the vote decides the source and the price, the chooser the card. */
export function castBotVote(game: IGame, bot: IPlayer): BotVote {
  const parliament = game.parliament;
  if (parliament === undefined) {
    return {placed: false, refusal: 'no-seat'};
  }
  const availability = parliament.canVote(bot);
  if (!availability.ok) {
    return {placed: false, refusal: availability.code};
  }
  // The bot pays in M€ alone — no heat, no alternative tender (the human's bill may offer them; the bot has no bill).
  if (availability.cost > bot.stock.get(Resource.MEGACREDITS)) {
    return {placed: false, refusal: 'not-enough-mc'};
  }
  const choice = seatBotDelegate(game, bot, availability.source, availability.cost);
  return {placed: true, choice, source: availability.source, cost: availability.cost};
}

/** A delegate an EFFECT grants the bot — from the reserve, free (the caller has checked the reserve). */
export function placeBotGrantDelegate(game: IGame, bot: IPlayer): BotVoteChoice {
  return seatBotDelegate(game, bot, 'reserve', 0);
}

function seatBotDelegate(game: IGame, bot: IPlayer, source: 'lobby' | 'reserve', cost: number): BotVoteChoice {
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
  if (cost > 0) {
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
