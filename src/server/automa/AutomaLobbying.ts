/*
 * LOBBYING — the bot's further votes (Turmoil Redux, docs/TURMOIL_REDUX_MARSBOT.md
 * §3.2, the owner's decision D14 of 2026-10-25).
 *
 * HOW MANY: the generation's hidden MANDATE (`LobbyMandate.ts` — a card off a
 * deck of 33: none in ~30 % of the generations, ALL the bot's delegates in
 * ~3 %). WHEN: after every card the bot resolves — a project card whose cost
 * is divisible by 3 sends one delegate of the mandate (the official generator,
 * taken from the card the bot ALREADY played: no extra reveal, a full
 * explanation «EVA Mechs, cost 12 — divisible by 3 → a delegate on …»), and
 * whatever the cards still in the action deck could no longer carry at two a
 * turn is sent NOW. AT WHAT PRICE: none — the bot's M€ are its late score and a
 * resolution never pays it (D14); FROM WHERE: the human's rule, the lobby
 * first (`castBotVote`, D12). Never more than two of the bot's delegates a
 * turn, Party Politics' own included.
 *
 * The action deck is hidden from the human (`MarsBotModel.actionDeckSize` is
 * a number) and so is the mandate — until the bot's last card of the
 * generation, when the mandate is told in the journal («… 2 delegates, 2
 * sent»), so the turn review explains the generation after the fact.
 *
 * It is a RIDER of the controller, after the card resolved, inside the same
 * turn and the same journal group, under its own cause (`lobbying`). It is NOT
 * a second resolution of the card: the card was played once (the human
 * reactors fired once), a Failed Action does not cancel it (the card was
 * played, its cost is printed), and a card a BONUS card resolved (R&D's draw)
 * is that card's effect — the controller's branch is the one door.
 *
 * WHETHER AT ALL (D15): a delegate is sent only while it can still change the
 * outcome. Once it is a FACT — nobody else can move a delegate any more — that
 * the vote is the bot's, or out of its reach, the bot KEEPS the rest
 * (`BotVoteStakes.ts`): said once a generation, the mandate standing (a hold is
 * not a refusal — a later change would let the bot vote again), and the
 * reveal at the generation's end says why fewer went than the mandate allowed.
 *
 * The knobs live in `LobbyMandate.ts`: the two anchor tables of the mandate,
 * the divisor, the delegates a turn. The share of the real project deck the divisor selects is
 * MEASURED and printed by `tests/automa/AutomaLobbying.spec.ts` § measured.
 */
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import {AutomaActionCard} from './AutomaState';
import {BotVoteRefusal, botVoteHold, castBotVote} from './AutomaPolitics';
import {botDelegateSupply} from '../parliament/BotVoteChooser';
import {AutomaTurnLog} from './AutomaTurnLog';
import {marsBotOf} from './AutomaUtil';
import {
  BotVoteHold, drawLobbyMandate, LOBBYING_DIVISOR, LobbyMandate, lobbyingThisTurn, lobbyingTrigger, mandateSize, turnCapacity,
} from './LobbyMandate';

export class AutomaLobbying {
  /** The generation's mandate — drawn on the bot's first check of the generation, kept for its turns. */
  public static mandateOf(game: IGame): LobbyMandate {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    if (automa.lobbyMandate === undefined || automa.lobbyMandate.generation !== game.generation) {
      const {card, tempo} = drawLobbyMandate(game);
      automa.lobbyMandate = {generation: game.generation, card, sent: 0, tempo: Math.round(tempo * 100) / 100};
    }
    return automa.lobbyMandate;
  }

