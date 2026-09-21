import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  ARCHITECTURE_AWARD, ARCHITECTURE_AWARD_CAP, ARCHITECTURE_AWARD_CODE, ARCHITECTURE_AWARD_ID, ARCHITECTURE_AWARD_PRODUCTION,
} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {AQUIFER_CONTEST} from '../../src/server/parliament/resolutions/greens/AquiferContest';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {answerQuestGate, endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount, uncappedAmount} from '../../src/common/parliament/influenceScaling';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {ParliamentPhase} from '../../src/server/parliament/ParliamentPhase';
import {fakeCard, runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {ArtificialLake} from '../../src/server/cards/base/ArtificialLake';
import {DomedCrater} from '../../src/server/cards/base/DomedCrater';
import {SoilFactory} from '../../src/server/cards/base/SoilFactory';
import {SpaceElevator} from '../../src/server/cards/base/SpaceElevator';
import {NoctisFarming} from '../../src/server/cards/base/NoctisFarming';
import {PhysicsComplex} from '../../src/server/cards/base/PhysicsComplex';
import {Capital} from '../../src/server/cards/base/Capital';
import {BiomassCombustors} from '../../src/server/cards/base/BiomassCombustors';
import {HeatTrappers} from '../../src/server/cards/base/HeatTrappers';
import {CorporateStronghold} from '../../src/server/cards/base/CorporateStronghold';
import {Mine} from '../../src/server/cards/base/Mine';
import {TundraFarming} from '../../src/server/cards/base/TundraFarming';
import {MiningGuild} from '../../src/server/cards/corporation/MiningGuild';
import {NobelPrize} from '../../src/server/cards/prelude2/NobelPrize';
import {UndergroundShelters} from '../../src/server/cards/underworld/UndergroundShelters';
import {Odyssey} from '../../src/server/cards/pathfinders/Odyssey';
import {SearchForLife} from '../../src/server/cards/base/SearchForLife';
import {Vermin} from '../../src/server/cards/promo/Vermin';

/**
 * ARCHITECTURE AWARD (Turmoil Redux, RX02) — the first resolution whose
 * amount depends on the TABLEAU and the influence together, then meets a
 * cap. What these specs pin: min(5, B + I) for every participant (voters or
 * not, the party effect or not); B counts own cards in play that print a
 * building tag AND a non-negative VP icon (the icon is required; a variable
 * icon counts by its sign, not its current score; one card is one unit);
 * I is the Redux influence read after the winner's Agenda step; the cap
 * bounds the increase, not the total; the increase is the standard
 * `production.add` under the resolution's source, applied once per
 * enactment — never twice on a reload or a repeated call, never recomputed,
 * and again on a later legal enactment.
 */
const AWARD = resolutionInstanceId(ARCHITECTURE_AWARD_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Architecture Award in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, AWARD);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/**
 * Every player passes; production → the parliament; the sitting's ASSEMBLY
 * gate is answered for every seat (the harness's stale menus cleared first),
 * so the resolution's own asks stand — or, for a quiet card, the ADJOURN gate
 * is answered too and the phase is over (`parliamentArrange`).
 */
function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function outcomeOf(parliament: Parliament, player: TestPlayer) {
  return parliament.lastPhase?.outcomes?.find((o) => o.player === player.id && o.step === 'production');
}

/** Counted building cards: `n` real ones with a positive fixed VP icon. */
function countedCards(n: number): Array<ICard> {
  return [new ArtificialLake(), new DomedCrater(), new SoilFactory(), new SpaceElevator(), new NoctisFarming()].slice(0, n);
}

describe('ArchitectureAward', () => {
  describe('the catalog entry', () => {
    it('is RX02 of the Mars First, dealt as ONE card', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(ARCHITECTURE_AWARD_ID)).eq(ARCHITECTURE_AWARD);
      expect(ARCHITECTURE_AWARD_CODE).eq('RX02');
      expect(ARCHITECTURE_AWARD_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX02')).eq(ARCHITECTURE_AWARD);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX01')).eq(AQUIFER_CONTEST);
      expect(ARCHITECTURE_AWARD.party).eq(PartyName.MARS);
      expect(ARCHITECTURE_AWARD.quest).deep.eq({goal: {kind: 'tag', tag: Tag.BUILDING}, count: 2});
      expect(ARCHITECTURE_AWARD.scaled).deep.eq([ARCHITECTURE_AWARD_PRODUCTION]);
      expect(ARCHITECTURE_AWARD.winnerSteps, 'no winner-only part').is.undefined;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((instance) => instance === AWARD)).has.length(1);
    });

    it('the shared formula: min(5, B + I) — every example of the brief, the cap on the SUM', () => {
      const cases: Array<[number, number, number]> = [[0, 0, 0], [0, 2, 2], [2, 0, 2], [2, 2, 4], [3, 2, 5], [4, 3, 5]];
      for (const [b, i, expected] of cases) {
        expect(scaledAmount(ARCHITECTURE_AWARD_PRODUCTION, i, b), `B=${b} I=${i}`).eq(expected);
      }
      expect(uncappedAmount(ARCHITECTURE_AWARD_PRODUCTION, 3, 4)).eq(7);
      // Influence and count add up — never multiply.
      expect(scaledAmount(ARCHITECTURE_AWARD_PRODUCTION, 1, 2)).eq(3);
      expect(ARCHITECTURE_AWARD_CAP).eq(5);
    });
  });

  describe('which cards count (B)', () => {
    it('a positive fixed icon counts; a negative one, a building card without an icon and an icon without a building tag do not', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(
        new ArtificialLake(), // building, +1 VP → counts
        new SpaceElevator(), // space + building, +2 VP → counts once
        new BiomassCombustors(), // power + building, −1 VP → no
        new HeatTrappers(), // power + building, −1 VP → no
        new CorporateStronghold(), // city + building, −2 VP → no
        new Mine(), // building, no VP icon → no (scores 0, but the icon is the requirement)
        new TundraFarming(), // plant, +2 VP → no building tag
      );
      const count = resolutionCount(p1, 'buildingCardsWithNonNegativeVp');
      expect(count.count).eq(2);
      expect(count.cards).deep.eq([CardName.ARTIFICIAL_LAKE, CardName.SPACE_ELEVATOR]);
      expect(new Mine().getVictoryPoints(p1), 'a card without an icon scores 0 — and still does not count').eq(0);
    });

    it('a variable non-negative icon counts even while it scores 0; a penalty icon at 0 does not', () => {
      const [, p1] = reduxGame();
      const physics = new PhysicsComplex(); // science + building, 2 VP per science resource — none yet
      const capital = new Capital(); // city + building, 1 VP per adjacent ocean — no tile yet
      const shelters = new UndergroundShelters(); // building, bespoke (declared non-negative) — no shelter yet
      p1.playedCards.push(physics, capital, shelters);
      expect(physics.getVictoryPoints(p1)).eq(0);
      expect(resolutionCount(p1, 'buildingCardsWithNonNegativeVp').cards).deep.eq([CardName.PHYSICS_COMPLEX, CardName.CAPITAL, CardName.UNDERGROUND_SHELTERS]);
      // A penalty formula currently at 0 is still a penalty icon (with a building tag it would still not count).
      const penalty = fakeCard({name: 'Penalty Works' as CardName, type: CardType.AUTOMATED, tags: [Tag.BUILDING], victoryPoints: {cities: {}, each: -1}});
      p1.playedCards.push(penalty);
      expect(resolutionCount(p1, 'buildingCardsWithNonNegativeVp').count).eq(3);
    });

    it('one card is one unit — two building tags or a big VP icon count once; wild tags make nobody a Building card', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(
        fakeCard({name: 'Twin Towers' as CardName, type: CardType.AUTOMATED, tags: [Tag.BUILDING, Tag.BUILDING], victoryPoints: 3}),
        new MiningGuild(), // two building tags, no VP icon → no
        new NobelPrize(), // a wild tag and 2 VP → no printed building tag
      );
      expect(resolutionCount(p1, 'buildingCardsWithNonNegativeVp').count).eq(1);
    });

    it('only the player\'s own cards IN PLAY: not the hand, not another player\'s tableau; played events are face down unless Odyssey', () => {
      const [, p1, p2] = reduxGame();
      p1.cardsInHand.push(new ArtificialLake());
      p2.playedCards.push(new DomedCrater());
      const buildingEvent = fakeCard({name: 'Monument Event' as CardName, type: CardType.EVENT, tags: [Tag.BUILDING, Tag.EVENT], victoryPoints: 1});
      p1.playedCards.push(buildingEvent);
      expect(resolutionCount(p1, 'buildingCardsWithNonNegativeVp').count, 'hand, rival tableau, face-down event').eq(0);
      expect(resolutionCount(p2, 'buildingCardsWithNonNegativeVp').cards).deep.eq([CardName.DOMED_CRATER]);
      // Odyssey keeps events face up: their tags are in play — the tag-activity rule, not a special case.
      p1.playedCards.push(new Odyssey());
      expect(p1.tags.eventTagsInPlay()).is.true;
      expect(resolutionCount(p1, 'buildingCardsWithNonNegativeVp').cards).deep.eq(['Monument Event']);
    });

    it('the bespoke icons declare their sign: Search for Life reads non-negative, Vermin a penalty (the rule MarsBot scoring shares)', () => {
      const [, p1] = reduxGame();
      expect(new SearchForLife().victoryPointsSign).eq('nonNegative');
      expect(new Vermin().victoryPointsSign).eq('negative');
      p1.playedCards.push(fakeCard({name: 'Unknown Scorer' as CardName, type: CardType.AUTOMATED, tags: [Tag.BUILDING], victoryPoints: 'special'}));
      expect(resolutionCount(p1, 'buildingCardsWithNonNegativeVp').count, 'an undeclared bespoke icon is never read as non-negative').eq(0);
    });
  });

  describe('the enactment', () => {
    it('raises EVERY participant\'s M€ production by min(5, B + I) — voters or not — through the standard production change', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner, one delegate: no party effect) — Agenda 0 → step 1 in the phase = influence 1; two counted cards.
      p1.playedCards.push(...countedCards(2));
      // p2 never voted — influence 2, one counted card.
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      p2.playedCards.push(...countedCards(1));
      p1.production.override({megacredits: 3});
      p2.production.override({megacredits: 0});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.enacted).eq(AWARD);
      expect(parliament.rulingParty()).eq(PartyName.MARS);
      expect(p1.production.megacredits, 'B 2 + I 1 (after the winner\'s Agenda step)').eq(3 + 3);
      expect(p2.production.megacredits, 'B 1 + I 2').eq(0 + 3);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'production', effect: 'production', production: Resource.MEGACREDITS, amount: 3, count: 2, influence: 1, uncapped: 3, before: 3, after: 6});
      expect(outcomeOf(parliament, p1)?.counted).deep.eq([CardName.ARTIFICIAL_LAKE, CardName.DOMED_CRATER]);
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'production', amount: 3, count: 1, influence: 2, before: 0, after: 3});
    });

    it('the cap bounds the INCREASE: production 10 becomes 15, B 4 + I 3 still pays +5 (the outcome keeps the sum 7)', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(...countedCards(4));
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1); // the winner's step lands on influence 3
      p1.production.override({megacredits: 10});
      endGeneration(game);
      runAllActions(game);
      expect(p1.production.megacredits).eq(15);
      expect(outcomeOf(parliament, p1)).deep.include({amount: 5, count: 4, influence: 3, uncapped: 7, before: 10, after: 15});
      // p2 with nothing: named, skipped, nothing changed.
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'skipped', amount: 0, count: 0, influence: 0, reason: 'No qualifying cards and no influence'});
    });

    it('a negative production rises the ordinary way', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(...countedCards(2));
      p1.production.override({megacredits: -4});
      endGeneration(game);
      runAllActions(game);
      expect(p1.production.megacredits).eq(-4 + 3);
      expect(outcomeOf(parliament, p1)).deep.include({before: -4, after: -1, amount: 3});
    });

    it('influence comes from the Redux ledger AFTER the winner\'s Agenda step — never the delegates on the card', () => {
      const [game, p1, , parliament] = stage();
      // Three more delegates on the card (four in all): delegates give no influence.
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.agenda.set(p1.id, 2); // influence 1 now; the phase's step lands on 3 = influence 2
      expect(parliament.influence(p1)).eq(1);
      endGeneration(game);
      runAllActions(game);
      expect(parliament.agendaOf(p1)).eq(3);
      expect(outcomeOf(parliament, p1)).deep.include({influence: 2, count: 0, amount: 2});
    });

    it('a neutral winner cancels nothing: every participant is still paid', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, AWARD);
      parliament.addNeutralVote(parliament.slots[0]);
      p1.playedCards.push(...countedCards(1));
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(parliament.enacted).eq(AWARD);
      expect(outcomeOf(parliament, p1)).deep.include({amount: 1, count: 1, influence: 0});
      expect(outcomeOf(parliament, p2)).deep.include({amount: 1, count: 0, influence: 1});
    });

    it('two delegates grant the Mars First EFFECT, never this effect: nothing is paid before the enactment', () => {
      const [, p1, , parliament] = stage();
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      p1.playedCards.push(...countedCards(3));
      const before = p1.production.megacredits;
      expect(parliament.hasPartyEffect(p1, PartyName.MARS)).is.true;
      expect(p1.production.megacredits).eq(before);
      expect(parliament.lastPhase).is.undefined;
    });

    it('the journal carries ONE line per player with the whole calculation and the resolution as its source; the recorder sees the production change', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(...countedCards(4));
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1);
      p1.production.override({megacredits: 2});
      endGeneration(game);
      runAllActions(game);
      const capped = game.gameLog.filter((entry) => entry.message.startsWith('${0} gained ${1} ${2} production from ${3}: ${4} Building card(s) with a non-negative VP icon + ${5} influence = ${6}, limited'));
      expect(capped).has.length(1);
      const data = capped[0].data;
      expect(data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(ARCHITECTURE_AWARD_ID);
      expect(data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['5', '4', '3', '7', '2', '7']);
      expect(game.gameLog.filter((entry) => entry.message.includes('no ${1} production from ${2}')), 'p2\'s zero is named').has.length(1);
      // The standard production change was recorded under the resolution's source (the phase's scope).
      const deltas = game.events.events.filter((e) => e.type === 'production-changed' && e.player === p1.color);
      const award = deltas.filter((e) => e.source?.kind === 'resolution' && e.source.id === ARCHITECTURE_AWARD_ID);
      expect(award).has.length(1);
      expect(award[0].impact?.production?.megacredits).eq(5);
      expect(award[0].impact?.snapshot).deep.include({before: 2, after: 7});
      expect(p2.production.megacredits).eq(0);
    });
  });

  describe('once per enactment', () => {
    it('later cards, influence and a change of government never recompute what was paid', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(...countedCards(1));
      endGeneration(game);
      runAllActions(game);
      const paid = p1.production.megacredits;
      const outcome = outcomeOf(parliament, p1);
      expect(outcome).deep.include({amount: 2, count: 1, influence: 1});
      // More qualifying cards and more influence afterwards: nothing moves.
      p1.playedCards.push(new SoilFactory(), new SpaceElevator());
      parliament.agenda.set(p1.id, 12);
      getParliamentModel(game, p1);
      expect(p1.production.megacredits).eq(paid);
      expect(outcomeOf(parliament, p1)).deep.eq(outcome);
      // A new government: the production stays.
      seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
      expect(parliament.rulingParty()).eq(PartyName.INDUSTRIALISTS);
      expect(p1.production.megacredits).eq(paid);
    });

    it('a reload after the enactment pays nothing again; the recorded result survives', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(...countedCards(2));
      endGeneration(game);
      runAllActions(game);
      const paid = p1.production.megacredits;
      const live = reload(game);
      const one = live.getPlayerById(p1.id);
      expect(one.production.megacredits).eq(paid);
      settleParliamentGates(live);
      expect(live.parliament!.lastPhase?.outcomes?.filter((o) => o.player === p1.id && o.step === 'production')).deep.eq(
        parliament.lastPhase?.outcomes?.filter((o) => o.player === p1.id && o.step === 'production'));
    });

    it('an enactment interrupted between two players resumes with the second only: the first is never paid twice (reload AND an in-memory re-entry)', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(...countedCards(2));
      p2.playedCards.push(...countedCards(3));
      p1.production.override({megacredits: 1});
      p2.production.override({megacredits: 1});
      // p2's increase fails once (a crash in the middle of the effects step).
      const realAdd = p2.production.add.bind(p2.production);
      let failures = 0;
      p2.production.add = (resource, amount, options) => {
        if (resource === Resource.MEGACREDITS && failures === 0) {
          failures++;
          throw new Error('interrupted');
        }
        realAdd(resource, amount, options);
      };
      expect(() => endGeneration(game)).to.throw('interrupted');
      expect(parliament.phase?.step).eq('effects');
      expect(p1.production.megacredits, 'p1 was paid before the interruption').eq(1 + 3);
      const bySeat = parliament.phase?.appliedBySeat ?? {};
      expect((bySeat[p1.id] ?? []).filter((key) => key.endsWith(':production'))).has.length(1);
      expect((bySeat[p2.id] ?? []).some((key) => key.endsWith(':production'))).is.false;

      // A reload of that state resumes the phase: p2 once, p1 not again.
      const live = reload(game);
      runAllActions(live);
      const one = live.getPlayerById(p1.id);
      const two = live.getPlayerById(p2.id);
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      expect(one.production.megacredits).eq(1 + 3);
      expect(two.production.megacredits).eq(1 + 3);
      settleParliamentGates(live);
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === p1.id && o.step === 'production')).has.length(1);
      expect(outcomes.filter((o) => o.player === p2.id && o.step === 'production')).has.length(1);

      // The same state re-entered in memory (a repeated handler call on the
      // original, still mid-phase game object) behaves the same.
      p2.production.add = realAdd;
      ParliamentPhase.resume(game, parliament, (final: boolean) => (game as Game).continueAfterParliamentPhase(final));
      runAllActions(game);
      expect(p1.production.megacredits, 'the re-entry skips the applied key').eq(1 + 3);
      expect(p2.production.megacredits).eq(1 + 3);
    });

    it('a later, legal enactment of the same card applies again, by the table as it stands then', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(...countedCards(1));
      endGeneration(game);
      runAllActions(game);
      expect(p1.production.megacredits).eq(2);
      game.phase = Phase.ACTION;
      p1.playedCards.push(new SoilFactory());
      seatResolution(parliament, 0, AWARD);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      endGeneration(game);
      runAllActions(game);
      // Agenda 1 → 2 (a TR step: influence stays 1); two counted cards now.
      settleParliamentGates(game);
      expect(parliament.lastPhase?.generation).eq(2);
      expect(outcomeOf(parliament, p1)).deep.include({count: 2, influence: 1, amount: 3});
      expect(p1.production.megacredits).eq(2 + 3);
    });
  });

  describe('the chairman quest — play 2 building tags', () => {
    function playAsAction(player: TestPlayer, card: ICard): void {
      const events = player.game.events;
      events.beginAction(player, {kind: 'card', card: card.name, owner: player.color}, {category: 'card-play'});
      try {
        player.playCard(card as IProjectCard);
      } finally {
        events.endScope();
      }
      runAllActions(player.game);
    }

    function enactAward(): [IGame, TestPlayer, TestPlayer, Parliament] {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      runAllActions(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(ARCHITECTURE_AWARD_ID);
      return [game, p1, p2, parliament];
    }

    it('counts played building TAGS regardless of VP; cards already in play and the enactment itself count nothing', () => {
      const [game, p1, p2, parliament] = enactAward();
      expect(parliament.questProgressOf(p1), 'the enactment is not a building play').eq(0);
      p1.playedCards.push(new ArtificialLake(), new DomedCrater());
      expect(parliament.questProgressOf(p1), 'no retroactive progress').eq(0);
      playAsAction(p1, new Mine()); // a building tag, no VP icon
      expect(parliament.questProgressOf(p1)).eq(1);
      playAsAction(p1, new BiomassCombustors()); // a building tag, a negative icon
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
      // Once per generation: nobody else completes it.
      playAsAction(p2, new Mine());
      playAsAction(p2, new SoilFactory());
      expect(parliament.questProgressOf(p2)).eq(0);
      expect(parliament.chairman).eq(p1.id);
    });

    it('one card with two building tags completes it at once; a wild tag is no building tag', () => {
      const [game, p1, p2, parliament] = enactAward();
      playAsAction(p2, new NobelPrize());
      expect(parliament.questProgressOf(p2)).eq(0);
      const agendaBefore = parliament.agendaOf(p1);
      playAsAction(p1, fakeCard({name: 'Twin Towers' as CardName, type: CardType.AUTOMATED, tags: [Tag.BUILDING, Tag.BUILDING]}));
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.agendaOf(p1), 'the chairman reward: one Agenda step').eq(agendaBefore + 1);
    });

    it('a sitting chairman who completes it keeps the seat and still takes the Agenda step', () => {
      const [game, p1, , parliament] = enactAward();
      parliament.chairman = p1.id;
      const agendaBefore = parliament.agendaOf(p1);
      playAsAction(p1, new Mine());
      playAsAction(p1, new ArtificialLake());
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.agendaOf(p1)).eq(agendaBefore + 1);
    });

    it('progress and the completion survive a reload; the reward is never granted twice', () => {
      const [game, p1] = enactAward();
      playAsAction(p1, new Mine());
      let live = reload(game);
      let one = live.getPlayerById(p1.id) as TestPlayer;
      live.phase = Phase.ACTION;
      expect(live.parliament!.questProgressOf(one)).eq(1);
      playAsAction(one, new ArtificialLake());
      expect(live.parliament!.quest?.completedBy).eq(one.id);
      answerQuestGate(live, one);
      const agenda = live.parliament!.agendaOf(one);
      live = reload(live);
      one = live.getPlayerById(p1.id) as TestPlayer;
      live.phase = Phase.ACTION;
      playAsAction(one, new SoilFactory());
      expect(live.parliament!.agendaOf(one), 'no second reward after the reload').eq(agenda);
      expect(live.parliament!.quest?.completedBy).eq(one.id);
    });
  });

  describe('MarsBot and the model', () => {
    it('MarsBot (mode none) is never counted, never paid, and the phase does not stall', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, AWARD);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.playedCards.push(...countedCards(2));
      bot.playedCards.push(...countedCards(2));
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.map((o) => o.player)).deep.eq([human.id]);
      expect(human.production.megacredits).eq(3);
      expect(getParliamentModel(game, human)?.players.find((p) => p.color === bot.color)?.counts, 'no count for a seat outside the parliament').is.undefined;
    });

    it('every seat\'s count (number + cards) rides the model; the outcome reaches the client with colours and every recorded input', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(new ArtificialLake(), new Mine(), new PhysicsComplex());
      const model = getParliamentModel(game, p2);
      // The model carries EVERY counted term the catalog declares; this one is
      // the card count — one unit per qualifying card, no per-card column.
      const countOfSeat = (color: typeof p1.color) =>
        model?.players.find((p) => p.color === color)?.counts?.find((c) => c.id === 'buildingCardsWithNonNegativeVp');
      expect(countOfSeat(p1.color)).deep.eq(
        {id: 'buildingCardsWithNonNegativeVp', count: 2, cards: [CardName.ARTIFICIAL_LAKE, CardName.PHYSICS_COMPLEX]});
      expect(countOfSeat(p2.color)).deep.eq({id: 'buildingCardsWithNonNegativeVp', count: 0, cards: []});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      expect(last?.outcomes?.find((o) => o.player === p1.color)).deep.include({kind: 'production', amount: 3, count: 2, influence: 1, uncapped: 3});
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes).has.length(2);
    });
  });
});
