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
 * The knobs live in `LobbyMandate.ts`: the mandate deck, the divisor, the
 * delegates a turn. The share of the real project deck the divisor selects is
 * MEASURED and printed by `tests/automa/AutomaLobbying.spec.ts` § measured.
 */
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import {AutomaActionCard} from './AutomaState';
import {BotVoteRefusal, castBotVote} from './AutomaPolitics';
import {AutomaTurnLog} from './AutomaTurnLog';
import {marsBotOf} from './AutomaUtil';
import {
  drawLobbyMandate, LOBBYING_DIVISOR, LobbyMandate, lobbyingThisTurn, lobbyingTrigger, mandateSize, turnCapacity,
} from './LobbyMandate';

export class AutomaLobbying {
  /** The generation's mandate — drawn on the bot's first check of the generation, kept for its turns. */
  public static mandateOf(game: IGame): LobbyMandate {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    if (automa.lobbyMandate === undefined || automa.lobbyMandate.generation !== game.generation) {
      automa.lobbyMandate = {generation: game.generation, card: drawLobbyMandate(game), sent: 0};
    }
    return automa.lobbyMandate;
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
    // Each reason is said: the played card's cost, and the mandate's catch-up beside it.
    if (byTrigger > 0 && card !== undefined) {
      game.log('${0} lobbies: the cost of ${1} (${2} M€) is divisible by ${3}', (b) =>
        b.player(bot).card(card).number(card.cost).number(LOBBYING_DIVISOR));
    }
    if (byMandate > 0) {
      game.log('${0} lobbies: its mandate for this generation', (b) => b.player(bot));
    }
    for (let i = 0; i < count; i++) {
      const vote = castBotVote(game, bot);
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
    if (mandate.card === 'all') {
      game.log('${0} reveals its lobbying mandate for this generation: all its delegates, ${1} sent', (b) => b.player(bot).number(mandate.sent));
    } else {
      game.log('${0} reveals its lobbying mandate for this generation: ${1} delegate(s), ${2} sent', (b) =>
        b.player(bot).number(mandate.card as number).number(mandate.sent));
    }
  }
}

/** The lobbying's own journal line for each way its vote can be refused. */
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
  }
}