  /**
   * EVERY DELEGATE THE BOT MAY STILL SEND THIS GENERATION — what «out of reach» is judged against: the mandate
   * left, Party Politics' own while its card is still ahead in the action deck (`partyPoliticsNow`: its card is
   * the one resolving), never more than the delegates it still has. An upper bound, so a hold on it is a fact.
   */
  public static budgetOf(game: IGame, bot: IPlayer, partyPoliticsNow: boolean): number {
    const parliament = game.parliament;
    if (parliament === undefined) {
      return 0;
    }
    const mandate = AutomaLobbying.mandateOf(game);
    const left = mandate.lapsed === true ? 0 : Math.max(0, mandateSize(mandate.card) - mandate.sent);
    const partyPoliticsAhead = (game.automa?.actionDeck ?? []).some((card) => card.kind === 'bonus' && card.id === BonusCardId.B21_PARTY_POLITICS);
    return Math.min(botDelegateSupply(parliament, bot), left + (partyPoliticsNow || partyPoliticsAhead ? 1 : 0));
  }

  /**
   * THE BOT KEEPS ITS DELEGATE (D15): the journal line once a generation per reason (a later turn's hold is
   * silent), the turn step with it; the mandate is NOT lapsed. Party Politics and the lobbying both say it here,
   * so a turn that holds twice reads one line. Returns whether the line was written.
   */
  public static noteHold(game: IGame, bot: IPlayer, hold: BotVoteHold): boolean {
    const mandate = AutomaLobbying.mandateOf(game);
    if (mandate.held === hold) {
      return false;
    }
    mandate.held = hold;
    if (hold === 'vote-decided') {
      game.log('${0} keeps its delegates: the vote is already decided in its favour', (b) => b.player(bot));
    } else {
      game.log('${0} keeps its delegates: the vote is out of its reach', (b) => b.player(bot));
    }
    AutomaTurnLog.note(game, {kind: 'vote-refused', reason: hold}, {consumeLog: true});
    return true;
  }

