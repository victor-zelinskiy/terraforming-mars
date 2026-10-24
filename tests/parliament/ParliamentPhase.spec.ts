import {expect} from 'chai';
import {seatGrantsOf} from '../../src/server/parliament/resolutions/SeatGrants';
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
  answerGate, answerStandingGates, atSittingEnd, endGenerationThroughParliament, gatePromptOf, passToParliament, quietWinnerIndex, seatQuiet, seatResolution,
  settleParliamentGates, sittingOpen,
} from './parliamentArrange';
import {SittingAcks} from '../../src/server/parliament/SittingAcks';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
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
import {SelectColony} from '../../src/server/inputs/SelectColony';
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

/** Every player passes; production → the parliament; the sitting is closed by every seat (or the resolution's first ask stands). */
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
   * ПРАВИТЕЛЬ БЕЗ ПОДДЕРЖКИ — THE SITTING NEVER PAYS THE RULER, the rule the ruler's plaque stands on: its
   * EMPTY support places are void (nothing can ever fill them while it rules). The rule is not written
   * anywhere in the engine; it FOLLOWS from three independent facts, and this spec pins the two that can
   * be weakened by a careless edit (the third, `moveSupportToSlot`, is asserted by the phase spec above).
   * On a quiet table the three give «the ruler holds zero». A CARD can still hand a ruler a stock — TR03
   * Political Donation pays the party of a resolution IN the area, and that resolution may win — and then
   * the stock rides into the government, the plaque draws it, and it waits for the party's next card
   * (`PoliticalDonation.spec.ts` § rule 5 across the sittings).
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
      if (parliament.slots.length > 1) {
        parliament.placeVote(p1, parliament.slots[1], 'lobby');
      }
      // …and the neutral lead is COUNTED, never assumed to be «two»: a freshly dealt card arrives carrying its
      // party's stock as neutral votes, so «two on slot 0» loses to «the stock + the player's vote on slot 1»
      // the day the seeded deal puts a stocked party there (TR06 moved it: the Greens' card won with the
      // player's vote on it, its winner's ocean ASKED, the sitting stood at that prompt — and the assertions
      // below read the PREVIOUS generation's summary against the new ruler).
      const rivals = Math.max(0, ...parliament.slots.slice(1).map((slot) => slot.votes.length));
      while (parliament.slots[0].votes.length <= rivals) {
        parliament.addNeutralVote(parliament.slots[0]);
      }
      endGenerationThroughParliament(game);
      expect(parliament.phase, `the sitting of generation ${generation} is over — its summary is this generation's`).is.undefined;

      const ruling = parliament.rulingParty();
      const summary = parliament.lastPhase!;
      expect(summary.generation, 'the summary read is the sitting just held').eq(generation);
      const where = `generation ${generation}, ruling ${ruling}`;
      // ① the support step never pays it (it is represented by the card in ENACTED, and it won its slot).
      expect(summary.support.map((entry) => entry.party), `the support step paid the ruler (${where})`).not.includes(ruling);
      // ② the refresh never deals it back into the area — the rule `dealSlot` keeps, and the one that
      //    makes ① hold next generation too. Weaken it and this spec is the first thing to fail.
      const parties = parliament.partiesInVotingArea();
      expect(parties, `a card of the ruling party stands in the voting area (${where})`).not.includes(ruling);
      expect(new Set(parties).size, `two cards of one party in the area (${parties.join(', ')} — ${where})`).eq(parties.length);
      // ③ …so after the whole phase, deal included, the ruler holds nothing (on this QUIET table — no card paid anyone).
      expect(parliament.popularSupportOf(ruling), `the ruler holds popular support (${where})`).eq(0);
      // …and the invariant the rule rides on: a party REPRESENTED in the area holds no stock either right after
      // the deal — it turned whatever it had into votes on its fresh card (only a card can refill it before the sitting).
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
  it('THE STARTING-RULE RULER is paid as absent EXACTLY when no generation-1 card is theirs — the base deck holds six parties since RX16, so the deal decides', () => {
    const [game, , , parliament] = reduxGame();
    expect(parliament.enacted, 'the ENACTED slot is empty before the first sitting').is.undefined;
    const ruler = parliament.rulingParty();
    // The base deck once held three parties (Greens, Mars First, the Industrialists), so the three generation-1
    // slots were always those three and the starting ruler was always represented. Since Joint Research (the
    // Scientists' first card) the base deck holds SIX parties, and a generation-1 area without the Greens is an
    // ordinary deal — the literal rule (the next spec) then pays them as ABSENT, and never otherwise.
    const represented = parliament.partiesInVotingArea().includes(ruler);
    for (let i = 0; i < parliament.slots.length; i++) {
      quiet(parliament, i);
    }
    endGenerationThroughParliament(game);
    const paidAsAbsent = (parliament.lastPhase?.support ?? []).find((entry) => entry.party === ruler && entry.reason === 'absent');
    if (represented) {
      expect(paidAsAbsent, `wave 1 paid the starting-rule ruler ${ruler} although a card of theirs stood in the area`).is.undefined;
    } else {
      expect(paidAsAbsent, `wave 1 owed the starting-rule ruler ${ruler} the absent party's cube — no card of theirs stood in the area`)
        .deep.include({party: ruler, reason: 'absent', gained: 1});
    }
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

      // The effects are over: the chain ran the refresh and the lobby, the next generation has begun — and each
      // seat holds its confirmation of the sitting.
      expect(live.parliament!.phase).is.undefined;
      expect(live.generation).eq(2);
      expect(gatePromptOf(live.getPlayerById(p1.id))).is.not.undefined;
      expect(gatePromptOf(live.getPlayerById(p2.id))).is.not.undefined;
      settleParliamentGates(live);
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
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, TEST_CHOICE_RESOLUTION_ID);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      // No gate stands before the effects: the law asks the human at once; the bot holds nothing.
      expect(bot.getWaitingFor()).is.undefined;
      expect(human.getWaitingFor()).is.instanceOf(OrOptions);
      human.process({type: 'or', index: 0, response: {type: 'option'}});
      expect(bot.getWaitingFor()).is.undefined;
      human.process({type: 'or', index: 1, response: {type: 'option'}});
      expect(bot.getWaitingFor()).is.undefined;
      expect(parliament.phase).is.undefined;
      expect(parliament.sittingAcks?.pending, 'the bot owes no confirmation').deep.eq([human.id]);
      answerGate(human);
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
      // FINAL: enact → effects → done — no refresh, no lobby; the confirmations are the one barrier left.
      expect(parliament.phase).is.undefined;
      expect(game.phase, 'the final sitting waits for its confirmations').eq(Phase.PARLIAMENT);
      expect(parliament.sittingAcks?.final).is.true;
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
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      const parliament = game.parliament!;
      expect(parliament.participates(bot, 'delegates')).is.false;
      expect(parliament.participates(human, 'delegates')).is.true;
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
        for (let guard = 0; guard < 8 && sittingOpen(game); guard++) {
          const wf = human.getWaitingFor();
          if (gatePromptOf(human) !== undefined) {
            answerGate(human);
          } else if (wf instanceof SelectSpace) {
            human.process({type: 'space', spaceId: wf.spaces[0].id});
          } else if (wf instanceof SelectCard) {
            // A mandatory TAKE (Joint Research's top-up, Climate Research's draw) is answered WHOLE — one card
            // at a time re-issues the remainder and would spend the guard's rounds on one seat's intake.
            human.process({type: 'card', cards: wf.externalDrawPrompt !== undefined ? wf.cards.map((c) => c.name) : [wf.cards[0].name]});
          } else if (wf instanceof SelectColony) {
            // Colony Contest's winner builds a colony for free — the first tile the ordinary rules allow.
            human.process({type: 'colony', colonyName: wf.colonies[0].name});
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

  describe('with MarsBot (BotParliamentMode politics)', () => {
    /**
     * THE SAME FIVE GENERATIONS under the political seat — the mode a NEW
     * game seats the bot in. The bot's deck is EMPTIED every generation, so
     * it never plays Party Politics nor lobbies: its free delegate simply
     * STANDS in the lobby all game — a seat that holds delegates (its lobby,
     * its reserve, its row in the ledger), never a seat the sitting asks,
     * never a seat a law pays. What its votes do is the political specs'
     * business (`AutomaPartyPolitics`, `AutomaLobbying`, `BotVoteChooser`).
     */
    it('plays several generations: the bot holds its delegates, is never asked, is never paid, and the ledger holds after every sitting', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'});
      const parliament = game.parliament!;
      expect(parliament.participates(bot, 'delegates')).is.true;
      expect(parliament.participates(bot, 'enactment')).is.false;
      expect(parliament.participates(bot, 'prompts')).is.false;
      expect(parliament.lobby.has(bot.id)).is.true;
      expect(parliament.reserve(bot)).eq(6);
      expect(parliament.hasPartyEffect(bot, PartyName.GREENS)).is.false;
      expect(parliament.hasPartyEffect(human, PartyName.GREENS)).is.true;

      // THE BOT PLAYS NO CARD ALL GAME — and that has to be ARRANGED for its OPENING turn too: the bot opens
      // every other generation, on the deck dealt for that generation, the moment the human finishes research.
      // Emptied only inside the loop, that deck was real for one turn, and the seeded deal (it moves with every
      // card the fork ships) decided what that turn did: a vote once (TR02), and with TR06 a card whose tags
      // closed the chairman quest — the bot took the chair, its delegate left the reserve, and «reserve 6» /
      // «no office» below failed for a sitting that did everything right.
      game.automa!.actionDeck = [];
      game.playerIsFinishedWithResearchPhase(human);
      let botWins = 0;
      // The steps of the Career a LAW granted the bot as a seat (Reds Budget, D11) — a deed, never a payout.
      let botDeedSteps = 0;
      for (let generation = 1; generation <= 5; generation++) {
        expect(game.generation).eq(generation);
        expect(game.phase).eq(Phase.ACTION);
        const menu = human.popWaitingFor();
        expect(menu).is.not.undefined;
        const slot = parliament.slots[generation % parliament.slots.length];
        if (parliament.lobby.has(human.id)) {
          parliament.placeVote(human, slot, 'lobby');
        }
        game.automa!.actionDeck = [];
        // The bot passes at once (an empty deck) and skips the production phase — what it holds NOW is what the
        // sitting must leave it with (no gate stands after the verdict any more: the chain runs inside the pass).
        const botMegacredits = bot.megaCredits;
        const botTr = bot.terraformRating;
        game.playerHasPassed(human);
        game.playerIsFinishedTakingActions();
        for (let guard = 0; guard < 8 && sittingOpen(game); guard++) {
          const wf = human.getWaitingFor();
          if (gatePromptOf(human) !== undefined) {
            answerGate(human);
          } else if (wf instanceof SelectSpace) {
            human.process({type: 'space', spaceId: wf.spaces[0].id});
          } else if (wf instanceof SelectCard) {
            human.process({type: 'card', cards: wf.externalDrawPrompt !== undefined ? wf.cards.map((c) => c.name) : [wf.cards[0].name]});
          } else if (wf instanceof SelectColony) {
            human.process({type: 'colony', colonyName: wf.colonies[0].name});
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
        // The bot may have VOTED on its first turn of the generation (it opens every other generation, and the
        // freshly dealt deck's top card may be B21 or a lobbying card — the political specs' business), and may
        // therefore be the WINNING PLAYER: its ★ is paid by declaration (D4), never as a seat's payout of the law.
        // The sitting's SEAT records name the human alone — the bot is outside the enactment.
        const botWon = parliament.lastPhase?.winner.player === bot.id;
        // …EXCEPT the DEEDS a law grants the seats (decision D11 — Skyscrapers' tier, Mars First Budget's city,
        // Reds Budget's step of the Career): the bot is a seat of the grant, by the recipients rule, and its ONE
        // record under each deed's step is not a payout. Nothing else of the law is ever the bot's.
        const enacted = parliament.lastPhase === undefined ? undefined : parliament.resolutionOf(parliament.lastPhase.enacted);
        const deedKeys = enacted === undefined ? [] : seatGrantsOf(enacted).map((deed) => deed.key);
        const botSeatRecords = (parliament.lastPhase?.outcomes ?? []).filter((o) => o.part !== 'winner' && o.player === bot.id);
        expect(botSeatRecords.filter((o) => !deedKeys.includes(o.step)).map((o) => o.step), `the law paid the bot in generation ${generation}`).deep.eq([]);
        expect(botSeatRecords.filter((o) => o.kind === 'reaction'), 'the ruling party never answers the bot').deep.eq([]);
        const botDidADeed = botSeatRecords.some((o) => o.kind === 'city' || o.kind === 'agenda');
        if (!botWon && !botDidADeed) {
          expect(bot.megaCredits, `the sitting changed the bot's M€ in generation ${generation}`).eq(botMegacredits);
          expect(bot.terraformRating, `the sitting changed the bot's TR in generation ${generation}`).eq(botTr);
        }
        botWins += botWon ? 1 : 0;
        botDeedSteps += botSeatRecords.filter((o) => o.kind === 'agenda' && deedKeys.includes(o.step)).reduce((sum, o) => sum + (o.walk?.steps.length ?? 0), 0);
        // The lobby refill reaches the bot too — its free delegate, still standing, is simply kept.
        expect(parliament.lobby.has(human.id)).is.true;
        expect(parliament.lobby.has(bot.id)).is.true;
        expect(parliament.reserve(bot)).eq(6);
        // …and its delegates are HOME after the sitting — read HERE, in the research phase that follows it.
        // The bot opens every other generation, and the deck it draws from once the human finishes this
        // research is a REAL one (it is emptied only inside the loop), so a top card of B21 / a lobbying card
        // votes on the bot's very first turn: read after the loop, «home after the sitting» was a claim about
        // generation 6's opening turn, and the seeded deal (which moves with every card the fork ships — TR02
        // was the one that moved it) decided whether it held.
        expect(parliament.votesOf(bot), `its delegates are home after the sitting of generation ${generation}`).eq(0);
        parliament.assertLedger(game);
        human.popWaitingFor();
        game.automa!.actionDeck = [];
        game.playerIsFinishedWithResearchPhase(human);
      }
      expect(game.generation).eq(6);
      // (Which laws the seeded deal enacts moves with every card the fork ships — once RX40 joined it, Reds Budget was dealt here.)
      expect(parliament.agendaOf(bot), 'the Agenda moves by the bot\'s own wins and a law\'s Career deeds alone — never by a payout').eq(botWins + botDeedSteps);
      expect(parliament.chairman, 'an empty deck plays no card: no quest, no office').not.eq(bot.id);
    });

    it('the confirmation is owed by the seats that are ASKED — one human, the bot never', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      // The bot's deck is emptied: this is the CONFIRMATION's spec, not the vote's — the human's card must win.
      game.automa!.actionDeck = [];
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      // The chain ran whole (the law asks nothing): the effects walked the human alone; the bot, a seat of the
      // ledger, got no production step — and holds no prompt.
      expect(parliament.phase).is.undefined;
      expect(bot.production.megacredits).eq(0);
      expect(human.production.megacredits).greaterThan(0);
      expect(bot.getWaitingFor()).is.undefined;
      expect(gatePromptOf(human)).is.not.undefined;
      expect(parliament.sittingAcks?.pending).deep.eq([human.id]);
      expect(getParliamentModel(game, human)?.sitting?.pending).deep.eq([human.color]);
      answerGate(human);
      expect(parliament.sittingAcks).is.undefined;
      expect(game.generation).eq(2);
      expect(bot.getWaitingFor()).is.undefined;
    });

    it('a save under either mode reloads under it — the bot\'s delegates with it', () => {
      for (const mode of ['none', 'politics'] as const) {
        const [game, , bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: mode}, `-${mode}`);
        const reloaded = Game.deserialize(structuredClone(game.serialize()));
        const parliament = reloaded.parliament!;
        const loadedBot = reloaded.getPlayerById(bot.id);
        expect(parliament.botMode).eq(mode);
        expect(parliament.participates(loadedBot, 'delegates')).eq(mode === 'politics');
        expect(parliament.lobby.has(loadedBot.id)).eq(mode === 'politics');
        expect(parliament.reserve(loadedBot)).eq(mode === 'politics' ? 6 : 0);
        parliament.assertLedger(reloaded);
      }
    });
  });

  describe('the soft gates — «Закрыть заседание» is a prompt of the SEAT, never a barrier of the phase', () => {
    const marker = (player: IPlayer) => player.getWaitingFor()?.parliamentPhasePrompt;
    const wire = (player: IPlayer) => Server.getPlayerModel(player).waitingFor?.parliamentPhasePrompt;
    const reload = (game: IGame): IGame => Game.deserialize(structuredClone(game.serialize()));
    /** The research BUY the seat holds (the deck-pick marker in buy mode), if any. */
    const researchOf = (player: IPlayer): SelectCard<IProjectCard> | undefined => {
      const wf = player.getWaitingFor();
      return wf instanceof SelectCard && wf.deckPickPrompt?.mode === 'buy' ? wf as SelectCard<IProjectCard> : undefined;
    };
    /** The draft PICK the seat holds (the draft marker), if any — never the optional re-pick. */
    const draftPickOf = (player: IPlayer): SelectCard<IProjectCard> | undefined => {
      const wf = player.getWaitingFor();
      return wf instanceof SelectCard && wf.draftPrompt !== undefined && wf.optional !== true ? wf as SelectCard<IProjectCard> : undefined;
    };
    const names = (cards: ReadonlyArray<IProjectCard>) => cards.map((card) => card.name);

    it('the chain runs WHOLE after the verdict; at its end every participant holds ONE confirmation and the next generation has ALREADY begun (2 seats)', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      const winnerInstance = parliament.slots[0].instance;
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      passToParliament(game);
      const active = game.activePlayer.id;
      // No stop after the verdict, none after the lobby: the winner's Agenda, the support, the enactment, the
      // effects, the refresh and the lobby ran in ONE chain — and the game went on into generation 2.
      expect(parliament.phase, 'the phase is over').is.undefined;
      expect(parliament.enacted).eq(winnerInstance);
      expect(parliament.agendaOf(p1)).eq(1);
      expect(parliament.lastPhase?.agenda).deep.include({player: p1.id, from: 0, to: 1});
      expect(parliament.lastPhase?.refreshed.length).is.greaterThan(0);
      expect(parliament.lobby.has(p1.id)).is.true;
      expect(game.generation, 'the next generation does not wait for the confirmations').eq(2);
      expect(game.phase).eq(Phase.RESEARCH);
      // THE RECORD: both seats owe the confirmation; each holds it — and nothing of generation 2 yet.
      expect(parliament.sittingAcks).deep.include({generation: 1, seq: 1, final: false});
      expect(parliament.sittingAcks?.pending).has.members([p1.id, p2.id]);
      expect(parliament.sittingAcks?.correlationId).eq(parliament.lastPhase?.correlationId);
      for (const seat of [p1, p2]) {
        expect(marker(seat), seat.color + '\'s confirmation').deep.eq({stage: 'close', generation: 1, final: false, seq: 1});
        expect(seat.getWaitingFor()).is.instanceOf(SelectOption);
        expect(researchOf(seat), 'its research waits for its own answer').is.undefined;
        expect(seat.researchHand, 'but its deal is already on the table — dealt in seat order with everyone').has.length(4);
      }
      // The wire: the seat's own close, never a list of the others.
      expect(wire(p1)).deep.eq({stage: 'close', generation: 1, final: false, seq: 1});
      expect(getParliamentModel(game, p1)?.sitting).deep.eq({generation: 1, seq: 1, final: false, pending: [p1.color, p2.color]});
      // p1 closes: p1 — and ONLY p1 — is admitted (its research buy over the very cards it was dealt).
      const dealt1 = names(p1.researchHand);
      answerGate(p1);
      expect(game.activePlayer.id, 'activePlayer is never reassigned to an asked seat').eq(active);
      expect(names(researchOf(p1)?.cards ?? [])).deep.eq(dealt1);
      expect(marker(p2), 'nobody else moved').deep.include({stage: 'close'});
      expect(parliament.sittingAcks?.pending).deep.eq([p2.id]);
      expect(getParliamentModel(game, p1)?.sitting?.pending).deep.eq([p2.color]);
      const line = game.gameLog.filter((m) => m.message === '${0} closed the sitting').pop();
      expect(line?.correlationId, 'the close joins the sitting\'s journal group').eq(parliament.lastPhase?.correlationId);
      // p1 buys while p2 still reads: the research barrier is the ONE thing that waits for p2.
      p1.process({type: 'card', cards: []});
      expect(game.phase).eq(Phase.RESEARCH);
      expect(p1.getWaitingFor()).is.undefined;
      answerGate(p2);
      expect(parliament.sittingAcks, 'nothing owed: the record goes').is.undefined;
      expect(getParliamentModel(game, p2)?.sitting).is.undefined;
      researchOf(p2);
      p2.process({type: 'card', cards: []});
      expect(game.phase).eq(Phase.ACTION);
    });

    it('…with 3 seats: each answer admits its own seat alone; the research waits for the last one', () => {
      const [game, p1, p2, p3] = testGame(3, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p2, parliament.slots[0], 'lobby');
      passToParliament(game);
      expect([p1, p2, p3].map((s) => marker(s)?.stage)).deep.eq(['close', 'close', 'close']);
      answerGate(p2);
      p2.process({type: 'card', cards: []});
      answerGate(p3);
      p3.process({type: 'card', cards: []});
      expect(game.phase).eq(Phase.RESEARCH);
      expect(parliament.sittingAcks?.pending).deep.eq([p1.id]);
      expect(marker(p1)?.stage).eq('close');
      answerGate(p1);
      expect(researchOf(p1)).is.not.undefined;
      p1.process({type: 'card', cards: []});
      expect(game.phase).eq(Phase.ACTION);
      expect(game.generation).eq(2);
    });

    it('a doubled answer is refused and changes nothing: the seat leaves the record once', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      passToParliament(game);
      answerGate(p1);
      const research = p1.getWaitingFor();
      // The second «Закрыть заседание» meets the research buy that stands now — refused, the buy restored.
      expect(() => p1.process({type: 'option'})).to.throw();
      expect(p1.getWaitingFor()).eq(research);
      expect(parliament.sittingAcks?.pending).deep.eq([p2.id]);
      expect(game.gameLog.filter((m) => m.message === '${0} closed the sitting')).has.length(1);
    });

    it('a reload with one seat closed and one not: the confirmation is re-issued FIRST, the closed seat gets its buy back, nobody is dealt twice, nothing is written over', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      passToParliament(game);
      const active = game.activePlayer.id;
      const dealt1 = names(p1.researchHand);
      const dealt2 = names(p2.researchHand);
      // A reload BEFORE anyone closed: both confirmations again, both deals kept, no buy for anyone.
      let live = reload(game);
      for (const id of [p1.id, p2.id]) {
        expect(marker(live.getPlayerById(id))?.stage).eq('close');
      }
      expect(names(live.getPlayerById(p1.id).researchHand)).deep.eq(dealt1);
      expect(names(live.getPlayerById(p2.id).researchHand)).deep.eq(dealt2);
      answerGate(live.getPlayerById(p1.id));
      live = reload(live);
      const one = live.getPlayerById(p1.id);
      const two = live.getPlayerById(p2.id);
      expect(live.phase).eq(Phase.RESEARCH);
      expect(names(researchOf(one)?.cards ?? []), 'the closed seat: its buy, over the SAME cards').deep.eq(dealt1);
      expect(marker(two)).deep.include({stage: 'close', generation: 1});
      expect(names(two.researchHand), 'the other seat: still its own deal, never a second one').deep.eq(dealt2);
      expect(live.activePlayer.id).eq(active);
      // A second issue (a defensive re-entry) writes over nothing: the standing confirmation keeps its identity.
      const serial = two.waitingForSerial;
      SittingAcks.issuePending(live);
      expect(two.waitingForSerial).eq(serial);
      // THE TRAP (К6): a prompt written over a standing confirmation is a publisher that forgot to ask — it throws.
      expect(() => two.setWaitingFor(new SelectOption('Anything', 'OK'))).to.throw(/Overwriting/);
      answerGate(two);
      expect(names(researchOf(two)?.cards ?? [])).deep.eq(dealt2);
      one.process({type: 'card', cards: []});
      two.process({type: 'card', cards: []});
      expect(live.phase).eq(Phase.ACTION);
    });

    it('with the DRAFT: every seat is dealt its packet at once, the pick is asked only of a seat that closed the sitting; the round waits for the other (and a reload keeps it so)', () => {
      const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, draftVariant: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      passToParliament(game);
      expect(game.phase).eq(Phase.DRAFTING);
      expect(game.draftRound).eq(1);
      for (const seat of [p1, p2]) {
        expect(seat.draftHand, `${seat.color}'s packet is dealt`).has.length(4);
        expect(seat.needsToDraft).is.true;
        expect(marker(seat)?.stage, 'but the seat reads its sitting first').eq('close');
      }
      answerGate(p1);
      const pick = draftPickOf(p1);
      expect(pick, 'p1 closed — p1 picks').is.not.undefined;
      expect(marker(p2)?.stage, 'p2 still reads — no pick, no re-pick').eq('close');
      p1.process({type: 'card', cards: [p1.draftHand[0].name]});
      expect(game.draftRound, 'the round waits for p2').eq(1);
      expect(p1.getWaitingFor()?.optional, 'p1 may change its pick while it waits').is.true;
      // A reload inside the round: p2's confirmation first, p1's re-pick as before.
      const live = reload(game);
      const one = live.getPlayerById(p1.id);
      const two = live.getPlayerById(p2.id);
      expect(marker(two)?.stage).eq('close');
      expect(one.getWaitingFor()?.optional).is.true;
      expect(two.draftHand).has.length(4);
      answerGate(two);
      expect(draftPickOf(two)).is.not.undefined;
      two.process({type: 'card', cards: [two.draftHand[0].name]});
      expect(live.draftRound, 'both picked: the next round deals and asks both').eq(2);
      expect(draftPickOf(one)).is.not.undefined;
      expect(draftPickOf(two)).is.not.undefined;
    });

    it('a seat that holds a FOREIGN prompt when the sitting ends is asked its confirmation the moment that slot frees — never over it', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      // A deferred tail the engine left p2 (the stand-in: a bare option set at the sitting's last step).
      atSittingEnd(game, () => p2.setWaitingFor(new SelectOption('A foreign question', 'OK')));
      passToParliament(game);
      expect(marker(p1)?.stage).eq('close');
      expect(marker(p2), 'the foreign prompt is never written over').is.undefined;
      expect(parliament.sittingAcks?.pending).has.members([p1.id, p2.id]);
      expect(researchOf(p2), 'and p2 is not admitted around its sitting').is.undefined;
      p2.process({type: 'option'});
      expect(marker(p2)?.stage, 'the slot freed: the confirmation stands').eq('close');
      answerGate(p2);
      expect(researchOf(p2)).is.not.undefined;
    });

    it('the World Government\'s step waits for the FIRST player\'s confirmation: nobody else is asked, the generation does not begin; a reload keeps the debt', () => {
      const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, solarPhaseOption: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      passToParliament(game);
      const first = game.first;
      const other = first.id === p1.id ? p2 : p1;
      expect(game.phase).eq(Phase.SOLAR);
      expect(game.generation, 'the step comes before the generation').eq(1);
      expect(parliament.sittingAcks?.owedWorldStep).is.true;
      expect(marker(first)?.stage).eq('close');
      expect(marker(other)?.stage).eq('close');
      // The other seat closes first: it waits in the standard «not your turn» pose — nothing to answer.
      answerGate(other);
      expect(other.getWaitingFor()).is.undefined;
      expect(game.phase).eq(Phase.SOLAR);
      // A reload: the first player's confirmation again; the debt stands.
      let live = reload(game);
      let one = live.getPlayerById(first.id);
      expect(marker(one)?.stage).eq('close');
      expect(live.getPlayerById(other.id).getWaitingFor()).is.undefined;
      answerGate(one);
      expect(one.getWaitingFor(), 'the first player closed — the World Government\'s step').is.instanceOf(OrOptions);
      expect(live.parliament!.sittingAcks?.owedWorldStep).is.true;
      // …and a reload INSIDE the step asks it again.
      live = reload(live);
      one = live.getPlayerById(first.id);
      expect(one.getWaitingFor()).is.instanceOf(OrOptions);
      one.process({type: 'or', index: 0, response: {type: 'option'}});
      expect(live.parliament!.sittingAcks, 'the step answered: nothing owed').is.undefined;
      expect(live.generation).eq(2);
      expect(live.phase).eq(Phase.RESEARCH);
      expect(researchOf(one)).is.not.undefined;
      expect(researchOf(live.getPlayerById(other.id)), 'the seat that closed long ago is admitted by the research itself').is.not.undefined;
    });

    it('the FINAL sitting is the one barrier left: effects → done, no refresh, no lobby; the first answer moves nothing, a reload keeps it, the last one goes to the final greeneries', () => {
      const [game, p1, p2, parliament] = reduxGame();
      setTemperature(game, 8);
      setOxygenLevel(game, 14);
      maxOutOceans(p1);
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      passToParliament(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.lastPhase?.final).is.true;
      expect(parliament.lastPhase?.refreshed).deep.eq([]);
      expect(parliament.lobby.has(p1.id), 'no lobby refill in the final phase').is.false;
      expect(parliament.sittingAcks).deep.include({final: true});
      expect(marker(p1)).deep.include({stage: 'close', final: true});
      expect(game.phase).eq(Phase.PARLIAMENT);
      answerGate(p1);
      expect(game.phase, 'one answer moves nothing').eq(Phase.PARLIAMENT);
      expect(p1.getWaitingFor()).is.undefined;
      const live = reload(game);
      expect(live.getPlayerById(p1.id).getWaitingFor()).is.undefined;
      expect(marker(live.getPlayerById(p2.id))?.stage).eq('close');
      expect(live.phase).eq(Phase.PARLIAMENT);
      answerGate(live.getPlayerById(p2.id));
      expect(live.parliament!.sittingAcks).is.undefined;
      expect(live.phase).eq(Phase.PRODUCTION);
    });

    it('solo with MarsBot: the record names ONE human — the bot is never asked, and its answer is the whole wait', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(parliament.phase).is.undefined;
      expect(bot.getWaitingFor()).is.undefined;
      expect(parliament.sittingAcks?.pending).deep.eq([human.id]);
      expect(game.generation).eq(2);
      answerGate(human);
      expect(researchOf(human)).is.not.undefined;
      expect(bot.getWaitingFor()).is.undefined;
    });

    it('the Agenda still moves BEFORE the support, the enactment and the rewards — one chain (the rules are untouched by the soft gates)', () => {
      const [game, p1, , parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // pays M€ production by influence — the Agenda step must be counted first
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      parliament.agenda.set(p1.id, 1); // step 2 is a TR step: the winner's step pays 1 TR before the law pays
      const tr = p1.terraformRating;
      const production = p1.production.megacredits;
      // The journal keeps the order the rules prescribe: the Agenda line before the support, the support before the enactment, the enactment before the payout.
      const logsBefore = game.gameLog.length;
      passToParliament(game);
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
      expect(parliament.lastPhase?.outcomes?.some((o) => o.player === p1.id && o.kind === 'production'), 'the payout is recorded after the enactment').is.true;
    });

    it('an OLD save standing at the retired ASSEMBLY gate AFTER the enactment (the pre-v2 order) resumes, re-issues no old gate and finishes without paying anything twice', () => {
      // The fixture is a real save from the previous order: the assembly gate for both seats with `applied`
      // already carrying the support and the enactment and `appliedBySeat` the winner's Agenda step.
      const file = path.join(__dirname, 'fixtures', 'legacy-assembly-after-enact.json');
      const serialized = JSON.parse(fs.readFileSync(file, 'utf8')) as SerializedGame;
      const phase = serialized.parliament!.phase!;
      expect(phase.step).eq('assembly');
      expect(phase.applied).includes(`support:${phase.generation}`);
      expect(phase.applied.some((key) => key.startsWith(`enact:${phase.generation}:`)), 'the enactment was applied before the save').is.true;
      const winnerId = phase.summary!.winner.player as PlayerId;
      expect(phase.appliedBySeat?.[winnerId]).includes(`agenda:${phase.generation}`);
      // The summary's records of the steps already done — a step that ran again would re-push its records.
      const summaryBefore = JSON.stringify({support: phase.summary!.support, agenda: phase.summary!.agenda, returned: phase.summary!.returned});
      const enactedBefore = serialized.parliament!.enacted;
      const agendaBefore = serialized.parliament!.agenda[winnerId] ?? 0;
      const supportTotal = Object.values(serialized.parliament!.popularSupport).reduce((sum: number, n) => sum + (n ?? 0), 0) +
        serialized.parliament!.slots.reduce((sum, slot) => sum + slot.votes.filter((vote) => vote.owner === 'NEUTRAL').length, 0);
      const productionBefore = Object.fromEntries(serialized.players.map((p) => [p.id, p.megaCreditProduction ?? 0]));
      const trBefore = serialized.players.find((p) => p.id === winnerId)!.terraformRating;
      const live = Game.deserialize(structuredClone(serialized));
      const parliament = live.parliament!;
      const winner = live.getPlayerById(winnerId);
      // The chain after the legacy step found the Agenda, the support and the enactment DONE: nothing moved twice,
      // nothing was paid twice — and the effects (Architecture Award pays M€ production) ran exactly once.
      expect(parliament.phase, 'the legacy gate stopped nothing: the chain ran to its end').is.undefined;
      expect(parliament.enacted).eq(enactedBefore);
      expect(parliament.agendaOf(winner)).eq(agendaBefore);
      expect(winner.terraformRating).eq(trBefore);
      const after = parliament.lastPhase!;
      expect(JSON.stringify({support: after.support, agenda: after.agenda, returned: after.returned}), 'the support, the Agenda and the returns were recorded ONCE').eq(summaryBefore);
      // The refresh may MOVE support onto a freshly dealt card (neutral votes) — it never grants any: the pool is conserved.
      const supportAfter = REDUX_PARTIES.reduce((sum, party) => sum + parliament.popularSupportOf(party), 0) +
        parliament.slots.reduce((sum, slot) => sum + slot.votes.filter((vote) => vote.owner === 'NEUTRAL').length, 0);
      expect(supportAfter, 'no support granted twice').eq(supportTotal);
      const paid = live.players.map((p) => p.production.megacredits - productionBefore[p.id]);
      expect(paid.some((delta) => delta > 0), `the law paid once (${paid.join(',')})`).is.true;
      for (const player of live.players) {
        expect((after.outcomes ?? []).filter((o) => o.player === player.id && o.kind === 'production').length, `${player.color} has ONE production record`).eq(1);
      }
      // No legacy gate is re-issued: every seat holds the ONE confirmation instead.
      for (const seat of parliament.participants(live, 'prompts')) {
        expect(marker(seat)?.stage, `${seat.color}'s prompt`).eq('close');
      }
      expect(answerStandingGates(live)).eq(parliament.participants(live, 'prompts').length);
      expect(live.generation).eq(phase.generation + 1);
      parliament.assertLedger(live);
    });

    it('an OLD save standing at the retired ADJOURN gate resumes into `done`: the confirmations are asked, nothing runs again', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      let save: SerializedGame | undefined;
      atSittingEnd(game, () => (save = structuredClone(game.serialize())));
      passToParliament(game);
      save!.parliament!.phase!.step = 'adjourn';
      const live = Game.deserialize(save!);
      const area = live.parliament!.slots.map((slot) => slot.instance);
      expect(live.parliament!.phase).is.undefined;
      expect(area, 'the refresh did not run again').deep.eq(parliament.slots.map((slot) => slot.instance));
      expect(live.parliament!.lastPhase?.seq).eq(1);
      expect(live.parliament!.phaseHistory.map((s) => s.seq), 'the sitting joined the history once').deep.eq([1]);
      expect(live.getPlayerById(p1.id).production.megacredits).eq(p1.production.megacredits);
      for (const id of [p1.id, p2.id]) {
        expect(marker(live.getPlayerById(id))?.stage).eq('close');
      }
      expect(live.generation).eq(2);
    });

    it('a save CLONED with fresh player ids keeps the record with its seat: the closed seat is not asked again', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing: M€ production, never a choice
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      passToParliament(game);
      answerGate(p1);
      const serialized = structuredClone(game.serialize());
      const oldIds = [p1.id, p2.id];
      const newIds = oldIds.map((_id, i) => ('pclone' + i) as PlayerId);
      Cloner.replacePlayerIds(serialized, oldIds, newIds);
      const live = Game.deserialize(serialized);
      const one = live.getPlayerById(newIds[0]);
      const two = live.getPlayerById(newIds[1]);
      expect(live.parliament!.sittingAcks?.pending).deep.eq([newIds[1]]);
      expect(researchOf(one)).is.not.undefined;
      expect(marker(two)?.stage).eq('close');
      answerGate(two);
      expect(live.parliament!.sittingAcks).is.undefined;
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

    it('the journal: ONE political-phase group per generation — every line of the sitting carries the root\'s correlationId, the steps run after a reload and the confirmations included', () => {
      const [game, p1, p2, parliament] = reduxGame();
      // The test law ASKS each seat twice: a reload inside the first question leaves the refresh and the lobby to run after it.
      seatResolution(parliament, 0, TEST_CHOICE_RESOLUTION_ID);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      const logsBefore = game.gameLog.length;
      passToParliament(game);
      expect(parliament.phase?.effects?.pending?.player).eq(p1.id);
      const live = reload(game);
      for (const id of [p1.id, p2.id]) {
        live.getPlayerById(id).process({type: 'or', index: 0, response: {type: 'option'}});
        live.getPlayerById(id).process({type: 'or', index: 1, response: {type: 'option'}});
      }
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      expect(live.parliament!.sittingAcks).is.undefined;
      const summary = live.parliament!.lastPhase!;
      expect(summary.correlationId).is.a('number');
      const phaseLogs = live.gameLog.slice(logsBefore).filter((m) => m.correlationId === summary.correlationId);
      const roots = phaseLogs.filter((m) => m.role === 'root-action');
      expect(roots).has.length(1);
      expect(roots[0].category).eq('political-phase');
      expect(roots[0].message).eq('The Mars Parliament of generation ${0} convenes');
      // The verdict and the enactment (before the reload), the refresh and the lobby (after it) — details of that ONE group.
      // …and each seat's confirmation, answered in the next generation, joins it too.
      const closes = live.gameLog.slice(logsBefore).filter((m) => m.message === '${0} closed the sitting');
      expect(closes).has.length(2);
      for (const line of closes) {
        expect(line.correlationId).eq(summary.correlationId);
      }
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
