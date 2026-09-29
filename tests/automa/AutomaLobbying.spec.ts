import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {MarsBotTurn, MarsBotTurnStep} from '../../src/common/automa/MarsBotTurn';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {Phase} from '../../src/common/Phase';
import {PARLIAMENT_VOTE_COST} from '../../src/common/parliament/ParliamentTypes';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {LOBBYING_DIVISOR, LOBBYING_DOUBLE_DIVISOR, lobbyingDelegates} from '../../src/server/automa/AutomaLobbying';
import {SolarLogistics} from '../../src/server/cards/promo/SolarLogistics';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {COLONIZATION_FUNDING_ID} from '../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {seatResolution} from '../parliament/parliamentArrange';
import {TestPlayer} from '../TestPlayer';
import {fakeCard, runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

/**
 * LOBBYING (docs/TURMOIL_REDUX_MARSBOT.md §3.2): a played project card whose cost
 * is divisible by 3 sends ONE paid delegate from the reserve after the card
 * resolved; divisible by 9 — two. The probe cards are REAL ones of the Redux
 * table's decks (probed, never assumed): Gene Repair 12 · Aquifer Pumping 18 ·
 * Predators 14 · Indentured Workers 0 · Micro-Mills 3 (no tags) · Big Asteroid
 * 27 (a Space EVENT — Solar Logistics' trigger).
 */
function reduxBot(seed = 0) {
  return testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics', seed});
}

function arrange(game: IGame, human: TestPlayer, botMegacredits = 20): void {
  const parliament = game.parliament!;
  game.playerIsFinishedWithResearchPhase(human);
  seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
  seatResolution(parliament, 1, CENTRAL_POWER_GRID_ID);
  seatResolution(parliament, 2, COLONIZATION_FUNDING_ID);
  parliament.slots.forEach((slot) => (slot.votes = []));
  game.players.find((p) => p.isMarsBot)!.megaCredits = botMegacredits;
}

/** The bot plays exactly `name` this turn; the human's turn ends without a pass. */
function botPlays(game: IGame, human: TestPlayer, name: CardName): MarsBotTurn {
  game.automa!.actionDeck = [{kind: 'project', name}];
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

function lobbyingLines(game: IGame): number {
  return game.gameLog.filter((m) => m.message === '${0} lobbies: the cost of ${1} (${2} M€) is divisible by ${3}').length;
}

describe('Lobbying (Turmoil Redux) — the bot\'s paid delegates', () => {
  it('the knobs and the arithmetic: 0 divides; 9 doubles', () => {
    expect(LOBBYING_DIVISOR).eq(3);
    expect(LOBBYING_DOUBLE_DIVISOR).eq(9);
    expect([0, 1, 3, 9, 12, 14, 18, 21, 27].map(lobbyingDelegates)).deep.eq([2, 0, 1, 2, 1, 0, 2, 1, 2]);
  });

  it('cost 12 → ONE delegate from the RESERVE for 5 M€ — the lobby\'s free delegate is not touched', () => {
    const [game, human, bot] = reduxBot();
    const parliament = game.parliament!;
    arrange(game, human, 20);
    const turn = botPlays(game, human, CardName.GENE_REPAIR);
    expect(bot.megaCredits).eq(20 - PARLIAMENT_VOTE_COST);
    expect(parliament.lobby.has(bot.id), 'the free delegate stays in the lobby').is.true;
    expect(parliament.reserve(bot)).eq(5);
    expect(parliament.votesOf(bot)).eq(1);
    expect(parliament.winner()?.player).eq(bot.id);
    expect(lobbyingLines(game)).eq(1);
    const votes = voteSteps(turn);
    expect(votes).has.length(1);
    expect(votes[0]).deep.include({source: 'reserve', cost: PARLIAMENT_VOTE_COST, slot: 0, winsNow: true, deficit: 1});
    expect(votes[0].cause).deep.eq({kind: 'lobbying'});
    expect(votes[0].message?.message).eq('${0} sent a delegate from the reserve to ${1}');
    // The card itself was played once, as ever: its tag advanced the track and it went to the played pile.
    expect(game.automa!.playedPile).deep.eq([CardName.GENE_REPAIR]);
    // The lobbying comes AFTER the tags — the trail of steps says so.
    const kinds = turn.steps.map((s) => s.kind);
    expect(kinds.indexOf('vote')).greaterThan(kinds.lastIndexOf('advance'));
    parliament.assertLedger(game);
  });

  it('cost 18 → TWO delegates, 5 M€ each, the list re-read for the second: it stacks the card the first one won', () => {
    const [game, human, bot] = reduxBot();
    const parliament = game.parliament!;
    arrange(game, human, 20);
    const turn = botPlays(game, human, CardName.AQUIFER_PUMPING);
    expect(bot.megaCredits).eq(20 - 2 * PARLIAMENT_VOTE_COST);
    expect(parliament.reserve(bot)).eq(4);
    expect(parliament.votesOf(bot, parliament.slots[0])).eq(2);
    const votes = voteSteps(turn);
    expect(votes).has.length(2);
    expect(votes[0]).deep.include({slot: 0, rules: ['win-now', 'nearest-slot'], winsNow: true});
    expect(votes[1]).deep.include({slot: 0, rules: ['win-now'], winsNow: true});
    expect(lobbyingLines(game)).eq(1);
    parliament.assertLedger(game);
  });

  it('cost 14 → nothing: no line, no delegate, the M€ untouched', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 20);
    const turn = botPlays(game, human, CardName.PREDATORS);
    expect(bot.megaCredits).eq(20);
    expect(game.parliament!.votesOf(bot)).eq(0);
    expect(lobbyingLines(game)).eq(0);
    expect(voteSteps(turn)).deep.eq([]);
    expect(refusals(turn)).deep.eq([]);
  });

  it('cost 0 divides by 9 → two delegates (the rule\'s own arithmetic: 0 is a multiple of everything)', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 20);
    const turn = botPlays(game, human, CardName.INDENTURED_WORKERS);
    expect(voteSteps(turn)).has.length(2);
    expect(bot.megaCredits).eq(10);
  });

  it('4 M€ → «not enough M€»: a line with the reason, no delegate, nothing spent', () => {
    const [game, human, bot] = reduxBot();
    const parliament = game.parliament!;
    arrange(game, human, 4);
    const turn = botPlays(game, human, CardName.GENE_REPAIR);
    expect(bot.megaCredits).eq(4);
    expect(parliament.votesOf(bot)).eq(0);
    expect(parliament.reserve(bot)).eq(6);
    expect(lobbyingLines(game), 'the trigger is announced').eq(1);
    expect(voteSteps(turn)).deep.eq([]);
    expect(refusals(turn)).has.length(1);
    expect(refusals(turn)[0]).deep.include({reason: 'not-enough-mc', cause: {kind: 'lobbying'}});
    expect(refusals(turn)[0].message?.message).eq('${0} cannot lobby: not enough M€ for a delegate (${1} M€)');
  });

  it('with 7 M€ and a cost divisible by 9: the first delegate is paid, the second refused — and the refusal names the money', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 7);
    const turn = botPlays(game, human, CardName.AQUIFER_PUMPING);
    expect(bot.megaCredits).eq(2);
    expect(voteSteps(turn)).has.length(1);
    expect(refusals(turn)).has.length(1);
    expect(refusals(turn)[0].reason).eq('not-enough-mc');
  });

  it('an empty RESERVE → «no delegate left in the reserve», nothing spent', () => {
    const [game, human, bot] = reduxBot();
    const parliament = game.parliament!;
    arrange(game, human, 20);
    for (let i = 0; i < 6; i++) {
      parliament.placeVote(bot, parliament.slots[i % 3], 'reserve');
    }
    expect(parliament.reserve(bot)).eq(0);
    expect(parliament.lobby.has(bot.id)).is.true;
    const turn = botPlays(game, human, CardName.GENE_REPAIR);
    expect(bot.megaCredits).eq(20);
    expect(parliament.lobby.has(bot.id), 'the lobby delegate is Party Politics\' — never lobbying\'s').is.true;
    expect(refusals(turn)[0]).deep.include({reason: 'no-delegate'});
    expect(refusals(turn)[0].message?.message).eq('${0} cannot lobby: no delegate left in the reserve');
  });

  it('an EMPTY voting area → «no resolution is up for a vote»', () => {
    const [game, human, bot] = reduxBot();
    const parliament = game.parliament!;
    arrange(game, human, 20);
    parliament.deck.push(...parliament.slots.map((slot) => slot.instance));
    parliament.slots = [];
    const turn = botPlays(game, human, CardName.GENE_REPAIR);
    expect(bot.megaCredits).eq(20);
    expect(refusals(turn)[0]).deep.include({reason: 'no-resolution'});
  });

  it('a BONUS card never lobbies (it has no cost)', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 20);
    human.plants = 5;
    game.automa!.actionDeck = [{kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}];
    human.popWaitingFor();
    game.playerIsFinishedTakingActions();
    runAllActions(game);
    expect(human.plants).eq(0);
    expect(bot.megaCredits).eq(20);
    expect(lobbyingLines(game)).eq(0);
    expect(voteSteps(game.automa!.lastTurn!)).deep.eq([]);
  });

  it('a Failed-Action card (no tags, cost 3) still lobbies: the card was played, its cost is printed', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 20);
    const turn = botPlays(game, human, CardName.MICRO_MILLS);
    expect(turn.steps.some((s) => s.kind === 'failed' && s.reason === 'no-tags')).is.true;
    expect(voteSteps(turn)).has.length(1);
    // +5 M€ of the Failed Action, −5 M€ of the delegate.
    expect(bot.megaCredits).eq(20);
    expect(game.parliament!.votesOf(bot)).eq(1);
  });

  it('the human reactors fire ONCE for the card, and not again for the lobbying: Solar Logistics on Big Asteroid (27 → two delegates)', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 20);
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
    const turn = botPlays(game, human, CardName.BIG_ASTEROID);
    expect(voteSteps(turn)).has.length(2);
    // The spec's default corporation is C01 Credicor: +4 M€ for a card of 20+ M€ — then two delegates at 5 M€ each.
    expect(bot.megaCredits).eq(20 + 4 - 2 * PARLIAMENT_VOTE_COST);
    expect(anyPlayer, 'one play, one reaction').eq(1);
    expect(human.pendingCardIntakes, 'Solar Logistics: one intake for one space event').has.length(1);
  });

  it('a save after the turn reloads with the delegates where they were, the ledger whole', () => {
    const [game, human, bot] = reduxBot();
    arrange(game, human, 20);
    botPlays(game, human, CardName.AQUIFER_PUMPING);
    const reloaded = Game.deserialize(structuredClone(game.serialize()));
    const parliament = reloaded.parliament!;
    const loadedBot = reloaded.getPlayerById(bot.id);
    expect(parliament.votesOf(loadedBot)).eq(2);
    expect(parliament.reserve(loadedBot)).eq(4);
    expect(parliament.lobby.has(loadedBot.id)).is.true;
    expect(loadedBot.megaCredits).eq(10);
    expect(() => parliament.assertLedger(reloaded)).not.to.throw();
    const lastTurn = reloaded.automa!.lastTurn!;
    expect(voteSteps(lastTurn)).has.length(2);
  });

  it("mode 'none' (an observer bot): a divisible cost lobbies nothing", () => {
    const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
    game.playerIsFinishedWithResearchPhase(human);
    bot.megaCredits = 20;
    const turn = botPlays(game, human, CardName.GENE_REPAIR);
    expect(bot.megaCredits).eq(20);
    expect(lobbyingLines(game)).eq(0);
    expect(voteSteps(turn)).deep.eq([]);
    expect(refusals(turn)).deep.eq([]);
  });

  describe('measured — what the knobs mean over the REAL project deck of the Redux table', () => {
    it('prints the share of cards whose cost the divisor and the double divisor select; both strictly inside (0, 1)', () => {
      const [game] = testAutomaGame({
        coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true, preludeExtension: true,
        promoCardsOption: true, aresExtension: true,
      });
      const deck = game.projectDeck.drawPile;
      const total = deck.length;
      const single = deck.filter((card) => lobbyingDelegates(card.cost) >= 1).length;
      const double = deck.filter((card) => lobbyingDelegates(card.cost) === 2).length;
      console.log(`      [lobbying] project deck ${total} cards: divisible by ${LOBBYING_DIVISOR} → ${single} (${(100 * single / total).toFixed(1)} %), ` +
        `by ${LOBBYING_DOUBLE_DIVISOR} → ${double} (${(100 * double / total).toFixed(1)} %)`);
      expect(total).greaterThan(100);
      expect(single / total).greaterThan(0).and.lessThan(1);
      expect(double / total).greaterThan(0).and.lessThan(single / total);
      // …and the wider table (every project deck the Redux table can hold) is what the phase is measured on: the human's
      // ten and the bot's opening cards left the pile before the count, a handful against several hundred.
      expect(game.phase).eq(Phase.RESEARCH);
    });
  });
});
