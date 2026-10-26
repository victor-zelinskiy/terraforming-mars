/*
 * THE BOT'S DELEGATE, PLACED — two doors and one body, so the ledger, the
 * journal, the quest and the turn script read the same move:
 *
 *  - `castBotVote` — THE VOTE. Both of the bot's political rules come through
 *    it (Party Politics' one delegate a generation, the lobbying mandate's
 *    further ones), and those rules decide only WHEN and HOW MANY. FROM WHERE
 *    is the human's own rule (`Parliament.voteSource`, D12): the lobby's
 *    delegate first, then the reserve — the lobby never stands idle while the
 *    reserve is spent. AT WHAT PRICE: none (D14) — the bot's M€ are its late
 *    score (8 M€/VP early, down to 1 M€/VP) and a resolution never pays it,
 *    so a paid delegate was a sure loss of points; Party Politics' official
 *    first delegate is free too. WHETHER AT ALL (D15): the lobby's delegate
 *    ALWAYS goes; a reserve delegate only while it can still change the
 *    outcome — once it is a FACT that the vote is the bot's, or beyond its
 *    reach, the bot KEEPS it (`botVoteHold` over `BotVoteStakes.ts`).
 *  - `placeBotGrantDelegate` — a delegate an EFFECT hands the bot (a colony, a
 *    card): the human's grant, from the reserve and free; never the lobby
 *    (that cube is the generation's free vote, and a bonus must not spend it).
 *
 * The placement IS the human's: `Parliament.placeVote` with a real sequence
 * number (the tie of the lead reads it), the same journal lines a human's
 * vote writes, the same `QuestTracker.report` («send N delegates»), the
 * ledger asserted after it. The card is the chooser's (§3.3), never a roll;
 * what the chooser decided rides the turn script as a typed `vote` step so
 * the turn review explains the move from DATA.
 */
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {VoteRefusal} from '../parliament/Parliament';
import {BotVoteChoice, chooseVoteSlot} from '../parliament/BotVoteChooser';
import {QuestTracker} from '../parliament/quests/QuestTracker';
import {AutomaTurnLog} from './AutomaTurnLog';
import {voteStakes} from './BotVoteStakes';
import type {BotVoteHold} from './LobbyMandate';

/** Why the bot's vote did not happen — never the money (its delegates are free); a HOLD is the bot keeping it (D15). */
export type BotVoteRefusal = Exclude<VoteRefusal, 'not-enough-mc'> | BotVoteHold;

/**
 * Does the bot KEEP its next delegate? (`budget` — every delegate it may still send, this one included.) Only a
 * delegate from the RESERVE is ever kept, and only on a FACT that it changes nothing (`voteStakes`). The LOBBY's
 * delegate always goes (the owner, 2026-10-26: «бесплатный на то и бесплатный, чтобы его всегда отправлять»):
 * it is every seat's free vote of the generation — kept, it is simply a vote thrown away, and a bot that leaves
 * its free cube standing reads as stuck. No delegate to send at all is the refusal's to name, never a hold.
 */
export function botVoteHold(game: IGame, bot: IPlayer, budget: number): BotVoteHold | undefined {
  const from = game.parliament?.voteSource(bot);
  if (from === undefined || !from.ok || from.source === 'lobby') {
    return undefined;
  }
  const stakes = voteStakes(game, bot, budget);
  switch (stakes.kind) {
  case 'decided':
    return 'vote-decided';
  case 'out-of-reach':
    return 'out-of-reach';
  default:
    return undefined;
  }
}

export type BotVote =
  | {placed: true; choice: BotVoteChoice; source: 'lobby' | 'reserve'}
  /** The vote did not happen — the CALLER writes its own journal line for the refusal (it knows the rule that asked). */
  | {placed: false; refusal: BotVoteRefusal};

/**
 * THE BOT TAKES THE VOTE: the human's rule of the vote decides the source, the chooser the card; it costs nothing.
 * `budget` — every delegate the bot may still send this generation, this one included: what the stakes judge
 * «out of reach» against.
 */
export function castBotVote(game: IGame, bot: IPlayer, budget: number): BotVote {
  const parliament = game.parliament;
  if (parliament === undefined) {
    return {placed: false, refusal: 'no-seat'};
  }
  const from = parliament.voteSource(bot);
  if (!from.ok) {
    return {placed: false, refusal: from.code};
  }
  const hold = botVoteHold(game, bot, budget);
  if (hold !== undefined) {
    return {placed: false, refusal: hold};
  }
  const choice = seatBotDelegate(game, bot, from.source);
  return {placed: true, choice, source: from.source};
}

/** A delegate an EFFECT grants the bot — from the reserve, free (the caller has checked the reserve). */
export function placeBotGrantDelegate(game: IGame, bot: IPlayer): BotVoteChoice {
  return seatBotDelegate(game, bot, 'reserve');
}

function seatBotDelegate(game: IGame, bot: IPlayer, source: 'lobby' | 'reserve'): BotVoteChoice {
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
    cost: 0,
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
