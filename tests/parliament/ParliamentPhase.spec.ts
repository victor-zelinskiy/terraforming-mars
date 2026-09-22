import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {testGame} from '../TestGame';
import {SerializedGame} from '../../src/server/SerializedGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {compatibleWith, Parliament} from '../../src/server/parliament/Parliament';
import {TEST_CHOICE_RESOLUTION_ID} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {
  answerGate, answerStandingGates, endGenerationThroughParliament, gatePromptOf, passToParliament, quietWinnerIndex, seatQuiet, seatResolution,
  settleParliamentGates,
} from './parliamentArrange';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {Server} from '../../src/server/models/ServerModel';
import {Cloner} from '../../src/server/database/Cloner';
import {IPlayer} from '../../src/server/IPlayer';
import {PlayerId} from '../../src/common/Types';
import {LogMessageType} from '../../src/common/logs/LogMessageType';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {CLOUD_DEVELOPMENT_ID} from '../../src/server/parliament/resolutions/unity/CloudDevelopment';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {PARLIAMENT_VOTING_SLOTS, REDUX_PARTIES, resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {Phase} from '../../src/common/Phase';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {cast} from '../../src/common/utils/utils';
import {maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** A Redux game WITH Venus Next — the deck then holds a FOURTH party's card (Cloud Development, Unity). */
function venusGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/**
 * Replace the card in `index` with a real resolution of its own party whose
 * enactment asks nothing (`seatQuiet`). Every spec whose subject is the PHASE
 * (not a card) uses it: the voting area is dealt at random from a pool that
 * grows with each implemented resolution, so «the card that happened to land
 * here asks nothing» is not something a spec may assume. The party reading
 * stays exactly as dealt.
 */
function quiet(parliament: Parliament, index: number): void {
  seatQuiet(parliament, index);
}

/** Every player passes; production → the parliament; the gates are walked until the resolution asks or the phase is over. */
function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

describe('ParliamentPhase', () => {
  it('resolves the vote at the end of the generation: winner, Agenda, popular support, enactment, refresh, lobby', () => {
    const [game, p1, p2, parliament] = reduxGame();
    // THE GENERIC PHASE: the voted card is one whose effect never asks — a
    // real resolution dealt here (a winner's tile) would hold the phase for
    // its answer. A quiet card of the dealt card's OWN party keeps every
    // party reading below as it was; the slot is one a PLAYER can win quietly
    // (the seeded deal decides where the Greens' card — whose winner ocean
    // asks — landed this catalog).
    const winnerIndex = quietWinnerIndex(parliament);
    const slot = parliament.slots[winnerIndex];
    quiet(parliament, winnerIndex);
    const winnerParty = parliament.resolutionOf(slot.instance).party;
    const loserParties = parliament.partiesInVotingArea().filter((party) => party !== winnerParty);
    const loserWithVote = parliament.slots[(winnerIndex + 1) % parliament.slots.length];
    const loserWithVoteParty = parliament.resolutionOf(loserWithVote.instance).party;
    parliament.placeVote(p1, slot, 'lobby');
    parliament.placeVote(p1, slot, 'reserve');
    parliament.placeVote(p2, loserWithVote, 'lobby');
    parliament.recordPartyActionUse(p1, PartyName.GREENS);
    const winnerInstance = slot.instance;
    const trBefore = p1.terraformRating;
    const poolOf = () => [...parliament.deck, ...parliament.discard, ...parliament.slots.map((s) => s.instance),
      ...(parliament.enacted === undefined ? [] : [parliament.enacted])];
    const poolBefore = new Set(poolOf());

    endGenerationThroughParliament(game);

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
    // 5. fresh resolutions of distinct parties, none of the enacted party; the two losers were discarded.
    //    The refresh deals one card per party, never the enacted card's
    //    party: as many slots as the pool has OTHER parties, at most three (a
    //    slot nothing fits stays empty — the deck is real resolutions only).
    //    …and «the pool» is what THIS game deals — the catalog through the game's own expansion filter
    //    (a Venus-only card is in no deck of a game without Venus Next).
    const otherParties = new Set(parliament.catalog.dealtInstances(compatibleWith(game.gameOptions.expansions))
      .map((instance) => parliament.resolutionOf(instance).party)
      .filter((party) => party !== winnerParty));
    const expectedSlots = Math.min(PARLIAMENT_VOTING_SLOTS, otherParties.size);
    expect(parliament.slots).has.length(expectedSlots);
    const parties = parliament.partiesInVotingArea();
    expect(new Set(parties).size).eq(expectedSlots);
    expect(parties).not.includes(winnerParty);
    // The losers went back through the discard — with a small real pool the
    // refresh reshuffles it and may deal one straight back. What must hold is
    // the POOL: the same cards as before, each in exactly one place.
    expect(parliament.slots.map((s) => s.instance)).not.includes(winnerInstance);
    const poolAfter = poolOf();
    expect(new Set(poolAfter).size, 'no card in two places').eq(poolAfter.length);
    expect(new Set(poolAfter)).deep.eq(poolBefore);
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
    expect(summary.refreshed).has.length(expectedSlots);
    expect(summary.lobbyRefilled).has.members([p1.id, p2.id]);
  });

  /*
   * ПРАВИТЕЛЬ БЕЗ ПОДДЕРЖКИ — the rule two console surfaces STAND on: the ruler's plaque hides its three
   * support sockets and the results panel leaves the ruling party out of its support row, both because a
   * party that rules by an enacted card can never hold a neutral delegate. The rule is not written
   * anywhere in the engine; it FOLLOWS from three independent facts, and this spec pins the two that can
   * be weakened by a careless edit (the third, `moveSupportToSlot`, is asserted by the phase spec above).
   */
  it('ПРАВИТЕЛЬ БЕЗ ПОДДЕРЖКИ: the enacted card\'s party gains nothing, is never dealt back into the area, and holds zero support', () => {
    const [game, p1, , parliament] = reduxGame();
    for (let generation = 1; generation <= 3; generation++) {
      game.phase = Phase.ACTION;
      // A quiet table throughout: the subject is the PHASE's own bookkeeping, and a card that asks would
      // hold the walk for an answer this spec has no business giving. The NEUTRAL player carries the
      // winning slot (two votes beat one, so which card wins is not left to a tie-break) and a real
      // player votes for a LOSING card — that is what exercises the second support wave's `+2` branch,
      // the one that would pay the ruler if a second card of its party could ever stand in the area.
      for (let i = 0; i < parliament.slots.length; i++) {
        quiet(parliament, i);
      }
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.addNeutralVote(parliament.slots[0]);
      if (parliament.slots.length > 1) {
        parliament.placeVote(p1, parliament.slots[1], 'lobby');
      }
      endGenerationThroughParliament(game);

      const ruling = parliament.rulingParty();
      const summary = parliament.lastPhase!;
      const where = `generation ${generation}, ruling ${ruling}`;
      // ① the support step never pays it (it is represented by the card in ENACTED, and it won its slot).
      expect(summary.support.map((entry) => entry.party), `the support step paid the ruler (${where})`).not.includes(ruling);
      // ② the refresh never deals it back into the area — the rule `dealSlot` keeps, and the one that
      //    makes ① hold next generation too. Weaken it and this spec is the first thing to fail.
      const parties = parliament.partiesInVotingArea();
      expect(parties, `a card of the ruling party stands in the voting area (${where})`).not.includes(ruling);
      expect(new Set(parties).size, `two cards of one party in the area (${parties.join(', ')} — ${where})`).eq(parties.length);
      // ③ …so after the whole phase, deal included, the ruler holds nothing.
      expect(parliament.popularSupportOf(ruling), `the ruler holds popular support (${where})`).eq(0);
      // …and the invariant the rule rides on: a party REPRESENTED in the area holds no stock either —
      // the deal turned whatever it had into votes on its fresh card.
      for (const party of parties) {
        expect(parliament.popularSupportOf(party), `${party} keeps a stock while its card is in the area (${where})`).eq(0);
      }
      parliament.assertLedger(game);
    }
  });

  /*
   * …AND THE ONE WINDOW WHERE THE PROOF'S FIRST PREMISE DOES NOT HOLD. «The ruler is represented by the
   * card in ENACTED» is false before the FIRST enactment: the slot is empty and the Greens rule by the
   * starting rule (`Parliament.rulingParty`), so the support step's first wave — which pays every party
   * represented neither in the area nor in ENACTED — could pay the ruler.
   *
   * It cannot TODAY, and this spec is why: the deck holds real resolutions of exactly three parties, so
   * generation 1's three voting slots are those three and the starting-rule ruler is always one of them.
   * The day a FOURTH party ships a resolution this spec fails — and that failure is the worklist entry:
   * the ruler's plaque hides its support sockets (`ConsolePartyPlaque.vue`), so a default ruler that can
   * actually hold a delegate needs that rule re-read.
   */
  it('THE STARTING-RULE RULER: with three parties in the deck the Greens always hold a generation-1 card and are never paid as absent', () => {
    const [game, , , parliament] = reduxGame();
    expect(parliament.enacted, 'the ENACTED slot is empty before the first sitting').is.undefined;
    const ruler = parliament.rulingParty();
    // A game WITHOUT Venus Next deals three parties (Greens, Mars First, the Industrialists), so the three
    // generation-1 slots are those three and the starting ruler is always among them.
    expect(parliament.partiesInVotingArea(), `the starting-rule ruler (${ruler}) is represented in a three-party area`).includes(ruler);
    for (let i = 0; i < parliament.slots.length; i++) {
      quiet(parliament, i);
    }
    endGenerationThroughParliament(game);
    const paidAsAbsent = (parliament.lastPhase?.support ?? []).find((entry) => entry.party === ruler && entry.reason === 'absent');
    expect(paidAsAbsent, `wave 1 paid the starting-rule ruler ${ruler}`).is.undefined;
  });

  /*
   * …AND THE RULE ITSELF, READ LITERALLY, once a FOURTH party can be dealt (Cloud Development — Unity, Venus
   * Next). The rulebook's support step pays «each party that is not present on any of the resolution cards»
   * in the Voting Area or the Enacted slot (p.11; the areas on p.9 say the same), and the Greens rule
   * generation 1 «if there is no card in the Enacted slot» (p.8): the printed slot is NOT a card. So a
   * generation-1 area without a Greens card pays the Greens as ABSENT while they rule — the server's reading
   * since the phase was written, now REACHABLE and pinned. The client answers it by the card, not the
   * office: the ruler's plaque hides its sockets only when it rules BY AN ENACTED CARD
   * (`ConsolePartyPlaque` § `rulesByCard`), so the starting ruler's stock is drawn in the government and the
   * support wave lands there. From the first enactment on, ПРАВИТЕЛЬ БЕЗ ПОДДЕРЖКИ (above) holds as before.
   */
  it('THE STARTING-RULE RULER HOLDS NO CARD: a Venus game can deal a generation-1 area without the Greens, and the support step then pays them as ABSENT — the literal rule', () => {
    const [game, , , parliament] = venusGame();
    seatResolution(parliament, 0, CLOUD_DEVELOPMENT_ID);
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 2, CENTRAL_POWER_GRID_ID);
    expect(parliament.enacted).is.undefined;
    expect(parliament.rulingParty(), 'the Greens rule by the starting rule').eq(PartyName.GREENS);
    expect(parliament.partiesInVotingArea(), 'and hold no card').not.includes(PartyName.GREENS);
    // Mars First wins on the neutral player's vote (a quiet card: the phase is the subject).
    parliament.addNeutralVote(parliament.slots[1]);
    endGenerationThroughParliament(game);
    const summary = parliament.lastPhase!;
    expect(summary.support.find((entry) => entry.party === PartyName.GREENS), 'the Greens are paid as a party not present on any card')
      .deep.include({party: PartyName.GREENS, reason: 'absent', gained: 1});
    expect(summary.support.map((entry) => entry.party), 'the three absent parties and the two losers, nobody twice')
      .has.members([PartyName.GREENS, PartyName.SCIENTISTS, PartyName.REDS, PartyName.UNITY, PartyName.INDUSTRIALISTS]);
    expect(summary.support.find((entry) => entry.party === PartyName.MARS), 'the winner\'s party gains nothing').is.undefined;
    // The stock is real: it is either still in the Greens' places, or — the deck holds their three cards — it
    // became votes on the Greens card the refresh dealt. Either way nothing of it was lost, and the NEW ruler
    // (by a card now) holds nothing.
    const dealtGreens = parliament.slots.find((slot) => parliament.resolutionOf(slot.instance).party === PartyName.GREENS);
    if (dealtGreens === undefined) {
      expect(parliament.popularSupportOf(PartyName.GREENS)).eq(1);
    } else {
      expect(parliament.popularSupportOf(PartyName.GREENS)).eq(0);
      expect(parliament.neutralVotes(dealtGreens), 'the Greens\' stock became votes on their fresh card').eq(1);
    }
    expect(parliament.rulingParty()).eq(PartyName.MARS);
    expect(parliament.popularSupportOf(PartyName.MARS)).eq(0);
    parliament.assertLedger(game);
  });

  it('a neutral winner moves no Agenda and the second Agenda step pays 1 TR', () => {
    const [game, p1, , parliament] = reduxGame();
    // THE GENERIC PHASE again: the subject is the Agenda, so the card that
    // wins must be one whose effect never asks. The deal is random and the
    // pool grows with every implemented resolution — pinning the winning slot
    // to a quiet card of its OWN party is what keeps this spec about the Agenda.
    quiet(parliament, 0);
    parliament.addNeutralVote(parliament.slots[0]);
    endGenerationThroughParliament(game);
    expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
    expect(parliament.agendaOf(p1)).eq(0);

    game.phase = Phase.ACTION;
    // The PLAYER wins this one: a slot whose quiet card asks nothing of the winner either.
    const winnerIndex = quietWinnerIndex(parliament);
    quiet(parliament, winnerIndex);
    parliament.agenda.set(p1.id, 1);
    // Two delegates: the fresh card may carry a neutral vote from the deal, and an earlier delegate wins a tie.
    parliament.placeVote(p1, parliament.slots[winnerIndex], 'lobby');
    parliament.placeVote(p1, parliament.slots[winnerIndex], 'reserve');
    const tr = p1.terraformRating;
    endGenerationThroughParliament(game);
    expect(parliament.lastPhase?.winner.player).eq(p1.id);
    expect(parliament.agendaOf(p1)).eq(2);
    expect(p1.terraformRating).eq(tr + 1);
    expect(parliament.lastPhase?.agenda?.bonus).eq('tr');
  });

  describe('a resolution that asks (RDX_TEST_CHOICE)', () => {
    /** Seat the test resolution in slot 0 with p1's delegate on it, so p1 wins. */
    function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, TEST_CHOICE_RESOLUTION_ID);
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

      // The effects are over: the ADJOURN gate stands for both; then refresh, lobby, next generation.
      expect(live.parliament!.phase?.step).eq('adjourn');
      settleParliamentGates(live);
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
      seatResolution(parliament, 0, TEST_CHOICE_RESOLUTION_ID);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      // The barrier is ONE human: the bot holds no gate, the human's answer moves the phase.
      expect(bot.getWaitingFor()).is.undefined;
      answerGate(human, 'assembly');
      expect(human.getWaitingFor()).is.instanceOf(OrOptions);
      human.process({type: 'or', index: 0, response: {type: 'option'}});
      expect(bot.getWaitingFor()).is.undefined;
      human.process({type: 'or', index: 1, response: {type: 'option'}});
      expect(bot.getWaitingFor()).is.undefined;
      answerGate(human, 'adjourn');
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
      quiet(parliament, 0);
      const winner = parliament.slots[0];
      parliament.placeVote(p1, winner, 'lobby');
      const slotsBefore = parliament.slots.map((slot) => slot.instance);
      passToParliament(game);
      // FINAL: enact → ASSEMBLY → effects → ADJOURN → done — no refresh, no lobby between the gates.
      expect(parliament.phase?.step).eq('assembly');
      settleParliamentGates(game);
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
        for (let guard = 0; guard < 8 && game.phase === Phase.PARLIAMENT; guard++) {
          const wf = human.getWaitingFor();
          if (gatePromptOf(human) !== undefined) {
            answerGate(human);
          } else if (wf instanceof SelectSpace) {
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
  describe('the sitting\'s gates (assembly · adjourn)', () => {
    const marker = (player: IPlayer) => player.getWaitingFor()?.parliamentPhasePrompt;
    const wire = (player: IPlayer) => Server.getPlayerModel(player).waitingFor?.parliamentPhasePrompt;
    const reload = (game: IGame): IGame => Game.deserialize(structuredClone(game.serialize()));

    it('ASSEMBLY stands right after the VERDICT and before anything changes; every participant is asked once and the LAST answer moves the phase — then ADJOURN the same way (2 seats)', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      const winnerInstance = parliament.slots[0].instance;
      const tableBefore = parliament.slots.map((slot) => slot.instance);
      const supportBefore = REDUX_PARTIES.map((party) => parliament.popularSupportOf(party));
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      passToParliament(game);
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(parliament.phase?.step).eq('assembly');
      // v2: ONLY the verdict is done at the gate. The table is exactly as it was voted — the winner still in its
      // slot with its delegate, the government untouched, no Agenda step, no popular support, nothing paid.
      expect(parliament.phase?.summary?.winner.instance).eq(winnerInstance);
      expect(parliament.enacted, 'the government has not changed').is.undefined;
      expect(parliament.slots.map((slot) => slot.instance), 'the winner is still in its slot').deep.eq(tableBefore);
      expect(parliament.votesOf(p1), 'its delegate is still on the card').eq(1);
      expect(parliament.agendaOf(p1), 'no Agenda step yet').eq(0);
      expect(REDUX_PARTIES.map((party) => parliament.popularSupportOf(party)), 'no popular support yet').deep.eq(supportBefore);
      expect(parliament.phase?.summary?.agenda).is.undefined;
      expect(parliament.phase?.summary?.support).is.empty;
      expect(parliament.phase?.summary?.outcomes ?? []).is.empty;
      expect(parliament.quest?.generation, 'the chairman quest is the current one').eq(1);
      const active = game.activePlayer.id;
      for (const seat of [p1, p2]) {
        expect(marker(seat), seat.color + '\'s gate').deep.include({stage: 'assembly', generation: 1, final: false, seq: 1});
        expect(seat.getWaitingFor()).is.instanceOf(SelectOption);
      }
      // The wire: the marker names the seats still awaited — both, then one — computed when the model is built.
      expect(wire(p1)?.awaiting).has.members([p1.color, p2.color]);
      answerGate(p1, 'assembly');
      expect(parliament.phase?.step, 'one answer moves nothing').eq('assembly');
      expect(p1.getWaitingFor(), 'the answered seat holds nothing').is.undefined;
      expect(wire(p2)?.awaiting).deep.eq([p2.color]);
      expect(getParliamentModel(game, p1)?.phase?.awaiting).deep.eq([p2.color]);
      expect(parliament.phase?.appliedBySeat?.[p1.id]).includes('assembly:1');
      expect(game.activePlayer.id, 'activePlayer is never reassigned to an asked seat').eq(active);
      answerGate(p2, 'assembly');
      // The LAST answer opens the barrier and the whole chain runs in order: the winner's Agenda, the support,
      // the enactment, the effects (a quiet card asks nothing), the refresh, the lobby — and ADJOURN stands.
      expect(parliament.phase?.step).eq('adjourn');
      expect(parliament.enacted, 'the winner is enacted now').eq(winnerInstance);
      expect(parliament.agendaOf(p1), 'the winner\'s Agenda moved').eq(1);
      expect(parliament.phase?.summary?.agenda).deep.include({player: p1.id, from: 0, to: 1});
      expect(parliament.phase?.summary?.support.length, 'the support was granted').is.greaterThan(0);
      expect(parliament.slots.map((slot) => slot.instance), 'the winner left the area').not.includes(winnerInstance);
      expect(parliament.quest?.generation, 'the quest is the enacted resolution\'s, for the next generation').eq(2);
      expect(parliament.lobby.has(p1.id)).is.true;
      expect(parliament.phase?.summary?.refreshed.length).is.greaterThan(0);
      for (const seat of [p1, p2]) {
        expect(marker(seat)).deep.include({stage: 'adjourn', generation: 1, seq: 1});
      }
      expect(game.activePlayer.id).eq(active);
      answerGate(p2, 'adjourn');
      expect(parliament.phase?.step, 'the first adjourn answer moves nothing').eq('adjourn');
      expect(wire(p1)?.awaiting).deep.eq([p1.color]);
      answerGate(p1, 'adjourn');
      expect(parliament.phase).is.undefined;
      expect(game.generation).eq(2);
      expect(game.phase).eq(Phase.RESEARCH);
      expect(parliament.lastPhase?.seq).eq(1);
      expect(parliament.lastPhase?.correlationId).is.a('number');
    });

    it('…with 3 seats: two answers move nothing, the third does — at both gates', () => {
      const [game, p1, p2, p3] = testGame(3, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p2, parliament.slots[0], 'lobby');
      passToParliament(game);
      expect(parliament.phase?.step).eq('assembly');
      expect([p1, p2, p3].map((s) => marker(s)?.stage)).deep.eq(['assembly', 'assembly', 'assembly']);
      answerGate(p2, 'assembly');
      answerGate(p3, 'assembly');
      expect(parliament.phase?.step).eq('assembly');
      expect(wire(p1)?.awaiting).deep.eq([p1.color]);
      answerGate(p1, 'assembly');
      expect(parliament.phase?.step).eq('adjourn');
      answerGate(p1, 'adjourn');
      answerGate(p3, 'adjourn');
      expect(parliament.phase?.step).eq('adjourn');
      answerGate(p2, 'adjourn');
      expect(parliament.phase).is.undefined;
      expect(game.generation).eq(2);
    });

    it('a doubled answer is refused and changes nothing: the seat\'s key is written once', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      passToParliament(game);
      answerGate(p1, 'assembly');
      expect(() => p1.process({type: 'option'})).to.throw(/Not waiting/);
      expect(parliament.phase?.step).eq('assembly');
      expect(parliament.phase?.appliedBySeat?.[p1.id]?.filter((key) => key === 'assembly:1')).has.length(1);
      answerGate(p2, 'assembly');
      expect(parliament.phase?.step).eq('adjourn');
    });

    it('a reload inside EACH gate re-issues the prompt only to the seats that have not answered — never over a standing one — and activePlayer stays', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      passToParliament(game);
      const active = game.activePlayer.id;
      answerGate(p1, 'assembly');
      let live = reload(game);
      let one = live.getPlayerById(p1.id);
      let two = live.getPlayerById(p2.id);
      expect(live.phase).eq(Phase.PARLIAMENT);
      expect(live.parliament!.phase?.step).eq('assembly');
      expect(one.getWaitingFor(), 'answered before the save: not asked again').is.undefined;
      expect(marker(two)).deep.include({stage: 'assembly', generation: 1});
      expect(live.activePlayer.id).eq(active);
      // A second resume (a defensive re-entry) writes over nothing: the standing gate keeps its identity.
      const serial = two.waitingForSerial;
      ParliamentHandler.resumePhase(live, (final) => (live as Game).continueAfterParliamentPhase(final));
      expect(two.waitingForSerial).eq(serial);
      expect(one.getWaitingFor()).is.undefined;
      answerGate(two, 'assembly');
      expect(live.parliament!.phase?.step).eq('adjourn');
      answerGate(two, 'adjourn');
      live = reload(live);
      one = live.getPlayerById(p1.id);
      two = live.getPlayerById(p2.id);
      expect(live.parliament!.phase?.step).eq('adjourn');
      expect(two.getWaitingFor()).is.undefined;
      expect(marker(one)).deep.include({stage: 'adjourn', generation: 1});
      expect(live.activePlayer.id).eq(active);
      answerGate(one, 'adjourn');
      expect(live.parliament!.phase).is.undefined;
      expect(live.generation).eq(2);
    });

    it('the FINAL generation runs effects → ADJOURN → done: no refresh, no lobby between the gates, then the final greeneries', () => {
      const [game, p1, , parliament] = reduxGame();
      setTemperature(game, 8);
      setOxygenLevel(game, 14);
      maxOutOceans(p1);
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      passToParliament(game);
      expect(parliament.phase?.final).is.true;
      expect(parliament.phase?.step).eq('assembly');
      expect(answerStandingGates(game, 'assembly')).eq(2);
      expect(parliament.phase?.step).eq('adjourn');
      expect(parliament.phase?.summary?.refreshed).deep.eq([]);
      expect(parliament.lobby.has(p1.id), 'no lobby refill in the final phase').is.false;
      expect(answerStandingGates(game, 'adjourn')).eq(2);
      expect(parliament.phase).is.undefined;
      expect(parliament.lastPhase?.final).is.true;
      expect(game.phase).eq(Phase.PRODUCTION);
    });

    it('solo with MarsBot: the barrier is ONE human — the bot is never asked, the awaited list names the human alone', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(parliament.phase?.step).eq('assembly');
      expect(bot.getWaitingFor()).is.undefined;
      expect(wire(human)?.awaiting).deep.eq([human.color]);
      answerGate(human, 'assembly');
      expect(parliament.phase?.step).eq('adjourn');
      expect(bot.getWaitingFor()).is.undefined;
      answerGate(human, 'adjourn');
      expect(parliament.phase).is.undefined;
      expect(game.generation).eq(2);
    });

    it('the Agenda still moves BEFORE the support, the enactment and the rewards — one chain after the barrier (the rules are untouched by the moved gate)', () => {
      const [game, p1, , parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // pays M€ production by influence — the Agenda step must be counted first
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      parliament.agenda.set(p1.id, 1); // step 2 is a TR step: the winner's step pays 1 TR before the law pays
      const tr = p1.terraformRating;
      const production = p1.production.megacredits;
      passToParliament(game);
      expect(parliament.phase?.step).eq('assembly');
      expect(p1.terraformRating, 'nothing is paid at the gate').eq(tr);
      expect(p1.production.megacredits).eq(production);
      // The journal keeps the order the rules prescribe: the Agenda line before the support, the support before the enactment, the enactment before the payout.
      const logsBefore = game.gameLog.length;
      expect(answerStandingGates(game, 'assembly')).eq(2);
      expect(parliament.agendaOf(p1)).eq(2);
      expect(p1.terraformRating, 'the Agenda step paid its TR').eq(tr + 1);
      expect(p1.production.megacredits, 'the law paid after it').is.greaterThan(production);
      const lines = game.gameLog.slice(logsBefore).map((m) => m.message);
      const at = (re: RegExp) => lines.findIndex((m) => re.test(m));
      const agendaAt = at(/Agenda/);
      const supportAt = at(/Popular Support/);
      const enactAt = at(/is enacted/);
      expect(agendaAt, `an Agenda line among ${lines.join(' | ')}`).is.greaterThan(-1);
      expect(supportAt).is.greaterThan(agendaAt);
      expect(enactAt).is.greaterThan(supportAt);
      expect(parliament.phase?.summary?.outcomes?.some((o) => o.player === p1.id && o.kind === 'production'), 'the payout is recorded after the enactment').is.true;
    });

    it('an OLD save standing at the assembly gate AFTER the enactment (the pre-v2 order) resumes and finishes without paying anything twice', () => {
      // The fixture is a real save from the previous order: the assembly gate for both seats with `applied`
      // already carrying the support and the enactment and `appliedBySeat` the winner's Agenda step.
      const file = path.join(__dirname, 'fixtures', 'legacy-assembly-after-enact.json');
      const live = Game.deserialize(JSON.parse(fs.readFileSync(file, 'utf8')) as SerializedGame);
      const parliament = live.parliament!;
      const phase = parliament.phase!;
      expect(phase.step).eq('assembly');
      expect(phase.applied).includes(`support:${phase.generation}`);
      expect(phase.applied.some((key) => key.startsWith(`enact:${phase.generation}:`)), 'the enactment was applied before the save').is.true;
      const winnerId = phase.summary!.winner.player as PlayerId;
      expect(phase.appliedBySeat?.[winnerId]).includes(`agenda:${phase.generation}`);
      const winner = live.getPlayerById(winnerId);
      const enactedBefore = parliament.enacted;
      const agendaBefore = parliament.agendaOf(winner);
      // The summary's records of the steps already done — a step that ran again would re-push its records.
      const summaryBefore = JSON.stringify({support: phase.summary!.support, agenda: phase.summary!.agenda, returned: phase.summary!.returned});
      const supportTotal = REDUX_PARTIES.reduce((sum, party) => sum + parliament.popularSupportOf(party), 0);
      const productionBefore = live.players.map((p) => p.production.megacredits);
      const trBefore = winner.terraformRating;
      // The gate stands for every seat still without its key — the resume re-issued it.
      for (const seat of parliament.participants(live)) {
        expect(marker(seat)?.stage, `${seat.color}'s gate`).eq('assembly');
      }
      expect(answerStandingGates(live, 'assembly')).eq(parliament.participants(live).length);
      // The chain after the barrier found the Agenda, the support and the enactment DONE: nothing moved twice,
      // nothing was paid twice — and the effects (Architecture Award pays M€ production) ran exactly once.
      expect(parliament.enacted).eq(enactedBefore);
      expect(parliament.agendaOf(winner)).eq(agendaBefore);
      expect(winner.terraformRating).eq(trBefore);
      expect(JSON.stringify({support: parliament.phase!.summary!.support, agenda: parliament.phase!.summary!.agenda, returned: parliament.phase!.summary!.returned}),
        'the support, the Agenda and the returns were recorded ONCE').eq(summaryBefore);
      // The refresh may MOVE support onto a freshly dealt card (neutral votes) — it never grants any: the pool is conserved.
      const supportAfter = REDUX_PARTIES.reduce((sum, party) => sum + parliament.popularSupportOf(party), 0) +
        parliament.slots.reduce((sum, slot) => sum + slot.votes.filter((vote) => vote.owner === 'NEUTRAL').length, 0);
      expect(supportAfter, 'no support granted twice').eq(supportTotal);
      expect(parliament.phase?.step).eq('adjourn');
      const paid = live.players.map((p, i) => p.production.megacredits - productionBefore[i]);
      expect(paid.some((delta) => delta > 0), `the law paid once (${paid.join(',')})`).is.true;
      const outcomes = parliament.phase?.summary?.outcomes ?? [];
      for (const player of live.players) {
        expect(outcomes.filter((o) => o.player === player.id && o.kind === 'production').length, `${player.color} has ONE production record`).eq(1);
      }
      expect(answerStandingGates(live, 'adjourn')).eq(parliament.participants(live).length);
      expect(parliament.phase).is.undefined;
      expect(live.generation).eq(phase.generation + 1);
      parliament.assertLedger(live);
    });

    it('a save CLONED inside a gate with fresh player ids does not ask the answered seat again: the key travels with the seat', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      passToParliament(game);
      answerGate(p1, 'assembly');
      const serialized = structuredClone(game.serialize());
      const oldIds = [p1.id, p2.id];
      const newIds = oldIds.map((_id, i) => ('pclone' + i) as PlayerId);
      Cloner.replacePlayerIds(serialized, oldIds, newIds);
      const live = Game.deserialize(serialized);
      const one = live.getPlayerById(newIds[0]);
      const two = live.getPlayerById(newIds[1]);
      expect(live.parliament!.phase?.appliedBySeat?.[newIds[0]]).includes('assembly:1');
      expect(one.getWaitingFor()).is.undefined;
      expect(marker(two)?.stage).eq('assembly');
      answerGate(two, 'assembly');
      expect(live.parliament!.phase?.step).eq('adjourn');
    });

    it('every sitting is numbered (seq is monotonic), joins the history behind the last one, and the history keeps the last 24', () => {
      const [game, p1, , parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      endGenerationThroughParliament(game);
      expect(parliament.lastPhase?.seq).eq(1);
      expect(parliament.phaseHistory.map((s) => s.seq)).deep.eq([1]);
      game.phase = Phase.ACTION;
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      endGenerationThroughParliament(game);
      expect(parliament.lastPhase?.seq).eq(2);
      expect(parliament.phaseHistory.map((s) => s.seq)).deep.eq([1, 2]);
      expect(parliament.phaseHistory[1]).eq(parliament.lastPhase);
      // The cap: the oldest leave, the survivors keep their order; a save carries the count and the history.
      for (let seq = 3; seq <= 30; seq++) {
        parliament.recordPhase({...parliament.lastPhase!, seq});
      }
      expect(parliament.phaseHistory).has.length(24);
      expect(parliament.phaseHistory[0].seq).eq(7);
      expect(parliament.phaseHistory[23].seq).eq(30);
      const restored = Game.deserialize(structuredClone(game.serialize())).parliament!;
      expect(restored.phaseSeq).eq(2);
      expect(restored.phaseHistory.map((s) => s.seq)).deep.eq(parliament.phaseHistory.map((s) => s.seq));
      expect(getParliamentModel(game)?.phaseHistory?.map((s) => s.seq)).deep.eq(parliament.phaseHistory.map((s) => s.seq));
    });

    it('the journal: ONE political-phase group per generation — every line of the sitting carries the root\'s correlationId, the steps run after a reload included', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      const logsBefore = game.gameLog.length;
      passToParliament(game);
      answerGate(p1, 'assembly');
      const live = reload(game);
      answerGate(live.getPlayerById(p2.id), 'assembly');
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      const summary = live.parliament!.lastPhase!;
      expect(summary.correlationId).is.a('number');
      const phaseLogs = live.gameLog.slice(logsBefore).filter((m) => m.correlationId === summary.correlationId);
      const roots = phaseLogs.filter((m) => m.role === 'root-action');
      expect(roots).has.length(1);
      expect(roots[0].category).eq('political-phase');
      expect(roots[0].message).eq('The Mars Parliament of generation ${0} convenes');
      // The verdict and the enactment (before the reload), the refresh and the lobby (after it) — details of that ONE group.
      const stepLines = live.gameLog.slice(logsBefore).filter((m) => /is enacted|returns to the lobby|enters the voting area|wins the vote/.test(m.message));
      expect(stepLines.length).is.greaterThan(2);
      for (const line of stepLines) {
        expect(line.correlationId, line.message).eq(summary.correlationId);
        expect(line.role, line.message).eq('detail');
      }
      // The next generation is NOT in it.
      const nextGeneration = live.gameLog.filter((m) => m.type === LogMessageType.NEW_GENERATION).pop();
      expect(nextGeneration).is.not.undefined;
      expect(nextGeneration?.correlationId).not.eq(summary.correlationId);
      // The recorder: every step's action marker shares the root.
      const markers = live.events.events.filter((e) => e.type === 'action' && e.category === 'political-phase');
      expect(markers.length).is.greaterThan(1);
      expect(new Set(markers.map((e) => e.correlationId))).deep.eq(new Set([summary.correlationId]));
    });
  });
});
