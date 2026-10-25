import {expect} from 'chai';
import {AutomaActionCard} from '../../src/server/automa/AutomaState';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {MarsBotTurn, MarsBotTurnStep} from '../../src/common/automa/MarsBotTurn';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {Phase} from '../../src/common/Phase';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {AutomaLobbying} from '../../src/server/automa/AutomaLobbying';
import {LOBBYING_DIVISOR, LobbyMandateCard, lobbyingTrigger} from '../../src/server/automa/LobbyMandate';
import {SolarLogistics} from '../../src/server/cards/promo/SolarLogistics';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {COLONIZATION_FUNDING_ID} from '../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {seatResolution} from '../parliament/parliamentArrange';
import {TestPlayer} from '../TestPlayer';
import {fakeCard, runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

/**
 * LOBBYING (docs/TURMOIL_REDUX_MARSBOT.md §3.2, D14): the generation's hidden
 * MANDATE says how many further delegates the bot sends; a played project card
 * whose cost is divisible by 3 sends one of them, and what the cards still in
 * the action deck could no longer carry at two a turn is sent at once. Every
 * delegate is free and takes the human's source — the lobby first, then the
 * reserve. The probe cards are REAL ones of the Redux table's decks: Gene
 * Repair 12 · Predators 14 · Power Plant 4 · Micro-Mills 3 (no tags).
 */
function reduxBot(seed = 0) {
  return testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics', seed});
}

/** The voting area pinned, no delegate on it, the bot's M€ set, the generation's mandate PINNED (never the draw). */
function arrange(game: IGame, human: TestPlayer, mandate: LobbyMandateCard, botMegacredits = 20): void {
  const parliament = game.parliament!;
  game.playerIsFinishedWithResearchPhase(human);
  seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
  seatResolution(parliament, 1, CENTRAL_POWER_GRID_ID);
  seatResolution(parliament, 2, COLONIZATION_FUNDING_ID);
  parliament.slots.forEach((slot) => (slot.votes = []));
  game.players.find((p) => p.isMarsBot)!.megaCredits = botMegacredits;
  game.automa!.lobbyMandate = {generation: game.generation, card: mandate, sent: 0};
}

const project = (name: CardName): AutomaActionCard => ({kind: 'project', name});
/** Two cards ahead: room for four more delegates — the pace may wait. */
const TWO_AHEAD: ReadonlyArray<AutomaActionCard> = [project(CardName.POWER_PLANT), project(CardName.PREDATORS)];

/** The bot plays `first` this turn (with `ahead` still in its deck); the human's turn ends without a pass. */
function botTurn(game: IGame, human: TestPlayer, first: AutomaActionCard, ahead: ReadonlyArray<AutomaActionCard> = []): MarsBotTurn {
  game.automa!.actionDeck = [first, ...ahead];
  human.popWaitingFor();
  game.playerIsFinishedTakingActions();
  runAllActions(game);
  return game.automa!.lastTurn!;
}

function voteSteps(turn: MarsBotTurn): Array<Extract<MarsBotTurnStep, {kind: 'vote'}>> {
  return turn.steps.filter((s): s is Extract<MarsBotTurnStep, {kind: 'vote'}> => s.kind === 'vote');
}

function refusals(turn: MarsBotTurn): Array<Extract<MarsBotTurnStep, {kind: 'vote-refused'}>> {
  return turn.steps.filter((s): s is Extract<MarsBotTurnStep, {kind: 'vote-refused'}> => s.kind === 'vote-refused');
}

function lines(game: IGame, message: string): number {
  return game.gameLog.filter((m) => m.message === message).length;
}
const TRIGGER_LINE = '${0} lobbies: the cost of ${1} (${2} M€) is divisible by ${3}';
const MANDATE_LINE = '${0} lobbies: its mandate for this generation';
const REVEAL_LINE = '${0} reveals its lobbying mandate for this generation: ${1} delegate(s), ${2} sent';
const REVEAL_ALL_LINE = '${0} reveals its lobbying mandate for this generation: all its delegates, ${1} sent';


describe('Lobbying (Turmoil Redux) — the generation\'s mandate, paced by the bot\'s cards, free', () => {
  it('the divisor is the official generator', () => {
    expect(LOBBYING_DIVISOR).eq(3);
    expect(lobbyingTrigger(12)).is.true;
    expect(lobbyingTrigger(14)).is.false;
  });

  it('mandate 0 → a cost divisible by 3 sends nothing (Party Politics alone this generation)', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 0);
    const turn = botTurn(game, human, project(CardName.GENE_REPAIR), TWO_AHEAD);
    expect(game.parliament!.votesOf(bot)).eq(0);
    expect(voteSteps(turn)).deep.eq([]);
    expect(lines(game, TRIGGER_LINE)).eq(0);
  });

  it('mandate 1 + cost 12 → ONE delegate, the LOBBY\'S, free; the trigger named', () => {
    const [game, human, bot] = reduxBot();
    const parliament = game.parliament!;
    arrange(game, human, 1);
    const turn = botTurn(game, human, project(CardName.GENE_REPAIR), TWO_AHEAD);
    expect(bot.megaCredits, 'a delegate costs the bot nothing').eq(20);
    expect(parliament.lobby.has(bot.id), 'the lobby is spent first').is.false;
    expect(parliament.reserve(bot)).eq(6);
    const votes = voteSteps(turn);
    expect(votes).has.length(1);
    expect(votes[0]).deep.include({source: 'lobby', cost: 0, slot: 0, winsNow: true});
    expect(votes[0].cause).deep.eq({kind: 'lobbying'});
    expect(lines(game, TRIGGER_LINE)).eq(1);
    expect(lines(game, MANDATE_LINE)).eq(0);
    expect(game.automa!.lobbyMandate).deep.include({sent: 1});
    // The card itself was played once, as ever, and the lobbying comes AFTER its tags.
    expect(game.automa!.playedPile).deep.eq([CardName.GENE_REPAIR]);
    const kinds = turn.steps.map((s) => s.kind);
    expect(kinds.indexOf('vote')).greaterThan(kinds.lastIndexOf('advance'));
    parliament.assertLedger(game);
  });

  it('mandate 1 + cost 14 with room ahead → the bot WAITS (no trigger, nothing owed yet)', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 1);
    const turn = botTurn(game, human, project(CardName.PREDATORS), TWO_AHEAD);
    expect(game.parliament!.votesOf(bot)).eq(0);
    expect(voteSteps(turn)).deep.eq([]);
  });

  it('mandate 1 + cost 14 on the LAST card → the catch-up sends it now, named as the mandate', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 1);
    const turn = botTurn(game, human, project(CardName.PREDATORS));
    expect(game.parliament!.votesOf(bot)).eq(1);
    expect(voteSteps(turn)[0]).deep.include({source: 'lobby', cost: 0});
    expect(lines(game, MANDATE_LINE)).eq(1);
    expect(lines(game, TRIGGER_LINE)).eq(0);
  });

  it('mandate ALL + cost 12 with two cards ahead → TWO at once (the trigger and the catch-up): the lobby\'s, then the reserve\'s, both free', () => {
    const [game, human, bot] = reduxBot();
    const parliament = game.parliament!;
    arrange(game, human, 'all');
    const turn = botTurn(game, human, project(CardName.GENE_REPAIR), TWO_AHEAD);
    const votes = voteSteps(turn);
    expect(votes).has.length(2);
    expect(votes.map((v) => [v.source, v.cost])).deep.eq([['lobby', 0], ['reserve', 0]]);
    expect(bot.megaCredits).eq(20);
    expect(parliament.reserve(bot)).eq(5);
    expect(lines(game, TRIGGER_LINE)).eq(1);
    expect(lines(game, MANDATE_LINE)).eq(1);
    parliament.assertLedger(game);
  });

  it('never more than TWO a turn — mandate ALL on the last card sends two, not six', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 'all');
    const turn = botTurn(game, human, project(CardName.PREDATORS));
    expect(voteSteps(turn)).has.length(2);
    expect(game.parliament!.votesOf(bot)).eq(2);
  });

  it('0 M€ changes nothing — the bot\'s delegates are free from the reserve too', () => {
    const [game, human, bot] = reduxBot();
    const parliament = game.parliament!;
    arrange(game, human, 2, 0);
    parliament.lobby.delete(bot.id);
    const turn = botTurn(game, human, project(CardName.PREDATORS));
    expect(voteSteps(turn).map((v) => [v.source, v.cost])).deep.eq([['reserve', 0], ['reserve', 0]]);
    expect(bot.megaCredits).eq(0);
    expect(refusals(turn)).deep.eq([]);
  });

  it('a BONUS card\'s turn may owe the catch-up too (it never triggers, but the deck ahead is short)', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 2);
    human.plants = 5;
    const turn = botTurn(game, human, {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER});
    expect(voteSteps(turn)).has.length(2);
    expect(game.parliament!.votesOf(bot)).eq(2);
    expect(lines(game, MANDATE_LINE)).eq(1);
  });

  it('Party Politics\' own delegate takes one of the turn\'s two places — at most ONE of the mandate beside it', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 3);
    const turn = botTurn(game, human, {kind: 'bonus', id: BonusCardId.B21_PARTY_POLITICS});
    const votes = voteSteps(turn);
    expect(votes).has.length(2);
    expect(votes[0]).deep.include({source: 'lobby', cost: 0});
    expect(votes[0].cause).deep.eq({kind: 'bonus'});
    expect(votes[1]).deep.include({source: 'reserve', cost: 0});
    expect(votes[1].cause).deep.eq({kind: 'lobbying'});
    expect(game.parliament!.votesOf(bot)).eq(2);
  });

  it('the generation\'s last card tells the mandate — the number and how many went', () => {
    const [game, human] = reduxBot();
    arrange(game, human, 1);
    botTurn(game, human, project(CardName.GENE_REPAIR));
    expect(lines(game, REVEAL_LINE)).eq(1);
    const reveal = game.gameLog.find((m) => m.message === REVEAL_LINE)!;
    expect(reveal.data.slice(1).map((d) => d.value)).deep.eq(['1', '1']);
  });

  it('…and ALL is told as ALL', () => {
    const [game, human] = reduxBot();
    arrange(game, human, 'all');
    botTurn(game, human, project(CardName.GENE_REPAIR));
    expect(lines(game, REVEAL_ALL_LINE)).eq(1);
  });

  it('no delegate left anywhere → ONE named refusal and the mandate lapses (never again on every turn left)', () => {
    const [game, human, bot] = reduxBot();
    const parliament = game.parliament!;
    arrange(game, human, 2);
    for (let i = 0; i < 7; i++) {
      parliament.placeVote(bot, parliament.slots[i % 3], parliament.lobby.has(bot.id) ? 'lobby' : 'reserve');
    }
    const turn = botTurn(game, human, project(CardName.PREDATORS));
    expect(refusals(turn)).has.length(1);
    expect(refusals(turn)[0]).deep.include({reason: 'no-delegate'});
    expect(refusals(turn)[0].message?.message).eq('${0} cannot lobby: no delegate left to send');
    expect(game.automa!.lobbyMandate).deep.include({lapsed: true});
  });

  it('an EMPTY voting area → «no resolution is up for a vote»', () => {
    const [game, human] = reduxBot();
    const parliament = game.parliament!;
    arrange(game, human, 1);
    parliament.deck.push(...parliament.slots.map((slot) => slot.instance));
    parliament.slots = [];
    const turn = botTurn(game, human, project(CardName.GENE_REPAIR), TWO_AHEAD);
    expect(refusals(turn)[0]).deep.include({reason: 'no-resolution'});
  });

  it('an EMPTY reserve with the lobby\'s cube still there → the mandate sends THAT one', () => {
    const [game, human, bot] = reduxBot();
    const parliament = game.parliament!;
    arrange(game, human, 1);
    for (let i = 0; i < 6; i++) {
      parliament.placeVote(bot, parliament.slots[i % 3], 'reserve');
    }
    const turn = botTurn(game, human, project(CardName.GENE_REPAIR), TWO_AHEAD);
    expect(parliament.lobby.has(bot.id), 'the free delegate went').is.false;
    expect(parliament.votesOf(bot)).eq(7);
    expect(voteSteps(turn)[0]).deep.include({source: 'lobby', cost: 0});
    expect(refusals(turn)).deep.eq([]);
    parliament.assertLedger(game);
  });

  it('the human reactors fire ONCE for the card, and not again for the lobbying: Solar Logistics on Big Asteroid (27, mandate ALL → two delegates)', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 'all');
    human.playedCards.push(new SolarLogistics());
    let anyPlayer = 0;
    human.playedCards.push(fakeCard({
      name: 'Any-player watcher' as CardName,
      type: CardType.ACTIVE,
      onCardPlayedByAnyPlayer: () => {
        anyPlayer++;
        return undefined;
      },
    }));
    const turn = botTurn(game, human, project(CardName.BIG_ASTEROID));
    expect(voteSteps(turn)).has.length(2);
    // The spec's default corporation is C01 Credicor: +4 M€ for a card of 20+ M€ — the delegates cost nothing.
    expect(bot.megaCredits).eq(20 + 4);
    expect(anyPlayer, 'one play, one reaction').eq(1);
    expect(human.pendingCardIntakes, 'Solar Logistics: one intake for one space event').has.length(1);
  });

  it('a Failed-Action card (no tags, cost 3) still lobbies: the card was played, its cost is printed', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 1);
    const turn = botTurn(game, human, project(CardName.MICRO_MILLS), TWO_AHEAD);
    expect(turn.steps.some((s) => s.kind === 'failed' && s.reason === 'no-tags')).is.true;
    expect(voteSteps(turn)).has.length(1);
    // +5 M€ of the Failed Action, nothing for the delegate.
    expect(bot.megaCredits).eq(25);
  });

  it('the mandate is drawn once a generation, off a stream of its own — the game\'s RNG does not move', () => {
    const [game, human] = reduxBot();
    game.playerIsFinishedWithResearchPhase(human);
    const before = game.rng.current;
    const first = AutomaLobbying.mandateOf(game);
    expect(game.rng.current, 'the shared RNG untouched').eq(before);
    expect(AutomaLobbying.mandateOf(game)).eq(first);
    game.generation++;
    const next = AutomaLobbying.mandateOf(game);
    expect(next).not.eq(first);
    expect(next.generation).eq(game.generation);
    expect(next.sent).eq(0);
  });

  it('a save mid-generation keeps the mandate and what it sent', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 'all');
    botTurn(game, human, project(CardName.GENE_REPAIR), TWO_AHEAD);
    const reloaded = Game.deserialize(structuredClone(game.serialize()));
    expect(reloaded.automa!.lobbyMandate).deep.eq({generation: game.generation, card: 'all', sent: 2});
    expect(reloaded.parliament!.votesOf(reloaded.getPlayerById(bot.id))).eq(2);
    expect(() => reloaded.parliament!.assertLedger(reloaded)).not.to.throw();
  });

  it("mode 'none' (an observer bot): nothing lobbies, nothing is drawn", () => {
    const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
    game.playerIsFinishedWithResearchPhase(human);
    const turn = botTurn(game, human, project(CardName.GENE_REPAIR));
    expect(voteSteps(turn)).deep.eq([]);
    expect(game.automa!.lobbyMandate).is.undefined;
    expect(game.parliament!.votesOf(bot)).eq(0);
  });

  describe('measured — what the divisor selects over the REAL project deck of the Redux table', () => {
    it('prints the share of cards whose cost triggers lobbying; strictly inside (0, 1)', () => {
      const [game] = testAutomaGame({
        coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true, preludeExtension: true,
        promoCardsOption: true, aresExtension: true,
      });
      const deck = game.projectDeck.drawPile;
      const total = deck.length;
      const triggers = deck.filter((card) => lobbyingTrigger(card.cost)).length;
      console.log(`      [lobbying] project deck ${total} cards: divisible by ${LOBBYING_DIVISOR} → ${triggers} (${(100 * triggers / total).toFixed(1)} %)`);
      expect(total).greaterThan(100);
      expect(triggers / total).greaterThan(0).and.lessThan(1);
      expect(game.phase).eq(Phase.RESEARCH);
    });
  });
});
