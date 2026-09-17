import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {dummyResolutionId, TEST_CHOICE_RESOLUTION_ID} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {PARLIAMENT_VOTING_SLOTS, REDUX_PARTIES, resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {Phase} from '../../src/common/Phase';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {cast} from '../../src/common/utils/utils';
import {finishGeneration, maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Every player passes; the engine runs production → the parliament → the next generation. */
function endGeneration(game: IGame): void {
  game.playersInGenerationOrder.forEach((player) => {
    game.playerHasPassed(player);
    game.playerIsFinishedTakingActions();
  });
}

describe('ParliamentPhase', () => {
  it('resolves the vote at the end of the generation: winner, Agenda, popular support, enactment, refresh, lobby', () => {
    const [game, p1, p2, parliament] = reduxGame();
    const slot = parliament.slots[1];
    // THE GENERIC PHASE: the voted card is one whose effect never asks — a
    // real resolution dealt here (a winner's tile) would hold the phase for
    // its answer. The dummy of the dealt card's OWN party keeps every party
    // reading below as it was.
    slot.instance = resolutionInstanceId(dummyResolutionId(parliament.resolutionOf(slot.instance).party, 1), 0);
    const winnerParty = parliament.resolutionOf(slot.instance).party;
    const loserParties = parliament.partiesInVotingArea().filter((party) => party !== winnerParty);
    const loserWithVote = parliament.slots[2];
    const loserWithVoteParty = parliament.resolutionOf(loserWithVote.instance).party;
    parliament.placeVote(p1, slot, 'lobby');
    parliament.placeVote(p1, slot, 'reserve');
    parliament.placeVote(p2, loserWithVote, 'lobby');
    parliament.recordPartyActionUse(p1, PartyName.GREENS);
    const winnerInstance = slot.instance;
    const trBefore = p1.terraformRating;

    finishGeneration(game);

    expect(game.generation).eq(2);
    expect(game.phase).eq(Phase.RESEARCH);
    expect(parliament.phase, 'the phase is over').is.undefined;
    // 1. the winner + its Agenda (step 1 = influence 1, no bonus)
    expect(parliament.enacted).eq(winnerInstance);
    expect(parliament.rulingParty()).eq(winnerParty);
    expect(parliament.agendaOf(p1)).eq(1);
    expect(parliament.agendaOf(p2)).eq(0);
    expect(parliament.influence(p1)).eq(1);
    expect(p1.terraformRating).eq(trBefore);
    // 2. popular support: the absent parties +1, the loser without a player vote +1, the loser with one +2
    for (const party of REDUX_PARTIES) {
      const inArea = loserParties.includes(party) || party === winnerParty;
      const expected = inArea ? (party === winnerParty ? 0 : (party === loserWithVoteParty ? 2 : 1)) : 1;
      // …unless the refresh moved the support onto a freshly dealt card of that party.
      const dealt = parliament.partiesInVotingArea().includes(party);
      if (!dealt) {
        expect(parliament.popularSupportOf(party), `support of ${party}`).eq(expected);
      } else {
        expect(parliament.popularSupportOf(party), `support of ${party} moved onto its new card`).eq(0);
        expect(parliament.neutralVotes(parliament.slotOf(party)), `neutral votes on ${party}`).eq(expected);
      }
    }
    // 3. the enacted card's delegates went home; the quest is now the enacted resolution's
    expect(parliament.votesOf(p1)).eq(0);
    expect(parliament.quest?.source).eq(parliament.resolutionOf(winnerInstance).id);
    expect(parliament.quest?.generation).eq(2);
    expect(parliament.quest?.completedBy).is.undefined;
    // 5. three fresh resolutions of distinct parties, none of the enacted party; the two losers were discarded
    expect(parliament.slots).has.length(PARLIAMENT_VOTING_SLOTS);
    const parties = parliament.partiesInVotingArea();
    expect(new Set(parties).size).eq(PARLIAMENT_VOTING_SLOTS);
    expect(parties).not.includes(winnerParty);
    expect(parliament.discard).includes(loserWithVote.instance);
    // the lobby is refilled, the uses reset, the ledger intact
    expect(parliament.lobby.has(p1.id)).is.true;
    expect(parliament.lobby.has(p2.id)).is.true;
    expect(parliament.partyActionUsesLeft(p1, PartyName.GREENS)).eq(1);
    parliament.assertLedger(game);
    // the summary the client presents
    const summary = parliament.lastPhase!;
    expect(summary.generation).eq(1);
    expect(summary.winner.instance).eq(winnerInstance);
    expect(summary.winner.player).eq(p1.id);
    expect(summary.agenda).deep.eq({player: p1.id, from: 0, to: 1, bonus: undefined});
    expect(summary.enacted).eq(winnerInstance);
    expect(summary.refreshed).has.length(3);
    expect(summary.lobbyRefilled).has.members([p1.id, p2.id]);
  });

  it('a neutral winner moves no Agenda and the second Agenda step pays 1 TR', () => {
    const [game, p1, , parliament] = reduxGame();
    parliament.addNeutralVote(parliament.slots[0]);
    finishGeneration(game);
    expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
    expect(parliament.agendaOf(p1)).eq(0);

    game.phase = Phase.ACTION;
    parliament.agenda.set(p1.id, 1);
    parliament.placeVote(p1, parliament.slots[0], 'lobby');
    const tr = p1.terraformRating;
    finishGeneration(game);
    expect(parliament.agendaOf(p1)).eq(2);
    expect(p1.terraformRating).eq(tr + 1);
    expect(parliament.lastPhase?.agenda?.bonus).eq('tr');
  });

  describe('a resolution that asks (RDX_TEST_CHOICE)', () => {
    /** Seat the test resolution in slot 0 with p1's delegate on it, so p1 wins. */
    function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
      const [game, p1, p2, parliament] = reduxGame();
      parliament.slots[0].instance = resolutionInstanceId(TEST_CHOICE_RESOLUTION_ID, 0);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      p1.megaCredits = 10;
      p2.megaCredits = 10;
      return [game, p1, p2, parliament];
    }

    it('mutates, asks, mutates, asks — player by player — and survives a reload inside every question without paying twice', () => {
      const [game, p1, p2] = stage();
      // The production phase pays TR + M€ production first; the parliament's rewards come on top.
      const base1 = p1.megaCredits + p1.terraformRating + p1.production.megacredits;
      const base2 = p2.megaCredits + p2.terraformRating + p2.production.megacredits;
      endGeneration(game);
      // Step 1 paid 1 M€ to p1; step 2 asks p1.
      let live: IGame = game;
      let one = live.getPlayerById(p1.id);
      expect(live.phase).eq(Phase.PARLIAMENT);
      expect(one.megaCredits).eq(base1 + 1);
      expect(one.getWaitingFor()).is.instanceOf(OrOptions);
      expect(live.parliament!.phase?.effects?.pending).deep.eq({player: p1.id, key: 'choose-plant-or-heat'});

      // RELOAD inside the first question: the prompt is rebuilt, nothing is paid again.
      live = Game.deserialize(structuredClone(live.serialize()));
      one = live.getPlayerById(p1.id);
      expect(live.phase).eq(Phase.PARLIAMENT);
      expect(one.megaCredits).eq(base1 + 1);
      const ask1 = cast(one.getWaitingFor(), OrOptions);
      expect(ask1.options).has.length(2);
      expect(ask1.choiceContext?.source).deep.eq({kind: 'resolution', resolution: TEST_CHOICE_RESOLUTION_ID});
      // p2 is NOT asked yet — the effect visits the players in order.
      expect(live.getPlayerById(p2.id).getWaitingFor()).is.undefined;
      // Answer: plants.
      one.process({type: 'or', index: 0, response: {type: 'option'}});
      expect(one.plants).eq(1);
      expect(one.steel, 'step 3 ran right after the answer').eq(1);
      expect(live.parliament!.phase?.effectState?.[p1.id]?.firstChoice).eq('plant');
      expect(live.parliament!.phase?.effects?.pending).deep.eq({player: p1.id, key: 'choose-card-or-mc'});

      // RELOAD inside the second question.
      live = Game.deserialize(structuredClone(live.serialize()));
      one = live.getPlayerById(p1.id);
      expect(one.steel).eq(1);
      expect(one.plants).eq(1);
      expect(live.parliament!.phase?.effectState?.[p1.id]?.firstChoice, 'the first answer is remembered').eq('plant');
      const ask2 = cast(one.getWaitingFor(), OrOptions);
      one.process({type: 'or', index: 1, response: {type: 'option'}});
      expect(ask2.options[1]).is.instanceOf(SelectOption);
      expect(one.megaCredits).eq(base1 + 3);

      // Now p2's turn: step 1 paid, step 2 asks.
      let two = live.getPlayerById(p2.id);
      expect(two.megaCredits).eq(base2 + 1);
      expect(two.getWaitingFor()).is.instanceOf(OrOptions);
      two.process({type: 'or', index: 1, response: {type: 'option'}});
      expect(two.heat).eq(1);
      expect(two.steel).eq(1);
      live = Game.deserialize(structuredClone(live.serialize()));
      two = live.getPlayerById(p2.id);
      const hand = two.cardsInHand.length;
      two.process({type: 'or', index: 0, response: {type: 'option'}});
      expect(two.cardsInHand.length).eq(hand + 1);

      // The phase finished: refresh, lobby, next generation.
      expect(live.parliament!.phase).is.undefined;
      expect(live.generation).eq(2);
      expect(live.phase).eq(Phase.RESEARCH);
      expect(live.parliament!.enacted).eq(resolutionInstanceId(TEST_CHOICE_RESOLUTION_ID, 0));
      expect(live.parliament!.quest?.source).eq(TEST_CHOICE_RESOLUTION_ID);
      // Every effect key was applied exactly once.
      const summary = live.parliament!.lastPhase!;
      expect(summary.winner.player).eq(p1.id);
      expect(live.getPlayerById(p1.id).megaCredits).eq(base1 + 3);
      expect(live.getPlayerById(p2.id).megaCredits).eq(base2 + 1);
    });

    it('the effect never asks a seat that takes no part (MarsBot)', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      parliament.slots[0].instance = resolutionInstanceId(TEST_CHOICE_RESOLUTION_ID, 0);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(human.getWaitingFor()).is.instanceOf(OrOptions);
      human.process({type: 'or', index: 0, response: {type: 'option'}});
      expect(bot.getWaitingFor()).is.undefined;
      human.process({type: 'or', index: 1, response: {type: 'option'}});
      expect(bot.getWaitingFor()).is.undefined;
      expect(parliament.phase).is.undefined;
      expect(game.generation).eq(2);
    });
  });

  describe('the final generation (decision Q1)', () => {
    it('runs winner, Agenda and enactment, skips the refresh and the lobby, then goes to the final greeneries', () => {
      const [game, p1, , parliament] = reduxGame();
      setTemperature(game, 8);
      setOxygenLevel(game, 14);
      maxOutOceans(p1);
      expect(game.gameIsOver()).is.true;
      const winner = parliament.slots[0];
      parliament.placeVote(p1, winner, 'lobby');
      const slotsBefore = parliament.slots.map((slot) => slot.instance);
      endGeneration(game);
      runAllActions(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.enacted).eq(winner.instance);
      expect(parliament.agendaOf(p1)).eq(1);
      expect(parliament.lastPhase?.final).is.true;
      // No refresh: the two losers stay where they were, nothing was dealt, the lobby was not refilled.
      expect(parliament.slots.map((slot) => slot.instance)).deep.eq(slotsBefore.slice(1));
      expect(parliament.lastPhase?.refreshed).deep.eq([]);
      expect(parliament.lobby.has(p1.id)).is.false;
      // The game moved on to the final greenery placement.
      expect(game.phase).eq(Phase.PRODUCTION);
      expect(game.generation).eq(1);
      expect(game.isDoneWithFinalProduction()).is.true;
    });
  });

  describe('with MarsBot (BotParliamentMode none)', () => {
    it('plays several generations: the bot takes its turns, holds no delegates, gets no effects and is never asked', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      expect(parliament.participates(bot)).is.false;
      expect(parliament.participates(human)).is.true;
      expect(parliament.lobby.has(bot.id)).is.false;
      expect(parliament.reserve(bot)).eq(0);
      expect(parliament.hasPartyEffect(bot, PartyName.GREENS)).is.false;
      expect(parliament.hasPartyEffect(human, PartyName.GREENS)).is.true;

      game.playerIsFinishedWithResearchPhase(human);
      for (let generation = 1; generation <= 5; generation++) {
        expect(game.generation).eq(generation);
        expect(game.phase).eq(Phase.ACTION);
        // The human votes once with the free delegate, then passes.
        const menu = human.popWaitingFor();
        expect(menu).is.not.undefined;
        const slot = parliament.slots[generation % parliament.slots.length];
        if (parliament.lobby.has(human.id)) {
          parliament.placeVote(human, slot, 'lobby');
        }
        game.playerHasPassed(human);
        game.playerIsFinishedTakingActions();
        // A REAL resolution may ask the HUMAN inside the phase (Aquifer
        // Contest's winner places an ocean; a payout picks a card) — the bot
        // is never asked, and the human's answers move the phase on.
        for (let guard = 0; guard < 4 && game.phase === Phase.PARLIAMENT; guard++) {
          const wf = human.getWaitingFor();
          if (wf instanceof SelectSpace) {
            human.process({type: 'space', spaceId: wf.spaces[0].id});
          } else if (wf instanceof SelectCard) {
            human.process({type: 'card', cards: [wf.cards[0].name]});
          } else {
            break;
          }
          runAllActions(game);
        }
        expect(bot.getWaitingFor(), `bot prompt in generation ${generation}`).is.undefined;
        expect(game.generation).eq(generation + 1);
        expect(game.phase).eq(Phase.RESEARCH);
        expect(parliament.phase).is.undefined;
        expect(parliament.enacted).is.not.undefined;
        expect(parliament.lobby.has(human.id)).is.true;
        expect(parliament.lobby.has(bot.id)).is.false;
        expect(parliament.reserve(bot)).eq(0);
        parliament.assertLedger(game);
        human.popWaitingFor();
        game.playerIsFinishedWithResearchPhase(human);
      }
      expect(game.generation).eq(6);
      expect(parliament.quest?.generation).eq(6);
      // The bot holds no political state whatsoever.
      expect(parliament.agendaOf(bot)).eq(0);
      expect(parliament.chairman).not.eq(bot.id);
      expect(parliament.votesOf(bot)).eq(0);
    });
  });
});