  /** The rider: called by the controller once the turn's card resolved (`card` — the played project card, if any). */
  public static afterTurnCard(game: IGame, entry: AutomaActionCard, card: IProjectCard | undefined): void {
    const parliament = game.parliament;
    const automa = game.automa;
    if (parliament === undefined || automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    if (!parliament.participates(bot, 'delegates')) {
      return;
    }
    const mandate = AutomaLobbying.mandateOf(game);
    const previous = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'lobbying'});
    try {
      game.events.withSource({kind: 'parliament'}, () => {
        AutomaLobbying.lobby(game, bot, mandate, entry, card);
        if (automa.actionDeck.length === 0) {
          AutomaLobbying.tellMandate(game, bot, mandate);
        }
      });
    } finally {
      AutomaTurnLog.setCause(game, previous);
    }
  }

  private static lobby(game: IGame, bot: IPlayer, mandate: LobbyMandate, entry: AutomaActionCard, card: IProjectCard | undefined): void {
    if (mandate.lapsed === true) {
      return;
    }
    const left = mandateSize(mandate.card) - mandate.sent;
    const trigger = card !== undefined && lobbyingTrigger(card.cost);
    const {count, byTrigger, byMandate} = lobbyingThisTurn({
      left,
      trigger,
      partyPolitics: entry.kind === 'bonus' && entry.id === BonusCardId.B21_PARTY_POLITICS,
      ahead: turnCapacity(game.automa?.actionDeck ?? []),
    });
    if (count === 0) {
      return;
    }
    // A reserve delegate that can change nothing is kept — asked BEFORE the reasons are said, so a turn that
    // holds never reads «lobbies: …» followed by «keeps its delegates». The lobby's delegate always goes, and no
    // delegate at all is the refusal's to name — both are `botVoteHold`'s own rule, the same one `castBotVote` asks.
    const hold = botVoteHold(game, bot, AutomaLobbying.budgetOf(game, bot, false));
    if (hold !== undefined) {
      AutomaLobbying.noteHold(game, bot, hold);
      return;
    }
    // Each reason is said: the played card's cost, and the mandate's catch-up beside it.
    if (byTrigger > 0 && card !== undefined) {
      game.log('${0} lobbies: the cost of ${1} (${2} M€) is divisible by ${3}', (b) =>
        b.player(bot).card(card).number(card.cost).number(LOBBYING_DIVISOR));
    }
    if (byMandate > 0) {
      game.log('${0} lobbies: its mandate for this generation', (b) => b.player(bot));
    }
    for (let i = 0; i < count; i++) {
      const vote = castBotVote(game, bot, AutomaLobbying.budgetOf(game, bot, false));
      if (!vote.placed && (vote.refusal === 'vote-decided' || vote.refusal === 'out-of-reach')) {
        // The first delegate of the turn decided the vote: the second is kept.
        AutomaLobbying.noteHold(game, bot, vote.refusal);
        return;
      }
      if (!vote.placed) {
        logRefusal(game, bot, vote.refusal);
        AutomaTurnLog.note(game, {kind: 'vote-refused', reason: vote.refusal}, {consumeLog: true});
        // The mandate lapses — a refusal is said ONCE, never again on every turn left.
        mandate.lapsed = true;
        return;
      }
      mandate.sent++;
    }
  }

  /** The generation's last card: the hidden mandate is told, so the review explains the generation. */
  private static tellMandate(game: IGame, bot: IPlayer, mandate: LobbyMandate): void {
    const kept = mandate.sent < mandateSize(mandate.card) ? mandate.held : undefined;
    if (kept !== undefined) {
      AutomaLobbying.tellHeldMandate(game, bot, mandate, kept);
      return;
    }
    if (mandate.card === 'all') {
      game.log('${0} reveals its lobbying mandate for this generation: all its delegates, ${1} sent', (b) => b.player(bot).number(mandate.sent));
    } else {
      game.log('${0} reveals its lobbying mandate for this generation: ${1} delegate(s), ${2} sent', (b) =>
        b.player(bot).number(mandate.card as number).number(mandate.sent));
    }
  }

  /** …and when the bot kept the rest, the reveal says why fewer went than the mandate allowed. */
  private static tellHeldMandate(game: IGame, bot: IPlayer, mandate: LobbyMandate, kept: BotVoteHold): void {
    if (mandate.card === 'all') {
      if (kept === 'vote-decided') {
        game.log('${0} reveals its lobbying mandate for this generation: all its delegates, ${1} sent — it kept the rest, the vote being decided', (b) =>
          b.player(bot).number(mandate.sent));
      } else {
        game.log('${0} reveals its lobbying mandate for this generation: all its delegates, ${1} sent — it kept the rest, the vote being out of its reach', (b) =>
          b.player(bot).number(mandate.sent));
      }
      return;
    }
    const card = mandate.card;
    if (kept === 'vote-decided') {
      game.log('${0} reveals its lobbying mandate for this generation: ${1} delegate(s), ${2} sent — it kept the rest, the vote being decided', (b) =>
        b.player(bot).number(card).number(mandate.sent));
    } else {
      game.log('${0} reveals its lobbying mandate for this generation: ${1} delegate(s), ${2} sent — it kept the rest, the vote being out of its reach', (b) =>
        b.player(bot).number(card).number(mandate.sent));
    }
  }
}

/** The lobbying's own journal line for each way its vote can be refused (a hold is `noteHold`'s). */
function logRefusal(game: IGame, bot: IPlayer, refusal: BotVoteRefusal): void {
  switch (refusal) {
  case 'no-seat':
    // Unreachable past the rider's own seat check; named anyway, so no refusal is ever silent.
    game.log('${0} has no seat at the Mars Parliament: no delegate to send', (b) => b.player(bot));
    return;
  case 'no-resolution':
    game.log('${0} cannot lobby: no resolution is up for a vote', (b) => b.player(bot));
    return;
  case 'no-delegate':
    game.log('${0} cannot lobby: no delegate left to send', (b) => b.player(bot));
    return;
  case 'vote-decided':
  case 'out-of-reach':
    AutomaLobbying.noteHold(game, bot, refusal);
    return;
  }
}
